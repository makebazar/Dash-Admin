import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET - List maintenance tasks
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url);

        const status = searchParams.get('status');
        const assignedTo = searchParams.get('assigned_to') || searchParams.get('assigned');
        const equipmentId = searchParams.get('equipment_id');
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');
        const includeOverdue = searchParams.get('include_overdue') === 'true';
        const myTasks = searchParams.get('my_tasks') === 'true' || assignedTo === 'me';
        const sortBy = searchParams.get('sort_by');
        const order = searchParams.get('order') || 'asc';

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify access
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let sql = `
            SELECT 
                mt.id,
                mt.equipment_id,
                mt.task_type,
                mt.status,
                mt.due_date,
                mt.completed_at,
                mt.completed_by,
                mt.notes,
                mt.photos,
                mt.created_at,
                mt.updated_at,
                COALESCE(mt.assigned_user_id, e.assigned_user_id) as assigned_user_id,
                e.name as equipment_name,
                e.type as equipment_type,
                e.last_cleaned_at as last_cleaned_at,
                et.name_ru as equipment_type_name,
                et.icon as equipment_icon,
                w.name as workstation_name,
                w.zone as workstation_zone,
                COALESCE(u.full_name, eu.full_name) as assigned_to_name,
                cu.full_name as completed_by_name
            FROM equipment_maintenance_tasks mt
            JOIN equipment e ON mt.equipment_id = e.id
            LEFT JOIN equipment_types et ON e.type = et.code
            LEFT JOIN club_workstations w ON e.workstation_id = w.id
            LEFT JOIN users u ON mt.assigned_user_id = u.id
            LEFT JOIN users eu ON e.assigned_user_id = eu.id
            LEFT JOIN users cu ON mt.completed_by = cu.id
            WHERE e.club_id = $1 
              AND (e.maintenance_enabled IS NULL OR e.maintenance_enabled = TRUE)
        `;
        const queryParams: any[] = [clubId];
        let paramIndex = 2;

        if (myTasks) {
            sql += ` AND mt.assigned_user_id = $${paramIndex}`;
            queryParams.push(userId);
            paramIndex++;
        } else if (assignedTo) {
            if (assignedTo === 'unassigned') {
                sql += ` AND mt.assigned_user_id IS NULL`;
            } else {
                sql += ` AND mt.assigned_user_id = $${paramIndex}`;
                queryParams.push(assignedTo);
                paramIndex++;
            }
        }

        if (status) {
            const statusList = status.split(',');
            if (statusList.length > 1) {
                sql += ` AND mt.status = ANY($${paramIndex})`;
                queryParams.push(statusList);
            } else {
                sql += ` AND mt.status = $${paramIndex}`;
                queryParams.push(status);
            }
            paramIndex++;
        }

        if (equipmentId) {
            sql += ` AND mt.equipment_id = $${paramIndex}`;
            queryParams.push(equipmentId);
            paramIndex++;
        }

        if (dateFrom) {
            if (includeOverdue) {
                sql += ` AND (mt.due_date >= $${paramIndex} OR (mt.status = 'PENDING' AND mt.due_date < $${paramIndex}))`;
                queryParams.push(dateFrom);
                paramIndex++;
            } else {
                sql += ` AND mt.due_date >= $${paramIndex}`;
                queryParams.push(dateFrom);
                paramIndex++;
            }
        }

        if (dateTo) {
            sql += ` AND mt.due_date <= $${paramIndex}`;
            queryParams.push(dateTo);
            paramIndex++;
        }

        if (sortBy === 'completed_at') {
            sql += ` ORDER BY mt.completed_at ${order === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`;
        } else {
            sql += ` ORDER BY 
                CASE mt.status WHEN 'PENDING' THEN 1 WHEN 'IN_PROGRESS' THEN 2 ELSE 3 END,
                mt.due_date ASC`;
        }

        const result = await query(sql, queryParams);

        // Get stats
        const today = new Date().toISOString().split('T')[0];
        const statsResult = await query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'PENDING' AND due_date <= $2) as overdue_count,
                COUNT(*) FILTER (WHERE status = 'PENDING' AND due_date = $2) as due_today_count,
                COUNT(*) FILTER (WHERE status = 'PENDING' AND due_date > $2) as upcoming_count,
                COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_count
            FROM equipment_maintenance_tasks mt
            JOIN equipment e ON mt.equipment_id = e.id
            WHERE e.club_id = $1`,
            [clubId, today]
        );

        return NextResponse.json({
            tasks: result.rows,
            stats: statsResult.rows[0],
            total: result.rowCount
        });
    } catch (error) {
        console.error('Get Maintenance Tasks Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Generate maintenance tasks based on equipment schedules
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

        // Verify access (Owner or Employee)
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { date_from, date_to, equipment_ids, task_type = 'CLEANING' } = body;

        if (!date_from || !date_to) {
            return NextResponse.json({ error: 'date_from and date_to are required' }, { status: 400 });
        }

        let scheduleMap: Record<string, string[]> | null = null;
        try {
            const scheduleRes = await query(
                `SELECT user_id, date FROM work_schedules WHERE club_id = $1 AND date >= $2 AND date <= $3`,
                [clubId, date_from, date_to]
            );
            const map: Record<string, string[]> = {};
            scheduleRes.rows.forEach((row: any) => {
                if (!map[row.user_id]) map[row.user_id] = [];
                map[row.user_id].push(row.date);
            });
            Object.keys(map).forEach(key => map[key].sort());
            scheduleMap = map;
        } catch (error) {
            scheduleMap = null;
        }

        const findNextShiftDate = (userId: string, fromDate: string) => {
            if (!scheduleMap) return null;
            const dates = scheduleMap[userId];
            if (!dates || dates.length === 0) return null;
            for (const d of dates) {
                if (d >= fromDate) return d;
            }
            return null;
        };

        let equipmentSql = `
            SELECT 
                e.id, 
                e.name, 
                e.cleaning_interval_days, 
                e.last_cleaned_at, 
                e.workstation_id, 
                e.assigned_user_id,
                (
                    SELECT MAX(due_date) 
                    FROM equipment_maintenance_tasks 
                    WHERE equipment_id = e.id 
                      AND task_type = $3
                ) as last_task_due_date
            FROM equipment e
            WHERE e.club_id = $1
              AND e.is_active = TRUE
              AND (e.maintenance_enabled IS NULL OR e.maintenance_enabled = TRUE)
        `;
        const eqParams: any[] = [clubId, equipment_ids, task_type];

        if (equipment_ids && equipment_ids.length > 0) {
            // Adjust parameter index for equipment_ids since we added task_type at $3
            // Actually, we need to be careful with parameter indices.
            // Let's rewrite the query construction slightly to be safer.
            equipmentSql = `
                SELECT 
                    e.id, 
                    e.name, 
                    e.cleaning_interval_days, 
                    e.last_cleaned_at, 
                    e.workstation_id, 
                    e.assigned_user_id,
                    (
                        SELECT MAX(due_date) 
                        FROM equipment_maintenance_tasks 
                        WHERE equipment_id = e.id 
                          AND task_type = $2
                    ) as last_task_due_date
                FROM equipment e
                WHERE e.club_id = $1
                  AND e.is_active = TRUE
                  AND (e.maintenance_enabled IS NULL OR e.maintenance_enabled = TRUE)
            `;
            // Reset params to match the new base query
        }
        
        // Re-construct params correctly
        const baseParams = [clubId, task_type];
        let queryStr = `
            SELECT 
                e.id, 
                e.name, 
                e.cleaning_interval_days, 
                e.last_cleaned_at, 
                e.workstation_id, 
                e.assigned_user_id,
                (
                    SELECT MAX(due_date) 
                    FROM equipment_maintenance_tasks 
                    WHERE equipment_id = e.id 
                      AND task_type = $2
                ) as last_task_due_date
            FROM equipment e
            WHERE e.club_id = $1
              AND e.is_active = TRUE
              AND (e.maintenance_enabled IS NULL OR e.maintenance_enabled = TRUE)
        `;
        
        if (equipment_ids && equipment_ids.length > 0) {
            queryStr += ` AND e.id = ANY($3)`;
            baseParams.push(equipment_ids);
        }

        const equipmentResult = await query(queryStr, baseParams);

        let createdCount = 0;

        for (const eq of equipmentResult.rows) {
            const intervalDays = eq.cleaning_interval_days || 30;
            const startDate = new Date(date_from);
            const endDate = new Date(date_to);
            
            // Determine the anchor date to start calculating intervals from
            let anchorDate: Date;
            
            const lastCleaned = eq.last_cleaned_at ? new Date(eq.last_cleaned_at) : null;
            const lastDue = eq.last_task_due_date ? new Date(eq.last_task_due_date) : null;

            if (lastDue && lastCleaned) {
                // Use the later of the two to handle late cleanings shifting the schedule
                // OR sticking to schedule if cleaned early/on-time
                anchorDate = lastDue > lastCleaned ? lastDue : lastCleaned;
            } else if (lastDue) {
                anchorDate = lastDue;
            } else if (lastCleaned) {
                anchorDate = lastCleaned;
            } else {
                // If never cleaned and no tasks, start from today (or start of period if it's in future)
                // But to ensure we fill the requested period, let's treat "Start Date" as the anchor base
                // effectively scheduling the first task at startDate
                anchorDate = new Date(startDate);
                anchorDate.setDate(anchorDate.getDate() - intervalDays); // Subtract so first loop adds it back
            }

            let cursor = new Date(anchorDate);
            
            // Safety break to prevent infinite loops
            let iterations = 0;
            const MAX_ITERATIONS = 365; 

            while (iterations < MAX_ITERATIONS) {
                iterations++;
                
                // Advance cursor by interval
                cursor.setDate(cursor.getDate() + intervalDays);
                
                // If we went past the end of the requested period, stop
                if (cursor > endDate) break;
                
                // If cursor is before the start of the requested period, keep skipping
                if (cursor < startDate) continue;
                
                // Now cursor is within [startDate, endDate]
                const dueStr = cursor.toISOString().split('T')[0];
                let finalDueDateStr = dueStr;
                
                // Shift logic
                const assignedUserId = eq.assigned_user_id || null;
                if (assignedUserId) {
                    const shiftDate = findNextShiftDate(assignedUserId, dueStr);
                    if (shiftDate) {
                        finalDueDateStr = shiftDate;
                    }
                }

                const insertResult = await query(
                    `INSERT INTO equipment_maintenance_tasks (equipment_id, task_type, due_date, assigned_user_id)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (equipment_id, due_date, task_type) DO NOTHING
                     RETURNING id`,
                    [eq.id, task_type, finalDueDateStr, assignedUserId]
                );

                if (insertResult.rowCount && insertResult.rowCount > 0) {
                    createdCount++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            created_tasks: createdCount,
            equipment_processed: equipmentResult.rowCount
        });
    } catch (error) {
        console.error('Generate Maintenance Tasks Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
