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
      ALTER TABLE club_dota_matches ADD COLUMN IF NOT EXISTS bot_id VARCHAR(64);
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
  flipSides?: boolean;
  botId?: string;
  keepBot?: boolean;
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
    `SELECT m.id, m.competitor_a_id, m.competitor_b_id, m.tournament_id, m.result,
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
  const nameA = matchData.name_a || "Команда 1";
  const nameB = matchData.name_b || "Команда 2";

  // Determine flipped status
  const isFlipped = options?.flipSides !== undefined
    ? Boolean(options.flipSides)
    : Boolean(matchData.result?.dota_lobby?.flipped);

  const radiantCompId = isFlipped ? matchData.competitor_b_id : matchData.competitor_a_id;
  const direCompId = isFlipped ? matchData.competitor_a_id : matchData.competitor_b_id;
  const radiantName = isFlipped ? nameB : nameA;
  const direName = isFlipped ? nameA : nameB;

  // 2. Resolve roster steam IDs
  const radiantSteamIds = await getCompetitorSteamIds(client, radiantCompId);
  const direSteamIds = await getCompetitorSteamIds(client, direCompId);

  // 3. Resolve Game Mode & Server Region
  const tConfig = matchData.tournament_config || {};
  const tSettings = tConfig.settings || tConfig;
  const tourneyType = String(matchData.tournament_type || tConfig.type || tSettings.type || "").toLowerCase().trim();
  const is1v1 =
    tourneyType === "1vs1" ||
    tourneyType === "1v1" ||
    tourneyType === "solo" ||
    tourneyType.includes("1v1") ||
    tourneyType.includes("1vs1") ||
    tourneyType.includes("solo") ||
    tourneyType.includes("1на1") ||
    tourneyType.includes("1x1");

  const rawMode = String(options?.gameMode || tSettings.gameMode || tConfig.gameMode || "").toUpperCase().trim();
  let resolvedGameMode = "CM";

  if (
    is1v1 ||
    rawMode === "1V1" ||
    rawMode === "1V1MID" ||
    rawMode === "1VS1" ||
    rawMode === "MID_ONLY" ||
    rawMode.includes("1V1") ||
    rawMode.includes("1VS1") ||
    rawMode.includes("1X1") ||
    rawMode.includes("SOLO")
  ) {
    resolvedGameMode = "1V1MID";
  } else if (rawMode === "AP" || rawMode === "ALL_PICK" || rawMode === "ALLPICK") {
    resolvedGameMode = "AP";
  } else if (rawMode === "TURBO") {
    resolvedGameMode = "TURBO";
  } else if (rawMode === "CD" || rawMode === "CAPTAINS_DRAFT") {
    resolvedGameMode = "CD";
  } else if (rawMode === "RD" || rawMode === "RANDOM_DRAFT") {
    resolvedGameMode = "RD";
  } else {
    resolvedGameMode = "CM";
  }
  const resolvedRegion = options?.serverRegion || tSettings.serverRegion || "Stockholm";

  const existingGames = Array.isArray(matchData.result?.dota_games) ? matchData.result.dota_games : [];
  const nextGameNum = existingGames.length + 1;
  const defaultGameName = existingGames.length > 0
    ? `DashMatch #${cleanMatchId} (Игра ${nextGameNum})`
    : `DashMatch #${cleanMatchId}`;
  const gameName = options?.gameName || defaultGameName;
  const password = options?.password || String(Math.floor(1000 + Math.random() * 9000));
  const seriesScore1 = matchData.score1 ?? matchData.result?.series_score1 ?? 0;
  const seriesScore2 = matchData.score2 ?? matchData.result?.series_score2 ?? 0;

  const resolvedFormat = String(matchData.tournament_config?.matchFormat || matchData.tournament_type || "bo1").toLowerCase();
  const numGames = resolvedFormat === "bo5" ? 5 : (resolvedFormat === "bo3" ? 3 : 1);
  const winsNeeded = Math.ceil(numGames / 2);
  const assignedBotId = options?.botId || matchData.result?.dota_lobby?.bot_id || null;
  const keepBot = options?.keepBot !== undefined ? Boolean(options.keepBot) : Boolean(assignedBotId || numGames > 1);

  // 4. Save into club_dota_matches
  await client.query(
    `INSERT INTO club_dota_matches (
      id, club_id, tournament_match_id, game_name, password, game_mode, server_region,
      status, team1_name, team2_name, score1, score2, bot_id, extra, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'starting', $8, $9, $11, $12, $13, $10::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET
      game_name = $4,
      password = $5,
      game_mode = $6,
      server_region = $7,
      status = 'starting',
      team1_name = $8,
      team2_name = $9,
      score1 = $11,
      score2 = $12,
      bot_id = COALESCE($13, club_dota_matches.bot_id),
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
      radiantName,
      direName,
      JSON.stringify({
        radiant: radiantSteamIds,
        dire: direSteamIds,
        radiant_name: radiantName,
        dire_name: direName,
        radiant_competitor_id: radiantCompId,
        dire_competitor_id: direCompId,
        flipped: isFlipped,
        game_number: nextGameNum,
        series_format: resolvedFormat,
        wins_needed: winsNeeded,
        bot_id: assignedBotId,
        keep_bot: keepBot,
        tournament_id: matchData.tournament_id,
        tournament_name: matchData.tournament_name,
      }),
      seriesScore1,
      seriesScore2,
      assignedBotId,
    ]
  );

  // 5. Update tournament_matches status and lobby credentials
  const dotaLobbyInfo = {
    game_name: gameName,
    password: password,
    game_mode: resolvedGameMode,
    server_region: resolvedRegion,
    radiant_name: radiantName,
    dire_name: direName,
    radiant_competitor_id: radiantCompId,
    dire_competitor_id: direCompId,
    radiant_steam_ids: radiantSteamIds,
    dire_steam_ids: direSteamIds,
    flipped: isFlipped,
    game_number: nextGameNum,
    series_format: resolvedFormat,
    wins_needed: winsNeeded,
    bot_id: assignedBotId,
    keep_bot: keepBot,
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
      radiant_name: radiantName,
      dire_name: direName,
      flipped: isFlipped,
      series_format: resolvedFormat,
      game_number: nextGameNum,
      series_score1: seriesScore1,
      series_score2: seriesScore2,
      wins_needed: winsNeeded,
      bot_id: assignedBotId,
      keep_bot: keepBot,
      is_series_finished: false,
      tournament_match_id: cleanMatchId,
      club_id: clubId,
    },
  };

  const delivered = broadcastSseCommand(clubId, ssePayload);

  // Fallback queue in club_cs2_commands
  await client.query(
    `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
     VALUES ($1, 'START_DOTA_MATCH', $2, $3::jsonb, 'pending')`,
    [clubId, cleanMatchId, JSON.stringify(ssePayload.payload)]
  ).catch(() => {});

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
    radiantName,
    direName,
    flipped: isFlipped,
  };
}

/**
 * Swaps Radiant and Dire sides for an existing or scheduled Dota 2 match lobby
 */
export async function flipDotaTeams(
  client: any,
  clubId: number,
  matchId: string | number
) {
  const cleanMatchId = String(matchId).replace(/^dm-dota-/, "").replace(/^dm-tourney-/, "").replace(/^dm-/, "");
  const dmMatchId = `dm-dota-${cleanMatchId}`;

  const curRes = await client.query(
    `SELECT m.id, m.competitor_a_id, m.competitor_b_id, m.tournament_id, m.result,
            ca.display_name as name_a, cb.display_name as name_b,
            cdm.team1_name, cdm.team2_name, cdm.extra
     FROM tournament_matches m
     LEFT JOIN tournament_competitors ca ON m.competitor_a_id = ca.id
     LEFT JOIN tournament_competitors cb ON m.competitor_b_id = cb.id
     LEFT JOIN club_dota_matches cdm ON (cdm.id = $1 OR cdm.tournament_match_id = $2)
     WHERE m.id = $2`,
    [dmMatchId, cleanMatchId]
  ).catch(() => ({ rows: [] }));

  if (curRes.rows.length === 0) {
    throw new Error(`Матч #${cleanMatchId} не найден`);
  }

  const row = curRes.rows[0];
  const currentLobby = row.result?.dota_lobby || {};
  const currentExtra = row.extra || {};
  const currentlyFlipped = Boolean(currentLobby.flipped || currentExtra.flipped);
  const nextFlipped = !currentlyFlipped;

  const nameA = row.name_a || "Команда 1";
  const nameB = row.name_b || "Команда 2";

  const radiantCompId = nextFlipped ? row.competitor_b_id : row.competitor_a_id;
  const direCompId = nextFlipped ? row.competitor_a_id : row.competitor_b_id;
  const radiantName = nextFlipped ? nameB : nameA;
  const direName = nextFlipped ? nameA : nameB;

  const radiantSteamIds = await getCompetitorSteamIds(client, radiantCompId);
  const direSteamIds = await getCompetitorSteamIds(client, direCompId);

  // Update club_dota_matches if exists
  const updatedExtra = {
    ...currentExtra,
    radiant: radiantSteamIds,
    dire: direSteamIds,
    radiant_name: radiantName,
    dire_name: direName,
    radiant_competitor_id: radiantCompId,
    dire_competitor_id: direCompId,
    flipped: nextFlipped,
  };

  await client.query(
    `UPDATE club_dota_matches
     SET team1_name = $1, team2_name = $2, extra = $3::jsonb, updated_at = NOW()
     WHERE (id = $4 OR tournament_match_id = $5) AND club_id = $6`,
    [radiantName, direName, JSON.stringify(updatedExtra), dmMatchId, cleanMatchId, clubId]
  ).catch(() => {});

  // Update tournament_matches result
  const updatedLobby = {
    ...currentLobby,
    radiant_name: radiantName,
    dire_name: direName,
    radiant_competitor_id: radiantCompId,
    dire_competitor_id: direCompId,
    radiant_steam_ids: radiantSteamIds,
    dire_steam_ids: direSteamIds,
    flipped: nextFlipped,
  };

  await client.query(
    `UPDATE tournament_matches
     SET result = jsonb_set(COALESCE(result, '{}'::jsonb), '{dota_lobby}', $1::jsonb)
     WHERE id = $2`,
    [JSON.stringify(updatedLobby), cleanMatchId]
  ).catch(() => {});

  // Broadcast command to DashMatch bot via SSE
  const sseCmd = {
    type: "FLIP_DOTA_TEAMS",
    match_id: String(cleanMatchId),
    payload: {
      flipped: nextFlipped,
      radiant: radiantSteamIds,
      dire: direSteamIds,
      radiant_name: radiantName,
      dire_name: direName,
    },
  };
  const delivered = broadcastSseCommand(clubId, sseCmd);

  // Fallback queue in club_cs2_commands
  await client.query(
    `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
     VALUES ($1, 'FLIP_DOTA_TEAMS', $2, $3::jsonb, 'pending')`,
    [clubId, cleanMatchId, JSON.stringify(sseCmd.payload)]
  ).catch(() => {});

  // Notify UI
  await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(cleanMatchId)]).catch(() => {});
  if (row.tournament_id) {
    await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(row.tournament_id)]).catch(() => {});
  }

  return {
    success: true,
    flipped: nextFlipped,
    radiantName,
    direName,
    delivered,
  };
}

