import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { getNumericMatchId, normalizeCS2Map } from "@/lib/cs2/utils";
import { resolveSteamId64 } from "@/lib/steam-resolver";
import { resolveMatchFormat } from "@/lib/brackets";

// Helper to resolve SteamID from raw input or return cleaned SteamID64
async function sanitizeSteamId64(raw?: string | null): Promise<string | null> {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  try {
    const resolved = await resolveSteamId64(trimmed);
    if (resolved && /^\d{17}$/.test(resolved)) {
      return resolved;
    }
    if (/^\d{17}$/.test(trimmed)) {
      return trimmed;
    }
  } catch (err) {
    console.warn(`[MatchZy Config] Failed resolving steamid "${raw}":`, err);
  }
  return null;
}

// Helper to resolve map name into MatchZy compatible map (standard de_ or numeric workshop ID)
async function resolveMapForMatchZy(
  client: any,
  clubId: number,
  rawMap?: string
): Promise<string> {
  if (!rawMap) return "de_dust2";
  const norm = normalizeCS2Map(rawMap);
  if (/^\d+$/.test(norm) || norm.startsWith("de_") || norm.startsWith("cs_") || norm.startsWith("ar_")) {
    return norm;
  }
  const customRes = await client.query(
    `SELECT map_id FROM club_cs2_custom_maps WHERE club_id = $1 AND (name ILIKE $2 OR map_id = $3) LIMIT 1`,
    [clubId, rawMap.trim(), rawMap.trim()]
  ).catch(() => ({ rows: [] }));

  if (customRes.rows.length > 0) {
    return customRes.rows[0].map_id;
  }
  return norm;
}

