import { broadcastSseCommand } from "./sse";
import { normalizeCS2Map, getNumericMatchId } from "./utils";

export interface SlotAllocationResult {
  available: boolean;
  agentId?: string;
  serverIp?: string;
  port?: number;
  reason?: string;
  queuePosition?: number;
}

/**
 * Searches across all online club agents to find a free port/slot.
 */
export async function allocateServerSlot(
  client: any,
  clubId: number,
  dmMatchId: string
): Promise<SlotAllocationResult> {
  // 1. Fetch all online agents for this club (heartbeat within 45s)
  const agentsRes = await client.query(
    `SELECT agent_id, lan_ip, base_port, max_instances, last_heartbeat
     FROM club_cs2_agents
     WHERE club_id = $1 AND last_heartbeat > NOW() - INTERVAL '45 seconds'
     ORDER BY updated_at ASC`,
    [clubId]
  ).catch(() => ({ rows: [] }));

  let onlineAgents = agentsRes.rows;

  // Fallback if table or record doesn't exist yet but game server IP is configured
  if (onlineAgents.length === 0) {
    onlineAgents = [
      {
        agent_id: "default",
        lan_ip: process.env.GAME_SERVER_IP || "127.0.0.1",
        base_port: 27015,
        max_instances: 4,
      },
    ];
  }

  // 2. Query all currently active matches that are using ports in this club
  const activeMatchesRes = await client.query(
    `SELECT id, port, server_ip, agent_id, status 
     FROM club_cs2_matches 
     WHERE club_id = $1 AND id != $2 AND status NOT IN ('stopped', 'finished', 'waiting_server')`,
    [clubId, dmMatchId]
  ).catch(() => ({ rows: [] }));

  const activeMatches = activeMatchesRes.rows;

  // 3. Find the first agent with an unused port in its allowed range
  for (const agent of onlineAgents) {
    const basePort = agent.base_port || 27015;
    const maxInstances = agent.max_instances || 4;
    const agentId = agent.agent_id || "default";
    const agentIp = agent.lan_ip || "127.0.0.1";

    const usedPortsOnAgent = new Set(
      activeMatches
        .filter((m: any) => (m.agent_id && m.agent_id === agentId) || m.server_ip === agentIp)
        .map((m: any) => m.port)
    );

    for (let i = 0; i < maxInstances; i++) {
      const candidatePort = basePort + i;
      if (!usedPortsOnAgent.has(candidatePort)) {
        return {
          available: true,
          agentId,
          serverIp: agentIp,
          port: candidatePort,
        };
      }
    }
  }

  // All slots across all agents are busy
  return {
    available: false,
    reason: "slots_full",
  };
}

/**
 * Launches server if a slot is available, or puts the match in WAITING_SERVER queue.
 */