/**
 * Resends in-game lobby invites to players (all or specific target player)
 */
export async function resendDotaInvites(
  client: any,
  clubId: number,
  matchId: string | number,
  targetAccountOrSteamId?: string
) {
  const cleanMatchId = String(matchId).replace(/^dm-dota-/, "").replace(/^dm-tourney-/, "").replace(/^dm-/, "");

  let steamIdsToInvite: string[] = [];
  if (targetAccountOrSteamId) {
    steamIdsToInvite = [String(targetAccountOrSteamId).trim()];
  } else {
    // Admin resend: gather all players from match
    const matchRes = await client.query(
      `SELECT competitor_a_id, competitor_b_id FROM tournament_matches WHERE id = $1`,
      [cleanMatchId]
    ).catch(() => ({ rows: [] }));

    if (matchRes.rows.length > 0) {
      const ca = matchRes.rows[0].competitor_a_id;
      const cb = matchRes.rows[0].competitor_b_id;
      const idsA = await getCompetitorSteamIds(client, ca);
      const idsB = await getCompetitorSteamIds(client, cb);
      steamIdsToInvite = Array.from(new Set([...idsA, ...idsB]));
    }
  }

  if (steamIdsToInvite.length === 0) {
    throw new Error("Не найдены Steam ID игроков для отправки приглашения");
  }

  let delivered = false;
  if (steamIdsToInvite.length === 1) {
    const sseCmd = {
      type: "INVITE_DOTA_PLAYER",
      match_id: String(cleanMatchId),
      payload: {
        account_id: steamIdsToInvite[0],
      },
    };
    delivered = broadcastSseCommand(clubId, sseCmd);
    await client.query(
      `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
       VALUES ($1, 'INVITE_DOTA_PLAYER', $2, $3::jsonb, 'pending')`,
      [clubId, cleanMatchId, JSON.stringify(sseCmd.payload)]
    ).catch(() => {});
  } else {
    const sseCmd = {
      type: "INVITE_ALL_DOTA_PLAYERS",
      match_id: String(cleanMatchId),
      payload: {
        players: steamIdsToInvite,
      },
    };
    delivered = broadcastSseCommand(clubId, sseCmd);
    await client.query(
      `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
       VALUES ($1, 'INVITE_ALL_DOTA_PLAYERS', $2, $3::jsonb, 'pending')`,
      [clubId, cleanMatchId, JSON.stringify(sseCmd.payload)]
    ).catch(() => {});
  }

  return {
    success: true,
    delivered,
    invitedCount: steamIdsToInvite.length,
    targets: steamIdsToInvite,
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

  // Find bot_id to release
  const botRes = await client.query(
    `SELECT bot_id FROM club_dota_matches WHERE (id = $1 OR tournament_match_id = $2) AND club_id = $3`,
    [dmMatchId, cleanMatchId, clubId]
  ).catch(() => ({ rows: [] }));
  const botId = botRes.rows[0]?.bot_id || null;

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
    payload: {
      bot_id: botId,
      release_bot: true,
    },
  });

  await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(cleanMatchId)]).catch(() => {});
  await processDotaQueue(client, clubId);
}

