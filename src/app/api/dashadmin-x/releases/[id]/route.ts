import { NextRequest, NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";
import { verifySessionValue } from "@/lib/session";
import { ensureReleasesTable } from "@/lib/releases";

export const dynamic = "force-dynamic";

async function ensureSuperAdmin() {
  try {
    const rawCookie = (await cookies()).get("session_user_id")?.value;
    if (!rawCookie) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    const userId = verifySessionValue(rawCookie) || rawCookie;
    if (!userId) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    const adminCheck = await query(
      `SELECT is_super_admin, phone_number FROM users WHERE id = $1`,
      [userId]
    );

    const user = adminCheck.rows[0];
    const canAccess = isSuperAdmin(
      user?.is_super_admin,
      userId,
      user?.phone_number
    );

    if (!canAccess) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    return { ok: true as const, userId };
  } catch (err: any) {
    console.error("SuperAdmin check failed:", err);
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Auth verification failed" }, { status: 401 }),
    };
  }
}

// PATCH: toggle active, change notes, etc.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    await ensureReleasesTable();

    const { id } = await params;
    const body = await req.json();

    if (body.isActive === true) {
      // Find app_name for this release
      const current = await query(`SELECT app_name FROM app_releases WHERE id = $1`, [id]);
      if (current.rowCount === 0) {
        return NextResponse.json({ error: "Релиз не найден" }, { status: 404 });
      }
      const appName = current.rows[0].app_name;

      // Deactivate others
      await query(`UPDATE app_releases SET is_active = false WHERE app_name = $1`, [appName]);
      await query(`UPDATE app_releases SET is_active = true WHERE id = $1`, [id]);
    } else if (body.isActive === false) {
      await query(`UPDATE app_releases SET is_active = false WHERE id = $1`, [id]);
    }

    if (body.changelog !== undefined) {
      await query(`UPDATE app_releases SET changelog = $1 WHERE id = $2`, [body.changelog, id]);
    }

    const updated = await query(`SELECT * FROM app_releases WHERE id = $1`, [id]);
    return NextResponse.json({ success: true, release: updated.rows[0] });
  } catch (err: any) {
    console.error("Failed to patch release:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

// DELETE: delete release
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    await ensureReleasesTable();

    const { id } = await params;
    await query(`DELETE FROM app_releases WHERE id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete release:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
