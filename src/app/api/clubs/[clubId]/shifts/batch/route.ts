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

        // Helper to parse Local ISO string (YYYY-MM-DDTHH:mm:ss) into a Date object
        // that represents that exact wall-clock time in the CLUB's timezone.
        // Since we don't have a library like date-fns-tz, we determine the offset iteratively.
        const parseClubDate = (isoStr: string, timeZone: string): Date => {
            // 1. Parse as if UTC to get the base components
            // e.g. "2026-01-25T08:00:00" -> 08:00 UTC
            let guess = new Date(isoStr + 'Z');

            // 2. Check what time this guess actual represents in the Club's Timezone
            // e.g. 08:00 UTC in Moscow (+3) might be 11:00
            // We want the result to be 08:00 in Moscow.
            // So we need to shift the guess backwards by the offset.

            const getParts = (d: Date) => {
                const parts = new Intl.DateTimeFormat('en-US', {
                    timeZone,
                    year: 'numeric', month: 'numeric', day: 'numeric',
                    hour: 'numeric', minute: 'numeric', second: 'numeric',
                    hour12: false
                }).formatToParts(d);
                const p: any = {};
                parts.forEach(({ type, value }) => p[type] = parseInt(value, 10));
                return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
            };

            // Iterative adjustment to converge on the correct UTC timestamp
            // Usually takes 1-2 iterations.
            let utc = new Date(guess.getTime());
            for (let i = 0; i < 3; i++) {
                const currentInZone = getParts(utc); // What time is 'utc' in Moscow? (returned as a UTC-equivalent date for math)
                const diff = currentInZone.getTime() - guess.getTime();

                if (diff === 0) break; // Exact match found

                utc = new Date(utc.getTime() - diff);
            }
            return utc;
        };

        for (const [index, shift] of shifts.entries()) {
            try {
                const {
                    employee_id,
                    check_in, // format "YYYY-MM-DDTHH:mm:ss" (local wall clock)
                    check_out, // format "YYYY-MM-DDTHH:mm:ss"
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

                // Parse correctly using Club Timezone
                // If the string contains 'Z' or offset, stick to standard parsing (fallback)
                // But simplified logic expects local string now.
                const isLocalStr = !check_in.includes('Z') && !check_in.includes('+');
                const checkInDate = isLocalStr ? parseClubDate(check_in, clubTimezone) : new Date(check_in);
                const checkOutDate = isLocalStr ? parseClubDate(check_out, clubTimezone) : new Date(check_out);

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
                const start = checkInDate.getTime();
                const end = checkOutDate.getTime();
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
                        checkInDate, // Pass Date object; pg driver handles serialization to TIMESTAMP/TIMESTAMPTZ
                        checkOutDate,
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
