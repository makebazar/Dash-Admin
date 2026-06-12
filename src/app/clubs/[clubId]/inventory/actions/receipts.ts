import { normalizeInventorySettings, getShiftZoneLabel } from "@/lib/inventory-settings";
import { notifyInventoryClub } from "@/lib/inventory-events";
import { query, getClient } from "@/db";
import { revalidatePath } from "next/cache";
import type { ShiftReceipt, ShiftReceiptItem, ShiftReceiptPaymentType } from "./types";
import { applyWarehouseStockDelta, assertWarehouseBelongsToClub, getSalarySaleCandidatesInternal, logStockMovement } from "./stock";
import { assertProductBelongsToClub } from "./products";
import { assertUserCanAccessClub, assertUserCanUseWarehouses, getInventoryAccessScope, requireClubAccess } from "./auth";
import { checkReplenishmentNeeds } from "./replenishment";

export async function createManualSale(
  clubId: string,
  userId: string,
  data: {
    product_id: number;
    quantity: number;
    warehouse_id: number;
    shift_id?: string;
    notes?: string;
  },
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    const { product_id, quantity, warehouse_id, shift_id, notes } = data;
    if (
      !Number.isFinite(quantity) ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error("Количество должно быть целым положительным числом");
    }
    await assertWarehouseBelongsToClub(client, clubId, warehouse_id);
    await assertProductBelongsToClub(client, clubId, product_id);
    await assertUserCanUseWarehouses(client, clubId, userId, [warehouse_id]);

    // 1. Update stock
    const { previousStock: prevStock, newStock } =
      await applyWarehouseStockDelta(
        client,
        warehouse_id,
        product_id,
        -quantity,
      );

    // 2. Update product cache
    await client.query(
      `
            UPDATE warehouse_products
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
            WHERE id = $1 AND club_id = $2
        `,
      [product_id, clubId],
    );

    // 3. Log movement
    const reason = `Ручная продажа (Админ): ${notes || ""}`;
    await logStockMovement(
      client,
      clubId,
      userId,
      product_id,
      -quantity,
      prevStock,
      newStock,
      "SALE",
      reason,
      "MANUAL",
      null,
      shift_id || null,
      warehouse_id,
    );

    await client.query("COMMIT");
    revalidatePath(`/clubs/${clubId}/inventory`);
    return { success: true };
  } catch (e: any) {
    await client.query("ROLLBACK");
    console.error("Manual sale error:", e);
    throw e;
  } finally {
    client.release();
  }
}

export async function resolvePosWarehouseIdForItems(
  client: any,
  clubId: string,
  userId: string,
  items: { product_id: number; quantity: number }[],
  preferredWarehouseId?: number | null,
  allowedCashboxWarehouseIds?: number[],
) {
  const scope = await getInventoryAccessScope(client, clubId, userId);

  const cashboxWarehouseIds = Array.isArray(allowedCashboxWarehouseIds)
    ? allowedCashboxWarehouseIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];
  const cashboxWarehouseIdSet = new Set<number>(cashboxWarehouseIds);
  if (
    preferredWarehouseId &&
    cashboxWarehouseIds.length > 0 &&
    !cashboxWarehouseIdSet.has(Number(preferredWarehouseId))
  ) {
    throw new Error("Склад не входит в список складов кассы");
  }

  if (scope.canManageInventory && preferredWarehouseId) {
    await assertWarehouseBelongsToClub(client, clubId, preferredWarehouseId);
  }
  if (!scope.canManageInventory && preferredWarehouseId) {
    await assertWarehouseBelongsToClub(client, clubId, preferredWarehouseId);
    if (cashboxWarehouseIds.length === 0) {
      await assertUserCanUseWarehouses(client, clubId, userId, [
        preferredWarehouseId,
      ]);
    }
  }

  const effectiveEmployeeAllowedWarehouseIds = !scope.canManageInventory
    ? cashboxWarehouseIds.length > 0
      ? cashboxWarehouseIds
      : scope.allowedWarehouseIds
    : scope.allowedWarehouseIds;

  const warehouseQuery = scope.canManageInventory
    ? cashboxWarehouseIds.length > 0
      ? `
                    SELECT id, name, is_default
                    FROM warehouses
                    WHERE club_id = $1
                      AND is_active = true
                      AND id = ANY($2::int[])
                      AND ($3::int IS NULL OR id = $3)
                    ORDER BY CASE WHEN id = $3 THEN 0 ELSE 1 END, is_default DESC, created_at ASC
                `
      : `
                    SELECT id, name, is_default
                    FROM warehouses
                    WHERE club_id = $1
                      AND is_active = true
                      AND ($2::int IS NULL OR id = $2)
                    ORDER BY CASE WHEN id = $2 THEN 0 ELSE 1 END, is_default DESC, created_at ASC
                `
    : `
            SELECT id, name, is_default
            FROM warehouses
            WHERE club_id = $1
              AND is_active = true
              AND id = ANY($2::int[])
              AND ($3::int IS NULL OR id = $3)
            ORDER BY CASE WHEN id = $3 THEN 0 ELSE 1 END, is_default DESC, created_at ASC
        `;

  const warehouseParams = scope.canManageInventory
    ? cashboxWarehouseIds.length > 0
      ? [clubId, cashboxWarehouseIds, preferredWarehouseId ?? null]
      : [clubId, preferredWarehouseId ?? null]
    : [
        clubId,
        effectiveEmployeeAllowedWarehouseIds,
        preferredWarehouseId ?? null,
      ];

  const warehouseRes = await client.query(warehouseQuery, warehouseParams);
  if (warehouseRes.rowCount === 0) {
    throw new Error("Для кассы не найден доступный активный склад");
  }

  const warehouseIds = warehouseRes.rows.map((row: any) => Number(row.id));
  const productIds = Array.from(
    new Set(items.map((item) => Number(item.product_id))),
  );
  const stockRes = await client.query(
    `
        SELECT warehouse_id, product_id, quantity
        FROM warehouse_stock
        WHERE warehouse_id = ANY($1::int[])
          AND product_id = ANY($2::int[])
        `,
    [warehouseIds, productIds],
  );

  const stockMap = new Map<string, number>();
  for (const row of stockRes.rows) {
    stockMap.set(
      `${row.warehouse_id}:${row.product_id}`,
      Number(row.quantity || 0),
    );
  }

  const matchingWarehouse = warehouseRes.rows.find((warehouse: any) =>
    items.every((item) => {
      const available = stockMap.get(`${warehouse.id}:${item.product_id}`) || 0;
      return available >= item.quantity;
    }),
  );

  if (matchingWarehouse) {
    return Number(matchingWarehouse.id);
  }

  const itemSummaries = await client.query(
    `
        SELECT id, name
        FROM warehouse_products
        WHERE club_id = $1
          AND id = ANY($2::int[])
        `,
    [clubId, productIds],
  );
  const productNames = new Map<number, string>();
  for (const row of itemSummaries.rows) {
    productNames.set(Number(row.id), String(row.name));
  }

  const details = items
    .map((item) => {
      const perWarehouse = warehouseRes.rows
        .map(
          (warehouse: any) =>
            `${warehouse.name}: ${stockMap.get(`${warehouse.id}:${item.product_id}`) || 0}`,
        )
        .join(", ");
      return `${productNames.get(item.product_id) || `Товар #${item.product_id}`} — ${perWarehouse}`;
    })
    .join("; ");

  throw new Error(`Недостаточно товара на выбранном складе кассы. ${details}`);
}

