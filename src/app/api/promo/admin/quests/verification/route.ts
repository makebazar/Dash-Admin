import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clubId = url.searchParams.get("clubId");
  const userId = (await cookies()).get("session_user_id")?.value;

  if (!userId || !clubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getClient();
  try {
    const res = await client.query(
      `SELECT
         pq.id,
         pq.verification_photo_url,
         pq.assigned_at,
         pq.seat_number,
         q.title as quest_title,
         q.reward_xp,
         q.reward_tickets,
         q.reward_bonus_balance,
         p.full_name as player_name,
         p.phone_number as player_phone
       FROM promo_player_quests pq
       JOIN promo_quests q ON q.id = pq.quest_id
       JOIN promo_players p ON p.id = pq.player_id
       WHERE pq.club_id = $1 AND pq.status = 'pending_verification'
       ORDER BY pq.assigned_at ASC`,
      [clubId],
    );
    return NextResponse.json({ requests: res.rows });
  } catch (error) {
    console.error("Fetch Verification Requests Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const data = await request.json();
  const userId = (await cookies()).get("session_user_id")?.value;

  if (!userId || !data.requestId || !data.clubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    if (data.action === "approve") {
      // 1. Get quest details for reward
      const qRes = await client.query(
        `SELECT
           pq.player_id,
           pq.quest_id,
           q.reward_xp,
           q.reward_tickets,
           q.reward_bonus_balance,
           q.reward_prize_id
         FROM promo_player_quests pq
         JOIN promo_quests q ON q.id = pq.quest_id
         WHERE pq.id = $1`,
        [data.requestId],
      );

      if (qRes.rows.length === 0) throw new Error("Request not found");
      const quest = qRes.rows[0];

      // 2. Update status to completed
      await client.query(
        `UPDATE promo_player_quests
         SET status = 'completed',
             completed_at = NOW(),
             reviewed_at = NOW(),
             reviewed_by = $1
         WHERE id = $2`,
        [userId, data.requestId],
      );

      // 3. Issue rewards (reuse logic from promo-quests.ts)
      const { rewardPlayerForQuest } = await import("@/lib/promo-quests");
      await rewardPlayerForQuest(client, data.clubId, quest.player_id, quest);
    } else {
      // Reject: set back to active or failed?
      // User can try again
      await client.query(
        `UPDATE promo_player_quests
         SET status = 'active',
             verification_photo_url = NULL,
             reviewed_at = NOW(),
             reviewed_by = $1
         WHERE id = $2`,
        [userId, data.requestId],
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Quest Verification Action Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
