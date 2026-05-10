"use server";

import { query, getClient } from "@/db";
import {
  getShiftZoneSnapshotDraft,
  getHandoverSourceCandidates,
  type ShiftZoneSnapshotType,
  type HandoverSourceCandidate,
  type ShiftZoneSnapshotDraftItem,
} from "./actions";

import {
  normalizeInventorySettings,
  getShiftZoneLabel,
} from "@/lib/inventory-settings";

/**
 * Validates that the shift exists and belongs to the specified club.
 * Used for public terminal access where we don't have a user session.
 */
async function getShiftForTerminal(clubId: string, shiftId: string) {
  const res = await query(
    `SELECT id, club_id, user_id, check_in, check_out, status FROM shifts WHERE id = $1 AND club_id = $2`,
    [shiftId, clubId],
  );
  if (res.rowCount === 0) {
    throw new Error("Смена не найдена или не принадлежит этому клубу");
  }
  return res.rows[0];
}

/**
 * Internal helper to resolve warehouses allowed for shift accountability.
 */
async function getShiftAccountabilityWarehousesInternalTerminal(
  client: any,
  clubId: string,
) {
  // 1. Get Inventory Settings
  const settingsRes = await client.query(
    `SELECT inventory_settings FROM clubs WHERE id = $1 LIMIT 1`,
    [clubId],
  );
  const inventorySettings = normalizeInventorySettings(
    settingsRes.rows[0]?.inventory_settings,
  );

  if (inventorySettings.shift_accountability_mode !== "WAREHOUSE") {
    return [];
  }

  // 2. Resolve warehouse IDs
  const configuredWarehouseIds = Array.isArray(
    inventorySettings.handover_warehouse_ids,
  )
    ? inventorySettings.handover_warehouse_ids
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];

  let warehouses: any[] = [];

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
    warehouses = configuredRes.rows;
  } else {
    // Fallback to all enabled
    const res = await client.query(
      `
              SELECT w.*
              FROM warehouses w
              WHERE w.club_id = $1
                AND w.is_active = true
                AND w.shift_accountability_enabled = true
              ORDER BY w.name
              `,
      [clubId],
    );
    warehouses = res.rows;
  }

  return warehouses.map((row: any) => ({
    ...row,
    shift_accountability_enabled: true,
    shift_zone_key: row.shift_zone_key || "BAR",
    shift_zone_label: getShiftZoneLabel(row.shift_zone_key || "BAR"),
  }));
}

export async function getShiftAccountabilityWarehousesTerminal(
  clubId: string,
  shiftId: string,
) {
  try {
    await getShiftForTerminal(clubId, shiftId);

    const client = await getClient();
    try {
      const data = await getShiftAccountabilityWarehousesInternalTerminal(
        client,
        clubId,
      );
      return { ok: true as const, data };
    } finally {
      client.release();
    }
  } catch (error: any) {
    return {
      ok: false as const,
      error: error.message || "Не удалось загрузить склады",
    };
  }
}

