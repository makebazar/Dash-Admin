"use server";

import { logOperation } from "@/lib/logger";
import { normalizeInventorySettings, getShiftZoneLabel } from "@/lib/inventory-settings";
import { query, getClient } from "@/db";
import { revalidatePath } from "next/cache";
import type { ShiftAccountabilitySetupStatus, Warehouse } from "./types";
import { assertUserCanAccessClub, getInventoryAccessScope, requireClubAccess } from "./auth";
import { getActionErrorMessage } from "./receipts";
import { getClubInventorySettingsInternal } from "./inventories";
import { normalizeShiftZoneKey } from "./shifts";

export async function getWarehouses(clubId: string) {
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
      warehouseFilter = " AND w.id = ANY($2::int[])";
    }

    const res = await client.query(
      `
            SELECT w.*, u.full_name as responsible_name
            FROM warehouses w
            LEFT JOIN users u ON w.responsible_user_id = u.id
            WHERE w.club_id = $1${warehouseFilter}
            ORDER BY w.name
            `,
      params,
    );
    return res.rows as Warehouse[];
  } finally {
    client.release();
  }
}

export async function createWarehouse(
  clubId: string,
  userId: string,
  data: {
    name: string;
    address?: string;
    type: string;
    contact_info?: string;
    characteristics?: any;
    shift_zone_key?: "BAR" | "FRIDGE" | "SHOWCASE" | "BACKROOM" | null;
    shift_accountability_enabled?: boolean;
  },
) {
  await assertUserCanAccessClub(clubId, userId);
  const shiftZoneKey = normalizeShiftZoneKey(data.shift_zone_key);
  const res = await query(
    `
        INSERT INTO warehouses (club_id, name, address, type, shift_zone_key, shift_accountability_enabled, contact_info, characteristics)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
    `,
    [
      clubId,
      data.name,
      data.address,
      data.type,
      shiftZoneKey,
      Boolean(data.shift_accountability_enabled && shiftZoneKey),
      data.contact_info,
      data.characteristics || {},
    ],
  );

  await logOperation(
    clubId,
    userId,
    "CREATE_WAREHOUSE",
    "WAREHOUSE",
    res.rows[0].id,
    data,
  );
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function updateWarehouse(
  id: number,
  clubId: string,
  userId: string,
  data: {
    name: string;
    address?: string;
    type: string;
    contact_info?: string;
    characteristics?: any;
    is_active: boolean;
    shift_zone_key?: "BAR" | "FRIDGE" | "SHOWCASE" | "BACKROOM" | null;
    shift_accountability_enabled?: boolean;
  },
) {
  await assertUserCanAccessClub(clubId, userId);
  const shiftZoneKey = normalizeShiftZoneKey(data.shift_zone_key);
  await query(
    `
        UPDATE warehouses
        SET name = $1, address = $2, type = $3, shift_zone_key = $4, shift_accountability_enabled = $5, contact_info = $6, characteristics = $7, is_active = $8
        WHERE id = $9
    `,
    [
      data.name,
      data.address,
      data.type,
      shiftZoneKey,
      Boolean(data.shift_accountability_enabled && shiftZoneKey),
      data.contact_info,
      data.characteristics || {},
      data.is_active,
      id,
    ],
  );

  await logOperation(clubId, userId, "UPDATE_WAREHOUSE", "WAREHOUSE", id, data);
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function getShiftAccountabilityWarehousesInternal(
  client: any,
  clubId: string,
  userId: string,
) {
  await getInventoryAccessScope(client, clubId, userId);

  const inventorySettings = await getClubInventorySettingsInternal(
    client,
    clubId,
  );
  if (inventorySettings.shift_accountability_mode !== "WAREHOUSE") {
    return [];
  }

  const configuredWarehouseIds = Array.isArray(
    inventorySettings.handover_warehouse_ids,
  )
    ? inventorySettings.handover_warehouse_ids
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];
  if (configuredWarehouseIds.length > 0) {
    const configuredRes = await client.query(
      `
            SELECT w.*
            FROM warehouses w
            WHERE w.club_id = $1
              AND w.is_active = true
              AND w.id = ANY($2::int[])
            ORDER BY w.name
            `,
      [clubId, configuredWarehouseIds],
    );

    return configuredRes.rows.map((row: any) => ({
      ...row,
      shift_accountability_enabled: true,
      shift_zone_key: row.shift_zone_key || "BAR",
    })) as Array<
      Warehouse & { shift_zone_key: "BAR" | "FRIDGE" | "SHOWCASE" | "BACKROOM" }
    >;
  }

  const params: any[] = [clubId];
  const warehouseFilter = "";

  const res = await client.query(
    `
        SELECT w.*
        FROM warehouses w
        WHERE w.club_id = $1
          AND w.is_active = true
          AND w.shift_accountability_enabled = true
          AND w.shift_zone_key IS NOT NULL
          ${warehouseFilter}
        ORDER BY
          CASE w.shift_zone_key
            WHEN 'BAR' THEN 1
            WHEN 'FRIDGE' THEN 2
            WHEN 'SHOWCASE' THEN 3
            WHEN 'BACKROOM' THEN 4
            ELSE 99
          END,
          w.name
        `,
    params,
  );

  return res.rows
    .map((row: any) => ({
      ...row,
      shift_zone_key: normalizeShiftZoneKey(row.shift_zone_key),
    }))
    .filter((row: any) => row.shift_zone_key) as Array<
    Warehouse & { shift_zone_key: "BAR" | "FRIDGE" | "SHOWCASE" | "BACKROOM" }
  >;
}

export async function getShiftAccountabilityWarehouses(clubId: string) {
  const sessionUserId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const warehouses = await getShiftAccountabilityWarehousesInternal(
      client,
      clubId,
      sessionUserId,
    );
    return warehouses.map((warehouse) => ({
      ...warehouse,
      shift_zone_label: getShiftZoneLabel(warehouse.shift_zone_key!),
    }));
  } finally {
    client.release();
  }
}

