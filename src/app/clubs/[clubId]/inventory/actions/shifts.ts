"use server";

import { normalizeInventorySettings, getShiftZoneLabel } from "@/lib/inventory-settings";
import { query, getClient } from "@/db";
import { revalidatePath } from "next/cache";
import type { HandoverSourceCandidate, ShiftZoneDiscrepancyRow, ShiftZoneOverview, ShiftZoneOverviewShift, ShiftZoneOverviewZone, ShiftZoneSnapshotDraftItem, ShiftZoneSnapshotType, Warehouse } from "./types";
import { applyWarehouseStockDelta, logStockMovement, syncProductsCurrentStock } from "./stock";
import { getActionErrorMessage } from "./receipts";
import { getInventoryAccessScope, requireClubAccess } from "./auth";
import { getShiftAccountabilityWarehousesInternal } from "./warehouses";

export function normalizeShiftZoneKey(
  raw: any,
): "BAR" | "FRIDGE" | "SHOWCASE" | "BACKROOM" | null {
  if (
    raw === "BAR" ||
    raw === "FRIDGE" ||
    raw === "SHOWCASE" ||
    raw === "BACKROOM"
  )
    return raw;
  return null;
}



export async function getShiftForZoneAccountability(
  client: any,
  clubId: string,
  shiftId: string,
  sessionUserId: string,
) {
  const shiftRes = await client.query(
    `
        SELECT s.id, s.user_id, s.club_id, s.check_in, s.check_out, s.status
        FROM shifts s
        WHERE s.id = $1 AND s.club_id = $2
        LIMIT 1
        `,
    [shiftId, clubId],
  );
  if (shiftRes.rowCount === 0) throw new Error("Смена не найдена");

  const shift = shiftRes.rows[0];
  const scope = await getInventoryAccessScope(client, clubId, sessionUserId);
  if (
    !scope.canManageInventory &&
    String(shift.user_id) !== String(sessionUserId)
  ) {
    throw new Error("Недостаточно прав для работы с этой сменой");
  }

  return shift;
}

export async function getShiftZoneSnapshotDraft(
  clubId: string,
  shiftId: string,
  snapshotType: ShiftZoneSnapshotType,
) {
  const sessionUserId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const shift = await getShiftForZoneAccountability(
      client,
      clubId,
      shiftId,
      sessionUserId,
    );
    const warehouses = await getShiftAccountabilityWarehousesInternal(
      client,
      clubId,
      sessionUserId,
    );
    if (warehouses.length === 0) return [] as ShiftZoneSnapshotDraftItem[];

    const shiftWindowEnd = shift.check_out || new Date().toISOString();
    const result: ShiftZoneSnapshotDraftItem[] = [];

    for (const warehouse of warehouses) {
      const rows = await client.query(
        `
                WITH relevant_products AS (
                    SELECT product_id
                    FROM warehouse_stock
                    WHERE warehouse_id = $2
                      AND quantity <> 0

                    UNION

                    SELECT sii.product_id
                    FROM shift_zone_snapshot_items sii
                    JOIN shift_zone_snapshots ss ON ss.id = sii.snapshot_id
                    WHERE ss.shift_id = $1
                      AND ss.warehouse_id = $2
                      AND ss.snapshot_type IN ('OPEN', $3)

                    UNION

                    SELECT DISTINCT m.product_id
                    FROM warehouse_stock_movements m
                    WHERE m.club_id = $4
                      AND m.warehouse_id = $2
                      AND m.created_at >= $5
                      AND m.created_at <= $6
                )
                SELECT
                    p.id as product_id,
                    p.name as product_name,
                    p.barcode,
                    p.barcodes,
                    COALESCE(ws.quantity, 0) as system_quantity,
                    sii.counted_quantity as saved_counted_quantity,
                    COALESCE(sii.counted_quantity, COALESCE(ws.quantity, 0)) as counted_quantity,
                    COALESCE(p.selling_price, 0) as selling_price
                FROM relevant_products rp
                JOIN warehouse_products p ON p.id = rp.product_id AND p.club_id = $4
                LEFT JOIN warehouse_stock ws
                    ON ws.warehouse_id = $2
                   AND ws.product_id = p.id
                LEFT JOIN shift_zone_snapshots ss
                    ON ss.shift_id = $1
                   AND ss.warehouse_id = $2
                   AND ss.snapshot_type = $3
                LEFT JOIN shift_zone_snapshot_items sii
                    ON sii.snapshot_id = ss.id
                   AND sii.product_id = p.id
                WHERE p.is_active = true
                ORDER BY p.name
                `,
        [
          shiftId,
          warehouse.id,
          snapshotType,
          clubId,
          shift.check_in,
          shiftWindowEnd,
        ],
      );

      for (const row of rows.rows) {
        result.push({
          warehouse_id: warehouse.id,
          warehouse_name: warehouse.name,
          shift_zone_key: warehouse.shift_zone_key!,
          shift_zone_label: getShiftZoneLabel(warehouse.shift_zone_key!),
          product_id: Number(row.product_id),
          product_name: row.product_name,
          barcode: row.barcode,
          barcodes: row.barcodes,
          counted_quantity:
            row.counted_quantity === null || row.counted_quantity === undefined
              ? null
              : Number(row.counted_quantity || 0),
          saved_counted_quantity:
            row.saved_counted_quantity === null ||
            row.saved_counted_quantity === undefined
              ? null
              : Number(row.saved_counted_quantity || 0),
          system_quantity: Number(row.system_quantity || 0),
          selling_price: Number(row.selling_price || 0),
        });
      }
    }

    return result;
  } finally {
    client.release();
  }
}

