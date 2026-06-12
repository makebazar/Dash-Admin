import { logOperation } from "@/lib/logger";
import { query, getClient } from "@/db";
import { revalidatePath } from "next/cache";
import type { Product, Warehouse } from "./types";
import { assertUserCanAccessClub, getInventoryAccessScope, requireClubAccess } from "./auth";
import { getActionErrorMessage } from "./receipts";
import { logStockMovement } from "./stock";

export async function assertProductBelongsToClub(
  db: { query: (sql: string, params?: any[]) => Promise<any> },
  clubId: string,
  productId: number,
) {
  const res = await db.query(
    "SELECT 1 FROM warehouse_products WHERE id = $1 AND club_id = $2 LIMIT 1",
    [productId, clubId],
  );
  if ((res.rowCount || 0) === 0)
    throw new Error("Товар не найден или не принадлежит клубу");
}

export async function assertProductsBelongToClub(
  db: { query: (sql: string, params?: any[]) => Promise<any> },
  clubId: string,
  productIds: number[],
) {
  const unique = Array.from(
    new Set(productIds.filter((id) => Number.isFinite(id))),
  ) as number[];
  if (unique.length === 0) return;
  const res = await db.query(
    "SELECT COUNT(*)::int as cnt FROM warehouse_products WHERE club_id = $1 AND id = ANY($2::int[])",
    [clubId, unique],
  );
  const cnt = Number(res.rows?.[0]?.cnt || 0);
  if (cnt !== unique.length)
    throw new Error(
      "Список товаров содержит позиции, которые не принадлежат клубу",
    );
}

export async function getProductsSafe(
  clubId: string,
  opts?: { includeArchived?: boolean; onlyArchived?: boolean },
) {
  try {
    const data = await getProducts(clubId, opts);
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(
        error,
        "Не удалось загрузить каталог товаров",
      ),
    };
  }
}

export async function getProducts(
  clubId: string,
  opts?: { includeArchived?: boolean; onlyArchived?: boolean },
) {
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const userId = await requireClubAccess(clubId);
    const scope = await getInventoryAccessScope(client, clubId, userId);
    const stockFilter =
      !scope.canManageInventory && scope.allowedWarehouseIds.length > 0
        ? " AND ws.warehouse_id = ANY($2::int[])"
        : "";
    const stockParams: any[] = [clubId];
    const archiveCondition = opts?.onlyArchived
      ? " AND p.deleted_at IS NOT NULL"
      : opts?.includeArchived
        ? ""
        : " AND p.deleted_at IS NULL";
    if (!scope.canManageInventory && scope.allowedWarehouseIds.length === 0) {
      return [];
    }
    if (!scope.canManageInventory) {
      stockParams.push(scope.allowedWarehouseIds);
    }

    const res = await client.query(
      `
            SELECT p.*, c.name as category_name,
            (SELECT SUM(quantity) FROM warehouse_stock ws WHERE product_id = p.id${stockFilter}) as total_stock,
            (
                SELECT json_agg(json_build_object(
                    'warehouse_id', ws.warehouse_id,
                    'warehouse_name', w.name,
                    'quantity', ws.quantity,
                    'is_default', w.is_default
                ))
                FROM warehouse_stock ws
                JOIN warehouses w ON ws.warehouse_id = w.id
                WHERE ws.product_id = p.id${stockFilter}
            ) as stocks,
            (
                SELECT json_agg(json_build_object(
                    'cost_price', s.cost_price,
                    'created_at', s.created_at,
                    'supplier_name', s.supplier_name,
                    'supply_id', s.id
                ))
                FROM (
                    SELECT si.cost_price, sup.created_at, sup.supplier_name, sup.id
                    FROM warehouse_supply_items si
                    JOIN warehouse_supplies sup ON si.supply_id = sup.id
                    WHERE si.product_id = p.id AND sup.status = 'COMPLETED'
                    ORDER BY sup.created_at DESC
                    LIMIT 5
                ) s
            ) as price_history
            FROM warehouse_products p
            LEFT JOIN warehouse_categories c ON p.category_id = c.id
            WHERE p.club_id = $1${archiveCondition}
            ORDER BY CASE WHEN p.abc_category IS NULL THEN 4 WHEN p.abc_category = 'A' THEN 1 WHEN p.abc_category = 'B' THEN 2 ELSE 3 END, p.name
        `,
      stockParams,
    );

    return res.rows.map((row) => ({
      ...row,
      current_stock: Number(row.total_stock) || 0,
      units_per_box: row.units_per_box || 1, // Ensure this is mapped
      stocks: row.stocks || [],
      price_history: row.price_history || [],
    })) as Product[];
  } finally {
    client.release();
  }
}