export async function resolvePosWarehousesForItems(
  client: any,
  clubId: string,
  userId: string,
  items: { product_id: number; quantity: number }[],
  forcedWarehouseId: number | null,
  allowedCashboxWarehouseIds?: number[],
) {
  const warehouseId = forcedWarehouseId ? Number(forcedWarehouseId) : null;
  if (warehouseId) {
    const resolved = await resolvePosWarehouseIdForItems(
      client,
      clubId,
      userId,
      items,
      warehouseId,
      allowedCashboxWarehouseIds,
    );
    const map = new Map<number, number>();
    for (const item of items)
      map.set(Number(item.product_id), Number(resolved));
    return { receiptWarehouseId: Number(resolved), itemWarehouseMap: map };
  }

  const scope = await getInventoryAccessScope(client, clubId, userId);
  const cashboxWarehouseIds = Array.isArray(allowedCashboxWarehouseIds)
    ? allowedCashboxWarehouseIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];

  const allowedSet = new Set(scope.allowedWarehouseIds);
  const effectiveEmployeeAllowedWarehouseIds = cashboxWarehouseIds.length > 0
    ? cashboxWarehouseIds.filter(id => allowedSet.has(id))
    : scope.allowedWarehouseIds;

  if (effectiveEmployeeAllowedWarehouseIds.length === 0) {
    throw new Error("Для кассы не найден доступный активный склад");
  }

  const warehouseRes = await client.query(
    `
        SELECT id, name, is_default
        FROM warehouses
        WHERE club_id = $1
          AND is_active = true
          AND id = ANY($2::int[])
        ORDER BY is_default DESC, created_at ASC
        `,
    [clubId, effectiveEmployeeAllowedWarehouseIds],
  );
  if (warehouseRes.rowCount === 0) {
    throw new Error("Для кассы не найден доступный активный склад");
  }

  const warehouseIds = warehouseRes.rows.map((row: any) => Number(row.id));
  const productIds = Array.from(
    new Set(items.map((item) => Number(item.product_id))),
  );
  const stockRes = await client.query(
    `
        SELECT warehouse_id, product_id, quantity
        FROM warehouse_stock
        WHERE warehouse_id = ANY($1::int[])
          AND product_id = ANY($2::int[])
        `,
    [warehouseIds, productIds],
  );

  const stockMap = new Map<string, number>();
  for (const row of stockRes.rows) {
    stockMap.set(
      `${row.warehouse_id}:${row.product_id}`,
      Number(row.quantity || 0),
    );
  }

  const itemSummaries = await client.query(
    `
        SELECT id, name
        FROM warehouse_products
        WHERE club_id = $1
          AND id = ANY($2::int[])
        `,
    [clubId, productIds],
  );
  const productNames = new Map<number, string>();
  for (const row of itemSummaries.rows) {
    productNames.set(Number(row.id), String(row.name));
  }

  const itemWarehouseMap = new Map<number, number>();
  const usedWarehouseIds = new Set<number>();

  for (const item of items) {
    const pid = Number(item.product_id);
    const qty = Number(item.quantity);
    const candidates = warehouseRes.rows
      .map((warehouse: any) => ({
        id: Number(warehouse.id),
        name: String(warehouse.name),
        available: stockMap.get(`${warehouse.id}:${pid}`) || 0,
      }))
      .filter((w: any) => w.available >= qty)
      .sort((a: any, b: any) => b.available - a.available);

    if (candidates.length === 0) {
      const perWarehouse = warehouseRes.rows
        .map(
          (warehouse: any) =>
            `${warehouse.name}: ${stockMap.get(`${warehouse.id}:${pid}`) || 0}`,
        )
        .join(", ");
      throw new Error(
        `Недостаточно товара для продажи. ${productNames.get(pid) || `Товар #${pid}`} — ${perWarehouse}`,
      );
    }

    const picked = candidates[0];
    itemWarehouseMap.set(pid, picked.id);
    usedWarehouseIds.add(picked.id);
  }

  const receiptWarehouseId =
    usedWarehouseIds.size === 1 ? Array.from(usedWarehouseIds)[0] : null;
  return { receiptWarehouseId, itemWarehouseMap };
}

