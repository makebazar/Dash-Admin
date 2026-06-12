import { PoolClient } from "pg";

export interface LoyaltyItem {
  product_id?: number;
  service_id?: string;
  quantity: number;
}

/**
 * Handles package purchase event to update package accumulation progress and consecutive days streak.
 */
export async function processPackagePurchase(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  items: LoyaltyItem[]
) {
  // 1. Fetch club settings and timezone
  const clubRes = await client.query(
    `SELECT promo_settings, timezone FROM clubs WHERE id = $1`,
    [clubId]
  );
  if (clubRes.rowCount === 0) return;

  const settings = clubRes.rows[0]?.promo_settings || {};
  const timezone = clubRes.rows[0]?.timezone || "Europe/Moscow";

  const packagesEnabled = settings.packages_promo_enabled === true;
  const streakEnabled = settings.packages_streak_enabled === true;

  if (!packagesEnabled && !streakEnabled) return;

  const targetProductIds = (settings.accumulation_product_ids || []).map(Number);
  const targetServiceIds = settings.accumulation_service_ids || [];

  // Filter items matching active packages (products or manual service rules)
  const matchingItems = items.filter((item) => {
    if (item.product_id !== undefined && targetProductIds.includes(Number(item.product_id))) {
      return true;
    }
    if (item.service_id !== undefined && targetServiceIds.includes(String(item.service_id))) {
      return true;
    }
    return false;
  });

  if (matchingItems.length === 0) return;

  // Total packages purchased in this receipt
  const totalQty = matchingItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  if (totalQty <= 0) return;

  // 2. Ensure progress record exists
  await client.query(
    `INSERT INTO promo_package_progress (player_id, club_id, accumulated_packages, accumulated_visits, current_streak)
     VALUES ($1::uuid, $2::int, 0, 0, 0)
     ON CONFLICT (player_id, club_id) DO NOTHING`,
    [playerId, clubId]
  );

  const progressRes = await client.query(
    `SELECT accumulated_packages, current_streak, last_purchase_date 
     FROM promo_package_progress 
     WHERE player_id = $1::uuid AND club_id = $2::int 
     FOR UPDATE`,
    [playerId, clubId]
  );

  let { accumulated_packages, current_streak, last_purchase_date } = progressRes.rows[0];

  let nextAccumulatedPackages = accumulated_packages;
  let nextStreak = current_streak;

  // Calculate today's date in club's local timezone
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD

  // 3. Process Package Accumulation
  if (packagesEnabled) {
    nextAccumulatedPackages += totalQty;
  }

  // 4. Process Streak (Consecutive days of package purchases)
  if (streakEnabled) {
    const lastDateStr = last_purchase_date
      ? new Date(last_purchase_date).toLocaleDateString("en-CA", { timeZone: timezone })
      : null;

    if (lastDateStr === todayStr) {
      // Already purchased today, streak stays the same
    } else if (lastDateStr === yesterdayStr) {
      // Bought yesterday, streak continues!
      nextStreak += 1;
    } else {
      // Gap in days, reset/restart streak at 1
      nextStreak = 1;
    }
  }

  // 5. Save progress updates
  await client.query(
    `UPDATE promo_package_progress 
     SET accumulated_packages = $1, current_streak = $2, last_purchase_date = $3::date, updated_at = NOW()
     WHERE player_id = $4::uuid AND club_id = $5::int`,
    [nextAccumulatedPackages, nextStreak, todayStr, playerId, clubId]
  );
}

/**
 * Handles confirmed check-in visit to update player visit accumulation.
 */
export async function processPlayerVisit(
  client: PoolClient,
  clubId: number | string,
  playerId: string
) {
  // 1. Fetch club settings and timezone
  const clubRes = await client.query(
    `SELECT promo_settings, timezone FROM clubs WHERE id = $1`,
    [clubId]
  );
  if (clubRes.rowCount === 0) return;

  const settings = clubRes.rows[0]?.promo_settings || {};
  const timezone = clubRes.rows[0]?.timezone || "Europe/Moscow";

  const visitsEnabled = settings.packages_visits_enabled === true;
  if (!visitsEnabled) return;

  // 2. Ensure progress record exists
  await client.query(
    `INSERT INTO promo_package_progress (player_id, club_id, accumulated_packages, accumulated_visits, current_streak)
     VALUES ($1::uuid, $2::int, 0, 0, 0)
     ON CONFLICT (player_id, club_id) DO NOTHING`,
    [playerId, clubId]
  );

  const progressRes = await client.query(
    `SELECT accumulated_visits, last_visit_date 
     FROM promo_package_progress 
     WHERE player_id = $1::uuid AND club_id = $2::int 
     FOR UPDATE`,
    [playerId, clubId]
  );

  let { accumulated_visits, last_visit_date } = progressRes.rows[0];

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD

  // Double check visit log to prevent double counting on same day visit
  const lastDateStr = last_visit_date
    ? new Date(last_visit_date).toLocaleDateString("en-CA", { timeZone: timezone })
    : null;

  let nextAccumulatedVisits = accumulated_visits;
  if (lastDateStr !== todayStr) {
    nextAccumulatedVisits += 1;
  }

  // 3. Save progress updates
  await client.query(
    `UPDATE promo_package_progress 
     SET accumulated_visits = $1, last_visit_date = $2::date, updated_at = NOW()
     WHERE player_id = $3::uuid AND club_id = $4::int`,
    [nextAccumulatedVisits, todayStr, playerId, clubId]
  );
}

/**
 * Handles manual service award button click.
 * Maps the service rule ID to package list and updates progress if it's considered a package.
 */
export async function processManualServiceAward(
  client: PoolClient,
  clubId: number | string,
  playerId: string,
  serviceRuleId: string
) {
  // Pass service_id to processPackagePurchase
  await processPackagePurchase(client, clubId, playerId, [
    { service_id: String(serviceRuleId), quantity: 1 }
  ]);
}
