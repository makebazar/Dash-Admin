import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

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

        // Verify ownership
        const ownerCheck = await query(
            `SELECT id FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if (ownerCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { items } = await request.json(); // Expects: [{ id: 'user_id', order: 1 }, ...]

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // Perform batch update inside a transaction ideally, or just loop for MVP
        // Since it's a small list (<50 employees), a loop of updates or a CASE statement is fine.
        // Let's use a single query with unnest for performance if possible, or simple loop. 
        // Simple loop is safer for now to avoid complex SQL syntax errors without testing.

        await query('BEGIN');

        try {
            for (const item of items) {
                await query(
                    `UPDATE club_employees SET display_order = $1 WHERE club_id = $2 AND user_id = $3`,
                    [item.order, clubId, item.id]
                );
            }
            await query('COMMIT');
        } catch (e) {
            await query('ROLLBACK');
            throw e;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Reorder Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
