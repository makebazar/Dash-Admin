import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET: Get all shifts for a club
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Parse date filters from query params
        const url = new URL(request.url);
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        // Build query with optional date filters
        let sqlQuery = `
            SELECT 
                s.id,
                s.user_id,
                u.full_name as employee_name,
                s.check_in,
                s.check_out,
                s.total_hours,
                s.cash_income,
                s.card_income,
                s.expenses,
                s.report_comment,
                s.report_data,
                s.status,
                s.shift_type
             FROM shifts s
             LEFT JOIN users u ON s.user_id = u.id
             WHERE s.club_id = $1
        `;

        const queryParams: any[] = [clubId];

        if (startDate) {
            queryParams.push(startDate);
            sqlQuery += ` AND s.check_in >= $${queryParams.length}`;
        }

        if (endDate) {
            queryParams.push(endDate);
            sqlQuery += ` AND s.check_in <= $${queryParams.length}`;
        }

        sqlQuery += ` ORDER BY s.check_in DESC LIMIT 500`;

        const shiftsResult = await query(sqlQuery, queryParams);

        return NextResponse.json({ shifts: shiftsResult.rows });

    } catch (error: any) {
        console.error('Get Shifts Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Create a shift manually (owner only)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse clubId to integer
        const club_id_int = parseInt(clubId);
        if (isNaN(club_id_int)) {
            return NextResponse.json({ error: 'Invalid Club ID' }, { status: 400 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1::integer AND owner_id = $2::uuid`,
            [club_id_int, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const {
            employee_id,
            check_in,
            check_out,
            cash_income,
            card_income,
            expenses,
            report_comment,
            total_hours,
            report_data
        } = body;

        if (!employee_id || !check_in) {
            return NextResponse.json({ error: 'Employee and check-in time are required' }, { status: 400 });
        }

        // Verify employee belongs to this club or is the owner
        const employeeCheck = await query(
            `
            SELECT 1 FROM club_employees WHERE club_id = $1::integer AND user_id = $2::uuid
            UNION
            SELECT 1 FROM clubs WHERE id = $1::integer AND owner_id = $2::uuid
            `,
            [club_id_int, employee_id]
        );

        if ((employeeCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Employee not found in this club' }, { status: 400 });
        }

        // Get club settings for auto-detecting shift type
        const clubSettings = await query(
            `SELECT day_start_hour, night_start_hour FROM clubs WHERE id = $1::integer`,
            [club_id_int]
        );
        const dayStartHour = clubSettings.rows[0]?.day_start_hour ?? 8;
        const nightStartHour = clubSettings.rows[0]?.night_start_hour ?? 20;

        // Determine shift type based on check_in hour
        let shiftType = body.shift_type;
        if (!shiftType) {
            const checkInDate = new Date(check_in);
            const hour = checkInDate.getHours();
            // Day shift if hour is between dayStartHour and nightStartHour
            if (!isNaN(hour)) {
                if (hour >= dayStartHour && hour < nightStartHour) {
                    shiftType = 'DAY';
                } else {
                    shiftType = 'NIGHT';
                }
            } else {
                shiftType = 'DAY'; // Fallback
            }
        }

        // Create shift
        const result = await query(
            `INSERT INTO shifts (
                user_id, 
                club_id, 
                check_in, 
                check_out, 
                total_hours,
                cash_income, 
                card_income, 
                expenses, 
                report_comment,
                report_data,
                status,
                shift_type
            ) VALUES (
                $1::uuid, 
                $2::integer, 
                $3::timestamp, 
                $4::timestamp, 
                $5::decimal, 
                $6::decimal, 
                $7::decimal, 
                $8::decimal, 
                $9, 
                $10, 
                $11, 
                $12
            )
            RETURNING id`,
            [
                employee_id,
                club_id_int,
                check_in,
                check_out || null,
                total_hours || null,
                cash_income || 0,
                card_income || 0,
                expenses || 0,
                report_comment || '',
                JSON.stringify(report_data || {}),
                check_out ? 'CLOSED' : 'ACTIVE',
                shiftType
            ]
        );

        return NextResponse.json({
            success: true,
            shift_id: result.rows[0]?.id,
            shift_type: shiftType
        });

    } catch (error: any) {
        console.error('Create Shift Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