export async function createShiftReceipt(
  clubId: string,
  userId: string,
  data: {
    shift_id: string;
    payment_type: ShiftReceiptPaymentType;
    items: { product_id: number; quantity: number }[];
    cash_amount?: number;
    card_amount?: number;
    notes?: string;
    warehouse_id?: number;
    salary_target_user_id?: string;
    promo_player_id?: string;
  },
) {
  await assertUserCanAccessClub(clubId, userId);
  if (!data.items?.length) throw new Error("Пустой чек");

  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");
    const clubRes = await client.query(
      `SELECT promo_settings, inventory_settings FROM clubs WHERE id = $1`,
      [clubId],
    );
    const promoSettings = clubRes.rows[0]?.promo_settings || {};
    const inventorySettings = normalizeInventorySettings(
      clubRes.rows[0]?.inventory_settings || {},
    );

    if (
      !inventorySettings.stock_enabled ||
      !inventorySettings.cashbox_enabled
    ) {
      throw new Error("Касса DashAdmin отключена для этого клуба");
    }
    const cashboxWarehouseIds = Array.isArray(
      inventorySettings.cashbox_warehouse_ids,
    )
      ? inventorySettings.cashbox_warehouse_ids
      : [];
    if (cashboxWarehouseIds.length === 0) {
      throw new Error("Для кассы не выбран склад продаж");
    }

    const normalizedItems = data.items
      .map((i) => ({
        product_id: Number(i.product_id),
        quantity: Number(i.quantity),
      }))
      .filter(
        (i) => Number.isFinite(i.product_id) && Number.isFinite(i.quantity),
      );

    if (normalizedItems.length === 0) throw new Error("Пустой чек");
    for (const i of normalizedItems) {
      if (!Number.isInteger(i.product_id) || i.product_id <= 0)
        throw new Error("Некорректный товар в чеке");
      if (!Number.isInteger(i.quantity) || i.quantity <= 0)
        throw new Error("Количество должно быть целым числом больше 0");
    }

    const shiftCheck = await client.query(
      `SELECT 1 FROM shifts WHERE id = $1 AND club_id = $2 AND user_id = $3 AND check_out IS NULL`,
      [data.shift_id, clubId, userId],
    );
    if (shiftCheck.rowCount === 0)
      throw new Error("Смена не найдена или уже завершена");

    let salaryTargetUserId: string | null = null;
    let salaryTargetShiftId: string | null = null;
    let countsInRevenue =
      data.payment_type !== "salary" && data.payment_type !== "bonus";
    if (data.payment_type === "salary") {
      if (!inventorySettings.allow_salary_deduction) {
        throw new Error("Продажа в счет ЗП отключена в настройках склада");
      }
      salaryTargetUserId = data.salary_target_user_id
        ? String(data.salary_target_user_id)
        : null;
      if (!salaryTargetUserId) {
        throw new Error("Для продажи в счет ЗП нужно выбрать сотрудника");
      }
    }

    const forcedWarehouseId = data.warehouse_id ?? null;
    const { receiptWarehouseId, itemWarehouseMap } =
      await resolvePosWarehousesForItems(
        client,
        clubId,
        userId,
        normalizedItems,
        forcedWarehouseId,
        cashboxWarehouseIds,
      );

    const productIds = Array.from(
      new Set(normalizedItems.map((i) => i.product_id)),
    );
    const pricesRes = await client.query(
      `
            SELECT id, cost_price, selling_price
            FROM warehouse_products
            WHERE club_id = $1 AND id = ANY($2::int[])
            `,
      [clubId, productIds],
    );
    if (pricesRes.rowCount !== productIds.length)
      throw new Error("Некоторые товары не найдены");
    const priceMap = new Map<
      number,
      { cost_price: number; selling_price: number }
    >();
    for (const r of pricesRes.rows) {
      priceMap.set(Number(r.id), {
        cost_price: Number(r.cost_price || 0),
        selling_price: Number(r.selling_price || 0),
      });
    }

    const roundMoney = (value: number) => Math.round(value * 100) / 100;
    const isSalarySale =
      data.payment_type === "salary" && Boolean(salaryTargetUserId);
    const priceMode: "SELLING" | "COST" =
      isSalarySale && inventorySettings.allow_cost_price_sale
        ? "COST"
        : "SELLING";
    const defaultDiscountRaw = Number(
      inventorySettings.employee_discount_percent ?? 0,
    );
    const defaultDiscount = Number.isFinite(defaultDiscountRaw)
      ? Math.min(100, Math.max(0, defaultDiscountRaw))
      : 0;
    const overrideSource = inventorySettings.employee_discount_overrides || {};
    const overrideRaw = salaryTargetUserId
      ? Number((overrideSource as any)[salaryTargetUserId])
      : NaN;
    const discountPercent =
      isSalarySale && priceMode === "SELLING"
        ? Math.min(
            100,
            Math.max(
              0,
              Number.isFinite(overrideRaw) ? overrideRaw : defaultDiscount,
            ),
          )
        : 0;

    const unitPriceMap = new Map<number, number>();
    for (const productId of productIds) {
      const p = priceMap.get(productId);
      if (!p) continue;
      const basePrice =
        priceMode === "COST"
          ? Number(p.cost_price || 0)
          : Number(p.selling_price || 0);
      const effectivePrice =
        priceMode === "COST"
          ? basePrice
          : roundMoney(basePrice * (1 - discountPercent / 100));
      unitPriceMap.set(productId, effectivePrice);
    }

    const itemsTotal = normalizedItems.reduce((acc, i) => {
      const unitPrice = unitPriceMap.get(i.product_id);
      if (unitPrice === undefined) return acc;
      return acc + Number(i.quantity) * unitPrice;
    }, 0);

    if (data.payment_type === "bonus") {
      if (!data.promo_player_id) {
        throw new Error("Для оплаты бонусами нужно выбрать гостя");
      }
      const multiplier = Number(promoSettings.bonus_price_multiplier || 2);
      const totalBonusCost = Math.floor(itemsTotal * multiplier);

      const balanceRes = await client.query(
        `SELECT bonus_balance, limit_group_id FROM promo_player_balances WHERE player_id = $1 AND club_id = $2 FOR UPDATE`,
        [data.promo_player_id, clubId],
      );

      if (balanceRes.rowCount === 0) {
        throw new Error("У игрока нет бонусного счета в этом клубе");
      }

      const currentBalance = Number(balanceRes.rows[0].bonus_balance || 0);
      const limitGroupId = balanceRes.rows[0].limit_group_id;

      if (currentBalance < totalBonusCost) {
        throw new Error(
          `Недостаточно бонусов. Требуется: ${totalBonusCost}, доступно: ${Math.floor(currentBalance)}`,
        );
      }

      // Validate monthly withdrawal limits if enabled
      if (promoSettings.withdraw_limit_enabled === true) {
        // Check if player has Premium Battle Pass
        const bpCheck = await client.query(
          `SELECT bp.has_premium
           FROM promo_bp_player_progress bp
           JOIN promo_bp_seasons s ON s.id = bp.season_id
           WHERE bp.player_id = $1 AND s.club_id = $2 AND s.is_active = TRUE AND NOW() BETWEEN s.start_date AND s.end_date
           LIMIT 1`,
          [data.promo_player_id, clubId],
        );
        const hasPremiumBp = bpCheck.rows[0]?.has_premium === true;

        const topupRes = await client.query(
          `SELECT COALESCE(SUM((result_data->>'amount')::float), 0) as total
           FROM promo_history
           WHERE player_id = $1 AND club_id = $2 AND game_type = 'TOPUP' AND created_at >= date_trunc('month', CURRENT_DATE)`,
          [data.promo_player_id, clubId],
        );
        const topups = parseFloat(topupRes.rows[0].total);

        const barRealRes = await client.query(
          `SELECT COALESCE(SUM(total_amount), 0) as total
           FROM shift_receipts
           WHERE promo_player_id = $1 AND club_id = $2
             AND payment_type IN ('cash', 'card', 'mixed')
             AND committed_at >= date_trunc('month', CURRENT_DATE)`,
          [data.promo_player_id, clubId],
        );
        const monthlyBarReal = parseFloat(barRealRes.rows[0].total);
        const monthlyTopups = topups + monthlyBarReal;

        const withdrawRes = await client.query(
          `SELECT COALESCE(SUM(withdraw_amount), 0) as total
           FROM promo_prize_queue
           WHERE player_id = $1 AND club_id = $2 AND status != 'canceled' AND created_at >= date_trunc('month', CURRENT_DATE)`,
          [data.promo_player_id, clubId],
        );
        const normalWithdraw = parseFloat(withdrawRes.rows[0].total);

        const barBonusRes = await client.query(
          `SELECT COALESCE(SUM((result_data->>'bonus_cost')::float), 0) as total
           FROM promo_history
           WHERE player_id = $1 AND club_id = $2
             AND game_type = 'BAR_BONUS_PURCHASE'
             AND created_at >= date_trunc('month', CURRENT_DATE)`,
          [data.promo_player_id, clubId],
        );
        const monthlyBarBonus = parseFloat(barBonusRes.rows[0].total);
        const monthlyWithdrawn = normalWithdraw + monthlyBarBonus;

        // Calculate base limit percentage based on monthly topups
        let t1 = 1000;
        let t2 = 3000;
        let t3 = 5000;

        if (limitGroupId && promoSettings.limit_groups && Array.isArray(promoSettings.limit_groups)) {
          const group = promoSettings.limit_groups.find((g: any) => g.id === limitGroupId);
          if (group) {
            t1 = parseFloat(group.t1) || 0;
            t2 = parseFloat(group.t2) || 0;
            t3 = parseFloat(group.t3) || 0;
          }
        }

        let basePercent = 30;
        if (monthlyTopups > t3) {
          basePercent = 90;
        } else if (monthlyTopups > t2) {
          basePercent = 70;
        } else if (monthlyTopups > t1) {
          basePercent = 50;
        }

        // Premium Battle Pass boost
        let bpBoost = 15;
        if (promoSettings.withdraw_limit_percent_bp !== undefined && promoSettings.withdraw_limit_percent !== undefined) {
          bpBoost = Math.max(0, parseFloat(promoSettings.withdraw_limit_percent_bp) - parseFloat(promoSettings.withdraw_limit_percent));
        }
        
        const finalPercent = hasPremiumBp ? Math.min(100, basePercent + bpBoost) : basePercent;

        // Get extra limit from boosts
        const balanceCheck = await client.query(
          `SELECT extra_withdraw_limit
           FROM promo_player_balances
           WHERE player_id = $1 AND club_id = $2`,
          [data.promo_player_id, clubId],
        );
        const extraLimit = balanceCheck.rows.length > 0 && balanceCheck.rows[0].extra_withdraw_limit 
          ? parseFloat(balanceCheck.rows[0].extra_withdraw_limit) 
          : 0;

        const allowedLimit = (monthlyTopups * (finalPercent / 100)) + extraLimit;
        const remainingLimit = Math.max(0, allowedLimit - monthlyWithdrawn);

        if (totalBonusCost > remainingLimit) {
          throw new Error(
            `Превышен лимит вывода бонусов игрока за этот месяц. Доступный лимит: ${remainingLimit.toFixed(0)} ₽, требуется: ${totalBonusCost} ₽. Игроку необходимо пополнить баланс или совершить покупки в баре за рубли.`
          );
        }
      }

      await client.query(
        `UPDATE promo_player_balances SET bonus_balance = bonus_balance - $1, updated_at = NOW() WHERE player_id = $2 AND club_id = $3`,
        [totalBonusCost, data.promo_player_id, clubId],
      );
    }

    let cashAmount = Number(data.cash_amount || 0);
    let cardAmount = Number(data.card_amount || 0);
    if (data.payment_type === "cash") {
      cashAmount = itemsTotal;
      cardAmount = 0;
    } else if (data.payment_type === "card") {
      cardAmount = itemsTotal;
      cashAmount = 0;
    } else if (data.payment_type === "mixed") {
      if (cashAmount + cardAmount === 0) {
        cashAmount = itemsTotal;
      }
    } else if (
      data.payment_type === "salary" ||
      data.payment_type === "bonus"
    ) {
      cashAmount = 0;
      cardAmount = 0;
    } else {
      cashAmount = cashAmount || 0;
      cardAmount = cardAmount || 0;
    }

    if (data.payment_type === "salary") {
      const candidates = await getSalarySaleCandidatesInternal(client, clubId);
      const candidate = candidates.find(
        (item) => item.id === salaryTargetUserId,
      );
      if (!candidate) {
        throw new Error("У выбранного сотрудника нет смен в текущем месяце");
      }
      if (candidate.available_amount < itemsTotal) {
        throw new Error(
          `Недостаточно доступной суммы. Доступно: ${candidate.available_amount.toLocaleString("ru-RU")} ₽`,
        );
      }
      salaryTargetShiftId = candidate.reference_shift_id;
    }

    // Monetary sanity checks
    const totalRounded = Math.round(itemsTotal * 100) / 100;
    cashAmount = Math.round(cashAmount * 100) / 100;
    cardAmount = Math.round(cardAmount * 100) / 100;
    if (data.payment_type === "mixed") {
      const sumRounded = Math.round((cashAmount + cardAmount) * 100) / 100;
      if (sumRounded !== totalRounded) {
        throw new Error("Сумма наличных + карта должна равняться итогу");
      }
    }

    // FIX: Check stock availability BEFORE creating receipt
    for (const item of normalizedItems) {
      const itemWarehouseId = itemWarehouseMap.get(item.product_id);
      if (!itemWarehouseId) {
        throw new Error("Не удалось определить склад для товара в чеке");
      }
      const stockRes = await client.query(
        `SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
        [itemWarehouseId, item.product_id],
      );
      const prevStock = Number(stockRes.rows[0]?.quantity ?? 0);
      if (prevStock < item.quantity) {
        const prodRes = await client.query(
          `SELECT name FROM warehouse_products WHERE id = $1 AND club_id = $2`,
          [item.product_id, clubId],
        );
        const productName =
          prodRes.rows[0]?.name || `Товар #${item.product_id}`;
        await client.query("ROLLBACK");
        throw new Error(
          `Недостаточно товара "${productName}" на складе. Доступно: ${prevStock}, требуется: ${item.quantity}`,
        );
      }
    }

    const receiptRes = await client.query(
      `
            INSERT INTO shift_receipts (
                club_id, shift_id, created_by, warehouse_id,
                payment_type, cash_amount, card_amount, total_amount, notes, committed_at,
                salary_target_user_id, salary_target_shift_id, counts_in_revenue, promo_player_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, $12, $13)
            RETURNING id
            `,
      [
        clubId,
        data.shift_id,
        userId,
        receiptWarehouseId,
        data.payment_type,
        cashAmount,
        cardAmount,
        itemsTotal,
        data.notes || null,
        salaryTargetUserId,
        salaryTargetShiftId,
        countsInRevenue,
        data.promo_player_id || null,
      ],
    );
    const receiptId = Number(receiptRes.rows[0].id);

    if (data.payment_type === "bonus" && data.promo_player_id) {
      const multiplier = Number(promoSettings.bonus_price_multiplier || 2);
      const totalBonusCost = Math.floor(itemsTotal * multiplier);
      await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'BAR_BONUS_PURCHASE', $3)`,
        [
          data.promo_player_id,
          clubId,
          JSON.stringify({
            receipt_id: receiptId,
            bonus_cost: totalBonusCost,
            items_total: itemsTotal,
          }),
        ],
      );
    }

    for (const item of normalizedItems) {
      if (!item.quantity || item.quantity <= 0) continue;
      const p = priceMap.get(item.product_id);
      if (!p) continue;
      const unitPrice = unitPriceMap.get(item.product_id);
      if (unitPrice === undefined) continue;
      const itemWarehouseId = itemWarehouseMap.get(item.product_id);
      if (!itemWarehouseId) {
        throw new Error("Не удалось определить склад для товара в чеке");
      }
      await client.query(
        `
                INSERT INTO shift_receipt_items (receipt_id, product_id, quantity, selling_price_snapshot, cost_price_snapshot, warehouse_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                `,
        [
          receiptId,
          item.product_id,
          item.quantity,
          unitPrice,
          p.cost_price,
          itemWarehouseId,
        ],
      );
    }

    // FIX: Immediate stock write-off
    for (const item of normalizedItems) {
      const itemWarehouseId = itemWarehouseMap.get(item.product_id);
      if (!itemWarehouseId) {
        throw new Error("Не удалось определить склад для товара в чеке");
      }
      const { previousStock, newStock } = await applyWarehouseStockDelta(
        client,
        itemWarehouseId,
        item.product_id,
        -item.quantity,
      );

      const p = priceMap.get(item.product_id)!;
      const unitPrice = unitPriceMap.get(item.product_id) ?? p.selling_price;
      await logStockMovement(
        client,
        clubId,
        userId,
        item.product_id,
        -item.quantity,
        previousStock,
        newStock,
        "SALE",
        data.payment_type === "salary"
          ? `В счет ЗП: Чек #${receiptId}`
          : `Чек #${receiptId}`,
        "SHIFT_RECEIPT",
        receiptId,
        data.shift_id,
        itemWarehouseId,
        unitPrice,
      );
    }

    // Update product cache
    if (productIds.length > 0) {
      await client.query(
        `
                UPDATE warehouse_products p
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
                WHERE id = ANY($1) AND club_id = $2
                `,
        [productIds, clubId],
      );
    }

    if (data.payment_type === "salary" && salaryTargetShiftId) {
      await client.query(
        `
                UPDATE shifts
                SET bar_purchases = COALESCE(bar_purchases, 0) + $1
                WHERE id = $2 AND club_id = $3
                `,
        [itemsTotal, salaryTargetShiftId, clubId],
      );
    }

    // Award Promotional Tickets and Process Quests if player is linked
    if (
      data.promo_player_id &&
      data.payment_type !== "bonus" // FIX: No tickets or quests for bonus purchases
    ) {
      if (promoSettings.bar_accrual_enabled !== false) {
        const { calculateTicketsForBarAmount } =
          await import("@/lib/promo-accrual");
        const ticketsToAward = calculateTicketsForBarAmount(
          itemsTotal,
          promoSettings,
        );

        if (ticketsToAward > 0) {
          await client.query(
            `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
             SELECT $1, $2, 'available', 'pos_sale', NULL
             FROM generate_series(1, $3)`,
            [data.promo_player_id, clubId, ticketsToAward],
          );
        }
      }

      // Process Quests and XP
      const { processReceiptEvent } = await import("@/lib/promo-quests");
      await processReceiptEvent(
        client,
        clubId,
        data.promo_player_id,
        receiptId,
        itemsTotal,
        normalizedItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity || 0,
        })),
      );
    }

    await client.query("COMMIT");

    // Check if sales triggered new replenishment needs
    await checkReplenishmentNeeds(clubId);

    // FIX: Отправляем SSE уведомление всем клиентам клуба
    try {
      notifyInventoryClub(clubId, {
        type: "RECEIPT_CREATED",
        receipt: {
          id: receiptId,
          total_amount: itemsTotal,
          created_at: new Date().toISOString(),
        },
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error("[SSE] Failed to send notification:", e);
    }

    revalidatePath(`/employee/clubs/${clubId}`);
    return { success: true, id: receiptId };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function createShiftReceiptSafe(
  clubId: string,
  userId: string,
  data: {
    shift_id: string;
    payment_type: ShiftReceiptPaymentType;
    items: { product_id: number; quantity: number }[];
    cash_amount?: number;
    card_amount?: number;
    notes?: string;
    warehouse_id?: number;
    salary_target_user_id?: string;
    promo_player_id?: string;
  },
) {
  try {
    await createShiftReceipt(clubId, userId, data);
    return { ok: true as const };
  } catch (error: any) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка пробития товара"),
    };
  }
}

