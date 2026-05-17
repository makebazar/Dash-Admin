import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";

async function ensureSuperAdmin() {
  const userId = (await cookies()).get("session_user_id")?.value;
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

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

    const result = await query(
      `SELECT id, code, name, tagline, description, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, display_order, is_active, is_public, created_at, updated_at
             FROM subscription_plans
             ORDER BY display_order ASC, created_at DESC`,
    );

    return NextResponse.json({ plans: result.rows });
  } catch (error) {
    console.error("Get Subscription Plans Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const code = String(body.code || "")
      .trim()
      .toLowerCase();
    const name = String(body.name || "").trim();
    const tagline = body.tagline ? String(body.tagline).trim() : null;
    const description = body.description
      ? String(body.description).trim()
      : null;
    const priceAmount = Number(body.price_amount || 0);
    const pricePerExtraClub = Number(body.price_per_extra_club || 0);
    const periodUnit =
      body.period_unit === "year"
        ? "year"
        : body.period_unit === "day"
          ? "day"
          : "month";
    const periodValue = Number(body.period_value || 1);
    const gracePeriodDays = Number(body.grace_period_days || 7);
    const displayOrder = Number(body.display_order || 100);
    const isActive = body.is_active !== false;
    const isPublic = body.is_public !== false;

    if (!code || !name) {
      return NextResponse.json(
        { error: "Code and name are required" },
        { status: 400 },
      );
    }

    const result = await query(
      `INSERT INTO subscription_plans (code, name, tagline, description, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, display_order, is_active, is_public, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
             RETURNING id, code, name, tagline, description, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, display_order, is_active, is_public, created_at, updated_at`,
      [
        code,
        name,
        tagline,
        description,
        priceAmount,
        pricePerExtraClub,
        periodUnit,
        periodValue,
        gracePeriodDays,
        displayOrder,
        isActive,
        isPublic,
      ],
    );

    return NextResponse.json({ plan: result.rows[0] });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Plan code already exists" },
        { status: 409 },
      );
    }
    console.error("Create Subscription Plan Error:", error);
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
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Valid plan id is required" },
        { status: 400 },
      );
    }

    const code = String(body.code || "")
      .trim()
      .toLowerCase();
    const name = String(body.name || "").trim();
    const tagline = body.tagline ? String(body.tagline).trim() : null;
    const description = body.description
      ? String(body.description).trim()
      : null;
    const priceAmount = Number(body.price_amount || 0);
    const pricePerExtraClub = Number(body.price_per_extra_club || 0);
    const periodUnit =
      body.period_unit === "year"
        ? "year"
        : body.period_unit === "day"
          ? "day"
          : "month";
    const periodValue = Number(body.period_value || 1);
    const gracePeriodDays = Number(body.grace_period_days || 7);
    const displayOrder = Number(body.display_order || 100);
    const isActive = body.is_active !== false;
    const isPublic = body.is_public !== false;

    if (!code || !name) {
      return NextResponse.json(
        { error: "Code and name are required" },
        { status: 400 },
      );
    }

    const result = await query(
      `UPDATE subscription_plans
             SET code = $1,
                 name = $2,
                 tagline = $3,
                 description = $4,
                 price_amount = $5,
                 price_per_extra_club = $6,
                 period_unit = $7,
                 period_value = $8,
                 grace_period_days = $9,
                 display_order = $10,
                 is_active = $11,
                 is_public = $12,
                 updated_at = NOW()
             WHERE id = $13
             RETURNING id, code, name, tagline, description, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, display_order, is_active, is_public, created_at, updated_at`,
      [
        code,
        name,
        tagline,
        description,
        priceAmount,
        pricePerExtraClub,
        periodUnit,
        periodValue,
        gracePeriodDays,
        displayOrder,
        isActive,
        isPublic,
        id,
      ],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ plan: result.rows[0] });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Plan code already exists" },
        { status: 409 },
      );
    }
    console.error("Update Subscription Plan Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Valid plan id is required" },
        { status: 400 },
      );
    }

    const result = await query(
      `DELETE FROM subscription_plans
             WHERE id = $1
             RETURNING id`,
      [id],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Subscription Plan Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
