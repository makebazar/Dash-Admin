import { PoolClient } from "pg";

export interface LoyaltyItem {
  product_id?: number;
  service_id?: string;
  quantity: number;
}

export interface LoyaltyProgram {
  id: string;
  enabled: boolean;
  type: "package_accumulation" | "visit_accumulation" | "visit_streak";
  title: string;
  target: number;
  trigger_product_ids?: number[];
  trigger_service_ids?: string[];
  rewards?: {
    xp?: number;
    tickets?: number;
    bonus_balance?: number;
    free_package?: boolean;
    free_package_name?: string;
    free_package_quantity?: number;
    bar_reward_type?: "none" | "product" | "category";
    bar_product_id?: number | null;
    bar_category_id?: string | null;
    bar_reward_quantity?: number;
  };
}

/**
 * Gets all active loyalty programs from club settings.
 * Supports new array format (loyalty_programs) with backward-compat for old flat fields.
 */
function getActivePrograms(settings: any): LoyaltyProgram[] {
  // New format: array of programs
  if (Array.isArray(settings.loyalty_programs) && settings.loyalty_programs.length > 0) {
    return settings.loyalty_programs.filter((p: any) => p.enabled);
  }

  // Backward compat: convert old flat fields to program array
  const programs: LoyaltyProgram[] = [];
  if (settings.packages_promo_enabled) {
    programs.push({
      id: "legacy_packages",
      enabled: true,
      type: "package_accumulation",
      title: settings.packages_accumulation_reward_name || "Бесплатный пакет",
      target: settings.packages_accumulation_target || 5,
      trigger_product_ids: settings.accumulation_product_ids || [],
      trigger_service_ids: settings.accumulation_service_ids || [],
      rewards: {
        free_package: settings.packages_accumulation_reward_type === "free_package",
        free_package_name: settings.packages_accumulation_reward_name || "",
        xp: settings.packages_accumulation_reward_type === "xp" ? (settings.packages_accumulation_reward_value || 0) : 0,
        tickets: settings.packages_accumulation_reward_type === "ticket" ? (settings.packages_accumulation_reward_value || 0) : 0,
        bonus_balance: settings.packages_accumulation_reward_type === "bonus_balance" ? (settings.packages_accumulation_reward_value || 0) : 0,
      },
    });
  }
  if (settings.packages_visits_enabled) {
    programs.push({
      id: "legacy_visits",
      enabled: true,
      type: "visit_accumulation",
      title: settings.packages_visits_reward_name || "Подарок за посещения",
      target: settings.packages_visits_target || 10,
      rewards: {
        free_package: settings.packages_visits_reward_type === "free_package",
        free_package_name: settings.packages_visits_reward_name || "",
        xp: settings.packages_visits_reward_type === "xp" ? (settings.packages_visits_reward_value || 0) : 0,
        tickets: settings.packages_visits_reward_type === "ticket" ? (settings.packages_visits_reward_value || 0) : 0,
        bonus_balance: settings.packages_visits_reward_type === "bonus_balance" ? (settings.packages_visits_reward_value || 0) : 0,
      },
    });
  }
  if (settings.packages_streak_enabled) {
    programs.push({
      id: "legacy_streak",
      enabled: true,
      type: "visit_streak",
      title: settings.packages_streak_reward_name || "Приз за стрик",
      target: settings.packages_streak_target || 2,
      rewards: {
        free_package: settings.packages_streak_reward_type === "free_package",
        free_package_name: settings.packages_streak_reward_name || "",
        xp: settings.packages_streak_reward_type === "xp" ? (settings.packages_streak_reward_value || 0) : 0,
        tickets: settings.packages_streak_reward_type === "ticket" ? (settings.packages_streak_reward_value || 0) : 0,
        bonus_balance: settings.packages_streak_reward_type === "bonus_balance" ? (settings.packages_streak_reward_value || 0) : 0,
      },
    });
  }
  return programs;
}

/**
 * Checks if an item matches a program's trigger filter.
 * Empty filter means all items match.
 */
function itemMatchesProgram(item: LoyaltyItem, program: LoyaltyProgram): boolean {
  const productIds = program.trigger_product_ids || [];
  const serviceIds = program.trigger_service_ids || [];

  // If no filters set — all items count
  if (productIds.length === 0 && serviceIds.length === 0) return true;

  if (item.product_id !== undefined && productIds.includes(Number(item.product_id))) return true;
  if (item.service_id !== undefined && serviceIds.includes(String(item.service_id))) return true;
  return false;
}

/**
 * Issues/**
 * Issues rewards for a completed loyalty program.
 */
