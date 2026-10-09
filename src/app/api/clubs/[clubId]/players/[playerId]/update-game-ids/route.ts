import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string; playerId: string }> }
) {
  const { clubId, playerId } = await params;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const body = await req.json();
    const { steamId, dotaId, pubgNickname } = body;

    await client.query(
      `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
       VALUES ($1, $2::int, 'UPDATE_GAME_IDS', $3)`,
      [
        playerId,
        parseInt(clubId),
        JSON.stringify({
          steamId: steamId || "",
          dotaId: dotaId || "",
          pubgNickname: pubgNickname || "",
        }),
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Update Game IDs Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
