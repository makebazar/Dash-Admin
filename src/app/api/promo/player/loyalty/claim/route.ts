import { NextResponse } from "next/server";
import { getClient, query } from "@/db";
import { cookies } from "next/headers";
import { notifyInventoryClub } from "@/lib/inventory-events";
import { issueRewards } from "@/lib/promo-packages";

export async function POST(request: Request) {
  const client = await getClient();
  try {
    const { type, programId } = await request.json();
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!programId && (!type || !["packages", "visits", "streak"].includes(type))) {
      return NextResponse.json({ error: "Invalid loyalty type" }, { status: 400 });
    }

    await client.query("BEGIN");

    // 1. Fetch club settings
    const clubRes = await client.query(
      `SELECT promo_settings FROM clubs WHERE id = $1`,
      [activeClubId]
    );

    if (clubRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const settings = clubRes.rows[0]?.promo_settings || {};

    if (programId) {
      // Custom loyalty program path
      const program = settings.loyalty_programs?.find((p: any) => p.id === programId);
      if (!program || program.enabled === false) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Программа лояльности не активна" }, { status: 400 });
      }

      const target = program.target || 5;

      // Fetch player progress for this program
      const progressRes = await client.query(
        `SELECT current_count
         FROM promo_package_progress
         WHERE player_id = $1::uuid AND club_id = $2::int AND program_id = $3
         FOR UPDATE`,
        [playerId, activeClubId, programId]
      );

      const currentCount = progressRes.rowCount > 0 ? progressRes.rows[0].current_count : 0;

      if (currentCount < target) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `Недостаточно накоплений для выдачи! Требуется: ${target}, у вас: ${currentCount}` },
          { status: 400 }
        );
      }

      // Check if there is already a pending claim for this program in the queue
      const checkPending = await client.query(
        `SELECT id FROM promo_prize_queue
         WHERE player_id = $1::uuid AND club_id = $2::int AND status = 'pending' AND loyalty_type = $3`,
        [playerId, activeClubId, programId]
      );

      if (checkPending.rowCount > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "У вас уже есть ожидающий подтверждения запрос на кассе по этой акции!" },
          { status: 400 }
        );
      }

      // Issue the rewards (credits digital directly, puts physical in queue with loyalty_type = programId)
      await issueRewards(client, activeClubId, playerId, program);

      // Decrement the player's progress
      await client.query(
        `UPDATE promo_package_progress
         SET current_count = GREATEST(0, current_count - $1), updated_at = NOW()
         WHERE player_id = $2::uuid AND club_id = $3::int AND program_id = $4`,
        [target, playerId, activeClubId, programId]
      );

      await client.query("COMMIT");

      // Notify cashiers via SSE & Postgres pub/sub
      await query(`SELECT pg_notify('promo_queue_updates', $1)`, [activeClubId]);
      try {
        notifyInventoryClub(String(activeClubId), {
          type: "PROMO_QUEUE_UPDATED",
          timestamp: Date.now(),
        });
      } catch (sseErr) {
        console.error("Failed to send SSE notify for loyalty claim:", sseErr);
      }

      return NextResponse.json({ success: true });
    } else {
      // Legacy loyalty program path
      // 2. Fetch player loyalty progress
      const progressRes = await client.query(
        `SELECT accumulated_packages, accumulated_visits, current_streak
         FROM promo_package_progress
         WHERE player_id = $1::uuid AND club_id = $2::int
         FOR UPDATE`,
        [playerId, activeClubId]
      );

      if (progressRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Progress record not found" }, { status: 400 });
      }

      const progress = progressRes.rows[0];

      // 3. Verify target requirements and extract reward details
      let target = 0;
      let rewardName = "";
      let rewardType = "";
      let rewardValue = 0;
      let currentCount = 0;

      if (type === "packages") {
        if (settings.packages_promo_enabled !== true) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Package promo is disabled" }, { status: 400 });
        }
        target = parseInt(settings.packages_accumulation_target || "5");
        rewardName = settings.packages_accumulation_reward_name || "6-я ночь в подарок";
        rewardType = settings.packages_accumulation_reward_type || "free_package";
        rewardValue = parseFloat(settings.packages_accumulation_reward_value || "0");
        currentCount = progress.accumulated_packages;
      } else if (type === "visits") {
        if (settings.packages_visits_enabled !== true) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Visits promo is disabled" }, { status: 400 });
        }
        target = parseInt(settings.packages_visits_target || "10");
        rewardName = settings.packages_visits_reward_name || "Подарок за 10 посещений";
        rewardType = settings.packages_visits_reward_type || "free_package";
        rewardValue = parseFloat(settings.packages_visits_reward_value || "0");
        currentCount = progress.accumulated_visits;
      } else if (type === "streak") {
        if (settings.packages_streak_enabled !== true) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Streak promo is disabled" }, { status: 400 });
        }
        target = parseInt(settings.packages_streak_target || "2");
        rewardName = settings.packages_streak_reward_name || "2 ночи в подарок за стрик";
        rewardType = settings.packages_streak_reward_type || "free_package";
        rewardValue = parseFloat(settings.packages_streak_reward_value || "0");
        currentCount = progress.current_streak;
      }

      if (currentCount < target) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `Недостаточно накоплений для выдачи! Требуется: ${target}, у вас: ${currentCount}` },
          { status: 400 }
        );
      }

      // 4. Check if there is already a pending claim for this type of loyalty reward
      const checkPending = await client.query(
        `SELECT id FROM promo_prize_queue
         WHERE player_id = $1::uuid AND club_id = $2::int AND status = 'pending' AND loyalty_type = $3`,
        [playerId, activeClubId, type]
      );

      if (checkPending.rowCount > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "У вас уже есть ожидающий подтверждения запрос на кассе по этой акции!" },
          { status: 400 }
        );
      }

      // 5. Create a fake history item to reference the queue
      const histRes = await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1::uuid, $2::int, 'LOYALTY_CLAIM_REQUEST', $3::jsonb)
         RETURNING id`,
        [
          playerId,
          activeClubId,
          JSON.stringify({
            loyalty_type: type,
            target,
            reward_name: rewardName,
            reward_type: rewardType,
            reward_value: rewardValue,
          }),
        ]
      );
      const historyId = histRes.rows[0].id;

      // 6. Insert reward request into queue
      await client.query(
        `INSERT INTO promo_prize_queue (history_id, player_id, club_id, prize_id, custom_reward_name, loyalty_type, reward_type, reward_value, status)
         VALUES ($1::uuid, $2::uuid, $3::int, NULL, $4, $5, $6, $7, 'pending')`,
        [historyId, playerId, activeClubId, rewardName, type, rewardType, rewardValue]
      );

      await client.query("COMMIT");

      // 7. Notify cashiers via SSE & Postgres pub/sub
      await query(`SELECT pg_notify('promo_queue_updates', $1)`, [activeClubId]);
      try {
        notifyInventoryClub(String(activeClubId), {
          type: "PROMO_QUEUE_UPDATED",
          timestamp: Date.now(),
        });
      } catch (sseErr) {
        console.error("Failed to send SSE notify for loyalty claim:", sseErr);
      }

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Player Loyalty Claim Request Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