export async function hasSavedShiftZoneSnapshot(
  clubId: string,
  shiftId: string,
  snapshotType: ShiftZoneSnapshotType,
) {
  const sessionUserId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await getShiftForZoneAccountability(client, clubId, shiftId, sessionUserId);
    const res = await client.query(
      `
            SELECT 1
            FROM shift_zone_snapshots
            WHERE club_id = $1
              AND shift_id = $2
              AND snapshot_type = $3
            LIMIT 1
            `,
      [clubId, shiftId, snapshotType],
    );
    return (res.rowCount || 0) > 0;
  } finally {
    client.release();
  }
}

export async function getHandoverSourceCandidates(
  clubId: string,
  shiftId: string,
) {
  const sessionUserId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const shift = await getShiftForZoneAccountability(
      client,
      clubId,
      shiftId,
      sessionUserId,
    );
    await ensurePreviousShiftClosureCompleted(
      client,
      clubId,
      shiftId,
      new Date(shift.check_in).toISOString(),
    );
    const referenceTime = new Date().toISOString();
    const currentShiftUserId = shift.user_id ? String(shift.user_id) : null;
    const res = await client.query(
      `
            SELECT
                s.id as shift_id,
                s.user_id as employee_id,
                COALESCE(u.full_name, 'Неизвестный сотрудник') as employee_name,
                s.check_in,
                s.check_out,
                CASE
                    WHEN $4::text IS NOT NULL AND s.user_id::text = $4::text THEN true
                    ELSE false
                END as is_self_handover
            FROM shifts s
            LEFT JOIN users u ON u.id = s.user_id
            WHERE s.club_id = $1
              AND s.id <> $2
              AND s.check_out IS NOT NULL
              AND s.check_out <= $3
            ORDER BY
                CASE
                    WHEN $4::text IS NOT NULL AND s.user_id::text = $4::text THEN 1
                    ELSE 0
                END ASC,
                s.check_out DESC,
                s.check_in DESC,
                s.id DESC
            LIMIT 20
            `,
      [clubId, shiftId, referenceTime, currentShiftUserId],
    );

    return res.rows.map((row: any) => ({
      shift_id: String(row.shift_id),
      employee_id: row.employee_id ? String(row.employee_id) : null,
      employee_name: String(row.employee_name || "Неизвестный сотрудник"),
      check_in: String(row.check_in),
      check_out: String(row.check_out),
      is_self_handover: Boolean(row.is_self_handover),
    })) as HandoverSourceCandidate[];
  } finally {
    client.release();
  }
}

