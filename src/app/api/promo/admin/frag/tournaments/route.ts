import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// GET /api/promo/admin/frag/tournaments — List tournaments for a club
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await query(
      `SELECT id, club_id, title, game, start_date, end_date, min_matches, prizes, status, created_at
       FROM promo_tournaments
       WHERE club_id = $1
       ORDER BY created_at DESC`,
      [clubId]
    );

    return NextResponse.json({ tournaments: result.rows });
  } catch (error) {
    console.error("List Tournaments Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/promo/admin/frag/tournaments — Create a new tournament season
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clubId, title, game, start_date, end_date, min_matches = 5, prizes = [], description = "" } = body;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!title || !game || !start_date || !end_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO promo_tournaments (club_id, title, game, start_date, end_date, min_matches, prizes, status, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
       RETURNING *`,
      [
        clubId,
        title,
        game,
        new Date(start_date),
        new Date(end_date),
        parseInt(min_matches) || 5,
        JSON.stringify(prizes),
        description,
      ]
    );

    return NextResponse.json({ success: true, tournament: result.rows[0] });
  } catch (error) {
    console.error("Create Tournament Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
