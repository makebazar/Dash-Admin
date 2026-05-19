import { PoolClient } from "pg";

export type BPRewardType = "bonus_balance" | "ticket" | "bar_item" | "xp_boost";

export interface BPReward {
  level_number: number;
  reward_type: BPRewardType;
  reward_value: number;
  reward_name: string;
  is_premium: boolean;
}

/**
 * Accrues XP for a player in the current active BP season.
 * 1 RUB = X XP (modified by boosts).
 */
export async function accrueBPXP(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  amount: number,
  source: string = "purchase",
) {
  // 1. Find active season and get multiplier
  const seasonRes = await client.query(
    `SELECT s.id, c.promo_settings
     FROM promo_bp_seasons s
     JOIN clubs c ON c.id = s.club_id
     WHERE s.club_id = $1 AND s.is_active = TRUE
       AND NOW() BETWEEN s.start_date AND s.end_date
     LIMIT 1`,
    [clubId],
  );

  if (seasonRes.rowCount === 0) return;
  const { id: seasonId, promo_settings } = seasonRes.rows[0];
  const settings = promo_settings || {};
  const bpXpMultiplier = settings.bp_xp_per_rub ?? 1;

  // 2. Base XP from amount
  let xpToAdd = Math.floor(amount * bpXpMultiplier);
  if (xpToAdd <= 0) return;

  // 3. Add to BP (boosts are handled inside addXPToBP or here? Let's handle here for money-based XP)
  await addXPToBP(client, clubId, playerId, xpToAdd, true);
}

/**
 * Directly adds XP to the current active Battle Pass season.
 * @param applyBoost If true, will double XP if the player has an active boost.
 */
export async function addXPToBP(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  xpAmount: number,
  applyBoost: boolean = false,
) {
  // 1. Find active season
  const seasonRes = await client.query(
    `SELECT id FROM promo_bp_seasons
     WHERE club_id = $1 AND is_active = TRUE
       AND NOW() BETWEEN start_date AND end_date
     LIMIT 1`,
    [clubId],
  );

  if (seasonRes.rowCount === 0) return;
  const seasonId = seasonRes.rows[0].id;

  // 2. Get or create player progress
  const progressRes = await client.query(
    `INSERT INTO promo_bp_player_progress (player_id, season_id)
     VALUES ($1, $2)
     ON CONFLICT (player_id, season_id) DO UPDATE
     SET updated_at = NOW()
     RETURNING *`,
    [playerId, seasonId],
  );
  let progress = progressRes.rows[0];

  // 3. Apply boost if requested
  let finalXP = xpAmount;
  const now = new Date();
  if (
    applyBoost &&
    progress.boost_expires_at &&
    new Date(progress.boost_expires_at) > now
  ) {
    finalXP *= 2;
  }

  // 4. Update XP
  const updatedProgressRes = await client.query(
    `UPDATE promo_bp_player_progress
     SET current_xp = current_xp + $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [finalXP, progress.id],
  );
  progress = updatedProgressRes.rows[0];

  // 5. Check for new rewards
  await checkAndAwardBPRewards(client, clubId, playerId, progress, seasonId);
  return finalXP;
}

/**
 * Checks if the player has reached new levels and awards rewards.
 */
async function checkAndAwardBPRewards(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  progress: any,
  seasonId: string,
) {
  // Fetch all tiers for this season up to current XP
  const tiersRes = await client.query(
    `SELECT * FROM promo_bp_tiers
     WHERE season_id = $1 AND xp_required <= $2
     ORDER BY level_number ASC, is_premium ASC`,
    [seasonId, progress.current_xp],
  );

  const claimedRewards = progress.claimed_rewards || [];

  for (const tier of tiersRes.rows) {
    // Check if already claimed
    const alreadyClaimed = claimedRewards.some(
      (r: any) =>
        r.level === tier.level_number && r.is_premium === tier.is_premium,
    );

    if (alreadyClaimed) continue;

    // Premium check
    if (tier.is_premium && !progress.has_premium) continue;

    // Award reward
    await issueBPReward(client, clubId, playerId, tier, progress.id);

    // Mark as claimed
    await client.query(
      `UPDATE promo_bp_player_progress
       SET claimed_rewards = claimed_rewards || $1::jsonb
       WHERE id = $2`,
      [
        JSON.stringify({
          level: tier.level_number,
          is_premium: tier.is_premium,
          claimed_at: new Date().toISOString(),
          type: tier.reward_type,
        }),
        progress.id,
      ],
    );
  }
}

/**
 * Handles the actual awarding of a BP reward.
 */
async function issueBPReward(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  tier: any,
  progressId: string,
) {
  const { reward_type, reward_value, reward_name } = tier;

  if (reward_type === "bonus_balance") {
    await client.query(
      `UPDATE promo_player_balances
       SET bonus_balance = bonus_balance + $1, updated_at = NOW()
       WHERE player_id = $2 AND club_id = $3`,
      [reward_value, playerId, clubId],
    );
  } else if (reward_type === "ticket") {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 24); // 24h tickets
    await client.query(
      `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
       SELECT $1, $2, 'available', 'bp_reward', $3
       FROM generate_series(1, $4)`,
      [playerId, clubId, expiryDate, Math.floor(reward_value)],
    );
  } else if (reward_type === "xp_boost") {
    // Set or extend boost by 24 hours
    await client.query(
      `UPDATE promo_bp_player_progress
       SET boost_expires_at = CASE
           WHEN boost_expires_at > NOW() THEN boost_expires_at + interval '24 hours'
           ELSE NOW() + interval '24 hours'
       END
       WHERE id = $1`,
      [progressId],
    );
  } else if (reward_type === "bar_item") {
    // Add to prize queue for admin to give out
    // We need to create a history entry first
    const histRes = await client.query(
      `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
       VALUES ($1, $2, 'BP_REWARD', $3)
       RETURNING id`,
      [
        playerId,
        clubId,
        JSON.stringify({ tier_level: tier.level_number, reward_name }),
      ],
    );
    const historyId = histRes.rows[0].id;

    await client.query(
      `INSERT INTO promo_prize_queue (history_id, player_id, club_id, prize_id, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [
        historyId,
        playerId,
        clubId,
        reward_value, // Here reward_value should be the product_id or prize_id from promo_prizes
      ],
    );
  }
}