export async function createProduct(
  clubId: string,
  userId: string,
  data: {
    name: string;
    barcode?: string | null;
    barcodes?: string[];
    category_id: number | null;
    cost_price: number;
    selling_price: number;
    current_stock: number;
    min_stock_level?: number;
    units_per_box?: number;
  },
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    if (
      !Number.isFinite(data.current_stock) ||
      !Number.isInteger(data.current_stock) ||
      data.current_stock < 0
    ) {
      throw new Error(
        "Начальный остаток должен быть целым неотрицательным числом",
      );
    }

    // 1. Create Product
    const res = await client.query(
      `
            INSERT INTO warehouse_products (club_id, category_id, name, barcode, barcodes, cost_price, selling_price, current_stock, min_stock_level, units_per_box)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `,
      [
        clubId,
        data.category_id,
        data.name,
        data.barcode || null,
        data.barcodes || [],
        data.cost_price,
        data.selling_price,
        data.current_stock,
        data.min_stock_level || 0,
        data.units_per_box || 1,
      ],
    );

    const productId = res.rows[0].id;

    // 2. Add Stock to Warehouse (default or fallback)
    if (data.current_stock > 0) {
      const whRes = await client.query(
        "SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1",
        [clubId],
      );
      const warehouseId = whRes.rows[0]?.id;

      if (!warehouseId) {
        throw new Error(
          "Нельзя установить начальный остаток: в клубе не создано ни одного склада",
        );
      }

      await client.query(
        `
                INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity
                `,
        [warehouseId, productId, data.current_stock],
      );

      await logStockMovement(
        client,
        clubId,
        userId,
        productId,
        data.current_stock,
        0,
        data.current_stock,
        "SUPPLY",
        "Initial Stock",
        "WAREHOUSE",
        warehouseId,
        null,
        warehouseId,
      );
    }

    await client.query("COMMIT");
    await logOperation(
      clubId,
      userId,
      "CREATE_PRODUCT",
      "PRODUCT",
      productId,
      data,
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function updateProduct(
  id: number,
  clubId: string,
  userId: string,
  data: {
    name: string;
    barcode?: string | null;
    barcodes?: string[];
    category_id: number | null;
    cost_price: number;
    selling_price: number;
    min_stock_level?: number;
    is_active: boolean;
    units_per_box?: number;
  },
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    await client.query(
      `
            UPDATE warehouse_products
            SET name = $1, barcode = $2, barcodes = $3, category_id = $4, cost_price = $5, selling_price = $6, min_stock_level = $7, is_active = $8, units_per_box = $9
            WHERE id = $10
        `,
      [
        data.name,
        data.barcode || null,
        data.barcodes || [],
        data.category_id,
        data.cost_price,
        data.selling_price,
        data.min_stock_level || 0,
        data.is_active,
        data.units_per_box || 1,
        id,
      ],
    );

    await client.query("COMMIT");
    await logOperation(clubId, userId, "UPDATE_PRODUCT", "PRODUCT", id, data);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/clubs/${clubId}/inventory`);
}

// Helper to manually adjust stock in a specific warehouse (Admin Override)

export async function getProductHistory(clubId: string, productId: number) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT m.*, u.full_name as user_name, w.name as warehouse_name
        FROM warehouse_stock_movements m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN warehouses w ON m.warehouse_id = w.id
        WHERE m.club_id = $1 AND m.product_id = $2
        ORDER BY m.created_at DESC
        LIMIT 1000
    `,
    [clubId, productId],
  );
  return res.rows;
}

export async function getProductDeletionStatus(
  clubId: string,
  productId: number,
) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT
            EXISTS(
                SELECT 1
                FROM warehouse_supply_items si
                JOIN warehouse_supplies s ON s.id = si.supply_id
                WHERE s.club_id = $1 AND si.product_id = $2
            ) AS has_supplies,
            EXISTS(
                SELECT 1
                FROM warehouse_inventory_items ii
                JOIN warehouse_inventories i ON i.id = ii.inventory_id
                WHERE i.club_id = $1 AND ii.product_id = $2
            ) AS has_inventories,
            EXISTS(
                SELECT 1
                FROM inventory_post_close_corrections pc
                JOIN warehouse_inventories i ON i.id = pc.inventory_id
                WHERE i.club_id = $1 AND pc.product_id = $2
            ) AS has_post_close_corrections,
            EXISTS(
                SELECT 1
                FROM shift_zone_snapshot_items szi
                JOIN shift_zone_snapshots sz ON sz.id = szi.snapshot_id
                WHERE sz.club_id = $1 AND szi.product_id = $2
            ) AS has_shift_snapshots,
            EXISTS(
                SELECT 1
                FROM warehouse_stock_movements m
                WHERE m.club_id = $1 AND m.product_id = $2
            ) AS has_movements,
            EXISTS(
                SELECT 1
                FROM warehouse_stock ws
                JOIN warehouses w ON w.id = ws.warehouse_id
                WHERE w.club_id = $1 AND ws.product_id = $2
            ) AS has_stock
    `,
    [clubId, productId],
  );

  const row = res.rows[0] || {};
  const hasAny = Boolean(
    row.has_supplies ||
    row.has_inventories ||
    row.has_post_close_corrections ||
    row.has_shift_snapshots ||
    row.has_movements ||
    row.has_stock,
  );

  return { ...row, can_hard_delete: !hasAny } as {
    has_supplies: boolean;
    has_inventories: boolean;
    has_post_close_corrections: boolean;
    has_shift_snapshots: boolean;
    has_movements: boolean;
    has_stock: boolean;
    can_hard_delete: boolean;
  };
}

export async function archiveProduct(id: number, clubId: string) {
  await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");
    const stockRes = await client.query(
      `
            SELECT COALESCE(SUM(ws.quantity), 0) as total
            FROM warehouse_stock ws
            JOIN warehouses w ON w.id = ws.warehouse_id
            WHERE ws.product_id = $1 AND w.club_id = $2
        `,
      [id, clubId],
    );
    const total = Number(stockRes.rows[0]?.total) || 0;
    if (total > 0) {
      throw new Error(
        `Нельзя архивировать товар с остатком ${total}. Сначала доведите остатки до 0.`,
      );
    }

    await client.query(
      `
            UPDATE warehouse_products
            SET deleted_at = NOW(), is_active = false
            WHERE id = $1 AND club_id = $2 AND deleted_at IS NULL
        `,
      [id, clubId],
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/clubs/${clubId}/inventory`);
  revalidatePath(`/clubs/${clubId}/inventory/products/${id}`);
}