export async function saveShiftZoneSnapshot(
  clubId: string,
  shiftId: string,
  snapshotType: ShiftZoneSnapshotType,
  payload: Array<{
    warehouse_id: number;
    items: Array<{ product_id: number; counted_quantity: number }>;
  }>,
  options?: { accepted_from_shift_id?: string | null },
) {
  const sessionUserId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");
    const shift = await getShiftForZoneAccountability(
      client,
      clubId,
      shiftId,
      sessionUserId,
    );
    const warehouses = await getShiftAccountabilityWarehousesInternal(
      client,
      clubId,
      sessionUserId,
    );
    const allowedWarehouseIds = new Set(
      warehouses.map((warehouse) => Number(warehouse.id)),
    );
    const normalizedPayload = payload
      .map((warehouse) => ({
        warehouse_id: Number(warehouse.warehouse_id),
        items: (warehouse.items || [])
          .map((item) => ({
            product_id: Number(item.product_id),
            counted_quantity: Math.max(
              0,
              Math.trunc(Number(item.counted_quantity) || 0),
            ),
          }))
          .filter(
            (item) => Number.isInteger(item.product_id) && item.product_id > 0,
          ),
      }))
      .filter((warehouse) => allowedWarehouseIds.has(warehouse.warehouse_id));

    if (normalizedPayload.length === 0) {
      throw new Error("Нет зон для сохранения приемки/сдачи");
    }

    const touchedProductIds = new Set<number>();
    const snapshotReferenceTime = new Date().toISOString();
    if (snapshotType === "OPEN") {
      await ensurePreviousShiftClosureCompleted(
        client,
        clubId,
        shiftId,
        new Date(shift.check_in).toISOString(),
      );
    }
    const acceptedFrom =
      snapshotType === "OPEN"
        ? await findAcceptedFromShift(
            client,
            clubId,
            shiftId,
            shift.user_id ? String(shift.user_id) : null,
            snapshotReferenceTime,
            options?.accepted_from_shift_id || null,
          )
        : {
            accepted_from_shift_id: null as string | null,
            accepted_from_employee_id: null as string | null,
          };

    const shouldSyncStock = snapshotType === "OPEN" || snapshotType === "CLOSE";

    for (const warehousePayload of normalizedPayload) {
      const snapshotRes = await client.query(
        `
                INSERT INTO shift_zone_snapshots (
                    club_id,
                    shift_id,
                    employee_id,
                    warehouse_id,
                    snapshot_type,
                    accepted_from_shift_id,
                    accepted_from_employee_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (shift_id, warehouse_id, snapshot_type)
                DO UPDATE SET
                    employee_id = EXCLUDED.employee_id,
                    accepted_from_shift_id = EXCLUDED.accepted_from_shift_id,
                    accepted_from_employee_id = EXCLUDED.accepted_from_employee_id,
                    created_at = NOW()
                RETURNING id
                `,
        [
          clubId,
          shiftId,
          shift.user_id,
          warehousePayload.warehouse_id,
          snapshotType,
          acceptedFrom.accepted_from_shift_id,
          acceptedFrom.accepted_from_employee_id,
        ],
      );
      const snapshotId = Number(snapshotRes.rows[0].id);

      if (shouldSyncStock) {
        const existingAdjustmentRes = await client.query(
          `
                    SELECT id, product_id, change_amount
                    FROM warehouse_stock_movements
                    WHERE club_id = $1
                      AND warehouse_id = $2
                      AND related_entity_type = 'SHIFT_ZONE_SNAPSHOT'
                      AND related_entity_id = $3
                    ORDER BY id
                    `,
          [clubId, warehousePayload.warehouse_id, snapshotId],
        );

        for (const movement of existingAdjustmentRes.rows) {
          await applyWarehouseStockDelta(
            client,
            warehousePayload.warehouse_id,
            Number(movement.product_id),
            -Number(movement.change_amount || 0),
          );
          touchedProductIds.add(Number(movement.product_id));
        }

        if (existingAdjustmentRes.rowCount) {
          await client.query(
            `
                        DELETE FROM warehouse_stock_movements
                        WHERE club_id = $1
                          AND warehouse_id = $2
                          AND related_entity_type = 'SHIFT_ZONE_SNAPSHOT'
                          AND related_entity_id = $3
                        `,
            [clubId, warehousePayload.warehouse_id, snapshotId],
          );
        }
      }

      await client.query(
        `DELETE FROM shift_zone_snapshot_items WHERE snapshot_id = $1`,
        [snapshotId],
      );

      if (warehousePayload.items.length === 0) continue;

      const productIds = warehousePayload.items.map((item) => item.product_id);
      const productRes = await client.query(
        `
                SELECT
                    p.id,
                    COALESCE(ws.quantity, 0) as system_quantity
                FROM warehouse_products p
                LEFT JOIN warehouse_stock ws
                    ON ws.warehouse_id = $2
                   AND ws.product_id = p.id
                WHERE p.club_id = $1
                  AND p.id = ANY($3)
                `,
        [clubId, warehousePayload.warehouse_id, productIds],
      );
      if (productRes.rowCount !== productIds.length) {
        throw new Error("Некоторые товары для снимка зоны не найдены");
      }
      const systemMap = new Map<number, number>(
        productRes.rows.map((row: any) => [
          Number(row.id),
          Number(row.system_quantity || 0),
        ]),
      );

      for (const item of warehousePayload.items) {
        const systemQuantity = systemMap.get(item.product_id) || 0;
        touchedProductIds.add(item.product_id);
        await client.query(
          `
                    INSERT INTO shift_zone_snapshot_items (snapshot_id, product_id, counted_quantity, system_quantity)
                    VALUES ($1, $2, $3, $4)
                    `,
          [snapshotId, item.product_id, item.counted_quantity, systemQuantity],
        );

        if (shouldSyncStock) {
          const stockDelta = item.counted_quantity - systemQuantity;
          if (stockDelta !== 0) {
            const { previousStock, newStock } = await applyWarehouseStockDelta(
              client,
              warehousePayload.warehouse_id,
              item.product_id,
              stockDelta,
            );

            await logStockMovement(
              client,
              clubId,
              sessionUserId,
              item.product_id,
              stockDelta,
              previousStock,
              newStock,
              stockDelta > 0 ? "INVENTORY_GAIN" : "INVENTORY_LOSS",
              stockDelta > 0
                ? `${snapshotType === "OPEN" ? "Приемка остатков" : "Сдача остатков"} #${snapshotId}: найден излишек`
                : `${snapshotType === "OPEN" ? "Приемка остатков" : "Сдача остатков"} #${snapshotId}: подтверждена недостача`,
              "SHIFT_ZONE_SNAPSHOT",
              snapshotId,
              shiftId,
              warehousePayload.warehouse_id,
              null,
            );
          }
        }
      }
    }

    await syncProductsCurrentStock(client, clubId, touchedProductIds);

    await client.query("COMMIT");
    revalidatePath(`/employee/clubs/${clubId}`);
    revalidatePath(`/clubs/${clubId}/shifts/${shiftId}`);
    revalidatePath(`/clubs/${clubId}/inventory`);
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getShiftZoneDiscrepancyReportInternal(
  client: any,
  clubId: string,
  shiftId: string,
  sessionUserId: string,
) {
  const shift = await getShiftForZoneAccountability(
    client,
    clubId,
    shiftId,
    sessionUserId,
  );
  const warehouses = await getShiftAccountabilityWarehousesInternal(
    client,
    clubId,
    sessionUserId,
  );
  if (warehouses.length === 0) return [] as ShiftZoneDiscrepancyRow[];

  const warehouseIds = warehouses.map((warehouse) => Number(warehouse.id));
  const warehouseById = new Map<number, Warehouse>(
    warehouses.map((warehouse) => [
      Number(warehouse.id),
      warehouse as Warehouse,
    ]),
  );
  const snapshotItemsRes = await client.query(
    `
        SELECT
            ss.warehouse_id,
            ss.snapshot_type,
            ss.created_at as snapshot_created_at,
            sii.product_id,
            sii.counted_quantity,
            sii.system_quantity,
            p.name as product_name,
            p.selling_price
        FROM shift_zone_snapshots ss
        JOIN shift_zone_snapshot_items sii ON sii.snapshot_id = ss.id
        JOIN warehouse_products p ON p.id = sii.product_id
        WHERE ss.shift_id = $1
          AND ss.warehouse_id = ANY($2::int[])
        `,
    [shiftId, warehouseIds],
  );

  const movementRows = await client.query(
    `
            SELECT warehouse_id, product_id, change_amount, type, reason, created_at, user_id, shift_id, related_entity_type, related_entity_id
        FROM warehouse_stock_movements
        WHERE club_id = $1
          AND warehouse_id = ANY($2::int[])
          AND created_at >= $3
          AND created_at <= $4
        `,
    [
      clubId,
      warehouseIds,
      shift.check_in,
      shift.check_out || new Date().toISOString(),
    ],
  );

  const byKey = new Map<string, any>();
  const ensureEntry = (
    warehouseId: number,
    productId: number,
    defaults?: Partial<any>,
  ) => {
    const key = `${warehouseId}:${productId}`;
    if (!byKey.has(key)) {
      const warehouse = warehouseById.get(warehouseId);
      byKey.set(key, {
        warehouse_id: warehouseId,
        warehouse_name: warehouse?.name || `Склад #${warehouseId}`,
        shift_zone_key: warehouse?.shift_zone_key || "BACKROOM",
        shift_zone_label: getShiftZoneLabel(
          (warehouse?.shift_zone_key || "BACKROOM") as
            | "BAR"
            | "FRIDGE"
            | "SHOWCASE"
            | "BACKROOM",
        ),
        product_id: productId,
        product_name: defaults?.product_name || `Товар #${productId}`,
        selling_price: Number(defaults?.selling_price || 0),
        opening_counted_quantity: null,
        opening_system_quantity: null,
        closing_counted_quantity: null,
        closing_system_quantity: null,
        inflow_quantity: 0,
        outflow_quantity: 0,
        open_snapshot_at: null as string | null,
        close_snapshot_at: null as string | null,
        has_process_gap: false,
        movements: [] as ShiftZoneDiscrepancyRow["movements"],
      });
    }
    if (defaults) {
      Object.assign(byKey.get(key), defaults);
    }
    return byKey.get(key);
  };

  for (const row of snapshotItemsRes.rows) {
    const entry = ensureEntry(
      Number(row.warehouse_id),
      Number(row.product_id),
      {
        product_name: row.product_name,
        selling_price: Number(row.selling_price || 0),
      },
    );
    if (row.snapshot_type === "OPEN") {
      entry.opening_counted_quantity = Number(row.counted_quantity);
      entry.opening_system_quantity = Number(row.system_quantity);
      entry.open_snapshot_at = row.snapshot_created_at;
    } else if (row.snapshot_type === "CLOSE") {
      entry.closing_counted_quantity = Number(row.counted_quantity);
      entry.closing_system_quantity = Number(row.system_quantity);
      entry.close_snapshot_at = row.snapshot_created_at;
    }
  }

  for (const row of movementRows.rows) {
    const entry = ensureEntry(Number(row.warehouse_id), Number(row.product_id));
    const movementType = String(row.type || "");
    const relatedEntityType = String(row.related_entity_type || "");
    const amount = Number(row.change_amount || 0);
    const isInventoryMovement = [
      "INVENTORY_GAIN",
      "INVENTORY_LOSS",
      "INVENTORY_CORRECTION",
    ].includes(movementType);
    const isManualGap = movementType === "ADJUSTMENT";
    const isShiftZoneSnapshotAdjustment =
      relatedEntityType === "SHIFT_ZONE_SNAPSHOT";
    const isOperationalMovement =
      !isInventoryMovement && !isManualGap && !isShiftZoneSnapshotAdjustment;
    const movementCreatedAt = row.created_at
      ? new Date(row.created_at).getTime()
      : null;
    const movementWindowStartedAt =
      entry.open_snapshot_at || shift.check_in || null;
    const movementWindowEndedAt =
      entry.close_snapshot_at || shift.check_out || new Date().toISOString();

    if (movementCreatedAt !== null) {
      const windowStartedAtMs = movementWindowStartedAt
        ? new Date(movementWindowStartedAt).getTime()
        : null;
      const windowEndedAtMs = movementWindowEndedAt
        ? new Date(movementWindowEndedAt).getTime()
        : null;
      if (
        (windowStartedAtMs !== null && movementCreatedAt < windowStartedAtMs) ||
        (windowEndedAtMs !== null && movementCreatedAt > windowEndedAtMs)
      ) {
        continue;
      }
    }

    if (isShiftZoneSnapshotAdjustment) continue;

    entry.movements.push({
      created_at: row.created_at,
      type: movementType,
      change_amount: amount,
      reason: row.reason || null,
      related_entity_type: row.related_entity_type || null,
      related_entity_id: row.related_entity_id || null,
      shift_id: row.shift_id || null,
      user_id: row.user_id || null,
    });

    if (isOperationalMovement) {
      if (amount > 0) entry.inflow_quantity += amount;
      if (amount < 0) entry.outflow_quantity += Math.abs(amount);
    }

    if (
      isInventoryMovement ||
      isManualGap ||
      !row.shift_id ||
      String(row.shift_id) !== String(shiftId) ||
      (row.user_id && String(row.user_id) !== String(shift.user_id))
    ) {
      entry.has_process_gap = true;
    }
  }

  return Array.from(byKey.values())
    .map((entry) => {
      const openingCounted = entry.opening_counted_quantity;
      const closingCounted = entry.closing_counted_quantity;
      const hasOpening = openingCounted !== null;
      const hasClosing = closingCounted !== null;
      let expectedClosing: number | null = null;
      let difference: number | null = null;

      if (hasOpening) {
        expectedClosing =
          openingCounted + entry.inflow_quantity - entry.outflow_quantity;
      }

      if (hasOpening && hasClosing) {
        difference = closingCounted - expectedClosing!;
      } else if (
        !hasOpening &&
        hasClosing &&
        entry.closing_system_quantity !== null
      ) {
        expectedClosing = Number(entry.closing_system_quantity);
        difference = closingCounted - expectedClosing;
      } else if (
        hasOpening &&
        !hasClosing &&
        entry.opening_system_quantity !== null
      ) {
        expectedClosing = openingCounted;
        difference = openingCounted - Number(entry.opening_system_quantity);
      }

      let responsibilityType: ShiftZoneDiscrepancyRow["responsibility_type"] =
        "SHIFT_RESPONSIBILITY";
      let responsibilityLabel = "Ответственность смены";
      let explanation =
        "Расхождение возникло внутри этой смены при чистой приемке зоны.";

      if (!hasOpening && hasClosing) {
        responsibilityType = "PROCESS_GAP";
        responsibilityLabel = "Сдача без приемки";
        explanation = `Зона сдана без стартовой приемки. Сравнение идет с системным остатком ${entry.closing_system_quantity ?? 0}.`;
      } else if (hasOpening && !hasClosing) {
        responsibilityType = "PROCESS_GAP";
        responsibilityLabel = "Только приемка";
        explanation = `Есть стартовая приемка, но нет сдачи зоны. На старте уже было отклонение: по системе ${entry.opening_system_quantity ?? 0}, принято ${openingCounted}.`;
      } else if (openingCounted === null || closingCounted === null) {
        responsibilityType = "PROCESS_GAP";
        responsibilityLabel = "Сбой процесса";
        explanation =
          "Не хватает приемки или сдачи зоны, поэтому привязать расхождение к смене нельзя.";
      } else if (
        entry.opening_system_quantity !== null &&
        openingCounted !== entry.opening_system_quantity
      ) {
        responsibilityType = "INHERITED_FROM_PREVIOUS_SHIFT";
        responsibilityLabel = "Наследовано со старта";
        explanation = `На старте уже было расхождение: по системе ${entry.opening_system_quantity}, принято ${openingCounted}.`;
      } else if (entry.has_process_gap) {
        responsibilityType = "PROCESS_GAP";
        responsibilityLabel = "Сбой процесса";
        explanation =
          "Во время смены были внешние или неразмеченные движения по этой зоне.";
      } else if ((difference ?? 0) > 0) {
        explanation =
          "В конце смены обнаружен излишек при чистой приемке зоны.";
      }

      return {
        warehouse_id: entry.warehouse_id,
        warehouse_name: entry.warehouse_name,
        shift_zone_key: entry.shift_zone_key,
        shift_zone_label: entry.shift_zone_label,
        product_id: entry.product_id,
        product_name: entry.product_name,
        selling_price: Number(entry.selling_price || 0),
        opening_counted_quantity: openingCounted,
        opening_system_quantity: entry.opening_system_quantity,
        inflow_quantity: entry.inflow_quantity,
        outflow_quantity: entry.outflow_quantity,
        expected_closing_quantity: expectedClosing,
        actual_closing_quantity: closingCounted,
        difference_quantity: difference,
        responsibility_type: responsibilityType,
        responsibility_label: responsibilityLabel,
        explanation,
        movement_window_started_at:
          entry.open_snapshot_at || shift.check_in || null,
        movement_window_ended_at:
          entry.close_snapshot_at || shift.check_out || null,
        movements: entry.movements,
      } satisfies ShiftZoneDiscrepancyRow;
    })
    .filter((row) => (row.difference_quantity ?? 0) !== 0)
    .sort(
      (a, b) => (a.difference_quantity ?? 0) - (b.difference_quantity ?? 0),
    );
}

export async function getShiftZoneDiscrepancyReport(
  clubId: string,
  shiftId: string,
) {
  const sessionUserId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    return await getShiftZoneDiscrepancyReportInternal(
      client,
      clubId,
      shiftId,
      sessionUserId,
    );
  } finally {
    client.release();
  }
}

