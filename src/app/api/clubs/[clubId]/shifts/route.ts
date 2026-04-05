import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateSalary } from '@/lib/salary-calculator';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';
import { requireClubApiAccess } from '@/lib/club-api-access';

// GET: Get all shifts for a club
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        await requireClubApiAccess(clubId)

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
                s.has_owner_corrections,
                s.owner_correction_changes,
                s.owner_notes,
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
            // If endDate is just a date (YYYY-MM-DD), make it end of day to include all shifts on that day
            const end = (endDate.length === 10) ? `${endDate} 23:59:59` : endDate;
            queryParams.push(end);
            sqlQuery += ` AND s.check_in <= $${queryParams.length}`;
        }

        sqlQuery += ` ORDER BY s.check_in DESC LIMIT 500`;

        const shiftsResult = await query(sqlQuery, queryParams);

        return NextResponse.json({ shifts: shiftsResult.rows });

    } catch (error: any) {
        const status = error?.status
        if (status) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
        }
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

        const guard = await ensureOwnerSubscriptionActive(club_id_int, userId)
        if (!guard.ok) return guard.response

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
            `SELECT day_start_hour, night_start_hour, timezone FROM clubs WHERE id = $1::integer`,
            [club_id_int]
        );
        const dayStartHour = clubSettings.rows[0]?.day_start_hour ?? 8;
        const nightStartHour = clubSettings.rows[0]?.night_start_hour ?? 20;
        const clubTimezone = clubSettings.rows[0]?.timezone || 'Europe/Moscow';

        // Determine shift type based on check_in hour
        let shiftType = body.shift_type;
        if (!shiftType) {
            const checkInDate = new Date(check_in);

            // Get the hour in the club's timezone, not server's timezone
            const timeFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: clubTimezone,
                hour: 'numeric',
                minute: 'numeric',
                hourCycle: 'h23'
            });
            const timeParts = timeFormatter.formatToParts(checkInDate);
            const hour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0');
            const minute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0');
            const hourFloat = hour + (minute / 60);

            // Tolerance in hours (e.g. 1.5 hours). If day starts at 8:00, starting at 6:31 is still DAY.
            const tolerance = 1.5;

            // Day shift if hour is between dayStartHour and nightStartHour
            if (!isNaN(hourFloat)) {
                // Check if the shift crosses midnight or if day/night config is wrapped
                if (dayStartHour < nightStartHour) {
                    // Standard day: 08:00 to 20:00
                    const dayStartWithTolerance = dayStartHour - tolerance;
                    const nightStartWithTolerance = nightStartHour - tolerance;

                    if (hourFloat >= dayStartWithTolerance && hourFloat < nightStartWithTolerance) {
                        shiftType = 'DAY';
                    } else {
                        shiftType = 'NIGHT';
                    }
                } else {
                    // Wrapped day (unlikely but possible): e.g. Day starts 20:00, Night starts 08:00
                    const dayStartWithTolerance = dayStartHour - tolerance;
                    const nightStartWithTolerance = nightStartHour - tolerance;

                    if (hourFloat >= dayStartWithTolerance || hourFloat < nightStartWithTolerance) {
                        shiftType = 'DAY';
                    } else {
                        shiftType = 'NIGHT';
                    }
                }
            } else {
                shiftType = 'DAY'; // Fallback
            }
        }

        // Calculate Salary
        let calculatedSalary = 0;
        let salaryBreakdown = {};

        // Get assigned scheme
        const schemeRes = await query(
            `SELECT ss.id, ss.name, sv.formula
             FROM employee_salary_assignments esa
             JOIN salary_schemes ss ON esa.scheme_id = ss.id
             JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
             WHERE esa.user_id = $1::uuid AND esa.club_id = $2::integer
             ORDER BY sv.version DESC
             LIMIT 1`,
            [employee_id, club_id_int]
        );

        if ((schemeRes.rowCount || 0) > 0) {
            const scheme = schemeRes.rows[0];
            const calculation = await calculateSalary({
                id: 'new-manual-shift', // Placeholder ID
                total_hours: Number(total_hours) || 0,
                report_data: report_data || {}
            }, scheme.formula, {
                total_revenue: (Number(cash_income) || 0) + (Number(card_income) || 0),
                revenue_cash: Number(cash_income) || 0,
                revenue_card: Number(card_income) || 0,
                expenses: Number(expenses) || 0,
                ...report_data
            });

            calculatedSalary = calculation.total;
            salaryBreakdown = calculation.breakdown;
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
                shift_type,
                calculated_salary,
                salary_breakdown
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
                $12,
                $13::decimal,
                $14::jsonb
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
                shiftType,
                calculatedSalary,
                JSON.stringify(salaryBreakdown)
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