export async function getShiftAccountabilitySetupStatus(
  clubId: string,
): Promise<ShiftAccountabilitySetupStatus> {
  const sessionUserId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const clubRes = await client.query(
      `SELECT inventory_settings FROM clubs WHERE id = $1 LIMIT 1`,
      [clubId],
    );
    const settings = normalizeInventorySettings(
      clubRes.rows[0]?.inventory_settings || {},
    );
    const mode: ShiftAccountabilitySetupStatus["mode"] =
      settings?.shift_accountability_mode === "WAREHOUSE"
        ? "WAREHOUSE"
        : "DISABLED";

    const warehouses = await getShiftAccountabilityWarehousesInternal(
      client,
      clubId,
      sessionUserId,
    );
    const issues: string[] = [];

    if (
      settings.cashbox_enabled &&
      (!settings.cashbox_warehouse_ids ||
        settings.cashbox_warehouse_ids.length === 0)
    ) {
      issues.push("Выбери склад кассы в настройках inventory.");
    }
    if (
      settings.report_reconciliation_enabled &&
      !settings.employee_default_metric_key
    ) {
      issues.push("Выбери метрику выручки по умолчанию для сверки итогов.");
    }

    if (mode === "WAREHOUSE") {
      if (warehouses.length === 0) {
        issues.push("Выбери склады передачи в настройках inventory.");
      }
      const cashboxIds = Array.isArray(settings.cashbox_warehouse_ids)
        ? settings.cashbox_warehouse_ids
            .map((v) => Number(v))
            .filter((v) => Number.isInteger(v) && v > 0)
        : [];
      const handoverIds = Array.isArray(settings.handover_warehouse_ids)
        ? settings.handover_warehouse_ids
            .map((v) => Number(v))
            .filter((v) => Number.isInteger(v) && v > 0)
        : [];
      if (cashboxIds.length > 0 && handoverIds.length > 0) {
        const cashboxSet = new Set<number>(cashboxIds);
        const outside = handoverIds.filter((id) => !cashboxSet.has(id));
        if (outside.length > 0) {
          issues.push(
            "Склады передачи должны входить в выбранные склады кассы.",
          );
        }
      }
    }

    return {
      mode,
      enabled: mode === "WAREHOUSE",
      ready: mode === "WAREHOUSE" ? issues.length === 0 : true,
      warehouses_count: warehouses.length,
      configured_warehouses: warehouses.map((warehouse) => ({
        id: Number(warehouse.id),
        name: warehouse.name,
        shift_zone_key: warehouse.shift_zone_key!,
        shift_zone_label: getShiftZoneLabel(warehouse.shift_zone_key!),
      })),
      issues,
    };
  } finally {
    client.release();
  }
}

export async function deleteWarehouse(
  id: number,
  clubId: string,
  userId: string,
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    // 1. Check if warehouse has stock
    const stockRes = await client.query(
      "SELECT SUM(quantity) as total FROM warehouse_stock WHERE warehouse_id = $1",
      [id],
    );
    const totalStock = parseFloat(stockRes.rows[0]?.total || "0");

    if (totalStock > 0) {
      throw new Error(
        "Нельзя удалить склад, на котором есть товары. Сначала переместите их или спишите.",
      );
    }

    // 2. Check if it's default warehouse
    const whRes = await client.query(
      "SELECT is_default FROM warehouses WHERE id = $1",
      [id],
    );
    if (whRes.rows[0]?.is_default) {
      throw new Error("Нельзя удалить основной склад клуба.");
    }

    // 3. Delete replenishment rules where this warehouse is source or target
    await client.query(
      "DELETE FROM warehouse_replenishment_rules WHERE source_warehouse_id = $1 OR target_warehouse_id = $2",
      [id, id],
    );

    // 4. Delete the warehouse
    await client.query("DELETE FROM warehouses WHERE id = $1", [id]);

    await logOperation(clubId, userId, "DELETE_WAREHOUSE", "WAREHOUSE", id);
    await client.query("COMMIT");

    revalidatePath(`/clubs/${clubId}/inventory`);
    return { success: true };
  } catch (e: any) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getShiftAccountabilityWarehousesSafe(clubId: string) {
  try {
    const data = await getShiftAccountabilityWarehouses(clubId);
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(
        error,
        "Не удалось загрузить склады передачи",
      ),
    };
  }
}