export async function getShiftZoneOverview(clubId: string, monthStr?: string) {
  const sessionUserId = await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    const warehouses = await getShiftAccountabilityWarehousesInternal(
      client,
      clubId,
      sessionUserId,
    );
    if (warehouses.length === 0) {
      return {
        summary: {
          recent_shifts_count: 0,
          configured_zones_count: 0,
          complete_shifts_count: 0,
          discrepancy_shifts_count: 0,
          discrepancy_total_abs: 0,
        },
        recent_shifts: [],
        zones: [],
      } satisfies ShiftZoneOverview;
    }

    const totalZones = warehouses.length;
    const warehouseById = new Map<number, Warehouse>(
      warehouses.map((warehouse) => [
        Number(warehouse.id),
        warehouse as Warehouse,
      ]),
    );

    let targetMonth = monthStr;
    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      const now = new Date();
      targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    const [year, month] = targetMonth.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const recentShiftRows = await client.query(
      `
            SELECT DISTINCT ON (ss.shift_id)
                ss.shift_id,
                s.check_in,
                s.check_out,
                u.full_name as employee_name
            FROM shift_zone_snapshots ss
            JOIN shifts s ON s.id = ss.shift_id
            LEFT JOIN users u ON u.id = s.user_id
            WHERE ss.club_id = $1
              AND s.check_in >= $2
              AND s.check_in < $3
            ORDER BY ss.shift_id, s.check_in DESC
            `,
      [clubId, startDate.toISOString(), endDate.toISOString()],
    );

    const sortedRecentShifts = recentShiftRows.rows.sort(
      (a: any, b: any) =>
        new Date(b.check_in).getTime() - new Date(a.check_in).getTime(),
    );

    const shiftIds = sortedRecentShifts.map((row: any) => String(row.shift_id));
    if (shiftIds.length === 0) {
      return {
        summary: {
          recent_shifts_count: 0,
          configured_zones_count: totalZones,
          complete_shifts_count: 0,
          discrepancy_shifts_count: 0,
          discrepancy_total_abs: 0,
        },
        recent_shifts: [],
        zones: warehouses.map((warehouse) => ({
          warehouse_id: Number(warehouse.id),
          warehouse_name: warehouse.name,
          shift_zone_key:
            normalizeShiftZoneKey(warehouse.shift_zone_key) || "BACKROOM",
          shift_zone_label: getShiftZoneLabel(
            normalizeShiftZoneKey(warehouse.shift_zone_key) || "BACKROOM",
          ),
          open_snapshots_count: 0,
          close_snapshots_count: 0,
          discrepancy_shifts_count: 0,
          discrepancy_items_count: 0,
          discrepancy_total_abs: 0,
          latest_open_at: null,
          latest_close_at: null,
        })),
      } satisfies ShiftZoneOverview;
    }

    const snapshotsRes = await client.query(
      `
            SELECT
                ss.shift_id,
                ss.warehouse_id,
                ss.snapshot_type,
                ss.created_at
            FROM shift_zone_snapshots ss
            WHERE ss.club_id = $1
              AND ss.shift_id = ANY($2::uuid[])
            ORDER BY ss.created_at DESC
            `,
      [clubId, shiftIds],
    );

    const shiftMap = new Map<string, ShiftZoneOverviewShift>();
    for (const row of sortedRecentShifts) {
      shiftMap.set(String(row.shift_id), {
        shift_id: String(row.shift_id),
        employee_name: row.employee_name || "Неизвестно",
        check_in: row.check_in,
        check_out: row.check_out,
        total_zones: totalZones,
        open_zones_count: 0,
        close_zones_count: 0,
        discrepancy_items_count: 0,
        discrepancy_total_abs: 0,
        unresolved_discrepancy_count: 0,
        status: "PARTIAL",
        last_snapshot_at: null,
      });
    }

    const zoneMap = new Map<number, ShiftZoneOverviewZone>();
    for (const warehouse of warehouses) {
      const zoneKey =
        normalizeShiftZoneKey(warehouse.shift_zone_key) || "BACKROOM";
      zoneMap.set(Number(warehouse.id), {
        warehouse_id: Number(warehouse.id),
        warehouse_name: warehouse.name,
        shift_zone_key: zoneKey,
        shift_zone_label: getShiftZoneLabel(zoneKey),
        open_snapshots_count: 0,
        close_snapshots_count: 0,
        discrepancy_shifts_count: 0,
        discrepancy_items_count: 0,
        discrepancy_total_abs: 0,
        latest_open_at: null,
        latest_close_at: null,
      });
    }

    const shiftOpenZones = new Map<string, Set<number>>();
    const shiftCloseZones = new Map<string, Set<number>>();

    for (const row of snapshotsRes.rows) {
      const shiftId = String(row.shift_id);
      const warehouseId = Number(row.warehouse_id);
      const shiftEntry = shiftMap.get(shiftId);
      const zoneEntry = zoneMap.get(warehouseId);
      if (!shiftEntry || !zoneEntry) continue;

      const createdAt = row.created_at
        ? new Date(row.created_at).toISOString()
        : null;
      shiftEntry.last_snapshot_at =
        shiftEntry.last_snapshot_at && createdAt
          ? new Date(shiftEntry.last_snapshot_at).getTime() >
            new Date(createdAt).getTime()
            ? shiftEntry.last_snapshot_at
            : createdAt
          : shiftEntry.last_snapshot_at || createdAt;

      if (row.snapshot_type === "OPEN") {
        if (!shiftOpenZones.has(shiftId))
          shiftOpenZones.set(shiftId, new Set<number>());
        shiftOpenZones.get(shiftId)!.add(warehouseId);
        zoneEntry.open_snapshots_count += 1;
        if (
          !zoneEntry.latest_open_at ||
          (createdAt &&
            new Date(createdAt).getTime() >
              new Date(zoneEntry.latest_open_at).getTime())
        ) {
          zoneEntry.latest_open_at = createdAt;
        }
      }

      if (row.snapshot_type === "CLOSE") {
        if (!shiftCloseZones.has(shiftId))
          shiftCloseZones.set(shiftId, new Set<number>());
        shiftCloseZones.get(shiftId)!.add(warehouseId);
        zoneEntry.close_snapshots_count += 1;
        if (
          !zoneEntry.latest_close_at ||
          (createdAt &&
            new Date(createdAt).getTime() >
              new Date(zoneEntry.latest_close_at).getTime())
        ) {
          zoneEntry.latest_close_at = createdAt;
        }
      }
    }

    let discrepancyShiftsCount = 0;
    let discrepancyTotalAbs = 0;

    for (const shiftId of shiftIds) {
      const shiftEntry = shiftMap.get(shiftId);
      if (!shiftEntry) continue;

      shiftEntry.open_zones_count = shiftOpenZones.get(shiftId)?.size || 0;
      shiftEntry.close_zones_count = shiftCloseZones.get(shiftId)?.size || 0;

      if (
        shiftEntry.open_zones_count >= totalZones &&
        shiftEntry.close_zones_count >= totalZones
      ) {
        shiftEntry.status = "COMPLETE";
      } else if (
        shiftEntry.open_zones_count >= totalZones &&
        shiftEntry.close_zones_count === 0
      ) {
        shiftEntry.status = "OPEN_ONLY";
      } else if (
        shiftEntry.close_zones_count > 0 &&
        shiftEntry.open_zones_count === 0
      ) {
        shiftEntry.status = "CLOSE_ONLY";
      } else {
        shiftEntry.status = "PARTIAL";
      }

      const discrepancyRows = await getShiftZoneDiscrepancyReportInternal(
        client,
        clubId,
        shiftId,
        sessionUserId,
      );
      const discrepancyItemsCount = discrepancyRows.length;
      const discrepancyAbs = discrepancyRows.reduce(
        (sum, row) => sum + Math.abs(Number(row.difference_quantity || 0)),
        0,
      );

      const resolutionsRes = await client.query(
        `SELECT product_id, warehouse_id FROM shift_zone_discrepancy_resolutions WHERE shift_id = $1`,
        [shiftId],
      );
      const resolvedKeys = new Set<string>();
      for (const res of resolutionsRes.rows) {
        resolvedKeys.add(`${res.warehouse_id}:${res.product_id}`);
      }
      const unresolvedCount = discrepancyRows.filter((row) => {
        const diff = Number(row.difference_quantity || 0);
        if (diff > 0) return false;
        const key = `${row.warehouse_id}:${row.product_id}`;
        return !resolvedKeys.has(key);
      }).length;

      shiftEntry.discrepancy_items_count = discrepancyItemsCount;
      shiftEntry.discrepancy_total_abs = discrepancyAbs;
      shiftEntry.unresolved_discrepancy_count = unresolvedCount;

      if (discrepancyItemsCount > 0) {
        discrepancyShiftsCount += 1;
        discrepancyTotalAbs += discrepancyAbs;
      }

      const discrepancyWarehouses = new Set<number>();
      for (const row of discrepancyRows) {
        const zoneEntry =
          zoneMap.get(Number(row.warehouse_id)) ||
          warehouseById.get(Number(row.warehouse_id));
        if (!zoneEntry || !("discrepancy_items_count" in zoneEntry)) continue;
        zoneEntry.discrepancy_items_count += 1;
        zoneEntry.discrepancy_total_abs += Math.abs(
          Number(row.difference_quantity || 0),
        );
        discrepancyWarehouses.add(Number(row.warehouse_id));
      }
      for (const warehouseId of discrepancyWarehouses) {
        const zoneEntry = zoneMap.get(warehouseId);
        if (zoneEntry) {
          zoneEntry.discrepancy_shifts_count += 1;
        }
      }
    }

    const recent_shifts = Array.from(shiftMap.values()).sort(
      (a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime(),
    );
    const zones = Array.from(zoneMap.values()).sort((a, b) =>
      a.warehouse_name.localeCompare(b.warehouse_name, "ru"),
    );

    return {
      summary: {
        recent_shifts_count: recent_shifts.length,
        configured_zones_count: totalZones,
        complete_shifts_count: recent_shifts.filter(
          (shift) => shift.status === "COMPLETE",
        ).length,
        discrepancy_shifts_count: discrepancyShiftsCount,
        discrepancy_total_abs: discrepancyTotalAbs,
      },
      recent_shifts,
      zones,
    } satisfies ShiftZoneOverview;
  } finally {
    client.release();
  }
}

