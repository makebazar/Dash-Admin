"use server";

import { hasColumn } from "@/lib/db-compat";
import { query, getClient } from "@/db";
import { resolveEquipmentStateForPersistence } from "@/lib/equipment-status";
import { revalidatePath } from "next/cache";
import type { ProcurementCandidate, ProcurementMode, ReplenishmentRule } from "./types";
import { applyWarehouseStockDelta, logStockMovement } from "./stock";
import { assertUserCanAccessClub, requireClubAccess } from "./auth";
import { calculateAnalytics } from "./analytics";

export async function getReplenishmentRulesForProduct(
  clubId: string,
  productId: number,
) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT r.*,
               sw.name as source_warehouse_name,
               tw.name as target_warehouse_name
        FROM warehouse_replenishment_rules r
        JOIN warehouses sw ON r.source_warehouse_id = sw.id
        JOIN warehouses tw ON r.target_warehouse_id = tw.id
        WHERE r.product_id = $2
          AND sw.club_id = $1
          AND tw.club_id = $1
    `,
    [clubId, productId],
  );
  return res.rows as ReplenishmentRule[];
}

// --- REPLENISHMENT RULES ---

export async function getReplenishmentRules(clubId: string) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT r.*,
               sw.name as source_warehouse_name,
               tw.name as target_warehouse_name,
               p.name as product_name
        FROM warehouse_replenishment_rules r
        JOIN warehouses sw ON r.source_warehouse_id = sw.id
        JOIN warehouses tw ON r.target_warehouse_id = tw.id
        JOIN warehouse_products p ON r.product_id = p.id
        WHERE sw.club_id = $1
    `,
    [clubId],
  );
  return res.rows;
}

