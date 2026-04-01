import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateMaintenanceQualityMetrics } from '@/lib/maintenance-kpi-quality';

const formatLocalDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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
        const verificationStatus = searchParams.get('verification_status');
        const assignedTo = searchParams.get('assigned_to') || searchParams.get('assigned');
        const equipmentId = searchParams.get('equipment_id');
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');
        const includeOverdue = searchParams.get('include_overdue') === 'true';
        const myTasks = searchParams.get('my_tasks') === 'true' || assignedTo === 'me';
        const sortBy = searchParams.get('sort_by');
        const order = (searchParams.get('order') || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
        const hasDateRange = Boolean(dateFrom || dateTo);

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

        // Determine if we should use DISTINCT ON
        // We usually use it for the "Smart Horizon" view to show one task per equipment
        // But if we're filtering for REJECTED tasks specifically, we want all of them
        const useDistinct = !verificationStatus && !status && !hasDateRange && !sortBy;

        const effectiveEquipmentAssigneeSql = `
            CASE
                WHEN e.assignment_mode = 'DIRECT' THEN e.assigned_user_id
                WHEN e.assignment_mode = 'FREE_POOL' THEN NULL
                ELSE COALESCE(w.assigned_user_id, z.assigned_user_id)
            END
        `;

        const effectiveTaskAssigneeSql = `
            COALESCE(
                mt.assigned_user_id,
                ${effectiveEquipmentAssigneeSql}
            )
        `;

        let sql = `
            SELECT ${useDistinct ? 'DISTINCT ON (mt.equipment_id)' : ''}
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
                GREATEST((CURRENT_DATE - mt.due_date), 0) as overdue_days,
                CASE
                    WHEN mt.verification_status = 'REJECTED'
                    THEN GREATEST((CURRENT_DATE - COALESCE(mt.verified_at::date, mt.updated_at::date)), 0)
                    ELSE 0
                END as rework_days,
                e.assignment_mode as equipment_assignment_mode,
                e.assigned_user_id as equipment_assigned_user_id,
                w.assigned_user_id as workstation_assigned_user_id,
                wu.full_name as workstation_assigned_to_name,
                ${effectiveTaskAssigneeSql} as assigned_user_id,
                e.name as equipment_name,
                e.type as equipment_type,
                e.last_cleaned_at as last_cleaned_at,
                et.name_ru as equipment_type_name,
                et.icon as equipment_icon,
                w.id as workstation_id,
                w.name as workstation_name,
                w.zone as workstation_zone,
                COALESCE(u.full_name, eu.full_name, wu.full_name, zu.full_name) as assigned_to_name,
                cu.full_name as completed_by_name,
                cu_v.full_name as verified_by_name
            FROM equipment_maintenance_tasks mt
            JOIN equipment e ON mt.equipment_id = e.id
            LEFT JOIN equipment_types et ON e.type = et.code
            LEFT JOIN club_workstations w ON e.workstation_id = w.id
            LEFT JOIN club_zones z ON z.club_id = e.club_id AND z.name = w.zone
            LEFT JOIN users u ON mt.assigned_user_id = u.id
            LEFT JOIN users eu ON e.assigned_user_id = eu.id
            LEFT JOIN users wu ON w.assigned_user_id = wu.id
            LEFT JOIN users zu ON z.assigned_user_id = zu.id
            LEFT JOIN users cu ON mt.completed_by = cu.id
            LEFT JOIN users cu_v ON mt.verified_by = cu_v.id
            WHERE e.club_id = $1 
              AND (e.maintenance_enabled IS NULL OR e.maintenance_enabled = TRUE)
        `;
        const queryParams: any[] = [clubId];
        let paramIndex = 2;

        if (myTasks) {
            // Filter by assigned_user_id (explicitly assigned OR fallback to equipment assignee)
            sql += ` AND ${effectiveTaskAssigneeSql} = $${paramIndex}`;
            queryParams.push(userId);
            paramIndex++;
        } else if (assignedTo) {
            if (assignedTo === 'unassigned') {
                sql += ` AND ${effectiveTaskAssigneeSql} IS NULL`;
            } else {
                sql += ` AND ${effectiveTaskAssigneeSql} = $${paramIndex}`;
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

        if (verificationStatus) {
            sql += ` AND mt.verification_status = $${paramIndex}`;
            queryParams.push(verificationStatus);
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

        let finalOrderBy = `
            CASE status WHEN 'IN_PROGRESS' THEN 1 WHEN 'PENDING' THEN 2 ELSE 3 END,
            due_date ${order}
        `;

        if (sortBy === 'completed_at') {
            finalOrderBy = `completed_at ${order} NULLS LAST, due_date ASC`;
        } else if (sortBy === 'created_at') {
            finalOrderBy = `created_at ${order} NULLS LAST, due_date ASC`;
        } else if (sortBy === 'verified_at') {
            finalOrderBy = `verified_at ${order} NULLS LAST, due_date ASC`;
        }

        // Wrap in subquery to apply final sort
        const finalSql = `
            SELECT * FROM (${sql}) as distinct_tasks
            ORDER BY ${finalOrderBy}
        `;

        const result = await query(finalSql, queryParams);

        // Get stats
        const todayStr = formatLocalDate(new Date());
        const statsConditions = [`e.club_id = $1`];
        const statsParams: any[] = [clubId, todayStr, dateFrom || null, dateTo || null];
        let statsParamIndex = 5;

        const statsAssignee = myTasks ? userId : (assignedTo && assignedTo !== 'unassigned' ? assignedTo : null);

        if (assignedTo === 'unassigned') {
            statsConditions.push(`${effectiveTaskAssigneeSql} IS NULL`);
        } else if (statsAssignee) {
            statsConditions.push(`${effectiveTaskAssigneeSql} = $${statsParamIndex}`);
            statsParams.push(statsAssignee);
            statsParamIndex++;
        }

        if (dateFrom) {
            if (includeOverdue) {
                statsConditions.push(`(
                    mt.due_date >= $${statsParamIndex}
                    OR (mt.status IN ('PENDING', 'IN_PROGRESS') AND mt.due_date < $${statsParamIndex})
                    OR (
                        mt.status = 'COMPLETED'
                        AND mt.completed_at >= $${statsParamIndex}::date
                        AND mt.due_date < $${statsParamIndex}::date
                    )
                )`);
            } else {
                statsConditions.push(`mt.due_date >= $${statsParamIndex}`);
            }
            statsParams.push(dateFrom);
            statsParamIndex++;
        }

        if (dateTo) {
            statsConditions.push(`mt.due_date <= $${statsParamIndex}`);
            statsParams.push(dateTo);
            statsParamIndex++;
        }

        const statsResult = await query(
            `SELECT 
                COUNT(*) FILTER (WHERE mt.status IN ('PENDING', 'IN_PROGRESS') AND mt.due_date < $2) as overdue_count,
                COUNT(*) FILTER (WHERE mt.status IN ('PENDING', 'IN_PROGRESS') AND mt.due_date = $2) as due_today_count,
                COUNT(*) FILTER (WHERE mt.status IN ('PENDING', 'IN_PROGRESS') AND mt.due_date > $2) as upcoming_count,
                COUNT(*) FILTER (WHERE mt.status = 'IN_PROGRESS') as in_progress_count,
                COUNT(*) FILTER (WHERE mt.status = 'IN_PROGRESS' AND mt.verification_status = 'REJECTED') as rework_count,
                COUNT(*) FILTER (
                    WHERE mt.status = 'IN_PROGRESS'
                      AND mt.verification_status = 'REJECTED'
                      AND COALESCE(mt.verified_at::date, CURRENT_DATE) <= CURRENT_DATE - 3
                ) as stale_rework_count,
                COUNT(*) FILTER (
                    WHERE mt.status != 'CANCELLED'
                      AND ($3::date IS NOT NULL AND $4::date IS NOT NULL)
                      AND mt.due_date >= $3::date
                      AND mt.due_date <= $4::date
                ) as month_plan_count,
                COUNT(*) FILTER (
                    WHERE mt.status = 'COMPLETED'
                      AND ($3::date IS NOT NULL AND $4::date IS NOT NULL)
                      AND mt.due_date >= $3::date
                      AND mt.due_date <= $4::date
                      AND mt.completed_at >= $3::date
                      AND mt.completed_at < ($4::date + INTERVAL '1 day')
                ) as month_completed_count,
                COUNT(*) FILTER (
                    WHERE mt.status = 'COMPLETED'
                      AND ($3::date IS NOT NULL AND $4::date IS NOT NULL)
                      AND mt.completed_at >= $3::date
                      AND mt.completed_at < ($4::date + INTERVAL '1 day')
                      AND mt.due_date < $3::date
                ) as old_debt_closed_count,
                COUNT(*) FILTER (WHERE mt.status = 'COMPLETED') as completed_count
            FROM equipment_maintenance_tasks mt
            JOIN equipment e ON mt.equipment_id = e.id
            LEFT JOIN club_workstations w ON e.workstation_id = w.id
            LEFT JOIN club_zones z ON z.club_id = e.club_id AND z.name = w.zone
            WHERE ${statsConditions.join(' AND ')}`,
            statsParams
        );

        const statsRow = statsResult.rows[0] || {};
        const monthPlanCount = Number(statsRow.month_plan_count || 0);
        const monthCompletedCount = Number(statsRow.month_completed_count || 0);
        const overdueCount = Number(statsRow.overdue_count || 0);
        const reworkCount = Number(statsRow.rework_count || 0);
        const staleReworkCount = Number(statsRow.stale_rework_count || 0);
        const qualityMetrics = calculateMaintenanceQualityMetrics({
            assigned: monthPlanCount,
            completed: monthCompletedCount,
            dueByNow: monthPlanCount,
            completedDueByNow: monthCompletedCount,
            overdueOpenTasks: overdueCount,
            reworkOpenTasks: reworkCount,
            staleReworkTasks: staleReworkCount
        });

        return NextResponse.json({
            tasks: result.rows,
            stats: {
                ...statsRow,
                quality_penalty_units: qualityMetrics.penalty_units,
                adjusted_month_completed_count: qualityMetrics.adjusted_completed,
                raw_efficiency: monthPlanCount > 0 ? (monthCompletedCount / monthPlanCount) * 100 : 0,
                adjusted_efficiency: qualityMetrics.efficiency
            },
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

        const { date_from, date_to, equipment_ids, workstation_ids, task_type = 'CLEANING' } = body;

        if (!date_from || !date_to) {
            return NextResponse.json({ error: 'date_from and date_to are required' }, { status: 400 });
        }

        const parseDate = (value: string) => new Date(`${value}T00:00:00`);

        let scheduleMap: Record<string, string[]> | null = null;
        try {
            const scheduleRes = await query(
                `SELECT user_id, date FROM work_schedules WHERE club_id = $1 AND date >= $2 AND date <= $3`,
                [clubId, date_from, date_to]
            );
            const map: Record<string, string[]> = {};
            scheduleRes.rows.forEach((row: any) => {
                if (!map[row.user_id]) map[row.user_id] = [];
                // Date handling
                const d = row.date;
                const dStr = d instanceof Date ? formatLocalDate(d) : String(d);
                map[row.user_id].push(dStr);
            });
            Object.keys(map).forEach(key => map[key].sort());
            scheduleMap = map;
        } catch (error) {
            scheduleMap = null;
        }

        const findNextShiftDate = (userId: string, fromDate: string, excludedDates: Set<string>) => {
            if (!scheduleMap) return null;
            const dates = scheduleMap[userId];
            if (!dates || dates.length === 0) return null;
            for (const dStr of dates) {
                if (dStr >= fromDate && !excludedDates.has(dStr)) return dStr;
            }
            return null;
        };

        const baseParams = [clubId, task_type];
        let queryStr = `
            SELECT 
                e.id, 
                e.name, 
                e.cleaning_interval_days, 
                e.last_cleaned_at, 
                e.workstation_id, 
                CASE
                    WHEN e.assignment_mode = 'DIRECT' THEN e.assigned_user_id
                    WHEN e.assignment_mode = 'FREE_POOL' THEN NULL
                    ELSE COALESCE(w.assigned_user_id, z.assigned_user_id)
                END as assigned_user_id,
                (
                    SELECT MAX(due_date) 
                    FROM equipment_maintenance_tasks 
                    WHERE equipment_id = e.id 
                      AND task_type = $2
                ) as last_task_due_date
            FROM equipment e
            LEFT JOIN club_workstations w ON w.id = e.workstation_id
            LEFT JOIN club_zones z ON z.club_id = e.club_id AND z.name = w.zone
            WHERE e.club_id = $1
              AND e.is_active = TRUE
              AND (e.maintenance_enabled IS NULL OR e.maintenance_enabled = TRUE)
        `;
        
        if (equipment_ids && equipment_ids.length > 0) {
            queryStr += ` AND e.id = ANY($3)`;
            baseParams.push(equipment_ids);
        } else if (workstation_ids && workstation_ids.length > 0) {
            queryStr += ` AND e.workstation_id = ANY($3)`;
            baseParams.push(workstation_ids);
        }

        const equipmentResult = await query(queryStr, baseParams);
        const equipmentRows = equipmentResult.rows;
        const equipmentIds = equipmentRows.map((row: any) => row.id);

        if (equipmentIds.length === 0) {
            return NextResponse.json({
                success: true,
                created_tasks: 0,
                equipment_processed: 0
            });
        }

        const [activeEmployeesResult, existingActiveTasksResult] = await Promise.all([
            query(
                `SELECT user_id
                 FROM club_employees
                 WHERE club_id = $1 AND is_active = TRUE`,
                [clubId]
            ),
            query(
                `SELECT id, equipment_id, due_date, assigned_user_id, status
                 FROM equipment_maintenance_tasks
                 WHERE equipment_id = ANY($1)
                   AND task_type = $2
                   AND status IN ('PENDING', 'IN_PROGRESS')
                 ORDER BY
                    equipment_id,
                    CASE status WHEN 'IN_PROGRESS' THEN 0 ELSE 1 END,
                    due_date ASC,
                    created_at ASC`,
                [equipmentIds, task_type]
            )
        ]);

        const activeEmployeeIds = new Set(activeEmployeesResult.rows.map((row: any) => row.user_id));
        const activeTaskByEquipment = new Map<string, any>();
        const duplicateActiveTaskIds: string[] = [];

        existingActiveTasksResult.rows.forEach((row: any) => {
            if (!activeTaskByEquipment.has(row.equipment_id)) {
                activeTaskByEquipment.set(row.equipment_id, row);
            } else {
                duplicateActiveTaskIds.push(row.id);
            }
        });

        if (duplicateActiveTaskIds.length > 0) {
            await query(
                `DELETE FROM equipment_maintenance_tasks
                 WHERE id = ANY($1)`,
                [duplicateActiveTaskIds]
            );
        }

        let createdCount = 0;

        const windowStart = parseDate(date_from);

        for (const eq of equipmentRows) {
            const intervalDays = Math.max(1, Number(eq.cleaning_interval_days) || 30);
            const activeTask = activeTaskByEquipment.get(eq.id);

            let nextDue = eq.last_cleaned_at
                ? new Date(eq.last_cleaned_at)
                : new Date(windowStart);

            if (eq.last_cleaned_at) {
                nextDue.setHours(0, 0, 0, 0);
                nextDue.setDate(nextDue.getDate() + intervalDays);
            } else {
                nextDue = new Date(windowStart);
            }

            const nominalDueDate = formatLocalDate(nextDue);
            let finalDueDate = nominalDueDate;
            let finalAssignedUserId = eq.assigned_user_id ?? null;

            if (finalAssignedUserId && !activeEmployeeIds.has(finalAssignedUserId)) {
                finalAssignedUserId = null;
            }

            if (finalAssignedUserId) {
                const shiftDate = findNextShiftDate(finalAssignedUserId, nominalDueDate, new Set<string>());
                if (shiftDate) {
                    finalDueDate = shiftDate;
                } else {
                    finalAssignedUserId = null;
                }
            }

            const shouldExistInWindow = finalDueDate <= date_to;

            if (activeTask) {
                if (activeTask.status === 'PENDING') {
                    await query(
                        `UPDATE equipment_maintenance_tasks
                         SET due_date = $2,
                             assigned_user_id = $3
                         WHERE id = $1`,
                        [activeTask.id, finalDueDate, finalAssignedUserId]
                    );
                }
                continue;
            }

            if (!shouldExistInWindow) {
                continue;
            }

            const insertResult = await query(
                `INSERT INTO equipment_maintenance_tasks (equipment_id, task_type, due_date, assigned_user_id)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT DO NOTHING
                 RETURNING id`,
                [eq.id, task_type, finalDueDate, finalAssignedUserId]
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
