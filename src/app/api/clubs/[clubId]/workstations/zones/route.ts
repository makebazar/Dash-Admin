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
        const { oldZone, newZone } = body;

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

        // Update zone name for all workstations in this zone
        const result = await query(
            `UPDATE club_workstations 
             SET zone = $1 
             WHERE club_id = $2 AND zone = $3`,
            [newZone, clubId, oldZone]
        );

        return NextResponse.json({ 
            message: 'Zone updated successfully',
            updatedCount: result.rowCount 
        });

    } catch (error) {
        console.error('Update Zone Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
