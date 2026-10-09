import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireModuleAccess } from "@/lib/club-api-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const monthParam = searchParams.get("month"); // 'YYYY-MM' or 'all'

    if (!clubId) {
      return NextResponse.json({ error: "Club ID is required" }, { status: 400 });
    }

    await requireModuleAccess(clubId, "dashboard", "view");

    // Fetch available months with matches for this club
    const monthsRes = await query(
      `SELECT DISTINCT TO_CHAR(played_at, 'YYYY-MM') as month_key
       FROM promo_frag_matches
       WHERE club_id = $1 AND played_at IS NOT NULL
       ORDER BY month_key DESC`,
      [clubId]
    );

    const availableMonths: string[] = monthsRes.rows.map((r) => r.month_key).filter(Boolean);

    // Current month string
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Selected month logic: if monthParam is passed use it; otherwise default to current month or first available
    let selectedMonth = monthParam;
    if (!selectedMonth) {
      selectedMonth = availableMonths.includes(currentMonthKey) ? currentMonthKey : availableMonths[0] || "all";
    }

    // Build SQL date filter clause
    let dateWhereClause = "";
    const queryParams: any[] = [clubId];

    if (selectedMonth && selectedMonth !== "all" && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      const [yearStr, monthStr] = selectedMonth.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
      const startOfNextMonth = new Date(Date.UTC(year, month, 1));

      dateWhereClause = "AND m.played_at >= $2 AND m.played_at < $3";
      queryParams.push(startOfMonth.toISOString(), startOfNextMonth.toISOString());
    }

    const mapValidationClause = `AND (m.game != 'CS2' OR (m.map ~* '^(de_mirage|de_dust2|de_inferno|de_nuke|de_anubis|de_ancient|de_vertigo|de_overpass|de_train|de_cache|cs_office|cs_italy)$' AND NOT ((m.score = '0:0' OR m.score IS NULL) AND m.kills > 30)))`;

    // 1. Fetch summary statistics
    const summaryRes = await query(
      `SELECT 
        COUNT(DISTINCT m.player_id)::int as total_players,
        COUNT(m.id)::int as total_matches,
        COUNT(CASE WHEN m.game = 'CS2' THEN 1 END)::int as cs2_matches,
        COUNT(CASE WHEN m.game = 'Dota2' OR m.game = 'Dota 2' THEN 1 END)::int as dota_matches,
        COALESCE(SUM(m.earned), 0)::numeric as total_earned
       FROM promo_frag_matches m
       WHERE m.club_id = $1 ${dateWhereClause} ${mapValidationClause}`,
      queryParams
    );

    const summary = summaryRes.rows[0] || {
      total_players: 0,
      total_matches: 0,
      cs2_matches: 0,
      dota_matches: 0,
      total_earned: 0,
    };

    // 2. Fetch player statistics (aggregated by player and game for selected month)
    const playerStatsRes = await query(
      `SELECT 
        p.id as player_id,
        p.full_name,
        p.phone_number,
        m.game,
        COUNT(m.id)::int as matches_count,
        SUM(m.kills)::int as total_kills,
        SUM(m.deaths)::int as total_deaths,
        SUM(m.assists)::int as total_assists,
        SUM(m.headshots)::int as total_headshots,
        SUM(m.last_hits)::int as total_last_hits,
        SUM(m.earned)::numeric as total_earned,
        jsonb_agg(m.events) as all_events
       FROM promo_frag_matches m
       JOIN promo_players p ON m.player_id = p.id
       WHERE m.club_id = $1 ${dateWhereClause} ${mapValidationClause}
       GROUP BY p.id, p.full_name, p.phone_number, m.game
       ORDER BY total_earned DESC`,
      queryParams
    );

    const playerStats = playerStatsRes.rows.map((row) => {
      const isCs2 = row.game === "CS2";
      const events: string[] = (row.all_events || []).flat();
      const achievements: any = {};

      if (isCs2) {
        achievements.hs = row.total_headshots || 0;
        let knife = 0, zeus = 0, mvp = 0, wins = 0;
        let doubleKills = 0, tripleKills = 0, quadKills = 0, aces = 0;

        events.forEach((evt) => {
          if (!evt) return;
          const lower = evt.toLowerCase();
          if (lower.includes("нож") || lower.includes("🔪")) knife++;
          if (lower.includes("zeus") || lower.includes("зевс") || lower.includes("⚡")) zeus++;
          if (lower.includes("mvp") || lower.includes("звезда") || lower.includes("⭐️")) mvp++;
          if (lower.includes("победа") || lower.includes("🏆")) wins++;
          if (lower.includes("double kill")) doubleKills++;
          if (lower.includes("triple kill")) tripleKills++;
          if (lower.includes("quad kill")) quadKills++;
          if (lower.includes("ace!")) aces++;
        });

        achievements.knife = knife;
        achievements.zeus = zeus;
        achievements.mvp = mvp;
        achievements.wins = wins;
        achievements.doubleKills = doubleKills;
        achievements.tripleKills = tripleKills;
        achievements.quadKills = quadKills;
        achievements.aces = aces;
      } else {
        achievements.lastHits = row.total_last_hits || 0;
        let denies = 0, networthMilestones = 0, wins = 0;
        let spree = 0, mega = 0, godlike = 0;

        events.forEach((evt) => {
          if (!evt) return;
          const lower = evt.toLowerCase();
          if (lower.includes("союзных") || lower.includes("🛡️")) denies += 5;
          if (lower.includes("богатство") || lower.includes("💰")) networthMilestones++;
          if (lower.includes("победа") || lower.includes("🏆")) wins++;
          if (lower.includes("killing spree")) spree++;
          if (lower.includes("mega kill")) mega++;
          if (lower.includes("beyond godlike")) godlike++;
        });

        achievements.denies = denies;
        achievements.networthMilestones = networthMilestones;
        achievements.wins = wins;
        achievements.spree = spree;
        achievements.mega = mega;
        achievements.godlike = godlike;
      }

      return {
        ...row,
        achievements,
      };
    });

    // 3. Fetch recent matches (up to 50) for selected month
    const recentMatchesRes = await query(
      `SELECT 
        m.id,
        p.id as player_id,
        p.full_name,
        p.phone_number,
        m.game,
        m.map,
        m.score,
        m.kills,
        m.deaths,
        m.assists,
        m.headshots,
        m.last_hits,
        m.earned,
        m.played_at,
        m.events
       FROM promo_frag_matches m
       JOIN promo_players p ON m.player_id = p.id
       WHERE m.club_id = $1 ${dateWhereClause} ${mapValidationClause}
       ORDER BY m.played_at DESC
       LIMIT 50`,
      queryParams
    );

    return NextResponse.json({
      summary,
      playerStats,
      recentMatches: recentMatchesRes.rows,
      availableMonths,
      selectedMonth,
    });
  } catch (error: any) {
    const errStatus = error?.status;
    if (errStatus) {
      return NextResponse.json({ error: errStatus === 401 ? "Unauthorized" : "Forbidden" }, { status: errStatus });
    }
    console.error("Fetch Admin Frag Stats Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
