"use server";

import { query, getClient } from "@/db";
import { revalidatePath } from "next/cache";
import { normalizeInventorySettings } from "@/lib/inventory-settings";
import { requireClubAccess } from "./auth";

export interface ComboItemInput {
  product_id: number;
  quantity: number;
  allocated_price?: number;
}

export interface CreateComboPayload {
  name: string;
  barcode?: string;
  price: number;
  smartshell_tariff_id?: number;
  items: ComboItemInput[];
}

export interface UpdateComboPayload extends CreateComboPayload {
  is_active?: boolean;
}

export interface ComboItemView {
  id: number;
  product_id: number;
  product_name: string;
  product_barcode: string | null;
  product_cost_price: number;
  product_selling_price: number;
  quantity: number;
  cashbox_stock: number;
}

export interface ComboView {
  id: string;
  club_id: number;
  name: string;
  barcode: string | null;
  price: number;
  is_active: boolean;
  smartshell_combo_id: number | null;
  smartshell_tariff_id: number | null;
  created_at: string;
  updated_at: string;
  items: ComboItemView[];
  total_cost_price: number;
  margin_rub: number;
  margin_percent: number;
  available_qty: number;
}

/**
 * Получение всех комбо-наборов клуба со списком товаров, расчетом маржи и доступным остатком
 */
export async function getCombos(clubId: string): Promise<ComboView[]> {
  const client = await getClient();
  try {
    const clubSettingsRes = await client.query(
      `SELECT inventory_settings FROM clubs WHERE id = $1`,
      [clubId]
    );
    const invSettings = normalizeInventorySettings(clubSettingsRes.rows[0]?.inventory_settings);
    const cashboxWarehouseIds: number[] = Array.isArray(invSettings.cashbox_warehouse_ids) && invSettings.cashbox_warehouse_ids.length > 0
      ? invSettings.cashbox_warehouse_ids
      : (invSettings.cashbox_warehouse_id ? [invSettings.cashbox_warehouse_id] : []);

    const combosRes = await client.query(
      `SELECT id, club_id, name, barcode, price, is_active, smartshell_combo_id, smartshell_tariff_id, created_at, updated_at
       FROM warehouse_combo_sets
       WHERE club_id = $1
       ORDER BY created_at DESC`,
      [clubId]
    );

    if (combosRes.rows.length === 0) return [];

    const comboIds = combosRes.rows.map((c: any) => c.id);

    let itemsQuery: string;
    let itemsParams: any[];

    if (cashboxWarehouseIds.length > 0) {
      itemsQuery = `
        SELECT 
          ci.id,
          ci.combo_id,
          ci.product_id,
          ci.quantity,
          p.name as product_name,
          p.barcode as product_barcode,
          COALESCE(p.cost_price, 0) as product_cost_price,
          COALESCE(p.selling_price, 0) as product_selling_price,
          COALESCE(SUM(ws.quantity), 0) as cashbox_stock
        FROM warehouse_combo_items ci
        JOIN warehouse_products p ON ci.product_id = p.id
        LEFT JOIN warehouse_stock ws ON p.id = ws.product_id AND ws.warehouse_id = ANY($2::int[])
        WHERE ci.combo_id = ANY($1)
        GROUP BY ci.id, ci.combo_id, ci.product_id, ci.quantity, p.name, p.barcode, p.cost_price, p.selling_price
        ORDER BY ci.id ASC
      `;
      itemsParams = [comboIds, cashboxWarehouseIds];
    } else {
      itemsQuery = `
        SELECT 
          ci.id,
          ci.combo_id,
          ci.product_id,
          ci.quantity,
          p.name as product_name,
          p.barcode as product_barcode,
          COALESCE(p.cost_price, 0) as product_cost_price,
          COALESCE(p.selling_price, 0) as product_selling_price,
          COALESCE(SUM(ws.quantity), 0) as cashbox_stock
        FROM warehouse_combo_items ci
        JOIN warehouse_products p ON ci.product_id = p.id
        LEFT JOIN warehouse_stock ws ON p.id = ws.product_id
        LEFT JOIN warehouses w ON ws.warehouse_id = w.id
        WHERE ci.combo_id = ANY($1)
          AND (w.shift_accountability_enabled = true OR w.type = 'BAR' OR w.is_default = true OR w.id IS NULL)
        GROUP BY ci.id, ci.combo_id, ci.product_id, ci.quantity, p.name, p.barcode, p.cost_price, p.selling_price
        ORDER BY ci.id ASC
      `;
      itemsParams = [comboIds];
    }

    const itemsRes = await client.query(itemsQuery, itemsParams);

    const itemsByCombo = new Map<string, ComboItemView[]>();
    for (const row of itemsRes.rows) {
      const list = itemsByCombo.get(row.combo_id) || [];
      list.push({
        id: row.id,
        product_id: row.product_id,
        product_name: row.product_name,
        product_barcode: row.product_barcode,
        product_cost_price: Number(row.product_cost_price || 0),
        product_selling_price: Number(row.product_selling_price || 0),
        quantity: Number(row.quantity || 1),
        cashbox_stock: Number(row.cashbox_stock || 0),
      });
      itemsByCombo.set(row.combo_id, list);
    }

    return combosRes.rows.map((combo: any) => {
      const items = itemsByCombo.get(combo.id) || [];
      const price = Number(combo.price || 0);

      const totalCostPrice = items.reduce(
        (sum, i) => sum + i.product_cost_price * i.quantity,
        0
      );
      const marginRub = price - totalCostPrice;
      const marginPercent = price > 0 ? (marginRub / price) * 100 : 0;

      let availableQty = 0;
      if (items.length > 0) {
        availableQty = Math.min(
          ...items.map((i) => (i.quantity > 0 ? Math.floor(i.cashbox_stock / i.quantity) : 0))
        );
      }

      return {
        id: combo.id,
        club_id: Number(combo.club_id),
        name: combo.name,
        barcode: combo.barcode,
        price,
        is_active: combo.is_active,
        smartshell_combo_id: combo.smartshell_combo_id ? Number(combo.smartshell_combo_id) : null,
        smartshell_tariff_id: combo.smartshell_tariff_id ? Number(combo.smartshell_tariff_id) : null,
        created_at: new Date(combo.created_at).toISOString(),
        updated_at: new Date(combo.updated_at).toISOString(),
        items,
        total_cost_price: Math.round(totalCostPrice * 100) / 100,
        margin_rub: Math.round(marginRub * 100) / 100,
        margin_percent: Math.round(marginPercent * 10) / 10,
        available_qty: Math.max(0, availableQty),
      };
    });
  } finally {
    client.release();
  }
}

