import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function PATCH(request: Request) {
  try {
    const { playerId } = await request.json();
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !playerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Reset PIN by setting pin_hash to 'PENDING'
    // This allows the player to set a new PIN on next login
    await query(
      `UPDATE promo_players
       SET pin_hash = 'PENDING', updated_at = NOW()
       WHERE id = $1`,
      [playerId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset PIN Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
