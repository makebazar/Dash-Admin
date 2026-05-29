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

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function GET() {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const result = await query(
      `SELECT id, full_name, phone_number, is_super_admin, is_staff, created_at
       FROM users
       WHERE is_staff = TRUE OR is_super_admin = TRUE
       ORDER BY created_at DESC`
    );

    return NextResponse.json({ employees: result.rows });
  } catch (error) {
    console.error("DashAdmin-X Employees GET Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const phone = String(body?.phone_number || "").trim();
    const fullName = String(body?.full_name || "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Номер телефона обязателен" },
        { status: 400 }
      );
    }

    const normalized = normalizePhone(phone);
    if (normalized.length < 10) {
      return NextResponse.json(
        { error: "Неверный формат номера телефона" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const userCheck = await query(
      `SELECT id, full_name, is_staff, is_super_admin FROM users WHERE phone_number = $1 OR phone_number = $2 OR phone_number LIKE $3`,
      [normalized, `+${normalized}`, `%${normalized}`]
    );

    if (userCheck.rowCount && userCheck.rowCount > 0) {
      const existingUser = userCheck.rows[0];
      
      // Upgrade existing user to staff
      const updateResult = await query(
        `UPDATE users
         SET is_staff = TRUE,
             full_name = CASE WHEN full_name IS NULL OR full_name = '' THEN $1 ELSE full_name END
         WHERE id = $2
         RETURNING id, full_name, phone_number, is_super_admin, is_staff`,
        [fullName || "Сотрудник", existingUser.id]
      );

      return NextResponse.json({
        success: true,
        user: updateResult.rows[0],
        message: "Существующему пользователю выдан доступ сотрудника",
      });
    } else {
      // Create a brand new user
      const insertResult = await query(
        `INSERT INTO users (full_name, phone_number, is_staff, is_super_admin)
         VALUES ($1, $2, TRUE, FALSE)
         RETURNING id, full_name, phone_number, is_super_admin, is_staff`,
        [fullName || "Сотрудник", normalized]
      );

      return NextResponse.json({
        success: true,
        user: insertResult.rows[0],
        message: "Создан новый сотрудник",
      }, { status: 201 });
    }
  } catch (error) {
    console.error("DashAdmin-X Employees POST Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    let userId = "";
    try {
      const body = await request.json();
      userId = body?.userId;
    } catch {
      // fallback to URL query search params if JSON parsing fails
      const url = new URL(request.url);
      userId = url.searchParams.get("userId") || "";
    }

    if (!userId) {
      return NextResponse.json(
        { error: "userId обязателен" },
        { status: 400 }
      );
    }

    const checkUser = await query(
      `SELECT id, is_super_admin FROM users WHERE id = $1`,
      [userId]
    );

    if (checkUser.rowCount === 0) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    // Revoke staff access
    await query(
      `UPDATE users
       SET is_staff = FALSE
       WHERE id = $1`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      message: "Доступ сотрудника успешно отозван",
    });
  } catch (error) {
    console.error("DashAdmin-X Employees DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
