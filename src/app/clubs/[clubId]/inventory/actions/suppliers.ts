"use server";

import { logOperation } from "@/lib/logger";
import { query, getClient } from "@/db";
import { revalidatePath } from "next/cache";
import type { Supplier, Supply, SupplyItem } from "./types";
import { applyWarehouseStockDelta, assertWarehouseBelongsToClub, logStockMovement, syncProductsCurrentStock } from "./stock";
import { assertProductsBelongToClub } from "./products";
import { assertUserCanAccessClub, assertUserCanUseWarehouses, requireClubAccess } from "./auth";
import { checkReplenishmentNeeds } from "./replenishment";
import { getActionErrorMessage } from "./receipts";
import { getClubInventorySettingsInternal } from "./inventories";

export async function createSupplySafe(
  clubId: string,
  userId: string,
  data: {
    supplier_name: string;
    notes: string;
    items: { product_id: number; quantity: number; cost_price: number }[];
    warehouse_id?: number;
    status?: "DRAFT" | "COMPLETED";
    shift_id?: string;
  },
) {
  try {
    await createSupply(clubId, userId, data);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(error, "Ошибка при оформлении поставки"),
    };
  }
}

export async function getSuppliers(clubId: string) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT * FROM warehouse_suppliers
        WHERE club_id = $1 AND is_active = true
        ORDER BY name
    `,
    [clubId],
  );
  return res.rows as Supplier[];
}

export async function createSupplier(
  clubId: string,
  name: string,
  contactInfo?: string,
) {
  await requireClubAccess(clubId);
  // Check if exists (case insensitive)
  const existing = await query(
    `
        SELECT id FROM warehouse_suppliers
        WHERE club_id = $1 AND LOWER(name) = LOWER($2)
    `,
    [clubId, name],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    return existing.rows[0].id; // Return existing ID if found
  }

  const res = await query(
    `
        INSERT INTO warehouse_suppliers (club_id, name, contact_info)
        VALUES ($1, $2, $3)
        RETURNING id
    `,
    [clubId, name, contactInfo],
  );

  revalidatePath(`/clubs/${clubId}/inventory`);
  return res.rows[0].id;
}

// --- SUPPLIES ---

export async function getSuppliersForSelect(clubId: string) {
  await requireClubAccess(clubId);
  const res = await query(
    `SELECT id, name FROM warehouse_suppliers WHERE club_id = $1 AND is_active = true ORDER BY name`,
    [clubId],
  );
  return res.rows;
}

export async function getSupplies(clubId: string) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT s.*, u.full_name as created_by_name,
        (SELECT COUNT(*) FROM warehouse_supply_items WHERE supply_id = s.id) as items_count
        FROM warehouse_supplies s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.club_id = $1
        ORDER BY s.created_at DESC
    `,
    [clubId],
  );
  return res.rows as Supply[];
}

