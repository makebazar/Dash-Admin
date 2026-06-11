import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";
import { GameAgentConnector } from "@/lib/game-agent";

async function getExpectedPlayers(client: any, competitorAId: string | null, competitorBId: string | null): Promise<string[]> {
  const playerIds: string[] = [];

  const addCompetitorPlayers = async (compId: string | null) => {
    if (!compId) return;
    const compRes = await client.query(
      `SELECT type, team_id, player_id FROM tournament_competitors WHERE id = $1`,
      [compId]
    );
    if (compRes.rowCount === 0) return;

    const comp = compRes.rows[0];
    if (comp.type === "TEAM") {
      const membersRes = await client.query(
        `SELECT player_id FROM team_members WHERE team_id = $1`,
        [comp.team_id]
      );
      membersRes.rows.forEach((r: any) => playerIds.push(r.player_id));
    } else if (comp.player_id) {
      playerIds.push(comp.player_id);
    }
  };

  await addCompetitorPlayers(competitorAId);
  await addCompetitorPlayers(competitorBId);

  return playerIds;
}

// Background launcher for CS2 server
async function triggerServerLaunch(matchId: string, selectedMap: string, clubId: number) {
  const client = await getClient();
  try {
    console.log(`[Lobby API] Triggering server launch for match ${matchId} on map ${selectedMap}...`);
    
    // 1. Fetch match and competitor details
    const matchRes = await client.query(
      `SELECT m.id, m.competitor_a_id, m.competitor_b_id, t.name as tournament_name
       FROM tournament_matches m
       JOIN club_tournaments t ON m.tournament_id = t.id
       WHERE m.id = $1`,
      [matchId]
    );
    if (matchRes.rowCount === 0) return;
    
    const match = matchRes.rows[0];
    
    const compARes = await client.query(`SELECT display_name FROM tournament_competitors WHERE id = $1`, [match.competitor_a_id]);
    const compBRes = await client.query(`SELECT display_name FROM tournament_competitors WHERE id = $1`, [match.competitor_b_id]);
    
    const nameA = compARes.rows[0]?.display_name || "Team A";
    const nameB = compBRes.rows[0]?.display_name || "Team B";
    
    // 2. Fetch whitelisted players' SteamIDs
    const playersRes = await client.query(
      `SELECT p.steam_id 
       FROM lobby_checkin c
       JOIN promo_players p ON c.player_id = p.id
       WHERE c.match_id = $1 AND p.steam_id IS NOT NULL AND p.steam_id != ''`,
      [matchId]
    );
    const steamIds = playersRes.rows.map((r: any) => r.steam_id);
    
    // 3. Connect to agent and spin up server
    const agentUrl = process.env.GAME_AGENT_URL || "http://127.0.0.1:5000";
    const agent = new GameAgentConnector(agentUrl);
    
    // Check if agent is alive by running discover
    await agent.discover();
    
    // Generate ports dynamically based on match BIGINT id to prevent port clashes
    const portOffset = parseInt(matchId) % 10;
    const serverPort = 27015 + portOffset;
    
    const serverSettings = {
      matchTitle: `${nameA} vs ${nameB}`,
      map: selectedMap,
      port: serverPort,
      rconPassword: `rcon_${matchId.substring(0, 6)}`,
      isLan: true
    };
    
    const addRes = await agent.addServer(serverSettings);
    const serverId = addRes.id;
    
    // Start server process
    await agent.startServer(serverId);
    
    // Wait a couple of seconds for server to start listening before RCON
    await new Promise((resolve) => setTimeout(resolve, 5000));
    
    // Whitelist players via RCON
    if (steamIds.length > 0) {
      await agent.whitelistPlayers(serverId, steamIds);
    }
    
    // 4. Update database
    await client.query(
      `UPDATE tournament_matches 
       SET cs2_server_id = $1, status = 'LIVE'
       WHERE id = $2`,
      [serverId, matchId]
    );
    
    // Notify clients of live server status
    await client.query(`NOTIFY match_lobby_updates, $1`, [matchId]);
    console.log(`[Lobby API] Server launch successful for server ID: ${serverId}`);
  } catch (err) {
    console.error(`[Lobby API] CS2 Server Launch failed for match ${matchId}:`, err);
  } finally {
    client.release();
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const client = await getClient();
  try {
    const { matchId } = await params;
    const parsedMatchId = parseInt(matchId);

    // 1. Fetch match and tournament config
    const matchRes = await client.query(
      `SELECT m.id, m.tournament_id, m.round, m.order_in_round, m.competitor_a_id, m.competitor_b_id,
              m.score1, m.score2, m.status, m.cs2_server_id, m.winner_competitor_id,
              t.discipline, t.config as tournament_config
       FROM tournament_matches m
       JOIN club_tournaments t ON m.tournament_id = t.id
       WHERE m.id = $1`,
      [parsedMatchId]
    );

    if (matchRes.rowCount === 0) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }

    const match = matchRes.rows[0];

    // 2. Fetch competitor details with captain info
    const compARes = await client.query(
      `SELECT c.display_name, c.team_id, c.player_id, t.captain_id 
       FROM tournament_competitors c
       LEFT JOIN teams t ON c.team_id = t.id
       WHERE c.id = $1`,
      [match.competitor_a_id]
    );
    const compBRes = await client.query(
      `SELECT c.display_name, c.team_id, c.player_id, t.captain_id 
       FROM tournament_competitors c
       LEFT JOIN teams t ON c.team_id = t.id
       WHERE c.id = $1`,
      [match.competitor_b_id]
    );

    const compA = compARes.rows[0];
    const compB = compBRes.rows[0];

    const getRoster = async (teamId: string | null) => {
      if (!teamId) return [];
      const res = await client.query(
        `SELECT tm.player_id as id, p.full_name as name 
         FROM team_members tm
         JOIN promo_players p ON tm.player_id = p.id
         WHERE tm.team_id = $1`,
        [teamId]
      );
      return res.rows;
    };

    // 3. Fetch check-in statuses
    const checkinsRes = await client.query(
      `SELECT c.player_id, c.pc_number, c.is_ready, p.full_name
       FROM lobby_checkin c
       JOIN promo_players p ON c.player_id = p.id
       WHERE c.match_id = $1`,
      [parsedMatchId]
    );

    // 4. Fetch veto state
    const vetoRes = await client.query(
      `SELECT current_turn_competitor_id, banned_maps, selected_map 
       FROM match_veto 
       WHERE match_id = $1`,
      [parsedMatchId]
    );

    // 5. Fetch chat messages
    const messagesRes = await client.query(
      `SELECT m.id, m.sender_kind, m.sender_competitor_id, m.body, m.created_at, p.full_name as sender_name
       FROM tournament_match_messages m
       LEFT JOIN tournament_competitors tc ON m.sender_competitor_id = tc.id
       LEFT JOIN promo_players p ON tc.player_id = p.id
       WHERE m.match_id = $1
       ORDER BY m.created_at ASC`,
      [parsedMatchId]
    );

    const portOffset = parsedMatchId % 10;
    const serverPort = 27015 + portOffset;

    return NextResponse.json({
      match: {
        id: match.id,
        round: match.round,
        status: match.status,
        discipline: match.discipline,
        score1: match.score1,
        score2: match.score2,
        cs2ServerId: match.cs2_server_id,
        cs2ServerPort: serverPort,
        cs2ServerIp: process.env.GAME_SERVER_IP || "127.0.0.1",
        winnerId: match.winner_competitor_id,
        mapPool: match.tournament_config?.mapPool || ["de_mirage", "de_dust2", "de_inferno", "de_nuke", "de_anubis", "de_ancient", "de_vertigo"],
        competitorA: compA ? { 
          id: match.competitor_a_id, 
          name: compA.display_name, 
          teamId: compA.team_id, 
          playerId: compA.player_id,
          captainId: compA.captain_id,
          roster: await getRoster(compA.team_id)
        } : null,
        competitorB: compB ? { 
          id: match.competitor_b_id, 
          name: compB.display_name, 
          teamId: compB.team_id, 
          playerId: compB.player_id,
          captainId: compB.captain_id,
          roster: await getRoster(compB.team_id)
        } : null,
      },
      checkins: checkinsRes.rows,
      veto: vetoRes.rows[0] || null,
      messages: messagesRes.rows,
    });
  } catch (error) {
    console.error("Match GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const client = await getClient();
  try {
    const { matchId } = await params;
    const parsedMatchId = parseInt(matchId);

    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // Fetch match
    const matchRes = await client.query(
      `SELECT competitor_a_id, competitor_b_id, status FROM tournament_matches WHERE id = $1`,
      [parsedMatchId]
    );
    if (matchRes.rowCount === 0) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }
    const match = matchRes.rows[0];

    // ACTION: CHECKIN
    if (action === "checkin") {
      const { pcNumber } = body;
      if (!pcNumber) {
        return NextResponse.json({ error: "Укажите номер ПК" }, { status: 400 });
      }

      await client.query("BEGIN");

      // Save check-in
      await client.query(
        `INSERT INTO lobby_checkin (match_id, player_id, pc_number, is_ready)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (match_id, player_id)
         DO UPDATE SET pc_number = $3, is_ready = true, updated_at = NOW()`,
        [parsedMatchId, playerId, pcNumber]
      );

      // Verify if all players are ready to start veto
      const expectedPlayers = await getExpectedPlayers(client, match.competitor_a_id, match.competitor_b_id);
      const readyPlayersRes = await client.query(
        `SELECT player_id FROM lobby_checkin WHERE match_id = $1 AND is_ready = true`,
        [parsedMatchId]
      );
      const readyPlayerIds = readyPlayersRes.rows.map((r: any) => r.player_id);

      const allReady = expectedPlayers.every(id => readyPlayerIds.includes(id));

      if (allReady && match.status === "scheduled") {
        // Start VETO phase
        await client.query(
          `UPDATE tournament_matches SET status = 'veto' WHERE id = $1`,
          [parsedMatchId]
        );

        await client.query(
          `INSERT INTO match_veto (match_id, current_turn_competitor_id)
           VALUES ($1, $2)
           ON CONFLICT (match_id) DO UPDATE SET current_turn_competitor_id = $2`,
          [parsedMatchId, match.competitor_a_id]
        );
      }

      await client.query("COMMIT");

      // Notify clients
      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [matchId]);

      return NextResponse.json({ success: true });
    }

    // ACTION: VETO_BAN
    if (action === "veto_ban") {
      const { mapName } = body;
      if (!mapName) {
        return NextResponse.json({ error: "Карта не выбрана" }, { status: 400 });
      }

      await client.query("BEGIN");

      // Fetch Veto state
      const vetoRes = await client.query(
        `SELECT current_turn_competitor_id, banned_maps, selected_map 
         FROM match_veto 
         WHERE match_id = $1 FOR UPDATE`,
        [parsedMatchId]
      );

      if (vetoRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Вето еще не началось" }, { status: 400 });
      }

      const veto = vetoRes.rows[0];

      // Verify captain's turn
      const currentCompRes = await client.query(
        `SELECT type, team_id, player_id FROM tournament_competitors WHERE id = $1`,
        [veto.current_turn_competitor_id]
      );
      const currentComp = currentCompRes.rows[0];

      if (!currentComp) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Капитан не найден" }, { status: 404 });
      }

      const isCaptain = currentComp.type === "TEAM"
        ? (currentComp.team_id ? (await client.query(`SELECT id FROM teams WHERE id = $1 AND captain_id = $2`, [currentComp.team_id, playerId])).rows.length > 0 : false)
        : currentComp.player_id === playerId;

      if (!isCaptain) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Сейчас не ваш ход для бана" }, { status: 403 });
      }

      // Check map is not already banned
      const bannedMaps = veto.banned_maps || [];
      if (bannedMaps.includes(mapName)) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Эта карта уже забанена" }, { status: 400 });
      }

      const newBannedMaps = [...bannedMaps, mapName];

      // Fetch tournament settings for map pool
      const tourneyConfigRes = await client.query(
        `SELECT t.config FROM club_tournaments t 
         JOIN tournament_matches m ON t.id = m.tournament_id
         WHERE m.id = $1`,
        [parsedMatchId]
      );
      const mapPool = tourneyConfigRes.rows[0]?.config?.mapPool || ["de_mirage", "de_dust2", "de_inferno", "de_nuke", "de_anubis", "de_ancient", "de_vertigo"];

      const remainingMaps = mapPool.filter((m: string) => !newBannedMaps.includes(m));
      const nextTurnCompetitorId = veto.current_turn_competitor_id === match.competitor_a_id 
        ? match.competitor_b_id 
        : match.competitor_a_id;

      if (remainingMaps.length === 1) {
        // Only 1 map left -> Veto finished, launch CS2
        const selectedMap = remainingMaps[0];
        await client.query(
          `UPDATE match_veto 
           SET banned_maps = $1, selected_map = $2, current_turn_competitor_id = NULL
           WHERE match_id = $3`,
          [newBannedMaps, selectedMap, parsedMatchId]
        );

        await client.query(
          `UPDATE tournament_matches SET status = 'live' WHERE id = $1`,
          [parsedMatchId]
        );

        await client.query("COMMIT");

        // Notify clients
        await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [matchId]);

        // Launch CS2 server in the background
        triggerServerLaunch(matchId, selectedMap, parseInt(activeClubId));
      } else {
        // Veto continues
        await client.query(
          `UPDATE match_veto 
           SET banned_maps = $1, current_turn_competitor_id = $2
           WHERE match_id = $3`,
          [newBannedMaps, nextTurnCompetitorId, parsedMatchId]
        );

        await client.query("COMMIT");

        // Notify clients
        await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [matchId]);
      }

      return NextResponse.json({ success: true });
    }

    // ACTION: SEND_MESSAGE (chat)
    if (action === "send_message") {
      const { message } = body;
      if (!message || message.trim().length === 0) {
        return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
      }

      // Find player's competitor ID in this match
      const competitorARes = await client.query(
        `SELECT type, team_id, player_id FROM tournament_competitors WHERE id = $1`,
        [match.competitor_a_id]
      );
      const competitorBRes = await client.query(
        `SELECT type, team_id, player_id FROM tournament_competitors WHERE id = $1`,
        [match.competitor_b_id]
      );

      const compA = competitorARes.rows[0];
      const compB = competitorBRes.rows[0];

      const isMemberA = compA?.type === "TEAM"
        ? (compA.team_id ? (await client.query(`SELECT 1 FROM team_members WHERE team_id = $1 AND player_id = $2`, [compA.team_id, playerId])).rows.length > 0 : false)
        : compA?.player_id === playerId;

      const isMemberB = compB?.type === "TEAM"
        ? (compB.team_id ? (await client.query(`SELECT 1 FROM team_members WHERE team_id = $1 AND player_id = $2`, [compB.team_id, playerId])).rows.length > 0 : false)
        : compB?.player_id === playerId;

      if (!isMemberA && !isMemberB) {
        return NextResponse.json({ error: "Вы не являетесь участником этого матча" }, { status: 403 });
      }

      const senderCompetitorId = isMemberA ? match.competitor_a_id : match.competitor_b_id;

      await client.query(
        `INSERT INTO tournament_match_messages (match_id, sender_kind, sender_competitor_id, body)
         VALUES ($1, 'player', $2, $3)`,
        [parsedMatchId, senderCompetitorId, message.trim()]
      );

      // Notify clients
      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [matchId]);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Неверное действие" }, { status: 400 });
  } catch (error) {
    console.error("Match POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