/**
 * Получение одного комбо-набора по ID со списком товаров и расчетом маржи
 */
export async function getCombo(clubId: string, comboId: string): Promise<ComboView | null> {
  const combos = await getCombos(clubId);
  return combos.find((c) => c.id === comboId) || null;
}

/**
 * Распределяет общую цену комбо-набора между входящими товарами так,
 * чтобы в SmartShell сумма (price * amount) в точности равнялась цене комбо (targetComboPrice).
 */
function allocateComboItemPrices<T extends { quantity: number; selling_price?: number }>(
  items: T[],
  targetComboPrice: number
): (T & { allocated_unit_price: number })[] {
  const target = Math.max(0, Number(targetComboPrice) || 0);
  if (items.length === 0) return [];

  const retailValues = items.map((it) => {
    const qty = Math.max(1, Number(it.quantity || 1));
    const unitPrice = Math.max(0, Number(it.selling_price || 0));
    return { qty, unitPrice, total: unitPrice * qty };
  });

  const totalRetail = retailValues.reduce((sum, v) => sum + v.total, 0);
  const totalUnits = retailValues.reduce((sum, v) => sum + v.qty, 0);

  let allocatedSum = 0;
  const result: (T & { allocated_unit_price: number })[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { qty, total } = retailValues[i];
    const isLast = i === items.length - 1;

    let itemUnitPrice = 0;

    if (isLast) {
      const remainingTarget = Math.max(0, target - allocatedSum);
      itemUnitPrice = Math.round((remainingTarget / qty) * 100) / 100;
      if (Math.abs(itemUnitPrice * qty - remainingTarget) > 0.005) {
        itemUnitPrice = Math.round((remainingTarget / qty) * 10000) / 10000;
      }
    } else {
      if (totalRetail > 0) {
        const itemShare = (total / totalRetail) * target;
        itemUnitPrice = Math.round((itemShare / qty) * 100) / 100;
      } else if (totalUnits > 0) {
        itemUnitPrice = Math.round((target / totalUnits) * 100) / 100;
      }
      allocatedSum += itemUnitPrice * qty;
    }

    result.push({
      ...item,
      allocated_unit_price: Math.max(0, itemUnitPrice),
    });
  }

  return result;
}

