import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { requireClubFullAccess } from '@/lib/club-api-access';
import { propagateWorkstationAssigneeToEquipment } from '@/lib/maintenance-task-logic';

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

        if (body.is_available_to_all !== undefined) {
            updates.push(`is_available_to_all = $${paramIndex}`);
            values.push(Boolean(body.is_available_to_all));
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
            await propagateWorkstationAssigneeToEquipment({
                clubId,
                workstationIds: [workstationId],
                assignedUserId,
                forceMaintenanceEnabled: true,
            });
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
