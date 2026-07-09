import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// PUT /api/promo/admin/frag/tournaments/[id] — Update an existing tournament
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
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
      `UPDATE promo_tournaments
       SET title = $1, game = $2, start_date = $3, end_date = $4, min_matches = $5, prizes = $6, description = $7
       WHERE id = $8 AND club_id = $9
       RETURNING *`,
      [
        title,
        game,
        new Date(start_date),
        new Date(end_date),
        parseInt(min_matches) || 5,
        JSON.stringify(prizes),
        description,
        tournamentId,
        clubId,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, tournament: result.rows[0] });
  } catch (error) {
    console.error("Update Tournament Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/promo/admin/frag/tournaments/[id] — Delete a tournament
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await query(
      `DELETE FROM promo_tournaments
       WHERE id = $1 AND club_id = $2
       RETURNING *`,
      [tournamentId, clubId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Tournament deleted successfully" });
  } catch (error) {
    console.error("Delete Tournament Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
