import { PoolClient } from "pg";
import { accrueBPXP } from "./promo-bp";

export type ReceiptItem = {
  product_id: number;
  quantity: number;
};

export function evaluateTrigger(
  trigger: {
    trigger_type: string;
    target_value: any;
    target_entity_id?: string | null;
    target_entity_id_type?: string | null;
    target_service_id?: string | null;
  },
  event: {
    type: "receipt" | "game" | "topup" | "service" | "visit";
    totalAmount?: number;
    items?: ReceiptItem[];
    productCategories?: Record<number, number>;
    gameType?: string;
    isWin?: boolean;
    ticketsSpent?: number;
    amount?: number;
    serviceRuleId?: string | number;
  }
): number {
  let progressDelta = 0;

  if (event.type === "receipt") {
    const totalAmount = event.totalAmount ?? 0;
    const items = event.items ?? [];
    const productCategories = event.productCategories ?? {};

    if (trigger.trigger_type === "receipt_total") {
      if (totalAmount >= Number(trigger.target_value)) {
        progressDelta = Number(trigger.target_value);
      }
    } else if (trigger.trigger_type === "total_spent_accumulative") {
      progressDelta = totalAmount;
    } else if (trigger.trigger_type === "receipt_item" && trigger.target_entity_id) {
      if (trigger.target_entity_id_type === "category") {
        const targetId = Number(trigger.target_entity_id);
        const matchingItems = items.filter((i) => productCategories[i.product_id] === targetId);
        progressDelta = matchingItems.reduce((sum, i) => sum + i.quantity, 0);
      } else {
        const targetIds = String(trigger.target_entity_id)
          .split(",")
          .map((id) => Number(id.trim()))
          .filter((id) => !isNaN(id));

        if (targetIds.length > 1) {
          const matchingItems = items.filter((i) => targetIds.includes(i.product_id));
          const foundProductIds = new Set(matchingItems.map((i) => i.product_id));
          const allFound = targetIds.every((tid) => foundProductIds.has(tid));
          if (allFound) {
            const minQty = Math.min(...matchingItems.map((i) => i.quantity));
            progressDelta = minQty;
          }
        } else if (targetIds.length === 1) {
          const targetId = targetIds[0];
          const matchingItem = items.find((i) => i.product_id === targetId);
          if (matchingItem) {
            progressDelta = matchingItem.quantity;
          }
        }
      }
    }
  } else if (event.type === "game") {
    const isTargetAll = !trigger.target_entity_id || String(trigger.target_entity_id).trim() === "";
    const targetIds = isTargetAll ? [] : String(trigger.target_entity_id).split(",").map((s) => s.trim());
    const isMatchingGame = isTargetAll || targetIds.includes(String(event.gameType));

    if (isMatchingGame) {
      if (trigger.trigger_type === "game_play_count") {
        progressDelta = 1;
      } else if (trigger.trigger_type === "game_win_count" && event.isWin) {
        progressDelta = 1;
      } else if (trigger.trigger_type === "ticket_spend" && (event.ticketsSpent ?? 0) > 0) {
        progressDelta = event.ticketsSpent ?? 0;
      }
    }
  } else if (event.type === "topup") {
    if (trigger.trigger_type === "balance_topup") {
      progressDelta = event.amount ?? 0;
    }
  } else if (event.type === "service") {
    const isTargetAll = !trigger.target_entity_id || String(trigger.target_entity_id).trim() === "";
    const targetIds = isTargetAll ? [] : String(trigger.target_entity_id).split(",").map((s) => s.trim());
    const isMatchingService = isTargetAll || targetIds.includes(String(event.serviceRuleId));

    if (isMatchingService) {
      if (trigger.trigger_type === "service_award" || trigger.trigger_type === "service_accumulative") {
        progressDelta = 1;
      }
    }
  } else if (event.type === "visit") {
    if (trigger.trigger_type === "visit_cumulative" || trigger.trigger_type === "visit_streak") {
      progressDelta = 1;
    }
  }

  return progressDelta;
}

