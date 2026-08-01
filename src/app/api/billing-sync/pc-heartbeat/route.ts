import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xClubId = request.headers.get('X-Club-Id');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: missing or invalid Authorization header' }, { status: 401 });
        }

        const apiKey = authHeader.substring(7);
        const body = await request.json();
        const { 
            club_id, 
            workstations,
            visits_today,
            visits_unique,
            visits_new,
            bookings_count
        } = body;

        const targetClubId = xClubId ? parseInt(xClubId) : club_id;

        if (!targetClubId) {
            return NextResponse.json({ error: 'club_id is required in body or X-Club-Id header' }, { status: 400 });
        }

        // Fetch club details to verify API Key
        const clubRes = await query(
            `SELECT inventory_settings FROM clubs WHERE id = $1`,
            [targetClubId]
        );

        if (!clubRes.rows || clubRes.rows.length === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const club = clubRes.rows[0];
        const clubApiKey = club.inventory_settings?.api_key || process.env.DASHADMIN_SYNC_KEY;

        // Verify API key
        if (clubApiKey && apiKey !== clubApiKey && apiKey !== process.env.DASHADMIN_SYNC_KEY) {
            return NextResponse.json({ error: 'Forbidden: invalid API key' }, { status: 403 });
        }

        const dashlockState = {
            workstations: Array.isArray(workstations) ? workstations : [],
            visits_today: typeof visits_today === 'number' ? visits_today : null,
            visits_unique: typeof visits_unique === 'number' ? visits_unique : null,
            visits_new: typeof visits_new === 'number' ? visits_new : null,
            bookings_count: typeof bookings_count === 'number' ? bookings_count : null,
            last_seen: new Date().toISOString()
        };

        // Update the club's dashlock_state
        await query(
            `UPDATE clubs 
             SET dashlock_state = $1
             WHERE id = $2`,
            [JSON.stringify(dashlockState), targetClubId]
        );

        return NextResponse.json({
            success: true,
            message: 'PC heartbeat recorded successfully'
        });

    } catch (error) {
        console.error('Billing Sync PC Heartbeat Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