export async function issueRewards(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  program: LoyaltyProgram
) {
  const rewards = program.rewards || {};
  const prizeName = program.title || "Приз за лояльность";

  // XP
  if ((rewards.xp || 0) > 0) {
    const { addPlayerXP } = await import("@/lib/promo-quests");
    await addPlayerXP(client, Number(clubId), playerId, Math.floor(rewards.xp!));
  }

  // Tickets
  if ((rewards.tickets || 0) > 0) {
    await client.query(
      `INSERT INTO promo_tickets (player_id, club_id, status, source)
       SELECT $1::uuid, $2::int, 'available', 'loyalty_reward'
       FROM generate_series(1, $3)`,
      [playerId, Number(clubId), Math.floor(rewards.tickets!)]
    );
  }

  // Bonus balance
  if ((rewards.bonus_balance || 0) > 0) {
    await client.query(
      `UPDATE promo_player_balances
       SET bonus_balance = COALESCE(bonus_balance, 0) + $1, updated_at = NOW()
       WHERE player_id = $2::uuid AND club_id = $3::int`,
      [rewards.bonus_balance, playerId, Number(clubId)]
    );
  }

  // Free package — add to prize queue for cashier to issue
  if (rewards.free_package) {
    const playerRes = await client.query(
      `SELECT full_name, phone FROM players WHERE id = $1::uuid`,
      [playerId]
    );
    const player = playerRes.rows[0];
    const freeQty = Math.max(1, rewards.free_package_quantity || 1);
    const freeQtySuffix = freeQty > 1 ? ` (x${freeQty})` : "";

    await client.query(
      `INSERT INTO promo_prize_queue (
        club_id, player_id, player_name, player_phone,
        prize_name, prize_type, loyalty_type, status, reward_value
      ) VALUES ($1, $2::uuid, $3, $4, $5, 'free_package', $6, 'pending', $7)`,
      [
        clubId,
        playerId,
        player?.full_name || "Гость",
        player?.phone || "",
        `${rewards.free_package_name || prizeName}${freeQtySuffix}`,
        program.id,
        freeQty,
      ]
    );
  }

  if (rewards.bar_reward_type && rewards.bar_reward_type !== "none") {
    let barPrizeName = "";
    let barProductId: number | null = null;
    const barQty = Math.max(1, rewards.bar_reward_quantity || 1);
    const qtySuffix = barQty > 1 ? ` (x${barQty})` : "";

    if (rewards.bar_reward_type === "product" && rewards.bar_product_id) {
      barProductId = rewards.bar_product_id;
      const prodRes = await client.query(
        `SELECT name, quantity FROM products WHERE id = $1`,
        [rewards.bar_product_id]
      );
      barPrizeName = prodRes.rows[0]?.name
        ? `🍹 Из бара: ${prodRes.rows[0].name}${qtySuffix}`
        : "🍹 Подарок из бара";
    } else if (rewards.bar_reward_type === "category" && rewards.bar_category_id) {
      // Pick a random available product from the category
      const prodRes = await client.query(
        `SELECT id, name FROM products
         WHERE category_id = $1
           AND club_id = $2
           AND (quantity IS NULL OR quantity > 0)
         ORDER BY RANDOM() LIMIT 1`,
        [rewards.bar_category_id, clubId]
      );
      if (prodRes.rows[0]) {
        barProductId = prodRes.rows[0].id;
        barPrizeName = `🍹 Из бара: ${prodRes.rows[0].name}${qtySuffix}`;
      } else {
        barPrizeName = "🍹 Случайный подарок из бара";
      }
    }

    if (barPrizeName) {
      const playerRes = await client.query(
        `SELECT full_name, phone FROM players WHERE id = $1::uuid`,
        [playerId]
      );
      const player = playerRes.rows[0];

      await client.query(
        `INSERT INTO promo_prize_queue (
          club_id, player_id, player_name, player_phone,
          prize_name, prize_type, bar_product_id, deduct_inventory, loyalty_type, status, reward_value
        ) VALUES ($1, $2::uuid, $3, $4, $5, 'bar_item', $6, $7, $8, 'pending', $9)`,
        [
          clubId,
          playerId,
          player?.full_name || "Гость",
          player?.phone || "",
          barPrizeName,
          barProductId,
          barProductId !== null, // deduct only if we know the product
          program.id,
          barQty,
        ]
      );
    }
  }
}

/**
 * Gets or creates per-program progress record.
 */
async function getOrCreateProgramProgress(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  programId: string
): Promise<{ current_count: number; last_event_date: string | null }> {
  await client.query(
    `INSERT INTO promo_package_progress (player_id, club_id, program_id, current_count, last_event_date)
     VALUES ($1::uuid, $2::int, $3, 0, NULL)
     ON CONFLICT (player_id, club_id, program_id) DO NOTHING`,
    [playerId, clubId, programId]
  );

  const res = await client.query(
    `SELECT current_count, last_event_date
     FROM promo_package_progress
     WHERE player_id = $1::uuid AND club_id = $2::int AND program_id = $3
     FOR UPDATE`,
    [playerId, clubId, programId]
  );

  return res.rows[0] || { current_count: 0, last_event_date: null };
}

