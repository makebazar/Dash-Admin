import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; zoneId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, zoneId } = await params;
        const body = await request.json();
        const { name, assigned_user_id } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify access (owner)
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get current zone state
        const currentZone = await query(
            `SELECT name, assigned_user_id FROM club_zones WHERE id = $1 AND club_id = $2`,
            [zoneId, clubId]
        );

        if ((currentZone.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
        }

        const oldName = currentZone.rows[0].name;
        const oldAssignedUserId = currentZone.rows[0].assigned_user_id;

        // Update club_zones
        await query(
            `UPDATE club_zones 
             SET name = COALESCE($1, name), 
                 assigned_user_id = $2
             WHERE id = $3`,
            [name, assigned_user_id, zoneId]
        );

        // If name changed, update workstations
        if (name && name !== oldName) {
            await query(
                `UPDATE club_workstations 
                 SET zone = $1 
                 WHERE club_id = $2 AND zone = $3`,
                [name, clubId, oldName]
            );
        }

        // If assigned user changed, propagate to workstations and equipment
        if ((assigned_user_id !== undefined && assigned_user_id !== oldAssignedUserId) || body.free_pool !== undefined) {
            const freePool = !!body.free_pool;
            // Update workstations assigned user
            await query(
                `UPDATE club_workstations 
                 SET assigned_user_id = $1 
                 WHERE club_id = $2 AND zone = $3`,
                [assigned_user_id ?? null, clubId, name || oldName]
            );

            // Update equipment assigned user
            // Get all workstation IDs in this zone
            const workstations = await query(
                `SELECT id FROM club_workstations WHERE club_id = $1 AND zone = $2`,
                [clubId, name || oldName]
            );

            if (workstations.rowCount && workstations.rowCount > 0) {
                const wsIds = workstations.rows.map(w => w.id);
                await query(
                    `UPDATE equipment 
                     SET assigned_user_id = $1::uuid,
                         maintenance_enabled = CASE WHEN $2::boolean THEN TRUE ELSE (CASE WHEN $1::uuid IS NULL THEN FALSE ELSE TRUE END) END
                     WHERE workstation_id = ANY($3)`,
                    [assigned_user_id ?? null, freePool, wsIds]
                );

                // Propagate to PENDING maintenance tasks
                await query(
                    `UPDATE equipment_maintenance_tasks 
                     SET assigned_user_id = $1::uuid
                     WHERE equipment_id IN (
                        SELECT id FROM equipment WHERE workstation_id = ANY($2)
                     ) AND status = 'PENDING'`,
                    [assigned_user_id ?? null, wsIds]
                );

                // If a new user is assigned, move their PENDING tasks to their next shift
                if (assigned_user_id) {
                    const today = new Date().toISOString().split('T')[0];
                    const nextShift = await query(
                        `SELECT date FROM work_schedules 
                         WHERE club_id = $1 AND user_id = $2 AND date >= $3
                         ORDER BY date ASC LIMIT 1`,
                        [clubId, assigned_user_id, today]
                    );

                    if (nextShift.rowCount && nextShift.rowCount > 0) {
                        const shiftDate = nextShift.rows[0].date;
                        const shiftDateStr = shiftDate instanceof Date ? shiftDate.toISOString().split('T')[0] : shiftDate;
                        
                        await query(
                            `UPDATE equipment_maintenance_tasks 
                             SET due_date = $1
                             WHERE equipment_id IN (
                                SELECT id FROM equipment WHERE workstation_id = ANY($2)
                             ) AND status = 'PENDING' AND assigned_user_id = $3`,
                            [shiftDateStr, wsIds, assigned_user_id]
                        );
                    }
                }
            }
        }

        return NextResponse.json({ message: 'Zone updated successfully' });
    } catch (error) {
        console.error('Update Zone Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string; zoneId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, zoneId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify access (owner)
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Check if zone has workstations
        const zone = await query(
            `SELECT name FROM club_zones WHERE id = $1 AND club_id = $2`,
            [zoneId, clubId]
        );

        if ((zone.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
        }

        const zoneName = zone.rows[0].name;

        const workstations = await query(
            `SELECT 1 FROM club_workstations WHERE club_id = $1 AND zone = $2 LIMIT 1`,
            [clubId, zoneName]
        );

        if ((workstations.rowCount || 0) > 0) {
            return NextResponse.json({ 
                error: 'Cannot delete zone with workstations. Please move or delete workstations first.' 
            }, { status: 400 });
        }

        // Delete zone
        await query(
            `DELETE FROM club_zones WHERE id = $1`,
            [zoneId]
        );

        return NextResponse.json({ message: 'Zone deleted successfully' });
    } catch (error) {
        console.error('Delete Zone Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