export async function getEmployees(clubId: string) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT u.id, u.full_name, COALESCE(ce.role, 'Сотрудник') as role
        FROM club_employees ce
        JOIN users u ON ce.user_id = u.id
        WHERE ce.club_id = $1 AND ce.is_active = true
        ORDER BY u.full_name
    `,
    [clubId],
  );
  return res.rows as { id: string; full_name: string; role: string }[];
}

export async function findAcceptedFromShift(
  client: any,
  clubId: string,
  currentShiftId: string,
  currentShiftUserId: string | null,
  referenceTime: string,
  selectedShiftId: string | null,
) {
  const selectedShiftRes = selectedShiftId
    ? await client.query(
        `
            SELECT id, user_id
            FROM shifts
            WHERE club_id = $1
              AND id = $2
              AND id <> $3
              AND check_out IS NOT NULL
              AND check_out <= $4
            LIMIT 1
            `,
        [clubId, selectedShiftId, currentShiftId, referenceTime],
      )
    : { rows: [] };

  const selectedShift = selectedShiftRes.rows[0] || null;
  const selectedShiftUserId = selectedShift?.user_id
    ? String(selectedShift.user_id)
    : null;
  if (
    selectedShift &&
    (!currentShiftUserId || selectedShiftUserId !== currentShiftUserId)
  ) {
    return {
      accepted_from_shift_id: String(selectedShift.id),
      accepted_from_employee_id: selectedShiftUserId,
    };
  }

  const preferredPreviousShiftRes = await client.query(
    `
        SELECT id, user_id
        FROM shifts
        WHERE club_id = $1
          AND id <> $2
          AND check_out IS NOT NULL
          AND check_out <= $3
          AND ($4::text IS NULL OR user_id::text <> $4::text)
        ORDER BY check_out DESC, check_in DESC, id DESC
        LIMIT 1
        `,
    [clubId, currentShiftId, referenceTime, currentShiftUserId],
  );

  const previousShift = preferredPreviousShiftRes.rows[0] || selectedShift;
  if (!previousShift) {
    return {
      accepted_from_shift_id: null as string | null,
      accepted_from_employee_id: null as string | null,
    };
  }

  return {
    accepted_from_shift_id: String(previousShift.id),
    accepted_from_employee_id: previousShift.user_id
      ? String(previousShift.user_id)
      : null,
  };
}

export async function ensurePreviousShiftClosureCompleted(
  client: any,
  clubId: string,
  currentShiftId: string,
  currentShiftCheckIn: string,
) {
  const blockingShiftRes = await client.query(
    `
        SELECT
            s.id,
            s.user_id,
            s.check_in,
            u.full_name
        FROM shifts s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.club_id = $1
          AND s.id <> $2
          AND s.check_out IS NULL
          AND s.check_in <= $3
        ORDER BY s.check_in DESC, s.id DESC
        LIMIT 1
        `,
    [clubId, currentShiftId, currentShiftCheckIn],
  );

  const blockingShift = blockingShiftRes.rows[0];
  if (!blockingShift) return;

  const employeeName = blockingShift.full_name || "предыдущего сотрудника";
  throw new Error(
    `Нельзя начать приемку остатков, пока не завершено закрытие предыдущей смены (${employeeName}). Сначала закройте прошлую смену, затем начните приемку.`,
  );
}

export async function getActiveShiftsForClub(clubId: string) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT id, check_in, check_out,
               (SELECT full_name FROM users WHERE id = user_id) as employee_name
        FROM shifts
        WHERE club_id = $1
        ORDER BY check_in DESC
        LIMIT 20
    `,
    [clubId],
  );
  return res.rows;
}

export async function getShiftZoneSnapshotDraftSafe(
  clubId: string,
  shiftId: string,
  snapshotType: ShiftZoneSnapshotType,
) {
  try {
    const data = await getShiftZoneSnapshotDraft(clubId, shiftId, snapshotType);
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(
        error,
        "Не удалось загрузить приемку/сдачу остатков",
      ),
    };
  }
}

export async function getHandoverSourceCandidatesSafe(
  clubId: string,
  shiftId: string,
) {
  try {
    const data = await getHandoverSourceCandidates(clubId, shiftId);
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(
        error,
        "Не удалось загрузить список смен для передачи",
      ),
    };
  }
}

export async function saveShiftZoneSnapshotSafe(
  clubId: string,
  shiftId: string,
  snapshotType: ShiftZoneSnapshotType,
  payload: Array<{
    warehouse_id: number;
    items: Array<{ product_id: number; counted_quantity: number }>;
  }>,
  options?: { accepted_from_shift_id?: string | null },
) {
  try {
    const data = await saveShiftZoneSnapshot(
      clubId,
      shiftId,
      snapshotType,
      payload,
      options,
    );
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: getActionErrorMessage(
        error,
        "Не удалось сохранить приемку или сдачу остатков",
      ),
    };
  }
}