import { NextResponse } from "next/server";
import { getClient, query } from "@/db";
import { cookies } from "next/headers";
import { broadcastSseCommand } from "@/lib/cs2/sse";
import { resolveMatchFormat } from "@/lib/brackets";
import { verifySessionValue } from "@/lib/session";

async function ensureMatchLobbyTables(client: any) {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS lobby_checkin (
        match_id BIGINT NOT NULL,
        player_id TEXT NOT NULL,
        pc_number VARCHAR(50),
        is_ready BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (match_id, player_id)
      );
      CREATE TABLE IF NOT EXISTS match_veto (
        match_id BIGINT PRIMARY KEY,
        current_turn_competitor_id BIGINT,
        banned_maps TEXT[] DEFAULT '{}',
        selected_map VARCHAR(100),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tournament_match_messages (
        id BIGSERIAL PRIMARY KEY,
        match_id BIGINT NOT NULL,
        sender_kind VARCHAR(30) DEFAULT 'player',
        sender_competitor_id BIGINT,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch (e) {
    console.warn("ensureMatchLobbyTables note:", e);
  }
}

async function getExpectedPlayers(client: any, matchId: number, competitorAId: string | null, competitorBId: string | null): Promise<string[]> {
  const playerIds: string[] = [];

  const addCompetitorPlayers = async (compId: string | null) => {
    if (!compId) return;
    const compRes = await client.query(
      `SELECT id, type, team_id, promo_team_id, player_id, display_name FROM tournament_competitors WHERE id = $1`,
      [compId]
    );
    if (compRes.rowCount === 0) return;

    const comp = compRes.rows[0];
    if (comp.type === "TEAM") {
      if (comp.promo_team_id) {
        const membersRes = await client.query(
          `SELECT COALESCE(p.id::text, tm.phone) as player_id 
           FROM promo_team_members tm
           LEFT JOIN promo_players p ON tm.phone = p.phone_number
           WHERE tm.team_id = $1`,
          [comp.promo_team_id]
        );
        membersRes.rows.forEach((r: any) => {
          if (r.player_id) playerIds.push(String(r.player_id));
        });
      } else if (comp.team_id) {
        const membersRes = await client.query(
          `SELECT player_id::text FROM team_members WHERE team_id = $1`,
          [comp.team_id]
        );
        membersRes.rows.forEach((r: any) => {
          if (r.player_id) playerIds.push(String(r.player_id));
        });
      }
    } else {
      const pid = comp.player_id ? String(comp.player_id) : String(comp.id);
      const isBot = Boolean(comp.display_name?.startsWith("[BOT]"));
      if (isBot) {
        await client.query(
          `INSERT INTO lobby_checkin (match_id, player_id, pc_number, is_ready, updated_at)
           VALUES ($1, $2, 'BOT', true, NOW())
           ON CONFLICT (match_id, player_id) DO UPDATE SET is_ready = true, updated_at = NOW()`,
          [matchId, pid]
        ).catch(() => {});
      } else {
        playerIds.push(pid);
      }
    }
  };

  await addCompetitorPlayers(competitorAId);
  await addCompetitorPlayers(competitorBId);

  return playerIds;
}

// Background launcher for CS2 server via DashMatch agent
async function triggerServerLaunch(matchId: string, selectedMap: string, clubId: number) {
  const client = await getClient();
  try {
    console.log(`[Lobby API] Launching DashMatch server for match ${matchId} on map ${selectedMap} in club ${clubId}...`);

    // 1. Fetch match and competitor details
    const matchRes = await client.query(
      `SELECT m.id, m.competitor_a_id, m.competitor_b_id, t.name as tournament_name, t.config as tournament_config, t.discipline
       FROM tournament_matches m
       JOIN club_tournaments t ON m.tournament_id = t.id
       WHERE m.id = $1`,
      [matchId]
    );
    if (matchRes.rowCount === 0) return;

    const match = matchRes.rows[0];
    const compARes = await client.query(`SELECT display_name FROM tournament_competitors WHERE id = $1`, [match.competitor_a_id]);
    const compBRes = await client.query(`SELECT display_name FROM tournament_competitors WHERE id = $1`, [match.competitor_b_id]);
    const nameA = compARes.rows[0]?.display_name || "Команда А";
    const nameB = compBRes.rows[0]?.display_name || "Команда Б";

    // 2. Fetch agent info from club_cs2_agents
    const agentRes = await client.query(
      `SELECT lan_ip, base_port, max_instances, (last_heartbeat > NOW() - INTERVAL '30 seconds') as is_online
       FROM club_cs2_agents
       WHERE club_id = $1`,
      [clubId]
    );
    const agent = agentRes.rows[0];
    const serverIp = agent?.lan_ip || process.env.GAME_SERVER_IP || "127.0.0.1";
    const basePort = agent?.base_port || 27015;
    const maxInstances = agent?.max_instances || 4;

    // 3. Find lowest available port
    const usedPortsRes = await client.query(
      `SELECT port FROM club_cs2_matches WHERE club_id = $1 AND status NOT IN ('stopped', 'finished')`,
      [clubId]
    );
    const usedPorts = new Set(usedPortsRes.rows.map((r: any) => r.port));
    let assignedPort = basePort;
    for (let i = 0; i < maxInstances; i++) {
      if (!usedPorts.has(basePort + i)) {
        assignedPort = basePort + i;
        break;
      }
    }

    const matchFormat = match.tournament_config?.matchFormat || "5v5";
    const matchzyId = parseInt(matchId, 10) || (Math.floor(Date.now() / 1000) % 2000000000 + 1);
    const dmMatchId = `dm-tourney-${matchId}`;

    // 4. Create or update record in club_cs2_matches
    await client.query(
      `INSERT INTO club_cs2_matches (id, club_id, map_name, match_format, team1_name, team2_name, status, port, server_ip, matchzy_id, config_data)
       VALUES ($1, $2, $3, $4, $5, $6, 'starting', $7, $8, $9, $10::jsonb)
       ON CONFLICT (id) DO UPDATE SET map_name = $3, status = 'starting', port = $7, server_ip = $8, matchzy_id = $9, config_data = $10::jsonb, updated_at = NOW()`,
      [
        dmMatchId,
        clubId,
        selectedMap,
        matchFormat,
        nameA,
        nameB,
        assignedPort,
        serverIp,
        matchzyId,
        JSON.stringify({
          knife_round: true,
          tournament_match_id: matchId,
          warmup_time: 60,
        }),
      ]
    );

    // 5. Enqueue START_MATCH command for the agent
    const configUrl = `https://mydashadmin.ru/api/clubs/${clubId}/cs2/matches/${matchId}/config`;
    await client.query(
      `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
       VALUES ($1, 'START_MATCH', $2, $3, 'pending')`,
      [
        clubId,
        dmMatchId,
        JSON.stringify({
          map_name: selectedMap,
          match_format: matchFormat,
          config_url: configUrl,
          auth_token: `secret_${matchId}`,
        }),
      ]
    );

    // 6. Broadcast SSE command to connected DashMatch agent
    broadcastSseCommand(clubId, {
      type: "START_MATCH",
      match_id: dmMatchId,
      map_name: selectedMap,
      match_format: matchFormat,
      config_url: configUrl,
      auth_token: `secret_${matchId}`,
    });

    // 7. Update tournament_matches
    await client.query(
      `UPDATE tournament_matches 
       SET cs2_server_id = $1, status = 'LIVE'
       WHERE id = $2`,
      [dmMatchId, matchId]
    );

    // 8. Notify clients
    await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]);
    const tRes = await client.query(`SELECT tournament_id FROM tournament_matches WHERE id = $1`, [matchId]).catch(() => ({ rows: [] }));
    if (tRes.rows.length > 0) {
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(tRes.rows[0].tournament_id)]).catch(() => {});
    }
    console.log(`[Lobby API] CS2 Server launch command sent for match ${matchId} (Port ${assignedPort})`);
  } catch (err) {
    console.error(`[Lobby API] CS2 Server Launch failed for match ${matchId}:`, err);
  } finally {
    client.release();
  }
}

