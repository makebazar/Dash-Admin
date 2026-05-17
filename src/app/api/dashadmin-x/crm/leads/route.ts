import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";

async function checkAuth() {
  const userId = (await cookies()).get("session_user_id")?.value;
  if (!userId) return null;

  const adminCheck = await query(
    `SELECT id, is_super_admin, phone_number FROM users WHERE id = $1`,
    [userId],
  );

  const user = adminCheck.rows[0];
  if (!user) return null;

  if (!isSuperAdmin(user.is_super_admin, userId, user.phone_number)) {
    return null;
  }

  return userId;
}

export async function GET() {
  try {
    const userId = await checkAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await query(
      `SELECT * FROM crm_leads ORDER BY status, position ASC, created_at DESC`,
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("CRM Leads GET Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await checkAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      contact_person,
      phone,
      status,
      notes,
      next_contact_at,
      city,
      tg_username,
      address,
      social_link,
      maps_link,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Get max position for this status to put it at the end
    const posResult = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM crm_leads WHERE status = $1`,
      [status || "new"],
    );
    const nextPosition = posResult.rows[0].next_pos;

    const result = await query(
      `INSERT INTO crm_leads (
                name, contact_person, phone, status, notes, next_contact_at, position, city, tg_username, address, social_link, maps_link
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
      [
        name,
        contact_person || null,
        phone || null,
        status || "new",
        notes || null,
        next_contact_at || null,
        nextPosition,
        city || null,
        tg_username || null,
        address || null,
        social_link || null,
        maps_link || null,
      ],
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("CRM Leads POST Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
