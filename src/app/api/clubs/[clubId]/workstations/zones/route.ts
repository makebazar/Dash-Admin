import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const body = await request.json();
        const { oldZone, newZone, assignedUserId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!oldZone || !newZone) {
            return NextResponse.json({ error: 'Old zone and new zone names are required' }, { status: 400 });
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

        // Update zone name and assigned user for all workstations in this zone
        const result = await query(
            `UPDATE club_workstations 
             SET zone = $1, assigned_user_id = $4
             WHERE club_id = $2 AND zone = $3
             RETURNING id`,
            [newZone, clubId, oldZone, assignedUserId || null]
        );

        // Also update equipment linked to these workstations
        if (assignedUserId) {
            const workstationIds = result.rows.map(r => r.id);
            if (workstationIds.length > 0) {
                await query(
                    `UPDATE equipment 
                     SET assigned_user_id = $1,
                         maintenance_enabled = TRUE
                     WHERE workstation_id = ANY($2)`,
                    [assignedUserId, workstationIds]
                );
            }
        } else if (assignedUserId === null) {
            const workstationIds = result.rows.map(r => r.id);
            if (workstationIds.length > 0) {
                await query(
                    `UPDATE equipment 
                     SET assigned_user_id = NULL,
                         maintenance_enabled = FALSE
                     WHERE workstation_id = ANY($1)`,
                    [workstationIds]
                );
            }
        }

        return NextResponse.json({ 
            message: 'Zone updated successfully',
            updatedCount: result.rowCount 
        });

    } catch (error) {
        console.error('Update Zone Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
