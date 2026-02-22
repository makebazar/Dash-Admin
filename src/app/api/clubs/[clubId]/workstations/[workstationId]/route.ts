import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

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

        // Verify ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Update Workstation Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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

        // Verify ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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
    } catch (error) {
        console.error('Delete Workstation Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
