import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// POST - Move equipment or Swap
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

        // Verify access (employee or owner)
        const accessCheck = await query(
            `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
             UNION
             SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { equipment_id, target_workstation_id, action, reason, comment } = body;
        // action: 'MOVE' (replace/empty) or 'SWAP'

        if (!equipment_id || !action) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get current state of the equipment being moved
        const sourceEqRes = await query(
            `SELECT id, workstation_id, type FROM equipment WHERE id = $1 AND club_id = $2`,
            [equipment_id, clubId]
        );

        if ((sourceEqRes.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
        }

        const sourceEq = sourceEqRes.rows[0];
        const sourceWorkstationId = sourceEq.workstation_id; // Can be null (Warehouse)
        const targetWorkstationId = target_workstation_id || null; // Can be null (Warehouse)

        // Prevent moving to same location
        if (sourceWorkstationId === targetWorkstationId) {
            return NextResponse.json({ error: 'Source and target locations are the same' }, { status: 400 });
        }

        await query('BEGIN');

        try {
            // Check if target is occupied by same type
            let targetOccupantId = null;
            if (targetWorkstationId) {
                const targetOccupantRes = await query(
                    `SELECT id FROM equipment 
                     WHERE workstation_id = $1 AND type = $2 AND id != $3
                     LIMIT 1`,
                    [targetWorkstationId, sourceEq.type, equipment_id]
                );
                if ((targetOccupantRes.rowCount || 0) > 0) {
                    targetOccupantId = targetOccupantRes.rows[0].id;
                }
            }

            // ACTION 1: SWAP
            if (action === 'SWAP' && targetOccupantId) {
                // Move Target -> Source
                await query(
                    `UPDATE equipment SET workstation_id = $1 WHERE id = $2`,
                    [sourceWorkstationId, targetOccupantId]
                );
                
                // Log movement for Target device
                await query(
                    `INSERT INTO equipment_moves (equipment_id, from_workstation_id, to_workstation_id, moved_by, reason)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [targetOccupantId, targetWorkstationId, sourceWorkstationId, userId, `SWAP with ${equipment_id}. ${reason || ''} ${comment ? `(${comment})` : ''}`]
                );
            }
            // ACTION 2: REPLACE (Move target to warehouse)
            else if (action === 'REPLACE' && targetOccupantId) {
                // Move Target -> Warehouse (NULL)
                await query(
                    `UPDATE equipment SET workstation_id = NULL WHERE id = $1`,
                    [targetOccupantId]
                );

                // Log movement for Target device
                await query(
                    `INSERT INTO equipment_moves (equipment_id, from_workstation_id, to_workstation_id, moved_by, reason)
                     VALUES ($1, $2, NULL, $3, $4)`,
                    [targetOccupantId, targetWorkstationId, userId, `DISPLACED by ${equipment_id}`]
                );
            }

            // MOVE PRIMARY DEVICE (Source -> Target)
            await query(
                `UPDATE equipment SET workstation_id = $1 WHERE id = $2`,
                [targetWorkstationId, equipment_id]
            );

            // Log movement for Source device
            await query(
                `INSERT INTO equipment_moves (equipment_id, from_workstation_id, to_workstation_id, moved_by, reason)
                 VALUES ($1, $2, $3, $4, $5)`,
                [equipment_id, sourceWorkstationId, targetWorkstationId, userId, reason + (comment ? `. Comment: ${comment}` : '')]
            );

            await query('COMMIT');
            return NextResponse.json({ success: true });
        } catch (e) {
            await query('ROLLBACK');
            throw e;
        }

    } catch (error) {
        console.error('Move Equipment Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}