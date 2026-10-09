import { query, getClient } from "@/db";
import { normalizePhone } from "@/lib/phone-utils";
import { calculateTicketsForAmount, calculateTicketsForBarAmount } from "@/lib/promo-accrual";
import { processBalanceTopupEvent, processReceiptEvent, processServiceEvent, processVisitEvent, ReceiptItem } from "@/lib/promo-quests";
import { getSmartShellClientForClub } from "@/lib/smartshell/shift-sync";

export interface ProcessPaymentResult {
  processed: boolean;
  alreadyProcessed?: boolean;
  ticketsAwarded: number;
  playerId?: string;
  paymentId?: number | string;
  error?: string;
}

/**
 * Обработка одного платежа SmartShell и начисление билетов Promo (за пополнение, пакеты и бар) с защитой от дублей
 */
export async function processSmartShellPaymentForPromo(
  dbClient: any,
  clubId: number,
  payment: {
    id: number | string;
    sum?: number | string;
    method?: string;
    created_at?: string;
    client?: {
      id?: number | string;
      phone?: string | null;
      login?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    } | null;
    items?: Array<{
      id?: number | string;
      type: string;
      sum?: number | string;
      amount?: number;
      entity?: {
        id?: number | string;
        title?: string;
        price?: number | string;
      } | null;
    }>;
  }
): Promise<ProcessPaymentResult> {
  const paymentId = String(payment.id);
  if (!paymentId) {
    return { processed: false, ticketsAwarded: 0, error: "Missing payment ID" };
  }

  // 1. Проверка дедупликации: был ли этот платёж SmartShell уже обработан в этом клубе
  const dupCheck = await dbClient.query(
    `SELECT id FROM promo_history 
     WHERE club_id = $1 AND result_data->>'smartshell_payment_id' = $2
     LIMIT 1`,
    [clubId, paymentId]
  );

  if (dupCheck.rows.length > 0) {
    return { processed: false, alreadyProcessed: true, ticketsAwarded: 0, paymentId };
  }

  // 2. Извлечение и нормализация номера телефона клиента
  const rawPhone = payment.client?.phone || payment.client?.login || "";
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    // Платёж анонимный или без телефона (например, гостевой чек без привязки к аккаунту)
    return { processed: false, ticketsAwarded: 0, paymentId, error: "No client phone number in payment" };
  }

  const paymentMethod = String(payment.method || "").toUpperCase();
  const isInternalDepositSpend = paymentMethod === "DEPOSIT" || paymentMethod === "BONUS";

  // 3. Вычисление сумм по категориям: Пополнение/Тарифы и Бар/Товары
  let topupAmount = 0;
  let barAmount = 0;
  const barProductNames: string[] = [];
  const barReceiptItems: ReceiptItem[] = [];
  const packageItems: Array<{ id: string; title: string; quantity: number }> = [];

  if (Array.isArray(payment.items) && payment.items.length > 0) {
    for (const item of payment.items) {
      const itemType = String(item.type || "").toUpperCase();
      const itemSum = Number(item.sum || 0);
      const itemQty = Number(item.amount || 1);

      if (itemType === "DEPOSIT" || itemType === "TARIFF" || itemType === "SERVICE") {
        if (!isInternalDepositSpend) {
          // Реальные деньги (CASH, CARD) засчитываются в сумму пополнения
          topupAmount += itemSum;
        }
        if (itemType === "TARIFF" || itemType === "SERVICE") {
          packageItems.push({
            id: String(item.entity?.id || item.id || ""),
            title: String(item.entity?.title || "Игровой пакет"),
            quantity: itemQty,
          });
        }
      } else if (itemType === "GOOD" || itemType === "COMBO") {
        if (!isInternalDepositSpend) {
          barAmount += itemSum;
        }
        const title = item.entity?.title || "Товар";
        barProductNames.push(`${title} x${itemQty}`);

        let matchedProductId: number | null = item.entity?.id ? Number(item.entity.id) : null;
        if (item.entity?.title) {
          const wpMatch = await dbClient.query(
            `SELECT id FROM warehouse_products WHERE club_id = $1 AND (id = $2 OR LOWER(TRIM(name)) = LOWER(TRIM($3))) LIMIT 1`,
            [clubId, matchedProductId || -1, item.entity.title]
          );
          if (wpMatch.rows.length > 0) {
            matchedProductId = wpMatch.rows[0].id;
          }
        }
        if (matchedProductId) {
          barReceiptItems.push({
            product_id: matchedProductId,
            quantity: itemQty,
          });
        }
      }
    }
  }

  // Если разбивки по items нет, используем общую сумму платежа только если это реальные деньги
  if (topupAmount <= 0 && barAmount <= 0 && !isInternalDepositSpend) {
    topupAmount = Number(payment.sum || 0);
  }

  // 4. Получаем настройки Promo клуба
  const clubRes = await dbClient.query(
    `SELECT promo_settings FROM clubs WHERE id = $1`,
    [clubId]
  );
  const promoSettings = clubRes.rows[0]?.promo_settings || {};

  // 5. Поиск или создание игрока в promo_players
  let playerId: string;
  const playerRes = await dbClient.query(
    `SELECT id FROM promo_players WHERE phone_number = $1 LIMIT 1`,
    [phone]
  );

  const clientName = [payment.client?.first_name, payment.client?.last_name]
    .filter(Boolean)
    .join(" ") || "Гость SmartShell";

  if (playerRes.rows.length === 0) {
    const newPlayerRes = await dbClient.query(
      `INSERT INTO promo_players (phone_number, full_name, pin_hash)
       VALUES ($1, $2, 'PENDING')
       RETURNING id`,
      [phone, clientName]
    );
    playerId = newPlayerRes.rows[0].id;
  } else {
    playerId = playerRes.rows[0].id;
  }

  // 6. Гарантируем наличие баланса игрока в этом клубе
  await dbClient.query(
    `INSERT INTO promo_player_balances (player_id, club_id)
     VALUES ($1, $2)
     ON CONFLICT (player_id, club_id) DO NOTHING`,
    [playerId, clubId]
  );

  let totalTicketsAwarded = 0;

  // 7. Обработка пополнения баланса / тарифов
  if (topupAmount > 0 || packageItems.length > 0) {
    const topupTickets = topupAmount > 0 && promoSettings.topup_accrual_enabled !== false
      ? calculateTicketsForAmount(topupAmount, promoSettings)
      : 0;

    const tariffTicketRules: Record<string, number> = promoSettings.tariff_ticket_rules || {};
    let packageTickets = 0;
    const awardedPackageDescriptions: string[] = [];

    for (const pkg of packageItems) {
      const ticketsPerUnit = Number(tariffTicketRules[pkg.id] || 0);
      if (ticketsPerUnit > 0) {
        const awarded = ticketsPerUnit * (pkg.quantity || 1);
        packageTickets += awarded;
        awardedPackageDescriptions.push(`${pkg.title} x${pkg.quantity || 1}`);
      }
    }

    const historyRes = await dbClient.query(
      `INSERT INTO promo_history (player_id, club_id, game_type, prize_id, result_data)
       VALUES ($1, $2, 'smartshell_topup', NULL, $3)
       RETURNING id`,
      [
        playerId,
        clubId,
        JSON.stringify({
          smartshell_payment_id: paymentId,
          amount: topupAmount,
          spent_deposit: isInternalDepositSpend ? Number(payment.sum || 0) : undefined,
          method: payment.method || "SMARTSHELL",
          tickets_awarded: topupTickets + packageTickets,
          tariff_tickets_awarded: packageTickets,
          packages_summary: awardedPackageDescriptions.length > 0 ? awardedPackageDescriptions.join(", ") : undefined,
          packages: packageItems.length > 0 ? packageItems : undefined,
          created_at: payment.created_at || new Date().toISOString(),
        }),
      ]
    );
    const topupHistoryId = historyRes.rows[0].id;

    if (topupTickets > 0) {
      await dbClient.query(
        `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at, history_id)
         SELECT $1::uuid, $2::int, 'available', 'smartshell_topup', NULL, $3::uuid
         FROM generate_series(1, $4)`,
        [playerId, clubId, topupHistoryId, Math.floor(topupTickets)]
      );
      totalTicketsAwarded += topupTickets;
    }

    if (packageTickets > 0) {
      await dbClient.query(
        `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at, history_id)
         SELECT $1::uuid, $2::int, 'available', 'smartshell_tariff', NULL, $3::uuid
         FROM generate_series(1, $4)`,
        [playerId, clubId, topupHistoryId, Math.floor(packageTickets)]
      );
      totalTicketsAwarded += packageTickets;
    }

    // Продвижение квестов на пополнение баланса (только реальные деньги)
    if (topupAmount > 0) {
      try {
        await processBalanceTopupEvent(dbClient, clubId, playerId, topupAmount);
      } catch (questErr) {
        console.warn("[Promo Sync] Quest topup progress error:", questErr);
      }
    }

    // Продвижение квестов и лояльности на покупку пакетов/тарифов
    for (const pkg of packageItems) {
      try {
        await processServiceEvent(dbClient, clubId, playerId, pkg.id, pkg.quantity);
      } catch (pkgErr) {
        console.warn("[Promo Sync] Package loyalty/quest progress error:", pkgErr);
      }
    }
  }

  // 8. Обработка покупок в баре (GOOD / COMBO)
  if (barAmount > 0 && promoSettings.bar_accrual_enabled !== false) {
    const barTickets = calculateTicketsForBarAmount(barAmount, promoSettings);
    const barProductsSummary = barProductNames.join(", ");

    const historyRes = await dbClient.query(
      `INSERT INTO promo_history (player_id, club_id, game_type, prize_id, result_data)
       VALUES ($1, $2, 'pos_sale', NULL, $3)
       RETURNING id`,
      [
        playerId,
        clubId,
        JSON.stringify({
          smartshell_payment_id: paymentId,
          amount: barAmount,
          bar_products: barProductsSummary,
          method: payment.method || "SMARTSHELL",
          tickets_awarded: barTickets,
          created_at: payment.created_at || new Date().toISOString(),
        }),
      ]
    );
    const barHistoryId = historyRes.rows[0].id;

    if (barTickets > 0) {
      await dbClient.query(
        `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at, history_id)
         SELECT $1::uuid, $2::int, 'available', 'pos_sale', NULL, $3::uuid
         FROM generate_series(1, $4)`,
        [playerId, clubId, barHistoryId, Math.floor(barTickets)]
      );
      totalTicketsAwarded += barTickets;
    }

    // Продвижение квестов на покупки в баре
    try {
      await processReceiptEvent(
        dbClient,
        clubId,
        playerId,
        paymentId,
        barAmount,
        barReceiptItems
      );
    } catch (questErr) {
      console.warn("[Promo Sync] Quest bar progress error:", questErr);
    }
  }

  return {
    processed: true,
    ticketsAwarded: totalTicketsAwarded,
    playerId,
    paymentId,
  };
}

