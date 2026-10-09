import { query } from "@/db";
import { normalizeInventorySettings } from "@/lib/inventory-settings";
import { SmartShellClient, SmartShellActiveWorkShift } from "@/lib/smartshell/client";

export interface SyncResult {
  synced: boolean;
  activeShift: SmartShellActiveWorkShift | null;
  dbShiftId?: string | number | null;
  message: string;
}

/**
 * Очистка и нормализация номера телефона для сравнения (удаляет все нецифровые символы)
 */
function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("8")) {
    return "7" + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Поиск сотрудника в БД DashAdmin по номеру телефона или E-mail
 */
async function findMatchingUser(smartshellUser?: any): Promise<number | null> {
  if (!smartshellUser) return null;

  const phoneRaw = smartshellUser.phone;
  const emailRaw = smartshellUser.email;
  const phoneNormalized = normalizePhone(phoneRaw);

  if (phoneNormalized) {
    const res = await query(
      `SELECT id FROM users 
       WHERE regexp_replace(phone_number, '\\D', 'g', '') = $1 
          OR (length(regexp_replace(phone_number, '\\D', 'g', '')) = 11 AND '7' || substring(regexp_replace(phone_number, '\\D', 'g', ''), 2) = $1)
       LIMIT 1`,
      [phoneNormalized]
    );
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }
  }

  if (emailRaw && typeof emailRaw === 'string' && emailRaw.trim().length > 0) {
    const resEmail = await query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [emailRaw.trim()]
    );
    if (resEmail.rows.length > 0) {
      return resEmail.rows[0].id;
    }
  }

  return null;
}

/**
 * Поиск или создание системного пользователя "SmartShell Admin"
 */