export async function restoreProduct(id: number, clubId: string) {
  await requireClubAccess(clubId);
  await query(
    `
        UPDATE warehouse_products
        SET deleted_at = NULL, is_active = true
        WHERE id = $1 AND club_id = $2
    `,
    [id, clubId],
  );
  revalidatePath(`/clubs/${clubId}/inventory`);
  revalidatePath(`/clubs/${clubId}/inventory/products/${id}`);
}

export async function deleteProduct(id: number, clubId: string) {
  await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");
    const status = await client.query(
      `
            SELECT
                EXISTS(
                    SELECT 1
                    FROM warehouse_supply_items si
                    JOIN warehouse_supplies s ON s.id = si.supply_id
                    WHERE s.club_id = $1 AND si.product_id = $2
                ) AS has_supplies,
                EXISTS(
                    SELECT 1
                    FROM warehouse_inventory_items ii
                    JOIN warehouse_inventories i ON i.id = ii.inventory_id
                    WHERE i.club_id = $1 AND ii.product_id = $2
                ) AS has_inventories,
                EXISTS(
                    SELECT 1
                    FROM inventory_post_close_corrections pc
                    JOIN warehouse_inventories i ON i.id = pc.inventory_id
                    WHERE i.club_id = $1 AND pc.product_id = $2
                ) AS has_post_close_corrections,
                EXISTS(
                    SELECT 1
                    FROM shift_zone_snapshot_items szi
                    JOIN shift_zone_snapshots sz ON sz.id = szi.snapshot_id
                    WHERE sz.club_id = $1 AND szi.product_id = $2
                ) AS has_shift_snapshots,
                EXISTS(
                    SELECT 1
                    FROM warehouse_stock_movements m
                    WHERE m.club_id = $1 AND m.product_id = $2
                ) AS has_movements,
                EXISTS(
                    SELECT 1
                    FROM warehouse_stock ws
                    JOIN warehouses w ON w.id = ws.warehouse_id
                    WHERE w.club_id = $1 AND ws.product_id = $2
                ) AS has_stock
        `,
      [clubId, id],
    );
    const row = status.rows[0] || {};
    const hasAny = Boolean(
      row.has_supplies ||
      row.has_inventories ||
      row.has_post_close_corrections ||
      row.has_shift_snapshots ||
      row.has_movements ||
      row.has_stock,
    );
    if (hasAny) {
      throw new Error(
        "Нельзя удалить товар: есть история или остатки. Используйте архив.",
      );
    }

    await client.query(
      `DELETE FROM warehouse_products WHERE id = $1 AND club_id = $2`,
      [id, clubId],
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

export async function bulkUpdatePrices(
  ids: number[],
  clubId: string,
  type: "fixed" | "percent",
  value: number,
) {
  await requireClubAccess(clubId);
  if (!ids.length) return;
  if (type === "fixed") {
    await query(
      `
            UPDATE warehouse_products
            SET selling_price = $1
            WHERE id = ANY($2::int[]) AND club_id = $3
        `,
      [value, ids, clubId],
    );
  } else {
    // Percent increase/decrease
    // value is percentage (e.g. 10 for +10%, -10 for -10%)
    // Formula: price * (1 + value/100)
    await query(
      `
            UPDATE warehouse_products
            SET selling_price = selling_price * (1 + $1::decimal / 100)
            WHERE id = ANY($2::int[]) AND club_id = $3
        `,
      [value, ids, clubId],
    );
  }
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function getProductPriceHistory(
  productId: number,
  clubId: string,
) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT si.cost_price, s.created_at, s.supplier_name, s.id as supply_id
        FROM warehouse_supply_items si
        JOIN warehouse_supplies s ON si.supply_id = s.id
        WHERE si.product_id = $1 AND s.club_id = $2 AND s.status = 'COMPLETED'
        ORDER BY s.created_at DESC
        LIMIT 10
    `,
    [productId, clubId],
  );
  return res.rows as {
    cost_price: number;
    created_at: string;
    supplier_name: string;
    supply_id: number;
  }[];
}

// --- INVENTORIES ---

export async function getProductByBarcode(clubId: string, barcode: string) {
  const userId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const scope = await getInventoryAccessScope(client, clubId, userId);
    if (!scope.canManageInventory && scope.allowedWarehouseIds.length === 0) {
      return null;
    }

    const stockFilter = !scope.canManageInventory
      ? " AND ws.warehouse_id = ANY($3)"
      : "";
    const params: any[] = [clubId, barcode];
    if (!scope.canManageInventory) {
      params.push(scope.allowedWarehouseIds);
    }

    const res = await client.query(
      `
            SELECT p.*,
            (SELECT SUM(quantity) FROM warehouse_stock ws WHERE ws.product_id = p.id${stockFilter}) as total_stock,
            (
                SELECT json_agg(json_build_object(
                    'warehouse_id', ws.warehouse_id,
                    'warehouse_name', w.name,
                    'quantity', ws.quantity,
                    'is_default', w.is_default
                ))
                FROM warehouse_stock ws
                JOIN warehouses w ON ws.warehouse_id = w.id
                WHERE ws.product_id = p.id${stockFilter}
            ) as stocks
            FROM warehouse_products p
            WHERE p.club_id = $1 AND ($2::text = ANY(p.barcodes) OR p.barcode = $2::text) AND p.is_active = true
            `,
      params,
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      ...row,
      current_stock: Number(row.total_stock) || 0,
      stocks: row.stocks || [],
    } as Product;
  } finally {
    client.release();
  }
}

export async function getProduct(clubId: string, productId: number) {
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const userId = await requireClubAccess(clubId);
    const scope = await getInventoryAccessScope(client, clubId, userId);
    const stockFilter =
      !scope.canManageInventory && scope.allowedWarehouseIds.length > 0
        ? " AND ws.warehouse_id = ANY($2::int[])"
        : "";
    const stockParams: any[] = [clubId, productId];
    if (!scope.canManageInventory && scope.allowedWarehouseIds.length === 0) {
      return null;
    }
    if (!scope.canManageInventory) {
      stockParams.push(scope.allowedWarehouseIds);
    }

    const queryStr = `
            SELECT p.*, c.name as category_name,
            (SELECT SUM(quantity) FROM warehouse_stock ws WHERE product_id = p.id${stockFilter.replace("$2", "$3")}) as total_stock,
            (
                SELECT json_agg(json_build_object(
                    'warehouse_id', ws.warehouse_id,
                    'warehouse_name', w.name,
                    'quantity', ws.quantity,
                    'is_default', w.is_default
                ))
                FROM warehouse_stock ws
                JOIN warehouses w ON ws.warehouse_id = w.id
                WHERE ws.product_id = p.id${stockFilter.replace("$2", "$3")}
            ) as stocks,
            (
                SELECT json_agg(json_build_object(
                    'cost_price', s.cost_price,
                    'created_at', s.created_at,
                    'supplier_name', s.supplier_name,
                    'supply_id', s.id
                ))
                FROM (
                    SELECT si.cost_price, sup.created_at, sup.supplier_name, sup.id
                    FROM warehouse_supply_items si
                    JOIN warehouse_supplies sup ON si.supply_id = sup.id
                    WHERE si.product_id = p.id AND sup.status = 'COMPLETED'
                    ORDER BY sup.created_at DESC
                    LIMIT 5
                ) s
            ) as price_history
            FROM warehouse_products p
            LEFT JOIN warehouse_categories c ON p.category_id = c.id
            WHERE p.club_id = $1 AND p.id = $2
        `;
    const res = await client.query(queryStr, stockParams);
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}