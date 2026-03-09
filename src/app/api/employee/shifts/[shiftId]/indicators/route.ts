import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateSalary } from '@/lib/salary-calculator';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ shiftId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { shiftId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Get current shift data
        const shiftRes = await query(
            `SELECT s.*, u.full_name, c.id as club_id
             FROM shifts s
             JOIN users u ON s.user_id = u.id
             JOIN clubs c ON s.club_id = c.id
             WHERE s.id = $1 AND s.user_id = $2`,
            [shiftId, userId]
        );

        if (shiftRes.rowCount === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }
        const shift = shiftRes.rows[0];

        // 2. Get salary scheme
        const schemeRes = await query(
            `SELECT sv.formula
             FROM employee_salary_assignments esa
             JOIN salary_schemes ss ON esa.scheme_id = ss.id
             JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
             WHERE esa.user_id = $1 AND esa.club_id = $2
             ORDER BY sv.version DESC
             LIMIT 1`,
            [userId, shift.club_id]
        );

        if (schemeRes.rowCount === 0) {
             return NextResponse.json({ projected_instant_payout: 0 });
        }

        const scheme = schemeRes.rows[0].formula;

        // 3. Calculate preliminary salary
        // We use current report_data and assume shift ends now for calculation
        const now = new Date();
        const checkIn = new Date(shift.check_in);
        const diffMs = now.getTime() - checkIn.getTime();
        const currentHours = diffMs / (1000 * 60 * 60);

        // Fetch evaluations (checklist scores) if any
        const evaluationsRes = await query(
            `SELECT template_id, total_score as score_percent FROM evaluations WHERE shift_id = $1`,
            [shiftId]
        );

        const calculation = await calculateSalary({
            id: shiftId,
            total_hours: currentHours,
            report_data: shift.report_data || {},
            evaluations: evaluationsRes.rows,
            bar_purchases: 0 // We don't deduct bar purchases from projected payout yet
        }, scheme, {
            // Metrics for calculation
            total_revenue: (Number(shift.cash_income) || 0) + (Number(shift.card_income) || 0),
            ...shift.report_data
        });

        // 4. Return instant payout amount
        return NextResponse.json({ 
            projected_instant_payout: calculation.breakdown?.instant_payout || 0,
            breakdown: calculation.breakdown
        });

    } catch (error: any) {
        console.error('Get Indicators Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ shiftId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { shiftId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { indicators } = await request.json();

        // 1. Verify shift is ACTIVE and belongs to the user
        const shiftRes = await query(
            `SELECT id, status, club_id FROM shifts WHERE id = $1 AND user_id = $2`,
            [shiftId, userId]
        );

        if (shiftRes.rowCount === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        const shift = shiftRes.rows[0];
        if (shift.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Shift is not active. Use the standard report to update closed shifts.' }, { status: 400 });
        }

        // 2. Update report_data (intermediate indicators)
        // We preserve existing data and merge new indicators
        await query(
            `UPDATE shifts 
             SET report_data = COALESCE(report_data::jsonb, '{}'::jsonb) || $1::jsonb
             WHERE id = $2`,
            [JSON.stringify(indicators), shiftId]
        );

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Update Indicators Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