async function getOrCreateSystemUser(): Promise<any> {
  const existing = await query(
    `SELECT id FROM users WHERE phone_number = 'smartshell_system' OR email = 'smartshell_system@dashadmin.local' LIMIT 1`
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const created = await query(
    `INSERT INTO users (full_name, phone_number, email, is_active)
     VALUES ('SmartShell Admin', 'smartshell_system', 'smartshell_system@dashadmin.local', true)
     RETURNING id`
  );
  return created.rows[0].id;
}

/**
 * Получение инициализированного клиента SmartShellClient по настройки клуба
 */
export async function getSmartShellClientForClub(clubId: string | number): Promise<SmartShellClient | null> {
  const clubIdInt = typeof clubId === "string" ? parseInt(clubId, 10) : clubId;
  if (isNaN(clubIdInt)) return null;

  const clubRes = await query(
    `SELECT inventory_settings FROM clubs WHERE id = $1`,
    [clubIdInt]
  );
  if (clubRes.rows.length === 0) return null;

  const invSettings = normalizeInventorySettings(clubRes.rows[0].inventory_settings);
  const hasLoginAuth = Boolean(invSettings.smartshell_login && invSettings.smartshell_password && invSettings.smartshell_company_id);
  const hasApiKeyAuth = Boolean(invSettings.smartshell_api_key);

  if (!hasLoginAuth && !hasApiKeyAuth) return null;

  return new SmartShellClient({
    apiKey: invSettings.smartshell_api_key,
    login: invSettings.smartshell_login,
    password: invSettings.smartshell_password,
    companyId: invSettings.smartshell_company_id,
    accessToken: (invSettings as any).smartshell_access_token,
    tokenExpiresAt: (invSettings as any).smartshell_token_expires_at ? Number((invSettings as any).smartshell_token_expires_at) : undefined,
    onTokenRefresh: async (token, expiresAt) => {
      try {
        await query(
          `UPDATE clubs
           SET inventory_settings = jsonb_set(
             jsonb_set(COALESCE(inventory_settings, '{}'::jsonb), '{smartshell_access_token}', to_jsonb($1::text)),
             '{smartshell_token_expires_at}', to_jsonb($2::bigint)
           )
           WHERE id = $3`,
          [token, expiresAt, clubIdInt]
        );
      } catch (dbErr) {
        console.warn("[SmartShell] Failed to update token in DB:", dbErr);
      }
    },
  });
}

/**
 * Извлекает данные из SmartShell смены и маппит их в reportData DashAdmin
 * согласно настройкам smartshell_source в шаблоне отчёта клуба.
 * Используется при синхронизации и при закрытии смены сотрудником.
 */
export async function buildReportDataFromSmartShell(
  clubId: number,
  ssShift: SmartShellActiveWorkShift
): Promise<Record<string, any>> {
  const cashIncome = Number(ssShift.money?.sum?.cash ?? 0);
  const cardIncome = Number(ssShift.money?.sum?.card ?? 0);
  const depositIncome = Number(ssShift.money?.sum?.deposit ?? 0);
  const bonusIncome = Number(ssShift.money?.sum?.bonus ?? 0);
  const totalRevenue = Number(ssShift.money?.sum?.total ?? 0);
  const cashOnStart = Number(ssShift.money?.cash_on_start ?? 0);
  const receiptsCount = Array.isArray(ssShift.payments) ? ssShift.payments.length : 0;
  const workerName = [ssShift.worker?.first_name, ssShift.worker?.last_name].filter(Boolean).join(" ") || "SmartShell Admin";

  let goodsTotal = 0;
  let servicesTotal = 0;
  if (Array.isArray(ssShift.payments)) {
    for (const p of ssShift.payments) {
      if (Array.isArray(p.items)) {
        for (const item of p.items) {
          const itemSum = Number(item.sum || 0);
          if (item.type === "GOOD") goodsTotal += itemSum;
          else if (item.type === "SERVICE" || item.type === "TARIFF" || item.type === "COMBO") servicesTotal += itemSum;
        }
      }
    }
  }

  // Базовые поля (всегда присутствуют)
  const reportData: Record<string, any> = {
    cash_income: cashIncome,
    card_income: cardIncome,
    receipts_count: receiptsCount,
    deposit: depositIncome,
    bonus: bonusIncome,
    total_revenue: totalRevenue,
    cash_on_start: cashOnStart,
    bar_revenue: goodsTotal,
    goods_revenue: goodsTotal,
    services_revenue: servicesTotal,
    smartshell_shift_id: ssShift.id,
    synced_from_smartshell: true,
  };

  // Применяем пользовательский маппинг из шаблона отчёта клуба
  try {
    const templateRes = await query(
      `SELECT schema FROM club_report_templates WHERE club_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1`,
      [clubId]
    );
    if (templateRes.rows.length > 0 && Array.isArray(templateRes.rows[0].schema)) {
      for (const field of templateRes.rows[0].schema as any[]) {
        if (!field?.metric_key || !field?.smartshell_source) continue;
        switch (field.smartshell_source) {
          case "money.sum.cash":      reportData[field.metric_key] = cashIncome; break;
          case "money.sum.card":      reportData[field.metric_key] = cardIncome; break;
          case "goods.total":         reportData[field.metric_key] = goodsTotal; break;
          case "services.total":      reportData[field.metric_key] = servicesTotal; break;
          case "money.sum.deposit":   reportData[field.metric_key] = depositIncome; break;
          case "money.sum.bonus":     reportData[field.metric_key] = bonusIncome; break;
          case "money.sum.total":     reportData[field.metric_key] = totalRevenue; break;
          case "money.cash_on_start": reportData[field.metric_key] = cashOnStart; break;
          case "payments.count":      reportData[field.metric_key] = receiptsCount; break;
          case "worker.name":         reportData[field.metric_key] = workerName; break;
        }
      }
    }
  } catch (e) {
    console.warn("[SmartShell] Template mapping fetch warning:", e);
  }

  return reportData;
}

/**
 * Возвращает метаданные маппинга: какие metric_key имеют smartshell_source (и какой).
 * Используется на фронте для блокировки полей с авто-заполнением.
 */
export async function getSmartShellFieldMapping(
  clubId: number
): Promise<Record<string, string>> {
  try {
    const templateRes = await query(
      `SELECT schema FROM club_report_templates WHERE club_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1`,
      [clubId]
    );
    if (!templateRes.rows[0]?.schema) return {};
    const mapping: Record<string, string> = {};
    for (const field of templateRes.rows[0].schema as any[]) {
      if (field?.metric_key && field?.smartshell_source && field.smartshell_source !== "none") {
        mapping[field.metric_key] = field.smartshell_source;
      }
    }
    return mapping;
  } catch {
    return {};
  }
}

const lastSyncByClub = new Map<number, number>();
const SYNC_THROTTLE_MS = 20_000; // 20 секунд между авто-синхронизациями клуба

/**
 * Синхронизация статуса смен между SmartShell и DashAdmin для указанного клуба
 */
export async function syncSmartShellShifts(
  clubId: string | number,
  options?: { force?: boolean }
): Promise<SyncResult> {
  const clubIdInt = typeof clubId === "string" ? parseInt(clubId, 10) : clubId;
  if (isNaN(clubIdInt)) {
    throw new Error("Invalid Club ID");
  }

  const now = Date.now();
  const lastSync = lastSyncByClub.get(clubIdInt) || 0;
  if (!options?.force && now - lastSync < SYNC_THROTTLE_MS) {
    return {
      synced: false,
      activeShift: null,
      message: `Синхронизация выполнена недавно (кэш ${Math.round((now - lastSync) / 1000)}с)`,
    };
  }

  // 1. Получить настройки клуба и проверить включение интеграции
  const clubRes = await query(
    `SELECT inventory_settings FROM clubs WHERE id = $1`,
    [clubIdInt]
  );
  if (clubRes.rows.length === 0) {
    return { synced: false, activeShift: null, message: "Клуб не найден" };
  }

  const invSettings = normalizeInventorySettings(clubRes.rows[0].inventory_settings);
  if (!invSettings.smartshell_integration_enabled) {
    return { synced: false, activeShift: null, message: "Интеграция SmartShell отключена в настройках клуба" };
  }

  const client = await getSmartShellClientForClub(clubIdInt);
  if (!client) {
    return { synced: false, activeShift: null, message: "Учетные данные SmartShell не заполнены" };
  }

  let activeShift: SmartShellActiveWorkShift | null = null;
  try {
    activeShift = await client.getActiveWorkShift();
  } catch (err: any) {
    console.error("SmartShell getActiveWorkShift Error:", err);
    return { synced: false, activeShift: null, message: `Ошибка API SmartShell: ${err.message}` };
  }

  // 3. Обработка открытой смены
  if (activeShift && activeShift.id) {
    const ssShiftId = String(activeShift.id);

    // Проверяем, существует ли уже эта смена в БД DashAdmin по глобальному smartshell_shift_id
    // ИЛИ есть активная смена в этом клубе (открытая сотрудником через UI)
    let existingShiftRes = await query(
      `SELECT id, status, user_id FROM shifts WHERE smartshell_shift_id = $1`,
      [ssShiftId]
    );

    if (existingShiftRes.rows.length === 0) {
      existingShiftRes = await query(
        `SELECT id, status, user_id FROM shifts 
         WHERE club_id = $1 AND status = 'ACTIVE' AND check_out IS NULL
         ORDER BY check_in DESC
         LIMIT 1`,
        [clubIdInt]
      );
    }

    let userId = await findMatchingUser(activeShift.worker);
    if (!userId) {
      userId = await getOrCreateSystemUser();
    }

    const cashIncome = Number(activeShift.money?.sum?.cash ?? 0);
    const cardIncome = Number(activeShift.money?.sum?.card ?? 0);
    const depositIncome = Number(activeShift.money?.sum?.deposit ?? 0);
    const bonusIncome = Number(activeShift.money?.sum?.bonus ?? 0);
    const totalRevenue = Number(activeShift.money?.sum?.total ?? 0);
    const cashOnStart = Number(activeShift.money?.cash_on_start ?? 0);
    const receiptsCount = Array.isArray(activeShift.payments) ? activeShift.payments.length : 0;
    const workerName = [activeShift.worker?.first_name, activeShift.worker?.last_name].filter(Boolean).join(" ") || "SmartShell Admin";

    // Вычисление выручки бара (GOOD) и услуг/игрового времени (TARIFF, SERVICE, COMBO)
    let goodsTotal = 0;
    let servicesTotal = 0;

    if (Array.isArray(activeShift.payments)) {
      for (const p of activeShift.payments) {
        if (Array.isArray(p.items)) {
          for (const item of p.items) {
            const itemSum = Number(item.sum || 0);
            if (item.type === 'GOOD') {
              goodsTotal += itemSum;
            } else if (item.type === 'SERVICE' || item.type === 'TARIFF' || item.type === 'COMBO') {
              servicesTotal += itemSum;
            }
          }
        }
      }
    }

    const reportData: Record<string, any> = {
      cash_income: cashIncome,
      card_income: cardIncome,
      receipts_count: receiptsCount,
      deposit: depositIncome,
      bonus: bonusIncome,
      total_revenue: totalRevenue,
      cash_on_start: cashOnStart,
      bar_revenue: goodsTotal,
      goods_revenue: goodsTotal,
      services_revenue: servicesTotal,
      smartshell_shift_id: activeShift.id,
      synced_from_smartshell: true
    };

    // Загрузить активный шаблон отчета клуба для поддержки пользовательского маппинга
    try {
      const templateRes = await query(
        `SELECT schema FROM club_report_templates WHERE club_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1`,
        [clubIdInt]
      );
      if (templateRes.rows.length > 0 && Array.isArray(templateRes.rows[0].schema)) {
        const fields: any[] = templateRes.rows[0].schema;
        for (const field of fields) {
          if (!field || !field.metric_key || !field.smartshell_source) continue;
          switch (field.smartshell_source) {
            case 'money.sum.cash':
              reportData[field.metric_key] = cashIncome;
              break;
            case 'money.sum.card':
              reportData[field.metric_key] = cardIncome;
              break;
            case 'goods.total':
              reportData[field.metric_key] = goodsTotal;
              break;
            case 'services.total':
              reportData[field.metric_key] = servicesTotal;
              break;
            case 'money.sum.deposit':
              reportData[field.metric_key] = depositIncome;
              break;
            case 'money.sum.bonus':
              reportData[field.metric_key] = bonusIncome;
              break;
            case 'money.sum.total':
              reportData[field.metric_key] = totalRevenue;
              break;
            case 'money.cash_on_start':
              reportData[field.metric_key] = cashOnStart;
              break;
            case 'payments.count':
              reportData[field.metric_key] = receiptsCount;
              break;
            case 'worker.name':
              reportData[field.metric_key] = workerName;
              break;
          }
        }
      }
    } catch (tmplErr) {
      console.warn("SmartShell template mapping fetch warning:", tmplErr);
    }

    const reportComment = activeShift.comment || null;

    if (existingShiftRes.rows.length === 0) {
      // Закрываем другие зависшие OPEN смены для этого клуба
      await query(
        `UPDATE shifts 
         SET status = 'CLOSED', check_out = COALESCE(check_out, NOW()), smartshell_synced_at = NOW()
         WHERE club_id = $1 AND status = 'OPEN'`,
        [clubIdInt]
      );

      // Вставляем новую открытую смену со всеми финансовыми показателями и кол-вом чеков
      const checkInDate = activeShift.created_at ? new Date(activeShift.created_at) : new Date();
      const insertRes = await query(
        `INSERT INTO shifts (
           club_id, user_id, check_in, status, 
           cash_income, card_income, report_comment, report_data, 
           smartshell_shift_id, smartshell_synced_at
         )
         VALUES ($1, $2, $3, 'OPEN', $4, $5, $6, $7::jsonb, $8, NOW())
         RETURNING id`,
        [clubIdInt, userId, checkInDate, cashIncome, cardIncome, reportComment, JSON.stringify(reportData), ssShiftId]
      );

      const dbShiftId = insertRes.rows[0].id;
      await syncSmartShellPaymentsToReceipts(clubIdInt, String(dbShiftId), String(userId), activeShift.payments || [], invSettings);
      
      // Обработка пополнений для начисления билетов лояльности Promo
      if (Array.isArray(activeShift.payments) && activeShift.payments.length > 0) {
        try {
          const { processSmartShellPaymentForPromo } = await import("@/lib/promo-smartshell-sync");
          const { getClient } = await import("@/db");
          const clientDb = await getClient();
          try {
            await clientDb.query("BEGIN");
            for (const p of activeShift.payments) {
              await processSmartShellPaymentForPromo(clientDb, clubIdInt, p as any);
            }
            await clientDb.query("COMMIT");
          } catch (promoDbErr) {
            await clientDb.query("ROLLBACK");
            console.warn("[Promo Shift Sync DB Error]", promoDbErr);
          } finally {
            clientDb.release();
          }
        } catch (promoSyncErr) {
          console.warn("[Promo Shift Sync Error]", promoSyncErr);
        }
      }

      lastSyncByClub.set(clubIdInt, Date.now());

      return {
        synced: true,
        activeShift,
        dbShiftId,
        message: `Создана и синхронизирована смена SmartShell #${ssShiftId} (${receiptsCount} чеков)`,
      };
    } else {
      // Смена уже есть, обновим показатели выручки, чеков и время синхронизации
      const existing = existingShiftRes.rows[0];
      await query(
        `UPDATE shifts 
         SET club_id = $1,
             status = CASE WHEN status = 'ACTIVE' THEN 'ACTIVE' ELSE 'OPEN' END,
             smartshell_shift_id = COALESCE(smartshell_shift_id, $7),
             cash_income = $2, 
             card_income = $3, 
             report_comment = COALESCE($4, report_comment), 
             report_data = COALESCE(report_data, '{}'::jsonb) || $5::jsonb,
             smartshell_synced_at = NOW() 
         WHERE id = $6`,
        [clubIdInt, cashIncome, cardIncome, reportComment, JSON.stringify(reportData), existing.id, ssShiftId]
      );

      await syncSmartShellPaymentsToReceipts(clubIdInt, String(existing.id), String(userId), activeShift.payments || [], invSettings);

      // Обработка пополнений для начисления билетов лояльности Promo
      if (Array.isArray(activeShift.payments) && activeShift.payments.length > 0) {
        try {
          const { processSmartShellPaymentForPromo } = await import("@/lib/promo-smartshell-sync");
          const { getClient } = await import("@/db");
          const clientDb = await getClient();
          try {
            await clientDb.query("BEGIN");
            for (const p of activeShift.payments) {
              await processSmartShellPaymentForPromo(clientDb, clubIdInt, p as any);
            }
            await clientDb.query("COMMIT");
          } catch (promoDbErr) {
            await clientDb.query("ROLLBACK");
            console.warn("[Promo Shift Sync DB Error]", promoDbErr);
          } finally {
            clientDb.release();
          }
        } catch (promoSyncErr) {
          console.warn("[Promo Shift Sync Error]", promoSyncErr);
        }
      }

      lastSyncByClub.set(clubIdInt, Date.now());

      return {
        synced: true,
        activeShift,
        dbShiftId: existing.id,
        message: `Обновлена смена SmartShell #${ssShiftId} (${receiptsCount} чеков)`,
      };
    }
  } else {
    // 4. Если в SmartShell НЕТ активной смены -> закрываем все смены SmartShell в DashAdmin
    const closedRes = await query(
      `UPDATE shifts 
       SET status = 'CLOSED', 
           check_out = COALESCE(check_out, NOW()), 
           has_owner_corrections = true,
           smartshell_synced_at = NOW()
       WHERE club_id = $1 AND status = 'OPEN' AND smartshell_shift_id IS NOT NULL
       RETURNING id`,
      [clubIdInt]
    );
    lastSyncByClub.set(clubIdInt, Date.now());

    return {
      synced: true,
      activeShift: null,
      message: closedRes.rows.length > 0 
        ? `Закрыто смен в DashAdmin: ${closedRes.rows.length}` 
        : "Активных смен в SmartShell нет",
    };
  }
}

/**
 * Автоматическое создание чеков (shift_receipts) и списание остатков товара при продажах через SmartShell POS
 */
async function syncSmartShellPaymentsToReceipts(
  clubId: number,
  shiftId: string,
  userId: string,
  payments: any[],
  invSettings: any
) {
  if (!Array.isArray(payments) || payments.length === 0) return;

  const cashboxWarehouseIds: number[] = Array.isArray(invSettings.cashbox_warehouse_ids)
    ? invSettings.cashbox_warehouse_ids
    : [];

  let defaultWarehouseId: number | null = cashboxWarehouseIds[0] || null;
  if (!defaultWarehouseId) {
    const whRes = await query(
      `SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1`,
      [clubId]
    );
    defaultWarehouseId = whRes.rows[0]?.id || null;
  }
  if (!defaultWarehouseId) return;

  const validPayments = payments.filter(p => p && p.id && Array.isArray(p.items) && p.items.length > 0);
  if (validPayments.length === 0) return;

  // 1. Bulk check existing receipts
  const notesToCheck = validPayments.map(p => `SmartShell Чек #${p.id}`);
  const existingReceiptsRes = await query(
    `SELECT notes FROM shift_receipts WHERE club_id = $1 AND notes = ANY($2::text[])`,
    [clubId, notesToCheck]
  );
  const existingNotesSet = new Set(existingReceiptsRes.rows.map(r => r.notes));

  // 2. Preload club products
  const productsRes = await query(
    `SELECT id, name, barcode, barcodes, cost_price, selling_price, current_stock FROM warehouse_products WHERE club_id = $1`,
    [clubId]
  );
  const productsByBarcode = new Map<string, any>();
  const productsByName = new Map<string, any>();
  for (const p of productsRes.rows) {
    if (p.barcode) productsByBarcode.set(String(p.barcode).trim(), p);
    if (Array.isArray(p.barcodes)) {
      p.barcodes.forEach((bc: string) => productsByBarcode.set(String(bc).trim(), p));
    }
    productsByName.set(String(p.name || '').toLowerCase().trim(), p);
  }

  // 3. Preload combos
  const combosRes = await query(
    `SELECT c.id, c.name, c.smartshell_combo_id,
            ci.product_id, ci.quantity, ci.allocated_price,
            p.name as product_name, p.barcode as product_barcode, p.cost_price, p.selling_price
     FROM warehouse_combo_sets c
     JOIN warehouse_combo_items ci ON ci.combo_id = c.id
     JOIN warehouse_products p ON ci.product_id = p.id
     WHERE c.club_id = $1`,
    [clubId]
  );
  const combosMap = new Map<string, any[]>();
  for (const row of combosRes.rows) {
    const keySS = row.smartshell_combo_id ? `ss_${row.smartshell_combo_id}` : null;
    const keyName = `name_${String(row.name).toLowerCase().trim()}`;
    if (keySS) {
      if (!combosMap.has(keySS)) combosMap.set(keySS, []);
      combosMap.get(keySS)!.push(row);
    }
    if (!combosMap.has(keyName)) combosMap.set(keyName, []);
    combosMap.get(keyName)!.push(row);
  }

  for (const payment of validPayments) {
    const paymentNote = `SmartShell Чек #${payment.id}`;
    if (existingNotesSet.has(paymentNote)) continue;

    const itemsToDeduct: {
      productId?: number;
      goodTitle: string;
      goodBarcode?: string | null;
      goodCostPrice: number;
      goodSellingPrice: number;
      quantity: number;
      comboSetId?: string | null;
      comboTitle?: string | null;
    }[] = [];

    for (const item of payment.items) {
      if (item.type === "GOOD" && item.entity) {
        const qty = Math.max(1, Number(item.amount || 1));
        const totalItemPrice = Number(item.sum || 0);
        const unitPrice = totalItemPrice / qty;
        itemsToDeduct.push({
          goodTitle: (item.entity.title || "").trim(),
          goodBarcode: String(item.entity.id),
          goodCostPrice: Number(item.entity.wholesale_cost || 0),
          goodSellingPrice: unitPrice,
          quantity: qty,
        });
      } else if (item.type === "COMBO" && item.entity) {
        const comboEntity = item.entity;
        const comboAmount = Math.max(1, Number(item.amount || 1));
        const comboTitle = comboEntity.title || "Комбо";

        const comboItems = combosMap.get(`ss_${comboEntity.id}`) || combosMap.get(`name_${String(comboTitle).toLowerCase().trim()}`);
        if (comboItems && comboItems.length > 0) {
          for (const ci of comboItems) {
            itemsToDeduct.push({
              productId: ci.product_id,
              goodTitle: ci.product_name,
              goodBarcode: ci.product_barcode,
              goodCostPrice: Number(ci.cost_price || 0),
              goodSellingPrice: Number(ci.allocated_price || ci.selling_price || 0),
              quantity: Number(ci.quantity || 1) * comboAmount,
              comboSetId: ci.id,
              comboTitle: ci.name,
            });
          }
        } else if (Array.isArray(comboEntity.items)) {
          for (const ci of comboEntity.items) {
            if (ci.entity_type === "GOOD" && ci.entity) {
              const good = ci.entity;
              const itemQty = Number(ci.amount || 1) * comboAmount;
              itemsToDeduct.push({
                goodTitle: (good.title || "").trim(),
                goodBarcode: String(good.id),
                goodCostPrice: Number(good.wholesale_cost || 0),
                goodSellingPrice: Number(ci.price || good.cost || 0),
                quantity: itemQty,
                comboTitle: comboTitle,
              });
            }
          }
        }
      }
    }

    if (itemsToDeduct.length === 0) continue;

    const paymentType = payment.method === "CASH" ? "cash" : payment.method === "CARD" ? "card" : "mixed";
    const cashAmount = Number(payment.cash_sum || (payment.method === "CASH" ? payment.sum : 0));
    const cardAmount = Number(payment.card_sum || (payment.method === "CARD" ? payment.sum : 0));
    const totalAmount = Number(payment.sum || 0);
    const createdAt = payment.created_at ? new Date(payment.created_at) : new Date();

    const receiptRes = await query(
      `INSERT INTO shift_receipts (
         club_id, shift_id, created_by, warehouse_id,
         payment_type, cash_amount, card_amount, total_amount, notes,
         committed_at, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id`,
      [
        clubId,
        shiftId,
        userId,
        defaultWarehouseId,
        paymentType,
        cashAmount,
        cardAmount,
        totalAmount,
        paymentNote,
        createdAt,
      ]
    );

    const receiptId = receiptRes.rows[0]?.id;
    if (!receiptId) continue;
    existingNotesSet.add(paymentNote);

    for (const item of itemsToDeduct) {
      let productId = item.productId || null;

      if (!productId) {
        const found = (item.goodBarcode && productsByBarcode.get(item.goodBarcode)) || productsByName.get(item.goodTitle.toLowerCase().trim());
        if (found) {
          productId = found.id;
        } else {
          const newProd = await query(
            `INSERT INTO warehouse_products (club_id, name, barcode, cost_price, selling_price, current_stock)
             VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
            [clubId, item.goodTitle, item.goodBarcode || null, item.goodCostPrice, item.goodSellingPrice]
          );
          productId = newProd.rows[0].id;
          const createdObj = { id: productId, name: item.goodTitle, barcode: item.goodBarcode, current_stock: 0 };
          if (item.goodBarcode) productsByBarcode.set(item.goodBarcode, createdObj);
          productsByName.set(item.goodTitle.toLowerCase().trim(), createdObj);
        }
      }

      if (!productId) continue;

      let itemTargetWarehouseId = defaultWarehouseId;
      if (cashboxWarehouseIds.length > 0) {
        const stockCheck = await query(
          `SELECT warehouse_id FROM warehouse_stock 
           WHERE product_id = $1 AND warehouse_id = ANY($2::int[]) AND quantity > 0 
           ORDER BY array_position($2::int[], warehouse_id) ASC LIMIT 1`,
          [productId, cashboxWarehouseIds]
        );
        if (stockCheck.rows.length > 0) {
          itemTargetWarehouseId = stockCheck.rows[0].warehouse_id;
        } else {
          itemTargetWarehouseId = cashboxWarehouseIds[0];
        }
      }

      await query(
        `INSERT INTO shift_receipt_items (receipt_id, product_id, quantity, selling_price_snapshot, cost_price_snapshot, warehouse_id, combo_set_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [receiptId, productId, item.quantity, item.goodSellingPrice, item.goodCostPrice, itemTargetWarehouseId, item.comboSetId || null]
      );

      await query(
        `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
         VALUES ($1, $2, $3::int)
         ON CONFLICT (warehouse_id, product_id)
         DO UPDATE SET quantity = GREATEST(0, warehouse_stock.quantity - $4::int)`,
        [itemTargetWarehouseId, productId, -item.quantity, item.quantity]
      );

      const updatedProd = await query(
        `UPDATE warehouse_products 
         SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
         WHERE id = $1 AND club_id = $2
         RETURNING current_stock`,
        [productId, clubId]
      );

      const stockAfter = Number(updatedProd.rows[0]?.current_stock ?? 0);
      const previousStock = stockAfter + item.quantity;
      const newStock = stockAfter;

      // FIFO batch deduction for perishable goods
      try {
        const { deductProductBatches } = await import("@/app/clubs/[clubId]/inventory/actions/expiration");
        await deductProductBatches(
          { query },
          clubId,
          productId,
          itemTargetWarehouseId,
          item.quantity
        );
      } catch (batchErr) {
        console.warn("SmartShell sync deductProductBatches error:", batchErr);
      }

      const movementReason = item.comboTitle
        ? `Продажа через SmartShell POS (Комбо "${item.comboTitle}": ${item.goodTitle})`
        : `Продажа через SmartShell POS (${item.goodTitle})`;

      await query(
        `INSERT INTO warehouse_stock_movements
         (club_id, product_id, user_id, change_amount, previous_stock, new_stock, type, reason, related_entity_type, related_entity_id, shift_id, warehouse_id, price_at_time, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'SALE', $7, 'SHIFT_RECEIPT', $8, $9, $10, $11, $12)`,
        [
          clubId,
          productId,
          userId,
          -item.quantity,
          previousStock,
          newStock,
          movementReason,
          receiptId,
          shiftId,
          itemTargetWarehouseId,
          item.goodSellingPrice,
          createdAt,
        ]
      );
    }
  }
}
