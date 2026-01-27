import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const monthStr = searchParams.get('month') || (new Date().getMonth() + 1).toString();
        const yearStr = searchParams.get('year') || new Date().getFullYear().toString();

        const month = parseInt(monthStr);
        const year = parseInt(yearStr);

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is an employee of this club
        const employeeCheck = await query(
            `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );
        if ((employeeCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get club settings
        let clubSettings = { day_start_hour: 9, night_start_hour: 21 };
        try {
            const clubRes = await query(`SELECT * FROM clubs WHERE id = $1`, [clubId]);
            if (clubRes.rows[0]) {
                const row = clubRes.rows[0];
                clubSettings = {
                    day_start_hour: row.day_start_hour ?? 9,
                    night_start_hour: row.night_start_hour ?? 21
                };
            }
        } catch (e: any) {
            console.warn('Failed to fetch club settings:', e.message);
        }

        const startOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

        // Get employees - FILTERED for Admins
        // We look for roles containing 'админ' or 'admin' (case insensitive)
        let employees = [];
        try {
            const employeesRes = await query(
                `SELECT u.id, u.full_name, r.name as role, ce.dismissed_at, ce.display_order
                 FROM club_employees ce
                 JOIN users u ON u.id = ce.user_id
                 LEFT JOIN roles r ON u.role_id = r.id
                 WHERE ce.club_id = $1 
                 AND (ce.dismissed_at IS NULL OR ce.dismissed_at >= $2::date)
                 AND (LOWER(r.name) LIKE '%админ%' OR LOWER(r.name) LIKE '%admin%')
                 ORDER BY ce.dismissed_at ASC NULLS FIRST, ce.display_order ASC, u.full_name ASC`,
                [clubId, startOfMonth]
            );
            employees = employeesRes.rows;
        } catch (err: any) {
            throw new Error(`Employee query failed: ${err.message}`);
        }

        // Get schedule for these employees
        let schedule = {};
        if (employees.length > 0) {
            const employeeIds = employees.map(e => e.id); // Should be UUIDs
            try {
                // We need to pass the array of IDs to the query using ANY
                const scheduleRes = await query(
                    `SELECT user_id, TO_CHAR(date, 'YYYY-MM-DD') as date, shift_type 
                     FROM work_schedules 
                     WHERE club_id = $1 
                     AND date >= $2 AND date <= $3
                     AND user_id = ANY($4::uuid[])`,
                    [clubId, startOfMonth, endOfMonth, employeeIds]
                );

                const scheduleMap: Record<string, Record<string, string>> = {};
                scheduleRes.rows.forEach(row => {
                    if (!scheduleMap[row.user_id]) scheduleMap[row.user_id] = {};
                    scheduleMap[row.user_id][row.date] = row.shift_type;
                });
                schedule = scheduleMap;
            } catch (err: any) {
                console.error('Failed to fetch schedule:', err);
                schedule = {};
            }
        }

        return NextResponse.json({
            employees,
            schedule,
            clubSettings
        });

    } catch (error: any) {
        console.error('Employee Schedule API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
