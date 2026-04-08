import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string; shiftId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, shiftId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessCheck = await query(
            `
            SELECT 1
            FROM club_employees
            WHERE club_id = $1 AND user_id = $2 AND is_active = true
            UNION
            SELECT 1
            FROM clubs
            WHERE id = $1 AND owner_id = $2
            LIMIT 1
            `,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const inventoryRes = await query(
            `
            SELECT id, warehouse_id, started_at
            FROM warehouse_inventories
            WHERE club_id = $1
              AND shift_id = $2
              AND status = 'OPEN'
            ORDER BY started_at ASC
            LIMIT 1
            `,
            [clubId, shiftId]
        );

        return NextResponse.json({
            inventory: inventoryRes.rows[0] || null,
        });
    } catch (error) {
        console.error('Get Open Shift Inventory Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
