import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const targetPlayerId = resolvedParams.id;
  if (!targetPlayerId) {
    return NextResponse.json({ error: "Player ID is required" }, { status: 400 });
  }

  const client = await getClient();
  try {
    const cookieStore = await cookies();
    const currentPlayerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    // Ensure columns exist in promo_players
    await client.query(`
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS lft_status VARCHAR(30) DEFAULT 'none';
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_elo INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_lvl INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_kd NUMERIC(5,2);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_winrate NUMERIC(5,2);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_matches INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_avatar TEXT;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_rank_tier INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_rank_name VARCHAR(100);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_leaderboard_rank INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_mmr INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_winrate NUMERIC(5,2);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_matches INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_stats JSONB;
    `);

    // 1. Fetch target player base info
    const playerRes = await client.query(
      `SELECT p.id, p.full_name, p.nickname, p.steam_link, p.steam_id, p.faceit_link, p.phone_number, p.created_at,
              p.avatar_url, p.lft_status, p.faceit_lvl, p.faceit_elo, p.faceit_kd, p.faceit_winrate, p.faceit_matches, p.faceit_avatar,
              p.dota_rank_tier, p.dota_rank_name, p.dota_leaderboard_rank, p.dota_mmr, p.dota_winrate, p.dota_matches, p.dota_stats,
              COALESCE(b.total_xp, 0) as total_xp,
              c.name as club_name, c.id as club_id
       FROM promo_players p
       LEFT JOIN promo_player_balances b ON p.id = b.player_id
       LEFT JOIN clubs c ON b.club_id = c.id
       WHERE p.id::text = $1 OR p.phone_number = $1
       ORDER BY b.total_xp DESC
       LIMIT 1`,
      [targetPlayerId]
    );

    if (playerRes.rowCount === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const row = playerRes.rows[0];
    const playerPhone = row.phone_number;

    // 2. Fetch player teams
    let teams: any[] = [];
    if (playerPhone) {
      const teamsRes = await client.query(
        `SELECT t.id, t.name, t.captain_phone, t.created_at,
                tm.role as member_role,
                (SELECT COUNT(*)::int FROM promo_team_members WHERE team_id = t.id) as members_count
         FROM promo_teams t
         JOIN promo_team_members tm ON t.id = tm.team_id
         WHERE tm.phone = $1
         ORDER BY t.created_at DESC`,
        [playerPhone]
      );
      teams = teamsRes.rows.map((t: any) => ({
        id: t.id,
        name: t.name,
        isCaptain: t.captain_phone === playerPhone,
        role: t.member_role || (t.captain_phone === playerPhone ? "captain" : "player"),
        membersCount: t.members_count,
        createdAt: t.created_at,
      }));
    }

    // 3. Fetch Frag Match stats if available
    let fragStats = {
      matchesCount: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      headshots: 0,
      kdRatio: 0,
      cs2Rating: row.faceit_elo || 1000,
    };

    try {
      const fragRes = await client.query(
        `SELECT COUNT(*)::int as matches_count,
                COALESCE(SUM(score), 0)::int as total_score,
                COALESCE(SUM(kills), 0)::int as total_kills,
                COALESCE(SUM(deaths), 0)::int as total_deaths,
                COALESCE(SUM(headshots), 0)::int as total_headshots
         FROM promo_frag_matches
         WHERE player_id = $1`,
        [targetPlayerId]
      );

      if (fragRes.rowCount && fragRes.rows[0] && fragRes.rows[0].matches_count > 0) {
        const f = fragRes.rows[0];
        const deaths = f.total_deaths > 0 ? f.total_deaths : 1;
        fragStats = {
          matchesCount: f.matches_count || 0,
          wins: 0,
          kills: f.total_kills || 0,
          deaths: f.total_deaths || 0,
          headshots: f.total_headshots || 0,
          kdRatio: Number((f.total_kills / deaths).toFixed(2)),
          cs2Rating: row.faceit_elo || (1000 + (f.total_kills * 15) - (f.total_deaths * 10)),
        };
      }
    } catch (e) {
      console.warn("[Public Player API] Frag stats query skipped/empty:", e);
    }

    // 4. Fetch real club tournaments history and results
    let recentTournaments: any[] = [];
    const trophyStats = { first: 0, second: 0, third: 0 };
    let totalTournamentMatches = 0;
    let totalTournamentWins = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalHeadshots = 0;

    try {
      const tourneyRes = await client.query(
        `SELECT DISTINCT 
            t.id, t.name, t.discipline, t.type, t.status, t.created_at, t.finished_at, t.config,
            t.fixed_prize_amount, t.prize_distribution,
            c.id as competitor_id, c.display_name as competitor_name
         FROM club_tournaments t
         JOIN tournament_competitors c ON c.tournament_id = t.id
         LEFT JOIN promo_team_members tm ON c.promo_team_id = tm.team_id
         LEFT JOIN team_members cl_tm ON c.team_id::text = cl_tm.team_id::text
         WHERE c.player_id::text = $1 
            OR (tm.phone IS NOT NULL AND tm.phone = $2)
            OR (cl_tm.player_id IS NOT NULL AND cl_tm.player_id::text = $1)
         ORDER BY t.created_at DESC
         LIMIT 20`,
        [String(row.id), playerPhone || ""]
      );

      for (const t of tourneyRes.rows) {
        // Determine place from config.final_standings if finished
        let place: number | null = null;
        const standings = t.config?.final_standings;
        if (Array.isArray(standings)) {
          const entry = standings.find(
            (s: any) =>
              String(s.competitor_id) === String(t.competitor_id) ||
              (s.display_name && s.display_name.trim().toLowerCase() === (t.competitor_name || "").trim().toLowerCase())
          );
          if (entry && typeof entry.place === "number") {
            place = entry.place;
          }
        }

        // Count match results for this competitor in this tournament
        const matchRes = await client.query(
          `SELECT id, score1, score2, status, winner_competitor_id, result, competitor_a_id, competitor_b_id
           FROM tournament_matches
           WHERE tournament_id = $1 AND (competitor_a_id = $2 OR competitor_b_id = $2)`,
          [t.id, t.competitor_id]
        );

        let wins = 0;
        let losses = 0;
        for (const m of matchRes.rows) {
          if (m.status === "FINISHED") {
            if (String(m.winner_competitor_id) === String(t.competitor_id)) {
              wins++;
              totalTournamentWins++;
            } else if (m.winner_competitor_id) {
              losses++;
            }
            totalTournamentMatches++;

            // Accumulate player kills/deaths from match.result
            if (m.result?.maps && typeof m.result.maps === "object") {
              const pSteam = String(row.steam_id || "");
              const pName = String(row.nickname || row.full_name || "").toLowerCase();
              for (const mapData of Object.values(m.result.maps) as any[]) {
                const players = [
                  ...(Array.isArray(mapData.stats?.team1?.players) ? mapData.stats.team1.players : Object.values(mapData.stats?.team1?.players || {})),
                  ...(Array.isArray(mapData.stats?.team2?.players) ? mapData.stats.team2.players : Object.values(mapData.stats?.team2?.players || {})),
                ];
                for (const p of players as any[]) {
                  const steam = String(p.steamid || p.steamId || p.steam_id || "");
                  const name = String(p.name || p.nickname || "").toLowerCase();
                  if ((pSteam && steam === pSteam) || (pName && name === pName)) {
                    totalKills += Number(p.kills ?? p.stats?.kills ?? 0) || 0;
                    totalDeaths += Number(p.deaths ?? p.stats?.deaths ?? 0) || 0;
                    totalHeadshots += Number(p.headshot_kills ?? p.stats?.headshot_kills ?? 0) || 0;
                  }
                }
              }
            }
          }
        }

        // If place wasn't explicitly recorded in standings but it's FINISHED
        if (!place && t.status === "FINISHED") {
          if (wins > 0 && losses === 0) place = 1;
          else if (losses === 1 && wins > 0) place = 2;
        }

        if (place === 1) trophyStats.first++;
        else if (place === 2) trophyStats.second++;
        else if (place === 3) trophyStats.third++;

        recentTournaments.push({
          id: t.id,
          title: t.name,
          discipline: t.discipline || "cs2",
          type: t.type || "1vs1",
          status: t.status,
          createdAt: t.created_at,
          finishedAt: t.finished_at,
          place,
          isWinner: place === 1,
          competitorName: t.competitor_name,
          wins,
          losses,
          totalMatches: matchRes.rowCount || 0,
          prizePool:
            parseFloat(t.fixed_prize_amount || "0") > 0
              ? `${Number(t.fixed_prize_amount).toLocaleString("ru-RU")} ₽`
              : t.prize_distribution?.totalBonusPool
              ? `+${t.prize_distribution.totalBonusPool} Б`
              : null,
        });
      }
    } catch (e) {
      console.warn("[Public Player API] Tournament query error:", e);
    }

    // 4.5 Fetch real CS2 ELO from discipline_elo
    let cs2Elo = row.faceit_elo || 1000;
    try {
      const eloRes = await client.query(
        `SELECT elo, matches_played FROM discipline_elo WHERE player_id = $1 AND discipline = 'cs2'`,
        [row.id]
      );
      if (eloRes.rowCount && eloRes.rows[0]) {
        cs2Elo = eloRes.rows[0].elo || cs2Elo;
      }
    } catch (e) {}

    const effectiveMatchesCount = totalTournamentMatches > 0 ? totalTournamentMatches : fragStats.matchesCount;
    const effectiveKills = totalKills > 0 ? totalKills : fragStats.kills;
    const effectiveDeaths = totalDeaths > 0 ? totalDeaths : (fragStats.deaths || 1);
    const effectiveKd = effectiveDeaths > 0 ? Number((effectiveKills / effectiveDeaths).toFixed(2)) : 1.0;
    const effectiveHeadshots = totalHeadshots > 0 ? totalHeadshots : fragStats.headshots;

    const combatStats = {
      matchesCount: effectiveMatchesCount,
      wins: totalTournamentWins,
      kills: effectiveKills,
      deaths: effectiveDeaths,
      headshots: effectiveHeadshots,
      kdRatio: effectiveKd,
      cs2Rating: cs2Elo,
      trophies: trophyStats,
    };

    // 5. Viewer captained teams (so viewer can invite player to their team)
    let viewerCaptainedTeams: any[] = [];
    if (currentPlayerId && currentPlayerId !== targetPlayerId) {
      try {
        const viewerRes = await client.query(
          `SELECT phone_number FROM promo_players WHERE id = $1`,
          [currentPlayerId]
        );
        if (viewerRes.rowCount && viewerRes.rows[0]?.phone_number) {
          const vPhone = viewerRes.rows[0].phone_number;
          const capTeamsRes = await client.query(
            `SELECT t.id, t.name,
                    (SELECT COUNT(*)::int FROM promo_team_members WHERE team_id = t.id) as members_count,
                    EXISTS(SELECT 1 FROM promo_team_members WHERE team_id = t.id AND phone = $2) as already_in_team,
                    EXISTS(SELECT 1 FROM promo_team_invitations WHERE team_id = t.id AND player_id = $3 AND status = 'PENDING') as has_pending_invite
             FROM promo_teams t
             WHERE t.captain_phone = $1`,
            [vPhone, playerPhone, targetPlayerId]
          );
          viewerCaptainedTeams = capTeamsRes.rows.map((t: any) => ({
            id: t.id,
            name: t.name,
            membersCount: t.members_count,
            alreadyInTeam: t.already_in_team,
            hasPendingInvite: t.has_pending_invite,
            canInvite: t.members_count < 7 && !t.already_in_team && !t.has_pending_invite,
          }));
        }
      } catch (e) {
        console.warn("[Public Player API] Viewer teams check error:", e);
      }
    }

    // Extract Faceit username from link if present
    let faceitNickname = null;
    if (row.faceit_link) {
      const match = row.faceit_link.match(/\/players\/([^\/\?]+)/);
      if (match) {
        faceitNickname = match[1];
      }
    }

    // Level calculation based on XP
    const totalXp = Number(row.total_xp || 0);
    const calculatedLevel = Math.max(1, Math.floor(Math.sqrt(totalXp / 100)) + 1);

    return NextResponse.json({
      success: true,
      isSelf: currentPlayerId === targetPlayerId,
      player: {
        id: row.id,
        fullName: row.full_name || "Неизвестный игрок",
        nickname: row.nickname || null,
        avatarUrl: row.avatar_url || row.faceit_avatar || null,
        lftStatus: row.lft_status || (teams.length > 0 ? "in_team" : "none"),
        level: calculatedLevel,
        totalXp: totalXp,
        clubName: row.club_name || null,
        clubId: row.club_id || null,
        steamLink: row.steam_link || null,
        steamId: row.steam_id || null,
        faceitLink: row.faceit_link || null,
        faceitNickname: faceitNickname,
        faceitLvl: row.faceit_lvl || null,
        faceitElo: row.faceit_elo || null,
        faceitKd: row.faceit_kd ? parseFloat(row.faceit_kd) : null,
        faceitWinrate: row.faceit_winrate ? parseFloat(row.faceit_winrate) : null,
        faceitMatches: row.faceit_matches || null,
        dotaRankTier: row.dota_rank_tier || null,
        dotaRankName: row.dota_rank_name || null,
        dotaLeaderboardRank: row.dota_leaderboard_rank || null,
        dotaMmr: row.dota_mmr || null,
        dotaWinrate: row.dota_winrate ? parseFloat(row.dota_winrate) : null,
        dotaMatches: row.dota_matches || null,
        dotaStats: row.dota_stats || null,
        createdAt: row.created_at,
      },
      stats: combatStats,
      teams,
      recentTournaments,
      viewerCaptainedTeams,
    });
  } catch (error) {
    console.error("Public Player Profile GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
