import { NextResponse } from "next/server";
import { getClient } from "@/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const discipline = url.searchParams.get("discipline") || "cs2";
  const clubId = url.searchParams.get("clubId");

  const client = await getClient();
  try {
    // Return leaderboard of players sorted by ELO / matches
    let query = `
      SELECT p.id, p.full_name, p.nickname, p.avatar_url, p.faceit_avatar,
             COALESCE(p.faceit_elo, 1000) as elo,
             COALESCE(p.faceit_matches, 0) as matches_played
      FROM promo_players p
    `;
    const params: any[] = [];

    if (clubId) {
      query += `
        JOIN promo_player_balances b ON p.id = b.player_id AND b.club_id = $1
      `;
      params.push(parseInt(clubId));
    }

    query += `
      ORDER BY COALESCE(p.faceit_elo, 1000) DESC, COALESCE(p.faceit_matches, 0) DESC
      LIMIT 100
    `;

    const res = await client.query(query, params);

    return NextResponse.json({
      success: true,
      discipline,
      leaderboard: res.rows || [],
    });
  } catch (err) {
    console.error("Board data GET error:", err);
    return NextResponse.json({ success: true, leaderboard: [] });
  } finally {
    client.release();
  }
}
