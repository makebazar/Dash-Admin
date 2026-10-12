import { broadcastSseCommand } from "@/lib/cs2/sse";
import { resolveSteamId64 } from "@/lib/steam-resolver";

export async function ensureDotaTables(client: any) {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS club_dota_matches (
        id VARCHAR(64) PRIMARY KEY,
        club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        tournament_match_id BIGINT,
        lobby_id VARCHAR(64),
        game_name VARCHAR(128),
        password VARCHAR(32),
        game_mode VARCHAR(32) DEFAULT 'CM',
        server_region VARCHAR(32) DEFAULT 'STOCKHOLM',
        status VARCHAR(32) DEFAULT 'starting',
        team1_name VARCHAR(64) DEFAULT 'Radiant',
        team2_name VARCHAR(64) DEFAULT 'Dire',
        score1 INT DEFAULT 0,
        score2 INT DEFAULT 0,
        winner VARCHAR(16),
        duration INT DEFAULT 0,
        extra JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_club_dota_matches_tourney ON club_dota_matches(tournament_match_id);
      CREATE INDEX IF NOT EXISTS idx_club_dota_matches_club ON club_dota_matches(club_id);
    `);
  } catch (err) {
    console.warn("[Dota Server Manager] ensureDotaTables warning:", err);
  }
}

/**
 * Extracts Steam IDs (SteamID64 or 32-bit AccountID) for a competitor's roster
 */
async function getCompetitorSteamIds(client: any, competitorId: string | null): Promise<string[]> {
  if (!competitorId) return [];

  const steamIds: string[] = [];

  const compRes = await client.query(
    `SELECT id, type, team_id, promo_team_id, player_id, display_name FROM tournament_competitors WHERE id = $1`,
    [competitorId]
  ).catch(() => ({ rowCount: 0, rows: [] }));

  if (compRes.rowCount === 0) return [];
  const comp = compRes.rows[0];

  if (comp.type === "TEAM") {
    if (comp.promo_team_id) {
      const memRes = await client.query(
        `SELECT p.steam_id, p.id, tm.phone 
         FROM promo_team_members tm
         LEFT JOIN promo_players p ON tm.phone = p.phone_number
         WHERE tm.team_id = $1`,
        [comp.promo_team_id]
      ).catch(() => ({ rows: [] }));

      for (const row of memRes.rows) {
        if (row.steam_id) {
          steamIds.push(String(row.steam_id).trim());
        }
      }
    } else if (comp.team_id) {
      const memRes = await client.query(
        `SELECT p.steam_id 
         FROM team_members tm
         JOIN promo_players p ON tm.player_id = p.id
         WHERE tm.team_id = $1`,
        [comp.team_id]
      ).catch(() => ({ rows: [] }));

      for (const row of memRes.rows) {
        if (row.steam_id) {
          steamIds.push(String(row.steam_id).trim());
        }
      }
    }
  } else {
    // Solo player
    const pid = comp.player_id || comp.id;
    const playerRes = await client.query(
      `SELECT steam_id FROM promo_players WHERE id::text = $1 OR phone_number = $1`,
      [String(pid)]
    ).catch(() => ({ rows: [] }));

    if (playerRes.rows[0]?.steam_id) {
      steamIds.push(String(playerRes.rows[0].steam_id).trim());
    }
  }

  return steamIds;
}

export interface LaunchDotaMatchOptions {
  gameMode?: string;
  serverRegion?: string;
  password?: string;
  gameName?: string;
}

/**
 * Initiates Dota 2 Practice Lobby creation on DashMatch bot via SSE
 */
export async function launchDotaMatch(
  client: any,
  clubId: number,
  matchId: string | number,
  options?: LaunchDotaMatchOptions
) {
  await ensureDotaTables(client);

  const cleanMatchId = String(matchId).replace(/^dm-dota-/, "").replace(/^dm-tourney-/, "").replace(/^dm-/, "");
  const dmMatchId = `dm-dota-${cleanMatchId}`;

  // 1. Fetch match and tournament details
  const matchRes = await client.query(
    `SELECT m.id, m.competitor_a_id, m.competitor_b_id, m.tournament_id,
            t.name as tournament_name, t.type as tournament_type, t.config as tournament_config,
            ca.display_name as name_a, cb.display_name as name_b
     FROM tournament_matches m
     LEFT JOIN club_tournaments t ON m.tournament_id = t.id
     LEFT JOIN tournament_competitors ca ON m.competitor_a_id = ca.id
     LEFT JOIN tournament_competitors cb ON m.competitor_b_id = cb.id
     WHERE m.id = $1`,
    [cleanMatchId]
  ).catch(() => ({ rows: [] }));

  if (matchRes.rows.length === 0) {
    throw new Error(`Матч #${cleanMatchId} не найден`);
  }

  const matchData = matchRes.rows[0];
  const nameA = matchData.name_a || "Radiant";
  const nameB = matchData.name_b || "Dire";

  // 2. Resolve roster steam IDs
  const radiantSteamIds = await getCompetitorSteamIds(client, matchData.competitor_a_id);
  const direSteamIds = await getCompetitorSteamIds(client, matchData.competitor_b_id);

  // 3. Resolve Game Mode & Server Region
  const tConfig = matchData.tournament_config || {};
  const tSettings = tConfig.settings || tConfig;
  const tourneyType = String(matchData.tournament_type || "").toLowerCase();

  let resolvedGameMode = options?.gameMode || tSettings.gameMode || "CM";
  if (tourneyType === "1vs1" || tourneyType === "solo") {
    resolvedGameMode = "1V1MID";
  }

  const resolvedRegion = options?.serverRegion || tSettings.serverRegion || "STOCKHOLM";
  const gameName = options?.gameName || `DashMatch #${cleanMatchId}`;
  const password = options?.password || String(Math.floor(1000 + Math.random() * 9000));

  // 4. Save into club_dota_matches
  await client.query(
    `INSERT INTO club_dota_matches (
      id, club_id, tournament_match_id, game_name, password, game_mode, server_region,
      status, team1_name, team2_name, score1, score2, extra, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'starting', $8, $9, 0, 0, $10::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET
      game_name = $4,
      password = $5,
      game_mode = $6,
      server_region = $7,
      status = 'starting',
      team1_name = $8,
      team2_name = $9,
      extra = $10::jsonb,
      updated_at = NOW()`,
    [
      dmMatchId,
      clubId,
      cleanMatchId,
      gameName,
      password,
      resolvedGameMode,
      resolvedRegion,
      nameA,
      nameB,
      JSON.stringify({
        radiant: radiantSteamIds,
        dire: direSteamIds,
        tournament_id: matchData.tournament_id,
        tournament_name: matchData.tournament_name,
      }),
    ]
  );

  // 5. Update tournament_matches status and lobby credentials
  const dotaLobbyInfo = {
    game_name: gameName,
    password: password,
    game_mode: resolvedGameMode,
    server_region: resolvedRegion,
    radiant_steam_ids: radiantSteamIds,
    dire_steam_ids: direSteamIds,
    status: "starting",
  };

  await client.query(
    `UPDATE tournament_matches
     SET cs2_server_id = $1, status = 'STARTING',
         result = jsonb_set(COALESCE(result, '{}'::jsonb), '{dota_lobby}', $2::jsonb)
     WHERE id = $3`,
    [dmMatchId, JSON.stringify(dotaLobbyInfo), cleanMatchId]
  ).catch(() => {});

  // 6. Broadcast SSE command to DashMatch agent on club PC
  const ssePayload = {
    type: "START_DOTA_MATCH",
    match_id: String(cleanMatchId),
    payload: {
      game_name: gameName,
      password: password,
      game_mode: resolvedGameMode,
      server_region: resolvedRegion,
      radiant: radiantSteamIds,
      dire: direSteamIds,
    },
  };

  const delivered = broadcastSseCommand(clubId, ssePayload);

  // 7. Real-time PostgreSQL NOTIFY for UI updates
  await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(cleanMatchId)]).catch(() => {});
  if (matchData.tournament_id) {
    await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(matchData.tournament_id)]).catch(() => {});
  }

  return {
    success: true,
    status: "starting",
    delivered,
    gameName,
    password,
    gameMode: resolvedGameMode,
    serverRegion: resolvedRegion,
  };
}

