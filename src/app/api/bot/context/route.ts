import { NextResponse } from 'next/server';
import { query } from '@/db';
import { requireReportingApiKey } from '@/lib/reporting-api-key-guard';

// GET /api/bot/user-context?messenger_user_id=...
// This is a protected endpoint for n8n to get information about a linked user.
export async function GET(request: Request) {
    try {
        // This endpoint is for our bot, so it must be protected by our API key.
        requireReportingApiKey();

        const url = new URL(request.url);
        const messengerUserId = url.searchParams.get('messenger_user_id');
        const messengerType = url.searchParams.get('messenger_type') || 'MAX'; // Default to MAX

        if (!messengerUserId) {
            return NextResponse.json({ error: 'messenger_user_id is required' }, { status: 400 });
        }

        // 1. Find the DashAdmin user linked to this messenger user
        const link = await query(
            'SELECT user_id, current_club_id FROM bot_user_links WHERE messenger_user_id = $1 AND messenger_type = $2',
            [messengerUserId, messengerType]
        );

        if (link.rowCount === 0) {
            return NextResponse.json({ error: 'User not linked' }, { status: 404 });
        }

        const { user_id, current_club_id } = link.rows[0];

        // 2. Find all clubs this user has access to (both as owner and as employee)
        const clubs = await query(
            `
            SELECT id, name, 'owner' as role FROM clubs WHERE owner_id = $1
            UNION
            SELECT c.id, c.name, ce.role FROM club_employees ce JOIN clubs c ON ce.club_id = c.id WHERE ce.user_id = $1 AND ce.is_active = true AND ce.dismissed_at IS NULL
            `,
            [user_id]
        );

        return NextResponse.json({
            user_id: user_id,
            current_club_id: current_club_id, // This may be null if not set
            accessible_clubs: clubs.rows,
        });

    } catch (error: any) {
        console.error('Get user context error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
    }
}

// POST /api/bot/user-context
// Protected endpoint for n8n to set the user's active club context.
export async function POST(request: Request) {
    try {
        requireReportingApiKey();
        
        const body = await request.json();
        const { messenger_user_id, club_id } = body;
        const messenger_type = body.messenger_type || 'MAX';

        if (!messenger_user_id || !club_id) {
            return NextResponse.json({ error: 'messenger_user_id and club_id are required' }, { status: 400 });
        }

        // Here we can add a check to ensure the user actually has access to this club_id,
        // but for now we trust our n8n workflow which should have gotten the list from the GET endpoint.

        const result = await query(
            'UPDATE bot_user_links SET current_club_id = $1, updated_at = NOW() WHERE messenger_user_id = $2 AND messenger_type = $3',
            [club_id, messenger_user_id, messenger_type]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'User not linked' }, { status: 404 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Set user context error:', error);
        const status = error?.status || 500;
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
    }
}

