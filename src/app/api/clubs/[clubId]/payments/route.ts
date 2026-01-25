import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const ownerCheck = await query(`SELECT 1 FROM clubs WHERE id=$1 AND owner_id=$2`, [clubId, userId]);
        if (ownerCheck.rowCount === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { employee_id, amount, payment_method = 'CASH', month, year, notes, payment_type = 'salary' } = body;

        if (!employee_id || !amount || !month || !year) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Record payment with type
        const paymentRes = await query(
            `INSERT INTO payments (club_id, user_id, amount, payment_method, month, year, notes, created_by, payment_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, created_at`,
            [clubId, employee_id, amount, payment_method, month, year, notes, userId, payment_type]
        );

        const payment = paymentRes.rows[0];

        // For advances, skip salary snapshot (don't freeze KPI)
        if (payment_type === 'advance') {
            return NextResponse.json({
                payment_id: payment.id,
                payment_type: 'advance',
                snapshot_created: false,
                message: 'Advance payment recorded. KPI not frozen.'
            });
        }

        // 2. For full salary payment, get employee's salary scheme
        const schemeRes = await query(
            `SELECT ss.* 
             FROM employee_salary_assignments esa
             JOIN salary_schemes ss ON ss.id = esa.scheme_id
             WHERE esa.user_id = $1 AND esa.club_id = $2
             ORDER BY esa.assigned_at DESC
             LIMIT 1`,
            [employee_id, clubId]
        );

        const scheme = schemeRes.rows[0];
        if (!scheme) {
            return NextResponse.json({ error: 'No salary scheme found for employee' }, { status: 400 });
        }

        // 3. Get planned shifts for the period
        const plannedShiftsRes = await query(
            `SELECT planned_shifts 
             FROM employee_shift_schedules 
             WHERE club_id = $1 AND user_id = $2 AND month = $3 AND year = $4`,
            [clubId, employee_id, month, year]
        );
        const planned_shifts = plannedShiftsRes.rows[0]?.planned_shifts || 20;

        // 4. Create salary snapshot for unpaid shifts
        const snapshot = {
            paid_at: payment.created_at,
            scheme_id: scheme.id,
            scheme_name: scheme.name,
            hourly_rate: scheme.hourly_rate,
            revenue_percent: scheme.revenue_percent,
            period_bonuses: scheme.period_bonuses || [],
            planned_shifts: planned_shifts
        };

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        // 5. Update shifts to freeze salary with snapshot
        await query(
            `UPDATE shifts
             SET salary_snapshot = $1
             WHERE user_id = $2 
                AND club_id = $3
                AND check_in >= $4 
                AND check_in <= $5
                AND (salary_snapshot IS NULL OR salary_snapshot->>'paid_at' IS NULL)`,
            [JSON.stringify(snapshot), employee_id, clubId, startOfMonth, endOfMonth]
        );

        return NextResponse.json({
            payment_id: payment.id,
            payment_type: 'salary',
            snapshot_created: true,
            message: 'Payment recorded and salary frozen'
        });

    } catch (error) {
        console.error('Error recording payment:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET - List payments for a period
export async function GET(request: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;
        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get('month') || '0');
        const year = parseInt(searchParams.get('year') || '0');

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const ownerCheck = await query(`SELECT 1 FROM clubs WHERE id=$1 AND owner_id=$2`, [clubId, userId]);
        if (ownerCheck.rowCount === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const paymentsRes = await query(
            `SELECT 
                p.*,
                u.full_name as employee_name
             FROM payments p
             JOIN users u ON u.id = p.user_id
             WHERE p.club_id = $1
                ${month && year ? 'AND p.month = $2 AND p.year = $3' : ''}
             ORDER BY p.created_at DESC`,
            month && year ? [clubId, month, year] : [clubId]
        );

        return NextResponse.json({ payments: paymentsRes.rows });

    } catch (error) {
        console.error('Error fetching payments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
