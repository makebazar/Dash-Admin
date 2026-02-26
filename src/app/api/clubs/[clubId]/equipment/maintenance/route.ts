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
            SELECT DISTINCT ON (mt.equipment_id)
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
                mt.verification_status,
                mt.verified_at,
                mt.rejection_reason,
                COALESCE(mt.assigned_user_id, e.assigned_user_id) as assigned_user_id,
                e.name as equipment_name,
                e.type as equipment_type,
                e.last_cleaned_at as last_cleaned_at,
                et.name_ru as equipment_type_name,
                et.icon as equipment_icon,
                w.name as workstation_name,
                w.zone as workstation_zone,
                COALESCE(u.full_name, eu.full_name) as assigned_to_name,
                cu.full_name as completed_by_name,
                cu_v.full_name as verified_by_name
            FROM equipment_maintenance_tasks mt
            JOIN equipment e ON mt.equipment_id = e.id
            LEFT JOIN equipment_types et ON e.type = et.code
            LEFT JOIN club_workstations w ON e.workstation_id = w.id
            LEFT JOIN users u ON mt.assigned_user_id = u.id
            LEFT JOIN users eu ON e.assigned_user_id = eu.id
            LEFT JOIN users cu ON mt.completed_by = cu.id
            LEFT JOIN users cu_v ON mt.verified_by = cu_v.id
            WHERE e.club_id = $1 
              AND (e.maintenance_enabled IS NULL OR e.maintenance_enabled = TRUE)
        `;
        const queryParams: any[] = [clubId];
        let paramIndex = 2;

        if (myTasks) {
            // Filter by assigned_user_id (explicitly assigned OR fallback to equipment assignee)
            sql += ` AND COALESCE(mt.assigned_user_id, e.assigned_user_id) = $${paramIndex}`;
            queryParams.push(userId);
            paramIndex++;
        } else if (assignedTo) {
            if (assignedTo === 'unassigned') {
                // Task is unassigned ONLY if neither task nor equipment has an assignee
                sql += ` AND mt.assigned_user_id IS NULL AND e.assigned_user_id IS NULL`;
            } else {
                sql += ` AND COALESCE(mt.assigned_user_id, e.assigned_user_id) = $${paramIndex}`;
                queryParams.push(assignedTo);
                paramIndex++;
            }
        }

        // Removed explicit status filter to allow "Smart Horizon" view (Active OR Latest Completed)
        // If specific status is requested, we can still filter, but for the main view we want the mix
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

        // Date filters apply primarily to DUE DATE for pending tasks
        // For completed tasks in the "Smart Horizon", we might want to ignore date filters or be careful
        // But if user filters by date, they probably expect tasks in that range.
        
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

        // IMPORTANT: Order by equipment_id to make DISTINCT ON work, 
        // then by status priority (PENDING/IN_PROGRESS first) to ensure we pick the active task if exists
        sql += ` ORDER BY mt.equipment_id, 
                 CASE mt.status WHEN 'IN_PROGRESS' THEN 1 WHEN 'PENDING' THEN 2 ELSE 3 END,
                 mt.due_date ASC`;

        // Wrap in subquery to apply final sort
        const finalSql = `
            SELECT * FROM (${sql}) as distinct_tasks
            ORDER BY 
                CASE status WHEN 'IN_PROGRESS' THEN 1 WHEN 'PENDING' THEN 2 ELSE 3 END,
                due_date ASC
        `;

        const result = await query(finalSql, queryParams);

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
                // Ensure date string comparison works correctly by handling Date objects
                const dStr = d instanceof Date ? (d as Date).toISOString().split('T')[0] : d;
                if (dStr >= fromDate) return dStr;
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
            // Check if ANY active task (PENDING or IN_PROGRESS) exists for this equipment
            const pendingRes = await query(
                `SELECT 1 FROM equipment_maintenance_tasks 
                 WHERE equipment_id = $1 AND status IN ('PENDING', 'IN_PROGRESS')
                 LIMIT 1`,
                [eq.id]
            );

            if ((pendingRes.rowCount || 0) > 0) {
                // Check if the pending task is very old (ghost task) - older than 60 days
                // If so, delete it and allow creating a new one
                const ghostCheck = await query(
                    `DELETE FROM equipment_maintenance_tasks 
                     WHERE equipment_id = $1 
                       AND status = 'PENDING' 
                       AND due_date < CURRENT_DATE - INTERVAL '60 days'
                     RETURNING id`,
                    [eq.id]
                );
                
                if ((ghostCheck.rowCount || 0) === 0) {
                     // Real active task exists, skip creation
                     continue;
                }
            }

            const intervalDays = eq.cleaning_interval_days || 30;
            const startDate = new Date(date_from);
            
            // Calculate next due date
            let nextDue: Date;
            if (eq.last_cleaned_at) {
                const lastCleaned = new Date(eq.last_cleaned_at);
                nextDue = new Date(lastCleaned);
                nextDue.setDate(nextDue.getDate() + intervalDays);
            } else {
                // If never cleaned, due date defaults to the start of the requested period (usually today)
                nextDue = new Date(startDate);
            }

            const originalDue = nextDue.toISOString().split('T')[0];
            let dueDateStr = originalDue;
            
            // Shift logic
            // Use assigned_user_id from equipment for the shift calculation, but ensure we use it for the task too
            let taskAssignedUserId = eq.assigned_user_id || null;
            
            if (taskAssignedUserId) {
                // Check if user is active first to avoid assigning to fired employees
                const userActiveRes = await query(
                    `SELECT is_active FROM club_employees WHERE club_id = $1 AND user_id = $2`,
                    [clubId, taskAssignedUserId]
                );
                
                const isActive = userActiveRes.rows[0]?.is_active !== false;
                
                if (isActive) {
                    const shiftDate = findNextShiftDate(taskAssignedUserId, originalDue);
                    if (shiftDate) {
                        dueDateStr = shiftDate;
                    }
                } else {
                    // User is inactive, do not assign task to them
                    taskAssignedUserId = null;
                }
            }

            const insertResult = await query(
                `INSERT INTO equipment_maintenance_tasks (equipment_id, task_type, due_date, assigned_user_id)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (equipment_id, due_date, task_type) DO NOTHING
                 RETURNING id`,
                [eq.id, task_type, dueDateStr, taskAssignedUserId]
            );

            if (insertResult.rowCount && insertResult.rowCount > 0) {
                createdCount++;
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
