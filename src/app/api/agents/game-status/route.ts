import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { workstation_id, games } = body;

        if (!workstation_id) {
            return NextResponse.json({ error: 'workstation_id is required' }, { status: 400 });
        }

        if (!games || !Array.isArray(games)) {
            return NextResponse.json({ error: 'games array is required' }, { status: 400 });
        }

        // Upsert status for each game reported by the agent
        for (const game of games) {
            const { name, app_id, build_id, update_required } = game;

            if (!name) continue;

            await query(
                `INSERT INTO workstation_game_status 
                 (workstation_id, game_name, app_id, installed_build, is_update_required, last_checked)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT (workstation_id, game_name) 
                 DO UPDATE SET 
                     app_id = EXCLUDED.app_id,
                     installed_build = EXCLUDED.installed_build,
                     is_update_required = EXCLUDED.is_update_required,
                     last_checked = NOW()`,
                [
                    workstation_id,
                    name,
                    app_id ?? null,
                    build_id ? String(build_id) : null,
                    Boolean(update_required)
                ]
            );
        }

        // Update workstation status since we just heard from it
        await query(
            `UPDATE club_workstations 
             SET agent_last_seen = NOW(), 
                 agent_status = 'ONLINE'
             WHERE id = $1`,
            [workstation_id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Game Status Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
