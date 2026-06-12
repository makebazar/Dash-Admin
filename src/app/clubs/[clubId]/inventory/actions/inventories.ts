"use server";

import type { InventorySettings as NormalizedInventorySettings } from "@/lib/inventory-settings";
import { logOperation } from "@/lib/logger";
import { normalizeInventorySettings, getShiftZoneLabel } from "@/lib/inventory-settings";
import { query, getClient } from "@/db";
import { revalidatePath } from "next/cache";
import type { Inventory, InventoryItem, InventoryPostCloseCorrection } from "./types";
import { applyWarehouseStockDelta, getLockedWarehouseStock, logStockMovement } from "./stock";
import { assertProductsBelongToClub } from "./products";
import { assertSessionUserCanAccessClub, assertUserCanAccessClub, assertUserCanUseWarehouses, getInventoryAccessScope, requireClubAccess, requireSessionUserId } from "./auth";
import { checkReplenishmentNeeds } from "./replenishment";
import { getActionErrorMessage } from "./receipts";

export function normalizeInventoryActualStock(actualStock: number | null) {
  if (actualStock === null) return null;
  if (!Number.isFinite(actualStock))
    throw new Error("Фактический остаток должен быть числом");
  if (!Number.isInteger(actualStock))
    throw new Error("Фактический остаток должен быть целым числом");
  if (actualStock < 0)
    throw new Error("Фактический остаток не может быть отрицательным");
  return actualStock;
}

export function calculateInventoryDelta(
  expectedStock: number,
  movementDuringInventory: number,
  actualStock: number,
) {
  const adjustedExpected = Math.max(
    0,
    Number(expectedStock) + Number(movementDuringInventory || 0),
  );
  const difference = actualStock - adjustedExpected;
  return { adjustedExpected, difference };
}

export async function getInventoryMovementDuringCount(
  client: any,
  inventoryId: number,
  productId: number,
  warehouseId: number,
  clubId: string,
  startedAt: string,
  closedAt?: string | null,
) {
  const movementRes = await client.query(
    `
        SELECT COALESCE(SUM(change_amount), 0) as total
        FROM warehouse_stock_movements
        WHERE product_id = $1
          AND warehouse_id = $2
          AND club_id = $3
          AND created_at > $4
          AND ($5::timestamp IS NULL OR created_at <= $5::timestamp)
          AND NOT (
              COALESCE(related_entity_type, '') = 'INVENTORY'
              AND COALESCE(related_entity_id, -1) = $6
          )
        `,
    [productId, warehouseId, clubId, startedAt, closedAt || null, inventoryId],
  );
  return Number(movementRes.rows[0]?.total || 0);
}

