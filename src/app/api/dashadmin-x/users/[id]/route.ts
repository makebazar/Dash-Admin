import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";

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
  { params }: { params: { id: string } }
) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;

    const userResult = await query(
      `SELECT
        id,
        full_name,
        phone_number,
        is_active,
        subscription_plan,
        subscription_status,
        subscription_started_at,
        subscription_ends_at,
        subscription_canceled_at,
        is_super_admin,
        created_at
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Get owned clubs
    const ownedClubsResult = await query(
      `SELECT
        c.id,
        c.name,
        c.address,
        'Владелец' as role,
        (SELECT COUNT(*)::int FROM club_employees WHERE club_id = c.id AND is_active = TRUE AND dismissed_at IS NULL) as employees_count
       FROM clubs c
       WHERE c.owner_id = $1
       ORDER BY c.created_at DESC`,
      [id]
    );

    // Get employee clubs
    const employeeClubsResult = await query(
      `SELECT
        c.id,
        c.name,
        c.address,
        ce.role,
        (ce.role = 'Управляющий' OR ce.role = 'Manager') as is_manager,
        (SELECT COUNT(*)::int FROM club_employees WHERE club_id = c.id AND is_active = TRUE AND dismissed_at IS NULL) as employees_count
       FROM club_employees ce
       JOIN clubs c ON c.id = ce.club_id
       WHERE ce.user_id = $1 AND ce.is_active = TRUE AND ce.dismissed_at IS NULL
       ORDER BY ce.hired_at DESC`,
      [id]
    );

    const userDetail = {
      id: user.id,
      full_name: user.full_name,
      phone_number: user.phone_number,
      subscription_plan: user.subscription_plan || "starter",
      subscription_status: user.subscription_status || "active",
      subscription_started_at: user.subscription_started_at,
      subscription_ends_at: user.subscription_ends_at,
      is_super_admin: Boolean(user.is_super_admin),
      is_deleted: user.is_active === false,
      created_at: user.created_at,
      owned_clubs: ownedClubsResult.rows,
      employee_clubs: employeeClubsResult.rows,
    };

    return NextResponse.json({ user: userDetail });
  } catch (error) {
    console.error("DashAdmin-X User Details GET Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();

    const fullName = String(body?.full_name || "").trim();
    const phoneNumber = String(body?.phone_number || "").trim();
    const subscriptionPlan = String(body?.subscription_plan || "starter").trim();
    const subscriptionStatus = String(body?.subscription_status || "active").trim();
    const isSuperAdminVal = Boolean(body?.is_super_admin);

    if (!fullName || !phoneNumber) {
      return NextResponse.json(
        { error: "ФИО и номер телефона обязательны" },
        { status: 400 }
      );
    }

    const updateResult = await query(
      `UPDATE users
       SET full_name = $1,
           phone_number = $2,
           subscription_plan = $3,
           subscription_status = $4,
           is_super_admin = $5
       WHERE id = $6
       RETURNING id`,
      [fullName, phoneNumber, subscriptionPlan, subscriptionStatus, isSuperAdminVal, id]
    );

    if (updateResult.rowCount === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DashAdmin-X User Details PUT Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const { phone_confirm, mode } = body;

    const userResult = await query(
      `SELECT id, phone_number, is_super_admin FROM users WHERE id = $1`,
      [id]
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const user = userResult.rows[0];

    if (phone_confirm !== user.phone_number) {
      return NextResponse.json(
        { error: "Введенный номер телефона не совпадает с номером пользователя" },
        { status: 400 }
      );
    }

    // Do not allow deleting super admins through this API
    if (user.is_super_admin) {
      return NextResponse.json(
        { error: "Нельзя удалить супер-администратора" },
        { status: 400 }
      );
    }

    if (mode === "hard") {
      // Hard delete: completely delete from users table
      await query(`DELETE FROM users WHERE id = $1`, [id]);
    } else {
      // Soft delete: set is_active = FALSE
      await query(
        `UPDATE users
         SET is_active = FALSE
         WHERE id = $1`,
        [id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DashAdmin-X User Details DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
