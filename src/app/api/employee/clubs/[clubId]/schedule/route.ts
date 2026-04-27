import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { formatLocalDate } from '@/lib/utils';
import { getEmployeeRoleAccess } from '@/lib/employee-role-access';

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

        const access = await getEmployeeRoleAccess(clubId)
        if (!access.settings.schedule_enabled) {
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
        const startDate = formatLocalDate(new Date(year, month - 1, -2));
        const endOfMonth = formatLocalDate(new Date(year, month, 0));

        // Get employees - Filtered for shift staff
        let employees = [];
        try {
            const employeesRes = await query(
                `WITH member_rows AS (
                    SELECT
                        ce.user_id,
                        ce.dismissed_at,
                        ce.display_order,
                        ce.is_active,
                        ce.show_in_schedule,
                        ce.role as club_role,
                        1 as priority
                    FROM club_employees ce
                    WHERE ce.club_id = $1
                    UNION ALL
                    SELECT
                        c.owner_id as user_id,
                        NULL::timestamp as dismissed_at,
                        0::int as display_order,
                        TRUE as is_active,
                        TRUE as show_in_schedule,
                        'Владелец'::varchar as club_role,
                        0 as priority
                    FROM clubs c
                    WHERE c.id = $1
                ),
                dedup_members AS (
                    SELECT DISTINCT ON (user_id)
                        user_id,
                        dismissed_at,
                        display_order,
                        COALESCE(is_active, TRUE) as is_active,
                        COALESCE(show_in_schedule, TRUE) as show_in_schedule,
                        club_role
                    FROM member_rows
                    ORDER BY user_id, priority DESC
                )
                SELECT
                    u.id,
                    u.full_name,
                    CASE
                        WHEN LOWER(COALESCE(dm.club_role, '')) IN ('employee', 'emp', 'сотрудник') THEN COALESCE(r.name, 'Сотрудник')
                        WHEN COALESCE(NULLIF(dm.club_role, ''), '') <> '' THEN INITCAP(LOWER(dm.club_role))
                        ELSE COALESCE(r.name, 'Сотрудник')
                    END as role,
                    dm.dismissed_at,
                    dm.display_order
                FROM dedup_members dm
                JOIN users u ON u.id = dm.user_id
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE (
                    (dm.dismissed_at IS NULL AND dm.is_active = TRUE AND dm.show_in_schedule = TRUE)
                    OR
                    (dm.dismissed_at IS NOT NULL AND dm.dismissed_at >= $2::date)
                  )
                  AND (
                    LOWER(COALESCE(dm.club_role, '')) LIKE '%админ%'
                    OR LOWER(COALESCE(r.name, '')) LIKE '%админ%'
                    OR LOWER(COALESCE(dm.club_role, '')) LIKE '%admin%'
                    OR LOWER(COALESCE(r.name, '')) LIKE '%admin%'
                    OR LOWER(COALESCE(dm.club_role, '')) LIKE '%управля%'
                    OR LOWER(COALESCE(r.name, '')) LIKE '%управля%'
                    OR LOWER(COALESCE(dm.club_role, '')) LIKE '%manager%'
                    OR LOWER(COALESCE(r.name, '')) LIKE '%manager%'
                    OR COALESCE(dm.club_role, '') = 'Хостес'
                    OR COALESCE(r.name, '') = 'Хостес'
                    OR COALESCE(dm.club_role, '') = 'Владелец'
                  )
                ORDER BY dm.dismissed_at ASC NULLS FIRST, dm.display_order ASC, u.full_name ASC`,
                [clubId, startDate]
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
                    [clubId, startDate, endOfMonth, employeeIds]
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
