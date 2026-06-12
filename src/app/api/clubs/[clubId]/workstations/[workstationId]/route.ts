import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { formatDateKeyInTimezone } from '@/lib/utils';
import { requireClubFullAccess } from '@/lib/club-api-access';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string, workstationId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, workstationId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await requireClubFullAccess(String(clubId));

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (body.name !== undefined) {
            updates.push(`name = $${paramIndex}`);
            values.push(body.name);
            paramIndex++;
        }

        if (body.zone !== undefined) {
            updates.push(`zone = $${paramIndex}`);
            values.push(body.zone);
            paramIndex++;
        }

        if (body.assigned_user_id !== undefined) {
            updates.push(`assigned_user_id = $${paramIndex}`);
            values.push(body.assigned_user_id === '' ? null : body.assigned_user_id);
            paramIndex++;
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(workstationId, clubId);

        const result = await query(
            `UPDATE club_workstations 
             SET ${updates.join(', ')}
             WHERE id = $${paramIndex} AND club_id = $${paramIndex + 1}
             RETURNING *`,
            values
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Workstation not found' }, { status: 404 });
        }

        if (body.assigned_user_id !== undefined || body.free_pool !== undefined) {
            const assignedUserId = body.assigned_user_id === '' ? null : (body.assigned_user_id || null);
            
            // Update equipment
            await query(
                `UPDATE equipment
                 SET assigned_user_id = $1::uuid,
                     assignment_mode = CASE
                        WHEN $1::uuid IS NULL THEN 'FREE_POOL'
                        ELSE 'DIRECT'
                     END
                 WHERE workstation_id = $2`,
                [assignedUserId, workstationId]
            );

            // Propagate to PENDING maintenance tasks
            await query(
                `UPDATE equipment_maintenance_tasks 
                 SET assigned_user_id = $1::uuid
                 WHERE equipment_id IN (
                    SELECT id FROM equipment WHERE workstation_id = $2
                 ) AND status = 'PENDING'`,
                [assignedUserId, workstationId]
            );

            // If a new user is assigned, move their PENDING tasks to their next shift
            if (assignedUserId) {
                const clubRes = await query(
                    `SELECT COALESCE(timezone, 'Europe/Moscow') as timezone
                     FROM clubs
                     WHERE id = $1`,
                    [clubId]
                );
                const today = formatDateKeyInTimezone(new Date(), clubRes.rows[0]?.timezone || 'Europe/Moscow');
                const nextShift = await query(
                    `SELECT TO_CHAR(date, 'YYYY-MM-DD') as date
                     FROM work_schedules 
                     WHERE club_id = $1 AND user_id = $2 AND date >= $3
                     ORDER BY date ASC LIMIT 1`,
                    [clubId, assignedUserId, today]
                );

                if (nextShift.rowCount && nextShift.rowCount > 0) {
                    const shiftDateStr = String(nextShift.rows[0].date);
                    
                    await query(
                        `UPDATE equipment_maintenance_tasks 
                         SET due_date = $1
                         WHERE equipment_id IN (
                            SELECT id FROM equipment WHERE workstation_id = $2
                         ) AND status = 'PENDING' AND assigned_user_id = $3`,
                        [shiftDateStr, workstationId, assignedUserId]
                    );
                }
            }
        }

        return NextResponse.json(result.rows[0]);
    } catch (error: any) {
        console.error('Update Workstation Error:', error);
        const status = typeof error?.status === 'number' ? error.status : 500;
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string, workstationId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, workstationId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await requireClubFullAccess(String(clubId));

        // Check if there is equipment attached
        const equipCheck = await query(
            `SELECT 1 FROM equipment WHERE workstation_id = $1 LIMIT 1`,
            [workstationId]
        );

        if ((equipCheck.rowCount || 0) > 0) {
            return NextResponse.json({ error: 'Cannot delete workstation with attached equipment' }, { status: 400 });
        }

        const result = await query(
            `DELETE FROM club_workstations WHERE id = $1 AND club_id = $2`,
            [workstationId, clubId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Workstation not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete Workstation Error:', error);
        const status = typeof error?.status === 'number' ? error.status : 500;
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status });
    }
}
