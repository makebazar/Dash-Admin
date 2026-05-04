import { NextResponse } from "next/server";
import { query } from "@/db";
import { hasColumn } from "@/lib/db-compat";
import {
  resolveSubscriptionState,
  getGracePeriodInfo,
} from "@/lib/subscriptions";
import {
  getClubApiAccess,
  hasModuleAccess,
  ModuleAccessKey,
} from "@/lib/club-api-access";

export async function ensureOwnerSubscriptionActive(
  clubId: string | number,
  userId: string,
  module?: ModuleAccessKey,
  level: "view" | "edit" = "edit",
) {
  try {
    const access = await getClubApiAccess(String(clubId));

    let hasAccess = false;
    if (module) {
      hasAccess = hasModuleAccess(access, module, level, String(clubId));
    } else {
      hasAccess = access.isFullAccess;
    }

    if (!hasAccess || access.userId !== userId) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  } catch (error: any) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const hasSubscriptionStatus = await hasColumn("users", "subscription_status");
  const subscriptionResult = await query(
    `SELECT
            u.subscription_plan,
            ${hasSubscriptionStatus ? "u.subscription_status" : "NULL::varchar as subscription_status"},
            u.subscription_ends_at
         FROM clubs c
         JOIN users u ON u.id = c.owner_id
         WHERE c.id = $1`,
    [clubId],
  );

  if ((subscriptionResult.rowCount || 0) === 0) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Club not found" }, { status: 404 }),
    };
  }

  const subscriptionState = resolveSubscriptionState(
    subscriptionResult.rows[0],
  );

  if (!subscriptionState.isActive) {
    // Проверяем grace period
    if (subscriptionState.graceEndsAt) {
      const graceInfo = getGracePeriodInfo(
        subscriptionState.endsAt,
        subscriptionState.gracePeriodDays,
      );
      if (graceInfo) {
        return {
          ok: true as const,
          gracePeriod: true,
          graceDaysLeft: graceInfo.daysLeft,
        };
      }
    }

    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Подписка закончилась. Доступ к управлению клубом ограничен.",
        },
        { status: 402 },
      ),
    };
  }

  // Проверяем предупреждение о grace period
  if (subscriptionState.isInGracePeriod) {
    const graceInfo = getGracePeriodInfo(
      subscriptionState.endsAt,
      subscriptionState.gracePeriodDays,
    );
    return {
      ok: true as const,
      graceWarning: true,
      graceDaysLeft: graceInfo?.daysLeft ?? 0,
    };
  }

  return { ok: true as const };
}

export async function ensureClubSubscriptionActive(clubId: string | number) {
  const hasSubscriptionStatus = await hasColumn("users", "subscription_status");
  const subscriptionResult = await query(
    `SELECT
            u.subscription_plan,
            ${hasSubscriptionStatus ? "u.subscription_status" : "NULL::varchar as subscription_status"},
            u.subscription_ends_at
         FROM clubs c
         JOIN users u ON u.id = c.owner_id
         WHERE c.id = $1`,
    [clubId],
  );

  if ((subscriptionResult.rowCount || 0) === 0) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Club not found" }, { status: 404 }),
    };
  }

  const subscriptionState = resolveSubscriptionState(
    subscriptionResult.rows[0],
  );

  if (!subscriptionState.isActive) {
    if (subscriptionState.graceEndsAt) {
      const graceInfo = getGracePeriodInfo(
        subscriptionState.endsAt,
        subscriptionState.gracePeriodDays,
      );
      if (graceInfo) {
        return {
          ok: true as const,
          gracePeriod: true,
          graceDaysLeft: graceInfo.daysLeft,
        };
      }
    }

    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Подписка закончилась. Доступ к управлению клубом ограничен.",
        },
        { status: 402 },
      ),
    };
  }

  if (subscriptionState.isInGracePeriod) {
    const graceInfo = getGracePeriodInfo(
      subscriptionState.endsAt,
      subscriptionState.gracePeriodDays,
    );
    return {
      ok: true as const,
      graceWarning: true,
      graceDaysLeft: graceInfo?.daysLeft ?? 0,
    };
  }

  return { ok: true as const };
}
