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
        const myTasks = searchParams.get('my_tasks') === 'true' || assignedTo === 'me';

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
                mt.*,
                e.name as equipment_name,
                e.type as equipment_type,
                et.name_ru as equipment_type_name,
                et.icon as equipment_icon,
                w.name as workstation_name,
                w.zone as workstation_zone,
                u.full_name as assigned_to_name,
                cu.full_name as completed_by_name
            FROM equipment_maintenance_tasks mt
            JOIN equipment e ON mt.equipment_id = e.id
            LEFT JOIN equipment_types et ON e.type = et.code
            LEFT JOIN club_workstations w ON e.workstation_id = w.id
            LEFT JOIN users u ON mt.assigned_user_id = u.id
            LEFT JOIN users cu ON mt.completed_by = cu.id
            WHERE e.club_id = $1
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
            sql += ` AND mt.due_date >= $${paramIndex}`;
            queryParams.push(dateFrom);
            paramIndex++;
        }

        if (dateTo) {
            sql += ` AND mt.due_date <= $${paramIndex}`;
            queryParams.push(dateTo);
            paramIndex++;
        }

        sql += ` ORDER BY 
            CASE mt.status WHEN 'PENDING' THEN 1 WHEN 'IN_PROGRESS' THEN 2 ELSE 3 END,
            mt.due_date ASC`;

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

        // Verify ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { date_from, date_to, equipment_ids, task_type = 'CLEANING' } = body;

        if (!date_from || !date_to) {
            return NextResponse.json({ error: 'date_from and date_to are required' }, { status: 400 });
        }

        // Get equipment that needs tasks in the date range
        let equipmentSql = `
            SELECT id, name, cleaning_interval_days, last_cleaned_at
            FROM equipment
            WHERE club_id = $1 AND is_active = TRUE
        `;
        const eqParams: any[] = [clubId];

        if (equipment_ids && equipment_ids.length > 0) {
            equipmentSql += ` AND id = ANY($2)`;
            eqParams.push(equipment_ids);
        }

        const equipmentResult = await query(equipmentSql, eqParams);

        let createdCount = 0;

        for (const eq of equipmentResult.rows) {
            // Calculate due dates based on interval
            const intervalDays = eq.cleaning_interval_days || 30;
            const lastCleaned = eq.last_cleaned_at ? new Date(eq.last_cleaned_at) : new Date(date_from);

            let nextDue = new Date(lastCleaned);
            nextDue.setDate(nextDue.getDate() + intervalDays);

            const endDate = new Date(date_to);

            while (nextDue <= endDate) {
                if (nextDue >= new Date(date_from)) {
                    const dueDateStr = nextDue.toISOString().split('T')[0];

                    // Insert task if not exists (using ON CONFLICT)
                    const insertResult = await query(
                        `INSERT INTO equipment_maintenance_tasks (equipment_id, task_type, due_date)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (equipment_id, due_date, task_type) DO NOTHING
                         RETURNING id`,
                        [eq.id, task_type, dueDateStr]
                    );

                    if (insertResult.rowCount && insertResult.rowCount > 0) {
                        createdCount++;
                    }
                }

                nextDue.setDate(nextDue.getDate() + intervalDays);
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
