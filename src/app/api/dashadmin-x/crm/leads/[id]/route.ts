import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";

async function checkAuth() {
  const userId = (await cookies()).get("session_user_id")?.value;
  if (!userId) return null;

  const adminCheck = await query(
    `SELECT id, is_super_admin, is_staff, phone_number FROM users WHERE id = $1`,
    [userId],
  );

  const user = adminCheck.rows[0];
  if (!user) return null;

  const canAccess = isSuperAdmin(user.is_super_admin, userId, user.phone_number) || Boolean(user.is_staff);
  if (!canAccess) {
    return null;
  }

  return userId;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await checkAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const fields = Object.keys(body).filter((key) =>
      [
        "name",
        "contact_person",
        "phone",
        "status",
        "notes",
        "next_contact_at",
        "position",
        "city",
        "tg_username",
        "address",
        "social_link",
        "maps_link",
        "assigned_user_id",
      ].includes(key),
    );
    if (fields.length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided" },
        { status: 400 },
      );
    }

    const setClause = fields
      .map((field, index) => `"${field}" = $${index + 2}`)
      .join(", ");
    const values = fields.map((field) => body[field]);

    const result = await query(
      `UPDATE crm_leads SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("CRM Lead PATCH Error:", error);
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
    const userId = await checkAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await query(
      `DELETE FROM crm_leads WHERE id = $1 RETURNING id`,
      [id],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CRM Lead DELETE Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