/**
 * Commands DashMatch bot to launch the game inside practice lobby
 */
export async function launchDotaGameInLobby(client: any, clubId: number, matchId: string | number) {
  const cleanMatchId = String(matchId).replace(/^dm-dota-/, "").replace(/^dm-tourney-/, "").replace(/^dm-/, "");
  const dmMatchId = `dm-dota-${cleanMatchId}`;

  await client.query(
    `UPDATE club_dota_matches SET status = 'live', updated_at = NOW() WHERE (id = $1 OR tournament_match_id = $2) AND club_id = $3`,
    [dmMatchId, cleanMatchId, clubId]
  ).catch(() => {});

  await client.query(
    `UPDATE tournament_matches SET status = 'LIVE' WHERE id = $1`,
    [cleanMatchId]
  ).catch(() => {});

  broadcastSseCommand(clubId, {
    type: "LAUNCH_DOTA_MATCH",
    match_id: String(cleanMatchId),
  });

  await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(cleanMatchId)]).catch(() => {});
}

/**
 * Commands DashMatch bot to destroy/leave current Dota practice lobby
 */
export async function stopDotaMatch(client: any, clubId: number, matchId: string | number) {
  const cleanMatchId = String(matchId).replace(/^dm-dota-/, "").replace(/^dm-tourney-/, "").replace(/^dm-/, "");
  const dmMatchId = `dm-dota-${cleanMatchId}`;

  await client.query(
    `UPDATE club_dota_matches SET status = 'stopped', updated_at = NOW() WHERE (id = $1 OR tournament_match_id = $2) AND club_id = $3`,
    [dmMatchId, cleanMatchId, clubId]
  ).catch(() => {});

  await client.query(
    `UPDATE tournament_matches SET status = 'PENDING' WHERE id = $1 AND status != 'FINISHED'`,
    [cleanMatchId]
  ).catch(() => {});

  broadcastSseCommand(clubId, {
    type: "STOP_DOTA_MATCH",
    match_id: String(cleanMatchId),
  });

  await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(cleanMatchId)]).catch(() => {});
}
