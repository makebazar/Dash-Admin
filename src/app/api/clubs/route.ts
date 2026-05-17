import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import {
  normalizeSubscriptionPlan,
  normalizeSubscriptionStatus,
  resolveSubscriptionState,
} from "@/lib/subscriptions";
import { hasColumn } from "@/lib/db-compat";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export async function GET() {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Получить все клубы владельца и клубы, где пользователь является управляющим
    const hasPublicId = await hasColumn("clubs", "public_id");
    const publicIdColumn = hasPublicId
      ? "c.public_id"
      : "c.id::text as public_id";

    const result = await query(
      `SELECT DISTINCT ON (c.id)
                    c.id,
                    ${publicIdColumn},
                    c.name,
                    c.address,
                    c.created_at,
                    c.subscription_plan,
                    c.subscription_status,
                    c.subscription_ends_at,
                    CASE
                        WHEN c.owner_id = $1 THEN TRUE
                        WHEN ce.role = 'Владелец' THEN TRUE
                        ELSE FALSE
                    END as is_owner,
                    CASE
                        WHEN c.owner_id = $1 THEN 'Владелец'
                        WHEN ce.user_id = $1 THEN ce.role
                        WHEN r_global.name IS NOT NULL THEN r_global.name
                        ELSE 'Сотрудник'
                    END as role,
                    COALESCE(r_club.employee_access_settings, r_global.employee_access_settings, '{}'::jsonb) as permissions,
                    (SELECT u.full_name
                     FROM shifts s
                     JOIN users u ON s.user_id = u.id
                     WHERE s.club_id = c.id AND s.check_out IS NULL
                     ORDER BY s.check_in DESC LIMIT 1) as active_shift_user,
                    (SELECT COALESCE(SUM(
                        COALESCE(s.cash_income, 0) +
                        COALESCE(s.card_income, 0) +
                        COALESCE((
                            SELECT SUM(
                                CASE
                                    WHEN jsonb_typeof(kv.v) = 'number' THEN (kv.v)::text::numeric
                                    WHEN jsonb_typeof(kv.v) = 'string' AND kv.v->>0 ~ '^-?[0-9.]+$' THEN (kv.v->>0)::numeric
                                    WHEN jsonb_typeof(kv.v) = 'object' AND (kv.v)->'value' IS NOT NULL AND jsonb_typeof((kv.v)->'value') = 'number' THEN ((kv.v)->'value')::text::numeric
                                    ELSE 0
                                END
                            )
                            FROM jsonb_each(s.report_data) as kv(k, v)
                            WHERE kv.k IN (
                                SELECT f->>'metric_key'
                                    FROM club_report_templates t, jsonb_array_elements(t.schema) f
                                    WHERE t.club_id = s.club_id AND t.is_active = TRUE
                                      AND f->>'field_type' = 'INCOME'
                                      AND f->>'metric_key' NOT IN ('cash_income', 'card_income')
                            )
                        ), 0)
                     ), 0)
                     FROM shifts s
                     WHERE s.club_id = c.id
                       AND s.status NOT IN ('ACTIVE', 'CANCELLED')
                       AND date_trunc('month', s.check_in) = date_trunc('month', CURRENT_DATE)) as monthly_revenue             FROM clubs c
             LEFT JOIN club_employees ce ON ce.club_id = c.id
                AND ce.user_id = $1
                AND ce.is_active = TRUE
                AND ce.dismissed_at IS NULL
             LEFT JOIN users u ON u.id = $1
             LEFT JOIN roles r_global ON r_global.id = u.role_id
             LEFT JOIN roles r_club ON r_club.id = ce.role_id
             WHERE c.owner_id = $1
                OR (
                    ce.user_id = $1
                    AND ce.is_active = TRUE
                    AND ce.dismissed_at IS NULL
                )
             ORDER BY c.id, c.created_at DESC`,
      [userId],
    );

    // Filter clubs based on permissions (universally)
    const filteredClubs = result.rows.filter((club) => {
      if (club.is_owner) return true;

      const perms = club.permissions || {};
      // If employee_only is true, this club shouldn't be in the management dashboard
      if (perms.employee_only === true) return false;

      return true;
    });

    return NextResponse.json({ clubs: filteredClubs });
  } catch (error) {
    console.error("Get Clubs Error:", error);
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

    if (!isUuid(userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, address } = body ?? {};

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Club name is required" },
        { status: 400 },
      );
    }

    const hasSubscriptionPlan = await hasColumn("users", "subscription_plan");
    const hasSubscriptionStatus = await hasColumn(
      "users",
      "subscription_status",
    );
    const hasSubscriptionStartedAt = await hasColumn(
      "users",
      "subscription_started_at",
    );
    const hasSubscriptionEndsAt = await hasColumn(
      "users",
      "subscription_ends_at",
    );
    const hasSubscriptionCanceledAt = await hasColumn(
      "users",
      "subscription_canceled_at",
    );
    const hasPublicId = await hasColumn("clubs", "public_id");

    const ownerResult = await query(
      `SELECT
                u.id,
                u.full_name,
                u.phone_number,
                ${hasSubscriptionPlan ? "u.subscription_plan" : "NULL::varchar as subscription_plan"},
                ${hasSubscriptionStatus ? "u.subscription_status" : "NULL::varchar as subscription_status"},
                ${hasSubscriptionEndsAt ? "u.subscription_ends_at" : "NULL::timestamp as subscription_ends_at"},
                (
                    SELECT COUNT(*)
                    FROM clubs c
                    WHERE c.owner_id = u.id
                )::integer as owned_clubs
             FROM users u
             WHERE u.id = $1`,
      [userId],
    );

    if (ownerResult.rowCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const owner = ownerResult.rows[0];
    const ownedClubs = Number(owner.owned_clubs || 0);
    let planToApply = normalizeSubscriptionPlan(owner.subscription_plan);
    let statusToApply = normalizeSubscriptionStatus(owner.subscription_status);
    let endsAtToApply = owner.subscription_ends_at;

    if (ownedClubs === 0) {
      planToApply = "new_user";
      statusToApply = "trialing";
      endsAtToApply = hasSubscriptionEndsAt
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Create CRM lead for the new user
      try {
        // Check if lead already exists by phone
        const leadCheck = await query(
          "SELECT id FROM crm_leads WHERE phone = $1 LIMIT 1",
          [owner.phone_number],
        );

        if (leadCheck.rowCount === 0) {
          // Get next position for 'new' status
          const posResult = await query(
            "SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM crm_leads WHERE status = 'new'",
          );
          const nextPosition = posResult.rows[0].next_pos;

          const leadResult = await query(
            `INSERT INTO crm_leads (name, contact_person, phone, status, notes, position, address)
             VALUES ($1, $2, $3, 'new', $4, $5, $6) RETURNING id`,
            [
              name.trim(),
              owner.full_name,
              owner.phone_number,
              `Создал первый клуб в системе.`,
              nextPosition,
              address?.trim() || null,
            ],
          );

          if (leadResult.rowCount !== null && leadResult.rowCount > 0) {
            const leadId = leadResult.rows[0].id;
            await query(
              `INSERT INTO crm_contacts (lead_id, name, phone, role)
               VALUES ($1, $2, $3, $4)`,
              [leadId, owner.full_name, owner.phone_number, "Владелец"],
            );
          }
        }
      } catch (crmError) {
        // Don't fail club creation if CRM lead creation fails
        console.error("Failed to create CRM lead:", crmError);
      }
    }

    const subscriptionState = resolveSubscriptionState({
      subscription_plan: planToApply,
      subscription_status: statusToApply,
      subscription_ends_at: endsAtToApply,
    });

    if (!subscriptionState.isActive) {
      return NextResponse.json(
        { error: "Подписка неактивна. Создание клуба недоступно." },
        { status: 403 },
      );
    }

    const setParts: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (
      owner.subscription_plan !== planToApply ||
      owner.subscription_status !== statusToApply ||
      owner.subscription_ends_at !== endsAtToApply
    ) {
      let statusParamIndex: number | null = null;

      if (hasSubscriptionPlan) {
        setParts.push(`subscription_plan = $${i}`);
        params.push(planToApply);
        i += 1;
      }

      if (hasSubscriptionStatus) {
        statusParamIndex = i;
        setParts.push(`subscription_status = $${i}`);
        params.push(statusToApply);
        i += 1;
      }

      if (hasSubscriptionStartedAt) {
        setParts.push(
          `subscription_started_at = COALESCE(subscription_started_at, NOW())`,
        );
      }

      if (hasSubscriptionEndsAt) {
        setParts.push(`subscription_ends_at = $${i}::timestamp`);
        params.push(endsAtToApply);
        i += 1;
      }

      if (hasSubscriptionCanceledAt) {
        if (statusParamIndex !== null) {
          setParts.push(
            `subscription_canceled_at = CASE WHEN $${statusParamIndex}::varchar = 'canceled' THEN NOW() ELSE NULL END`,
          );
        } else {
          setParts.push(`subscription_canceled_at = NULL`);
        }
      }

      if (setParts.length > 0) {
        params.push(userId);
        await query(
          `UPDATE users
                     SET ${setParts.join(", ")}
                     WHERE id = $${i}`,
          params,
        );
      }
    }

    // 1. Создаем клуб с начальной подпиской (Trial 14 дней)
    const result = await query(
      `INSERT INTO clubs
       (name, address, owner_id, subscription_plan, subscription_status, subscription_ends_at, subscription_started_at)
       VALUES ($1, $2, $3, 'trial', 'trialing', NOW() + INTERVAL '14 days', NOW())
       RETURNING id, ${hasPublicId ? "public_id" : "id::text as public_id"}, name, address, created_at`,
      [name.trim(), address?.trim() || null, userId],
    );

    return NextResponse.json({
      success: true,
      club: result.rows[0],
      clubId: result.rows[0].id,
    });
  } catch (error) {
    console.error("Create Club Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Internal Server Error"
            : message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!clubId) {
      return NextResponse.json(
        { error: "Club ID is required" },
        { status: 400 },
      );
    }

    // Проверить, что пользователь владеет этим клубом
    const checkOwnership = await query(
      `SELECT c.id
             FROM clubs c
             LEFT JOIN club_employees ce ON ce.club_id = c.id
             WHERE c.id = $1
               AND (
                    c.owner_id = $2
                    OR (
                        ce.user_id = $2
                        AND ce.role = 'Владелец'
                        AND ce.is_active = TRUE
                        AND ce.dismissed_at IS NULL
                    )
               )
             LIMIT 1`,
      [clubId, userId],
    );

    if (checkOwnership.rowCount === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Удалить клуб (каскадное удаление должно быть настроено в БД, но если нет - удаляем зависимости)
    // В текущей схеме многие таблицы имеют ON DELETE CASCADE для club_id, так что должно сработать
    await query(`DELETE FROM clubs WHERE id = $1`, [clubId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Club Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
