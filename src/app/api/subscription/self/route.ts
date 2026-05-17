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
    const plansResult = await query(
      `SELECT id, code, name, tagline, description, features, badge_text, badge_tone, cta_text, card_theme, display_order, is_highlighted, price_amount, price_per_extra_club, period_unit, period_value, is_active
         FROM subscription_plans
         WHERE is_active = TRUE AND is_public = TRUE
         ORDER BY display_order ASC, created_at DESC`,
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

    if (!planCode) {
      return NextResponse.json(
        { error: "Plan code is required" },
        { status: 400 },
      );
    }

    const planResult = await query(
      `SELECT code, name, price_amount, price_per_extra_club, period_unit, period_value, is_active
             FROM subscription_plans
             WHERE code = $1
             LIMIT 1`,
      [planCode],
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

    const now = new Date();
    const nextEndsAt = addPeriod(
      now,
      normalizePeriodUnit(plan.period_unit),
      Number(plan.period_value || 1),
    );
    const nextStatus = planCode === "new_user" ? "trialing" : "active";

    // 1. Создаем заказ (Order) - пока что он сразу "оплачен", так как у нас заглушка
    const orderResult = await query(
      `INSERT INTO subscription_orders
             (club_id, user_id, plan_code, amount, status, paid_at, period_unit, period_value)
             VALUES ($1, $2, $3, $4, 'paid', NOW(), $5, $6)
             RETURNING id`,
      [clubId, userId, planCode, amount, plan.period_unit, plan.period_value],
    );

    // 2. Обновляем подписку клуба
    let updatedCount = 0;
    if (clubId) {
      const res = await query(
        `UPDATE clubs
                 SET subscription_plan = $1,
                     subscription_status = $2,
                     subscription_started_at = CASE WHEN subscription_status = 'trialing' THEN NOW() ELSE subscription_started_at END,
                     subscription_ends_at = $3,
                     subscription_canceled_at = NULL
                 WHERE id = $4 AND owner_id = $5`,
        [planCode, nextStatus, nextEndsAt.toISOString(), clubId, userId],
      );
      updatedCount = res.rowCount || 0;
    } else {
      // Если clubId не передан, обновляем все клубы владельца (Legacy behavior)
      const res = await query(
        `UPDATE clubs
                 SET subscription_plan = $1,
                     subscription_status = $2,
                     subscription_ends_at = $3,
                     subscription_canceled_at = NULL
                 WHERE owner_id = $4`,
        [planCode, nextStatus, nextEndsAt.toISOString(), userId],
      );
      updatedCount = res.rowCount || 0;
    }

    return NextResponse.json({
      success: true,
      order_id: orderResult.rows[0].id,
      plan: {
        code: plan.code,
        name: plan.name,
        amount: amount,
      },
      updated_clubs_count: updatedCount,
      subscription_status: nextStatus,
      subscription_ends_at: nextEndsAt.toISOString(),
    });
  } catch (error) {
    console.error("Change Subscription Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
