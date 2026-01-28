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
        const { name, zone } = await request.json();

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

        const result = await query(
            `UPDATE club_workstations 
             SET name = COALESCE($1, name), 
                 zone = COALESCE($2, zone)
             WHERE id = $3 AND club_id = $4
             RETURNING *`,
            [name, zone, workstationId, clubId]
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
