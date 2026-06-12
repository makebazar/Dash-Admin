"use server";

import type { InventorySettings as NormalizedInventorySettings } from "@/lib/inventory-settings";
import { cookies } from "next/headers";
import { getClubApiAccess, hasModuleAccess } from "@/lib/club-api-access";
import { normalizeInventorySettings, getShiftZoneLabel } from "@/lib/inventory-settings";
import { query, getClient } from "@/db";
import type { InventoryAccessScope } from "./types";

export async function assertSessionUserCanAccessClub(
  clubId: string,
  sessionUserId: string,
) {
  if (!sessionUserId)
    throw new Error("Недостаточно прав для выполнения операции");

  // Club access: owner, active employee, or super admin.
  const accessRes = await query(
    `
        SELECT 1
        FROM clubs c
        JOIN users u ON u.id = $2
        LEFT JOIN club_employees ce
          ON ce.club_id = c.id
         AND ce.user_id = $2
         AND ce.is_active = true
        WHERE c.id = $1
          AND (u.is_super_admin = true OR c.owner_id = $2 OR ce.id IS NOT NULL)
        LIMIT 1
        `,
    [clubId, sessionUserId],
  );
  if ((accessRes.rowCount || 0) === 0) {
    throw new Error("Недостаточно прав для выполнения операции");
  }
}

export async function requireClubAccess(clubId: string) {
  const sessionUserId = await requireSessionUserId();
  await assertSessionUserCanAccessClub(clubId, sessionUserId);
  return sessionUserId;
}

export async function requireSessionUserId() {
  const sessionUserId = (await cookies()).get("session_user_id")?.value;
  if (!sessionUserId)
    throw new Error("Недостаточно прав для выполнения операции");
  return sessionUserId;
}

export async function assertUserCanAccessClub(clubId: string, userId: string) {
  if (!userId) throw new Error("Недостаточно прав для выполнения операции");

  const sessionUserId = (await cookies()).get("session_user_id")?.value;
  if (!sessionUserId || sessionUserId !== userId) {
    throw new Error("Недостаточно прав для выполнения операции");
  }

  await assertSessionUserCanAccessClub(clubId, userId);
}

export function normalizeAllowedWarehouseIds(raw: any): number[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
}

export async function resolveEffectiveEmployeeWarehouseIds(
  client: any,
  clubId: string,
  settings: NormalizedInventorySettings,
): Promise<number[]> {
  // Если сотруднику разрешены перемещения или списания, мы должны разрешить
  // доступ ко всем активным складам, иначе перемещения (между складами) будут невозможны.
  // Это имеет приоритет над явным списком ограничений (explicitIds), так как
  // явный список обычно используется для ограничения кассовых операций (какой склад видит сотрудник),
  // а не для блокировки складских перемещений.
  if (
    settings.employee_transfer_enabled ||
    settings.employee_writeoff_enabled ||
    settings.employee_stock_operations_enabled
  ) {
    const allActiveRes = await client.query(
      `SELECT id FROM warehouses WHERE club_id = $1 AND is_active = true`,
      [clubId],
    );
    return allActiveRes.rows.map((r: any) => Number(r.id));
  }

  const explicitIds = normalizeAllowedWarehouseIds(
    settings.employee_allowed_warehouse_ids,
  );
  if (explicitIds.length > 0) return explicitIds;

  const handoverIds = normalizeAllowedWarehouseIds(
    settings.handover_warehouse_ids,
  );
  const cashboxIds = normalizeAllowedWarehouseIds(
    settings.cashbox_warehouse_ids,
  );
  const autoIds = [
    ...handoverIds,
    ...cashboxIds,
    settings.handover_warehouse_id,
    settings.cashbox_warehouse_id,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (autoIds.length > 0) {
    return Array.from(new Set(autoIds));
  }

  if (!settings.stock_enabled) return [];

  const defaultWarehouseRes = await client.query(
    `SELECT id
         FROM warehouses
         WHERE club_id = $1
           AND is_active = true
         ORDER BY is_default DESC, created_at ASC
         LIMIT 1`,
    [clubId],
  );

  const defaultWarehouseId = Number(defaultWarehouseRes.rows[0]?.id || 0);
  return defaultWarehouseId > 0 ? [defaultWarehouseId] : [];
}

export async function getInventoryAccessScope(
  client: any,
  clubId: string,
  userId: string,
): Promise<InventoryAccessScope> {
  const clubRes = await client.query(
    `SELECT owner_id, inventory_settings
         FROM clubs
         WHERE id = $1
         LIMIT 1`,
    [clubId],
  );
  if (clubRes.rowCount === 0) throw new Error("Клуб не найден");

  // Assuming getClubApiAccess uses its own DB query internally, but it uses next/headers cookies.
  // However, this is a Server Action and `getClubApiAccess` relies on cookies() from next/headers.
  // If it's a Server Action, cookies() works fine. Let's use it.
  const access = await getClubApiAccess(clubId);

  const isFullAccess = access.isFullAccess;
  const canManageInventory = hasModuleAccess(
    access,
    "inventory",
    "edit",
    clubId,
  );

  const normalizedSettings = normalizeInventorySettings(
    clubRes.rows[0]?.inventory_settings,
  );

  return {
    isFullAccess,
    canManageInventory,
    allowedWarehouseIds: await resolveEffectiveEmployeeWarehouseIds(
      client,
      clubId,
      normalizedSettings,
    ),
  };
}

export async function assertUserCanUseWarehouses(
  client: any,
  clubId: string,
  userId: string,
  warehouseIds: Array<number | null | undefined>,
) {
  const scope = await getInventoryAccessScope(client, clubId, userId);
  if (scope.canManageInventory) return scope;

  const normalizedWarehouseIds = Array.from(
    new Set(
      warehouseIds
        .map((warehouseId) => Number(warehouseId))
        .filter(
          (warehouseId) => Number.isInteger(warehouseId) && warehouseId > 0,
        ),
    ),
  );

  if (normalizedWarehouseIds.length === 0) return scope;
  if (scope.allowedWarehouseIds.length === 0) {
    throw new Error("Для вашего профиля не настроены доступные склады");
  }

  const disallowedWarehouseId = normalizedWarehouseIds.find(
    (warehouseId) => !scope.allowedWarehouseIds.includes(warehouseId),
  );
  if (disallowedWarehouseId) {
    throw new Error(`У вас нет доступа к складу #${disallowedWarehouseId}`);
  }

  return scope;
}

export async function getInventoryPageAccess(clubId: string) {
  const userId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const scope = await getInventoryAccessScope(client, clubId, userId);
    return {
      userId,
      canManageInventory: scope.canManageInventory,
      isFullAccess: scope.isFullAccess,
      allowedWarehouseIds: scope.allowedWarehouseIds,
    };
  } finally {
    client.release();
  }
}

export async function getUserRoleInClub(clubId: string, userId: string) {
  await assertUserCanAccessClub(clubId, userId);
  const res = await query(
    `
        SELECT role FROM club_employees
        WHERE club_id = $1 AND user_id = $2 AND is_active = true
    `,
    [clubId, userId],
  );

  if (res.rows.length === 0) return null;
  return res.rows[0].role as string;
}