/**
 * Автоматическое отслеживание визитов клиентов из игровых сессий SmartShell (порог по умолчанию 30 минут)
 */
export async function syncSmartShellSessionsForVisits(
  dbClient: any,
  clubId: number | string
): Promise<{ processedCount: number }> {
  const clubIdInt = typeof clubId === "string" ? parseInt(clubId, 10) : clubId;
  if (isNaN(clubIdInt)) return { processedCount: 0 };

  const ssClient = await getSmartShellClientForClub(clubIdInt);
  if (!ssClient) return { processedCount: 0 };

  // Получаем настройки клуба для минимального порога времени
  const clubRes = await dbClient.query(
    `SELECT promo_settings FROM clubs WHERE id = $1`,
    [clubIdInt]
  );
  const promoSettings = clubRes.rows[0]?.promo_settings || {};
  const minVisitMinutes = Number(promoSettings.min_visit_minutes || 30);
  const minVisitSeconds = minVisitMinutes * 60;

  try {
    const hosts = await ssClient.getClubHostsWithSessions();
    let visitCount = 0;

    for (const host of hosts) {
      if (!Array.isArray(host.client_sessions)) continue;

      for (const session of host.client_sessions) {
        const rawPhone = session.client?.phone || session.client?.login || "";
        const phone = normalizePhone(rawPhone);
        if (!phone) continue;

        const playedSeconds = Number(session.elapsed || session.duration || 0);
        if (playedSeconds < minVisitSeconds) {
          // Меньше минимального порога (30 мин) — пропускаем
          continue;
        }

        // Поиск или создание игрока
        const clientName = [session.client?.first_name, session.client?.last_name]
          .filter(Boolean)
          .join(" ") || "Гость SmartShell";

        let playerId: string;
        const playerRes = await dbClient.query(
          `SELECT id FROM promo_players WHERE phone_number = $1 LIMIT 1`,
          [phone]
        );
        if (playerRes.rows.length === 0) {
          const newPlayerRes = await dbClient.query(
            `INSERT INTO promo_players (phone_number, full_name, pin_hash)
             VALUES ($1, $2, 'PENDING')
             RETURNING id`,
            [phone, clientName]
          );
          playerId = newPlayerRes.rows[0].id;
        } else {
          playerId = playerRes.rows[0].id;
        }

        // Проверяем, зафиксирован ли уже визит за сегодня (CURRENT_DATE)
        const visitCheck = await dbClient.query(
          `SELECT id FROM promo_history 
           WHERE player_id = $1 AND club_id = $2 AND game_type = 'VISIT' AND created_at >= CURRENT_DATE
           LIMIT 1`,
          [playerId, clubIdInt]
        );

        if (visitCheck.rows.length === 0) {
          const zoneId = host.group?.id ? String(host.group.id) : undefined;
          const zoneTitle = host.group?.title || undefined;

          // Записываем визит
          await dbClient.query(
            `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
             VALUES ($1, $2, 'VISIT', $3)`,
            [
              playerId,
              clubIdInt,
              JSON.stringify({
                session_id: session.id,
                elapsed_seconds: playedSeconds,
                host_alias: host.alias || String(host.id),
                zone_id: zoneId,
                zone_title: zoneTitle,
                source: "smartshell_session",
                created_at: new Date().toISOString(),
              }),
            ]
          );

          // Продвигаем квесты на серии посещений и лояльность с учетом зоны
          await processVisitEvent(dbClient, clubIdInt, playerId, host.alias || undefined, zoneId);
          visitCount++;
        }
      }
    }

    return { processedCount: visitCount };
  } catch (err) {
    console.warn("[SmartShell Sessions Visit Sync Error]:", err);
    return { processedCount: 0 };
  }
}