async function checkAndProcessAutoVeto(client: any, matchId: number, match: any, veto: any, matchClubId: number) {
  if (!veto || !veto.current_turn_competitor_id || match.status?.toLowerCase() !== "veto") return veto;

  const compRes = await client.query(
    `SELECT type, player_id, display_name FROM tournament_competitors WHERE id = $1`,
    [veto.current_turn_competitor_id]
  );
  const comp = compRes.rows[0];
  if (!comp) return veto;

  let isBot = false;
  if (comp.player_id) {
    const botRes = await client.query(`SELECT is_bot FROM promo_players WHERE id = $1`, [comp.player_id]).catch(() => ({ rows: [] }));
    isBot = Boolean(botRes.rows[0]?.is_bot || comp.display_name?.startsWith("[BOT]"));
  } else if (comp.display_name?.startsWith("[BOT]")) {
    isBot = true;
  }

  const turnTime = veto.updated_at ? new Date(veto.updated_at).getTime() : Date.now();
  const isExpired = Date.now() - turnTime >= 45000;

  if (!isBot && !isExpired) {
    return veto;
  }

  const mapPool = match.tournament_config?.mapPool || ["de_mirage", "de_dust2", "de_inferno", "de_nuke", "de_anubis", "de_ancient", "de_vertigo"];
  const bannedMaps = veto.banned_maps || [];
  const remainingMaps = mapPool.filter((m: string) => !bannedMaps.includes(m));

  if (remainingMaps.length === 0) return veto;

  const mapToBan = remainingMaps[0];
  const newBannedMaps = [...bannedMaps, mapToBan];
  const matchFormat = resolveMatchFormat(match.tournament_config, match.round, undefined, match.result);
  const totalRequiredBans = matchFormat === "bo3" ? Math.max(1, mapPool.length - 3) : (mapPool.length - 1);
  const isVetoFinished = remainingMaps.length <= 2 || newBannedMaps.length >= totalRequiredBans;

  if (isVetoFinished) {
    const finalRemaining = mapPool.filter((m: string) => !newBannedMaps.includes(m));
    const selectedMap = finalRemaining[0] || mapPool[0];

    await client.query(
      `UPDATE match_veto 
       SET banned_maps = $1, selected_map = $2, current_turn_competitor_id = NULL, updated_at = NOW()
       WHERE match_id = $3`,
      [newBannedMaps, selectedMap, matchId]
    );

    await client.query(
      `UPDATE tournament_matches SET status = 'starting' WHERE id = $1`,
      [matchId]
    );

    await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]);
    if (match.tournament_id) {
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
    }

    triggerServerLaunch(String(matchId), selectedMap.split(",")[0].trim(), matchClubId);

    return {
      ...veto,
      banned_maps: newBannedMaps,
      selected_map: selectedMap,
      current_turn_competitor_id: null,
      updated_at: new Date().toISOString(),
    };
  } else {
    const nextTurnId = veto.current_turn_competitor_id === match.competitor_a_id ? match.competitor_b_id : match.competitor_a_id;
    await client.query(
      `UPDATE match_veto 
       SET banned_maps = $1, current_turn_competitor_id = $2, updated_at = NOW()
       WHERE match_id = $3`,
      [newBannedMaps, nextTurnId, matchId]
    );

    await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]);
    if (match.tournament_id) {
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
    }

    return {
      ...veto,
      banned_maps: newBannedMaps,
      current_turn_competitor_id: nextTurnId,
      updated_at: new Date().toISOString(),
    };
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

    await ensureMatchLobbyTables(client);

    // 1. Fetch match and tournament config
    const matchRes = await client.query(
      `SELECT m.id, m.tournament_id, m.round, m.order_in_round, m.competitor_a_id, m.competitor_b_id,
              m.score1, m.score2, m.status, m.cs2_server_id, m.winner_competitor_id, m.scheduled_at, m.result,
              t.id as club_tournament_id, t.club_id, t.name as tournament_name, t.discipline, t.config as tournament_config
       FROM tournament_matches m
       JOIN club_tournaments t ON m.tournament_id = t.id
       WHERE m.id = $1`,
      [parsedMatchId]
    );

    if (matchRes.rowCount === 0) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }

    const match = matchRes.rows[0];
    const matchClubId = match.club_id || 1;

    // 2. Fetch competitor details with captain info
    const compARes = await client.query(
      `SELECT c.id, c.display_name, c.team_id, c.promo_team_id, c.player_id, 
              COALESCE(cap.id::text, t.captain_id::text) as captain_id,
              t.logo_url as team_logo
       FROM tournament_competitors c
       LEFT JOIN teams t ON c.team_id = t.id
       LEFT JOIN promo_teams pt ON c.promo_team_id = pt.id
       LEFT JOIN promo_players cap ON pt.captain_phone = cap.phone_number
       WHERE c.id = $1`,
      [match.competitor_a_id]
    );
    const compBRes = await client.query(
      `SELECT c.id, c.display_name, c.team_id, c.promo_team_id, c.player_id, 
              COALESCE(cap.id::text, t.captain_id::text) as captain_id,
              t.logo_url as team_logo
       FROM tournament_competitors c
       LEFT JOIN teams t ON c.team_id = t.id
       LEFT JOIN promo_teams pt ON c.promo_team_id = pt.id
       LEFT JOIN promo_players cap ON pt.captain_phone = cap.phone_number
       WHERE c.id = $1`,
      [match.competitor_b_id]
    );

    const compA = compARes.rows[0];
    const compB = compBRes.rows[0];

    const getRoster = async (comp: any) => {
      if (!comp) return [];
      if (comp.promo_team_id) {
        const res = await client.query(
          `SELECT p.id::text, COALESCE(p.nickname, p.full_name, tm.phone) as name, p.avatar_url, p.steam_id, COALESCE(p.faceit_elo, 1000) as player_elo
           FROM promo_team_members tm
           LEFT JOIN promo_players p ON tm.phone = p.phone_number
           WHERE tm.team_id = $1`,
          [comp.promo_team_id]
        );
        return res.rows;
      }
      if (comp.team_id) {
        const res = await client.query(
          `SELECT tm.player_id::text as id, p.full_name as name, p.avatar_url, p.steam_id, COALESCE(p.faceit_elo, 1000) as player_elo
           FROM team_members tm
           JOIN promo_players p ON tm.player_id = p.id
           WHERE tm.team_id = $1`,
          [comp.team_id]
        );
        return res.rows;
      }
      if (comp.player_id) {
        const res = await client.query(
          `SELECT p.id::text, COALESCE(p.nickname, p.full_name) as name, p.avatar_url, p.steam_id, COALESCE(p.faceit_elo, 1000) as player_elo
           FROM promo_players p
           WHERE p.id::text = $1 OR p.phone_number = $1`,
          [String(comp.player_id)]
        );
        return res.rows;
      }
      return [];
    };

    // 3. Fetch check-in statuses with steam_id
    const checkinsRes = await client.query(
      `SELECT c.player_id, c.pc_number, c.is_ready, p.full_name, p.nickname, p.avatar_url, p.steam_id
       FROM lobby_checkin c
       LEFT JOIN promo_players p ON (c.player_id = p.id OR c.player_id::text = p.phone_number)
       WHERE c.match_id = $1`,
      [parsedMatchId]
    );

    // 4. Fetch veto state
    const vetoRes = await client.query(
      `SELECT current_turn_competitor_id, banned_maps, selected_map, updated_at 
       FROM match_veto 
       WHERE match_id = $1`,
      [parsedMatchId]
    );

    let veto = vetoRes.rows[0] || null;
    if (veto && match.status?.toLowerCase() === "veto") {
      veto = await checkAndProcessAutoVeto(client, parsedMatchId, match, veto, matchClubId);
    }

    // 5. Fetch chat messages
    const messagesRes = await client.query(
      `SELECT m.id, m.sender_kind, m.sender_competitor_id, m.body, m.created_at, 
              COALESCE(p.nickname, p.full_name, tc.display_name, 'Участник') as sender_name
       FROM tournament_match_messages m
       LEFT JOIN tournament_competitors tc ON m.sender_competitor_id = tc.id
       LEFT JOIN promo_players p ON (tc.player_id = p.id OR tc.player_id::text = p.phone_number)
       WHERE m.match_id = $1
       ORDER BY m.created_at ASC`,
      [parsedMatchId]
    );

    // 6. Fetch club CS2 agent status
    const agentRes = await client.query(
      `SELECT lan_ip, base_port, max_instances, last_heartbeat,
              (last_heartbeat > NOW() - INTERVAL '30 seconds') as is_online
       FROM club_cs2_agents
       WHERE club_id = $1`,
      [matchClubId]
    ).catch(() => ({ rows: [] }));

    const agent = agentRes.rows[0];
    const isAgentOnline = Boolean(agent?.is_online);

    // 7. Fetch live CS2 instance if exists
    const cs2Res = await client.query(
      `SELECT id, status, game_state, port, server_ip, score1, score2, match_stats, created_at, updated_at
       FROM club_cs2_matches
       WHERE id = $1 OR (config_data->>'tournament_match_id') = $2 OR matchzy_id = $3
       ORDER BY created_at DESC LIMIT 1`,
      [match.cs2_server_id || `dm-tourney-${parsedMatchId}`, String(parsedMatchId), parsedMatchId]
    ).catch(() => ({ rows: [] }));

    const cs2Match = cs2Res.rows[0];
    const serverIp = cs2Match?.server_ip || agent?.lan_ip || process.env.GAME_SERVER_IP || "127.0.0.1";
    const serverPort = cs2Match?.port || agent?.base_port || 27015;

    // Determine selected map
    const selectedMap = veto?.selected_map || match.tournament_config?.defaultMap || "de_mirage";

    // Accurate server state determination
    let serverStatus: "idle" | "agent_offline" | "starting" | "start_failed" | "ready" | "warmup" | "knife" | "live" | "paused" | "finished" = "idle";
    const statusLower = (match.status || "").toLowerCase();
    const isVetoPhase = statusLower === "veto";
    const isScheduledPhase = statusLower === "scheduled" || statusLower === "pending";
    const isMatchStartingOrLive = ["starting", "in_progress", "live", "playing", "finished"].includes(statusLower);

    if (statusLower === "finished" || cs2Match?.status === "finished") {
      serverStatus = "finished";
    } else if (isScheduledPhase || isVetoPhase) {
      serverStatus = "idle";
    } else if (isMatchStartingOrLive) {
      if (!isAgentOnline && !cs2Match) {
        serverStatus = "agent_offline";
      } else if (!cs2Match || cs2Match.status === "starting") {
        if (!isAgentOnline) {
          serverStatus = "agent_offline";
        } else {
          const createdAt = cs2Match?.created_at ? new Date(cs2Match.created_at).getTime() : Date.now();
          const elapsedSec = (Date.now() - createdAt) / 1000;
          if (elapsedSec > 90) {
            serverStatus = "start_failed";
          } else {
            serverStatus = "starting";
          }
        }
      } else if (cs2Match.status === "running") {
        serverStatus = "ready";
      } else if (cs2Match.status === "warmup" || cs2Match.game_state === "warmup") {
        serverStatus = "warmup";
      } else if (cs2Match.status === "knife" || cs2Match.game_state === "knife" || cs2Match.game_state === "knife_won") {
        serverStatus = "knife";
      } else if (cs2Match.status === "live" || cs2Match.game_state === "live") {
        serverStatus = cs2Match.game_state === "paused" ? "paused" : "live";
      } else if (cs2Match.status === "stopped") {
        serverStatus = "start_failed";
      } else {
        serverStatus = "ready";
      }
    }

    // Combined live score
    const liveScore1 = cs2Match ? cs2Match.score1 : (match.score1 ?? 0);
    const liveScore2 = cs2Match ? cs2Match.score2 : (match.score2 ?? 0);
    const matchStats = cs2Match?.match_stats || match.result?.stats || null;

    return NextResponse.json({
      match: {
        id: match.id,
        tournamentId: match.tournament_id,
        tournamentName: match.tournament_name,
        round: match.round,
        orderInRound: match.order_in_round,
        status: match.status,
        discipline: match.discipline || "cs2",
        score1: liveScore1,
        score2: liveScore2,
        cs2ServerId: match.cs2_server_id || cs2Match?.id,
        cs2ServerPort: serverPort,
        cs2ServerIp: serverIp,
        connectCommand: `connect ${serverIp}:${serverPort}`,
        gameState: cs2Match?.game_state || (match.status === "FINISHED" ? "finished" : "live"),
        serverStatus,
        isAgentOnline,
        selectedMap,
        serverStartedAt: cs2Match?.created_at || null,
        matchStats,
        scheduledAt: match.scheduled_at,
        winnerId: match.winner_competitor_id,
        mapPool: match.tournament_config?.mapPool || ["de_mirage", "de_dust2", "de_inferno", "de_nuke", "de_anubis", "de_ancient", "de_vertigo"],
        matchFormat: resolveMatchFormat(match.tournament_config, match.round, undefined, match.result),
        competitorA: compA ? { 
          id: match.competitor_a_id, 
          name: compA.display_name, 
          teamId: compA.promo_team_id || compA.team_id, 
          playerId: compA.player_id,
          captainId: compA.captain_id,
          logoUrl: compA.team_logo,
          roster: await getRoster(compA)
        } : null,
        competitorB: compB ? { 
          id: match.competitor_b_id, 
          name: compB.display_name, 
          teamId: compB.promo_team_id || compB.team_id, 
          playerId: compB.player_id,
          captainId: compB.captain_id,
          logoUrl: compB.team_logo,
          roster: await getRoster(compB)
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

    await ensureMatchLobbyTables(client);

    const cookieStore = await cookies();
    let playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId) {
      const sessionUser = await verifySessionValue(cookieStore.get("session_user_id")?.value);
      if (sessionUser) {
        playerId = sessionUser;
      }
    }

    if (!playerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve playerId to promo_players UUID if needed (e.g. if stored as phone or custom id)
    const resolvedPlayerRes = await client.query(
      `SELECT id FROM promo_players WHERE id::text = $1 OR phone_number = $1`,
      [String(playerId)]
    );
    if (resolvedPlayerRes.rowCount && resolvedPlayerRes.rowCount > 0) {
      playerId = resolvedPlayerRes.rows[0].id;
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    // Fetch match
    const matchRes = await client.query(
      `SELECT m.competitor_a_id, m.competitor_b_id, m.status, m.tournament_id, t.club_id
       FROM tournament_matches m
       JOIN club_tournaments t ON m.tournament_id = t.id
       WHERE m.id = $1`,
      [parsedMatchId]
    );
    if (matchRes.rowCount === 0) {
      return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
    }
    const match = matchRes.rows[0];
    const matchClubId = match.club_id || (activeClubId ? parseInt(activeClubId, 10) : 1);

    // ACTION: CHECKIN
    if (action === "checkin") {
      const { pcNumber, steamId } = body;
      if (!pcNumber) {
        return NextResponse.json({ error: "Укажите номер ПК" }, { status: 400 });
      }

      // Update Steam ID if provided (run before transaction block so any validation issue doesn't abort transaction)
      if (steamId && typeof steamId === "string" && steamId.trim().length > 0) {
        const cleanSteam = steamId.trim();
        await client.query(
          `UPDATE promo_players 
           SET steam_id = $1,
               steam_link = CASE WHEN $1 LIKE 'http%' THEN $1 ELSE steam_link END
           WHERE id::text = $2 OR phone_number = $2`,
          [cleanSteam, String(playerId)]
        ).catch((err: any) => console.warn("[Checkin steam update note]:", err.message));
      }

      await client.query("BEGIN");

      // Save check-in
      await client.query(
        `INSERT INTO lobby_checkin (match_id, player_id, pc_number, is_ready, updated_at)
         VALUES ($1, $2, $3, true, NOW())
         ON CONFLICT (match_id, player_id)
         DO UPDATE SET pc_number = $3, is_ready = true, updated_at = NOW()`,
        [parsedMatchId, playerId, pcNumber]
      );

      // Verify if all players are ready to start veto
      const hasBothCompetitors = Boolean(match.competitor_a_id && match.competitor_b_id);
      const expectedPlayers = await getExpectedPlayers(client, parsedMatchId, match.competitor_a_id, match.competitor_b_id);
      const readyPlayersRes = await client.query(
        `SELECT player_id FROM lobby_checkin WHERE match_id = $1 AND is_ready = true`,
        [parsedMatchId]
      );
      const readyPlayerIds = new Set(readyPlayersRes.rows.map((r: any) => r.player_id));

      const allReady = hasBothCompetitors && expectedPlayers.length >= 2 && expectedPlayers.every(id => readyPlayerIds.has(id));

      if (allReady && (match.status?.toLowerCase() === "scheduled" || match.status?.toLowerCase() === "pending")) {
        // Start VETO phase
        await client.query(
          `UPDATE tournament_matches SET status = 'veto' WHERE id = $1`,
          [parsedMatchId]
        );

        await client.query(
          `INSERT INTO match_veto (match_id, current_turn_competitor_id, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (match_id) DO UPDATE SET current_turn_competitor_id = $2, updated_at = NOW()`,
          [parsedMatchId, match.competitor_a_id]
        );
      }

      await client.query("COMMIT");

      // Notify clients
      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [matchId]);
      if (match.tournament_id) {
        await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
      }

      return NextResponse.json({ success: true });
    }

    // ACTION: VETO_BAN / VETO_PICK
    if (action === "veto_ban" || action === "veto_pick") {
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
        `SELECT type, team_id, promo_team_id, player_id FROM tournament_competitors WHERE id = $1`,
        [veto.current_turn_competitor_id]
      );
      const currentComp = currentCompRes.rows[0];

      if (!currentComp) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Капитан не найден" }, { status: 404 });
      }

      let isCaptain = false;
      if (currentComp.type === "TEAM") {
        if (currentComp.promo_team_id) {
          const checkCap = await client.query(
            `SELECT pt.id 
             FROM promo_teams pt
             JOIN promo_players p ON pt.captain_phone = p.phone_number
             WHERE pt.id = $1 AND (p.id::text = $2 OR p.phone_number = $2)`,
            [currentComp.promo_team_id, playerId]
          );
          isCaptain = checkCap.rows.length > 0;
        } else if (currentComp.team_id) {
          const checkCap = await client.query(
            `SELECT id FROM teams WHERE id = $1 AND captain_id::text = $2`,
            [currentComp.team_id, playerId]
          );
          isCaptain = checkCap.rows.length > 0;
        }
      } else {
        isCaptain = String(currentComp.player_id) === String(playerId) || String(currentComp.id) === String(playerId);
      }

      if (!isCaptain) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Сейчас не ваш ход для выбора карты" }, { status: 403 });
      }

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
      const matchFormat = resolveMatchFormat(match.tournament_config, match.round, undefined, match.result);

      const remainingMaps = mapPool.filter((m: string) => !newBannedMaps.includes(m));
      const nextTurnCompetitorId = veto.current_turn_competitor_id === match.competitor_a_id 
        ? match.competitor_b_id 
        : match.competitor_a_id;

      // BO1: ban until 1 map left (mapPool.length - 1 bans)
      // BO3: ban, ban, pick, pick, ban, ban -> 1 decider left
      const totalRequiredBans = matchFormat === "bo3" ? Math.max(1, mapPool.length - 3) : (mapPool.length - 1);
      const isVetoFinished = remainingMaps.length <= (matchFormat === "bo3" ? 1 : 1) || newBannedMaps.length >= totalRequiredBans;

      if (isVetoFinished) {
        let selectedMap = remainingMaps[0] || mapPool[0];
        if (matchFormat === "bo3" && newBannedMaps.length >= 4) {
          const pickA = newBannedMaps[2] || remainingMaps[0];
          const pickB = newBannedMaps[3] || remainingMaps[1];
          const decider = remainingMaps[0] || remainingMaps[2] || mapPool[0];
          selectedMap = `${pickA},${pickB},${decider}`;
        }

        await client.query(
          `UPDATE match_veto 
           SET banned_maps = $1, selected_map = $2, current_turn_competitor_id = NULL, updated_at = NOW()
           WHERE match_id = $3`,
          [newBannedMaps, selectedMap, parsedMatchId]
        );

        await client.query(
          `UPDATE tournament_matches SET status = 'starting' WHERE id = $1`,
          [parsedMatchId]
        );

        await client.query("COMMIT");

        // Notify clients
        await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [matchId]);
        if (match.tournament_id) {
          await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
        }

        // Trigger DashMatch server launch
        const firstMap = selectedMap.split(",")[0].trim();
        triggerServerLaunch(matchId, firstMap, matchClubId);
      } else {
        // Veto continues
        await client.query(
          `UPDATE match_veto 
           SET banned_maps = $1, current_turn_competitor_id = $2, updated_at = NOW()
           WHERE match_id = $3`,
          [newBannedMaps, nextTurnCompetitorId, parsedMatchId]
        );

        await client.query("COMMIT");

        // Notify clients
        await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [matchId]);
        if (match.tournament_id) {
          await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
        }
      }

      return NextResponse.json({ success: true });
    }

    // ACTION: TACTICAL_PAUSE
    if (action === "tactical_pause") {
      // Find server instance
      const cs2Res = await client.query(
        `SELECT id, club_id, port, status FROM club_cs2_matches 
         WHERE (id = $1 OR (config_data->>'tournament_match_id') = $2) AND status NOT IN ('stopped', 'finished')`,
        [match.cs2_server_id || `dm-tourney-${parsedMatchId}`, String(parsedMatchId)]
      );

      if (cs2Res.rowCount === 0) {
        return NextResponse.json({ error: "Сервер матча не активен" }, { status: 400 });
      }

      const cs2 = cs2Res.rows[0];

      // Enqueue pause RCON command
      await client.query(
        `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
         VALUES ($1, 'RCON_COMMAND', $2, $3, 'pending')`,
        [
          cs2.club_id,
          cs2.id,
          JSON.stringify({ command: "css_pause" }),
        ]
      );

      broadcastSseCommand(cs2.club_id, {
        type: "RCON_COMMAND",
        match_id: cs2.id,
        command: "css_pause",
      });

      return NextResponse.json({ success: true, message: "Тактическая пауза запрошена" });
    }

    // ACTION: SEND_MESSAGE (chat)
    if (action === "send_message") {
      const { message } = body;
      if (!message || message.trim().length === 0) {
        return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
      }

      // Check player's competitor
      const compARes = await client.query(
        `SELECT c.id, c.type, c.team_id, c.promo_team_id, c.player_id FROM tournament_competitors c WHERE c.id = $1`,
        [match.competitor_a_id]
      );
      const compBRes = await client.query(
        `SELECT c.id, c.type, c.team_id, c.promo_team_id, c.player_id FROM tournament_competitors c WHERE c.id = $1`,
        [match.competitor_b_id]
      );

      const compA = compARes.rows[0];
      const compB = compBRes.rows[0];

      const checkInCompetitor = async (comp: any) => {
        if (!comp) return false;
        if (String(comp.player_id) === String(playerId) || String(comp.id) === String(playerId)) return true;
        if (comp.promo_team_id) {
          const r = await client.query(
            `SELECT 1 FROM promo_team_members tm JOIN promo_players p ON tm.phone = p.phone_number WHERE tm.team_id = $1 AND (p.id::text = $2 OR p.phone_number = $2)`,
            [comp.promo_team_id, playerId]
          );
          return r.rows.length > 0;
        }
        if (comp.team_id) {
          const r = await client.query(
            `SELECT 1 FROM team_members WHERE team_id = $1 AND player_id::text = $2`,
            [comp.team_id, playerId]
          );
          return r.rows.length > 0;
        }
        return false;
      };

      const isMemberA = await checkInCompetitor(compA);
      const isMemberB = await checkInCompetitor(compB);

      const senderCompetitorId = isMemberA ? match.competitor_a_id : (isMemberB ? match.competitor_b_id : null);

      await client.query(
        `INSERT INTO tournament_match_messages (match_id, sender_kind, sender_competitor_id, body)
         VALUES ($1, 'player', $2, $3)`,
        [parsedMatchId, senderCompetitorId, message.trim()]
      );

      // Notify clients
      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [matchId]);

      return NextResponse.json({ success: true });
    }

    // ACTION: RESTART_SERVER
    if (action === "restart_server") {
      const vetoRes = await client.query(`SELECT selected_map FROM match_veto WHERE match_id = $1`, [parsedMatchId]);
      const selectedMap = vetoRes.rows[0]?.selected_map || "de_mirage";
      await triggerServerLaunch(String(parsedMatchId), selectedMap, matchClubId);
      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [matchId]);
      return NextResponse.json({ success: true, message: "Сервер перезапущен" });
    }

    return NextResponse.json({ error: "Неверное действие" }, { status: 400 });
  } catch (error: any) {
    console.error("Match POST Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error", detail: String(error) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