// Helper to fetch roster for competitor
async function fetchCompetitorRoster(
  client: any,
  competitorId: string | number | null,
  fallbackName: string,
  matchId?: string | number | null
) {
  if (!competitorId) {
    return { name: fallbackName, players: {} as Record<string, string> };
  }

  const compRes = await client.query(
    `SELECT c.id, c.type, c.display_name, c.team_id, c.promo_team_id, c.player_id, c.meta
     FROM tournament_competitors c
     WHERE c.id = $1`,
    [competitorId]
  );

  if (compRes.rowCount === 0) {
    return { name: fallbackName, players: {} as Record<string, string> };
  }

  const comp = compRes.rows[0];
  const playersMap: Record<string, string> = {};
  const memberIdentifiers: Set<string> = new Set();

  if (comp.promo_team_id) {
    const membersRes = await client.query(
      `SELECT p.id::text as player_id, p.steam_id, p.steam_link, COALESCE(p.nickname, p.full_name, tm.phone) as full_name, tm.phone as phone_number
       FROM promo_team_members tm
       LEFT JOIN promo_players p ON (tm.phone = p.phone_number OR tm.phone = p.id::text)
       WHERE tm.team_id = $1`,
      [comp.promo_team_id]
    );
    for (const m of membersRes.rows) {
      if (m.player_id) memberIdentifiers.add(String(m.player_id));
      if (m.phone_number) memberIdentifiers.add(String(m.phone_number));
      const rawSteam = m.steam_id || m.steam_link;
      if (rawSteam) {
        const steam64 = await sanitizeSteamId64(rawSteam);
        if (steam64) {
          playersMap[steam64] = m.full_name || `Player_${steam64.slice(-4)}`;
        }
      }
    }
  } else if (comp.team_id) {
    const membersRes = await client.query(
      `SELECT p.id::text as player_id, p.steam_id, p.steam_link, COALESCE(p.full_name, p.nickname) as full_name, p.phone_number
       FROM team_members tm
       JOIN promo_players p ON (tm.player_id = p.id OR tm.player_id::text = p.id::text OR tm.player_id::text = p.phone_number)
       WHERE tm.team_id = $1`,
      [comp.team_id]
    );
    for (const m of membersRes.rows) {
      if (m.player_id) memberIdentifiers.add(String(m.player_id));
      if (m.phone_number) memberIdentifiers.add(String(m.phone_number));
      const rawSteam = m.steam_id || m.steam_link;
      if (rawSteam) {
        const steam64 = await sanitizeSteamId64(rawSteam);
        if (steam64) {
          playersMap[steam64] = m.full_name || `Player_${steam64.slice(-4)}`;
        }
      }
    }
  } else {
    // Solo competitor
    const targetPlayerId = comp.player_id || comp.id;
    if (targetPlayerId) {
      memberIdentifiers.add(String(targetPlayerId));
      if (comp.id) memberIdentifiers.add(String(comp.id));
      if (comp.player_id) memberIdentifiers.add(String(comp.player_id));

      const playerRes = await client.query(
        `SELECT id::text as player_id, steam_id, steam_link, COALESCE(nickname, full_name) as full_name, phone_number
         FROM promo_players 
         WHERE id::text = $1 OR phone_number = $1`,
        [String(targetPlayerId)]
      );
      if (playerRes.rows.length > 0) {
        const p = playerRes.rows[0];
        if (p.player_id) memberIdentifiers.add(String(p.player_id));
        if (p.phone_number) memberIdentifiers.add(String(p.phone_number));
        const rawSteam = p.steam_id || p.steam_link;
        if (rawSteam) {
          const steam64 = await sanitizeSteamId64(rawSteam);
          if (steam64) {
            playersMap[steam64] = p.full_name || `Player_${steam64.slice(-4)}`;
          }
        }
      }
    }
  }

  // Also query lobby_checkin to include players who checked in with their latest steam_id
  if (matchId) {
    const cleanMatchId = String(matchId).replace(/^dm-tourney-/, "").replace(/^dm-/, "");
    const checkinsRes = await client.query(
      `SELECT c.player_id, p.id as promo_id, p.steam_id, p.steam_link, COALESCE(p.nickname, p.full_name) as full_name, p.phone_number
       FROM lobby_checkin c
       JOIN promo_players p ON (c.player_id = p.id OR c.player_id::text = p.id::text OR c.player_id::text = p.phone_number)
       WHERE (c.match_id::text = $1 OR c.match_id::text = $2) AND c.is_ready = true`,
      [String(matchId), cleanMatchId]
    ).catch(() => ({ rows: [] }));

    for (const chk of checkinsRes.rows) {
      const pId = String(chk.player_id);
      const promoId = chk.promo_id ? String(chk.promo_id) : "";
      const phone = String(chk.phone_number || "");
      if (
        memberIdentifiers.has(pId) || 
        (promoId && memberIdentifiers.has(promoId)) || 
        (phone && memberIdentifiers.has(phone))
      ) {
        const rawSteam = chk.steam_id || chk.steam_link;
        if (rawSteam) {
          const steam64 = await sanitizeSteamId64(rawSteam);
          if (steam64) {
            playersMap[steam64] = chk.full_name || `Player_${steam64.slice(-4)}`;
          }
        }
      }
    }
  }

  return {
    name: comp.display_name || fallbackName,
    players: playersMap,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string; matchId: string }> }
) {
  const client = await getClient();
  try {
    const { clubId, matchId } = await params;
    const parsedClubId = parseInt(clubId, 10);
    const cleanMatchId = String(matchId).replace(/^dm-tourney-/, "").replace(/^dm-/, "");

    // 1. Check if there's an instance in club_cs2_matches
    const quickRes = await client.query(
      `SELECT * FROM club_cs2_matches 
       WHERE (id = $1 OR id = $2 OR (config_data->>'tournament_match_id') = $3) AND club_id = $4`,
      [matchId, `dm-tourney-${cleanMatchId}`, cleanMatchId, parsedClubId]
    ).catch(() => ({ rowCount: 0, rows: [] }));

    const qm = quickRes.rowCount && quickRes.rowCount > 0 ? quickRes.rows[0] : null;
    const isTourney = Boolean(
      qm?.config_data?.tournament_match_id ||
      String(matchId).startsWith("dm-tourney-") ||
      /^\d+$/.test(cleanMatchId)
    );

    // 2. If this is a tournament match, fetch tournament details & rosters
    if (isTourney) {
      const tourneyMatchId = qm?.config_data?.tournament_match_id || cleanMatchId;
      const matchRes = await client.query(
        `SELECT m.id, m.tournament_id, m.competitor_a_id, m.competitor_b_id, m.round, m.order_in_round, m.result,
                t.name as tournament_name, t.type as tournament_type, t.config as tournament_config
         FROM tournament_matches m
         JOIN club_tournaments t ON m.tournament_id = t.id
         WHERE (m.id::text = $1 OR m.id::text = $2) AND t.club_id = $3`,
        [matchId, String(tourneyMatchId), parsedClubId]
      );

      if (matchRes.rowCount && matchRes.rowCount > 0) {
        const match = matchRes.rows[0];

        const team1 = await fetchCompetitorRoster(
          client,
          match.competitor_a_id,
          qm?.team1_name || "Команда 1",
          tourneyMatchId
        );
        const team2 = await fetchCompetitorRoster(
          client,
          match.competitor_b_id,
          qm?.team2_name || "Команда 2",
          tourneyMatchId
        );

        // Merge any pre-saved players from qm.config_data
        if (qm?.config_data?.team1_players) {
          for (const [rawSteam, name] of Object.entries(qm.config_data.team1_players)) {
            const steam64 = await sanitizeSteamId64(rawSteam);
            if (steam64) team1.players[steam64] = String(name);
          }
        }
        if (qm?.config_data?.team2_players) {
          for (const [rawSteam, name] of Object.entries(qm.config_data.team2_players)) {
            const steam64 = await sanitizeSteamId64(rawSteam);
            if (steam64) team2.players[steam64] = String(name);
          }
        }

        // Check if veto selected map exists
        const vetoRes = await client.query(
          `SELECT selected_map FROM match_veto WHERE match_id = $1`,
          [match.id]
        ).catch(() => ({ rows: [] }));
        const vetoSelectedMap = vetoRes.rows[0]?.selected_map;

        const tConfig = match.tournament_config || {};
        const defaultPool =
          match.tournament_type === "1vs1" || qm?.match_format === "1v1"
            ? ["aim_redline", "aim_map", "awp_lego_2", "aim_ak47", "aim_headshot", "aim_dust2", "aim_pistol_cs2"]
            : match.tournament_type === "2vs2" || match.tournament_type === "mix_2vs2" || qm?.match_format === "2v2"
            ? ["de_inferno", "de_vertigo", "de_nuke", "de_overpass", "de_anubis", "de_mirage", "de_dust2"]
            : ["de_mirage", "de_dust2", "de_inferno", "de_nuke", "de_anubis", "de_ancient", "de_vertigo"];
        const fullMapPool = (tConfig.mapPool && tConfig.mapPool.length > 0) ? tConfig.mapPool : defaultPool;

        const resolvedFormat = resolveMatchFormat(tConfig, match.round, undefined, match.result);
        const requiredMaps = resolvedFormat === "bo5" ? 5 : (resolvedFormat === "bo3" ? 3 : 1);

        let mapList: string[] = [];
        if (vetoSelectedMap) {
          mapList = vetoSelectedMap.split(",").map((s: string) => s.trim()).filter(Boolean);
        } else if (qm?.map_name) {
          mapList = [qm.map_name];
        }

        // Fill up to requiredMaps from fullMapPool if fewer maps were selected
        if (mapList.length < requiredMaps) {
          for (const m of fullMapPool) {
            if (!mapList.includes(m)) {
              mapList.push(m);
            }
            if (mapList.length >= requiredMaps) break;
          }
        }

        const safeNumMaps = Math.max(1, requiredMaps);
        const rawFinalMapList = mapList.slice(0, safeNumMaps);
        const finalMapList = await Promise.all(
          rawFinalMapList.map((m) => resolveMapForMatchZy(client, parsedClubId, m))
        );

        const isWingman =
          match.tournament_type === "2vs2" ||
          match.tournament_type === "mix_2vs2" ||
          match.tournament_type === "1vs1" ||
          qm?.match_format === "2v2" ||
          qm?.match_format === "1v1";

        const defaultPlayersPerTeam =
          match.tournament_type === "1vs1" || qm?.match_format === "1v1"
            ? 1
            : match.tournament_type === "2vs2" || match.tournament_type === "mix_2vs2" || qm?.match_format === "2v2"
            ? 2
            : 5;

        const rosterCount = Math.max(Object.keys(team1.players).length, Object.keys(team2.players).length);
        const playersPerTeam = rosterCount > 0 ? rosterCount : defaultPlayersPerTeam;
        const team1HasPlayers = Object.keys(team1.players).length > 0;
        const team2HasPlayers = Object.keys(team2.players).length > 0;
        const bothTeamsHavePlayers = team1HasPlayers && team2HasPlayers;
        const numericMatchId = qm?.matchzy_id ? parseInt(qm.matchzy_id, 10) : getNumericMatchId(String(tourneyMatchId));

        const matchZyConfig = {
          matchid: numericMatchId,
          num_maps: safeNumMaps,
          maplist: finalMapList,
          map_sides: Array(safeNumMaps).fill("knife"),
          side_type: "always_knife",
          clinch_series: true,
          players_per_team: playersPerTeam,
          min_players_to_ready: 1,
          min_spectators_to_ready: 0,
          skip_veto: true,
          wingman: isWingman,
          team1: {
            name: team1.name,
            players: team1.players,
          },
          team2: {
            name: team2.name,
            players: team2.players,
          },
          cvars: {
            hostname: `DashAdmin: ${team1.name} vs ${team2.name}`,
            mp_friendlyfire: "0",
            mp_warmuptime: "60",
            matchzy_chat_prefix: "[{LightBlue}DashMatch{Default}]",
            matchzy_admin_chat_prefix: "[{Red}DashAdmin{Default}]",
            matchzy_remote_log_url: `http://127.0.0.1:8080/events`,
            matchzy_knife_enabled_default: "true",
            matchzy_time_to_start: "0",
            matchzy_kick_when_no_match_loaded: "false",
            matchzy_whitelist_enabled_default: "false",
            matchzy_ready_mode: bothTeamsHavePlayers ? "1" : "0",
            matchzy_minimum_ready_required: "1",
            matchzy_allow_force_ready: "true",
            matchzy_join_start_delay: "10",
            matchzy_pause_after_restore: "true",
          },
        };

        return NextResponse.json(matchZyConfig);
      }
    }


    // 3. Quick Match handler (standalone DashMatch)
    if (qm) {
      const cfg = qm.config_data || {};
      const knifeRound = cfg.knife_round ?? true;
      const practiceMode = cfg.practice_mode ?? false;
      const friendlyFire = cfg.friendly_fire ?? false;
      const warmupTime = typeof cfg.warmup_time === "number" ? cfg.warmup_time : 60;

      const rawTeam1 = cfg.team1_players || {};
      const rawTeam2 = cfg.team2_players || {};
      const team1Players: Record<string, string> = {};
      const team2Players: Record<string, string> = {};

      for (const [rawSteam, name] of Object.entries(rawTeam1)) {
        const steam64 = await sanitizeSteamId64(rawSteam);
        if (steam64) team1Players[steam64] = String(name);
      }
      for (const [rawSteam, name] of Object.entries(rawTeam2)) {
        const steam64 = await sanitizeSteamId64(rawSteam);
        if (steam64) team2Players[steam64] = String(name);
      }

      const hasPlayers = Object.keys(team1Players).length > 0 || Object.keys(team2Players).length > 0;
      const numericMatchId = qm.matchzy_id ? parseInt(qm.matchzy_id, 10) : getNumericMatchId(matchId);
      const isWingman = qm.match_format === "2v2" || qm.match_format === "1v1";
      const defaultPlayers = qm.match_format === "1v1" ? 1 : qm.match_format === "2v2" ? 2 : 5;
      const rosterCount = Math.max(Object.keys(team1Players).length, Object.keys(team2Players).length);
      const playersPerTeam = rosterCount > 0 ? rosterCount : defaultPlayers;
      const matchMap = await resolveMapForMatchZy(client, parsedClubId, qm.map_name);

      const matchZyConfig = {
        matchid: numericMatchId,
        num_maps: 1,
        maplist: [matchMap],
        map_sides: knifeRound && !practiceMode ? ["knife"] : ["team1_ct"],
        side_type: knifeRound && !practiceMode ? "always_knife" : "never_knife",
        clinch_series: true,
        players_per_team: playersPerTeam,
        min_players_to_ready: playersPerTeam,
        min_spectators_to_ready: 0,
        skip_veto: true,
        wingman: isWingman,
        team1: {
          name: qm.team1_name || "Команда 1",
          players: team1Players,
        },
        team2: {
          name: qm.team2_name || "Команда 2",
          players: team2Players,
        },
        cvars: {
          hostname: `DashMatch: ${qm.team1_name || "Команда 1"} vs ${qm.team2_name || "Команда 2"}`,
          mp_friendlyfire: friendlyFire ? "1" : "0",
          mp_warmuptime: warmupTime > 0 ? String(warmupTime) : "9999",
          mp_warmup_pausetimer: warmupTime === 0 ? "1" : "0",
          matchzy_time_to_start: "0",
          matchzy_chat_prefix: "[{LightBlue}DashMatch{Default}]",
          matchzy_admin_chat_prefix: "[{Red}DashAdmin{Default}]",
          matchzy_remote_log_url: `http://127.0.0.1:8080/events`,
          matchzy_knife_enabled_default: knifeRound && !practiceMode ? "true" : "false",
          matchzy_minimum_ready_required: "1",
          matchzy_allow_force_ready: "true",
          matchzy_ready_mode: hasPlayers ? "1" : "0",
          matchzy_join_start_delay: "10",
          matchzy_whitelist_enabled_default: "false",
          matchzy_kick_when_no_match_loaded: "false",
          matchzy_autostart_mode: practiceMode ? "2" : "1",
          matchzy_pause_after_restore: "true",
        },
      };
      return NextResponse.json(matchZyConfig);
    }

    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  } catch (error) {
    console.error("MatchZy Config Generation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
