import { NextResponse } from "next/server";
import { query } from "@/db";

async function resetPinHandler(request: Request) {
  try {
    const { playerId, clubId } = await request.json();

    if (!clubId || !playerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
      const { requireClubAccess } = await import("@/lib/club-api-access");
      await requireClubAccess(String(clubId));
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "Forbidden" }, { status: e.status || 403 });
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

export { resetPinHandler as POST, resetPinHandler as PATCH };
