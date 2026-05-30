import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; workstationId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, workstationId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify access to the club
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 1. Fetch current workstation info
        const wsRes = await query(
            `SELECT id, name, is_master FROM club_workstations WHERE id = $1 AND club_id = $2`,
            [workstationId, clubId]
        );

        if ((wsRes.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Workstation not found' }, { status: 404 });
        }

        const currentWs = wsRes.rows[0];

        // 2. Fetch games reported by the current workstation
        const currentGamesRes = await query(
            `SELECT id, game_name, app_id, installed_build, is_update_required, last_checked 
             FROM workstation_game_status 
             WHERE workstation_id = $1
             ORDER BY game_name`,
            [workstationId]
        );
        const currentGames = currentGamesRes.rows;

        // 3. Find if there is a Reference PC in this club
        const refPcRes = await query(
            `SELECT id, name FROM club_workstations WHERE club_id = $1 AND is_master = TRUE LIMIT 1`,
            [clubId]
        );

        const refPc = refPcRes.rows[0] || null;

        // 4. Fetch pending/sent commands for this workstation to show active actions
        const activeCmdsRes = await query(
            `SELECT id, type, payload, status FROM agent_commands 
             WHERE workstation_id = $1 AND status IN ('PENDING', 'SENT')`,
            [workstationId]
        );
        const activeCommands = activeCmdsRes.rows;

        // We will build a unified list of games
        let finalGames = [];

        // If there's a Reference PC and this is a regular PC, we compare against Reference PC games
        if (refPc && refPc.id !== workstationId) {
            // Fetch Reference PC's games
            const refGamesRes = await query(
                `SELECT game_name, app_id, installed_build, is_update_required 
                 FROM workstation_game_status 
                 WHERE workstation_id = $1`,
                [refPc.id]
            );
            const refGames = refGamesRes.rows;

            // Process Reference PC games first
            for (const rg of refGames) {
                const local = currentGames.find(cg => cg.game_name === rg.game_name || (rg.app_id && cg.app_id === rg.app_id));
                let statusText = 'ГОТОВ';
                let statusCode = 'READY'; // READY, UPDATE_REQUIRED, UPDATE_LAN, INSTALL_LAN
                let canUpdate = false;

                if (!local) {
                    statusText = 'УСТАНОВИТЬ (LAN)';
                    statusCode = 'INSTALL_LAN';
                    canUpdate = true;
                } else if (local.installed_build !== rg.installed_build) {
                    statusText = 'ОБНОВИТЬ (LAN)';
                    statusCode = 'UPDATE_LAN';
                    canUpdate = true;
                } else if (local.is_update_required) {
                    statusText = 'ОБНОВИТЬ';
                    statusCode = 'UPDATE_REQUIRED';
                    canUpdate = true;
                }

                // Check if an update command is already pending/sent
                const isCommandPending = activeCommands.some(
                    cmd => cmd.type === 'update_game' && Number(cmd.payload?.app_id) === rg.app_id
                );

                finalGames.push({
                    game_name: rg.game_name,
                    app_id: rg.app_id,
                    installed_build: local?.installed_build || null,
                    ref_build: rg.installed_build,
                    is_update_required: local ? local.is_update_required : true,
                    last_checked: local?.last_checked || null,
                    statusText,
                    statusCode,
                    canUpdate,
                    isCommandPending
                });
            }

            // Add any local games that are NOT on the Reference PC
            for (const lg of currentGames) {
                const onRef = refGames.some(rg => rg.game_name === lg.game_name || (lg.app_id && rg.app_id === lg.app_id));
                if (onRef) continue;

                const isCommandPending = activeCommands.some(
                    cmd => cmd.type === 'update_game' && Number(cmd.payload?.app_id) === lg.app_id
                );

                finalGames.push({
                    game_name: lg.game_name,
                    app_id: lg.app_id,
                    installed_build: lg.installed_build,
                    ref_build: null,
                    is_update_required: lg.is_update_required,
                    last_checked: lg.last_checked,
                    statusText: lg.is_update_required ? 'ОБНОВИТЬ' : 'ГОТОВ',
                    statusCode: lg.is_update_required ? 'UPDATE_REQUIRED' : 'READY',
                    canUpdate: lg.is_update_required,
                    isCommandPending
                });
            }
        } else {
            // This is the Reference PC itself or there is no Reference PC in the club
            for (const lg of currentGames) {
                const isCommandPending = activeCommands.some(
                    cmd => cmd.type === 'update_game' && Number(cmd.payload?.app_id) === lg.app_id
                );

                finalGames.push({
                    game_name: lg.game_name,
                    app_id: lg.app_id,
                    installed_build: lg.installed_build,
                    ref_build: null,
                    is_update_required: lg.is_update_required,
                    last_checked: lg.last_checked,
                    statusText: lg.is_update_required ? 'ОБНОВИТЬ' : 'ГОТОВ',
                    statusCode: lg.is_update_required ? 'UPDATE_REQUIRED' : 'READY',
                    canUpdate: lg.is_update_required,
                    isCommandPending
                });
            }
        }

        return NextResponse.json({
            games: finalGames,
            workstation: currentWs,
            reference_pc: refPc,
            active_commands: activeCommands
        });
    } catch (error) {
        console.error('Get Workstation Games Sync Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
