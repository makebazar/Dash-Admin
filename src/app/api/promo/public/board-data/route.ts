import { NextResponse } from "next/server";
import { query } from "@/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get("clubId");
  const discipline = searchParams.get("discipline");

  if (!clubId) {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }

  try {
    if (discipline && discipline !== "all") {
      // Fetch ELO rating leaderboard
      const leaderboardRes = await query(
        `SELECT
          p.id,
          p.full_name as name,
          COALESCE(e.elo, 1000) as elo,
          COALESCE(e.matches_played, 0) as matches_played
        FROM discipline_elo e
        JOIN promo_players p ON e.player_id = p.id
        WHERE e.discipline = $1 AND p.club_id = $2
        ORDER BY e.elo DESC
        LIMIT 50`,
        [discipline, clubId],
      );

      return NextResponse.json({
        leaderboard: leaderboardRes.rows.map((r, i) => ({
          id: r.id,
          name: r.name,
          full_name: r.name,
          elo: r.elo,
          matches_played: r.matches_played,
          rank: i + 1,
        })),
      });
    }

    // 1. Leaderboard (Top 10 by total_xp)
    const leaderboardRes = await query(
      `SELECT
        p.id,
        COALESCE(p.full_name, regexp_replace(p.phone_number, '(\\d{4})\\d+(\\d{2})', '\\1****\\2')) as name,
        b.total_xp as xp,
        (
          SELECT level_number
          FROM promo_levels
          WHERE club_id = $1 AND xp_required <= b.total_xp
          ORDER BY level_number DESC
          LIMIT 1
        ) as level
      FROM promo_player_balances b
      JOIN promo_players p ON b.player_id = p.id
      WHERE b.club_id = $1
      ORDER BY b.total_xp DESC
      LIMIT 10`,
      [clubId],
    );

    // 2. Active Quests
    const questsRes = await query(
      `SELECT
        id,
        title,
        description,
        reward_xp,
        reward_tickets,
        reward_bonus_balance,
        trigger_type
      FROM promo_quests
      WHERE club_id = $1 AND is_active = TRUE
      ORDER BY created_at DESC
      LIMIT 20`,
      [clubId],
    );

    // 3. Recent Wins (Last 5)
    const winsRes = await query(
      `SELECT
        h.id,
        COALESCE(p.full_name, regexp_replace(p.phone_number, '(\\d{4})\\d+(\\d{2})', '\\1****\\2')) as player,
        prz.name as prize,
        prz.type as type,
        h.created_at as time
      FROM promo_history h
      JOIN promo_players p ON h.player_id = p.id
      JOIN promo_prizes prz ON h.prize_id = prz.id
      WHERE h.club_id = $1 AND h.prize_id IS NOT NULL
      ORDER BY h.created_at DESC
      LIMIT 5`,
      [clubId],
    );

    return NextResponse.json({
      leaderboard: leaderboardRes.rows.map((r, i) => ({
        ...r,
        rank: i + 1,
        level: r.level || 1,
      })),
      quests: questsRes.rows.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        rewards: {
          xp: q.reward_xp,
          tickets: q.reward_tickets,
          bonus: parseFloat(q.reward_bonus_balance || 0),
        },
        trigger: q.trigger_type,
      })),
      wins: winsRes.rows.map((w) => ({
        id: w.id,
        player: w.player,
        prize: w.prize,
        type: w.type,
        time: "Только что",
      })),
    });
  } catch (error) {
    console.error("Board Data Fetch Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