export async function handleQuestProgress(
  client: any,
  clubId: number | string,
  playerId: string,
  quest: any,
  event: any
): Promise<{ rewarded: boolean }> {
  if (quest.target_service_id) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const serviceRes = await client.query(
      `SELECT id FROM promo_history
       WHERE player_id = $1::uuid
         AND game_type = 'SERVICE_AWARD'
         AND (result_data->>'rule_id' = $2::text OR $2 IS NULL)
         AND created_at >= $3
       LIMIT 1`,
      [
        playerId,
        quest.target_service_id ? String(quest.target_service_id) : null,
        today,
      ],
    );

    if (serviceRes.rowCount === 0) {
      return { rewarded: false };
    }
  }

  const isCombo = quest.combo_triggers && Array.isArray(quest.combo_triggers) && quest.combo_triggers.length > 0;

  if (isCombo) {
    let comboProgress = quest.combo_progress || {};
    if (typeof comboProgress === "string") {
      try {
        comboProgress = JSON.parse(comboProgress);
      } catch (e) {
        comboProgress = {};
      }
    }

    let progressChanged = false;

    for (let i = 0; i < quest.combo_triggers.length; i++) {
      const subTrigger = quest.combo_triggers[i];
      const delta = evaluateTrigger(subTrigger, event);
      if (delta > 0) {
        const current = Number(comboProgress[String(i)] || 0);
        const target = Number(subTrigger.target_value || 1);
        comboProgress[String(i)] = Math.min(target, current + delta);
        progressChanged = true;
      }
    }

    if (!progressChanged) return { rewarded: false };

    const allSatisfied = quest.combo_triggers.every((subTrigger: any, i: number) => {
      const current = Number(comboProgress[String(i)] || 0);
      const target = Number(subTrigger.target_value || 1);
      return current >= target;
    });

    const newStatus = allSatisfied ? "completed" : "active";

    if (quest.player_quest_id) {
      await client.query(
        `UPDATE promo_player_quests
         SET combo_progress = $1,
             status = $2::text,
             completed_at = CASE WHEN $2::text = 'completed' THEN NOW() ELSE completed_at END
         WHERE id = $3`,
        [JSON.stringify(comboProgress), newStatus, quest.player_quest_id]
      );
    } else {
      await client.query(
        `INSERT INTO promo_player_quests (player_id, club_id, quest_id, combo_progress, status, completed_at)
         VALUES ($1, $2, $3, $4, $5::text, CASE WHEN $5::text = 'completed' THEN NOW() ELSE NULL END)`,
        [playerId, clubId, quest.quest_id, JSON.stringify(comboProgress), newStatus]
      );
    }

    if (allSatisfied) {
      await rewardPlayerForQuest(client, clubId, playerId, quest);
      return { rewarded: true };
    }
    return { rewarded: false };
  } else {
    const delta = evaluateTrigger(quest, event);
    if (delta > 0) {
      return await progressQuest(client, clubId, playerId, quest, delta);
    }
    return { rewarded: false };
  }
}

/**
 * Processes a receipt to update player XP and check active quests.
 */
export async function processReceiptEvent(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  receiptId: number | string,
  totalAmount: number,
  items: ReceiptItem[],
) {
  // 1. Fetch club settings for XP rules
  const clubRes = await client.query(
    `SELECT promo_settings FROM clubs WHERE id = $1`,
    [clubId],
  );
  const settings = clubRes.rows[0]?.promo_settings || {};
  const xpPer100 = settings.xp_per_100_rub ?? 100;

  // 1. Calculate and award base XP for the purchase (e.g., 100 XP per 100 RUB)
  const xpEarned = Math.floor(totalAmount / 100) * xpPer100;
  if (xpEarned > 0) {
    // This now updates both Permanent XP and Battle Pass XP
    await addPlayerXP(client, clubId, playerId, xpEarned, true);
  }

  // 2. Fetch active quests for this player
  const activeQuests = await getActiveQuestsForPlayer(client, clubId, playerId);

  // 2.1 Fetch categories for products in receipt (needed for category quests)
  const productIds = items.map((i) => i.product_id);
  let productCategories: Record<number, number> = {};
  if (productIds.length > 0) {
    const pcRes = await client.query(
      `SELECT id, category_id FROM warehouse_products WHERE id = ANY($1::int[])`,
      [productIds],
    );
    pcRes.rows.forEach((r) => {
      productCategories[r.id] = r.category_id;
    });
  }

  for (const quest of activeQuests) {
    await handleQuestProgress(client, clubId, playerId, quest, {
      type: "receipt",
      totalAmount,
      items,
      productCategories,
    });
  }

  // Update package loyalty progress
  try {
    const { processPackagePurchase } = await import("./promo-packages");
    await processPackagePurchase(client, clubId, playerId, items);
  } catch (err) {
    console.error("Failed to process package purchase loyalty:", err);
  }
}