export function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const parts = [error.message?.trim()].filter(Boolean) as string[];
    const detail =
      typeof (error as { detail?: unknown }).detail === "string"
        ? (error as { detail?: string }).detail?.trim()
        : "";
    const hint =
      typeof (error as { hint?: unknown }).hint === "string"
        ? (error as { hint?: string }).hint?.trim()
        : "";

    if (detail && !parts.includes(detail)) {
      parts.push(detail);
    }
    if (hint && !parts.includes(hint)) {
      parts.push(hint);
    }

    if (parts.length > 0) {
      return parts.join("\n");
    }
  }

  return fallback;
}

export async function getClubPromoSettings(clubId: string, userId: string) {
  await assertUserCanAccessClub(clubId, userId);
  const result = await query(
    `SELECT promo_settings, bp_settings FROM clubs WHERE id = $1`,
    [clubId],
  );
  const row = result.rows[0];
  return {
    ...(row?.promo_settings || {}),
    bp_settings: row?.bp_settings || {},
  };
}

export async function getPromoQueue(clubId: string, userId: string) {
  await assertUserCanAccessClub(clubId, userId);
  const result = await query(
    `SELECT q.id, p.full_name as player_name, p.phone_number as player_phone,
            COALESCE(pr.name, 'Вывод бонусов: ' || q.withdraw_amount || ' ₽') as prize_name,
            COALESCE(pr.type, 'withdraw') as prize_type,
            q.withdraw_amount,
            q.status, q.created_at
     FROM promo_prize_queue q
     JOIN promo_players p ON q.player_id = p.id
     LEFT JOIN promo_prizes pr ON q.prize_id = pr.id
     WHERE q.club_id = $1 AND q.status = 'pending'
     ORDER BY q.created_at DESC`,
    [clubId],
  );
  return result.rows;
}

