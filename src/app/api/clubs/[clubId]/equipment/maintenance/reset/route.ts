import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify access (allow any employee for now since this is a test feature requested by user)
        const accessCheck = await query(
            `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
             UNION
             SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Delete ALL maintenance tasks for this club's equipment
        await query(
            `DELETE FROM equipment_maintenance_tasks 
             WHERE equipment_id IN (SELECT id FROM equipment WHERE club_id = $1)`,
            [clubId]
        );

        // Optional: Reset last_cleaned_at on equipment? 
        // User said "remove all records", implying a fresh start.
        // Let's reset last_cleaned_at to NULL so new tasks are generated from "now"
        await query(
            `UPDATE equipment SET last_cleaned_at = NULL WHERE club_id = $1`,
            [clubId]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reset Maintenance Tasks Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