export async function launchOrQueueMatchServer(
  client: any,
  clubId: number,
  matchId: string | number,
  selectedMap: string,
  matchFormat: string = "5v5",
  options?: {
    knifeRound?: boolean;
    practiceMode?: boolean;
    warmupTime?: number;
  }
) {
  const cleanMatchId = String(matchId).replace(/^dm-tourney-/, "").replace(/^dm-/, "");
  const dmMatchId = `dm-tourney-${cleanMatchId}`;

  // Cancel any stale pending commands for this match to avoid collision
  await client.query(
    `UPDATE club_cs2_commands SET status = 'cancelled' WHERE club_id = $1 AND match_id = $2 AND status = 'pending'`,
    [clubId, dmMatchId]
  ).catch(() => {});

  // Fetch match details to retrieve team names
  const matchRes = await client.query(
    `SELECT m.id, m.competitor_a_id, m.competitor_b_id, m.tournament_id,
            ca.display_name as name_a, cb.display_name as name_b
     FROM tournament_matches m
     LEFT JOIN tournament_competitors ca ON m.competitor_a_id = ca.id
     LEFT JOIN tournament_competitors cb ON m.competitor_b_id = cb.id
     WHERE m.id = $1`,
    [cleanMatchId]
  ).catch(() => ({ rows: [] }));

  const matchData = matchRes.rows[0] || {};
  const nameA = matchData.name_a || "Команда А";
  const nameB = matchData.name_b || "Команда Б";

  let normalizedMap = normalizeCS2Map(selectedMap || "de_mirage");
  if (!/^\d+$/.test(normalizedMap) && !normalizedMap.startsWith("de_") && !normalizedMap.startsWith("cs_")) {
    const customRes = await client.query(
      `SELECT map_id FROM club_cs2_custom_maps WHERE club_id = $1 AND (name ILIKE $2 OR map_id = $3) LIMIT 1`,
      [clubId, (selectedMap || "").trim(), (selectedMap || "").trim()]
    ).catch(() => ({ rows: [] }));
    if (customRes.rows.length > 0) {
      normalizedMap = customRes.rows[0].map_id;
    }
  }

  const matchzyId = parseInt(cleanMatchId, 10) || (Math.floor(Date.now() / 1000) % 2000000000 + 1);

  // Check slot availability
  const allocation = await allocateServerSlot(client, clubId, dmMatchId);

  if (allocation.available && allocation.serverIp && allocation.port) {
    // 1. Slot is available: Start Server
    await client.query(
      `INSERT INTO club_cs2_matches (
        id, club_id, map_name, match_format, team1_name, team2_name,
        status, port, server_ip, agent_id, matchzy_id, config_data,
        rcon_last_command, rcon_last_response, score1, score2, game_state, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'starting', $7, $8, $9, $10, $11::jsonb, NULL, NULL, 0, 0, 'warmup', NOW())
      ON CONFLICT (id) DO UPDATE SET
        map_name = $3,
        match_format = $4,
        team1_name = $5,
        team2_name = $6,
        status = 'starting',
        port = $7,
        server_ip = $8,
        agent_id = $9,
        matchzy_id = $10,
        config_data = $11::jsonb,
        rcon_last_command = NULL,
        rcon_last_response = NULL,
        score1 = 0,
        score2 = 0,
        game_state = 'warmup',
        updated_at = NOW()`,
      [
        dmMatchId,
        clubId,
        normalizedMap,
        matchFormat,
        nameA,
        nameB,
        allocation.port,
        allocation.serverIp,
        allocation.agentId || "default",
        matchzyId,
        JSON.stringify({
          knife_round: options?.knifeRound ?? true,
          practice_mode: options?.practiceMode ?? false,
          tournament_match_id: cleanMatchId,
          warmup_time: options?.warmupTime ?? 60,
        }),
      ]
    );

    // Update tournament match status
    await client.query(
      `UPDATE tournament_matches
       SET cs2_server_id = $1, status = 'STARTING'
       WHERE id = $2`,
      [dmMatchId, cleanMatchId]
    ).catch(() => {});

    // Enqueue START_MATCH command
    const configUrl = `https://mydashadmin.ru/api/clubs/${clubId}/cs2/matches/${cleanMatchId}/config`;
    await client.query(
      `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
       VALUES ($1, 'START_MATCH', $2, $3, 'pending')`,
      [
        clubId,
        dmMatchId,
        JSON.stringify({
          map_name: normalizedMap,
          match_format: matchFormat,
          config_url: configUrl,
          auth_token: `secret_${cleanMatchId}`,
          agent_id: allocation.agentId,
        }),
      ]
    );

    broadcastSseCommand(clubId, {
      type: "START_MATCH",
      match_id: dmMatchId,
      map_name: normalizedMap,
      match_format: matchFormat,
      config_url: configUrl,
      auth_token: `secret_${cleanMatchId}`,
      agent_id: allocation.agentId,
    });

    // Notify match lobby & tournament subscribers
    await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(cleanMatchId)]).catch(() => {});
    if (matchData.tournament_id) {
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(matchData.tournament_id)]).catch(() => {});
    }

    return {
      status: "starting",
      serverIp: allocation.serverIp,
      port: allocation.port,
      connectCommand: `connect ${allocation.serverIp}:${allocation.port}`,
    };
  } else {
    // 2. Slots are full: Put match in queue (WAITING_SERVER)
    await client.query(
      `INSERT INTO club_cs2_matches (
        id, club_id, map_name, match_format, team1_name, team2_name,
        status, port, server_ip, agent_id, matchzy_id, config_data,
        rcon_last_command, rcon_last_response, score1, score2, game_state, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'waiting_server', 0, '', 'default', $7, $8::jsonb, NULL, NULL, 0, 0, 'queue', NOW())
      ON CONFLICT (id) DO UPDATE SET
        map_name = $3,
        match_format = $4,
        team1_name = $5,
        team2_name = $6,
        status = 'waiting_server',
        game_state = 'queue',
        updated_at = NOW()`,
      [
        dmMatchId,
        clubId,
        normalizedMap,
        matchFormat,
        nameA,
        nameB,
        matchzyId,
        JSON.stringify({
          knife_round: options?.knifeRound ?? true,
          practice_mode: options?.practiceMode ?? false,
          tournament_match_id: cleanMatchId,
          warmup_time: options?.warmupTime ?? 60,
        }),
      ]
    );

    await client.query(
      `UPDATE tournament_matches
       SET cs2_server_id = $1, status = 'WAITING_SERVER'
       WHERE id = $2`,
      [dmMatchId, cleanMatchId]
    ).catch(() => {});

    // Calculate queue position
    const queueRes = await client.query(
      `SELECT count(*)::int as pos FROM club_cs2_matches 
       WHERE club_id = $1 AND status = 'waiting_server' AND updated_at <= NOW()`,
      [clubId]
    ).catch(() => ({ rows: [{ pos: 1 }] }));
    const queuePosition = queueRes.rows[0]?.pos || 1;

    // Notify match lobby
    await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(cleanMatchId)]).catch(() => {});
    if (matchData.tournament_id) {
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(matchData.tournament_id)]).catch(() => {});
    }

    return {
      status: "waiting_server",
      queuePosition,
      message: "Все серверы клуба сейчас заняты. Матч добавлен в очередь ожидания сервера.",
    };
  }
}

/**
 * Checks if any match is waiting in queue and starts the oldest one when a slot becomes free.
 */
export async function processServerQueue(client: any, clubId: number) {
  try {
    const queuedMatchesRes = await client.query(
      `SELECT id, map_name, match_format, config_data, updated_at
       FROM club_cs2_matches
       WHERE club_id = $1 AND status = 'waiting_server'
       ORDER BY updated_at ASC
       LIMIT 1`,
      [clubId]
    );

    if (queuedMatchesRes.rowCount === 0) return null;

    const queuedMatch = queuedMatchesRes.rows[0];
    const cleanMatchId = String(queuedMatch.id).replace(/^dm-tourney-/, "").replace(/^dm-/, "");
    const cfg = queuedMatch.config_data || {};

    // Attempt launch
    const result = await launchOrQueueMatchServer(
      client,
      clubId,
      cleanMatchId,
      queuedMatch.map_name,
      queuedMatch.match_format,
      {
        knifeRound: cfg.knife_round,
        practiceMode: cfg.practice_mode,
        warmupTime: cfg.warmup_time,
      }
    );

    if (result.status === "starting") {
      console.log(`[CS2 Server Queue] Successfully launched queued match ${cleanMatchId} on port ${result.port}!`);
    }

    return result;
  } catch (err) {
    console.error("[CS2 Server Queue Error]", err);
    return null;
  }
}
