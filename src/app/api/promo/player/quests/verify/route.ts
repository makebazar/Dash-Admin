import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const client = await getClient();
  try {
    const { questId, photoUrl, seatNumber } = await request.json();
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Check if quest exists and requires photo
    const questRes = await client.query(
      `SELECT requires_photo_verification FROM promo_quests WHERE id = $1 AND club_id = $2`,
      [questId, activeClubId],
    );

    if (questRes.rows.length === 0) {
      return NextResponse.json({ error: "Quest not found" }, { status: 404 });
    }

    const { requires_photo_verification } = questRes.rows[0];

    if (requires_photo_verification && !photoUrl) {
      return NextResponse.json(
        { error: "Photo proof is required" },
        { status: 400 },
      );
    }

    // 2. Update existing active quest or insert new one
    const existingRes = await client.query(
      `SELECT id FROM promo_player_quests
       WHERE player_id = $1 AND club_id = $2 AND quest_id = $3
       AND status IN ('active', 'pending_verification')
       ORDER BY assigned_at DESC LIMIT 1`,
      [playerId, activeClubId, questId],
    );

    if (existingRes.rows.length > 0) {
      await client.query(
        `UPDATE promo_player_quests
         SET status = 'pending_verification',
             verification_photo_url = $1,
             current_progress = 1,
             seat_number = $3
         WHERE id = $2`,
        [photoUrl || null, existingRes.rows[0].id, seatNumber || null],
      );
    } else {
      await client.query(
        `INSERT INTO promo_player_quests (player_id, club_id, quest_id, current_progress, status, verification_photo_url, seat_number, assigned_at)
         VALUES ($1, $2, $3, 1, 'pending_verification', $4, $5, NOW())`,
        [playerId, activeClubId, questId, photoUrl || null, seatNumber || null],
      );
    }

    // 3. Notify the club about new verification request
    try {
      const { notifyInventoryClub } = await import("@/lib/inventory-events");
      notifyInventoryClub(String(activeClubId), {
        type: "PROMO_QUEUE_UPDATED",
        timestamp: Date.now(),
      });
    } catch (sseError) {
      console.error("SSE Notification Error:", sseError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Promo Player Quest Verify Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