export async function getPendingQuestVerifications(
  clubId: string,
  userId: string,
) {
  await assertUserCanAccessClub(clubId, userId);
  const res = await query(
    `SELECT
       pq.id,
       pq.verification_photo_url,
       pq.assigned_at,
       pq.seat_number,
       q.title as quest_title,
       p.full_name as player_name,
       p.phone_number as player_phone
     FROM promo_player_quests pq
     JOIN promo_quests q ON q.id = pq.quest_id
     JOIN promo_players p ON p.id = pq.player_id
     WHERE pq.club_id = $1 AND pq.status = 'pending_verification'
     ORDER BY pq.assigned_at ASC`,
    [clubId],
  );
  return res.rows;
}

export async function verifyQuestSafe(
  clubId: string,
  userId: string,
  requestId: string,
  action: "approve" | "reject",
) {
  const client = await getClient();
  try {
    await assertUserCanAccessClub(clubId, userId);
    await client.query("BEGIN");

    if (action === "approve") {
      // Get internal integer employee ID
      const empRes = await client.query(
        `SELECT id FROM club_employees WHERE club_id = $1 AND user_id = $2`,
        [clubId, userId],
      );
      const employeeId = empRes.rows[0]?.id;

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
        [requestId],
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
        [employeeId || null, requestId],
      );

      // 3. Issue rewards
      const { rewardPlayerForQuest } = await import("@/lib/promo-quests");
      await rewardPlayerForQuest(client, clubId, quest.player_id, quest);
    } else {
      // Get internal integer employee ID
      const empRes = await client.query(
        `SELECT id FROM club_employees WHERE club_id = $1 AND user_id = $2`,
        [clubId, userId],
      );
      const employeeId = empRes.rows[0]?.id;

      // Reject: set back to active
      await client.query(
        `UPDATE promo_player_quests
         SET status = 'active',
             verification_photo_url = NULL,
             reviewed_at = NOW(),
             reviewed_by = $1
         WHERE id = $2`,
        [employeeId || null, requestId],
      );
    }

    await client.query("COMMIT");

    // Notify via SSE
    const { notifyInventoryClub } = await import("@/lib/inventory-events");
    notifyInventoryClub(clubId, {
      type: "PROMO_QUEUE_UPDATED",
      timestamp: Date.now(),
    });

    return { ok: true as const };
  } catch (error: any) {
    await client.query("ROLLBACK");
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка проверки задания"),
    };
  } finally {
    client.release();
  }
}

export async function confirmPlayerVisitSafe(
  clubId: string,
  userId: string,
  playerId: string,
  seatNumber?: string,
) {
  const client = await getClient();
  try {
    await assertUserCanAccessClub(clubId, userId);
    await client.query("BEGIN");

    // 1. Resolve employee internal ID
    const empRes = await client.query(
      `SELECT id FROM club_employees WHERE club_id = $1 AND user_id = $2`,
      [clubId, userId],
    );
    const employeeId = empRes.rows[0]?.id;

    // 2. Check if player has already had a confirmed check-in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const visitCheck = await client.query(
      `SELECT id FROM promo_player_visits
       WHERE player_id = $1::uuid AND club_id = $2::int AND confirmed_at >= $3
       LIMIT 1`,
      [playerId, clubId, today],
    );

    if (visitCheck.rows.length > 0) {
      throw new Error("Гость уже отмелся сегодня!");
    }

    // 3. Log visit check-in in the database
    await client.query(
      `INSERT INTO promo_player_visits (player_id, club_id, seat_number, confirmed_by, confirmed_at)
       VALUES ($1::uuid, $2::int, $3, $4, NOW())`,
      [playerId, clubId, seatNumber || null, employeeId || null],
    );

    // 4. Run quest visit updates (processVisitEvent)
    const { processVisitEvent } = await import("@/lib/promo-quests");
    await processVisitEvent(client, clubId, playerId, seatNumber);

    await client.query("COMMIT");

    // 5. Notify via SSE to refresh all clients
    const { notifyInventoryClub } = await import("@/lib/inventory-events");
    notifyInventoryClub(clubId, {
      type: "PROMO_QUEUE_UPDATED",
      timestamp: Date.now(),
    });

    return { ok: true as const };
  } catch (error: any) {
    await client.query("ROLLBACK");
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка подтверждения посещения"),
    };
  } finally {
    client.release();
  }
}

export async function claimPromoItemSafe(
  clubId: string,
  userId: string,
  itemId: number,
) {
  try {
    await assertUserCanAccessClub(clubId, userId);
    const queueRes = await query(
      `UPDATE promo_prize_queue
             SET status = 'claimed', claimed_at = NOW(), claimed_by_admin_id = $1
             WHERE id = $2 AND club_id = $3
             RETURNING id`,
      [userId, itemId, clubId],
    );

    if (queueRes.rowCount && queueRes.rowCount > 0) {
      await query(`SELECT pg_notify('promo_queue_updates', $1)`, [clubId]);

      // Also notify via SSE for instant UI updates in cashbox
      const { notifyInventoryClub } = await import("@/lib/inventory-events");
      notifyInventoryClub(clubId, {
        type: "PROMO_QUEUE_UPDATED",
        timestamp: Date.now(),
      });
    }

    return { ok: true as const };
  } catch (error: any) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка выдачи приза"),
    };
  }
}

