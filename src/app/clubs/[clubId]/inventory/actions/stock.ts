import { normalizeInventorySettings, getShiftZoneLabel } from "@/lib/inventory-settings";
import { query, getClient } from "@/db";
import { revalidatePath } from "next/cache";
import type { Inventory, SalarySaleCandidate } from "./types";
import { assertProductBelongsToClub, assertProductsBelongToClub } from "./products";
import { assertUserCanAccessClub, assertUserCanUseWarehouses, getInventoryAccessScope, requireClubAccess } from "./auth";
import { checkReplenishmentNeeds } from "./replenishment";
import { getActionErrorMessage } from "./receipts";
import { getClubInventorySettingsInternal } from "./inventories";

export async function getSalarySaleCandidatesInternal(client: any, clubId: string) {
  const inventorySettings = await getClubInventorySettingsInternal(
    client,
    clubId,
  );
  const priceMode: "SELLING" | "COST" =
    inventorySettings.allow_salary_deduction &&
    inventorySettings.allow_cost_price_sale
      ? "COST"
      : "SELLING";
  const defaultDiscountRaw = Number(
    inventorySettings.employee_discount_percent ?? 0,
  );
  const defaultDiscount = Number.isFinite(defaultDiscountRaw)
    ? Math.min(100, Math.max(0, defaultDiscountRaw))
    : 0;
  const overrideSource = inventorySettings.employee_discount_overrides || {};
  const resolveDiscountPercent = (userId: string) => {
    if (priceMode === "COST") return 0;
    const overrideRaw = Number((overrideSource as any)[userId]);
    const resolved = Number.isFinite(overrideRaw)
      ? overrideRaw
      : defaultDiscount;
    return Math.min(100, Math.max(0, resolved));
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  const res = await client.query(
    `
        WITH month_shifts AS (
            SELECT
                s.user_id,
                s.id,
                s.check_in,
                COALESCE(s.calculated_salary, 0) as calculated_salary,
                COALESCE(s.bar_purchases, 0) as bar_purchases
            FROM shifts s
            WHERE s.club_id = $1
              AND s.check_in >= $2
              AND s.check_in <= $3
              AND s.status IN ('CLOSED', 'PAID', 'VERIFIED', 'ACTIVE')
        ),
        latest_shift AS (
            SELECT DISTINCT ON (user_id)
                user_id,
                id as reference_shift_id,
                check_in
            FROM month_shifts
            ORDER BY user_id, check_in DESC, id DESC
        ),
        shift_agg AS (
            SELECT
                user_id,
                COUNT(*)::int as shifts_in_month,
                SUM(calculated_salary)::numeric as earned_amount,
                SUM(bar_purchases)::numeric as bar_purchases_amount
            FROM month_shifts
            GROUP BY user_id
        ),
        payments_agg AS (
            SELECT
                p.user_id,
                SUM(p.amount) FILTER (WHERE p.payment_type != 'bonus')::numeric as paid_amount
            FROM payments p
            WHERE p.club_id = $1
              AND p.month = $4
              AND p.year = $5
            GROUP BY p.user_id
        )
        SELECT
            u.id,
            u.full_name,
            COALESCE(ce.role, 'Сотрудник') as role,
            ls.reference_shift_id,
            sa.shifts_in_month,
            GREATEST(
                COALESCE(sa.earned_amount, 0) - COALESCE(pa.paid_amount, 0) - COALESCE(sa.bar_purchases_amount, 0),
                0
            )::numeric as available_amount
        FROM club_employees ce
        JOIN users u ON u.id = ce.user_id
        JOIN shift_agg sa ON sa.user_id = ce.user_id
        JOIN latest_shift ls ON ls.user_id = ce.user_id
        LEFT JOIN payments_agg pa ON pa.user_id = ce.user_id
        WHERE ce.club_id = $1
          AND ce.is_active = true
          AND ce.dismissed_at IS NULL
        ORDER BY
            CASE WHEN COALESCE(ce.role, '') IN ('Админ', 'Управляющий', 'Владелец') THEN 0 ELSE 1 END,
            u.full_name
        `,
    [
      clubId,
      monthStart.toISOString(),
      monthEnd.toISOString(),
      now.getMonth() + 1,
      now.getFullYear(),
    ],
  );

  return res.rows.map((row: any) => ({
    id: String(row.id),
    full_name: String(row.full_name),
    role: String(row.role || "Сотрудник"),
    reference_shift_id: String(row.reference_shift_id),
    shifts_in_month: Number(row.shifts_in_month || 0),
    available_amount: Number(row.available_amount || 0),
    discount_percent: resolveDiscountPercent(String(row.id)),
    price_mode: priceMode,
  })) as SalarySaleCandidate[];
}

export async function getSalarySaleCandidates(clubId: string) {
  await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    return await getSalarySaleCandidatesInternal(client, clubId);
  } finally {
    client.release();
  }
}

