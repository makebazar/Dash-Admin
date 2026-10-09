import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/db";
import { calculateTournamentPoints } from "@/lib/promo-frag-utils";

// Official competitive map pool filter for CS2
const CS2_COMPETITIVE_MAP_REGEX = "^(de_mirage|de_dust2|de_inferno|de_nuke|de_anubis|de_ancient|de_vertigo|de_overpass|de_train|de_cache|cs_office|cs_italy)$";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string; playerId: string }> }
) {
  const { clubId, playerId } = await params;
  const pool = getPool();
  const client = await pool.connect();

  try {
    // 1. Fetch Player info
    const playerRes = await client.query(
      `SELECT p.id, p.full_name, p.phone_number, p.created_at,
              COALESCE(b.bonus_balance, 0) as bonus_balance,
              COALESCE(b.total_xp, 0) as dashfrag_points,
              b.limit_group_id
       FROM promo_players p
       LEFT JOIN promo_player_balances b ON (b.player_id = p.id AND b.club_id::text = $2::text)
       WHERE p.id::text = $1::text OR p.phone_number::text = $1::text`,
      [playerId, clubId]
    );

    let player: any = null;

    if (playerRes.rowCount && playerRes.rowCount > 0) {
      player = playerRes.rows[0];
    } else {
      const pOnly = await client.query(
        `SELECT id, full_name, phone_number, created_at FROM promo_players WHERE id::text = $1::text OR phone_number::text = $1::text`,
        [playerId]
      );
      if (pOnly.rowCount && pOnly.rowCount > 0) {
        player = {
          ...pOnly.rows[0],
          bonus_balance: 0,
          dashfrag_points: 0,
          limit_group_id: null,
        };
      } else {
        player = {
          id: playerId,
          full_name: "Игрок Клуба",
          phone_number: "+7 (999) 000-00-00",
          created_at: new Date().toISOString(),
          bonus_balance: 0,
          dashfrag_points: 0,
          limit_group_id: null,
        };
      }
    }

    const playerPhone = player.phone_number || "";
    const pId = player.id || playerId;

    // Saved Game IDs log
    let steamId = "";
    let dotaId = "";
    let pubgNickname = "";

    try {
      const idsLogRes = await client.query(
        `SELECT result_data FROM promo_history
         WHERE (player_id::text = $1::text OR player_id::text = $2::text) AND game_type = 'UPDATE_GAME_IDS'
         ORDER BY created_at DESC LIMIT 1`,
        [pId, playerPhone]
      );
      if (idsLogRes.rowCount && idsLogRes.rowCount > 0) {
        const data = idsLogRes.rows[0].result_data || {};
        if (data.steamId) steamId = data.steamId;
        if (data.dotaId) dotaId = data.dotaId;
        if (data.pubgNickname) pubgNickname = data.pubgNickname;
      }
    } catch (e) {
      // Ignore
    }

    // Helper for determining match platform/mode
    const getPlatformTag = (game: string, score: string, eventsStr: string) => {
      if (game === "CS2" || game?.includes("CS")) {
        const parts = (score || "").split(":").map((n) => parseInt(n.trim()));
        const maxScore = parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) ? Math.max(parts[0], parts[1]) : 0;
        const totalRounds = parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) ? parts[0] + parts[1] : 0;

        if (maxScore >= 13 || totalRounds >= 16) {
          return "FACEIT / Premier 5v5";
        }
        if (totalRounds >= 12) {
          return "Matchmaking 5v5";
        }
        return "CS2 Competitive";
      }
      if (game === "Dota2" || game === "Dota 2") {
        return "Dota 2 Ranked";
      }
      return "PUBG Match";
    };

    // 2. Fetch ONLY Official Qualifying CS2 Matches
    let cs2Matches: any[] = [];
    try {
      const cs2Res = await client.query(
        `SELECT m.id, m.map, m.score, m.kills, m.deaths, m.assists, m.headshots,
                m.earned, m.events, m.played_at
         FROM promo_frag_matches m
         WHERE (m.player_id::text = $1::text OR (m.player_id::text = $2::text AND $2::text != ''))
           AND (m.game = 'CS2' OR m.game ILIKE '%cs%')
           AND m.map ~* $3
           AND COALESCE(m.earned, 0) > 0
         ORDER BY m.played_at DESC LIMIT 500`,
        [pId, playerPhone, CS2_COMPETITIVE_MAP_REGEX]
      );
      cs2Matches = cs2Res.rows;
    } catch (err) {
      console.warn("Could not query cs2 matches:", err);
    }

    const cs2TotalKills = cs2Matches.reduce((s, m) => s + (m.kills || 0), 0);
    const cs2TotalDeaths = cs2Matches.reduce((s, m) => s + (m.deaths || 0), 0);
    const cs2TotalHeadshots = cs2Matches.reduce((s, m) => s + (m.headshots || 0), 0);
    const cs2Wins = cs2Matches.filter((m) => {
      const eventsStr = typeof m.events === "string" ? m.events : JSON.stringify(m.events || "");
      return eventsStr.includes("Победа") || eventsStr.includes("победа") || eventsStr.includes("🏆");
    }).length;

    const cs2Stats = {
      matchesCount: cs2Matches.length,
      winsCount: cs2Wins,
      winrate: cs2Matches.length ? Math.round((cs2Wins / cs2Matches.length) * 100) : 0,
      kills: cs2TotalKills,
      deaths: cs2TotalDeaths,
      kdRatio: cs2TotalDeaths ? (cs2TotalKills / cs2TotalDeaths).toFixed(2) : cs2TotalKills.toFixed(2),
      headshotsPercent: cs2TotalKills ? Math.round((cs2TotalHeadshots / cs2TotalKills) * 100) : 0,
      acesCount: cs2Matches.filter((m) => {
        const eventsStr = typeof m.events === "string" ? m.events : JSON.stringify(m.events || "");
        return eventsStr.toLowerCase().includes("ace") || eventsStr.toLowerCase().includes("эйс");
      }).length,
      favoriteMap: cs2Matches.length && cs2Matches[0].map ? cs2Matches[0].map : "—",
    };

    // 3. Fetch ONLY Official Qualifying Dota 2 Matches
    let dotaMatches: any[] = [];
    try {
      const dotaRes = await client.query(
        `SELECT m.id, m.map, m.score, m.kills, m.deaths, m.assists, m.last_hits, m.earned, m.events, m.played_at
         FROM promo_frag_matches m
         WHERE (m.player_id::text = $1::text OR (m.player_id::text = $2::text AND $2::text != ''))
           AND (m.game = 'Dota2' OR m.game = 'Dota 2' OR m.game ILIKE '%dota%')
           AND COALESCE(m.earned, 0) > 0
         ORDER BY m.played_at DESC LIMIT 500`,
        [pId, playerPhone]
      );
      dotaMatches = dotaRes.rows;
    } catch (err) {
      console.warn("Could not query dota matches:", err);
    }

    const dotaWins = dotaMatches.filter((m) => {
      const eventsStr = typeof m.events === "string" ? m.events : JSON.stringify(m.events || "");
      return eventsStr.includes("Победа") || eventsStr.includes("победа") || eventsStr.includes("🏆");
    }).length;
    const dotaKills = dotaMatches.reduce((s, m) => s + (m.kills || 0), 0);
    const dotaDeaths = dotaMatches.reduce((s, m) => s + (m.deaths || 0), 0);
    const dotaAssists = dotaMatches.reduce((s, m) => s + (m.assists || 0), 0);
    const dotaLastHits = dotaMatches.reduce((s, m) => s + (m.last_hits || 0), 0);

    const dotaStats = {
      matchesCount: dotaMatches.length,
      winsCount: dotaWins,
      winrate: dotaMatches.length ? Math.round((dotaWins / dotaMatches.length) * 100) : 0,
      kills: dotaKills,
      deaths: dotaDeaths,
      assists: dotaAssists,
      kdaRatio: dotaDeaths ? ((dotaKills + dotaAssists) / dotaDeaths).toFixed(2) : (dotaKills + dotaAssists).toFixed(2),
      avgLastHits: dotaMatches.length ? Math.round(dotaLastHits / dotaMatches.length) : 0,
      avgDenies: 0,
    };

    // 4. Fetch ONLY Official Qualifying PUBG Matches
    let pubgMatches: any[] = [];
    try {
      const pubgRes = await client.query(
        `SELECT m.id, m.kills, m.earned, m.events, m.played_at
         FROM promo_frag_matches m
         WHERE (m.player_id::text = $1::text OR (m.player_id::text = $2::text AND $2::text != ''))
           AND (m.game = 'PUBG' OR m.game ILIKE '%pubg%')
           AND COALESCE(m.earned, 0) > 0
         ORDER BY m.played_at DESC LIMIT 500`,
        [pId, playerPhone]
      );
      pubgMatches = pubgRes.rows;
    } catch (err) {
      console.warn("Could not query pubg matches:", err);
    }

    const pubgWins = pubgMatches.filter((m) => {
      const eventsStr = typeof m.events === "string" ? m.events : JSON.stringify(m.events || "");
      return eventsStr.includes("победа") || eventsStr.includes("🏆") || eventsStr.includes("top-1");
    }).length;
    const pubgKills = pubgMatches.reduce((s, m) => s + (m.kills || 0), 0);

    const pubgStats = {
      matchesCount: pubgMatches.length,
      top1Wins: pubgWins,
      winrate: pubgMatches.length ? Math.round((pubgWins / pubgMatches.length) * 100) : 0,
      kills: pubgKills,
      avgDamage: 0,
    };

    // 5. Fetch ONLY Official Qualifying Matches for History Table with Mode/Platform Tags
    let matchHistory: any[] = [];
    try {
      const historyRes = await client.query(
        `SELECT m.id, m.game, m.map, m.score, m.kills, m.deaths, m.assists,
                m.earned, m.events, m.played_at as created_at
         FROM promo_frag_matches m
         WHERE (m.player_id::text = $1::text OR (m.player_id::text = $2::text AND $2::text != ''))
           AND (m.game != 'CS2' OR m.map ~* $3)
           AND COALESCE(m.earned, 0) > 0
         ORDER BY m.played_at DESC LIMIT 500`,
        [pId, playerPhone, CS2_COMPETITIVE_MAP_REGEX]
      );
      if (historyRes.rows && historyRes.rows.length > 0) {
        matchHistory = historyRes.rows.map((m) => {
          const eventsStr = typeof m.events === "string" ? m.events : JSON.stringify(m.events || "");
          return {
            ...m,
            game_name: m.game,
            map_name: m.map || "—",
            score: m.score || "—",
            platformTag: getPlatformTag(m.game, m.score, eventsStr),
            earned_points: parseFloat(m.earned || 0),
            is_win: eventsStr.includes("Победа") || eventsStr.includes("победа") || eventsStr.includes("🏆"),
          };
        });
      }
    } catch (err) {
      console.warn("Could not query match history:", err);
    }

    // 6. Fetch Point Adjustment Log History
    let pointLogs: any[] = [];
    try {
      const pointLogsRes = await client.query(
        `SELECT h.id, h.game_type, h.result_data, h.created_at
         FROM promo_history h
         WHERE (h.player_id::text = $1::text OR (h.player_id::text = $2::text AND $2::text != ''))
           AND h.game_type = 'MANUAL_POINT_ADJUSTMENT'
         ORDER BY h.created_at DESC LIMIT 500`,
        [pId, playerPhone]
      );
      if (pointLogsRes.rows && pointLogsRes.rows.length > 0) {
        pointLogs = pointLogsRes.rows.map((r) => ({
          id: r.id,
          amount: r.result_data?.amount || 0,
          reason: r.result_data?.reason || "Без описания",
          createdAt: r.created_at,
        }));
      }
    } catch (err) {
      console.warn("Could not query point logs:", err);
    }

    // 7. Calculate Total Earned in Games
    let totalEarnedInGames = 0;
    try {
      const earnedRes = await client.query(
        `SELECT SUM(earned) as total FROM promo_frag_matches 
         WHERE player_id::text = $1::text OR (player_id::text = $2::text AND $2::text != '')`,
        [pId, playerPhone]
      );
      if (earnedRes.rowCount && earnedRes.rowCount > 0) {
        totalEarnedInGames = parseFloat(earnedRes.rows[0].total || 0);
      }
    } catch (e) {
      console.warn("Could not calculate total earned:", e);
    }

    // 8. Fetch DashFrag Tournaments (Leaderboards) with rank & prizes
    let dashfragTournaments: any[] = [];
    try {
      const tournamentsRes = await client.query(
        `SELECT id, title, game, start_date, end_date, min_matches, prizes, status
         FROM promo_tournaments
         WHERE club_id = $1
         ORDER BY created_at DESC`,
        [clubId]
      );
      
      const tournaments = tournamentsRes.rows;
      if (tournaments.length > 0) {
        // Helper: filter matches by tournament dates + game
        const filterByTournament = (matches: any[], t: any) => {
          const start = new Date(t.start_date).getTime();
          const end = new Date(t.end_date).getTime();
          return matches.filter(m => {
            const playedAt = new Date(m.played_at).getTime();
            if (playedAt < start || playedAt > end) return false;
            if (t.game !== 'ALL') {
              if (t.game === 'CS2' && m.game !== 'CS2') return false;
              if (t.game === 'Dota2' && !m.game.toLowerCase().includes('dota')) return false;
              if (t.game === 'PUBG' && !m.game.toLowerCase().includes('pubg')) return false;
            }
            return true;
          });
        };

        // Fetch ALL club matches for tournament date ranges (for leaderboard calc)
        // We need to find the earliest start_date and latest end_date across all tournaments
        const earliestStart = tournaments.reduce((min: Date, t: any) => {
          const d = new Date(t.start_date);
          return d < min ? d : min;
        }, new Date(tournaments[0].start_date));
        const latestEnd = tournaments.reduce((max: Date, t: any) => {
          const d = new Date(t.end_date);
          return d > max ? d : max;
        }, new Date(tournaments[0].end_date));

        const allClubMatchesRes = await client.query(
          `SELECT m.player_id, m.game, m.map, m.score, m.kills, m.deaths, m.assists,
                  m.headshots, m.last_hits, m.events, m.played_at, m.earned
           FROM promo_frag_matches m
           WHERE m.club_id = $1
             AND m.played_at BETWEEN $2 AND $3
             AND COALESCE(m.earned, 0) > 0`,
          [clubId, earliestStart, latestEnd]
        );
        const allClubMatches = allClubMatchesRes.rows;

        // Player's own matches (subset)
        const playerMatches = allClubMatches.filter(m =>
          String(m.player_id) === String(pId) || (playerPhone && String(m.player_id) === String(playerPhone))
        );

        for (const t of tournaments) {
          // Player's matches for this tournament
          const myMatches = filterByTournament(playerMatches, t);
          if (myMatches.length === 0) continue;

          const myStats = calculateTournamentPoints(myMatches, 15);

          // Build full leaderboard for rank
          const tAllMatches = filterByTournament(allClubMatches, t);
          const playerMap = new Map<string, any[]>();
          for (const m of tAllMatches) {
            const pid = String(m.player_id);
            if (!playerMap.has(pid)) playerMap.set(pid, []);
            playerMap.get(pid)!.push(m);
          }

          const leaderboard: { playerId: string; points: number; matchesCount: number; qualified: boolean }[] = [];
          playerMap.forEach((pMatches, pid) => {
            const s = calculateTournamentPoints(pMatches, 15);
            leaderboard.push({
              playerId: pid,
              points: s.points,
              matchesCount: s.matchesCount,
              qualified: s.matchesCount >= t.min_matches,
            });
          });

          // Sort descending by points (only qualified count for placement)
          const qualifiedBoard = leaderboard.filter(l => l.qualified).sort((a, b) => b.points - a.points);
          const myQualified = myStats.matchesCount >= t.min_matches;
          let rank: number | null = null;
          if (myQualified) {
            rank = qualifiedBoard.findIndex(l => l.playerId === String(pId) || l.playerId === String(playerPhone)) + 1;
            if (rank === 0) rank = null;
          }

          // Parse prizes
          const prizes = typeof t.prizes === 'string' ? JSON.parse(t.prizes || '[]') : (t.prizes || []);
          let myPrize: any = null;
          if (rank) {
            const prizeEntry = prizes.find((p: any) => parseInt(p.place) === rank);
            if (prizeEntry) {
              myPrize = {
                reward: parseFloat(prizeEntry.reward) || 0,
                textPrize: prizeEntry.text_prize || '',
                description: prizeEntry.description || '',
              };
            }
          }

          dashfragTournaments.push({
            id: t.id,
            title: t.title,
            game: t.game,
            start_date: t.start_date,
            end_date: t.end_date,
            min_matches: t.min_matches,
            status: t.status,
            stats: myStats,
            rank,
            totalPlayers: qualifiedBoard.length,
            myPrize,
            prizes,
          });
        }
      }
    } catch (e) {
      console.warn("Could not fetch dashfrag tournaments:", e);
    }

    return NextResponse.json({
      player: {
        id: player.id,
        fullName: player.full_name,
        phoneNumber: player.phone_number,
        createdAt: player.created_at,
        dashfragPoints: parseFloat(player.dashfrag_points || 0),
        bonusBalance: parseFloat(player.bonus_balance || 0),
        totalEarnedInGames,
        limitGroupId: player.limit_group_id,
        steamId,
        dotaId,
        pubgNickname,
      },
      stats: {
        cs2: cs2Stats,
        dota2: dotaStats,
        pubg: pubgStats,
      },
      matchHistory,
      pointLogs,
      dashfragTournaments,
    });
  } catch (error: any) {
    console.error("[GET Esports Profile Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