/**
 * Синхронизация платежей и сессий активной смены SmartShell для начисления тикетов, визитов и пакетов Promo
 */
export async function syncSmartShellPaymentsForPromo(clubId: number | string): Promise<{
  synced: boolean;
  processedCount: number;
  totalTicketsAwarded: number;
  visitsProcessed?: number;
  message?: string;
}> {
  const clubIdInt = typeof clubId === "string" ? parseInt(clubId, 10) : clubId;
  if (isNaN(clubIdInt)) return { synced: false, processedCount: 0, totalTicketsAwarded: 0 };

  const ssClient = await getSmartShellClientForClub(clubIdInt);
  if (!ssClient) return { synced: false, processedCount: 0, totalTicketsAwarded: 0, message: "No SmartShell client" };

  try {
    const activeShift = await ssClient.getActiveWorkShift();
    if (!activeShift || !Array.isArray(activeShift.payments)) {
      return { synced: true, processedCount: 0, totalTicketsAwarded: 0 };
    }

    const client = await getClient();
    let processedCount = 0;
    let totalTickets = 0;
    let visitsCount = 0;

    try {
      await client.query("BEGIN");

      for (const p of activeShift.payments) {
        const result = await processSmartShellPaymentForPromo(client, clubIdInt, p as any);
        if (result.processed) {
          processedCount++;
          totalTickets += result.ticketsAwarded;
        }
      }

      // Отслеживание визитов клиентов по сессиям ПК (>= 30 минут)
      const visitRes = await syncSmartShellSessionsForVisits(client, clubIdInt);
      visitsCount = visitRes.processedCount;

      await client.query("COMMIT");
    } catch (dbErr) {
      await client.query("ROLLBACK");
      throw dbErr;
    } finally {
      client.release();
    }

    return {
      synced: true,
      processedCount,
      totalTicketsAwarded: totalTickets,
      visitsProcessed: visitsCount,
    };
  } catch (err: any) {
    console.error("[Promo SmartShell Sync Error]:", err);
    return { synced: false, processedCount: 0, totalTicketsAwarded: 0, message: err.message };
  }
}

