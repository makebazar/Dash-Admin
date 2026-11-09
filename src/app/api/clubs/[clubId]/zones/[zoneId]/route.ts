import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { requireClubFullAccess } from '@/lib/club-api-access';
import { propagateWorkstationAssigneeToEquipment } from '@/lib/maintenance-task-logic';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; zoneId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, zoneId } = await params;
        const body = await request.json();
        const { name, assigned_user_id, move } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await requireClubFullAccess(clubId)

        if (move === 'UP' || move === 'DOWN') {
            const dir = move === 'UP' ? 'UP' : 'DOWN'
            const row = await query(
                `SELECT id, display_order FROM club_zones WHERE id = $1 AND club_id = $2 LIMIT 1`,
                [zoneId, clubId]
            )
            if ((row.rowCount || 0) === 0) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })

            const curOrder = Number(row.rows[0].display_order || 0)

            const neighbor = await query(
                dir === 'UP'
                    ? `SELECT id, display_order FROM club_zones WHERE club_id = $1 AND display_order < $2 ORDER BY display_order DESC, name DESC LIMIT 1`
                    : `SELECT id, display_order FROM club_zones WHERE club_id = $1 AND display_order > $2 ORDER BY display_order ASC, name ASC LIMIT 1`,
                [clubId, curOrder]
            )
            if ((neighbor.rowCount || 0) === 0) return NextResponse.json({ ok: true, moved: false })

            const neighborId = String(neighbor.rows[0].id)
            const neighborOrder = Number(neighbor.rows[0].display_order || 0)

            await query(
                `
                UPDATE club_zones
                SET display_order = CASE
                    WHEN id = $1 THEN $2
                    WHEN id = $3 THEN $4
                    ELSE display_order
                END
                WHERE club_id = $5 AND id IN ($1, $3)
                `,
                [zoneId, neighborOrder, neighborId, curOrder, clubId]
            )

            return NextResponse.json({ ok: true, moved: true })
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
             WHERE id = $3 AND club_id = $4`,
            [name, assigned_user_id, zoneId, clubId]
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
            await query(
                `UPDATE club_workstations 
                 SET assigned_user_id = $1 
                 WHERE club_id = $2 AND zone = $3`,
                [assigned_user_id ?? null, clubId, name || oldName]
            );

            const workstations = await query(
                `SELECT id FROM club_workstations WHERE club_id = $1 AND zone = $2`,
                [clubId, name || oldName]
            );

            if (workstations.rowCount && workstations.rowCount > 0) {
                const wsIds = workstations.rows.map(w => String(w.id));
                await propagateWorkstationAssigneeToEquipment({
                    clubId,
                    workstationIds: wsIds,
                    assignedUserId: assigned_user_id ?? null,
                    forceMaintenanceEnabled: freePool,
                });
            }
        }

        return NextResponse.json({ message: 'Zone updated successfully' });
    } catch (error) {
        const status = (error as any)?.status
        if (status === 401 || status === 403) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
        }
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

        await requireClubFullAccess(clubId)

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
        const status = (error as any)?.status
        if (status === 401 || status === 403) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
        }
        console.error('Delete Zone Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
