import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch summary statistics
    const summaryRes = await query(
      `SELECT 
        COUNT(DISTINCT m.player_id)::int as total_players,
        COUNT(m.id)::int as total_matches,
        COUNT(CASE WHEN m.game = 'CS2' THEN 1 END)::int as cs2_matches,
        COUNT(CASE WHEN m.game = 'Dota2' OR m.game = 'Dota 2' THEN 1 END)::int as dota_matches,
        COALESCE(SUM(m.earned), 0)::numeric as total_earned
       FROM promo_frag_matches m
       WHERE m.club_id = $1 AND m.map !~* 'training|aim_|botz|reflex|practice|workshop|custom|tutorial|test|csstats|cybershoke|am_|awp_|duels_|arena|bhop|surf|retake|deathmatch|dm_|lobby|hs_'`,
      [clubId]
    );
    const summary = summaryRes.rows[0] || {
      total_players: 0,
      total_matches: 0,
      cs2_matches: 0,
      dota_matches: 0,
      total_earned: 0
    };

    // 2. Fetch player statistics (aggregated by player and game)
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
       WHERE m.club_id = $1 AND m.map !~* 'training|aim_|botz|reflex|practice|workshop|custom|tutorial|test|csstats|cybershoke|am_|awp_|duels_|arena|bhop|surf|retake|deathmatch|dm_|lobby|hs_'
       GROUP BY p.id, p.full_name, p.phone_number, m.game
       ORDER BY total_earned DESC`,
      [clubId]
    );

    const playerStats = playerStatsRes.rows.map(row => {
      const isCs2 = row.game === "CS2";
      const events: string[] = (row.all_events || []).flat();

      const achievements: any = {};

      if (isCs2) {
        achievements.hs = row.total_headshots || 0;
        
        let knife = 0;
        let zeus = 0;
        let mvp = 0;
        let wins = 0;
        let doubleKills = 0;
        let tripleKills = 0;
        let quadKills = 0;
        let aces = 0;

        events.forEach(evt => {
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

        let denies = 0;
        let networthMilestones = 0;
        let wins = 0;
        let spree = 0;
        let mega = 0;
        let godlike = 0;

        events.forEach(evt => {
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
        achievements
      };
    });

    // 3. Fetch recent 50 matches for the club
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
       WHERE m.club_id = $1 AND m.map !~* 'training|aim_|botz|reflex|practice|workshop|custom|tutorial|test|csstats'
       ORDER BY m.played_at DESC
       LIMIT 50`,
      [clubId]
    );

    return NextResponse.json({
      summary,
      playerStats,
      recentMatches: recentMatchesRes.rows,
    });
  } catch (error) {
    console.error("Fetch Admin Frag Stats Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
