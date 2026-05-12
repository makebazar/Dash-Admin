import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  let client;
  try {
    const { code } = await request.json();
    if (!code || String(code).length < 4) {
      return NextResponse.json({ error: "Некорректный код" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;

    if (!playerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    client = await getClient();

    // Find club by public_id (short code) or ID
    // We assume the user enters the public_id or the last parts of it
    // For now, let's match exactly with public_id
    const clubResult = await client.query(
      `SELECT id, name FROM clubs WHERE UPPER(public_id) = UPPER($1) OR id::text = $1`,
      [code]
    );

    if (clubResult.rowCount === 0) {
      return NextResponse.json({ error: "Клуб не найден" }, { status: 404 });
    }

    const clubId = clubResult.rows[0].id;

    // Add to player balances (binding player to club)
    await client.query(
      `INSERT INTO promo_player_balances (player_id, club_id)
       VALUES ($1, $2)
       ON CONFLICT (player_id, club_id) DO NOTHING`,
      [playerId, clubId]
    );

    // Update active club cookie
    cookieStore.set("promo_active_club_id", String(clubId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({
      success: true,
      club: {
        id: clubId,
        name: clubResult.rows[0].name
      }
    });
  } catch (error) {
    console.error("Add Club Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
