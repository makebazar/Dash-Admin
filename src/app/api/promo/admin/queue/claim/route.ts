import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { id, itemId, action } = await request.json();
    const targetId = id || itemId;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!targetId) {
      return NextResponse.json({ error: "Missing queue item id" }, { status: 400 });
    }

    const status = action === "cancel" ? "canceled" : "claimed";

    const queueRes = await query(
      `UPDATE promo_prize_queue
       SET status = $1, claimed_at = NOW(), claimed_by_admin_id = $2
       WHERE id = $3
       RETURNING club_id`,
      [status, userId, targetId],
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