/**
 * Handles package/service purchase — updates accumulation progress for matching programs.
 */
export async function processPackagePurchase(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  items: LoyaltyItem[]
) {
  const clubRes = await client.query(
    `SELECT promo_settings, timezone FROM clubs WHERE id = $1`,
    [clubId]
  );
  if (clubRes.rowCount === 0) return;

  const settings = clubRes.rows[0]?.promo_settings || {};
  const timezone = clubRes.rows[0]?.timezone || "Europe/Moscow";
  const programs = getActivePrograms(settings);

  const packagePrograms = programs.filter(
    (p) => p.type === "package_accumulation" || p.type === "visit_streak"
  );
  if (packagePrograms.length === 0) return;

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString("en-CA", { timeZone: timezone });

  // Resolve product names from database if any product_ids are present in items
  const productIds = items
    .map((item) => item.product_id)
    .filter((id): id is number => id !== undefined);

  let productNamesMap: Record<number, string> = {};
  if (productIds.length > 0) {
    const prodRes = await client.query(
      `SELECT id, name FROM products WHERE id = ANY($1::int[])`,
      [productIds]
    );
    prodRes.rows.forEach((row) => {
      productNamesMap[row.id] = row.name;
    });
  }

  const serviceRules = settings.service_rules || [];

  // Enhance items with service_id if product name matches a service rule name (case-insensitive)
  const enhancedItems = items.map((item) => {
    if (item.product_id !== undefined && !item.service_id) {
      const prodName = productNamesMap[item.product_id]?.trim().toLowerCase();
      if (prodName) {
        const matchedRule = serviceRules.find(
          (r: any) => r.name?.trim().toLowerCase() === prodName
        );
        if (matchedRule) {
          return {
            ...item,
            service_id: String(matchedRule.id),
          };
        }
      }
    }
    return item;
  });

  for (const program of packagePrograms) {
    // Filter items matching this program using enhanced items
    const matchingItems = enhancedItems.filter((item) => itemMatchesProgram(item, program));
    if (matchingItems.length === 0) continue;

    const totalQty = matchingItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    if (totalQty <= 0) continue;

    const progress = await getOrCreateProgramProgress(client, clubId, playerId, program.id);
    let newCount = progress.current_count;
    const lastDateStr = progress.last_event_date
      ? new Date(progress.last_event_date).toLocaleDateString("en-CA", { timeZone: timezone })
      : null;

    if (program.type === "package_accumulation") {
      newCount += totalQty;
    } else if (program.type === "visit_streak") {
      // Streak: consecutive days of purchases
      if (lastDateStr === todayStr) {
        // Already counted today
      } else if (lastDateStr === yesterdayStr) {
        newCount += 1;
      } else {
        newCount = 1; // restart
      }
    }

    // Check if target reached, cap count at target
    const target = program.target || 5;
    const finalCount = Math.min(newCount, target);

    await client.query(
      `UPDATE promo_package_progress
       SET current_count = $1, last_event_date = $2::date, updated_at = NOW()
       WHERE player_id = $3::uuid AND club_id = $4::int AND program_id = $5`,
      [finalCount, todayStr, playerId, clubId, program.id]
    );
  }
}

/**
 * Handles confirmed player visit — updates visit accumulation programs.
 */
export async function processPlayerVisit(
  client: PoolClient,
  clubId: number | string,
  playerId: string
) {
  const clubRes = await client.query(
    `SELECT promo_settings, timezone FROM clubs WHERE id = $1`,
    [clubId]
  );
  if (clubRes.rowCount === 0) return;

  const settings = clubRes.rows[0]?.promo_settings || {};
  const timezone = clubRes.rows[0]?.timezone || "Europe/Moscow";
  const programs = getActivePrograms(settings);

  const visitPrograms = programs.filter((p) => p.type === "visit_accumulation");
  if (visitPrograms.length === 0) return;

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone });

  for (const program of visitPrograms) {
    const progress = await getOrCreateProgramProgress(client, clubId, playerId, program.id);

    const lastDateStr = progress.last_event_date
      ? new Date(progress.last_event_date).toLocaleDateString("en-CA", { timeZone: timezone })
      : null;

    // Prevent double-counting same day
    if (lastDateStr === todayStr) continue;

    const newCount = progress.current_count + 1;
    const target = program.target || 10;
    const finalCount = Math.min(newCount, target);

    await client.query(
      `UPDATE promo_package_progress
       SET current_count = $1, last_event_date = $2::date, updated_at = NOW()
       WHERE player_id = $3::uuid AND club_id = $4::int AND program_id = $5`,
      [finalCount, todayStr, playerId, clubId, program.id]
    );
  }
}

/**
 * Handles manual service award — passes through to processPackagePurchase.
 */
export async function processManualServiceAward(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  serviceRuleId: string
) {
  await processPackagePurchase(client, clubId, playerId, [
    { service_id: String(serviceRuleId), quantity: 1 },
  ]);
}