export async function createReplenishmentRule(
  clubId: string,
  data: {
    source_warehouse_id: number;
    target_warehouse_id: number;
    product_id: number;
    min_stock_level: number;
    max_stock_level: number;
  },
) {
  await requireClubAccess(clubId);
  const checks = await query(
    `
        SELECT
          (SELECT 1 FROM warehouses WHERE id = $2 AND club_id = $1) as source_ok,
          (SELECT 1 FROM warehouses WHERE id = $3 AND club_id = $1) as target_ok,
          (SELECT 1 FROM warehouse_products WHERE id = $4 AND club_id = $1) as product_ok
        `,
    [
      clubId,
      data.source_warehouse_id,
      data.target_warehouse_id,
      data.product_id,
    ],
  );
  const row = checks.rows[0] || {};
  if (!row.source_ok || !row.target_ok)
    throw new Error("Склад не найден или не принадлежит клубу");
  if (!row.product_ok)
    throw new Error("Товар не найден или не принадлежит клубу");

  await query(
    `
        INSERT INTO warehouse_replenishment_rules (source_warehouse_id, target_warehouse_id, product_id, min_stock_level, max_stock_level)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (source_warehouse_id, target_warehouse_id, product_id)
        DO UPDATE SET min_stock_level = $4, max_stock_level = $5, is_active = true
    `,
    [
      data.source_warehouse_id,
      data.target_warehouse_id,
      data.product_id,
      data.min_stock_level,
      data.max_stock_level,
    ],
  );

  // Check if task needed immediately
  await checkReplenishmentNeeds(clubId);

  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function deleteReplenishmentRule(id: number, clubId: string) {
  await requireClubAccess(clubId);
  await query(
    `
        DELETE FROM warehouse_replenishment_rules r
        USING warehouses sw, warehouses tw
        WHERE r.id = $1
          AND r.source_warehouse_id = sw.id
          AND r.target_warehouse_id = tw.id
          AND sw.club_id = $2
          AND tw.club_id = $2
        `,
    [id, clubId],
  );
  revalidatePath(`/clubs/${clubId}/inventory`);
}

// Check and generate tasks

export async function checkReplenishmentNeeds(clubId: string) {
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    // Find rules where Target Stock <= Min Level
    const needs = await client.query(
      `
            SELECT r.*,
                   COALESCE(ws_target.quantity, 0) as current_target_stock,
                   COALESCE(ws_source.quantity, 0) as current_source_stock,
                   p.name as product_name,
                   tw.name as target_warehouse_name
            FROM warehouse_replenishment_rules r
            JOIN warehouses tw ON r.target_warehouse_id = tw.id
            JOIN warehouses sw ON r.source_warehouse_id = sw.id
            JOIN warehouse_products p ON r.product_id = p.id
            LEFT JOIN warehouse_stock ws_target ON r.target_warehouse_id = ws_target.warehouse_id AND r.product_id = ws_target.product_id
            LEFT JOIN warehouse_stock ws_source ON r.source_warehouse_id = ws_source.warehouse_id AND r.product_id = ws_source.product_id
            WHERE r.is_active = true
              AND tw.club_id = $1
              AND sw.club_id = $1
              AND p.club_id = $1
        `,
      [clubId],
    );

    for (const rule of needs.rows) {
      const current = rule.current_target_stock || 0;
      const source = rule.current_source_stock || 0;

      if (current <= rule.min_stock_level && source > 0) {
        // Need restock
        const amountNeeded = rule.max_stock_level - current;
        if (amountNeeded <= 0) {
          // If current is enough but task exists, close it
          await client.query(
            `
                        UPDATE club_tasks
                        SET status = 'COMPLETED',
                            completed_at = NOW(),
                            description = description || ' (Закрыто автоматически: товара достаточно)'
                        WHERE club_id = $1 AND type = 'RESTOCK' AND related_entity_id = $2 AND status != 'COMPLETED'
                        AND description LIKE $3
                    `,
            [clubId, rule.product_id, `%${rule.target_warehouse_name}%`],
          );
          continue;
        }

        // Check if task exists
        const existing = await client.query(
          `
                    SELECT 1 FROM club_tasks
                    WHERE club_id = $1 AND type = 'RESTOCK' AND related_entity_id = $2 AND status != 'COMPLETED'
                    AND description LIKE $3
                `,
          [clubId, rule.product_id, `%${rule.target_warehouse_name}%`],
        );

        if (existing.rowCount === 0) {
          await client.query(
            `
                        INSERT INTO club_tasks (club_id, type, title, description, priority, related_entity_type, related_entity_id)
                        VALUES ($1, 'RESTOCK', $2, $3, 'HIGH', 'PRODUCT', $4)
                    `,
            [
              clubId,
              `Пополнить: ${rule.product_name}`,
              `Из: ${rule.source_warehouse_name} → В: ${rule.target_warehouse_name}. Пополнить до ${rule.max_stock_level} шт. (Сейчас: ${current})`,
              rule.product_id,
            ],
          );
        }
      } else if (current > rule.min_stock_level) {
        // If stock is already above min level, any existing restock task for this product/target should be closed
        await client.query(
          `
                    UPDATE club_tasks
                    SET status = 'COMPLETED',
                        completed_at = NOW(),
                        description = description || ' (Закрыто автоматически: товара достаточно)'
                    WHERE club_id = $1 AND type = 'RESTOCK' AND related_entity_id = $2 AND status != 'COMPLETED'
                    AND description LIKE $3
                `,
          [clubId, rule.product_id, `%${rule.target_warehouse_name}%`],
        );
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Error checking replenishment:", e);
  } finally {
    client.release();
  }
}

// Override completeTask to handle warehouse transfers

export async function completeTask(
  taskId: number,
  userId: string,
  clubId: string,
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    const taskRes = await client.query(
      "SELECT * FROM club_tasks WHERE id = $1 AND club_id = $2",
      [taskId, clubId],
    );
    const task = taskRes.rows[0];
    if (!task) throw new Error("Задача не найдена");

    if (task.type === "RESTOCK" && task.related_entity_type === "PRODUCT") {
      const productId = task.related_entity_id;

      const targetWarehouseNameMatch = String(task.description || "").match(
        /→ В: (.+?)\./,
      );
      const sourceWarehouseNameMatch = String(task.description || "").match(
        /Из: (.+?) →/,
      );
      const targetWarehouseName = targetWarehouseNameMatch?.[1]?.trim() || null;
      const sourceWarehouseName = sourceWarehouseNameMatch?.[1]?.trim() || null;

      const rules = await client.query(
        `
                SELECT
                    r.*,
                    tw.name as target_warehouse_name,
                    sw.name as source_warehouse_name,
                    COALESCE(ws_target.quantity, 0) as current_target_stock,
                    COALESCE(ws_source.quantity, 0) as current_source_stock
                FROM warehouse_replenishment_rules r
                LEFT JOIN warehouse_stock ws_target ON r.target_warehouse_id = ws_target.warehouse_id AND r.product_id = ws_target.product_id
                LEFT JOIN warehouse_stock ws_source ON r.source_warehouse_id = ws_source.warehouse_id AND r.product_id = ws_source.product_id
                JOIN warehouses tw ON r.target_warehouse_id = tw.id
                JOIN warehouses sw ON r.source_warehouse_id = sw.id
                WHERE r.product_id = $1 AND r.is_active = true
                  AND tw.club_id = $2 AND sw.club_id = $2
            `,
        [productId, clubId],
      );

      const matchedRule =
        rules.rows.find((rule) => {
          const targetMatches = targetWarehouseName
            ? String(rule.target_warehouse_name || "").trim() ===
              targetWarehouseName
            : true;
          const sourceMatches = sourceWarehouseName
            ? String(rule.source_warehouse_name || "").trim() ===
              sourceWarehouseName
            : true;
          return targetMatches && sourceMatches;
        }) || rules.rows[0];

      if (matchedRule) {
        const current = Number(matchedRule.current_target_stock || 0);
        if (current <= Number(matchedRule.min_stock_level || 0)) {
          const amountNeeded = Math.max(
            0,
            Number(matchedRule.max_stock_level || 0) - current,
          );

          const sourceRes = await client.query(
            "SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE",
            [matchedRule.source_warehouse_id, productId],
          );
          const sourceStock = Number(sourceRes.rows[0]?.quantity || 0);
          const transferAmount = Math.min(amountNeeded, sourceStock);

          if (transferAmount > 0) {
            const { previousStock: sourcePrev, newStock: sourceNew } =
              await applyWarehouseStockDelta(
                client,
                matchedRule.source_warehouse_id,
                productId,
                -transferAmount,
              );
            const { previousStock: targetPrev, newStock: targetNew } =
              await applyWarehouseStockDelta(
                client,
                matchedRule.target_warehouse_id,
                productId,
                transferAmount,
              );

            await logStockMovement(
              client,
              clubId,
              userId,
              productId,
              -transferAmount,
              sourcePrev,
              sourceNew,
              "INTERNAL_MOVE",
              `To ${matchedRule.target_warehouse_id}`,
              "WAREHOUSE",
              matchedRule.source_warehouse_id,
              null,
              matchedRule.source_warehouse_id,
            );
            await logStockMovement(
              client,
              clubId,
              userId,
              productId,
              transferAmount,
              targetPrev,
              targetNew,
              "INTERNAL_MOVE",
              `From ${matchedRule.source_warehouse_id}`,
              "WAREHOUSE",
              matchedRule.target_warehouse_id,
              null,
              matchedRule.target_warehouse_id,
            );
          }
        }
      }
    } else if (
      task.type === "EQUIPMENT_TRANSFER" &&
      task.related_entity_type === "EQUIPMENT_TRANSFER"
    ) {
      const transferId = task.related_entity_uuid;
      if (!transferId) throw new Error("Некорректная задача: нет transfer_id");

      const shiftRes = await client.query(
        `SELECT id
                 FROM shifts
                 WHERE user_id = $1 AND club_id = $2 AND check_out IS NULL
                 ORDER BY check_in DESC NULLS LAST
                 LIMIT 1`,
        [userId, clubId],
      );
      const activeShiftId = shiftRes.rows[0]?.id;
      if (!activeShiftId)
        throw new Error("Для выполнения задачи нужна активная смена");

      const transferRes = await client.query(
        `SELECT *
                 FROM equipment_transfers
                 WHERE id = $1
                 FOR UPDATE`,
        [transferId],
      );
      const transfer = transferRes.rows[0];
      if (!transfer) throw new Error("Перемещение не найдено");
      if (String(transfer.target_club_id) !== String(clubId))
        throw new Error("Перемещение относится к другому клубу");
      if (transfer.status === "COMPLETED")
        throw new Error("Перемещение уже выполнено");

      const itemsRes = await client.query(
        `SELECT equipment_id, target_workstation_id
                 FROM equipment_transfer_items
                 WHERE transfer_id = $1`,
        [transferId],
      );
      const items = itemsRes.rows;
      if (items.length === 0) throw new Error("В перемещении нет позиций");

      const workstationIds = Array.from(
        new Set(
          items
            .map((i: any) => i.target_workstation_id)
            .filter(Boolean)
            .map((v: any) => String(v)),
        ),
      );
      const workstationMap = new Map<string, string | null>();
      if (workstationIds.length > 0) {
        const wsRes = await client.query(
          `SELECT id::text as id, assigned_user_id
                     FROM club_workstations
                     WHERE club_id = $1 AND id = ANY($2::uuid[])`,
          [clubId, workstationIds],
        );
        if (wsRes.rows.length !== workstationIds.length)
          throw new Error("Некорректные места назначения");
        for (const ws of wsRes.rows) {
          workstationMap.set(
            String(ws.id),
            ws.assigned_user_id ? String(ws.assigned_user_id) : null,
          );
        }
      }

      const equipmentIds = items.map((i: any) => String(i.equipment_id));
      const hasEquipmentStatusColumn = await hasColumn("equipment", "status");
      const eqRes = await client.query(
        `SELECT id::text as id, club_id::text as club_id, workstation_id::text as workstation_id, is_active${hasEquipmentStatusColumn ? ", status" : ""}
                 FROM equipment
                 WHERE id = ANY($1::uuid[])
                 FOR UPDATE`,
        [equipmentIds],
      );
      if (eqRes.rows.length !== equipmentIds.length)
        throw new Error("Часть оборудования не найдена");

      for (const eq of eqRes.rows) {
        if (String(eq.club_id) !== String(transfer.source_club_id)) {
          throw new Error(
            "Оборудование уже перемещено или принадлежит другому клубу",
          );
        }
      }

      for (const item of items) {
        const equipmentId = String(item.equipment_id);
        const targetWorkstationId = item.target_workstation_id
          ? String(item.target_workstation_id)
          : null;
        const eq = eqRes.rows.find((r: any) => String(r.id) === equipmentId);
        if (!eq) throw new Error("Оборудование не найдено");

        const nextAssignedUserId = targetWorkstationId
          ? (workstationMap.get(targetWorkstationId) ?? null)
          : null;
        const resolvedState = resolveEquipmentStateForPersistence({
          currentStatus: eq.status,
          currentIsActive: eq.is_active,
          currentWorkstationId: eq.workstation_id
            ? String(eq.workstation_id)
            : null,
          requestedWorkstationId: targetWorkstationId,
          hasRequestedWorkstation: true,
        });

        if (hasEquipmentStatusColumn) {
          await client.query(
            `UPDATE equipment
                         SET club_id = $1,
                             workstation_id = $2,
                             assigned_user_id = $3,
                             is_active = $4,
                             status = $5
                         WHERE id = $6`,
            [
              transfer.target_club_id,
              resolvedState.workstation_id,
              nextAssignedUserId,
              resolvedState.is_active,
              resolvedState.status,
              equipmentId,
            ],
          );
        } else {
          await client.query(
            `UPDATE equipment
                         SET club_id = $1,
                             workstation_id = $2,
                             assigned_user_id = $3,
                             is_active = $4
                         WHERE id = $5`,
            [
              transfer.target_club_id,
              resolvedState.workstation_id,
              nextAssignedUserId,
              resolvedState.is_active,
              equipmentId,
            ],
          );
        }
      }

      await client.query(
        `UPDATE equipment_transfers
                 SET status = 'COMPLETED',
                     completed_by = $1,
                     completed_at = NOW(),
                     completed_shift_id = $2
                 WHERE id = $3`,
        [userId, activeShiftId, transferId],
      );

      await client.query(
        `UPDATE club_tasks
                 SET status = 'COMPLETED',
                     completed_by = $1,
                     completed_at = NOW(),
                     completed_shift_id = $2
                 WHERE id = $3`,
        [userId, activeShiftId, taskId],
      );

      await client.query("COMMIT");
      revalidatePath(`/clubs/${clubId}`);
      return;
    }

    await client.query(
      `
            UPDATE club_tasks
            SET status = 'COMPLETED', completed_by = $1, completed_at = NOW()
            WHERE id = $2
            `,
      [userId, taskId],
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/clubs/${clubId}`);
}

// --- ANALYTICS & PROCUREMENT ---

export async function generateProcurementList(
  clubId: string,
  userId: string,
  mode: ProcurementMode = "optimized",
) {
  await assertUserCanAccessClub(clubId, userId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    // 1. Update Analytics first to have fresh data
    await calculateAnalytics(clubId);

    // 2. Create Draft List
    const listRes = await client.query(
      `
            INSERT INTO warehouse_procurement_lists (club_id, created_by, status, name)
            VALUES (
                $1,
                $2,
                'DRAFT',
                CASE
                    WHEN $3 = 'full' THEN 'Полное пополнение ' || TO_CHAR(NOW(), 'DD.MM.YYYY')
                    ELSE 'Оптимизированная закупка ' || TO_CHAR(NOW(), 'DD.MM.YYYY')
                END
            )
            RETURNING id
        `,
      [clubId, userId, mode],
    );
    const listId = listRes.rows[0].id;

    const products = await client.query(
      `
            SELECT
                id, name, current_stock, min_stock_level, sales_velocity, ideal_stock_days, abc_category, units_per_box
            FROM warehouse_products
            WHERE club_id = $1 AND is_active = true
        `,
      [clubId],
    );

    const procurementCandidates = products.rows
      .map((product) => ({
        product,
        candidate: getProcurementCandidate(product, mode),
      }))
      .filter(
        (entry): entry is { product: any; candidate: ProcurementCandidate } =>
          Boolean(entry.candidate),
      )
      .sort((a, b) => {
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
        const priorityDiff =
          priorityOrder[a.candidate.priority] -
          priorityOrder[b.candidate.priority];
        if (priorityDiff !== 0) return priorityDiff;

        const abcOrder = { A: 0, B: 1, C: 2 };
        const abcDiff =
          (abcOrder[
            String(a.product.abc_category || "C") as keyof typeof abcOrder
          ] ?? 2) -
          (abcOrder[
            String(b.product.abc_category || "C") as keyof typeof abcOrder
          ] ?? 2);
        if (abcDiff !== 0) return abcDiff;

        const aDays = a.candidate.days_left ?? Number.POSITIVE_INFINITY;
        const bDays = b.candidate.days_left ?? Number.POSITIVE_INFINITY;
        if (aDays !== bDays) return aDays - bDays;

        return String(a.product.name).localeCompare(String(b.product.name));
      });

    for (const { product: p } of procurementCandidates) {
      const boxSize = normalizeProcurementBoxSize(p.units_per_box);
      const suggested = calculateSuggestedProcurementQuantity(p, mode);
      if (suggested <= 0) continue;

      await client.query(
        `
                INSERT INTO warehouse_procurement_items (list_id, product_id, current_stock, suggested_quantity, actual_quantity, units_per_box)
                VALUES ($1, $2, $3, $4, $5, $6)
            `,
        [listId, p.id, p.current_stock, suggested, suggested, boxSize],
      );
    }

    await client.query("COMMIT");
    revalidatePath(`/clubs/${clubId}/inventory`);
    return listId;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getProcurementLists(clubId: string) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT l.*, u.full_name as creator_name,
               (SELECT COUNT(*) FROM warehouse_procurement_items WHERE list_id = l.id) as items_count
        FROM warehouse_procurement_lists l
        LEFT JOIN users u ON l.created_by = u.id
        WHERE l.club_id = $1
        ORDER BY l.created_at DESC
    `,
    [clubId],
  );
  return res.rows;
}

export async function getProcurementListById(clubId: string, listId: number) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT l.*, u.full_name as creator_name,
               (SELECT COUNT(*) FROM warehouse_procurement_items WHERE list_id = l.id) as items_count
        FROM warehouse_procurement_lists l
        LEFT JOIN users u ON l.created_by = u.id
        WHERE l.club_id = $1 AND l.id = $2
    `,
    [clubId, listId],
  );
  return res.rows[0];
}

export async function getProcurementListItems(clubId: string, listId: number) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT i.*, p.name as product_name, p.cost_price, p.sales_velocity, p.ideal_stock_days, p.abc_category,
               i.units_per_box as units_per_box,
               CASE
                   WHEN p.sales_velocity > 0 THEN p.current_stock / p.sales_velocity
                   ELSE NULL
               END as days_left,
               CASE
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'A' AND (p.current_stock < COALESCE(p.min_stock_level, 0) OR (COALESCE(p.sales_velocity, 0) > 0 AND p.current_stock / p.sales_velocity < 2))
                       THEN 'CRITICAL'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'A'
                       THEN 'HIGH'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') IN ('B', 'C')
                       THEN 'MEDIUM'
                   WHEN COALESCE(p.abc_category, 'C') = 'C' AND p.current_stock <= 0 AND COALESCE(p.sales_velocity, 0) > 0
                       THEN 'CRITICAL'
                   WHEN COALESCE(p.abc_category, 'C') = 'A' AND (p.current_stock < COALESCE(p.min_stock_level, 0) OR (COALESCE(p.sales_velocity, 0) > 0 AND p.current_stock / p.sales_velocity < 2))
                       THEN 'CRITICAL'
                   WHEN COALESCE(p.abc_category, 'C') = 'A'
                       THEN 'HIGH'
                   WHEN COALESCE(p.abc_category, 'C') = 'B' AND (p.current_stock < COALESCE(p.min_stock_level, 0) OR (COALESCE(p.sales_velocity, 0) > 0 AND p.current_stock / p.sales_velocity < 2))
                       THEN 'HIGH'
                   WHEN COALESCE(p.abc_category, 'C') = 'B'
                       THEN 'MEDIUM'
                   ELSE 'MANUAL'
               END as procurement_priority,
               CASE
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'A' AND p.current_stock < COALESCE(p.min_stock_level, 0)
                       THEN 'Полное пополнение: категория A ниже минимального остатка'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'A'
                       THEN 'Полное пополнение: категория A подходит к точке дозаказа'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'B' AND p.current_stock < COALESCE(p.min_stock_level, 0)
                       THEN 'Полное пополнение: категория B ниже минимального остатка'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'B'
                       THEN 'Полное пополнение: категория B подходит к точке дозаказа'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'C'
                       THEN 'Полное пополнение: категория C включена для широкого запаса'
                   WHEN COALESCE(p.abc_category, 'C') = 'C' AND p.current_stock <= 0 AND COALESCE(p.sales_velocity, 0) > 0
                       THEN 'Категория C, но остаток обнулился по продаваемому товару'
                   WHEN COALESCE(p.abc_category, 'C') = 'A' AND p.current_stock < COALESCE(p.min_stock_level, 0)
                       THEN 'Категория A ниже минимального остатка'
                   WHEN COALESCE(p.abc_category, 'C') = 'A'
                       THEN 'Категория A подходит к точке дозаказа'
                   WHEN COALESCE(p.abc_category, 'C') = 'B' AND p.current_stock < COALESCE(p.min_stock_level, 0)
                       THEN 'Категория B ниже минимального остатка'
                   WHEN COALESCE(p.abc_category, 'C') = 'B'
                       THEN 'Категория B подходит к точке дозаказа'
                   ELSE 'Добавлено вручную'
               END as procurement_reason
        FROM warehouse_procurement_items i
        JOIN warehouse_procurement_lists l ON i.list_id = l.id
        JOIN warehouse_products p ON i.product_id = p.id
        WHERE l.club_id = $1 AND i.list_id = $2
        ORDER BY
            CASE
                WHEN COALESCE(p.abc_category, 'C') = 'C' AND p.current_stock <= 0 AND COALESCE(p.sales_velocity, 0) > 0 THEN 0
                WHEN COALESCE(p.abc_category, 'C') = 'A' AND (p.current_stock < COALESCE(p.min_stock_level, 0) OR (COALESCE(p.sales_velocity, 0) > 0 AND p.current_stock / p.sales_velocity < 2)) THEN 1
                WHEN COALESCE(p.abc_category, 'C') = 'A' THEN 2
                WHEN COALESCE(p.abc_category, 'C') = 'B' AND (p.current_stock < COALESCE(p.min_stock_level, 0) OR (COALESCE(p.sales_velocity, 0) > 0 AND p.current_stock / p.sales_velocity < 2)) THEN 3
                WHEN COALESCE(p.abc_category, 'C') = 'B' THEN 4
                ELSE 5
            END,
            p.name
    `,
    [clubId, listId],
  );
  return res.rows;
}

