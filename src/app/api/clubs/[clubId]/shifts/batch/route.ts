import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateSalary } from '@/lib/salary-calculator';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const body = await request.json();
        const { shifts } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!Array.isArray(shifts) || shifts.length === 0) {
            return NextResponse.json({ error: 'No shifts provided' }, { status: 400 });
        }

        // Parse clubId
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

        // Get club settings once
        const clubSettings = await query(
            `SELECT day_start_hour, night_start_hour, timezone FROM clubs WHERE id = $1::integer`,
            [club_id_int]
        );
        const dayStartHour = clubSettings.rows[0]?.day_start_hour ?? 8;
        const nightStartHour = clubSettings.rows[0]?.night_start_hour ?? 20;
        const clubTimezone = clubSettings.rows[0]?.timezone || 'Europe/Moscow';

        const results = [];
        const errors = [];

        // Begin Transaction (simulated by just iterating, real transaction would be better but simple loop is ok for now if we return individual statuses)
        // Actually, for "batch", users expect all or nothing usually, OR partial success. Partial success is often better for big lists.
        // I will do partial success.

        for (const [index, shift] of shifts.entries()) {
            try {
                const {
                    employee_id,
                    check_in,
                    check_out,
                    cash_income,
                    card_income,
                    expenses,
                    report_comment,
                    report_data
                } = shift;

                if (!employee_id || !check_in) {
                    throw new Error('Employee and check-in required');
                }

                // Determine shift type
                let shiftType = 'DAY';
                const checkInDate = new Date(check_in);
                const hourInClubTZ = new Intl.DateTimeFormat('en-US', {
                    timeZone: clubTimezone,
                    hour: 'numeric',
                    hour12: false
                }).format(checkInDate);
                const hour = parseInt(hourInClubTZ);
                if (!isNaN(hour)) {
                    if (hour >= dayStartHour && hour < nightStartHour) {
                        shiftType = 'DAY';
                    } else {
                        shiftType = 'NIGHT';
                    }
                }

                // Calculate Salary
                let calculatedSalary = 0;
                let salaryBreakdown = {};

                // Find scheme
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

                // Calculate hours
                const start = new Date(check_in).getTime();
                const end = new Date(check_out).getTime();
                const total_hours = (end - start) / (1000 * 60 * 60);

                if ((schemeRes.rowCount || 0) > 0) {
                    const scheme = schemeRes.rows[0];
                    const calculation = await calculateSalary({
                        id: 'batch-shift',
                        total_hours: total_hours > 0 ? total_hours : 0,
                        report_data: report_data || {}
                    }, scheme.formula, {
                        total_revenue: (Number(cash_income) || 0) + (Number(card_income) || 0),
                        revenue_cash: Number(cash_income) || 0,
                        revenue_card: Number(card_income) || 0,
                        expenses: Number(expenses) || 0
                    });

                    calculatedSalary = calculation.total;
                    salaryBreakdown = calculation.breakdown;
                }

                // Insert
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
                        $1::uuid, $2::integer, $3::timestamp, $4::timestamp, 
                        $5::decimal, $6::decimal, $7::decimal, $8::decimal, 
                        $9, $10::jsonb, $11, $12, $13::decimal, $14::jsonb
                    ) RETURNING id`,
                    [
                        employee_id,
                        club_id_int,
                        check_in,
                        check_out,
                        total_hours > 0 ? total_hours : 0,
                        cash_income || 0,
                        card_income || 0,
                        expenses || 0,
                        report_comment || '',
                        JSON.stringify(report_data || {}),
                        'CLOSED', // Batch imported shifts are usually closed history
                        shiftType,
                        calculatedSalary,
                        JSON.stringify(salaryBreakdown)
                    ]
                );

                results.push({ index, id: result.rows[0].id, status: 'success' });

            } catch (err: any) {
                console.error(`Error processing shift at index ${index}:`, err);
                errors.push({ index, error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            imported: results.length,
            failed: errors.length,
            results,
            errors
        });

    } catch (error: any) {
        console.error('Batch Import Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
