"use server";

import { query, getClient } from "@/db";
import { revalidatePath } from "next/cache";
import { normalizeInventorySettings } from "@/lib/inventory-settings";
import { assertUserCanAccessClub } from "./auth";
import { applyWarehouseStockDelta, logStockMovement } from "./stock";
import { checkReplenishmentNeeds } from "./replenishment";

export interface ExpiringBatchItem {
  batch_id: number;
  product_id: number;
  product_name: string;
  product_barcode: string | null;
  cost_price: number;
  selling_price: number;
  warehouse_id: number;
  warehouse_name: string;
  is_cashbox_warehouse: boolean;
  quantity: number;
  current_warehouse_stock: number;
  expiration_date: string;
  days_until_expiration: number;
  status: "EXPIRED" | "EXPIRING_SOON" | "FRESH";
}

export interface ExpirationSummary {
  expired_count: number;
  expired_items_qty: number;
  expired_total_cost: number;
  expiring_soon_count: number;
  expiring_soon_items_qty: number;
  items: ExpiringBatchItem[];
}

/**
 * Получение списка товаров/партий с истекающим или истекшим сроком годности
 */
export async function getExpiringProducts(
  clubId: string,
  daysThreshold: number = 3
): Promise<ExpirationSummary> {
  const client = await getClient();
  try {
    const clubSettingsRes = await client.query(
      `SELECT inventory_settings FROM clubs WHERE id = $1`,
      [clubId]
    );
    const invSettings = normalizeInventorySettings(clubSettingsRes.rows[0]?.inventory_settings);
    const cashboxWarehouseIds: number[] = Array.isArray(invSettings.cashbox_warehouse_ids)
      ? invSettings.cashbox_warehouse_ids
      : (invSettings.cashbox_warehouse_id ? [invSettings.cashbox_warehouse_id] : []);

    const res = await client.query(
      `
      SELECT 
        b.id as batch_id,
        b.product_id,
        p.name as product_name,
        p.barcode as product_barcode,
        COALESCE(p.cost_price, 0) as cost_price,
        COALESCE(p.selling_price, 0) as selling_price,
        b.warehouse_id,
        w.name as warehouse_name,
        b.quantity,
        COALESCE(ws.quantity, 0) as current_warehouse_stock,
        b.expiration_date::text as expiration_date,
        (b.expiration_date - CURRENT_DATE) as days_until_expiration
      FROM warehouse_product_batches b
      JOIN warehouse_products p ON b.product_id = p.id
      JOIN warehouses w ON b.warehouse_id = w.id
      LEFT JOIN warehouse_stock ws ON ws.product_id = b.product_id AND ws.warehouse_id = b.warehouse_id
      WHERE b.club_id = $1
        AND b.quantity > 0
        AND p.is_active = true
      ORDER BY b.expiration_date ASC, p.name ASC
      `,
      [clubId]
    );

    let expiredCount = 0;
    let expiredItemsQty = 0;
    let expiredTotalCost = 0;
    let expiringSoonCount = 0;
    let expiringSoonItemsQty = 0;

    const items: ExpiringBatchItem[] = res.rows.map((row: any) => {
      const days = Number(row.days_until_expiration);
      const qty = Number(row.quantity);
      const cost = Number(row.cost_price);
      const isCashbox = cashboxWarehouseIds.length === 0 || cashboxWarehouseIds.includes(Number(row.warehouse_id));

      let status: "EXPIRED" | "EXPIRING_SOON" | "FRESH" = "FRESH";
      if (days <= 0) {
        status = "EXPIRED";
        expiredCount += 1;
        expiredItemsQty += qty;
        expiredTotalCost += cost * qty;
      } else if (days <= daysThreshold) {
        status = "EXPIRING_SOON";
        expiringSoonCount += 1;
        expiringSoonItemsQty += qty;
      }

      return {
        batch_id: row.batch_id,
        product_id: row.product_id,
        product_name: row.product_name,
        product_barcode: row.product_barcode,
        cost_price: cost,
        selling_price: Number(row.selling_price),
        warehouse_id: row.warehouse_id,
        warehouse_name: row.warehouse_name,
        is_cashbox_warehouse: isCashbox,
        quantity: qty,
        current_warehouse_stock: Number(row.current_warehouse_stock || 0),
        expiration_date: row.expiration_date,
        days_until_expiration: days,
        status,
      };
    });

    return {
      expired_count: expiredCount,
      expired_items_qty: expiredItemsQty,
      expired_total_cost: Math.round(expiredTotalCost * 100) / 100,
      expiring_soon_count: expiringSoonCount,
      expiring_soon_items_qty: expiringSoonItemsQty,
      items,
    };
  } finally {
    client.release();
  }
}

/**
 * Списание партий методом FIFO при продажах / общих списаниях
 */