/**
 * Processes game-related events.
 */
export async function processGameEvent(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  gameType: string,
  isWin: boolean,
  ticketsSpent: number,
) {
  const activeQuests = await getActiveQuestsForPlayer(client, clubId, playerId);
  const rewards: any[] = [];

  for (const quest of activeQuests) {
    const result = await handleQuestProgress(client, clubId, playerId, quest, {
      type: "game",
      gameType,
      isWin,
      ticketsSpent,
    });
    if (result && result.rewarded) {
      rewards.push({
        questTitle: quest.title,
        rewardXp: quest.reward_xp,
        rewardTickets: quest.reward_tickets,
        rewardBonusBalance: quest.reward_bonus_balance,
      });
    }
  }
  return rewards;
}

/**
 * Processes balance top-up events.
 */
export async function processBalanceTopupEvent(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  amount: number,
) {
  // 1. Fetch club settings for XP rules
  const clubRes = await client.query(
    `SELECT promo_settings FROM clubs WHERE id = $1`,
    [clubId],
  );
  const settings = clubRes.rows[0]?.promo_settings || {};
  const xpPer100 = settings.xp_per_100_rub ?? 100;

  // 1. Calculate and award base XP for the topup (e.g., 100 XP per 100 RUB)
  const xpEarned = Math.floor(amount / 100) * xpPer100;
  if (xpEarned > 0) {
    // This now updates both Permanent XP and Battle Pass XP
    await addPlayerXP(client, clubId, playerId, xpEarned, true);
  }

  const activeQuests = await getActiveQuestsForPlayer(client, clubId, playerId);

  for (const quest of activeQuests) {
    await handleQuestProgress(client, clubId, playerId, quest, {
      type: "topup",
      amount,
    });
  }
}

/**
 * Processes a service award action by the admin.
 */
export async function processServiceAwardEvent(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  serviceRuleId: number | string,
) {
  const activeQuests = await getActiveQuestsForPlayer(client, clubId, playerId);

  for (const quest of activeQuests) {
    await handleQuestProgress(client, clubId, playerId, quest, {
      type: "service",
      serviceRuleId,
    });
  }

  // Update manual service loyalty progress
  try {
    const { processManualServiceAward } = await import("./promo-packages");
    await processManualServiceAward(client, clubId, playerId, String(serviceRuleId));
  } catch (err) {
    console.error("Failed to process manual service award loyalty:", err);
  }
}

export function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Checks and resets player quests that have reached their cooldown/reset period.
 * This is executed in real-time when the PWA fetches quests, and when triggers occur.
 */
