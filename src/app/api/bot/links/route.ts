
import { NextResponse } from 'next/server';
import { query } from '@/db';
import { getClubApiAccess } from '@/lib/club-api-access';

// GET /api/bot/links
// Fetches all active bot links for the current user.
export async function GET(request: Request) {
    try {
        const access = await getClubApiAccess();
        const userId = access.userId;

        const result = await query(
            `SELECT id, messenger_type, messenger_user_id, created_at 
             FROM bot_user_links 
             WHERE user_id = $1 AND messenger_type != 'PENDING'`,
            [userId]
        );

        return NextResponse.json(result.rows);

    } catch (error: any) {
        console.error('Get bot links error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
    }
}

// DELETE /api/bot/links?id=...
// Deletes a specific bot link for the current user.
export async function DELETE(request: Request) {
    try {
        const access = await getClubApiAccess();
        const userId = access.userId;

        const { searchParams } = new URL(request.url);
        const linkId = searchParams.get('id');

        if (!linkId) {
            return NextResponse.json({ error: 'Link ID is required' }, { status: 400 });
        }

        const deleteResult = await query(
            'DELETE FROM bot_user_links WHERE id = $1 AND user_id = $2',
            [linkId, userId]
        );

        if (deleteResult.rowCount === 0) {
            return NextResponse.json({ error: 'Link not found or you do not have permission to delete it' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Link deleted successfully' });

    } catch (error: any) {
        console.error('Delete bot link error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
    }
}
