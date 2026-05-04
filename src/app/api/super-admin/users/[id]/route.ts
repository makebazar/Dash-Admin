import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/super-admin";
import { hasColumn } from "@/lib/db-compat";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;

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
    const hasLastLoginAt = await hasColumn("users", "last_login_at");
    const hasEmail = await hasColumn("users", "email");
    const hasClubAddress = await hasColumn("clubs", "address");
    const hasIsDeleted = await hasColumn("users", "is_deleted");

    const subscriptionColumns = `
            ${hasSubscriptionStatus ? "u.subscription_status" : "'active' as subscription_status"},
            ${hasSubscriptionStartedAt ? "u.subscription_started_at" : "NULL::timestamp as subscription_started_at"},
            ${hasSubscriptionEndsAt ? "u.subscription_ends_at" : "NULL::timestamp as subscription_ends_at"}
        `;

    const lastLoginColumn = hasLastLoginAt
      ? "u.last_login_at"
      : "NULL as last_login_at";
    const isDeletedColumn = hasIsDeleted
      ? "COALESCE(u.is_deleted, FALSE) as is_deleted"
      : "FALSE as is_deleted";

    const result = await query(
      `
            SELECT
                u.id,
                u.full_name,
                u.phone_number,
                u.is_super_admin,
                u.created_at,
                ${lastLoginColumn},
                ${hasEmail ? "u.email" : "NULL as email"},
                COALESCE(u.subscription_plan, 'starter') as subscription_plan,
                ${subscriptionColumns},
                ${isDeletedColumn},
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', c.id,
                            'name', c.name,
                            'address', ${hasClubAddress ? "c.address" : "NULL"},
                            'role', 'Владелец',
                            'employees_count', (
                                SELECT COUNT(*) FROM club_employees
                                WHERE club_id = c.id AND is_active = TRUE AND dismissed_at IS NULL
                            )
                        )
                    )
                    FROM clubs c
                    WHERE c.owner_id = u.id
                ), '[]'::json) as owned_clubs,
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', c.id,
                            'name', c.name,
                            'address', ${hasClubAddress ? "c.address" : "NULL"},
                            'role', COALESCE(ce.role, 'Сотрудник'),
                            'is_manager', CASE WHEN ce.role IN ('Управляющий', 'Manager') THEN TRUE ELSE FALSE END,
                            'employees_count', (
                                SELECT COUNT(*) FROM club_employees
                                WHERE club_id = c.id AND is_active = TRUE AND dismissed_at IS NULL
                            )
                        )
                    )
                    FROM club_employees ce
                    JOIN clubs c ON c.id = ce.club_id
                    WHERE ce.user_id = u.id
                      AND ce.is_active = TRUE
                      AND ce.dismissed_at IS NULL
                ), '[]'::json) as employee_clubs
            FROM users u
            WHERE u.id = $1
        `,
      [id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Get User Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const {
      full_name,
      phone_number,
      subscription_plan,
      subscription_status,
      is_super_admin,
    } = body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(full_name);
    }
    if (phone_number !== undefined) {
      updates.push(`phone_number = $${paramCount++}`);
      values.push(phone_number);
    }
    if (subscription_plan !== undefined) {
      updates.push(`subscription_plan = $${paramCount++}`);
      values.push(subscription_plan);
    }
    if (subscription_status !== undefined) {
      const hasSubscriptionStatus = await hasColumn(
        "users",
        "subscription_status",
      );
      if (hasSubscriptionStatus) {
        updates.push(`subscription_status = $${paramCount++}`);
        values.push(subscription_status);
      }
    }
    if (is_super_admin !== undefined) {
      updates.push(`is_super_admin = $${paramCount++}`);
      values.push(is_super_admin);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    values.push(id);
    await query(
      `
            UPDATE users SET ${updates.join(", ")} WHERE id = $${paramCount}
        `,
      values,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update User Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { phone_confirm, mode = "archive" } = body;

    // Получаем данные пользователя
    const userResult = await query(
      `
            SELECT u.id, u.phone_number, u.full_name, u.is_super_admin
            FROM users u
            WHERE u.id = $1
        `,
      [id],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Проверяем телефон для подтверждения
    if (user.phone_number !== phone_confirm) {
      return NextResponse.json(
        {
          error:
            "Неверный номер телефона. Введите номер пользователя для подтверждения.",
        },
        { status: 400 },
      );
    }

    if (mode === "hard") {
      // ЖЁСТКОЕ УДАЛЕНИЕ — удалить только пользователя
      // Удалить из club_employees (убрать должности)
      await query(`DELETE FROM club_employees WHERE user_id = $1`, [id]);
      // Удалить самого пользователя
      await query(`DELETE FROM users WHERE id = $1`, [id]);

      // Клубы остаются — можно будет привязать нового владельца или удалить через раздел клубов

      return NextResponse.json({
        success: true,
        message: "Пользователь удалён навсегда. Клубы сохранены без владельца.",
      });
    }

    // АРХИВИРОВАНИЕ (по умолчанию) — soft delete
    // Проверяем есть ли колонка is_deleted, если нет — создаём
    const hasIsDeleted = await hasColumn("users", "is_deleted");
    if (!hasIsDeleted) {
      try {
        await query(
          `ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE`,
        );
      } catch (e) {
        /* колонка уже может существовать */
      }
    }

    const hasDeletedAt = await hasColumn("users", "deleted_at");
    if (!hasDeletedAt) {
      try {
        await query(
          `ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL`,
        );
      } catch (e) {
        /* колонка уже может существовать */
      }
    }

    // Финальная проверка колонок
    const finalHasIsDeleted = await hasColumn("users", "is_deleted");
    const finalHasDeletedAt = await hasColumn("users", "deleted_at");
    const deletedAtColumn = finalHasDeletedAt ? ", deleted_at = NOW()" : "";

    if (finalHasIsDeleted) {
      await query(
        `
                UPDATE users SET is_deleted = TRUE ${deletedAtColumn} WHERE id = $1
            `,
        [id],
      );
    } else {
      // Если колонки нет — делаем обычный delete
      await query(`DELETE FROM club_employees WHERE user_id = $1`, [id]);
      await query(`DELETE FROM users WHERE id = $1`, [id]);
    }

    // Если пользователь — владелец клубов, клубы остаются (без владельца — owner_id остаётся)
    // Но больше никто не сможет войти под этим аккаунтом

    return NextResponse.json({
      success: true,
      message:
        "Пользователь архивирован. Его аккаунт деактивирован, но данные сохранены.",
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