/**
 * Преобразует массив товаров для выгрузки в SmartShell.
 * Если в наборе указан только один товар в количестве 2+ (например, 2 сникерса),
 * разбивает его на 2 строки в массиве items, так как SmartShell валидирует items.length >= 2.
 */
function prepareSmartShellComboItems(
  items: {
    entity_type: "GOOD";
    entity_id: number;
    amount: number;
    price: number;
  }[]
): {
  entity_type: "GOOD";
  entity_id: number;
  amount: number;
  price: number;
}[] {
  if (items.length === 0) return [];

  // Если в наборе всего 1 позиция товара
  if (items.length === 1) {
    const single = items[0];
    if (single.amount >= 2) {
      // Разбиваем на 2 элемента для прохождения валидации SmartShell (items.length >= 2)
      return [
        {
          ...single,
          amount: 1,
        },
        {
          ...single,
          amount: single.amount - 1,
        },
      ];
    }
  }

  return items;
}

/**
 * Создание комбо-набора в DashAdmin и опционально в SmartShell
 */
export async function createCombo(
  clubId: string,
  payload: CreateComboPayload,
  syncWithSmartShell = false
) {
  await requireClubAccess(clubId);

  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error("Укажите название комбо-набора");
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Добавьте хотя бы один товар в состав комбо-набора");
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Загружаем актуальные розничные цены товаров для распределения цены комбо
    const productRows: {
      product_id: number;
      name: string;
      barcode: string | null;
      selling_price: number;
      quantity: number;
    }[] = [];

    for (const item of payload.items) {
      const pRes = await client.query(
        `SELECT id, name, barcode, selling_price FROM warehouse_products WHERE id = $1 AND club_id = $2`,
        [item.product_id, clubId]
      );
      const prod = pRes.rows[0];
      if (prod) {
        productRows.push({
          product_id: Number(prod.id),
          name: prod.name,
          barcode: prod.barcode,
          selling_price: Number(prod.selling_price || 0),
          quantity: Math.max(1, Number(item.quantity || 1)),
        });
      }
    }

    const allocatedItems = allocateComboItemPrices(
      productRows,
      Number(payload.price) || 0
    );

    let smartshellComboId: number | null = null;

    // 1. Создаем в SmartShell если включено
    if (syncWithSmartShell) {
      try {
        const { getSmartShellClientForClub } = await import("@/lib/smartshell/shift-sync");
        const ssClient = await getSmartShellClientForClub(clubId);
        if (ssClient) {
          const rawSsItems: {
            entity_type: "GOOD";
            entity_id: number;
            amount: number;
            price: number;
          }[] = [];

          for (const item of allocatedItems) {
            const goodId = await ssClient.resolveGoodId({
              name: item.name,
              barcode: item.barcode,
            });
            if (goodId) {
              rawSsItems.push({
                entity_type: "GOOD",
                entity_id: goodId,
                amount: item.quantity,
                price: item.allocated_unit_price,
              });
            }
          }

          const ssItems = prepareSmartShellComboItems(rawSsItems);

          if (ssItems.length < 2) {
            throw new Error(
              "SmartShell требует, чтобы в комбо-наборе было минимум 2 товара (например, 2 сникерса или сникерс + напиток). Увеличьте количество или добавьте второй товар в состав."
            );
          }

          const ssCreated = await ssClient.createCombo({
            title: payload.name.trim(),
            tariff_id: payload.smartshell_tariff_id ? Number(payload.smartshell_tariff_id) : undefined,
            items: ssItems,
          });
          if (ssCreated?.id) {
            smartshellComboId = Number(ssCreated.id);
          }
        }
      } catch (ssErr: any) {
        console.error("SmartShell createCombo error:", ssErr);
        throw new Error(`Ошибка SmartShell: ${ssErr.message || "Не удалось создать комбо в SmartShell"}`);
      }
    }

    // 2. Вставляем в БД DashAdmin
    const comboRes = await client.query(
      `INSERT INTO warehouse_combo_sets (club_id, name, barcode, price, is_active, smartshell_combo_id, smartshell_tariff_id)
       VALUES ($1, $2, $3, $4, true, $5, $6)
       RETURNING id`,
      [
        clubId,
        payload.name.trim(),
        payload.barcode?.trim() || null,
        Number(payload.price) || 0,
        smartshellComboId,
        payload.smartshell_tariff_id ? Number(payload.smartshell_tariff_id) : null,
      ]
    );

    const comboId = comboRes.rows[0].id;

    for (const item of allocatedItems) {
      await client.query(
        `INSERT INTO warehouse_combo_items (combo_id, product_id, quantity, allocated_price)
         VALUES ($1, $2, $3, $4)`,
        [
          comboId,
          item.product_id,
          item.quantity,
          item.allocated_unit_price,
        ]
      );
    }

    await client.query("COMMIT");
    revalidatePath(`/clubs/${clubId}/inventory`);
    return { success: true, id: comboId, smartshell_combo_id: smartshellComboId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Обновление комбо-набора
 */
export async function updateCombo(
  clubId: string,
  comboId: string,
  payload: UpdateComboPayload,
  syncWithSmartShell = false
) {
  await requireClubAccess(clubId);

  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error("Укажите название комбо-набора");
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Добавьте хотя бы один товар в состав комбо-набора");
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const prevRes = await client.query(
      `SELECT smartshell_combo_id FROM warehouse_combo_sets WHERE id = $1 AND club_id = $2`,
      [comboId, clubId]
    );
    let ssComboId = prevRes.rows[0]?.smartshell_combo_id ? Number(prevRes.rows[0].smartshell_combo_id) : null;

    // Загружаем товары для корректного распределения цены набора
    const productRows: {
      product_id: number;
      name: string;
      barcode: string | null;
      selling_price: number;
      quantity: number;
    }[] = [];

    for (const item of payload.items) {
      const pRes = await client.query(
        `SELECT id, name, barcode, selling_price FROM warehouse_products WHERE id = $1 AND club_id = $2`,
        [item.product_id, clubId]
      );
      const prod = pRes.rows[0];
      if (prod) {
        productRows.push({
          product_id: Number(prod.id),
          name: prod.name,
          barcode: prod.barcode,
          selling_price: Number(prod.selling_price || 0),
          quantity: Math.max(1, Number(item.quantity || 1)),
        });
      }
    }

    const allocatedItems = allocateComboItemPrices(
      productRows,
      Number(payload.price) || 0
    );

    // SmartShell sync if requested or already linked
    if (syncWithSmartShell || ssComboId) {
      try {
        const { getSmartShellClientForClub } = await import("@/lib/smartshell/shift-sync");
        const ssClient = await getSmartShellClientForClub(clubId);
        if (ssClient) {
          const rawSsItems: {
            entity_type: "GOOD";
            entity_id: number;
            amount: number;
            price: number;
          }[] = [];

          for (const item of allocatedItems) {
            const goodId = await ssClient.resolveGoodId({
              name: item.name,
              barcode: item.barcode,
            });
            if (goodId) {
              rawSsItems.push({
                entity_type: "GOOD",
                entity_id: goodId,
                amount: item.quantity,
                price: item.allocated_unit_price,
              });
            }
          }

          const ssItems = prepareSmartShellComboItems(rawSsItems);

          if (ssItems.length >= 2) {
            if (ssComboId) {
              const upd = await ssClient.updateCombo(ssComboId, {
                title: payload.name.trim(),
                tariff_id: payload.smartshell_tariff_id ? Number(payload.smartshell_tariff_id) : undefined,
                items: ssItems,
              });
              if (!upd?.id) {
                const cr = await ssClient.createCombo({
                  title: payload.name.trim(),
                  tariff_id: payload.smartshell_tariff_id ? Number(payload.smartshell_tariff_id) : undefined,
                  items: ssItems,
                });
                if (cr?.id) ssComboId = Number(cr.id);
              }
            } else if (syncWithSmartShell) {
              const cr = await ssClient.createCombo({
                title: payload.name.trim(),
                tariff_id: payload.smartshell_tariff_id ? Number(payload.smartshell_tariff_id) : undefined,
                items: ssItems,
              });
              if (cr?.id) ssComboId = Number(cr.id);
            }
          } else if (syncWithSmartShell) {
            throw new Error(
              "SmartShell требует, чтобы в комбо-наборе было минимум 2 товара (например, 2 сникерса или сникерс + напиток)."
            );
          }
        }
      } catch (ssErr: any) {
        console.warn("SmartShell updateCombo sync error:", ssErr);
        if (syncWithSmartShell) {
          throw new Error(`Ошибка SmartShell: ${ssErr.message || "Не удалось синхронизировать комбо со SmartShell"}`);
        }
      }
    }

    await client.query(
      `UPDATE warehouse_combo_sets
       SET name = $1, barcode = $2, price = $3, is_active = COALESCE($4, is_active),
           smartshell_combo_id = $5, smartshell_tariff_id = $6, updated_at = NOW()
       WHERE id = $7 AND club_id = $8`,
      [
        payload.name.trim(),
        payload.barcode?.trim() || null,
        Number(payload.price) || 0,
        payload.is_active ?? true,
        ssComboId,
        payload.smartshell_tariff_id ? Number(payload.smartshell_tariff_id) : null,
        comboId,
        clubId,
      ]
    );

    await client.query(
      `DELETE FROM warehouse_combo_items WHERE combo_id = $1`,
      [comboId]
    );

    for (const item of allocatedItems) {
      await client.query(
        `INSERT INTO warehouse_combo_items (combo_id, product_id, quantity, allocated_price)
         VALUES ($1, $2, $3, $4)`,
        [
          comboId,
          item.product_id,
          item.quantity,
          item.allocated_unit_price,
        ]
      );
    }

    await client.query("COMMIT");
    revalidatePath(`/clubs/${clubId}/inventory`);
    return { success: true, smartshell_combo_id: ssComboId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Выгрузка одиночного комбо-набора из DashAdmin в SmartShell
 */
export async function exportSingleComboToSmartShell(clubId: string, comboId: string) {
  await requireClubAccess(clubId);

  const { getSmartShellClientForClub } = await import("@/lib/smartshell/shift-sync");
  const ssClient = await getSmartShellClientForClub(clubId);
  if (!ssClient) {
    throw new Error("Учетные данные SmartShell не настроены для этого клуба");
  }

  const client = await getClient();
  try {
    const comboRes = await client.query(
      `SELECT id, name, price, smartshell_combo_id, smartshell_tariff_id
       FROM warehouse_combo_sets
       WHERE id = $1 AND club_id = $2`,
      [comboId, clubId]
    );
    if (comboRes.rows.length === 0) {
      throw new Error("Комбо-набор не найден");
    }
    const combo = comboRes.rows[0];

    const itemsRes = await client.query(
      `SELECT ci.product_id, ci.quantity, ci.allocated_price, p.name, p.barcode, p.selling_price
       FROM warehouse_combo_items ci
       JOIN warehouse_products p ON ci.product_id = p.id
       WHERE ci.combo_id = $1`,
      [comboId]
    );

    if (itemsRes.rows.length === 0) {
      throw new Error("Комбо-набор не содержит товаров");
    }

    const resolvedItems: {
      goodId: number;
      name: string;
      barcode: string | null;
      selling_price: number;
      quantity: number;
    }[] = [];

    const unmapped: string[] = [];

    for (const item of itemsRes.rows) {
      const goodId = await ssClient.resolveGoodId({
        name: item.name,
        barcode: item.barcode,
      });

      if (!goodId) {
        unmapped.push(item.name);
      } else {
        resolvedItems.push({
          goodId,
          name: item.name,
          barcode: item.barcode,
          selling_price: Number(item.selling_price || 0),
          quantity: Math.max(1, Number(item.quantity || 1)),
        });
      }
    }

    if (unmapped.length > 0) {
      throw new Error(
        `Не удалось найти в SmartShell следующие товары из набора: ${unmapped.join(", ")}. Убедитесь, что эти товары заведены в SmartShell.`
      );
    }

    const allocated = allocateComboItemPrices(
      resolvedItems,
      Number(combo.price) || 0
    );

    const rawSsItems = allocated.map((it) => ({
      entity_type: "GOOD" as const,
      entity_id: it.goodId,
      amount: it.quantity,
      price: it.allocated_unit_price,
    }));

    const ssItems = prepareSmartShellComboItems(rawSsItems);

    if (ssItems.length < 2) {
      throw new Error(
        "SmartShell требует, чтобы в комбо-наборе было минимум 2 товара (например, 2 сникерса или сникерс + напиток). Увеличьте количество или добавьте второй товар в состав."
      );
    }

    let ssComboId = combo.smartshell_combo_id ? Number(combo.smartshell_combo_id) : null;
    let operationSuccess = false;

    if (ssComboId) {
      try {
        const updateRes = await ssClient.updateCombo(ssComboId, {
          title: combo.name.trim(),
          tariff_id: combo.smartshell_tariff_id ? Number(combo.smartshell_tariff_id) : undefined,
          items: ssItems,
        });
        if (updateRes?.id) {
          operationSuccess = true;
        }
      } catch (updErr) {
        console.warn("SmartShell updateCombo failed, trying createCombo fallback:", updErr);
      }
    }

    if (!operationSuccess) {
      const createRes = await ssClient.createCombo({
        title: combo.name.trim(),
        tariff_id: combo.smartshell_tariff_id ? Number(combo.smartshell_tariff_id) : undefined,
        items: ssItems,
      });
      if (!createRes?.id) {
        throw new Error("SmartShell API не вернул ID созданного комбо-набора");
      }
      ssComboId = Number(createRes.id);
    }

    await client.query(
      `UPDATE warehouse_combo_sets SET smartshell_combo_id = $1, updated_at = NOW() WHERE id = $2`,
      [ssComboId, comboId]
    );

    revalidatePath(`/clubs/${clubId}/inventory`);
    return {
      success: true,
      smartshell_combo_id: ssComboId,
      message: `Комбо-набор "${combo.name}" успешно выгружен в SmartShell (цена: ${combo.price} ₽, ID #${ssComboId})!`,
    };
  } finally {
    client.release();
  }
}

/**
 * Массовая выгрузка всех комбо-наборов из DashAdmin в SmartShell
 */
export async function exportCombosToSmartShell(clubId: string) {
  await requireClubAccess(clubId);

  const { getSmartShellClientForClub } = await import("@/lib/smartshell/shift-sync");
  const ssClient = await getSmartShellClientForClub(clubId);
  if (!ssClient) {
    throw new Error("Учетные данные SmartShell не настроены для этого клуба");
  }

  const client = await getClient();
  try {
    const combosRes = await client.query(
      `SELECT id, name, price, smartshell_combo_id, smartshell_tariff_id
       FROM warehouse_combo_sets
       WHERE club_id = $1 AND is_active = true
       ORDER BY created_at ASC`,
      [clubId]
    );

    if (combosRes.rows.length === 0) {
      return { success: true, count: 0, message: "В DashAdmin нет активных комбо-наборов для выгрузки" };
    }

    const ssGoods = await ssClient.getGoods();
    const goodsByTitle = new Map<string, number>();
    const goodsByEan = new Map<string, number>();
    for (const g of ssGoods) {
      if (g.title) goodsByTitle.set(g.title.trim().toLowerCase(), Number(g.id));
      if (Array.isArray(g.eans)) {
        g.eans.forEach((ean: string) => goodsByEan.set(String(ean).trim(), Number(g.id)));
      }
      if (g.id) goodsByEan.set(String(g.id), Number(g.id));
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const combo of combosRes.rows) {
      const itemsRes = await client.query(
        `SELECT ci.product_id, ci.quantity, ci.allocated_price, p.name, p.barcode, p.selling_price
         FROM warehouse_combo_items ci
         JOIN warehouse_products p ON ci.product_id = p.id
         WHERE ci.combo_id = $1`,
        [combo.id]
      );

      if (itemsRes.rows.length === 0) {
        errors.push(`"${combo.name}": пустой состав набора`);
        continue;
      }

      const resolvedItems: {
        goodId: number;
        name: string;
        barcode: string | null;
        selling_price: number;
        quantity: number;
      }[] = [];

      let hasMissing = false;
      for (const item of itemsRes.rows) {
        let goodId: number | undefined;
        if (item.barcode) {
          goodId = goodsByEan.get(item.barcode.trim());
        }
        if (!goodId && item.name) {
          goodId = goodsByTitle.get(item.name.trim().toLowerCase());
        }

        if (!goodId) {
          hasMissing = true;
          errors.push(`"${combo.name}": товар "${item.name}" не найден в SmartShell`);
          break;
        }

        resolvedItems.push({
          goodId,
          name: item.name,
          barcode: item.barcode,
          selling_price: Number(item.selling_price || 0),
          quantity: Math.max(1, Number(item.quantity || 1)),
        });
      }

      if (hasMissing || resolvedItems.length === 0) continue;

      const allocated = allocateComboItemPrices(
        resolvedItems,
        Number(combo.price) || 0
      );

      const rawSsItems = allocated.map((it) => ({
        entity_type: "GOOD" as const,
        entity_id: it.goodId,
        amount: it.quantity,
        price: it.allocated_unit_price,
      }));

      const ssItems = prepareSmartShellComboItems(rawSsItems);

      if (ssItems.length < 2) {
        errors.push(`"${combo.name}": в SmartShell комбо должен содержать минимум 2 товара (например, 2 шт или 2 разных товара)`);
        continue;
      }

      let ssComboId = combo.smartshell_combo_id ? Number(combo.smartshell_combo_id) : null;
      let updated = false;

      if (ssComboId) {
        try {
          const res = await ssClient.updateCombo(ssComboId, {
            title: combo.name.trim(),
            tariff_id: combo.smartshell_tariff_id ? Number(combo.smartshell_tariff_id) : undefined,
            items: ssItems,
          });
          if (res?.id) updated = true;
        } catch (e) {
          // ignore, will create new
        }
      }

      if (!updated) {
        try {
          const res = await ssClient.createCombo({
            title: combo.name.trim(),
            tariff_id: combo.smartshell_tariff_id ? Number(combo.smartshell_tariff_id) : undefined,
            items: ssItems,
          });
          if (res?.id) {
            ssComboId = Number(res.id);
            updated = true;
          }
        } catch (e: any) {
          errors.push(`"${combo.name}": ошибка SmartShell API (${e.message})`);
        }
      }

      if (updated && ssComboId) {
        await client.query(
          `UPDATE warehouse_combo_sets SET smartshell_combo_id = $1, updated_at = NOW() WHERE id = $2`,
          [ssComboId, combo.id]
        );
        successCount++;
      }
    }

    revalidatePath(`/clubs/${clubId}/inventory`);
    return {
      success: true,
      count: successCount,
      total: combosRes.rows.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Успешно выгружено ${successCount} из ${combosRes.rows.length} комбо-наборов в SmartShell!${
        errors.length > 0 ? ` (Пропущено ${errors.length}: ${errors.slice(0, 3).join("; ")}...)` : ""
      }`,
    };
  } finally {
    client.release();
  }
}

/**
 * Удаление комбо-набора
 */
export async function deleteCombo(clubId: string, comboId: string) {
  await requireClubAccess(clubId);

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const comboRes = await client.query(
      `SELECT smartshell_combo_id FROM warehouse_combo_sets WHERE id = $1 AND club_id = $2`,
      [comboId, clubId]
    );

    if (comboRes.rows.length === 0) {
      throw new Error("Комбо-набор не найден");
    }

    const ssComboId = comboRes.rows[0].smartshell_combo_id;
    if (ssComboId) {
      try {
        const { getSmartShellClientForClub } = await import("@/lib/smartshell/shift-sync");
        const ssClient = await getSmartShellClientForClub(clubId);
        if (ssClient) {
          await ssClient.deleteCombo(Number(ssComboId));
        }
      } catch (ssErr) {
        console.warn("SmartShell deleteCombo error:", ssErr);
      }
    }

    await client.query(
      `DELETE FROM warehouse_combo_sets WHERE id = $1 AND club_id = $2`,
      [comboId, clubId]
    );

    await client.query("COMMIT");
    revalidatePath(`/clubs/${clubId}/inventory`);
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Импорт существующих комбо-наборов из SmartShell в DashAdmin
 */
export async function importCombosFromSmartShell(clubId: string) {
  await requireClubAccess(clubId);

  const { getSmartShellClientForClub } = await import("@/lib/smartshell/shift-sync");
  const smartshellClient = await getSmartShellClientForClub(clubId);

  if (!smartshellClient) {
    throw new Error("Учетные данные SmartShell не заполнены в настройках клуба");
  }

  const ssCombos = await smartshellClient.getCombos();
  if (ssCombos.length === 0) {
    return { success: true, count: 0, message: "В SmartShell не найдено комбо-наборов" };
  }

  const client = await getClient();
  let importedCount = 0;

  try {
    await client.query("BEGIN");

    for (const ssCombo of ssCombos) {
      const ssId = Number(ssCombo.id);
      const title = ssCombo.title?.trim() || `Комбо #${ssId}`;
      const price = Number(ssCombo.price || 0);
      const tariffId = ssCombo.tariff?.id ? Number(ssCombo.tariff.id) : null;

      // Проверяем, есть ли уже этот комбо в DashAdmin
      const existing = await client.query(
        `SELECT id FROM warehouse_combo_sets WHERE club_id = $1 AND (smartshell_combo_id = $2 OR lower(name) = lower($3))`,
        [clubId, ssId, title]
      );

      let comboId: string;

      if (existing.rows.length > 0) {
        comboId = existing.rows[0].id;
        await client.query(
          `UPDATE warehouse_combo_sets
           SET name = $1, price = $2, smartshell_combo_id = $3, smartshell_tariff_id = $4, updated_at = NOW()
           WHERE id = $5`,
          [title, price, ssId, tariffId, comboId]
        );
        await client.query(`DELETE FROM warehouse_combo_items WHERE combo_id = $1`, [comboId]);
      } else {
        const insertRes = await client.query(
          `INSERT INTO warehouse_combo_sets (club_id, name, price, is_active, smartshell_combo_id, smartshell_tariff_id)
           VALUES ($1, $2, $3, true, $4, $5)
           RETURNING id`,
          [clubId, title, price, ssId, tariffId]
        );
        comboId = insertRes.rows[0].id;
      }

      // Сопоставляем позиции товаров
      for (const item of ssCombo.items || []) {
        if (item.entity_type === "GOOD" && item.entity) {
          const good = item.entity;
          const goodIdStr = String(good.id);
          const goodTitle = (good.title || "").trim();

          const prodRes = await client.query(
            `SELECT id FROM warehouse_products WHERE club_id = $1 AND (barcode = $2 OR lower(name) = lower($3)) LIMIT 1`,
            [clubId, goodIdStr, goodTitle]
          );

          let productId: number;

          if (prodRes.rows.length > 0) {
            productId = prodRes.rows[0].id;
          } else {
            // Создаем товар если еще нет
            const createProdRes = await client.query(
              `INSERT INTO warehouse_products (club_id, name, barcode, cost_price, selling_price, current_stock)
               VALUES ($1, $2, $3, $4, $5, 0)
               RETURNING id`,
              [clubId, goodTitle, goodIdStr, Number(good.cost || 0), Number(item.price || 0)]
            );
            productId = createProdRes.rows[0].id;
          }

          await client.query(
            `INSERT INTO warehouse_combo_items (combo_id, product_id, quantity, allocated_price)
             VALUES ($1, $2, $3, $4)`,
            [comboId, productId, Math.max(1, Number(item.amount || 1)), Number(item.price || 0)]
          );
        }
      }

      importedCount++;
    }

    await client.query("COMMIT");
    revalidatePath(`/clubs/${clubId}/inventory`);
    return {
      success: true,
      count: importedCount,
      message: `Успешно синхронизировано ${importedCount} комбо-наборов из SmartShell!`,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