export async function checkAndResetPlayerQuests(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
) {
  const res = await client.query(
    `SELECT
       pq.id as player_quest_id,
       pq.current_progress,
       pq.status,
       pq.period_start,
       pq.completed_at,
       pq.claimed_at,
       q.id as quest_id,
       q.reset_period,
       q.reset_hours,
       COALESCE(c.timezone, 'Europe/Moscow') as timezone
     FROM promo_player_quests pq
     JOIN promo_quests q ON pq.quest_id = q.id
     JOIN clubs c ON c.id = pq.club_id
     WHERE pq.player_id = $1::uuid
       AND pq.club_id = $2::int
       AND q.reset_period != 'none'
       AND pq.status IN ('active', 'completed', 'claimed')`,
    [playerId, clubId],
  );

  const now = new Date();

  for (const row of res.rows) {
    let needsReset = false;
    const periodStart = new Date(row.period_start);
    
    // Determine the base time for cooldown. If completed_at exists, use it. Otherwise claimed_at, otherwise period_start
    const completedTime = row.completed_at ? new Date(row.completed_at) : null;
    const claimedTime = row.claimed_at ? new Date(row.claimed_at) : null;
    const baseCooldownTime = claimedTime || completedTime || periodStart;

    if (row.reset_period === "always") {
      needsReset = true;
    } else if (row.reset_period === "hours" && row.reset_hours) {
      const diffMs = now.getTime() - baseCooldownTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours >= row.reset_hours) {
        needsReset = true;
      }
    } else if (row.reset_period === "daily") {
      const tz = row.timezone;
      const nowStr = now.toLocaleDateString("en-US", { timeZone: tz });
      const startStr = periodStart.toLocaleDateString("en-US", { timeZone: tz });
      if (nowStr !== startStr) {
        needsReset = true;
      }
    } else if (row.reset_period === "weekly") {
      const startWeek = getWeekNumber(periodStart);
      const nowWeek = getWeekNumber(now);
      if (startWeek !== nowWeek || periodStart.getFullYear() !== now.getFullYear()) {
        needsReset = true;
      }
    } else if (row.reset_period === "monthly") {
      if (periodStart.getMonth() !== now.getMonth() || periodStart.getFullYear() !== now.getFullYear()) {
        needsReset = true;
      }
    }

    if (needsReset) {
      await client.query(
        `UPDATE promo_player_quests
         SET current_progress = 0,
             status = 'active',
             completed_at = NULL,
             claimed_at = NULL,
             verification_photo_url = NULL,
             period_start = NOW()
         WHERE id = $1::uuid`,
        [row.player_quest_id],
      );
    }
  }
}

/**
 * Helper to fetch active quests that the player hasn't completed yet.
 */
async function getActiveQuestsForPlayer(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
) {
  // First, check and reset any completed/claimed recurring quests
  await checkAndResetPlayerQuests(client, clubId, playerId);

  // We need to fetch quests that are active in the club,
  // and join with player progress to ensure they aren't already completed/claimed.
  // If the player doesn't have a progress row yet, we treat progress as 0.
  const res = await client.query(
    `SELECT
       q.id as quest_id,
       q.trigger_type,
       q.target_entity_id,
       q.target_entity_id_type,
       q.target_value,
       q.reward_xp,
       q.reward_tickets,
       q.reward_bonus_balance,
       q.reward_prize_id,
       COALESCE(pq.current_progress, 0) as current_progress,
       pq.id as player_quest_id,
       pq.period_start,
       q.reset_period,
       q.min_level,
       q.target_service_id,
       q.combo_triggers,
       pq.combo_progress,
       pq.last_visit_at
       FROM promo_quests q
       LEFT JOIN promo_player_quests pq ON pq.quest_id = q.id AND pq.player_id = $1::uuid
       JOIN promo_player_balances pb ON pb.player_id = $1::uuid AND pb.club_id = $2::int
       JOIN clubs c ON c.id = pb.club_id
       LEFT JOIN LATERAL (
         SELECT level_number
         FROM promo_levels
         WHERE club_id = $2::int AND xp_required <= pb.total_xp
         ORDER BY level_number DESC
         LIMIT 1
       ) AS current_lvl ON TRUE
       WHERE q.club_id = $2::int
         AND q.is_active = TRUE
         AND (pq.id IS NULL OR pq.status = 'active' OR pq.status = 'pending_verification')
         AND q.min_level <= COALESCE(current_lvl.level_number, 1)
         AND (q.available_days IS NULL OR (EXTRACT(DOW FROM timezone(COALESCE(c.timezone, 'Europe/Moscow'), now()))) = ANY(q.available_days))
         AND (q.time_start IS NULL OR (timezone(COALESCE(c.timezone, 'Europe/Moscow'), now()))::TIME >= q.time_start)
         AND (q.time_end IS NULL OR (timezone(COALESCE(c.timezone, 'Europe/Moscow'), now()))::TIME <= q.time_end)`,
    [playerId, clubId],
  );
  return res.rows;
}
/**
 * Increments progress and handles quest completion.
 */
