import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/db";

const normalizePeriodUnit = (value: string | null | undefined) => {
  if (value === "day" || value === "month" || value === "year") return value;
  return "month";
};

const addPeriod = (base: Date, unit: string, value: number) => {
  const next = new Date(base);
  if (unit === "day") {
    next.setDate(next.getDate() + value);
    return next;
  }
  if (unit === "year") {
    next.setFullYear(next.getFullYear() + value);
    return next;
  }
  next.setMonth(next.getMonth() + value);
  return next;
};

async function getOwnerClubIds(userId: string) {
  const result = await query(`SELECT id FROM clubs WHERE owner_id = $1`, [
    userId,
  ]);
  return result.rows.map((row) => Number(row.id));
}

export async function GET(request: Request) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");

    // Получаем тарифы
    const plansResult = clubId
      ? await query(
          `SELECT sp.id, sp.code, sp.name, sp.tagline, sp.description, sp.features, sp.badge_text, sp.badge_tone, sp.cta_text, sp.card_theme, sp.display_order, sp.is_highlighted, sp.price_amount, sp.price_per_extra_club, sp.period_unit, sp.period_value, sp.is_active
             FROM subscription_plans sp
             WHERE sp.is_active = TRUE
               AND (
                 (sp.is_public = TRUE AND NOT EXISTS (SELECT 1 FROM subscription_plan_allowed_clubs spac WHERE spac.plan_id = sp.id))
                 OR
                 (EXISTS (SELECT 1 FROM subscription_plan_allowed_clubs spac WHERE spac.plan_id = sp.id AND spac.club_id = $1))
               )
             ORDER BY sp.display_order ASC, sp.created_at DESC`,
          [Number(clubId)]
        )
      : await query(
          `SELECT sp.id, sp.code, sp.name, sp.tagline, sp.description, sp.features, sp.badge_text, sp.badge_tone, sp.cta_text, sp.card_theme, sp.display_order, sp.is_highlighted, sp.price_amount, sp.price_per_extra_club, sp.period_unit, sp.period_value, sp.is_active
             FROM subscription_plans sp
             WHERE sp.is_active = TRUE AND sp.is_public = TRUE
               AND NOT EXISTS (SELECT 1 FROM subscription_plan_allowed_clubs spac WHERE spac.plan_id = sp.id)
             ORDER BY sp.display_order ASC, sp.created_at DESC`
        );

    // Находим "основной" клуб (самый старый из активных), который всегда платит 100% цены
    const primaryClubResult = await query(
      `SELECT id FROM clubs
       WHERE owner_id = $1
         AND subscription_status = 'active'
         AND (subscription_ends_at > NOW() OR subscription_ends_at IS NULL)
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId],
    );
    const primaryActiveClubId = primaryClubResult.rows[0]?.id
      ? Number(primaryClubResult.rows[0].id)
      : null;

    // Скидка применяется только если у пользователя есть активный клуб, и мы сейчас смотрим НЕ на него
    const isDiscountApplicable =
      primaryActiveClubId !== null &&
      (clubId ? Number(clubId) !== primaryActiveClubId : false);

    // Если запрашиваем для конкретного клуба, получаем его текущий статус
    let currentStatus = null;
    if (clubId) {
      const clubRes = await query(
        `SELECT subscription_plan, subscription_status, subscription_ends_at
                 FROM clubs WHERE id = $1 AND owner_id = $2`,
        [clubId, userId],
      );
      currentStatus = clubRes.rows[0] || null;
    }

    return NextResponse.json({
      plans: plansResult.rows.map((plan) => ({
        ...plan,
        // Если скидка применима, показываем цену для доп. клуба
        current_price:
          isDiscountApplicable && plan.price_per_extra_club > 0
            ? plan.price_per_extra_club
            : plan.price_amount,
      })),
      current: currentStatus,
      has_active_clubs: primaryActiveClubId !== null, // Оставляем для совместимости, но логика цены теперь опирается на isDiscountApplicable
    });
  } catch (error) {
    console.error("Get Self Subscription Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const planCode = String(body?.plan_code || "")
      .trim()
      .toLowerCase();
    const clubId = body?.club_id ? Number(body.club_id) : null;

    if (!clubId) {
      return NextResponse.json(
        { error: "Club ID is required" },
        { status: 400 }
      );
    }

    // Проверяем, что пользователь является владельцем клуба
    const clubCheck = await query(
      `SELECT id FROM clubs WHERE id = $1 AND owner_id = $2 LIMIT 1`,
      [clubId, userId]
    );

    if ((clubCheck.rowCount || 0) === 0) {
      return NextResponse.json(
        { error: "У вас нет прав для управления подпиской этого клуба." },
        { status: 403 }
      );
    }

    if (!planCode) {
      return NextResponse.json(
        { error: "Plan code is required" },
        { status: 400 },
      );
    }

    const planResult = await query(
      `SELECT sp.code, sp.name, sp.price_amount, sp.price_per_extra_club, sp.period_unit, sp.period_value, sp.is_active
       FROM subscription_plans sp
       WHERE sp.code = $1
         AND sp.is_active = TRUE
         AND (
           (sp.is_public = TRUE AND NOT EXISTS (SELECT 1 FROM subscription_plan_allowed_clubs spac WHERE spac.plan_id = sp.id))
           OR
           (EXISTS (SELECT 1 FROM subscription_plan_allowed_clubs spac WHERE spac.plan_id = sp.id AND spac.club_id = $2))
         )
       LIMIT 1`,
      [planCode, clubId],
    );

    if ((planResult.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const plan = planResult.rows[0];

    // Определяем цену
    const primaryClubResult = await query(
      `SELECT id FROM clubs
       WHERE owner_id = $1
         AND subscription_status = 'active'
         AND (subscription_ends_at > NOW() OR subscription_ends_at IS NULL)
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId],
    );
    const primaryActiveClubId = primaryClubResult.rows[0]?.id
      ? Number(primaryClubResult.rows[0].id)
      : null;
    const isDiscountApplicable =
      primaryActiveClubId !== null &&
      (clubId ? Number(clubId) !== primaryActiveClubId : false);

    const amount =
      isDiscountApplicable && plan.price_per_extra_club > 0
        ? plan.price_per_extra_club
        : plan.price_amount;

    const userResult = await query(
      `SELECT phone_number, full_name FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if ((userResult.rowCount || 0) === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const owner = userResult.rows[0];

    // 1. Создаем заказ (Order) со статусом 'pending'
    const orderResult = await query(
      `INSERT INTO subscription_orders
             (club_id, user_id, plan_code, amount, status, period_unit, period_value, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW(), NOW())
             RETURNING id`,
      [clubId, userId, planCode, amount, plan.period_unit, plan.period_value]
    );

    const orderId = orderResult.rows[0].id;
    const vat = Number(process.env.CLOUDKASSIR_VAT ?? -1);
    const taxationSystem = Number(process.env.CLOUDKASSIR_TAXATION_SYSTEM ?? 1);

    // 2. Формируем чек для CloudKassir (54-ФЗ)
    const receipt = {
      Items: [
        {
          label: `Подписка DashAdmin: тариф "${plan.name}"`,
          price: Number(amount),
          quantity: 1.00,
          amount: Number(amount),
          vat: vat,
          method: 0, // Предоплата 100%
          object: 4  // Услуга
        }
      ],
      items: [
        {
          label: `Подписка DashAdmin: тариф "${plan.name}"`,
          price: Number(amount),
          quantity: 1.00,
          amount: Number(amount),
          vat: vat,
          method: 0, // Предоплата 100%
          object: 4  // Услуга
        }
      ],
      taxationSystem: taxationSystem,
      taxationsystem: taxationSystem,
      phone: owner.phone_number,
      amounts: {
        electronic: Number(amount),
        Electronic: Number(amount)
      }
    };

    return NextResponse.json({
      success: true,
      order_id: orderId,
      amount: amount,
      plan_code: planCode,
      phone_number: owner.phone_number,
      publicTerminalId: process.env.NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID ?? "test_api_00000000000000000000002",
      publicId: process.env.NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID ?? "test_api_00000000000000000000002",
      receipt: receipt,
      plan: {
        code: plan.code,
        name: plan.name,
        amount: amount,
        period_unit: plan.period_unit,
        period_value: plan.period_value
      }
    });
  } catch (error) {
    console.error("Change Subscription Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