export async function bulkAccruePromoSafe(
  clubId: string,
  userId: string,
  data: {
    player_id: string;
    topup_amount: number;
    service_rule_ids: string[];
  },
) {
  const client = await getClient();
  try {
    await assertUserCanAccessClub(clubId, userId);
    await client.query("BEGIN");

    // 1. Get promo settings and timezone
    const clubRes = await client.query(
      `SELECT promo_settings, timezone FROM clubs WHERE id = $1`,
      [clubId],
    );
    const settings = clubRes.rows[0]?.promo_settings || {};
    const timezone = clubRes.rows[0]?.timezone || "Europe/Moscow";
    const rules = settings.service_rules || [];

    // 2. Resolve player balance record
    await client.query(
      `INSERT INTO promo_player_balances (player_id, club_id, bonus_balance)
          VALUES ($1::uuid, $2::int, 0)
          ON CONFLICT (player_id, club_id)
          DO UPDATE SET updated_at = NOW()`,
      [data.player_id, clubId],
    );

    const historyIds: string[] = [];

    // 3. Handle Topup
    if (data.topup_amount > 0) {
      // Apply active withdraw boost if exists
      const boostCheck = await client.query(
        `SELECT active_boost_percent FROM promo_player_balances 
         WHERE player_id = $1::uuid AND club_id = $2::int FOR UPDATE`,
        [data.player_id, clubId]
      );
      if (boostCheck.rows.length > 0) {
        const activeBoostPercent = parseInt(boostCheck.rows[0].active_boost_percent || 0);
        if (activeBoostPercent > 0) {
          const extraLimit = (data.topup_amount * activeBoostPercent) / 100;
          await client.query(
            `UPDATE promo_player_balances 
             SET extra_withdraw_limit = COALESCE(extra_withdraw_limit, 0) + $1,
                 active_boost_percent = 0,
                 updated_at = NOW()
             WHERE player_id = $2::uuid AND club_id = $3::int`,
            [extraLimit, data.player_id, clubId]
          );
        }
      }

      const topupHistoryRes = await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1::uuid, $2::int, 'TOPUP', $3::jsonb)
         RETURNING id`,
        [
          data.player_id,
          clubId,
          JSON.stringify({
            amount: data.topup_amount,
            processed_by: userId,
          }),
        ],
      );
      historyIds.push(topupHistoryRes.rows[0].id);

      if (settings.topup_accrual_enabled !== false) {
        const { calculateTicketsForAmount } =
          await import("@/lib/promo-accrual");
        const ticketsToAward = calculateTicketsForAmount(
          data.topup_amount,
          settings,
        );

        if (ticketsToAward > 0) {
          await client.query(
            `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at, history_id)
             SELECT $1::uuid, $2::int, 'available', 'topup', NULL, $3::uuid
             FROM generate_series(1, $4)`,
            [
              data.player_id,
              clubId,
              topupHistoryRes.rows[0].id,
              Math.floor(ticketsToAward),
            ],
          );
        }
      }

      // Process Quests for Topup
      const { processBalanceTopupEvent } = await import("@/lib/promo-quests");
      await processBalanceTopupEvent(
        client,
        clubId,
        data.player_id,
        data.topup_amount,
      );

      // Referral Accruals
      const refCheck = await client.query(
        `SELECT id, referrer_id, status, total_referred_deposits 
         FROM promo_referrals 
         WHERE referred_id = $1::uuid`,
        [data.player_id]
      );

      if (refCheck.rowCount && refCheck.rowCount > 0) {
        const referral = refCheck.rows[0];
        const referrerId = referral.referrer_id;
        const currentStatus = referral.status;
        const prevDeposits = parseFloat(referral.total_referred_deposits || "0");
        const newDeposits = prevDeposits + data.topup_amount;

        // Update the accumulated deposits for this referred user
        await client.query(
          `UPDATE promo_referrals 
           SET total_referred_deposits = $1
           WHERE referred_id = $2::uuid`,
          [newDeposits, data.player_id]
        );

        const refSettings = settings.referral_settings || {
          enabled: true,
          threshold: 1000.0,
          fixed_reward_tickets: 5,
          fixed_reward_bonus: 0.0,
          recurring_percent: 10.0,
        };

        if (refSettings.enabled !== false) {
          // Ensure referrer balance record exists
          await client.query(
            `INSERT INTO promo_player_balances (player_id, club_id, bonus_balance)
             VALUES ($1::uuid, $2::int, 0)
             ON CONFLICT (player_id, club_id) DO NOTHING`,
            [referrerId, clubId]
          );

          // One-time threshold reward check
          const threshold = parseFloat(refSettings.threshold ?? "1000");
          const fixedRewardTickets = parseInt(refSettings.fixed_reward_tickets ?? "5");
          const fixedRewardBonus = parseFloat(refSettings.fixed_reward_bonus ?? "0");

          if (currentStatus === "registered" && newDeposits >= threshold) {
            // Update status to threshold_reached
            await client.query(
              `UPDATE promo_referrals 
               SET status = 'threshold_reached'
               WHERE referred_id = $1::uuid`,
              [data.player_id]
            );

            // Record fixed reward event
            const refFixedHistoryRes = await client.query(
              `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
               VALUES ($1::uuid, $2::int, 'REFERRAL_FIXED_AWARD', $3::jsonb)
               RETURNING id`,
              [
                referrerId,
                clubId,
                JSON.stringify({
                  referred_friend_id: data.player_id,
                  tickets: fixedRewardTickets,
                  bonus_amount: fixedRewardBonus,
                }),
              ]
            );

            // Award tickets
            if (fixedRewardTickets > 0) {
              await client.query(
                `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at, history_id)
                 SELECT $1::uuid, $2::int, 'available', 'referral_fixed_award', NULL, $3::uuid
                 FROM generate_series(1, $4)`,
                [referrerId, clubId, refFixedHistoryRes.rows[0].id, fixedRewardTickets]
              );
            }

            // Award bonus balance
            if (fixedRewardBonus > 0) {
              await client.query(
                `UPDATE promo_player_balances
                 SET bonus_balance = bonus_balance + $1, updated_at = NOW()
                 WHERE player_id = $2 AND club_id = $3`,
                [fixedRewardBonus, referrerId, clubId]
              );
            }
          }

          // Recurring percentage award
          const recurringPercent = parseFloat(refSettings.recurring_percent ?? "10");
          if (recurringPercent > 0) {
            const percentBonus = Number((data.topup_amount * (recurringPercent / 100)).toFixed(2));
            if (percentBonus > 0) {
              const refPercentHistoryRes = await client.query(
                `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
                 VALUES ($1::uuid, $2::int, 'REFERRAL_PERCENT_AWARD', $3::jsonb)
                 RETURNING id`,
                [
                  referrerId,
                  clubId,
                  JSON.stringify({
                    referred_friend_id: data.player_id,
                    deposit_amount: data.topup_amount,
                    bonus_amount: percentBonus,
                    percent: recurringPercent,
                  }),
                ]
              );

              await client.query(
                `UPDATE promo_player_balances
                 SET bonus_balance = bonus_balance + $1, updated_at = NOW()
                 WHERE player_id = $2 AND club_id = $3`,
                [percentBonus, referrerId, clubId]
              );
            }
          }
        }
      }
    }

    // 4. Handle Service Rules
    for (const ruleId of data.service_rule_ids) {
      const rule = rules.find((r: any) => r.id === ruleId);
      if (!rule) continue;

      const serviceHistoryRes = await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1::uuid, $2::int, 'SERVICE_AWARD', $3::jsonb)
         RETURNING id`,
        [
          data.player_id,
          clubId,
          JSON.stringify({
            rule_id: rule.id,
            rule_name: rule.name,
            tickets: rule.tickets,
            processed_by: userId,
          }),
        ],
      );
      historyIds.push(serviceHistoryRes.rows[0].id);

      await client.query(
        `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at, history_id)
         SELECT $1::uuid, $2::int, 'available', 'service_award', NULL, $3::uuid
         FROM generate_series(1, $4)`,
        [data.player_id, clubId, serviceHistoryRes.rows[0].id, Math.floor(Number(rule.tickets))],
      );

      // Process Quests
      const { processServiceAwardEvent } = await import("@/lib/promo-quests");
      await processServiceAwardEvent(client, clubId, data.player_id, rule.id);
    }

    await client.query("COMMIT");
    await query(`SELECT pg_notify('promo_queue_updates', $1)`, [clubId]);

    return { ok: true as const, historyIds };
  } catch (error: any) {
    await client.query("ROLLBACK");
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка начисления"),
    };
  } finally {
    client.release();
  }
}