export async function correctInventoryItem(
  inventoryId: number,
  productId: number,
  newActualStock: number,
  clubId: string,
  userId: string,
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // 1. Get current inventory and item info
    const invRes = await client.query(
      "SELECT * FROM warehouse_inventories WHERE id = $1 AND club_id = $2",
      [inventoryId, clubId],
    );
    if (invRes.rows.length === 0) throw new Error("Инвентаризация не найдена");
    const inventory = invRes.rows[0];

    const itemRes = await client.query(
      `
            SELECT * FROM warehouse_inventory_items
            WHERE inventory_id = $1 AND product_id = $2
        `,
      [inventoryId, productId],
    );
    if (itemRes.rows.length === 0) throw new Error("Позиция не найдена");
    const item = itemRes.rows[0];

    const normalizedActualStock = normalizeInventoryActualStock(newActualStock);
    if (normalizedActualStock === null)
      throw new Error("Фактический остаток обязателен");

    const oldActualStock =
      item.actual_stock !== null ? Number(item.actual_stock) : null;
    const expectedStock = Number(item.expected_stock);
    const price = Number(item.selling_price_snapshot);
    let warehouseId = inventory.warehouse_id;
    if (!warehouseId) {
      const whRes = await client.query(
        "SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1",
        [clubId],
      );
      warehouseId = whRes.rows[0]?.id;
    }
    if (!warehouseId)
      throw new Error("Не найден склад для корректировки остатков");
    await assertUserCanUseWarehouses(client, clubId, userId, [warehouseId]);

    if (inventory.status !== "CLOSED") {
      throw new Error(
        "Для открытой инвентаризации используйте обычное редактирование остатков",
      );
    }
    if (inventory.shift_id || inventory.target_metric_key) {
      throw new Error(
        "Закрытую сменную инвентаризацию нельзя корректировать постфактум. Создайте новую ревизию.",
      );
    }
    if (oldActualStock === null) {
      throw new Error(
        "Нельзя корректировать позицию без зафиксированного фактического остатка",
      );
    }

    const movementDuringInventory = await getInventoryMovementDuringCount(
      client,
      inventoryId,
      productId,
      Number(warehouseId),
      clubId,
      inventory.started_at,
      inventory.closed_at || null,
    );
    const { difference: newDifference } = calculateInventoryDelta(
      expectedStock,
      movementDuringInventory,
      normalizedActualStock,
    );
    const newCalculatedRevenue = 0;

    // 2. Update inventory item
    await client.query(
      `
            UPDATE warehouse_inventory_items
            SET actual_stock = $1::integer,
                difference = $2::integer,
                calculated_revenue = $3::numeric,
                counted_at = COALESCE(counted_at, NOW()),
                counted_by = COALESCE(counted_by, $6::uuid)
            WHERE inventory_id = $4 AND product_id = $5
        `,
      [
        normalizedActualStock,
        newDifference,
        newCalculatedRevenue,
        inventoryId,
        productId,
        userId,
      ],
    );

    // 3. Apply only the compensating delta to current stock.
    const stockDelta = normalizedActualStock - oldActualStock;
    if (stockDelta !== 0) {
      const { previousStock, newStock } = await applyWarehouseStockDelta(
        client,
        Number(warehouseId),
        productId,
        stockDelta,
      );

      await client.query(
        `
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1 AND club_id = $2
            `,
        [productId, clubId],
      );

      await logStockMovement(
        client,
        clubId,
        userId,
        productId,
        stockDelta,
        previousStock,
        newStock,
        "INVENTORY_CORRECTION",
        `Пост-корректировка ревизии #${inventoryId}`,
        "INVENTORY",
        inventoryId,
        null,
        Number(warehouseId),
        price,
      );
    }

    await client.query(
      `
            INSERT INTO inventory_post_close_corrections (
                inventory_id,
                product_id,
                old_actual_stock,
                new_actual_stock,
                difference_before,
                difference_after,
                stock_delta,
                reason,
                created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
      [
        inventoryId,
        productId,
        oldActualStock,
        normalizedActualStock,
        item.difference !== null ? Number(item.difference) : null,
        newDifference,
        stockDelta,
        "Пост-корректировка закрытой ревизии",
        userId,
      ],
    );

    await client.query("COMMIT");
    revalidatePath(`/clubs/${clubId}/inventory`);
    return { success: true };
  } catch (e: any) {
    await client.query("ROLLBACK");
    console.error("Inventory correction error:", e);
    throw e;
  } finally {
    client.release();
  }
}

export async function createInventorySafe(
  clubId: string,
  userId: string,
  targetMetricKey: string | null,
  categoryId?: number | null,
  warehouseId?: number | null,
  shiftId: string | null = null,
) {
  try {
    const inventoryId = await createInventory(
      clubId,
      userId,
      targetMetricKey,
      categoryId,
      warehouseId,
      shiftId,
    );
    return {
      ok: true as const,
      inventoryId,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка запуска инвентаризации"),
    };
  }
}

export async function addProductToInventorySafe(
  inventoryId: number,
  productId: number,
) {
  try {
    await addProductToInventory(inventoryId, productId);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(
        error,
        "Ошибка добавления товара в инвентаризацию",
      ),
    };
  }
}

export async function bulkUpdateInventoryItemsSafe(
  items: { id: number; actual_stock: number | null }[],
  clubId: string,
) {
  try {
    await bulkUpdateInventoryItems(items, clubId);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка сохранения инвентаризации"),
    };
  }
}

export async function closeInventorySafe(
  inventoryId: number,
  clubId: string,
  reportedRevenue: number,
  unaccountedSales: {
    product_id: number;
    quantity: number;
    selling_price: number;
    cost_price: number;
  }[] = [],
  options?: { salesRecognition?: "INVENTORY" | "NONE" },
) {
  try {
    await closeInventory(
      inventoryId,
      clubId,
      reportedRevenue,
      unaccountedSales,
      options,
    );
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка завершения инвентаризации"),
    };
  }
}

export async function getInventories(clubId: string) {
  const userId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const scope = await getInventoryAccessScope(client, clubId, userId);
    if (!scope.canManageInventory && scope.allowedWarehouseIds.length === 0) {
      return [];
    }

    const params: any[] = [clubId];
    let warehouseFilter = "";
    if (!scope.canManageInventory) {
      params.push(scope.allowedWarehouseIds);
      warehouseFilter = " AND i.warehouse_id = ANY($2::int[])";
    }

    const res = await client.query(
      `
            SELECT i.*, u.full_name as created_by_name, w.name as warehouse_name
            FROM warehouse_inventories i
            LEFT JOIN users u ON i.created_by = u.id
            LEFT JOIN warehouses w ON i.warehouse_id = w.id
            WHERE i.club_id = $1${warehouseFilter}
            ORDER BY i.started_at DESC
            `,
      params,
    );
    return res.rows.map((row) => ({
      ...row,
      created_by: row.created_by?.toString(),
    })) as Inventory[];
  } finally {
    client.release();
  }
}

export async function getInventory(id: number) {
  const sessionUserId = await requireSessionUserId();
  const invClubRes = await query(
    "SELECT club_id FROM warehouse_inventories WHERE id = $1",
    [id],
  );
  if ((invClubRes.rowCount || 0) === 0)
    throw new Error("Инвентаризация не найдена");
  const clubId = String(invClubRes.rows[0].club_id);
  await assertSessionUserCanAccessClub(clubId, sessionUserId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const inventoryRes = await client.query(
      `SELECT i.*, u.full_name as created_by_name,
                    COALESCE(i.sales_capture_mode_snapshot, (c.inventory_settings->>'sales_capture_mode')) as sales_capture_mode
             FROM warehouse_inventories i
             LEFT JOIN users u ON i.created_by = u.id
             LEFT JOIN clubs c ON i.club_id = c.id
             WHERE i.id = $1 AND i.club_id = $2`,
      [id, clubId],
    );
    const inventory = inventoryRes.rows[0];
    if (!inventory) throw new Error("Инвентаризация не найдена");
    await assertUserCanUseWarehouses(client, clubId, sessionUserId, [
      inventory.warehouse_id,
    ]);
    return {
      ...inventory,
      created_by: inventory.created_by?.toString(),
    } as Inventory;
  } finally {
    client.release();
  }
}

export async function getInventoryItems(inventoryId: number) {
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const sessionUserId = await requireSessionUserId();
    const invHeader = await client.query(
      "SELECT club_id, warehouse_id, started_at, closed_at, status FROM warehouse_inventories WHERE id = $1",
      [inventoryId],
    );
    const inv = invHeader.rows[0];
    if (!inv) throw new Error("Инвентаризация не найдена");
    await assertSessionUserCanAccessClub(String(inv.club_id), sessionUserId);
    await assertUserCanUseWarehouses(
      client,
      String(inv.club_id),
      sessionUserId,
      [inv.warehouse_id],
    );

    // Optimized query with movements JOIN (fixes N+1 problem)
    const res = await client.query(
      `
            SELECT ii.*,
                   p.name as product_name,
                   p.barcode as barcode,
                   p.barcodes as barcodes,
                   c.name as category_name,
                   COALESCE(movements.total_movement, 0) as movement_during_inventory
            FROM warehouse_inventory_items ii
            JOIN warehouse_products p ON ii.product_id = p.id
            LEFT JOIN warehouse_categories c ON p.category_id = c.id
            LEFT JOIN (
                SELECT
                    product_id,
                    SUM(change_amount) as total_movement
                FROM warehouse_stock_movements
                WHERE warehouse_id = $2
                  AND created_at > $3
                  AND ($5::timestamp IS NULL OR created_at <= $5)
                  AND club_id = $4
                  AND COALESCE(related_entity_type, '') != 'INVENTORY'
                GROUP BY product_id
            ) movements ON movements.product_id = ii.product_id
            WHERE ii.inventory_id = $1
            ORDER BY c.name NULLS LAST, p.name
        `,
      [
        inventoryId,
        inv.warehouse_id,
        inv.started_at,
        inv.club_id,
        inv.status === "CLOSED" ? inv.closed_at : null,
      ],
    );

    const items = res.rows as (InventoryItem & {
      movement_during_inventory?: number | string;
    })[];

    // Apply movement adjustments to expected_stock for display
    for (const item of items) {
      const movement = Number(item.movement_during_inventory || 0);
      if (movement !== 0) {
        item.expected_stock = Number(item.expected_stock) + movement;
      }
      // Remove helper field
      delete (item as any).movement_during_inventory;
    }

    return items;
  } finally {
    client.release();
  }
}

export async function getClubInventorySettingsInternal(
  client: any,
  clubId: string,
): Promise<NormalizedInventorySettings> {
  const res = await client.query(
    `SELECT inventory_settings FROM clubs WHERE id = $1 LIMIT 1`,
    [clubId],
  );
  return normalizeInventorySettings(res.rows[0]?.inventory_settings);
}

export async function updateInventorySettings(
  clubId: string,
  userId: string,
  settings: any,
) {
  await assertUserCanAccessClub(clubId, userId);
  const normalizedSettings = normalizeInventorySettings(settings);
  await query(
    `
        UPDATE clubs
        SET inventory_settings = $1
        WHERE id = $2
    `,
    [normalizedSettings, clubId],
  );

  await logOperation(
    clubId,
    userId,
    "UPDATE_SETTINGS",
    "CLUB",
    Number(clubId),
    normalizedSettings,
  );
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function createInventory(
  clubId: string,
  userId: string,
  targetMetricKey: string | null,
  categoryId?: number | null,
  warehouseId?: number | null,
  shiftId: string | null = null,
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");
    const accessScope = await getInventoryAccessScope(client, clubId, userId);

    // 1. Resolve warehouse if not provided
    let targetWarehouseId = warehouseId;
    if (!targetWarehouseId) {
      const whRes = accessScope.canManageInventory
        ? await client.query(
            "SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1",
            [clubId],
          )
        : await client.query(
            `SELECT id
                     FROM warehouses
                     WHERE club_id = $1
                       AND is_active = true
                       AND id = ANY($2::int[])
                     ORDER BY is_default DESC, created_at ASC
                     LIMIT 1`,
            [clubId, accessScope.allowedWarehouseIds],
          );
      targetWarehouseId = whRes.rows[0]?.id;
    }
    await assertUserCanUseWarehouses(client, clubId, userId, [
      targetWarehouseId,
    ]);

    // 2. Check if an OPEN inventory already exists
    if (shiftId) {
      const existingInv = await client.query(
        `
                SELECT id, warehouse_id FROM warehouse_inventories
                WHERE club_id = $1 AND shift_id = $2 AND status = 'OPEN'
                ORDER BY CASE WHEN warehouse_id = $3 THEN 0 ELSE 1 END, started_at ASC
                LIMIT 1
            `,
        [clubId, shiftId, targetWarehouseId || null],
      );

      if (existingInv.rowCount && existingInv.rowCount > 0) {
        const existingWarehouseId = existingInv.rows[0].warehouse_id;
        if (
          targetWarehouseId &&
          existingWarehouseId &&
          Number(existingWarehouseId) !== Number(targetWarehouseId)
        ) {
          throw new Error(
            `Для этой смены уже открыта инвентаризация по складу #${existingWarehouseId}. Закройте её или используйте тот же склад.`,
          );
        }
        await client.query("ROLLBACK");
        return existingInv.rows[0].id;
      }
    } else {
      const existingOpen = await client.query(
        `
                SELECT id, warehouse_id
                FROM warehouse_inventories
                WHERE club_id = $1 AND status = 'OPEN'
                ORDER BY started_at ASC
                LIMIT 1
            `,
        [clubId],
      );
      if (existingOpen.rowCount && existingOpen.rowCount > 0) {
        const existingWarehouseId = existingOpen.rows[0].warehouse_id;
        throw new Error(
          existingWarehouseId
            ? `В клубе уже есть открытая инвентаризация по складу #${existingWarehouseId}. Сначала завершите её.`
            : "В клубе уже есть открытая инвентаризация. Сначала завершите её.",
        );
      }
    }

    // 3. Create Inventory Header
    const invRes = await client.query(
      `
            INSERT INTO warehouse_inventories (club_id, created_by, status, target_metric_key, warehouse_id, shift_id)
            VALUES ($1, $2, 'OPEN', $3, $4, $5)
            RETURNING id
        `,
      [clubId, userId, targetMetricKey, targetWarehouseId, shiftId],
    );
    const inventoryId = invRes.rows[0].id;

    // 4. Snapshot current stock
    let query = "";
    const params: any[] = [clubId];

    if (targetWarehouseId) {
      // Specific warehouse snapshot.
      // Include all active club products, even with zero stock, so new clubs
      // can search and count positions immediately after setup.
      query = `
                SELECT p.id,
                       COALESCE(ws.quantity, 0) as current_stock,
                       p.cost_price,
                       p.selling_price
                FROM warehouse_products p
                LEFT JOIN warehouse_stock ws ON p.id = ws.product_id AND ws.warehouse_id = $2
                WHERE p.club_id = $1 AND p.is_active = true
            `;
      params.push(targetWarehouseId);

      if (categoryId) {
        query += ` AND p.category_id = $3`;
        params.push(categoryId);
      }
    } else {
      // Aggregate snapshot across all warehouses.
      // Include all active club products, even when total stock is zero.
      query = `
                SELECT p.id,
                       COALESCE((SELECT SUM(quantity) FROM warehouse_stock WHERE product_id = p.id), 0) as current_stock,
                       p.cost_price,
                       p.selling_price
                FROM warehouse_products p
                WHERE p.club_id = $1 AND p.is_active = true
            `;

      if (categoryId) {
        query += ` AND p.category_id = $2`;
        params.push(categoryId);
      }
    }

    const productsRes = await client.query(query, params);

    for (const p of productsRes.rows) {
      await client.query(
        `
                INSERT INTO warehouse_inventory_items (inventory_id, product_id, expected_stock, cost_price_snapshot, selling_price_snapshot)
                VALUES ($1, $2, $3, $4, $5)
            `,
        [inventoryId, p.id, p.current_stock, p.cost_price, p.selling_price],
      );
    }

    await client.query("COMMIT");
    await logOperation(
      clubId,
      userId,
      "CREATE_INVENTORY",
      "INVENTORY",
      inventoryId,
      { categoryId, warehouseId },
    );
    return inventoryId;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function addProductToInventory(
  inventoryId: number,
  productId: number,
) {
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    // Get product details and current stock in that warehouse (even if 0)
    // We need to know which warehouse this inventory is for
    const sessionUserId = await requireSessionUserId();
    const inv = await client.query(
      `SELECT warehouse_id, club_id, status FROM warehouse_inventories WHERE id = $1`,
      [inventoryId],
    );
    let warehouseId = inv.rows[0]?.warehouse_id;
    const currentClubId = inv.rows[0]?.club_id;
    const inventoryStatus = inv.rows[0]?.status;

    if (!currentClubId) throw new Error("Инвентаризация не найдена");
    await assertSessionUserCanAccessClub(String(currentClubId), sessionUserId);
    if (inventoryStatus !== "OPEN")
      throw new Error(
        "Добавлять товары можно только в открытую инвентаризацию",
      );
    await assertUserCanUseWarehouses(
      client,
      String(currentClubId),
      sessionUserId,
      [warehouseId],
    );

    // Check if already exists
    const existing = await client.query(
      `SELECT 1 FROM warehouse_inventory_items WHERE inventory_id = $1 AND product_id = $2`,
      [inventoryId, productId],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error("Этот товар уже есть в списке");
    }

    if (!warehouseId) {
      // Fallback: Use default or any warehouse if not specified
      const whRes = await client.query(
        "SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1",
        [currentClubId],
      );
      warehouseId = whRes.rows[0]?.id;
    }

    if (!warehouseId)
      throw new Error("Инвентаризация не привязана к складу и склад не найден");

    const productRes = await client.query(
      `
            SELECT p.cost_price, p.selling_price, COALESCE(ws.quantity, 0) as current_stock
            FROM warehouse_products p
            LEFT JOIN warehouse_stock ws ON p.id = ws.product_id AND ws.warehouse_id = $2
            WHERE p.id = $1 AND p.club_id = $3
        `,
      [productId, warehouseId, currentClubId],
    );

    const product = productRes.rows[0];
    if (!product) throw new Error("Товар не найден");

    // Add item
    await client.query(
      `
            INSERT INTO warehouse_inventory_items (
                inventory_id,
                product_id,
                expected_stock,
                actual_stock,
                cost_price_snapshot,
                selling_price_snapshot,
                added_manually
            )
            VALUES ($1, $2, $3, NULL, $4, $5, TRUE)
        `,
      [
        inventoryId,
        productId,
        product.current_stock,
        product.cost_price,
        product.selling_price,
      ],
    );

    await client.query("COMMIT");
    revalidatePath(`/clubs/${inv.rows[0].club_id}/inventory`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function cancelInventory(
  inventoryId: number,
  clubId: string,
  userId: string,
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");
    const scope = await getInventoryAccessScope(client, clubId, userId);
    const invRes = await client.query(
      `
            SELECT id, status, warehouse_id, created_by
            FROM warehouse_inventories
            WHERE id = $1 AND club_id = $2
            FOR UPDATE
            `,
      [inventoryId, clubId],
    );
    const inventory = invRes.rows[0];
    if (!inventory) throw new Error("Инвентаризация не найдена");
    await assertUserCanUseWarehouses(client, clubId, userId, [
      inventory.warehouse_id,
    ]);
    if (inventory.status !== "OPEN") {
      throw new Error("Отменять можно только открытую инвентаризацию");
    }
    if (
      !scope.canManageInventory &&
      String(inventory.created_by) !== String(userId)
    ) {
      throw new Error("Отменять чужую инвентаризацию нельзя");
    }

    await client.query(
      `
            UPDATE warehouse_inventories
            SET status = 'CANCELED',
                canceled_at = NOW(),
                canceled_by = $3::uuid
            WHERE id = $1 AND club_id = $2
            `,
      [inventoryId, clubId, userId],
    );
    await logOperation(
      clubId,
      userId,
      "CANCEL_INVENTORY",
      "INVENTORY",
      inventoryId,
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

export async function deleteInventory(
  inventoryId: number,
  clubId: string,
  userId: string,
) {
  return cancelInventory(inventoryId, clubId, userId);
}

export async function getInventoryPostCloseCorrections(inventoryId: number) {
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const sessionUserId = await requireSessionUserId();
    const invRes = await client.query(
      `SELECT club_id, warehouse_id FROM warehouse_inventories WHERE id = $1`,
      [inventoryId],
    );
    const inventory = invRes.rows[0];
    if (!inventory) throw new Error("Инвентаризация не найдена");
    await assertSessionUserCanAccessClub(
      String(inventory.club_id),
      sessionUserId,
    );
    await assertUserCanUseWarehouses(
      client,
      String(inventory.club_id),
      sessionUserId,
      [inventory.warehouse_id],
    );

    const res = await client.query(
      `
            SELECT c.*,
                   p.name as product_name,
                   u.full_name as created_by_name
            FROM inventory_post_close_corrections c
            JOIN warehouse_products p ON p.id = c.product_id
            LEFT JOIN users u ON u.id = c.created_by
            WHERE c.inventory_id = $1
            ORDER BY c.created_at DESC, c.id DESC
            `,
      [inventoryId],
    );
    return res.rows as InventoryPostCloseCorrection[];
  } finally {
    client.release();
  }
}

export async function updateInventoryItem(
  itemId: number,
  actualStock: number | null,
  clubId: string,
) {
  const sessionUserId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  const normalizedActualStock = normalizeInventoryActualStock(actualStock);
  try {
    const itemRes = await client.query(
      `
            SELECT i.status, i.warehouse_id
            FROM warehouse_inventory_items ii
            JOIN warehouse_inventories i ON ii.inventory_id = i.id
            WHERE ii.id = $1 AND i.club_id = $2
            LIMIT 1
            `,
      [itemId, clubId],
    );
    const inventory = itemRes.rows[0];
    if (!inventory) throw new Error("Позиция инвентаризации не найдена");
    await assertUserCanUseWarehouses(client, clubId, sessionUserId, [
      inventory.warehouse_id,
    ]);
    if (inventory.status !== "OPEN") {
      throw new Error("Редактировать можно только открытую инвентаризацию");
    }

    await client.query(
      `
            UPDATE warehouse_inventory_items ii
            SET actual_stock = $1::int,
                counted_at = CASE WHEN $1::int IS NULL THEN NULL ELSE NOW() END,
                counted_by = CASE WHEN $1::int IS NULL THEN NULL ELSE $4::uuid END
            FROM warehouse_inventories i
            WHERE ii.id = $2 AND ii.inventory_id = i.id AND i.club_id = $3
        `,
      [normalizedActualStock, itemId, clubId, sessionUserId],
    );
  } finally {
    client.release();
  }

  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function bulkUpdateInventoryItems(
  items: { id: number; actual_stock: number | null }[],
  clubId: string,
) {
  const sessionUserId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");
    for (const item of items) {
      const normalizedActualStock = normalizeInventoryActualStock(
        item.actual_stock,
      );
      const itemRes = await client.query(
        `
                SELECT i.status, i.warehouse_id
                FROM warehouse_inventory_items ii
                JOIN warehouse_inventories i ON ii.inventory_id = i.id
                WHERE ii.id = $1 AND i.club_id = $2
                LIMIT 1
                `,
        [item.id, clubId],
      );
      const inventory = itemRes.rows[0];
      if (!inventory) throw new Error("Позиция инвентаризации не найдена");
      await assertUserCanUseWarehouses(client, clubId, sessionUserId, [
        inventory.warehouse_id,
      ]);
      if (inventory.status !== "OPEN") {
        throw new Error("Редактировать можно только открытую инвентаризацию");
      }
      await client.query(
        `
                UPDATE warehouse_inventory_items ii
                SET actual_stock = $1::int,
                    counted_at = CASE WHEN $1::int IS NULL THEN NULL ELSE NOW() END,
                    counted_by = CASE WHEN $1::int IS NULL THEN NULL ELSE $4::uuid END
                FROM warehouse_inventories i
                WHERE ii.id = $2 AND ii.inventory_id = i.id AND i.club_id = $3
            `,
        [normalizedActualStock, item.id, clubId, sessionUserId],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function getOpenShiftInventory(
  clubId: string,
  shiftId: string | number,
) {
  await requireClubAccess(clubId);
  const res = await query(
    `SELECT id, warehouse_id, started_at
         FROM warehouse_inventories
         WHERE club_id = $1
           AND shift_id = $2
           AND status = 'OPEN'
         ORDER BY started_at ASC
         LIMIT 1`,
    [clubId, String(shiftId)],
  );

  return res.rows[0] as {
    id: number;
    warehouse_id: number | null;
    started_at: string;
  } | null;
}

export async function closeInventory(
  inventoryId: number,
  clubId: string,
  reportedRevenue: number,
  unaccountedSales: {
    product_id: number;
    quantity: number;
    selling_price: number;
    cost_price: number;
  }[] = [],
  _options?: { salesRecognition?: "INVENTORY" | "NONE" },
) {
  const actorUserId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    // 0. Get inventory metadata
    const invHeader = await client.query(
      "SELECT warehouse_id, shift_id, created_by, started_at, status FROM warehouse_inventories WHERE id = $1 AND club_id = $2 FOR UPDATE",
      [inventoryId, clubId],
    );
    const inv = invHeader.rows[0];
    if (!inv) throw new Error("Инвентаризация не найдена");
    if (inv.status === "CLOSED") throw new Error("Инвентаризация уже закрыта");
    if (inv.status === "CANCELED")
      throw new Error("Отмененную инвентаризацию нельзя закрыть");

    let warehouseId = inv.warehouse_id;
    const shiftId = inv.shift_id;
    const inventoryStartTime = inv.started_at;

    if (!warehouseId) {
      const whRes = await client.query(
        "SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1",
        [clubId],
      );
      warehouseId = whRes.rows[0]?.id;
    }
    if (!warehouseId)
      throw new Error("Не найден склад для корректировки остатков");
    await assertUserCanUseWarehouses(client, clubId, actorUserId, [
      warehouseId,
    ]);

    // 1. Fetch items and account for movements that happened DURING the inventory
    const itemsRes = await client.query(
      `
            SELECT ii.*,
                   p.name as product_name,
                   COALESCE((
                       SELECT SUM(change_amount)
                       FROM warehouse_stock_movements
                       WHERE product_id = ii.product_id
                       AND warehouse_id = $2
                       AND club_id = $4
                       AND created_at > $3
                       AND NOT (COALESCE(related_entity_type, '') = 'INVENTORY' AND COALESCE(related_entity_id, -1) = $1) -- Exclude this inventory's own potential movements
                   ), 0) as movements_during_inventory
            FROM warehouse_inventory_items ii
            JOIN warehouse_products p ON ii.product_id = p.id
            WHERE ii.inventory_id = $1
        `,
      [inventoryId, warehouseId, inventoryStartTime, clubId],
    );

    // Legacy recognition of deficits as "sales via inventory" is removed.
    const salesRecognition = "NONE" as const;

    // 2. Reconcile counted rows against current stock and store audit deltas.
    const isRevision = !shiftId;
    const recognizeAsSales = false;
    const reasonPrefix = isRevision
      ? `Ревизия #${inventoryId}`
      : recognizeAsSales
        ? `Закрытие сменной инвентаризации #${inventoryId}`
        : `Корректировка по инвентаризации #${inventoryId}`;

    let standardCalculatedRevenue = 0;
    let hasNullStock = false;

    for (const item of itemsRes.rows) {
      if (item.actual_stock === null) {
        hasNullStock = true;
        await client.query(
          `
                    UPDATE warehouse_inventory_items
                    SET difference = NULL,
                        calculated_revenue = NULL,
                        adjusted_expected_stock = NULL,
                        stock_before_close = NULL,
                        applied_stock_delta = NULL
                    WHERE id = $1
                `,
          [item.id],
        );
        continue;
      }

      const safeAdjustedExpected = Math.max(
        0,
        Number(item.expected_stock) + Number(item.movements_during_inventory),
      );
      const diffAmount = item.actual_stock - safeAdjustedExpected;
      const itemRevenue =
        recognizeAsSales && item.actual_stock < safeAdjustedExpected
          ? (safeAdjustedExpected - item.actual_stock) *
            Number(item.selling_price_snapshot)
          : 0;
      standardCalculatedRevenue += itemRevenue;

      const currentWarehouseStock = await getLockedWarehouseStock(
        client,
        warehouseId,
        item.product_id,
      );
      const stockDelta = Number(item.actual_stock) - currentWarehouseStock;

      // Update item record with calculated results
      await client.query(
        `
                UPDATE warehouse_inventory_items
                SET difference = $2,
                    calculated_revenue = $3,
                    adjusted_expected_stock = $4,
                    stock_before_close = $5,
                    applied_stock_delta = $6,
                    counted_at = COALESCE(counted_at, NOW()),
                    counted_by = COALESCE(counted_by, $7::uuid)
                WHERE id = $1
            `,
        [
          item.id,
          diffAmount,
          itemRevenue,
          safeAdjustedExpected,
          currentWarehouseStock,
          stockDelta,
          actorUserId,
        ],
      );
      if (stockDelta !== 0) {
        const { previousStock, newStock } = await applyWarehouseStockDelta(
          client,
          warehouseId,
          item.product_id,
          stockDelta,
        );
        await logStockMovement(
          client,
          clubId,
          actorUserId,
          item.product_id,
          stockDelta,
          previousStock,
          newStock,
          stockDelta > 0 ? "INVENTORY_GAIN" : "INVENTORY_LOSS",
          stockDelta > 0
            ? `${reasonPrefix}: найден излишек`
            : `${reasonPrefix}: подтверждена недостача`,
          "INVENTORY",
          inventoryId,
          shiftId,
          warehouseId,
          Number(item.selling_price_snapshot || 0),
        );
      }
    }

    // FIX #5: Throw error if items have NULL actual_stock
    if (hasNullStock) {
      // Найдем товары которые не посчитаны
      const nullStockItems = itemsRes.rows
        .filter((r: any) => r.actual_stock === null)
        .map((r: any) => `${r.product_name} (ID: ${r.product_id})`);
      throw new Error(
        `Не все товары посчитаны. Заполните фактический остаток для:\n\n` +
          `${nullStockItems.slice(0, 10).join("\n")}` +
          `${nullStockItems.length > 10 ? `\n... и еще ${nullStockItems.length - 10} товаров` : ""}`,
      );
    }

    const effectiveUnaccountedSalesRaw = recognizeAsSales
      ? unaccountedSales
      : [];
    const invProductIds = new Set<number>(
      itemsRes.rows.map((r: any) => Number(r.product_id)),
    );
    const unaccountedSalesMap = new Map<
      number,
      {
        product_id: number;
        quantity: number;
        selling_price: number;
        cost_price: number;
      }
    >();

    for (const s of effectiveUnaccountedSalesRaw) {
      if (
        !Number.isFinite(s.quantity) ||
        !Number.isInteger(s.quantity) ||
        s.quantity <= 0
      ) {
        throw new Error(
          "Неучтенные продажи: количество должно быть целым положительным числом",
        );
      }
      if (!Number.isFinite(s.selling_price) || s.selling_price < 0) {
        throw new Error(
          "Неучтенные продажи: цена продажи должна быть неотрицательным числом",
        );
      }
      if (!Number.isFinite(s.cost_price) || s.cost_price < 0) {
        throw new Error(
          "Неучтенные продажи: себестоимость должна быть неотрицательным числом",
        );
      }
      if (invProductIds.has(Number(s.product_id))) {
        throw new Error(
          "Неучтенные продажи содержат товар, который уже есть в инвентаризации. Укажите остаток по нему в основном списке.",
        );
      }
      const productId = Number(s.product_id);
      const existing = unaccountedSalesMap.get(productId);
      if (existing) {
        if (
          existing.selling_price !== s.selling_price ||
          existing.cost_price !== s.cost_price
        ) {
          throw new Error(
            "Неучтенные продажи содержат один и тот же товар с разной ценой",
          );
        }
        existing.quantity += Number(s.quantity);
        continue;
      }
      unaccountedSalesMap.set(productId, {
        product_id: productId,
        quantity: Number(s.quantity),
        selling_price: Number(s.selling_price),
        cost_price: Number(s.cost_price),
      });
    }
    const effectiveUnaccountedSales = Array.from(unaccountedSalesMap.values());

    if (effectiveUnaccountedSales.length > 0) {
      await assertProductsBelongToClub(
        client,
        clubId,
        effectiveUnaccountedSales.map((s) => s.product_id),
      );
    }

    const unaccountedRevenue = effectiveUnaccountedSales.reduce(
      (acc, s) => acc + s.quantity * s.selling_price,
      0,
    );

    let shiftCalculatedRevenue: number | null = null;
    if (!isRevision && salesRecognition === "NONE") {
      const revRes = await client.query(
        `
                SELECT COALESCE(SUM(
                    CASE
                        WHEN sm.related_entity_type = 'SHIFT_RECEIPT_VOID' THEN -ABS(sm.change_amount) * COALESCE(sm.price_at_time, p.selling_price)
                        WHEN sm.type = 'RETURN' THEN -ABS(sm.change_amount) * COALESCE(sm.price_at_time, p.selling_price)
                        ELSE ABS(sm.change_amount) * COALESCE(sm.price_at_time, p.selling_price)
                    END
                ), 0)::numeric as revenue
                FROM warehouse_stock_movements sm
                JOIN warehouse_products p ON sm.product_id = p.id
                WHERE sm.club_id = $1
                  AND sm.shift_id = $2
                  AND sm.type IN ('SALE', 'RETURN')
                  AND (sm.reason IS NULL OR LOWER(sm.reason) NOT LIKE '%в счет зп%')
                `,
        [clubId, shiftId],
      );
      shiftCalculatedRevenue = Number(revRes.rows[0]?.revenue || 0);
    }

    const totalCalculatedRevenue = recognizeAsSales
      ? standardCalculatedRevenue + unaccountedRevenue
      : (shiftCalculatedRevenue ?? 0) + unaccountedRevenue;

    const effectiveReportedRevenue = recognizeAsSales
      ? reportedRevenue
      : !isRevision
        ? reportedRevenue
        : 0;
    const diff = effectiveReportedRevenue - totalCalculatedRevenue;

    for (const sale of effectiveUnaccountedSales) {
      const currentWarehouseStock = await getLockedWarehouseStock(
        client,
        warehouseId,
        sale.product_id,
      );
      if (currentWarehouseStock < sale.quantity) {
        throw new Error(
          `Неучтенная продажа "${sale.product_id}" превышает текущий остаток на складе`,
        );
      }
      const { previousStock, newStock } = await applyWarehouseStockDelta(
        client,
        warehouseId,
        sale.product_id,
        -sale.quantity,
      );
      await logStockMovement(
        client,
        clubId,
        actorUserId,
        sale.product_id,
        -sale.quantity,
        previousStock,
        newStock,
        "SALE",
        `Неучтенная продажа при закрытии инвентаризации #${inventoryId}`,
        "INVENTORY",
        inventoryId,
        shiftId,
        warehouseId,
        sale.selling_price,
      );
    }

    // 4. Update Cache for all involved products
    const allProductIds = [
      ...itemsRes.rows.map((i) => i.product_id),
      ...effectiveUnaccountedSales.map((s) => s.product_id),
    ];

    if (allProductIds.length > 0) {
      await client.query(
        `
                UPDATE warehouse_products p
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
                WHERE id = ANY($1) AND club_id = $2
                `,
        [allProductIds, clubId],
      );
    }

    // 5. Close Inventory Header
    await client.query(
      `
            UPDATE warehouse_inventories
            SET status = 'CLOSED', closed_at = NOW(),
                closed_by = $5::uuid,
                sales_capture_mode_snapshot = $6,
                reported_revenue = $2,
                calculated_revenue = $3,
                revenue_difference = $4
            WHERE id = $1
        `,
      [
        inventoryId,
        effectiveReportedRevenue,
        totalCalculatedRevenue,
        diff,
        actorUserId,
        !isRevision ? "SHIFT" : null,
      ],
    );

    await client.query("COMMIT");
    await checkReplenishmentNeeds(clubId);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/clubs/${clubId}/inventory`, "layout");
}