export async function progressQuest(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  quest: any,
  delta: number,
) {
  const newProgress = Number(quest.current_progress) + delta;
  const target = Number(quest.target_value);
  const isCompleted = newProgress >= target;

  if (quest.player_quest_id) {
    await client.query(
      `UPDATE promo_player_quests
       SET current_progress = $1,
           status = $2::text,
           completed_at = CASE WHEN $2::text = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $3`,
      [
        Math.min(newProgress, target),
        isCompleted ? "completed" : "active",
        quest.player_quest_id,
      ],
    );
  } else {
    await client.query(
      `INSERT INTO promo_player_quests (player_id, club_id, quest_id, current_progress, status, completed_at)
       VALUES ($1, $2, $3, $4, $5::text, CASE WHEN $5::text = 'completed' THEN NOW() ELSE NULL END)`,
      [
        playerId,
        clubId,
        quest.quest_id,
        Math.min(newProgress, target),
        isCompleted ? "completed" : "active",
      ],
    );
  }

  if (isCompleted) {
    await rewardPlayerForQuest(client, clubId, playerId, quest);
    return { rewarded: true };
  }
  return { rewarded: false };
}

/**
 * Issues rewards when a quest is completed.
 */
export async function rewardPlayerForQuest(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  quest: any,
) {
  // Add XP and Bonus Balance
  const rewardXp = Number(quest.reward_xp || 0);
  const rewardBonusBalance = Number(quest.reward_bonus_balance || 0);
  if (rewardXp > 0 || rewardBonusBalance > 0) {
    // 1. Award XP (Quest XP also goes to BP, usually without money boosts unless specified)
    if (rewardXp > 0) {
      await addPlayerXP(client, clubId, playerId, rewardXp);
    }

    // 2. Award Bonus Balance
    if (rewardBonusBalance > 0) {
      await client.query(
        `UPDATE promo_player_balances
         SET bonus_balance = COALESCE(bonus_balance, 0) + $1::numeric,
             updated_at = NOW()
         WHERE player_id = $2::uuid AND club_id = $3::int`,
        [rewardBonusBalance, playerId, clubId],
      );
    }
  }

  // Issue Tickets
  const rewardTickets = Math.floor(Number(quest.reward_tickets || 0));
  if (rewardTickets > 0) {
    const expiryHours = 24; // Could be configurable, but default to 24h
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + expiryHours);

    await client.query(
      `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
       SELECT $1::uuid, $2::int, 'available', 'quest_reward', $3
       FROM generate_series(1, $4)`,
      [playerId, clubId, expiryDate, rewardTickets],
    );
  }

  // Handle specific prize reward if configured
  if (quest.reward_prize_id) {
    // 1. Insert into history
    const histRes = await client.query(
      `INSERT INTO promo_history (player_id, club_id, game_type, prize_id, result_data)
       VALUES ($1::uuid, $2::int, 'QUEST_REWARD', $3, $4)
       RETURNING id`,
      [
        playerId,
        clubId,
        quest.reward_prize_id,
        JSON.stringify({ quest_id: quest.quest_id }),
      ],
    );
    const historyId = histRes.rows[0].id;

    // 2. If it's a physical prize, add to queue
    const prizeRes = await client.query(
      `SELECT type FROM promo_prizes WHERE id = $1`,
      [quest.reward_prize_id],
    );
    if (prizeRes.rows[0]?.type === "physical") {
      await client.query(
        `INSERT INTO promo_prize_queue (history_id, player_id, club_id, prize_id, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [historyId, playerId, clubId, quest.reward_prize_id],
      );
    }
  }
  // Send notification to player PWA (if implemented via SSE)
  try {
    await client.query(
      `SELECT pg_notify('promo_quest_completed', json_build_object('player_id', $1::text, 'club_id', $2::text, 'quest_id', $3::text)::text)`,
      [playerId, clubId, quest.quest_id],
    );
  } catch (e) {
    // ignore
  }
}

/**
 * Adds XP to a player and checks for level up (optional notification logic).
 */
export async function addPlayerXP(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  xpAmount: number,
  isMoneyBased: boolean = false,
) {
  // 1. Add to Battle Pass (if active)
  const { addXPToBP } = await import("./promo-bp");
  const finalXP = await addXPToBP(
    client,
    clubId,
    playerId,
    xpAmount,
    isMoneyBased,
  );

  // 2. Update Permanent Global Balance
  await client.query(
    `INSERT INTO promo_player_balances (player_id, club_id, total_xp)
     VALUES ($1::uuid, $2::int, $3::numeric)
     ON CONFLICT (player_id, club_id)
     DO UPDATE SET total_xp = COALESCE(promo_player_balances.total_xp, 0) + $3::numeric,
                   updated_at = NOW()`,
    [playerId, clubId, finalXP || xpAmount],
  );
}

/**
 * Calculates current level details based on XP and promo_levels table.
 */
export async function getPlayerLevelInfo(
  client: PoolClient,
  clubId: number | string,
  totalXp: number,
) {
  // Find the highest level where xp_required <= totalXp
  const levelRes = await client.query(
    `SELECT level_number, xp_required
     FROM promo_levels
     WHERE club_id = $1::int AND xp_required <= $2::numeric
     ORDER BY level_number DESC
     LIMIT 1`,
    [clubId, totalXp],
  );

  const currentLevel = levelRes.rows[0] || { level_number: 1, xp_required: 0 };

  // Find the next level
  const nextLevelRes = await client.query(
    `SELECT level_number, xp_required
     FROM promo_levels
     WHERE club_id = $1::int AND level_number > $2::int
     ORDER BY level_number ASC
     LIMIT 1`,
    [clubId, currentLevel.level_number],
  );

  const nextLevel = nextLevelRes.rows[0] || null;

  // Progress within current level: (totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)
  // If no next level, we are at MAX level.
  const progressXp = totalXp - currentLevel.xp_required;
  const targetXp = nextLevel
    ? nextLevel.xp_required - currentLevel.xp_required
    : null;

  return {
    currentLevel: currentLevel.level_number,
    currentLevelXp: currentLevel.xp_required,
    nextLevel: nextLevel ? nextLevel.level_number : null,
    nextLevelXp: nextLevel ? nextLevel.xp_required : null,
    totalXp: totalXp,
    progressXp,
    targetXp,
    isMaxLevel: !nextLevel,
  };
}

/**
 * Processes confirmed daily player visit events.
 * Updates both visit_cumulative and visit_streak active quests.
 */
export async function processVisitEvent(
  client: any,
  clubId: number | string,
  playerId: string,
  seatNumber?: string,
) {
  const activeQuests = await getActiveQuestsForPlayer(client, clubId, playerId);
  const confirmedAt = new Date();

  for (const quest of activeQuests) {
    const isCombo = quest.combo_triggers && Array.isArray(quest.combo_triggers) && quest.combo_triggers.length > 0;

    if (isCombo) {
      let comboProgress = quest.combo_progress || {};
      if (typeof comboProgress === "string") {
        try {
          comboProgress = JSON.parse(comboProgress);
        } catch (e) {
          comboProgress = {};
        }
      }

      let progressChanged = false;

      for (let i = 0; i < quest.combo_triggers.length; i++) {
        const subTrigger = quest.combo_triggers[i];
        if (subTrigger.trigger_type === "visit_cumulative" || subTrigger.trigger_type === "visit_streak") {
          let delta = 1;

          if (subTrigger.trigger_type === "visit_streak") {
            const qProgressRes = await client.query(
              `SELECT last_visit_at FROM promo_player_quests
               WHERE quest_id = $1 AND player_id = $2
               ORDER BY assigned_at DESC LIMIT 1`,
              [quest.quest_id, playerId]
            );

            if (qProgressRes.rows.length > 0) {
              const lastVisit = qProgressRes.rows[0].last_visit_at ? new Date(qProgressRes.rows[0].last_visit_at) : null;
              if (lastVisit) {
                const lastVisitDate = new Date(lastVisit.getFullYear(), lastVisit.getMonth(), lastVisit.getDate());
                const currentDate = new Date(confirmedAt.getFullYear(), confirmedAt.getMonth(), confirmedAt.getDate());
                const diffTime = Math.abs(currentDate.getTime() - lastVisitDate.getTime());
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                  continue; // Already processed today
                } else if (diffDays === 1) {
                  delta = 1;
                } else {
                  // Streak broken! Reset progress
                  comboProgress[String(i)] = 0;
                  delta = 1;
                }
              }
            }
          }

          const current = Number(comboProgress[String(i)] || 0);
          const target = Number(subTrigger.target_value || 1);
          comboProgress[String(i)] = Math.min(target, current + delta);
          progressChanged = true;
        }
      }

      if (progressChanged) {
        const allSatisfied = quest.combo_triggers.every((subTrigger: any, i: number) => {
          const current = Number(comboProgress[String(i)] || 0);
          const target = Number(subTrigger.target_value || 1);
          return current >= target;
        });

        const newStatus = allSatisfied ? "completed" : "active";

        if (quest.player_quest_id) {
          await client.query(
            `UPDATE promo_player_quests
             SET combo_progress = $1,
                 status = $2::text,
                 last_visit_at = NOW(),
                 seat_number = COALESCE(seat_number, $4),
                 completed_at = CASE WHEN $2::text = 'completed' THEN NOW() ELSE completed_at END
             WHERE id = $3`,
            [JSON.stringify(comboProgress), newStatus, quest.player_quest_id, seatNumber || null]
          );
        } else {
          await client.query(
            `INSERT INTO promo_player_quests (player_id, club_id, quest_id, combo_progress, status, last_visit_at, seat_number, completed_at)
             VALUES ($1, $2, $3, $4, $5::text, NOW(), $6, CASE WHEN $5::text = 'completed' THEN NOW() ELSE NULL END)`,
            [playerId, clubId, quest.quest_id, JSON.stringify(comboProgress), newStatus, seatNumber || null]
          );
        }

        if (allSatisfied) {
          await rewardPlayerForQuest(client, clubId, playerId, quest);
        }
      }
    } else {
      // Non-combo visit logic (standard)
      if (quest.trigger_type === "visit_cumulative") {
        const lastVisit = quest.last_visit_at ? new Date(quest.last_visit_at) : null;
        if (lastVisit) {
          const lastVisitDate = new Date(lastVisit.getFullYear(), lastVisit.getMonth(), lastVisit.getDate());
          const currentDate = new Date(confirmedAt.getFullYear(), confirmedAt.getMonth(), confirmedAt.getDate());
          const diffDays = Math.round((currentDate.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 0) {
            continue; // Already processed today
          }
        }

        await progressQuest(client, clubId, playerId, quest, 1);
        await client.query(
          `UPDATE promo_player_quests
           SET last_visit_at = NOW(),
               seat_number = COALESCE(seat_number, $3)
           WHERE id = (
             SELECT id FROM promo_player_quests
             WHERE quest_id = $1 AND player_id = $2
             AND status IN ('active', 'completed')
             ORDER BY assigned_at DESC LIMIT 1
           )`,
          [quest.quest_id, playerId, seatNumber || null],
        );
      } else if (quest.trigger_type === "visit_streak") {
        let delta = 1;
        const qProgressRes = await client.query(
          `SELECT current_progress, last_visit_at
           FROM promo_player_quests
           WHERE quest_id = $1 AND player_id = $2
           ORDER BY assigned_at DESC LIMIT 1`,
          [quest.quest_id, playerId],
        );

        if (qProgressRes.rows.length > 0) {
          const lastVisit = qProgressRes.rows[0].last_visit_at ? new Date(qProgressRes.rows[0].last_visit_at) : null;
          if (lastVisit) {
            const lastVisitDate = new Date(lastVisit.getFullYear(), lastVisit.getMonth(), lastVisit.getDate());
            const currentDate = new Date(confirmedAt.getFullYear(), confirmedAt.getMonth(), confirmedAt.getDate());
            const diffTime = Math.abs(currentDate.getTime() - lastVisitDate.getTime());
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
              continue;
            } else if (diffDays === 1) {
              delta = 1;
            } else {
              // Streak broken! Reset progress in-memory, progressQuest will write the updated value
              quest.current_progress = 0;
              delta = 1;
            }
          }
        }

        await progressQuest(client, clubId, playerId, quest, delta);
        await client.query(
          `UPDATE promo_player_quests
           SET last_visit_at = NOW(),
               seat_number = COALESCE(seat_number, $3)
           WHERE id = (
             SELECT id FROM promo_player_quests
             WHERE quest_id = $1 AND player_id = $2
             AND status IN ('active', 'completed')
             ORDER BY assigned_at DESC LIMIT 1
           )`,
          [quest.quest_id, playerId, seatNumber || null],
        );
      }
    }
  }

  // Update visit loyalty progress
  try {
    const { processPlayerVisit } = await import("./promo-packages");
    await processPlayerVisit(client, clubId, playerId);
  } catch (err) {
    console.error("Failed to process player visit loyalty:", err);
  }
}
