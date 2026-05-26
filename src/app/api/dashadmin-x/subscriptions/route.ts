import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";
import {
  normalizeSubscriptionPlan,
  normalizeSubscriptionStatus,
  resolveSubscriptionState,
  getAllowedStatuses,
} from "@/lib/subscriptions";

async function ensureSuperAdmin() {
  const userId = (await cookies()).get("session_user_id")?.value;
  if (!userId)
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };

  const adminCheck = await query(
    `SELECT is_super_admin, phone_number FROM users WHERE id = $1`,
    [userId],
  );

  const canAccess = isSuperAdmin(
    adminCheck.rows[0]?.is_super_admin,
    userId,
    adminCheck.rows[0]?.phone_number,
  );

  if (!canAccess) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const };
}

export async function GET() {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    // Получаем каталог тарифов
    const catalogResult = await query(
      `SELECT code, name, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, is_active
             FROM subscription_plans
             WHERE is_active = TRUE
             ORDER BY display_order ASC`,
    );
    const catalog = catalogResult.rows;

    // Получаем подписки по КЛУБАМ (теперь это источник истины)
    const result = await query(
      `SELECT
                c.id as club_id,
                c.name as club_name,
                c.owner_id,
                u.full_name as owner_name,
                u.phone_number as owner_phone,
                c.subscription_plan,
                c.subscription_status,
                c.subscription_started_at,
                c.subscription_ends_at,
                c.subscription_canceled_at,
                c.created_at as club_created_at,
                (SELECT COUNT(*) FROM club_employees ce WHERE ce.club_id = c.id AND ce.is_active = TRUE) as employees_count
             FROM clubs c
             JOIN users u ON c.owner_id = u.id
             ORDER BY c.created_at DESC`,
    );

    const subscriptions = result.rows.map((row) => {
      const resolved = resolveSubscriptionState({
        subscription_plan: row.subscription_plan,
        subscription_status: row.subscription_status,
        subscription_ends_at: row.subscription_ends_at,
      });

      return {
        id: row.club_id, // Используем club_id как ID для строки
        club_id: row.club_id,
        club_name: row.club_name,
        owner_id: row.owner_id,
        full_name: row.owner_name,
        phone_number: row.owner_phone,
        created_at: row.club_created_at,
        employees_count: Number(row.employees_count || 0),
        subscription_plan: resolved.plan,
        subscription_status: resolved.status,
        subscription_started_at: row.subscription_started_at,
        subscription_ends_at: row.subscription_ends_at,
        subscription_canceled_at: row.subscription_canceled_at,
        subscription_is_active: resolved.isActive,
        is_in_grace_period: resolved.isInGracePeriod,
        grace_period_info: resolved.graceEndsAt
          ? {
              ends_at: resolved.graceEndsAt,
              days_left: resolved.gracePeriodDays,
            }
          : null,
      };
    });

    const summary = subscriptions.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.subscription_is_active) acc.active += 1;
        if (item.subscription_status === "trialing") acc.trialing += 1;
        if (item.subscription_status === "expired") acc.expired += 1;
        if (item.subscription_status === "canceled") acc.canceled += 1;
        return acc;
      },
      { total: 0, active: 0, trialing: 0, expired: 0, canceled: 0 },
    );

    // Получаем последние 50 заказов/логов платежей
    const ordersResult = await query(
      `SELECT
                o.id,
                o.club_id,
                o.user_id,
                o.plan_code,
                o.amount,
                o.status,
                o.period_unit,
                o.period_value,
                o.created_at,
                o.paid_at,
                c.name as club_name,
                u.full_name as owner_name,
                u.phone_number as owner_phone
             FROM subscription_orders o
             LEFT JOIN clubs c ON o.club_id = c.id
             LEFT JOIN users u ON o.user_id = u.id
             ORDER BY o.created_at DESC
             LIMIT 50`
    );

    return NextResponse.json({
      subscriptions,
      summary,
      orders: ordersResult.rows,
      meta: {
        plans: catalog,
        statuses: getAllowedStatuses(),
      },
    });
  } catch (error) {
    console.error("Get Subscriptions Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const targetClubId = body.targetClubId || body.id; // Поддержка обоих вариантов
    const targetUserId = body.targetUserId;

    const planToApply = normalizeSubscriptionPlan(body.plan);
    const statusToApply = normalizeSubscriptionStatus(body.status);
    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;

    const setParts: string[] = ["subscription_plan = $1"];
    const params: any[] = [planToApply];
    let paramIndex = 2;

    if (body.status) {
      setParts.push(`subscription_status = $${paramIndex}`);
      params.push(statusToApply);
      paramIndex++;
    }

    if (startsAt) {
      setParts.push(`subscription_started_at = $${paramIndex}`);
      params.push(startsAt);
      paramIndex++;
    }

    if (endsAt) {
      setParts.push(`subscription_ends_at = $${paramIndex}`);
      params.push(endsAt);
      paramIndex++;
    }

    if (body.cancel !== undefined) {
      setParts.push(
        `subscription_canceled_at = ${body.cancel ? "NOW()" : "NULL"}`,
      );
    }

    if (targetClubId) {
      params.push(targetClubId);
      await query(
        `UPDATE clubs SET ${setParts.join(", ")} WHERE id = $${paramIndex}`,
        params,
      );
    } else if (targetUserId) {
      // Legacy: обновить все клубы пользователя
      params.push(targetUserId);
      await query(
        `UPDATE clubs SET ${setParts.join(", ")} WHERE owner_id = $${paramIndex}`,
        params,
      );
      // Также обновим у самого пользователя для совместимости
      await query(
        `UPDATE users SET ${setParts.join(", ")} WHERE id = $${paramIndex}`,
        params,
      );
    } else {
      return NextResponse.json(
        { error: "Target ID is required" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update Subscription Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
