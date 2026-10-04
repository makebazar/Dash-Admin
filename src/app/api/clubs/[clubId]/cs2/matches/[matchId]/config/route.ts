import { NextResponse } from "next/server";
import { getClient } from "@/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string; matchId: string }> }
) {
  const client = await getClient();
  try {
    const { clubId, matchId } = await params;
    const parsedClubId = parseInt(clubId);

    // 1. Check quick match in club_cs2_matches
    const quickRes = await client.query(
      `SELECT * FROM club_cs2_matches WHERE id = $1 AND club_id = $2`,
      [matchId, parsedClubId]
    ).catch(() => ({ rowCount: 0, rows: [] }));

    if (quickRes.rowCount && quickRes.rowCount > 0) {
      const qm = quickRes.rows[0];
      const cfg = qm.config_data || {};
      const knifeRound = cfg.knife_round ?? true;
      const practiceMode = cfg.practice_mode ?? false;
      const friendlyFire = cfg.friendly_fire ?? false;
      const team1Players = cfg.team1_players || {};
      const team2Players = cfg.team2_players || {};
      const hasPlayers = Object.keys(team1Players).length > 0 || Object.keys(team2Players).length > 0;

      const matchZyConfig = {
        matchid: matchId,
        num_maps: 1,
        maplist: [qm.map_name || "de_dust2"],
        map_sides: knifeRound && !practiceMode ? ["knife"] : ["team1_ct"],
        clinch_series: true,
        players_per_team: qm.match_format === "1v1" ? 1 : qm.match_format === "2v2" ? 2 : 5,
        skip_veto: true,
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
          matchzy_remote_log_url: `http://127.0.0.1:8080/events`,
          matchzy_knife_enabled_default: knifeRound && !practiceMode ? "true" : "false",
          matchzy_allow_force_ready: "true",
          matchzy_whitelist_enabled_default: hasPlayers ? "true" : "false",
          matchzy_autostart_mode: practiceMode ? "2" : "1",
        },
      };
      return NextResponse.json(matchZyConfig);
    }

    // 2. Fetch tournament match details
    const matchRes = await client.query(
      `SELECT m.id, m.tournament_id, m.competitor_a_id, m.competitor_b_id,
              t.name as tournament_name, t.config as tournament_config
       FROM tournament_matches m
       JOIN club_tournaments t ON m.tournament_id = t.id
       WHERE m.id = $1 AND t.club_id = $2`,
      [matchId, parsedClubId]
    );

    if (matchRes.rowCount === 0) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const match = matchRes.rows[0];

    // Helper to fetch roster for competitor
    const fetchCompetitorRoster = async (competitorId: string | null, fallbackName: string) => {
      if (!competitorId) {
        return { name: fallbackName, players: {} };
      }

      const compRes = await client.query(
        `SELECT c.type, c.display_name, c.team_id, c.player_id
         FROM tournament_competitors c
         WHERE c.id = $1`,
        [competitorId]
      );

      if (compRes.rowCount === 0) {
        return { name: fallbackName, players: {} };
      }

      const comp = compRes.rows[0];
      const playersMap: Record<string, string> = {};

      if (comp.type === "TEAM" && comp.team_id) {
        const membersRes = await client.query(
          `SELECT p.steam_id, p.full_name
           FROM team_members tm
           JOIN promo_players p ON tm.player_id = p.id
           WHERE tm.team_id = $1`,
          [comp.team_id]
        );
        for (const m of membersRes.rows) {
          if (m.steam_id) {
            playersMap[m.steam_id] = m.full_name;
          }
        }
      } else if (comp.player_id) {
        const playerRes = await client.query(
          `SELECT steam_id, full_name FROM promo_players WHERE id = $1`,
          [comp.player_id]
        );
        if (playerRes.rows.length > 0 && playerRes.rows[0].steam_id) {
          playersMap[playerRes.rows[0].steam_id] = playerRes.rows[0].full_name;
        }
      }

      return {
        name: comp.display_name || fallbackName,
        players: playersMap,
      };
    };

    const team1 = await fetchCompetitorRoster(match.competitor_a_id, "Team 1");
    const team2 = await fetchCompetitorRoster(match.competitor_b_id, "Team 2");

    const tConfig = match.tournament_config || {};
    const mapPool = tConfig.mapPool || ["de_mirage", "de_dust2", "de_inferno"];
    const numMaps = tConfig.numMaps || 1;

    // Build MatchZy/Get5 compatible match config
    const matchZyConfig = {
      matchid: matchId,
      num_maps: numMaps,
      maplist: mapPool,
      map_sides: ["knife"],
      clinch_series: true,
      players_per_team: Object.keys(team1.players).length || 5,
      skip_veto: mapPool.length === 1,
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
        matchzy_remote_log_url: `http://127.0.0.1:8080/events`,
      },
    };

    return NextResponse.json(matchZyConfig);
  } catch (error) {
    console.error("MatchZy Config Generation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