/**
 * Manually activate Premium BP for a player.
 */
export async function activatePremiumBP(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
) {
  const seasonRes = await client.query(
    `SELECT id FROM promo_bp_seasons
     WHERE club_id = $1 AND is_active = TRUE
       AND NOW() BETWEEN start_date AND end_date
     LIMIT 1`,
    [clubId],
  );

  if (seasonRes.rowCount === 0) throw new Error("Нет активного сезона БП");
  const seasonId = seasonRes.rows[0].id;

  const res = await client.query(
    `INSERT INTO promo_bp_player_progress (player_id, season_id, has_premium, activated_at)
     VALUES ($1, $2, TRUE, NOW())
     ON CONFLICT (player_id, season_id) DO UPDATE
     SET has_premium = TRUE, activated_at = NOW(), updated_at = NOW()
     RETURNING *`,
    [playerId, seasonId],
  );

  // After activation, check if they unlocked any premium rewards for levels they already reached
  await checkAndAwardBPRewards(client, clubId, playerId, res.rows[0], seasonId);

  return res.rows[0];
}

/**
 * Fetches the current BP status for a player.
 */
export async function getPlayerBPInfo(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  settings?: { enabled: boolean; price: number } | null,
) {
  // If BP is explicitly disabled in settings, return null
  if (settings && settings.enabled === false) return null;

  // 1. Get active season
  const seasonRes = await client.query(
    `SELECT id, name, start_date, end_date FROM promo_bp_seasons
     WHERE club_id = $1 AND is_active = TRUE
       AND NOW() BETWEEN start_date AND end_date
     LIMIT 1`,
    [clubId],
  );

  if (seasonRes.rowCount === 0) return null;
  const season = seasonRes.rows[0];

  // 2. Get progress
  const progressRes = await client.query(
    `SELECT * FROM promo_bp_player_progress
     WHERE player_id = $1 AND season_id = $2`,
    [playerId, season.id],
  );

  const progress = progressRes.rows[0] || {
    current_xp: 0,
    has_premium: false,
    claimed_rewards: [],
  };

  // 3. Find current and next levels
  const tiersRes = await client.query(
    `SELECT * FROM promo_bp_tiers
     WHERE season_id = $1
     ORDER BY xp_required ASC`,
    [season.id],
  );

  const tiers = tiersRes.rows;
  let currentLevel = 0;
  let nextTier = null;

  for (const tier of tiers) {
    if (progress.current_xp >= tier.xp_required) {
      currentLevel = Math.max(currentLevel, tier.level_number);
    } else {
      nextTier = tier;
      break;
    }
  }

  return {
    season,
    settings: settings || { enabled: true, price: 1000 },
    progress: {
      xp: progress.current_xp,
      hasPremium: progress.has_premium,
      boostExpiresAt: progress.boost_expires_at,
      claimedRewards: progress.claimed_rewards,
    },
    currentLevel,
    nextTier,
    allTiers: tiers,
  };
}