/**
 * Informs DashMatch agent that the bot assigned to a match/series is free to be returned to the pool
 */
export async function releaseDotaBot(client: any, clubId: number, matchId: string | number, botId?: string | null) {
  const cleanMatchId = String(matchId).replace(/^dm-dota-/, "").replace(/^dm-tourney-/, "").replace(/^dm-/, "");

  broadcastSseCommand(clubId, {
    type: "RELEASE_DOTA_BOT",
    match_id: String(cleanMatchId),
    payload: {
      match_id: cleanMatchId,
      bot_id: botId || null,
      is_series_finished: true,
    },
  });

  // Check if any other match is queued and can take the freed bot
  await processDotaQueue(client, clubId);
}

/**
 * Checks if any Dota 2 match is waiting in queue and starts the oldest one when a bot becomes free.
 */
export async function processDotaQueue(client: any, clubId: number) {
  try {
    const queuedMatchesRes = await client.query(
      `SELECT cdm.id, cdm.tournament_match_id, cdm.updated_at, cdm.extra
       FROM club_dota_matches cdm
       WHERE cdm.club_id = $1 AND (cdm.status = 'waiting_server' OR cdm.status = 'waiting_bot')
       ORDER BY cdm.updated_at ASC
       LIMIT 1`,
      [clubId]
    );

    if (queuedMatchesRes.rowCount === 0) {
      // Also check tournament_matches with status = 'WAITING_SERVER' for dota2
      const tmRes = await client.query(
        `SELECT m.id, m.tournament_id, m.updated_at
         FROM tournament_matches m
         JOIN club_tournaments t ON m.tournament_id = t.id
         WHERE t.club_id = $1 AND t.discipline = 'dota2' AND m.status = 'WAITING_SERVER'
         ORDER BY m.updated_at ASC
         LIMIT 1`,
        [clubId]
      ).catch(() => ({ rowCount: 0, rows: [] }));

      if (tmRes.rowCount === 0) return null;
      const nextMatchId = tmRes.rows[0].id;
      console.log(`[Dota Server Queue] Auto-launching queued tournament match ${nextMatchId}...`);
      return await launchDotaMatch(client, clubId, nextMatchId);
    }

    const queuedMatch = queuedMatchesRes.rows[0];
    const matchIdToLaunch = queuedMatch.tournament_match_id || queuedMatch.id;
    console.log(`[Dota Server Queue] Auto-launching queued match ${matchIdToLaunch}...`);
    return await launchDotaMatch(client, clubId, matchIdToLaunch);
  } catch (err) {
    console.error("[Dota Server Queue Error]", err);
    return null;
  }
}

