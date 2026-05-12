import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { itemId } = await request.json();
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queueRes = await query(
      `UPDATE promo_prize_queue
             SET status = 'claimed', claimed_at = NOW(), claimed_by_admin_id = $1
             WHERE id = $2
             RETURNING club_id`,
      [userId, itemId],
    );

    if (queueRes.rowCount && queueRes.rowCount > 0) {
      const clubId = queueRes.rows[0].club_id;
      await query(`SELECT pg_notify('promo_queue_updates', $1)`, [clubId]);

      // Notify via SSE for instant UI updates in cashier app
      try {
        const { notifyInventoryClub } = await import("@/lib/inventory-events");
        notifyInventoryClub(String(clubId), {
          type: "PROMO_QUEUE_UPDATED",
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error("[SSE] Failed to send promo notification:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Claim Prize Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