export async function deductProductBatches(
  client: any,
  clubId: string | number,
  productId: number,
  warehouseId: number | null,
  quantityToDeduct: number
) {
  if (quantityToDeduct <= 0) return;

  const whFilter = warehouseId ? `AND warehouse_id = $3` : ``;
  const params: any[] = warehouseId ? [clubId, productId, warehouseId] : [clubId, productId];

  const batchesRes = await client.query(
    `SELECT id, quantity FROM warehouse_product_batches
     WHERE club_id = $1 AND product_id = $2 AND quantity > 0 ${whFilter}
     ORDER BY expiration_date ASC, id ASC`,
    params
  );

  let remaining = quantityToDeduct;
  for (const batch of batchesRes.rows) {
    if (remaining <= 0) break;
    const batchQty = Number(batch.quantity);
    const take = Math.min(batchQty, remaining);

    await client.query(
      `UPDATE warehouse_product_batches SET quantity = quantity - $1 WHERE id = $2`,
      [take, batch.id]
    );
    remaining -= take;
  }
}

/**
 * Списание просроченных товаров в 1 клик
 */
export async function writeOffExpiredBatches(
  clubId: string,
  userId: string,
  batchIds: number[],
  notes?: string,
  shiftId?: string
) {
  await assertUserCanAccessClub(clubId, userId);
  if (!batchIds || batchIds.length === 0) {
    throw new Error("Не выбрано ни одной позиции для списания");
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const batchesRes = await client.query(
      `SELECT b.id, b.product_id, b.warehouse_id, b.quantity, p.name, p.barcode, COALESCE(p.cost_price, 0) as cost_price
       FROM warehouse_product_batches b
       JOIN warehouse_products p ON b.product_id = p.id
       WHERE b.id = ANY($1) AND b.club_id = $2 AND b.quantity > 0`,
      [batchIds, clubId]
    );

    if (batchesRes.rows.length === 0) {
      throw new Error("Указанные партии не найдены или уже списаны");
    }

    const clubSettingsRes = await client.query(
      `SELECT inventory_settings FROM clubs WHERE id = $1`,
      [clubId]
    );
    const invSettings = normalizeInventorySettings(clubSettingsRes.rows[0]?.inventory_settings);
    const cashboxWarehouseIds: number[] = Array.isArray(invSettings.cashbox_warehouse_ids)
      ? invSettings.cashbox_warehouse_ids
      : [];

    const ssDisposalItems: { id: number; quantity: number }[] = [];

    for (const item of batchesRes.rows) {
      const whId = Number(item.warehouse_id);
      const qty = Number(item.quantity);

      // Уменьшаем количество в партии
      await client.query(
        `UPDATE warehouse_product_batches SET quantity = 0 WHERE id = $1`,
        [item.id]
      );

      // Уменьшаем остаток на складе
      const { previousStock, newStock } = await applyWarehouseStockDelta(
        client,
        whId,
        item.product_id,
        -qty
      );

      // Обновляем текущий остаток товара
      await client.query(
        `UPDATE warehouse_products
         SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
         WHERE id = $1`,
        [item.product_id]
      );

      await logStockMovement(
        client,
        clubId,
        userId,
        item.product_id,
        -qty,
        previousStock,
        newStock,
        "WRITE_OFF",
        notes || "Списание по истечению срока годности",
        "WRITE_OFF",
        null,
        shiftId || null,
        whId,
        item.cost_price
      );

      // Проверяем SmartShell
      const isCashbox = cashboxWarehouseIds.length === 0 || cashboxWarehouseIds.includes(whId);
      if (isCashbox && invSettings.smartshell_integration_enabled) {
        try {
          const { getSmartShellClientForClub } = await import("@/lib/smartshell/shift-sync");
          const ssClient = await getSmartShellClientForClub(clubId);
          if (ssClient) {
            const goodId = await ssClient.resolveGoodId({ name: item.name, barcode: item.barcode });
            if (goodId) {
              ssDisposalItems.push({ id: goodId, quantity: qty });
            }
          }
        } catch (ssErr) {
          console.warn("SmartShell resolveGoodId error in writeOffExpiredBatches:", ssErr);
        }
      }
    }

    // Синхронизация списания со SmartShell
    if (ssDisposalItems.length > 0 && invSettings.smartshell_integration_enabled) {
      try {
        const { getSmartShellClientForClub } = await import("@/lib/smartshell/shift-sync");
        const ssClient = await getSmartShellClientForClub(clubId);
        if (ssClient) {
          await ssClient.changeGoodsQuantity({
            items: ssDisposalItems,
            operation: "DISPOSAL",
            comment: `Списание просрочки в DashAdmin: -${ssDisposalItems.reduce((s, i) => s + i.quantity, 0)} шт`,
          });
        }
      } catch (ssErr) {
        console.error("SmartShell writeOffExpiredBatches DISPOSAL error:", ssErr);
      }
    }

    await client.query("COMMIT");

    await checkReplenishmentNeeds(clubId);

    revalidatePath(`/clubs/${clubId}/inventory`);
    revalidatePath(`/employee/clubs/${clubId}`);

    return { success: true, count: batchesRes.rows.length };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