export async function updateProcurementItem(
  itemId: number,
  data: { quantity?: number; units_per_box?: number },
  clubId: string,
) {
  await requireClubAccess(clubId);
  if (data.quantity !== undefined) {
    await query(
      `
            UPDATE warehouse_procurement_items i
            SET actual_quantity = $1
            FROM warehouse_procurement_lists l
            WHERE i.id = $2 AND i.list_id = l.id AND l.club_id = $3
            `,
      [data.quantity, itemId, clubId],
    );
  }
  if (data.units_per_box !== undefined) {
    await query(
      `
            UPDATE warehouse_procurement_items i
            SET units_per_box = $1
            FROM warehouse_procurement_lists l
            WHERE i.id = $2 AND i.list_id = l.id AND l.club_id = $3
            `,
      [data.units_per_box, itemId, clubId],
    );
  }
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function bulkUpdateProcurementItems(
  items: { id: number; quantity: number }[],
  clubId: string,
) {
  await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");
    for (const item of items) {
      await client.query(
        `
                UPDATE warehouse_procurement_items i
                SET actual_quantity = $1
                FROM warehouse_procurement_lists l
                WHERE i.id = $2 AND i.list_id = l.id AND l.club_id = $3
                `,
        [item.quantity, item.id, clubId],
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

export async function deleteProcurementItem(itemId: number, clubId: string) {
  await requireClubAccess(clubId);
  await query(
    `
        DELETE FROM warehouse_procurement_items i
        USING warehouse_procurement_lists l
        WHERE i.id = $1 AND i.list_id = l.id AND l.club_id = $2
        `,
    [itemId, clubId],
  );
  revalidatePath(`/clubs/${clubId}/inventory`);
}

export async function addProductToProcurementList(
  listId: number,
  productId: number,
  clubId: string,
) {
  await requireClubAccess(clubId);
  const client = await import("@/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    // Check if already in list
    const existing = await client.query(
      `
            SELECT i.id
            FROM warehouse_procurement_items i
            JOIN warehouse_procurement_lists l ON i.list_id = l.id
            WHERE i.list_id = $1 AND i.product_id = $2 AND l.club_id = $3
            `,
      [listId, productId, clubId],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error("Товар уже есть в списке");
    }

    // Get product data for initial suggestion
    const productRes = await client.query(
      "SELECT current_stock, sales_velocity, ideal_stock_days, min_stock_level, units_per_box FROM warehouse_products WHERE id = $1 AND club_id = $2",
      [productId, clubId],
    );
    const p = productRes.rows[0];
    if (!p) throw new Error("Товар не найден");

    let suggested = 0;
    const boxSize = normalizeProcurementBoxSize(p.units_per_box);
    suggested = calculateSuggestedProcurementQuantity(p);
    if (suggested <= 0) suggested = boxSize;

    await client.query(
      `
            INSERT INTO warehouse_procurement_items (list_id, product_id, current_stock, suggested_quantity, actual_quantity, units_per_box)
            VALUES ($1, $2, $3, $4, $5, $6)
        `,
      [listId, productId, p.current_stock, suggested, suggested, boxSize],
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

export async function deleteProcurementList(listId: number, clubId: string) {
  await requireClubAccess(clubId);
  await query(
    "DELETE FROM warehouse_procurement_lists WHERE id = $1 AND club_id = $2",
    [listId, clubId],
  );
  revalidatePath(`/clubs/${clubId}/inventory`);
}

// --- HELPER: Stock Movement Logging ---

export async function getClubTasks(clubId: string) {
  await requireClubAccess(clubId);
  const res = await query(
    `
        SELECT
            t.*,
            u.full_name as assignee_name,
            p.name as product_name,
            sw.name as source_warehouse_name,
            tw.name as target_warehouse_name,
            r.source_warehouse_id,
            r.target_warehouse_id,
            r.min_stock_level,
            r.max_stock_level,
            COALESCE(ws_source.quantity, 0) as current_source_stock,
            COALESCE(ws_target.quantity, 0) as current_target_stock,
            LEAST(
                GREATEST(COALESCE(r.max_stock_level, 0) - COALESCE(ws_target.quantity, 0), 0),
                COALESCE(ws_source.quantity, 0)
            ) as suggested_restock_quantity,
            et.source_club_id as transfer_source_club_id,
            et.target_club_id as transfer_target_club_id,
            et.status as transfer_status,
            et.comment as transfer_comment,
            et.created_by as transfer_created_by,
            et.created_at as transfer_created_at,
            et.completed_by as transfer_completed_by,
            et.completed_at as transfer_completed_at,
            sc.name as transfer_source_club_name,
            tc.name as transfer_target_club_name,
            cu.full_name as transfer_created_by_name,
            uu.full_name as transfer_completed_by_name,
            COALESCE(ti.items, '[]'::jsonb) as transfer_items,
            COALESCE(ti.item_count, 0)::int as transfer_item_count
        FROM club_tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN warehouse_products p ON t.related_entity_type = 'PRODUCT' AND t.related_entity_id = p.id
        LEFT JOIN warehouse_replenishment_rules r ON t.type = 'RESTOCK' AND t.related_entity_id = r.product_id AND r.is_active = true
        LEFT JOIN warehouses sw ON r.source_warehouse_id = sw.id
        LEFT JOIN warehouses tw ON r.target_warehouse_id = tw.id
        LEFT JOIN warehouse_stock ws_source ON r.source_warehouse_id = ws_source.warehouse_id AND r.product_id = ws_source.product_id
        LEFT JOIN warehouse_stock ws_target ON r.target_warehouse_id = ws_target.warehouse_id AND r.product_id = ws_target.product_id
        LEFT JOIN equipment_transfers et ON t.type = 'EQUIPMENT_TRANSFER' AND t.related_entity_uuid = et.id
        LEFT JOIN clubs sc ON et.source_club_id = sc.id
        LEFT JOIN clubs tc ON et.target_club_id = tc.id
        LEFT JOIN users cu ON et.created_by = cu.id
        LEFT JOIN users uu ON et.completed_by = uu.id
        LEFT JOIN LATERAL (
            SELECT
                jsonb_agg(
                    jsonb_build_object(
                        'equipment_id', i.equipment_id,
                        'equipment_name', e.name,
                        'equipment_type', e.type,
                        'target_workstation_id', i.target_workstation_id,
                        'target_workstation_name', w.name,
                        'target_workstation_zone', w.zone
                    )
                    ORDER BY e.name
                ) as items,
                COUNT(*)::int as item_count
            FROM equipment_transfer_items i
            JOIN equipment e ON i.equipment_id = e.id
            LEFT JOIN club_workstations w ON i.target_workstation_id = w.id
            WHERE et.id IS NOT NULL AND i.transfer_id = et.id
        ) ti ON TRUE
        WHERE t.club_id = $1 AND t.status != 'COMPLETED'
        ORDER BY t.priority DESC, t.created_at ASC
        `,
    [clubId],
  );
  return res.rows;
}

// --- PRODUCTS ---

export async function manualTriggerReplenishment(clubId: string) {
  await requireClubAccess(clubId);
  try {
    await calculateAnalytics(clubId);
    await checkReplenishmentNeeds(clubId);
    revalidatePath(`/clubs/${clubId}/inventory`);
    return { success: true };
  } catch (e) {
    console.error("Manual trigger failed:", e);
    throw e;
  }
}

export function normalizeProcurementBoxSize(unitsPerBox: number | null | undefined) {
  const normalized = Number(unitsPerBox || 1);
  return Number.isFinite(normalized) && normalized > 0
    ? Math.max(1, Math.round(normalized))
    : 1;
}

export function calculateSuggestedProcurementQuantity(
  product: {
    current_stock: number | string | null;
    sales_velocity: number | string | null;
    ideal_stock_days?: number | string | null;
    min_stock_level?: number | string | null;
    units_per_box?: number | string | null;
    abc_category?: string | null;
  },
  mode: ProcurementMode = "optimized",
) {
  const currentStock = Number(product.current_stock || 0);
  const salesVelocity = Number(product.sales_velocity || 0);
  const idealStockDays = Math.max(1, Number(product.ideal_stock_days || 14));
  const minStockLevel = Math.max(0, Number(product.min_stock_level || 0));
  const boxSize = normalizeProcurementBoxSize(
    Number(product.units_per_box || 1),
  );
  const abcCategory = String(product.abc_category || "C").toUpperCase();

  const targetDays =
    mode === "optimized"
      ? abcCategory === "A"
        ? Math.min(idealStockDays, 7)
        : abcCategory === "B"
          ? Math.min(idealStockDays, 4)
          : 0
      : abcCategory === "A"
        ? idealStockDays
        : abcCategory === "B"
          ? Math.max(5, Math.min(idealStockDays, 10))
          : Math.max(2, Math.min(idealStockDays, 5));

  const targetStock =
    targetDays > 0 && salesVelocity > 0
      ? Math.max(Math.ceil(salesVelocity * targetDays), minStockLevel)
      : mode === "full"
        ? Math.max(minStockLevel, boxSize)
        : 0;
  const needed = Math.max(0, targetStock - currentStock);
  if (needed <= 0) return 0;

  return Math.ceil(needed / boxSize) * boxSize;
}

export function getProcurementCoverDays(abcCategory: string, mode: ProcurementMode) {
  if (mode === "optimized") {
    if (abcCategory === "A") return 7;
    if (abcCategory === "B") return 4;
    return 0;
  }

  if (abcCategory === "A") return 10;
  if (abcCategory === "B") return 6;
  return 3;
}

export function getProcurementPriority(
  abcCategory: string,
  daysLeft: number | null,
  belowMin: boolean,
  mode: ProcurementMode,
) {
  if (mode === "optimized") {
    if (abcCategory === "A")
      return belowMin || (daysLeft !== null && daysLeft < 2)
        ? "CRITICAL"
        : "HIGH";
    if (abcCategory === "B")
      return belowMin || (daysLeft !== null && daysLeft < 2)
        ? "HIGH"
        : "MEDIUM";
    return null;
  }

  if (abcCategory === "A")
    return belowMin || (daysLeft !== null && daysLeft < 2)
      ? "CRITICAL"
      : "HIGH";
  if (abcCategory === "B")
    return belowMin || (daysLeft !== null && daysLeft < 2) ? "HIGH" : "MEDIUM";
  return "MEDIUM";
}

export function getProcurementReason(
  abcCategory: string,
  belowMin: boolean,
  mode: ProcurementMode,
) {
  if (mode === "optimized") {
    return belowMin
      ? `Оптимизированная закупка: категория ${abcCategory} ниже минимального остатка`
      : `Оптимизированная закупка: категория ${abcCategory} подходит к точке дозаказа`;
  }

  return belowMin
    ? `Полное пополнение: категория ${abcCategory} ниже минимального остатка`
    : `Полное пополнение: категория ${abcCategory} подходит к точке дозаказа`;
}

export function getProcurementCandidate(
  product: {
    current_stock: number | string | null;
    sales_velocity: number | string | null;
    min_stock_level?: number | string | null;
    abc_category?: string | null;
  },
  mode: ProcurementMode = "optimized",
) {
  const currentStock = Number(product.current_stock || 0);
  const salesVelocity = Math.max(0, Number(product.sales_velocity || 0));
  const minStockLevel = Math.max(0, Number(product.min_stock_level || 0));
  const abcCategory = String(product.abc_category || "C").toUpperCase();
  const daysLeft = salesVelocity > 0 ? currentStock / salesVelocity : null;
  const coverDays = getProcurementCoverDays(abcCategory, mode);
  const adaptiveReorderPoint =
    coverDays > 0 && salesVelocity > 0
      ? Math.max(minStockLevel, Math.ceil(salesVelocity * coverDays))
      : minStockLevel;

  if (mode === "optimized" && abcCategory === "C") return null;

  const belowMin = currentStock < minStockLevel;
  const belowCover =
    coverDays > 0 && salesVelocity > 0 && currentStock < adaptiveReorderPoint;
  if (!belowMin && !belowCover) return null;

  const priority = getProcurementPriority(
    abcCategory,
    daysLeft,
    belowMin,
    mode,
  );
  if (!priority) return null;
  return {
    priority,
    reason: getProcurementReason(abcCategory, belowMin, mode),
    reorder_point: adaptiveReorderPoint,
    days_left: daysLeft,
  } satisfies ProcurementCandidate;
}