export async function createSupply(
  clubId: string,
  userId: string,
  data: {
    supplier_name: string;
    notes: string;
    items: { product_id: number; quantity: number; cost_price: number }[];
    warehouse_id?: number;
    status?: "DRAFT" | "COMPLETED";
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
    if (!inventorySettings.supplies_enabled) {
      throw new Error("Поставки отключены для этого клуба");
    }

    if (!data.items || data.items.length === 0)
      throw new Error("Поставка должна содержать хотя бы один товар");
    for (const i of data.items) {
      if (
        !Number.isFinite(i.quantity) ||
        !Number.isInteger(i.quantity) ||
        i.quantity <= 0
      ) {
        throw new Error(
          "Количество в поставке должно быть целым положительным числом",
        );
      }
      if (!Number.isFinite(i.cost_price) || i.cost_price < 0) {
        throw new Error(
          "Себестоимость в поставке должна быть неотрицательным числом",
        );
      }
    }
    await assertProductsBelongToClub(
      client,
      clubId,
      data.items.map((i) => i.product_id),
    );

    // 1. Get or Create Supplier
    let supplierId: number | null = null;
    if (data.supplier_name) {
      // Check if exists
      const existing = await client.query(
        `SELECT id FROM warehouse_suppliers WHERE club_id = $1 AND LOWER(name) = LOWER($2)`,
        [clubId, data.supplier_name],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        supplierId = existing.rows[0].id;
      } else {
        // Create new
        const newSup = await client.query(
          `INSERT INTO warehouse_suppliers (club_id, name) VALUES ($1, $2) RETURNING id`,
          [clubId, data.supplier_name],
        );
        supplierId = newSup.rows[0].id;
      }
    }

    // 2. Create Supply
    const status = data.status || "COMPLETED";
    const totalCost = data.items.reduce(
      (acc, item) => acc + item.quantity * item.cost_price,
      0,
    );

    const usesStock = inventorySettings.stock_enabled;
    let warehouseId = data.warehouse_id;
    if (usesStock) {
      if (!warehouseId) {
        const whRes = await client.query(
          "SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1",
          [clubId],
        );
        warehouseId = whRes.rows[0]?.id;
      }
      if (!warehouseId) throw new Error("В клубе не создано ни одного склада");
      await assertWarehouseBelongsToClub(client, clubId, warehouseId);
      await assertUserCanUseWarehouses(client, clubId, userId, [warehouseId]);
    } else if (warehouseId) {
      await assertWarehouseBelongsToClub(client, clubId, warehouseId);
    }

    const supplyRes = await client.query(
      `
            INSERT INTO warehouse_supplies (club_id, supplier_name, supplier_id, notes, total_cost, created_by, status, warehouse_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `,
      [
        clubId,
        data.supplier_name,
        supplierId,
        data.notes,
        totalCost,
        userId,
        status,
        warehouseId,
      ],
    );
    const supplyId = supplyRes.rows[0].id;

    // 3. Add Items & Update Stock if COMPLETED
    for (const item of data.items) {
      await client.query(
        `
                INSERT INTO warehouse_supply_items (supply_id, product_id, quantity, cost_price, total_cost)
                VALUES ($1, $2, $3, $4, $5)
            `,
        [
          supplyId,
          item.product_id,
          item.quantity,
          item.cost_price,
          item.quantity * item.cost_price,
        ],
      );

      if (status === "COMPLETED" && usesStock && warehouseId) {
        const { previousStock, newStock } = await applyWarehouseStockDelta(
          client,
          warehouseId,
          item.product_id,
          item.quantity,
        );

        await client.query(
          `
                    UPDATE warehouse_products
                    SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1),
                        cost_price = $2
                    WHERE id = $1 AND club_id = $3
                `,
          [item.product_id, item.cost_price, clubId],
        );

        await logStockMovement(
          client,
          clubId,
          userId,
          item.product_id,
          item.quantity,
          previousStock,
          newStock,
          "SUPPLY",
          `Supply #${supplyId}`,
          "SUPPLY",
          supplyId,
          data.shift_id || null,
          warehouseId,
        );
      } else if (status === "COMPLETED") {
        await client.query(
          `
                    UPDATE warehouse_products
                    SET cost_price = $2
                    WHERE id = $1 AND club_id = $3
                `,
          [item.product_id, item.cost_price, clubId],
        );
      }
    }

    await client.query("COMMIT");
    await logOperation(clubId, userId, "CREATE_SUPPLY", "SUPPLY", supplyId, {
      itemsCount: data.items.length,
      totalCost,
      warehouseId,
      status,
    });

    // Update tasks
    if (status === "COMPLETED" && usesStock) {
      await checkReplenishmentNeeds(clubId);
    }
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function getSupplyById(clubId: string, supplyId: number) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT s.*,
            (SELECT COUNT(*) FROM warehouse_supply_items WHERE supply_id = s.id) as items_count,
            (SELECT full_name FROM users WHERE id = s.created_by) as created_by_name
        FROM warehouse_supplies s
        WHERE s.club_id = $1 AND s.id = $2
    `,
    [clubId, supplyId],
  );
  return res.rows[0] as Supply | undefined;
}

export async function getSupplyItems(clubId: string, supplyId: number) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT si.*, p.name as product_name
        FROM warehouse_supply_items si
        JOIN warehouse_supplies s ON si.supply_id = s.id
        JOIN warehouse_products p ON si.product_id = p.id
        WHERE s.club_id = $1 AND si.supply_id = $2
        ORDER BY p.name
    `,
    [clubId, supplyId],
  );
  return res.rows as SupplyItem[];
}

export async function deleteSupply(
  supplyId: number,
  clubId: string,
  userId?: string,
) {
  const sessionUserId = await requireClubAccess(clubId);
  if (userId && userId !== sessionUserId) {
    throw new Error("Недостаточно прав для выполнения операции");
  }
  const effectiveUserId = userId || sessionUserId;
  const client = await import("@/db").then((m) => m.getClient());
  let usesStock = false;
  try {
    await client.query("BEGIN");

    const inventorySettings = await getClubInventorySettingsInternal(
      client,
      clubId,
    );
    usesStock = inventorySettings.stock_enabled;

    const supplyRes = await client.query(
      "SELECT * FROM warehouse_supplies WHERE id = $1 AND club_id = $2",
      [supplyId, clubId],
    );
    if (supplyRes.rows.length === 0) throw new Error("Поставка не найдена");
    const supply = supplyRes.rows[0];

    if (supply.status === "COMPLETED") {
      const itemsRes = await client.query(
        "SELECT * FROM warehouse_supply_items WHERE supply_id = $1",
        [supplyId],
      );
      const warehouseId = supply.warehouse_id;

      const touchedProductIds = new Set<number>();

      if (usesStock) {
        if (!warehouseId) throw new Error("У поставки не указан склад");
        await assertUserCanUseWarehouses(client, clubId, sessionUserId, [
          Number(warehouseId),
        ]);

        for (const item of itemsRes.rows) {
          await applyWarehouseStockDelta(
            client,
            Number(warehouseId),
            Number(item.product_id),
            -Number(item.quantity),
          );
          touchedProductIds.add(Number(item.product_id));
        }

        await syncProductsCurrentStock(client, clubId, touchedProductIds);
      }

      await client.query(
        `
                DELETE FROM warehouse_stock_movements
                WHERE club_id = $1
                  AND related_entity_type = 'SUPPLY'
                  AND related_entity_id = $2
                `,
        [clubId, supplyId],
      );
    }

    await client.query(
      "DELETE FROM warehouse_supplies WHERE id = $1 AND club_id = $2",
      [supplyId, clubId],
    );
    await logOperation(
      clubId,
      effectiveUserId,
      "DELETE_SUPPLY",
      "SUPPLY",
      supplyId,
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/clubs/${clubId}/inventory`);

  if (usesStock) {
    await checkReplenishmentNeeds(clubId);
  }
}