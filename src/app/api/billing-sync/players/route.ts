import { NextResponse } from 'next/server';
import { query, getClient } from '@/db';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xClubId = request.headers.get('X-Club-Id');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: missing or invalid Authorization header' }, { status: 401 });
        }

        const apiKey = authHeader.substring(7);
        const body = await request.json();
        const { club_id, player, players } = body;

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

        // Gather list of players to sync
        const playersList = [];
        if (Array.isArray(players)) {
            playersList.push(...players);
        } else if (player && typeof player === 'object') {
            playersList.push(player);
        }

        if (playersList.length === 0) {
            return NextResponse.json({ error: 'No player data provided' }, { status: 400 });
        }

        const client = await getClient();
        try {
            await client.query('BEGIN');

            for (const p of playersList) {
                const { id, phone, full_name, balance, bonus_balance, total_hours, total_spent } = p;

                if (!id) continue;

                // Upsert player details
                await client.query(
                    `INSERT INTO club_players (
                        id,
                        club_id,
                        phone,
                        full_name,
                        balance,
                        bonus_balance,
                        total_hours,
                        total_spent,
                        updated_at
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                     ON CONFLICT (id)
                     DO UPDATE SET 
                        club_id = EXCLUDED.club_id,
                        phone = EXCLUDED.phone,
                        full_name = EXCLUDED.full_name,
                        balance = EXCLUDED.balance,
                        bonus_balance = EXCLUDED.bonus_balance,
                        total_hours = EXCLUDED.total_hours,
                        total_spent = EXCLUDED.total_spent,
                        updated_at = NOW()`,
                    [
                        id,
                        targetClubId,
                        phone || null,
                        full_name || 'Игрок',
                        balance || 0,
                        bonus_balance || 0,
                        total_hours || 0,
                        total_spent || 0
                    ]
                );
            }

            await client.query('COMMIT');
            return NextResponse.json({
                success: true,
                message: `Successfully synced ${playersList.length} players`
            });

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Billing Sync Players Sync Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