const lastOnDemandSyncMap = new Map<string, number>();

/**
 * Мгновенная синхронизация по требованию (On-Demand) при входе/активности гостя в /promo
 * Проверяет платежи и сессии конкретного гостя по номеру телефона (с троттлингом 30 сек)
 */
export async function syncClientRecentPaymentsOnDemand(
  clubId: number | string,
  phoneNumber: string
): Promise<{ processed: boolean; ticketsAwarded: number }> {
  const clubIdInt = typeof clubId === "string" ? parseInt(clubId, 10) : clubId;
  const phone = normalizePhone(phoneNumber);
  if (isNaN(clubIdInt) || !phone) return { processed: false, ticketsAwarded: 0 };

  const cacheKey = `${clubIdInt}_${phone}`;
  const now = Date.now();
  const lastSync = lastOnDemandSyncMap.get(cacheKey) || 0;
  if (now - lastSync < 30_000) {
    // Недавно уже проверяли, пропускаем повторный опрос SmartShell
    return { processed: false, ticketsAwarded: 0 };
  }
  lastOnDemandSyncMap.set(cacheKey, now);

  const ssClient = await getSmartShellClientForClub(clubIdInt);
  if (!ssClient) return { processed: false, ticketsAwarded: 0 };

  try {
    const activeShift = await ssClient.getActiveWorkShift();
    if (!activeShift || !Array.isArray(activeShift.payments)) {
      return { processed: false, ticketsAwarded: 0 };
    }

    const clientPayments = activeShift.payments.filter((p: any) => {
      const pPhone = normalizePhone(p.client?.phone || p.client?.login || "");
      return pPhone === phone;
    });

    const dbClient = await getClient();
    let totalAwarded = 0;
    let anyProcessed = false;

    try {
      await dbClient.query("BEGIN");
      for (const p of clientPayments) {
        const res = await processSmartShellPaymentForPromo(dbClient, clubIdInt, p as any);
        if (res.processed) {
          anyProcessed = true;
          totalAwarded += res.ticketsAwarded;
        }
      }

      // Проверяем сессии на визиты
      await syncSmartShellSessionsForVisits(dbClient, clubIdInt);

      await dbClient.query("COMMIT");
    } catch (e) {
      await dbClient.query("ROLLBACK");
      throw e;
    } finally {
      dbClient.release();
    }

    return { processed: anyProcessed, ticketsAwarded: totalAwarded };
  } catch (err) {
    console.warn("[On-Demand Promo Sync Error]:", err);
    return { processed: false, ticketsAwarded: 0 };
  }
}
