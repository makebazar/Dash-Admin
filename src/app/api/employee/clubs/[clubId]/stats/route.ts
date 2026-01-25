import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

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

        // Verify employee belongs to club
        const employeeCheck = await query(
            `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if (employeeCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get hourly rate from user's role
        const rateResult = await query(
            `SELECT 
        COALESCE(
          (r.default_kpi_settings->>'base_rate')::numeric,
          150
        ) as hourly_rate
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
            [userId]
        );

        const hourlyRate = rateResult.rows[0]?.hourly_rate || 150;

        // Get today's hours
        const todayResult = await query(
            `SELECT 
        COALESCE(SUM(
          EXTRACT(EPOCH FROM (COALESCE(check_out, NOW()) - check_in)) / 3600
        ), 0) as today_hours
       FROM shifts
       WHERE user_id = $1 
         AND club_id = $2
         AND DATE(check_in) = CURRENT_DATE`,
            [userId, clubId]
        );

        const todayHours = parseFloat(todayResult.rows[0]?.today_hours) || 0;

        // Get week's hours and earnings
        const weekResult = await query(
            `SELECT 
        COALESCE(SUM(
          EXTRACT(EPOCH FROM (COALESCE(check_out, NOW()) - check_in)) / 3600
        ), 0) as week_hours
       FROM shifts
       WHERE user_id = $1 
         AND club_id = $2
         AND check_in >= DATE_TRUNC('week', CURRENT_DATE)`,
            [userId, clubId]
        );

        const weekHours = parseFloat(weekResult.rows[0]?.week_hours) || 0;
        const weekEarnings = weekHours * hourlyRate;

        // Get month's ACTUAL earnings from calculated_salary
        const monthResult = await query(
            `SELECT 
                COALESCE(SUM(
                    EXTRACT(EPOCH FROM (COALESCE(check_out, NOW()) - check_in)) / 3600
                ), 0) as month_hours,
                COALESCE(SUM(calculated_salary), 0) as month_calculated_salary
             FROM shifts
             WHERE user_id = $1 
               AND club_id = $2
               AND DATE_TRUNC('month', check_in) = DATE_TRUNC('month', CURRENT_DATE)`,
            [userId, clubId]
        );

        const monthHours = parseFloat(monthResult.rows[0]?.month_hours) || 0;
        // Use actual calculated_salary if available, otherwise fall back to hours × rate
        const monthCalculatedSalary = parseFloat(monthResult.rows[0]?.month_calculated_salary) || 0;
        const monthEarnings = monthCalculatedSalary > 0 ? monthCalculatedSalary : (monthHours * hourlyRate);

        return NextResponse.json({
            today_hours: todayHours,
            week_hours: weekHours,
            week_earnings: weekEarnings,
            month_earnings: monthEarnings,
            hourly_rate: hourlyRate
        });

    } catch (error) {
        console.error('Get Employee Stats Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