export async function getRecentPromoAccruals(clubId: string) {
  const res = await query(
    `SELECT h.id, h.player_id, p.full_name as player_name, h.game_type, h.result_data, h.created_at,
            (SELECT COUNT(*) FROM promo_tickets t WHERE t.history_id = h.id AND t.status = 'available') as available_tickets,
            (SELECT COUNT(*) FROM promo_tickets t WHERE t.history_id = h.id) as total_tickets
     FROM promo_history h
     JOIN promo_players p ON h.player_id = p.id
     WHERE h.club_id = $1 AND h.game_type IN ('TOPUP', 'SERVICE_AWARD')
     ORDER BY h.created_at DESC
     LIMIT 20`,
    [clubId],
  );
  return res.rows;
}

export async function voidPromoAccrualSafe(
  clubId: string,
  userId: string,
  historyId: string,
) {
  const client = await getClient();
  try {
    await assertUserCanAccessClub(clubId, userId);
    await client.query("BEGIN");

    // 1. Get history entry
    const historyRes = await client.query(
      `SELECT id, player_id, game_type, result_data FROM promo_history WHERE id = $1 AND club_id = $2`,
      [historyId, clubId],
    );

    if (historyRes.rowCount === 0) throw new Error("Запись не найдена");
    const history = historyRes.rows[0];

    // 2. Check if tickets can be voided
    const ticketStats = await client.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'available') as available
       FROM promo_tickets WHERE history_id = $1`,
      [historyId],
    );

    const stats = ticketStats.rows[0];
    if (
      Number(stats.total) > 0 &&
      Number(stats.available) < Number(stats.total)
    ) {
      throw new Error("Часть билетов уже использована, отмена невозможна");
    }

    // 3. Delete tickets
    await client.query(`DELETE FROM promo_tickets WHERE history_id = $1`, [
      historyId,
    ]);

    // 4. Update history entry to mark as voided
    await client.query(
      `UPDATE promo_history SET game_type = game_type || '_VOIDED',
                               result_data = result_data || jsonb_build_object('voided_at', NOW(), 'voided_by', $2::text)
       WHERE id = $1::uuid`,
      [historyId, userId],
    );

    await client.query("COMMIT");
    await query(`SELECT pg_notify('promo_queue_updates', $1)`, [clubId]);

    return { ok: true as const };
  } catch (error: any) {
    await client.query("ROLLBACK");
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка отмены"),
    };
  } finally {
    client.release();
  }
}

export async function voidShiftReceiptSafe(
  clubId: string,
  userId: string,
  receiptId: number,
) {
  try {
    await voidShiftReceipt(clubId, userId, receiptId);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка отмены чека"),
    };
  }
}

export async function returnReceiptItemSafe(
  clubId: string,
  userId: string,
  receiptId: number,
  itemId: number,
  returnQuantity: number,
  reason: string,
) {
  try {
    const result = await returnReceiptItem(
      clubId,
      userId,
      receiptId,
      itemId,
      returnQuantity,
      reason,
    );
    return {
      ok: true as const,
      refundAmount: result.refundAmount,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка возврата"),
    };
  }
}

export async function buildShiftReceiptsFromRows(receiptRows: any[]) {
  const receiptIds = receiptRows.map((r) => Number(r.id));

  const returnsRes =
    receiptIds.length > 0
      ? await query(
          `
        SELECT receipt_id, item_id, SUM(quantity) as returned_qty
        FROM shift_receipt_returns
        WHERE receipt_id = ANY($1)
        GROUP BY receipt_id, item_id
        `,
          [receiptIds],
        )
      : { rows: [] };

  const returnsMap = new Map<string, number>();
  for (const ret of returnsRes.rows) {
    returnsMap.set(
      `${ret.receipt_id}-${ret.item_id}`,
      Number(ret.returned_qty),
    );
  }

  const itemsRes = receiptIds.length
    ? await query(
        `
            SELECT
                i.*,
                p.name as product_name,
                w.name as warehouse_name
            FROM shift_receipt_items i
            JOIN warehouse_products p ON i.product_id = p.id
            LEFT JOIN warehouses w ON i.warehouse_id = w.id
            WHERE i.receipt_id = ANY($1)
            ORDER BY i.id ASC
            `,
        [receiptIds],
      )
    : { rows: [] as any[] };

  const itemsByReceipt = new Map<number, ShiftReceiptItem[]>();
  for (const r of itemsRes.rows) {
    const rid = Number(r.receipt_id);
    const itemId = Number(r.id);
    const key = `${rid}-${itemId}`;
    const returnedQty = returnsMap.get(key) || 0;

    const arr = itemsByReceipt.get(rid) || [];
    arr.push({
      id: itemId,
      receipt_id: rid,
      product_id: Number(r.product_id),
      product_name: String(r.product_name),
      warehouse_id: r.warehouse_id ? Number(r.warehouse_id) : null,
      warehouse_name: r.warehouse_name ? String(r.warehouse_name) : null,
      quantity: Number(r.quantity),
      returned_qty: returnedQty,
      available_qty: Number(r.quantity) - returnedQty,
      selling_price_snapshot: Number(r.selling_price_snapshot || 0),
      cost_price_snapshot: Number(r.cost_price_snapshot || 0),
    });
    itemsByReceipt.set(rid, arr);
  }

  return receiptRows.map((r: any) => ({
    id: Number(r.id),
    club_id: Number(r.club_id),
    shift_id: String(r.shift_id),
    created_by: String(r.created_by),
    warehouse_id: r.warehouse_id ? Number(r.warehouse_id) : null,
    warehouse_name: r.warehouse_name
      ? String(r.warehouse_name)
      : "Несколько складов",
    payment_type: r.payment_type as ShiftReceiptPaymentType,
    counts_in_revenue:
      typeof r.counts_in_revenue === "boolean" ? r.counts_in_revenue : true,
    salary_target_user_id: r.salary_target_user_id
      ? String(r.salary_target_user_id)
      : null,
    salary_target_shift_id: r.salary_target_shift_id
      ? String(r.salary_target_shift_id)
      : null,
    cash_amount: Number(r.cash_amount || 0),
    card_amount: Number(r.card_amount || 0),
    total_amount: Number(r.total_amount || 0),
    total_refund_amount: Number(r.total_refund_amount || 0),
    notes: r.notes,
    created_at: r.created_at,
    voided_at: r.voided_at,
    committed_at: r.committed_at,
    items: itemsByReceipt.get(Number(r.id)) || [],
  })) as ShiftReceipt[];
}

export async function getShiftReceipts(
  clubId: string,
  userId: string,
  shiftId: string,
  options?: { includeVoided?: boolean },
) {
  await assertUserCanAccessClub(clubId, userId);
  const includeVoided = options?.includeVoided ?? false;

  const res = await query(
    `
        SELECT
            r.*,
            w.name as warehouse_name
        FROM shift_receipts r
        LEFT JOIN warehouses w ON r.warehouse_id = w.id
        WHERE r.club_id = $1
          AND r.shift_id = $2
          AND r.created_by = $3
          AND ($4::boolean = true OR r.voided_at IS NULL)
        ORDER BY r.created_at DESC
        LIMIT 100
        `,
    [clubId, shiftId, userId, includeVoided],
  );

  return buildShiftReceiptsFromRows(res.rows);
}

export async function getInventoryShiftReceipts(
  clubId: string,
  inventoryId: number,
  options?: { includeVoided?: boolean },
) {
  await requireClubAccess(clubId);
  const includeVoided = options?.includeVoided ?? false;

  const inventoryRes = await query(
    `
        SELECT shift_id, created_by
        FROM warehouse_inventories
        WHERE id = $1 AND club_id = $2
        LIMIT 1
        `,
    [inventoryId, clubId],
  );

  const inventory = inventoryRes.rows[0];
  if (!inventory?.shift_id || !inventory?.created_by) {
    return [] as ShiftReceipt[];
  }

  const receiptsRes = await query(
    `
        SELECT
            r.*,
            w.name as warehouse_name
        FROM shift_receipts r
        LEFT JOIN warehouses w ON r.warehouse_id = w.id
        WHERE r.club_id = $1
          AND r.shift_id = $2
          AND r.created_by = $3
          AND ($4::boolean = true OR r.voided_at IS NULL)
        ORDER BY r.created_at DESC
        LIMIT 100
        `,
    [clubId, inventory.shift_id, inventory.created_by, includeVoided],
  );

  return buildShiftReceiptsFromRows(receiptsRes.rows);
}

export async function voidShiftReceipt(
  clubId: string,
  userId: string,
  receiptId: number,
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    // Get receipt details (committed_at is now always set for active receipts)
    const receiptRes = await client.query(
      `SELECT * FROM shift_receipts WHERE id = $1 AND club_id = $2 AND created_by = $3 AND voided_at IS NULL`,
      [receiptId, clubId, userId],
    );
    if (receiptRes.rowCount === 0)
      throw new Error("Чек не найден или уже аннулирован");

    const receipt = receiptRes.rows[0];
    const shiftId = receipt.shift_id;

    // FIX #2: Always create reversal movements (receipt is already committed)
    const itemsRes = await client.query(
      `SELECT * FROM shift_receipt_items WHERE receipt_id = $1`,
      [receiptId],
    );

    for (const item of itemsRes.rows) {
      const productId = Number(item.product_id);
      const warehouseId = item.warehouse_id
        ? Number(item.warehouse_id)
        : Number(receipt.warehouse_id);
      const qty = Number(item.quantity);

      // Return stock back
      const { previousStock, newStock } = await applyWarehouseStockDelta(
        client,
        warehouseId,
        productId,
        qty, // Positive = add back
      );

      // Create reversal movement
      await logStockMovement(
        client,
        clubId,
        userId,
        productId,
        qty,
        previousStock,
        newStock,
        "SALE",
        `Сторно: аннулирование чека #${receiptId}`,
        "SHIFT_RECEIPT_VOID",
        receiptId,
        shiftId,
        warehouseId,
        Number(item.selling_price_snapshot || 0),
      );
    }

    // Update product cache
    const productIds = itemsRes.rows.map((i: any) => Number(i.product_id));
    if (productIds.length > 0) {
      await client.query(
        `
                UPDATE warehouse_products p
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
                WHERE id = ANY($1) AND club_id = $2
                `,
        [productIds, clubId],
      );
    }

    // Mark receipt as voided
    await client.query(
      `UPDATE shift_receipts SET voided_at = NOW() WHERE id = $1`,
      [receiptId],
    );

    await client.query("COMMIT");

    // FIX: Отправляем SSE уведомление всем клиентам клуба
    try {
      notifyInventoryClub(clubId, {
        type: "RECEIPT_VOIDED",
        receiptId,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error("[SSE] Failed to send notification:", e);
    }

    revalidatePath(`/employee/clubs/${clubId}`);
    return { success: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ============================================================================
// ВОЗВРАТ ТОВАРА ИЗ ЧЕКА (ЧАСТИЧНЫЙ ВОЗВРАТ)
// ============================================================================

export async function returnReceiptItem(
  clubId: string,
  userId: string,
  receiptId: number,
  itemId: number,
  returnQuantity: number,
  reason: string,
) {
  await assertUserCanAccessClub(clubId, userId);

  if (!Number.isInteger(returnQuantity) || returnQuantity <= 0) {
    throw new Error("Количество должно быть целым положительным числом");
  }

  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    // 1. Get receipt and item details
    const receiptRes = await client.query(
      `SELECT * FROM shift_receipts WHERE id = $1 AND club_id = $2 AND created_by = $3 AND voided_at IS NULL`,
      [receiptId, clubId, userId],
    );
    if (receiptRes.rowCount === 0)
      throw new Error("Чек не найден или уже аннулирован");
    const receipt = receiptRes.rows[0];

    const itemRes = await client.query(
      `SELECT * FROM shift_receipt_items WHERE id = $1 AND receipt_id = $2`,
      [itemId, receiptId],
    );
    if (itemRes.rowCount === 0) throw new Error("Позиция не найдена");
    const item = itemRes.rows[0];

    const productId = Number(item.product_id);
    const warehouseId = item.warehouse_id
      ? Number(item.warehouse_id)
      : Number(receipt.warehouse_id);
    const originalQty = Number(item.quantity);
    const price = Number(item.selling_price_snapshot || 0);

    // Check if already returned
    const existingReturnRes = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) as returned_qty
             FROM shift_receipt_returns
             WHERE receipt_id = $1 AND item_id = $2`,
      [receiptId, itemId],
    );
    const returnedQty = Number(existingReturnRes.rows[0]?.returned_qty || 0);
    const availableQty = originalQty - returnedQty;

    if (returnQuantity > availableQty) {
      throw new Error(
        `Нельзя вернуть больше чем ${availableQty} шт. (доступно из ${originalQty})`,
      );
    }

    // 2. Return stock back to warehouse
    const { previousStock, newStock } = await applyWarehouseStockDelta(
      client,
      warehouseId,
      productId,
      returnQuantity, // Positive = add back
    );

    // 3. Log return movement
    await logStockMovement(
      client,
      clubId,
      userId,
      productId,
      returnQuantity,
      previousStock,
      newStock,
      "RETURN", // Changed from 'SALE' to 'RETURN'
      `Возврат из чека #${receiptId}: ${reason}`,
      "SHIFT_RECEIPT_RETURN",
      receiptId,
      receipt.shift_id,
      warehouseId,
      price,
    );

    // 4. Record return in database
    const refundAmount = returnQuantity * price;
    await client.query(
      `
            INSERT INTO shift_receipt_returns (receipt_id, item_id, quantity, refund_amount, reason, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            `,
      [receiptId, itemId, returnQuantity, refundAmount, reason, userId],
    );

    // 4.1 Update receipt total refund amount
    await client.query(
      `UPDATE shift_receipts SET total_refund_amount = COALESCE(total_refund_amount, 0) + $1 WHERE id = $2`,
      [refundAmount, receiptId],
    );

    // 5. Update product cache
    await client.query(
      `
            UPDATE warehouse_products p
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
            WHERE id = $1 AND club_id = $2
            `,
      [productId, clubId],
    );

    await client.query("COMMIT");

    // Send SSE notification
    try {
      notifyInventoryClub(clubId, {
        type: "RECEIPT_ITEM_RETURNED",
        receiptId,
        itemId,
        returnQuantity,
        refundAmount,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error("[SSE] Failed to send return notification:", e);
    }

    revalidatePath(`/employee/clubs/${clubId}`);
    return { success: true, refundAmount };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ============================================================================
// ПРИМЕЧАНИЕ: commitShiftReceiptsToMovements удалена как неиспользуемая.
// Теперь списание происходит мгновенно при создании чека (createShiftReceipt).
// ============================================================================