export async function getShiftZoneSnapshotDraftTerminal(
  clubId: string,
  shiftId: string,
  snapshotType: ShiftZoneSnapshotType,
) {
  try {
    const shift = await getShiftForTerminal(clubId, shiftId);
    const client = await getClient();
    try {
      const warehouses = await getShiftAccountabilityWarehousesInternalTerminal(
        client,
        clubId,
      );
      if (warehouses.length === 0)
        return { ok: true as const, data: [] as ShiftZoneSnapshotDraftItem[] };

      const shiftWindowEnd = shift.check_out || new Date().toISOString();
      const result: ShiftZoneSnapshotDraftItem[] = [];

      for (const warehouse of warehouses) {
        const rows = await client.query(
          `
                WITH relevant_products AS (
                    SELECT sii.product_id
                    FROM shift_zone_snapshot_items sii
                    JOIN shift_zone_snapshots ss ON ss.id = sii.snapshot_id
                    WHERE ss.shift_id = $1
                      AND ss.warehouse_id = $2
                      AND ss.snapshot_type IN ('OPEN', $3)

                    UNION

                    SELECT product_id
                    FROM warehouse_stock
                    WHERE warehouse_id = $2
                      AND quantity <> 0

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
                    c.name as category_name,
                    p.barcode,
                    p.barcodes,
                    COALESCE(ws.quantity, 0) as system_quantity,
                    sii.counted_quantity as saved_counted_quantity,
                    COALESCE(sii.counted_quantity, COALESCE(ws.quantity, 0)) as counted_quantity,
                    COALESCE(p.selling_price, 0) as selling_price
                FROM relevant_products rp
                JOIN warehouse_products p ON p.id = rp.product_id AND p.club_id = $4
                LEFT JOIN warehouse_categories c ON c.id = p.category_id
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
            category_name: row.category_name,
            barcode: row.barcode,
            barcodes: row.barcodes,
            counted_quantity:
              row.counted_quantity === null ||
              row.counted_quantity === undefined
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

      return { ok: true as const, data: result };
    } finally {
      client.release();
    }
  } catch (error: any) {
    return {
      ok: false as const,
      error: error.message || "Не удалось загрузить черновик",
    };
  }
}

export async function getHandoverSourceCandidatesTerminal(
  clubId: string,
  shiftId: string,
) {
  try {
    const shift = await getShiftForTerminal(clubId, shiftId);
    const client = await getClient();
    try {
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
              s.shift_type,
              CASE
                  WHEN $4::text IS NOT NULL AND s.user_id::text = $4::text THEN true
                  ELSE false
              END as is_self_handover,
              EXISTS (
                  SELECT 1 FROM shift_zone_snapshots szs
                  WHERE szs.shift_id = s.id AND szs.snapshot_type = 'CLOSE'
              ) as is_counting_finished
          FROM shifts s
          LEFT JOIN users u ON u.id = s.user_id
          WHERE s.club_id = $1
            AND s.id <> $2
            AND s.check_out IS NOT NULL
            AND s.check_out <= $3
          ORDER BY
              s.check_out DESC,
              s.check_in DESC,
              s.id DESC
          LIMIT 4
          `,
        [clubId, shiftId, referenceTime, currentShiftUserId],
      );

      const data = res.rows.map((row: any) => ({
        shift_id: String(row.shift_id),
        employee_id: row.employee_id ? String(row.employee_id) : null,
        employee_name: String(row.employee_name || "Неизвестный сотрудник"),
        check_in: String(row.check_in),
        check_out: String(row.check_out),
        shift_type: row.shift_type,
        is_self_handover: Boolean(row.is_self_handover),
        is_counting_finished: Boolean(row.is_counting_finished),
      }));

      return { ok: true as const, data };
    } finally {
      client.release();
    }
  } catch (error: any) {
    return {
      ok: false as const,
      error: error.message || "Не удалось загрузить список смен",
    };
  }
}

export async function getProductByBarcodeTerminal(
  clubId: string,
  barcode: string,
) {
  try {
    const client = await getClient();
    try {
      const res = await client.query(
        `SELECT p.id, p.name, p.barcode, p.barcodes, p.selling_price
         FROM warehouse_products p
         WHERE p.club_id = $1 AND (p.barcode = $2 OR $2 = ANY(p.barcodes))
         AND p.deleted_at IS NULL AND p.is_active = true
         LIMIT 1`,
        [clubId, barcode],
      );
      if (res.rowCount === 0) return { ok: true as const, data: null };
      return { ok: true as const, data: res.rows[0] };
    } finally {
      client.release();
    }
  } catch (error: any) {
    return { ok: false as const, error: error.message };
  }
}

export async function getProductsTerminal(clubId: string) {
  try {
    const client = await getClient();
    try {
      const res = await client.query(
        `SELECT p.id, p.name, p.barcode, p.barcodes, p.selling_price
         FROM warehouse_products p
         WHERE p.club_id = $1 AND p.deleted_at IS NULL AND p.is_active = true
         ORDER BY p.name ASC`,
        [clubId],
      );
      return { ok: true as const, data: res.rows };
    } finally {
      client.release();
    }
  } catch (error: any) {
    return { ok: false as const, error: error.message };
  }
}

export async function saveShiftZoneSnapshotTerminal(
  clubId: string,
  shiftId: string,
  snapshotType: ShiftZoneSnapshotType,
  payload: Array<{
    warehouse_id: number;
    items: Array<{
      product_id: number;
      counted_quantity: number;
      system_quantity: number;
    }>;
  }>,
  options?: { accepted_from_shift_id?: string | null },
) {
  try {
    const shift = await getShiftForTerminal(clubId, shiftId);
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const warehouses = await getShiftAccountabilityWarehousesInternalTerminal(
        client,
        clubId,
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
              system_quantity: Number(item.system_quantity || 0),
            }))
            .filter(
              (item) =>
                Number.isInteger(item.product_id) && item.product_id > 0,
            ),
        }))
        .filter((warehouse) => allowedWarehouseIds.has(warehouse.warehouse_id));

      if (normalizedPayload.length === 0) {
        throw new Error("Нет зон для сохранения приемки/сдачи");
      }

      const snapshotReferenceTime = new Date().toISOString();

      for (const zone of normalizedPayload) {
        // Create or update snapshot
        const snapRes = await client.query(
          `INSERT INTO shift_zone_snapshots
               (club_id, shift_id, warehouse_id, snapshot_type, created_at, employee_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (shift_id, warehouse_id, snapshot_type)
               DO UPDATE SET created_at = EXCLUDED.created_at
               RETURNING id`,
          [
            clubId,
            shiftId,
            zone.warehouse_id,
            snapshotType,
            snapshotReferenceTime,
            shift.user_id,
          ],
        );
        const snapshotId = snapRes.rows[0].id;

        // Remove old items for this snapshot to prevent duplicates
        await client.query(
          `DELETE FROM shift_zone_snapshot_items WHERE snapshot_id = $1`,
          [snapshotId],
        );

        for (const item of zone.items) {
          await client.query(
            `INSERT INTO shift_zone_snapshot_items (snapshot_id, product_id, counted_quantity, system_quantity)
                   VALUES ($1, $2, $3, $4)`,
            [
              snapshotId,
              item.product_id,
              item.counted_quantity,
              item.system_quantity,
            ],
          );
        }
      }

      if (snapshotType === "OPEN" && options?.accepted_from_shift_id) {
        await client.query(
          `UPDATE shift_zone_snapshots SET accepted_from_shift_id = $1
           WHERE shift_id = $2 AND club_id = $3 AND snapshot_type = 'OPEN'`,
          [options.accepted_from_shift_id, shiftId, clubId],
        );
      }

      await client.query("COMMIT");
      return { ok: true as const };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    return { ok: false as const, error: error.message || "Ошибка сохранения" };
  }
}