export async function transferStock(
  clubId: string,
  userId: string,
  data: {
    source_warehouse_id: number;
    target_warehouse_id: number;
    product_id: number;
    quantity: number;
    notes?: string;
  },
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    const { source_warehouse_id, target_warehouse_id, product_id, quantity } =
      data;
    if (
      !Number.isFinite(quantity) ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        "Количество для перемещения должно быть целым положительным числом",
      );
    }
    await assertWarehouseBelongsToClub(client, clubId, source_warehouse_id);
    await assertWarehouseBelongsToClub(client, clubId, target_warehouse_id);
    await assertProductBelongsToClub(client, clubId, product_id);
    await assertUserCanUseWarehouses(client, clubId, userId, [
      source_warehouse_id,
      target_warehouse_id,
    ]);

    if (source_warehouse_id === target_warehouse_id) {
      throw new Error("Склады отправления и назначения должны быть разными");
    }

    // 1. Check source stock
    const sourceStockRes = await client.query(
      "SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE",
      [source_warehouse_id, product_id],
    );
    const sourcePrevStock = sourceStockRes.rows[0]?.quantity || 0;

    if (sourcePrevStock < quantity) {
      throw new Error(
        `Недостаточно товара на складе отправления. Доступно: ${sourcePrevStock}`,
      );
    }

    // 2. Update source stock
    const { previousStock: sourcePrev, newStock: sourceNewStock } =
      await applyWarehouseStockDelta(
        client,
        source_warehouse_id,
        product_id,
        -quantity,
      );

    // 3. Update target stock
    const { previousStock: targetPrevStock, newStock: targetNewStock } =
      await applyWarehouseStockDelta(
        client,
        target_warehouse_id,
        product_id,
        quantity,
      );

    // 4. Log movements
    const notes = data.notes ? `: ${data.notes}` : "";

    // Log out from source
    await logStockMovement(
      client,
      clubId,
      userId,
      product_id,
      -quantity,
      sourcePrev,
      sourceNewStock,
      "ADJUSTMENT",
      `Перемещение на склад #${target_warehouse_id}${notes}`,
      "TRANSFER",
      null,
      null,
      source_warehouse_id,
    );

    // Log in to target
    await logStockMovement(
      client,
      clubId,
      userId,
      product_id,
      quantity,
      targetPrevStock,
      targetNewStock,
      "ADJUSTMENT",
      `Перемещение со склада #${source_warehouse_id}${notes}`,
      "TRANSFER",
      null,
      null,
      target_warehouse_id,
    );

    await client.query("COMMIT");
    revalidatePath(`/clubs/${clubId}/inventory`);
    revalidatePath(`/clubs/${clubId}/inventory`, "layout");
    return { success: true };
  } catch (e: any) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function createTransfer(
  clubId: string,
  userId: string,
  data: {
    source_warehouse_id: number;
    target_warehouse_id: number;
    items: { product_id: number; quantity: number }[];
    notes?: string;
    shift_id?: string;
  },
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");
    const inventorySettings = await getClubInventorySettingsInternal(
      client,
      clubId,
    );
    if (!inventorySettings.stock_enabled) {
      throw new Error(
        "Перемещения доступны только когда включен учет остатков",
      );
    }
    if (!inventorySettings.employee_transfer_enabled) {
      throw new Error("Перемещения отключены в кабинете сотрудника");
    }

    const { source_warehouse_id, target_warehouse_id, items, notes, shift_id } =
      data;
    if (!items || items.length === 0)
      throw new Error("Нужно выбрать товары для перемещения");
    for (const i of items) {
      if (
        !Number.isFinite(i.quantity) ||
        !Number.isInteger(i.quantity) ||
        i.quantity <= 0
      ) {
        throw new Error(
          "Количество для перемещения должно быть целым положительным числом",
        );
      }
    }
    await assertWarehouseBelongsToClub(client, clubId, source_warehouse_id);
    await assertWarehouseBelongsToClub(client, clubId, target_warehouse_id);
    await assertProductsBelongToClub(
      client,
      clubId,
      items.map((i) => i.product_id),
    );
    await assertUserCanUseWarehouses(client, clubId, userId, [
      source_warehouse_id,
      target_warehouse_id,
    ]);

    if (source_warehouse_id === target_warehouse_id) {
      throw new Error("Склады отправления и назначения должны быть разными");
    }

    for (const item of items) {
      const { product_id, quantity } = item;

      // 1. Check source stock
      const sourceStockRes = await client.query(
        "SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE",
        [source_warehouse_id, product_id],
      );
      const sourcePrevStock = sourceStockRes.rows[0]?.quantity || 0;

      if (sourcePrevStock < quantity) {
        const prodRes = await client.query(
          "SELECT name FROM warehouse_products WHERE id = $1 AND club_id = $2",
          [product_id, clubId],
        );
        throw new Error(
          `Недостаточно товара "${prodRes.rows[0]?.name || `#${product_id}`}" на складе отправления. Доступно: ${sourcePrevStock}`,
        );
      }

      // 2. Update source stock
      const { previousStock: sourcePrev, newStock: sourceNewStock } =
        await applyWarehouseStockDelta(
          client,
          source_warehouse_id,
          product_id,
          -quantity,
        );

      // 3. Update target stock
      const { previousStock: targetPrevStock, newStock: targetNewStock } =
        await applyWarehouseStockDelta(
          client,
          target_warehouse_id,
          product_id,
          quantity,
        );

      // 4. Log movements
      const notesStr = notes ? `: ${notes}` : "";

      // Log out from source
      await logStockMovement(
        client,
        clubId,
        userId,
        product_id,
        -quantity,
        sourcePrev,
        sourceNewStock,
        "TRANSFER",
        `Перемещение на склад #${target_warehouse_id}${notesStr}`,
        "TRANSFER",
        null,
        shift_id || null,
        source_warehouse_id,
      );

      // Log in to target
      await logStockMovement(
        client,
        clubId,
        userId,
        product_id,
        quantity,
        targetPrevStock,
        targetNewStock,
        "TRANSFER",
        `Перемещение со склада #${source_warehouse_id}${notesStr}`,
        "TRANSFER",
        null,
        shift_id || null,
        target_warehouse_id,
      );

      // 5. Update product cache
      await client.query(
        `
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1 AND club_id = $2
            `,
        [product_id, clubId],
      );

      // 6. AUTO-CLOSE RESTOCK TASKS
      // If we are moving TO a warehouse that is a Target in some RESTOCK rule,
      // we check if that rule's requirements are now met.
      await client.query(
        `
                UPDATE club_tasks
                SET status = 'COMPLETED',
                    completed_by = $1,
                    completed_at = NOW(),
                    description = description || ' (Закрыто автоматически: ручное перемещение)'
                WHERE club_id = $2
                  AND type = 'RESTOCK'
                  AND status != 'COMPLETED'
                  AND related_entity_type = 'PRODUCT'
                  AND related_entity_id = $3
                  AND EXISTS (
                      SELECT 1 FROM warehouse_replenishment_rules r
                      JOIN warehouses tw ON r.target_warehouse_id = tw.id
                      WHERE r.product_id = $3
                        AND r.target_warehouse_id = $4
                        AND r.is_active = true
                        AND (
                            -- Task is related to this warehouse
                            club_tasks.description LIKE '%' || tw.name || '%'
                        )
                  )
            `,
        [userId, clubId, product_id, target_warehouse_id],
      );
    }

    await client.query("COMMIT");
    revalidatePath(`/clubs/${clubId}/inventory`);
    revalidatePath(`/employee/clubs/${clubId}`);
    return { success: true };
  } catch (e: any) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getStockMovements(clubId: string, limit: number = 1000) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT m.*, p.name as product_name, u.full_name as user_name, w.name as warehouse_name
        FROM warehouse_stock_movements m
        JOIN warehouse_products p ON m.product_id = p.id
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN warehouses w ON m.warehouse_id = w.id
        WHERE m.club_id = $1
        ORDER BY m.created_at DESC
        LIMIT $2
    `,
    [clubId, limit],
  );
  return res.rows;
}

export async function logStockMovement(
  client: any,
  clubId: string,
  userId: string | null,
  productId: number,
  changeAmount: number,
  previousStock: number,
  newStock: number,
  type: string,
  reason: string | null = null,
  relatedEntityType: string | null = null,
  relatedEntityId: number | null = null,
  shiftId: string | null = null,
  warehouseId: number | null = null,
  priceAtTime: number | null = null,
) {
  const res = await client.query(
    `
        INSERT INTO warehouse_stock_movements
        (club_id, product_id, user_id, change_amount, previous_stock, new_stock, type, reason, related_entity_type, related_entity_id, shift_id, warehouse_id, price_at_time)
        SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, selling_price)
        FROM warehouse_products
        WHERE id = $2 AND club_id = $1
        RETURNING id
    `,
    [
      clubId,
      productId,
      userId,
      changeAmount,
      previousStock,
      newStock,
      type,
      reason,
      relatedEntityType,
      relatedEntityId,
      shiftId,
      warehouseId,
      priceAtTime,
    ],
  );
  return (res.rows[0]?.id ?? null) as number | null;
}

export async function assertWarehouseBelongsToClub(
  db: { query: (sql: string, params?: any[]) => Promise<any> },
  clubId: string,
  warehouseId: number,
) {
  const res = await db.query(
    "SELECT 1 FROM warehouses WHERE id = $1 AND club_id = $2 LIMIT 1",
    [warehouseId, clubId],
  );
  if ((res.rowCount || 0) === 0)
    throw new Error("Склад не найден или не принадлежит клубу");
}

export async function syncProductsCurrentStock(
  client: any,
  clubId: string,
  productIds: Iterable<number>,
) {
  const uniqueProductIds = Array.from(
    new Set(
      Array.from(productIds)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
  if (uniqueProductIds.length === 0) return;
  await client.query(
    `
        UPDATE warehouse_products p
        SET current_stock = (
            SELECT COALESCE(SUM(quantity), 0)
            FROM warehouse_stock ws
            WHERE ws.product_id = p.id
        )
        WHERE p.club_id = $1
          AND p.id = ANY($2::int[])
        `,
    [clubId, uniqueProductIds],
  );
}

export async function applyWarehouseStockDelta(
  client: any,
  warehouseId: number,
  productId: number,
  delta: number,
): Promise<{ previousStock: number; newStock: number }> {
  if (!Number.isFinite(delta)) throw new Error("Некорректное количество");
  if (!Number.isInteger(delta))
    throw new Error("Количество должно быть целым числом");

  if (delta === 0) {
    const stockRes = await client.query(
      "SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2",
      [warehouseId, productId],
    );
    const q = Number(stockRes.rows[0]?.quantity || 0);
    return { previousStock: q, newStock: q };
  }

  // Atomic upsert that works even when the row does not exist.
  const res = await client.query(
    `
        INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity
        RETURNING quantity
        `,
    [warehouseId, productId, delta],
  );
  const newStock = Number(res.rows[0]?.quantity || 0);
  const previousStock = newStock - delta;
  return { previousStock, newStock };
}

export async function getLockedWarehouseStock(
  client: any,
  warehouseId: number,
  productId: number,
) {
  const stockRes = await client.query(
    `
        SELECT quantity
        FROM warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2
        FOR UPDATE
        `,
    [warehouseId, productId],
  );
  return Number(stockRes.rows[0]?.quantity || 0);
}

// --- TASKS ---

export async function correctStockMovement(
  movementId: number,
  clubId: string,
  userId: string,
  newAmount: number,
  newReason?: string,
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // 1. Находим само движение
    const mRes = await client.query(
      "SELECT * FROM warehouse_stock_movements WHERE id = $1 AND club_id = $2",
      [movementId, clubId],
    );
    if (mRes.rows.length === 0) throw new Error("Движение не найдено");
    const movement = mRes.rows[0];
    const {
      club_id,
      product_id,
      warehouse_id,
      change_amount: oldAmount,
      type,
      related_entity_type,
      related_entity_id,
    } = movement;

    // Если это продажа, то change_amount обычно отрицательный.
    // Мы ожидаем, что пользователь вводит положительное число "сколько продано",
    // поэтому конвертируем его в отрицательное для БД.
    const normalizedNewAmount =
      type === "SALE" ? -Math.abs(newAmount) : newAmount;
    const diff = normalizedNewAmount - oldAmount;

    if (diff === 0 && newReason === movement.reason) {
      await client.query("COMMIT");
      return { success: true };
    }

    // 2. Обновляем саму запись движения
    await client.query(
      `
            UPDATE warehouse_stock_movements
            SET change_amount = $1, reason = $2, new_stock = previous_stock + $1
            WHERE id = $3
        `,
      [normalizedNewAmount, newReason || movement.reason, movementId],
    );

    // 3. Проверяем, были ли инвентаризации ПОСЛЕ этого движения по этому товару
    const laterInvRes = await client.query(
      `
            SELECT id FROM warehouse_inventories
            WHERE club_id = $1 AND status = 'CLOSED' AND closed_at > $2
            LIMIT 1
        `,
      [club_id, movement.created_at],
    );

    const hasLaterInventory = laterInvRes.rows.length > 0;

    // 4. Корректируем склад ТОЛЬКО если не было инвентаризаций после
    if (!hasLaterInventory && warehouse_id) {
      await client.query(
        `
                INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
            `,
        [warehouse_id, product_id, diff],
      );

      // Обновляем общий кэш остатка в таблице продуктов
      await client.query(
        `
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1 AND club_id = $2
            `,
        [product_id, clubId],
      );
    }

    // 5. Если движение было частью инвентаризации, правим её финансовые итоги
    let inventoryId =
      related_entity_type === "INVENTORY" ? related_entity_id : null;

    if (inventoryId && type === "SALE") {
      const invItemRes = await client.query(
        `
                SELECT selling_price_snapshot FROM warehouse_inventory_items
                WHERE inventory_id = $1 AND product_id = $2
            `,
        [inventoryId, product_id],
      );

      const price = invItemRes.rows[0]?.selling_price_snapshot || 0;
      const actualRevenueDiff = diff * price;

      // В инвентаризации:
      // calculated_revenue уменьшается на разницу (так как мы продали больше/меньше)
      // revenue_difference (расхождение) увеличивается на эту же сумму
      await client.query(
        `
                UPDATE warehouse_inventories
                SET calculated_revenue = calculated_revenue - $1,
                    revenue_difference = revenue_difference + $1
                WHERE id = $2
            `,
        [actualRevenueDiff, inventoryId],
      );
    }

    await client.query("COMMIT");
    revalidatePath(`/clubs/${clubId}/inventory`);
    return { success: true, wasStockAdjusted: !hasLaterInventory };
  } catch (e: any) {
    await client.query("ROLLBACK");
    console.error("Error correcting movement:", e);
    return { success: false, error: e.message };
  } finally {
    client.release();
  }
}

export async function deleteStockMovement(
  id: number,
  clubId: string,
  options?: { revertToWarehouseId?: number },
) {
  await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    // 1. Get movement info
    const moveRes = await client.query(
      "SELECT * FROM warehouse_stock_movements WHERE id = $1 AND club_id = $2",
      [id, clubId],
    );
    if (moveRes.rowCount === 0) throw new Error("Запись не найдена");

    const move = moveRes.rows[0];

    // 2. Revert stock if warehouse specified
    if (options?.revertToWarehouseId) {
      const revertAmount = -move.change_amount; // If was sale (-5), revert +5

      await client.query(
        `
                INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
            `,
        [options.revertToWarehouseId, move.product_id, revertAmount],
      );

      // Update cache
      await client.query(
        `
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1 AND club_id = $2
            `,
        [move.product_id, clubId],
      );
    }

    // 3. If it was an inventory sale, update the inventory header's calculated revenue (to fix differences)
    if (move.related_entity_type === "INVENTORY" && move.type === "SALE") {
      const invItemRes = await client.query(
        `
                SELECT selling_price_snapshot FROM warehouse_inventory_items
                WHERE inventory_id = $1 AND product_id = $2
            `,
        [move.related_entity_id, move.product_id],
      );

      const price = invItemRes.rows[0]?.selling_price_snapshot || 0;
      const revenueToRevert = move.change_amount * price; // e.g. -5 * 100 = -500

      await client.query(
        `
                UPDATE warehouse_inventories
                SET calculated_revenue = calculated_revenue + $1,
                    revenue_difference = revenue_difference - $1
                WHERE id = $2
            `,
        [revenueToRevert, move.related_entity_id],
      );
    }

    // 4. Delete movement
    await client.query("DELETE FROM warehouse_stock_movements WHERE id = $1", [
      id,
    ]);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function createTransferSafe(
  clubId: string,
  userId: string,
  data: {
    source_warehouse_id: number;
    target_warehouse_id: number;
    items: { product_id: number; quantity: number }[];
    notes?: string;
    shift_id?: string;
  },
) {
  try {
    await createTransfer(clubId, userId, data);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка при оформлении перемещения"),
    };
  }
}

export async function createWriteOffSafe(
  clubId: string,
  userId: string,
  data: {
    items: {
      product_id: number;
      quantity: number;
      type: "WASTE" | "SALARY_DEDUCTION";
      custom_price?: number;
    }[];
    notes: string;
    shift_id?: string;
    warehouse_id?: number;
  },
) {
  try {
    await createWriteOff(clubId, userId, data);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка при оформлении списания"),
    };
  }
}

export async function assignShiftToMovement(
  movementId: number,
  shiftId: string | null,
  clubId: string,
) {
  await requireClubAccess(clubId);
  await query(
    `
        UPDATE warehouse_stock_movements
        SET shift_id = $1
        WHERE id = $2 AND club_id = $3
    `,
    [shiftId, movementId, clubId],
  );
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function massAssignShiftToMovements(
  movementIds: number[],
  shiftId: string | null,
  clubId: string,
) {
  await requireClubAccess(clubId);
  await query(
    `
        UPDATE warehouse_stock_movements
        SET shift_id = $1
        WHERE id = ANY($2::int[]) AND club_id = $3
    `,
    [shiftId, movementIds, clubId],
  );
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function createWriteOff(
  clubId: string,
  userId: string,
  data: {
    items: {
      product_id: number;
      quantity: number;
      type: "WASTE" | "SALARY_DEDUCTION";
      custom_price?: number;
    }[];
    notes: string;
    shift_id?: string;
    warehouse_id?: number;
  },
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");
    const inventorySettings = await getClubInventorySettingsInternal(
      client,
      clubId,
    );
    if (!inventorySettings.stock_enabled) {
      throw new Error("Списания доступны только когда включен учет остатков");
    }
    if (!inventorySettings.employee_writeoff_enabled) {
      throw new Error("Списания отключены в кабинете сотрудника");
    }

    if (!data.items || data.items.length === 0)
      throw new Error("Не выбраны товары для списания");
    for (const i of data.items) {
      if (
        !Number.isFinite(i.quantity) ||
        !Number.isInteger(i.quantity) ||
        i.quantity <= 0
      ) {
        throw new Error("Количество должно быть целым положительным числом");
      }
    }
    await assertProductsBelongToClub(
      client,
      clubId,
      data.items.map((i) => i.product_id),
    );

    // Find warehouse (passed explicitly, or default, or fallback to first available)
    let warehouseId = data.warehouse_id;

    if (!warehouseId) {
      // Try to find if there is an OPEN inventory for this shift
      if (data.shift_id) {
        const activeInv = await client.query(
          `
                    SELECT warehouse_id FROM warehouse_inventories
                    WHERE shift_id = $1 AND status = 'OPEN'
                    LIMIT 1
                `,
          [data.shift_id],
        );
        if (
          activeInv.rowCount &&
          activeInv.rowCount > 0 &&
          activeInv.rows[0].warehouse_id
        ) {
          warehouseId = activeInv.rows[0].warehouse_id;
        }
      }
    }

    if (!warehouseId) {
      const whRes = await client.query(
        `
                SELECT id FROM warehouses
                WHERE club_id = $1
                ORDER BY is_default DESC, created_at ASC
                LIMIT 1
            `,
        [clubId],
      );
      warehouseId = whRes.rows[0]?.id;
    }

    if (!warehouseId) throw new Error("В клубе не создано ни одного склада");
    await assertWarehouseBelongsToClub(client, clubId, warehouseId);
    await assertUserCanUseWarehouses(client, clubId, userId, [warehouseId]);

    // 0. Check for existing inventory OR create one if it's a salary deduction
    let inventoryId: number | null = null;
    if (data.shift_id) {
      const activeInv = await client.query(
        `
                SELECT id, warehouse_id FROM warehouse_inventories
                WHERE shift_id = $1 AND warehouse_id = $2 AND status = 'OPEN'
                LIMIT 1
            `,
        [data.shift_id, warehouseId],
      );

      if (activeInv.rowCount && activeInv.rowCount > 0) {
        inventoryId = activeInv.rows[0].id;
      } else if (data.items.some((i) => i.type === "SALARY_DEDUCTION")) {
        const anyShiftInventory = await client.query(
          `
                    SELECT id, warehouse_id
                    FROM warehouse_inventories
                    WHERE shift_id = $1 AND club_id = $2 AND status = 'OPEN'
                    ORDER BY started_at ASC
                    LIMIT 1
                `,
          [data.shift_id, clubId],
        );
        if (anyShiftInventory.rowCount && anyShiftInventory.rowCount > 0) {
          throw new Error(
            `Для этой смены уже открыта инвентаризация по складу #${anyShiftInventory.rows[0].warehouse_id}. Закройте её или используйте тот же склад.`,
          );
        }

        // Auto-create inventory if salary deduction is being made and no inventory exists
        // 1. Get default metric key
        const settingsRes = await client.query(
          "SELECT inventory_settings FROM clubs WHERE id = $1",
          [clubId],
        );
        const settings = normalizeInventorySettings(
          settingsRes.rows[0]?.inventory_settings,
        );
        const targetMetric =
          settings.employee_default_metric_key || "total_revenue";

        // 2. Create Inventory Header
        const invRes = await client.query(
          `
                    INSERT INTO warehouse_inventories (club_id, created_by, status, target_metric_key, warehouse_id, shift_id)
                    VALUES ($1, $2, 'OPEN', $3, $4, $5)
                    RETURNING id
                `,
          [clubId, userId, targetMetric, warehouseId, data.shift_id],
        );
        inventoryId = invRes.rows[0].id;

        // 3. Snapshot current stock
        await client.query(
          `
                    INSERT INTO warehouse_inventory_items (inventory_id, product_id, expected_stock, cost_price_snapshot, selling_price_snapshot)
                    SELECT $1, p.id, COALESCE(ws.quantity, 0), p.cost_price, p.selling_price
                    FROM warehouse_products p
                    LEFT JOIN warehouse_stock ws ON p.id = ws.product_id AND ws.warehouse_id = $2
                    WHERE p.club_id = $3 AND p.is_active = true
                `,
          [inventoryId, warehouseId, clubId],
        );
      }
    }

    for (const item of data.items) {
      // 1. Update stock
      const { previousStock, newStock } = await applyWarehouseStockDelta(
        client,
        warehouseId,
        item.product_id,
        -item.quantity,
      );

      // 3. Update product cache
      await client.query(
        `
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1 AND club_id = $2
            `,
        [item.product_id, clubId],
      );

      // 4. Log movement
      const reason =
        item.type === "SALARY_DEDUCTION"
          ? `В счет ЗП: ${data.notes}`
          : `Списание: ${data.notes}`;
      const movementType =
        item.type === "SALARY_DEDUCTION" ? "SALE" : "WRITE_OFF";

      // If custom price is provided, we use it for logging the movement
      const priceToUse = item.custom_price ?? null;
      await logStockMovement(
        client,
        clubId,
        userId,
        item.product_id,
        -item.quantity,
        previousStock,
        newStock,
        movementType,
        reason,
        "WRITE_OFF",
        null,
        data.shift_id || null,
        warehouseId,
        priceToUse,
      );

      // 5. If Salary Deduction, update Shift
      if (item.type === "SALARY_DEDUCTION") {
        const prodRes = await client.query(
          "SELECT selling_price FROM warehouse_products WHERE id = $1 AND club_id = $2",
          [item.product_id, clubId],
        );
        const defaultPrice = prodRes.rows[0]?.selling_price || 0;
        const price = item.custom_price ?? defaultPrice;
        const totalDeduction = price * item.quantity;

        if (data.shift_id) {
          await client.query(
            `
                        UPDATE shifts
                        SET bar_purchases = COALESCE(bar_purchases, 0) + $1
                        WHERE id = $2 AND club_id = $3
                    `,
            [totalDeduction, data.shift_id, clubId],
          );
        }
      }
    }

    await client.query("COMMIT");

    // Check if write-off triggered new replenishment needs
    await checkReplenishmentNeeds(clubId);

    revalidatePath(`/clubs/${clubId}/inventory`);
    revalidatePath(`/employee/clubs/${clubId}`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function adjustWarehouseStock(
  clubId: string,
  userId: string,
  productId: number,
  warehouseId: number,
  newQuantity: number,
  reason: string,
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    if (
      !Number.isFinite(newQuantity) ||
      !Number.isInteger(newQuantity) ||
      newQuantity < 0
    ) {
      throw new Error("Новый остаток должен быть целым неотрицательным числом");
    }
    await assertWarehouseBelongsToClub(client, clubId, warehouseId);
    await assertProductBelongsToClub(client, clubId, productId);
    await assertUserCanUseWarehouses(client, clubId, userId, [warehouseId]);

    // Get old stock
    const stockRes = await client.query(
      "SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE",
      [warehouseId, productId],
    );
    const oldQuantity = stockRes.rows[0]?.quantity || 0;
    const diff = newQuantity - oldQuantity;

    if (diff === 0) {
      await client.query("ROLLBACK");
      return;
    }

    // Update Stock
    const { previousStock, newStock } = await applyWarehouseStockDelta(
      client,
      warehouseId,
      productId,
      diff,
    );

    // Update Total Cache in Products Table
    await client.query(
      `
            UPDATE warehouse_products p
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
            WHERE id = $1 AND club_id = $2
        `,
      [productId, clubId],
    );

    await logStockMovement(
      client,
      clubId,
      userId,
      productId,
      diff,
      previousStock,
      newStock,
      "MANUAL_EDIT",
      reason,
      "WAREHOUSE",
      warehouseId,
      null,
      warehouseId,
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function writeOffProduct(
  clubId: string,
  userId: string,
  productId: number,
  amount: number,
  reason: string,
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
      throw new Error(
        "Количество для списания должно быть целым положительным числом",
      );
    }
    await assertProductBelongsToClub(client, clubId, productId);
    const accessScope = await getInventoryAccessScope(client, clubId, userId);

    // Find warehouse with enough stock
    // Strategy: First Default, then others
    const stocksParams: any[] = [productId, clubId];
    const warehouseRestriction = !accessScope.canManageInventory
      ? ` AND ws.warehouse_id = ANY($3)`
      : "";
    if (
      !accessScope.canManageInventory &&
      accessScope.allowedWarehouseIds.length === 0
    ) {
      throw new Error("Для вашего профиля не настроены доступные склады");
    }
    if (!accessScope.canManageInventory) {
      stocksParams.push(accessScope.allowedWarehouseIds);
    }

    const stocks = await client.query(
      `
            SELECT ws.warehouse_id, ws.quantity
            FROM warehouse_stock ws
            JOIN warehouses w ON ws.warehouse_id = w.id
            WHERE ws.product_id = $1
              AND w.club_id = $2
              ${warehouseRestriction}
            ORDER BY w.is_default DESC, ws.quantity DESC
        `,
      stocksParams,
    );

    let remaining = amount;
    const writeOffs: { warehouseId: number; amount: number }[] = [];

    // Check total availability
    const totalAvailable = stocks.rows.reduce(
      (sum, row) => sum + row.quantity,
      0,
    );
    if (totalAvailable < amount) {
      throw new Error(
        `Недостаточно товара на складе. Текущий остаток: ${totalAvailable}`,
      );
    }

    // Calculate write-offs per warehouse
    for (const stock of stocks.rows) {
      if (remaining <= 0) break;
      const take = Math.min(stock.quantity, remaining);
      writeOffs.push({ warehouseId: stock.warehouse_id, amount: take });
      remaining -= take;
    }

    // Apply updates
    for (const wo of writeOffs) {
      const { previousStock, newStock } = await applyWarehouseStockDelta(
        client,
        wo.warehouseId,
        productId,
        -wo.amount,
      );
      await logStockMovement(
        client,
        clubId,
        userId,
        productId,
        -wo.amount,
        previousStock,
        newStock,
        "WRITE_OFF",
        reason,
        "WAREHOUSE",
        wo.warehouseId,
        null,
        wo.warehouseId,
      );
    }

    // Update Total Cache
    await client.query(
      `
            UPDATE warehouse_products p
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
            WHERE id = $1 AND club_id = $2
        `,
      [productId, clubId],
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/clubs/${clubId}/inventory`);
}