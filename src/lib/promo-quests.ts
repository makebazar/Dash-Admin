import { PoolClient } from "pg";

export type ReceiptItem = {
  product_id: number;
  quantity: number;
};

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
  // 1. Calculate and award base XP for the purchase (e.g., 10 XP per 100 RUB)
  const xpEarned = Math.floor(totalAmount / 100) * 10;
  if (xpEarned > 0) {
    await addPlayerXP(client, clubId, playerId, xpEarned);
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
    let progressDelta = 0;

    if (quest.trigger_type === "receipt_total") {
      if (totalAmount >= Number(quest.target_value)) {
        progressDelta = Number(quest.target_value);
      }
    } else if (quest.trigger_type === "total_spent_accumulative") {
      progressDelta = totalAmount;
    } else if (
      quest.trigger_type === "receipt_item" &&
      quest.target_entity_id
    ) {
      const targetId = Number(quest.target_entity_id);

      if (quest.target_entity_id_type === "category") {
        // Any item from this category matches
        const matchingItems = items.filter(
          (i) => productCategories[i.product_id] === targetId,
        );
        progressDelta = matchingItems.reduce((sum, i) => sum + i.quantity, 0);
      } else {
        // Specific product ID
        const matchingItem = items.find((i) => i.product_id === targetId);
        if (matchingItem) {
          progressDelta = matchingItem.quantity;
        }
      }
    }

    if (progressDelta > 0) {
      await progressQuest(client, clubId, playerId, quest, progressDelta);
    }
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

  for (const quest of activeQuests) {
    // Check for target game filter if specified
    const isTargetAll =
      !quest.target_entity_id || quest.target_entity_id === "";
    const isMatchingGame =
      isTargetAll || String(quest.target_entity_id) === String(gameType);

    if (!isMatchingGame) continue;

    let delta = 0;
    if (quest.trigger_type === "game_play_count") {
      delta = 1;
    } else if (quest.trigger_type === "game_win_count" && isWin) {
      delta = 1;
    } else if (quest.trigger_type === "ticket_spend" && ticketsSpent > 0) {
      delta = ticketsSpent;
    }

    if (delta > 0) {
      await progressQuest(client, clubId, playerId, quest, delta);
    }
  }
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
  const activeQuests = await getActiveQuestsForPlayer(client, clubId, playerId);

  for (const quest of activeQuests) {
    if (quest.trigger_type === "balance_topup") {
      await progressQuest(client, clubId, playerId, quest, amount);
    }
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
    const isTargetAll =
      !quest.target_entity_id || quest.target_entity_id === "";
    const isMatchingService =
      isTargetAll || String(quest.target_entity_id) === String(serviceRuleId);

    if (
      quest.trigger_type === "service_award" ||
      quest.trigger_type === "service_accumulative"
    ) {
      if (isMatchingService) {
        await progressQuest(client, clubId, playerId, quest, 1);
      }
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
  // We need to fetch quests that are active in the club,
  // and join with player progress to ensure they aren't already completed/claimed.
  // If the player doesn't have a progress row yet, we create it dynamically or just treat progress as 0.
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
       q.min_level
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
  const quests = res.rows;

  // Apply reset logic
  for (const quest of quests) {
    if (quest.player_quest_id && quest.reset_period !== "none") {
      const periodStart = new Date(quest.period_start);
      const now = new Date();
      let needsReset = false;

      if (quest.reset_period === "weekly") {
        // Check if different week
        const startWeek = getWeekNumber(periodStart);
        const nowWeek = getWeekNumber(now);
        if (
          startWeek !== nowWeek ||
          periodStart.getFullYear() !== now.getFullYear()
        )
          needsReset = true;
      } else if (quest.reset_period === "monthly") {
        if (
          periodStart.getMonth() !== now.getMonth() ||
          periodStart.getFullYear() !== now.getFullYear()
        )
          needsReset = true;
      }

      if (needsReset) {
        await client.query(
          `UPDATE promo_player_quests SET current_progress = 0, period_start = NOW() WHERE id = $1::uuid`,
          [quest.player_quest_id],
        );
        quest.current_progress = 0;
      }
    }
  }

  return quests;
}

function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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
  }
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
  if (quest.reward_xp > 0 || quest.reward_bonus_balance > 0) {
    await client.query(
      `UPDATE promo_player_balances
       SET total_xp = COALESCE(total_xp, 0) + $1::numeric,
           bonus_balance = COALESCE(bonus_balance, 0) + $2::numeric,
           updated_at = NOW()
       WHERE player_id = $3::uuid AND club_id = $4::int`,
      [quest.reward_xp, quest.reward_bonus_balance, playerId, clubId],
    );
  }

  // Issue Tickets
  if (quest.reward_tickets > 0) {
    const expiryHours = 24; // Could be configurable, but default to 24h
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + expiryHours);

    await client.query(
      `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
       SELECT $1::uuid, $2::int, 'available', 'quest_reward', $3
       FROM generate_series(1, $4)`,
      [playerId, clubId, expiryDate, quest.reward_tickets],
    );
  }

  // Handle specific prize reward if configured
  if (quest.reward_prize_id) {
    // Insert into history
    await client.query(
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
) {
  await client.query(
    `INSERT INTO promo_player_balances (player_id, club_id, total_xp)
     VALUES ($1::uuid, $2::int, $3::numeric)
     ON CONFLICT (player_id, club_id)
     DO UPDATE SET total_xp = COALESCE(promo_player_balances.total_xp, 0) + $3::numeric,
                   updated_at = NOW()`,
    [playerId, clubId, xpAmount],
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
