import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { getClubApiAccess, hasModuleAccess } from "@/lib/club-api-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Access check using unified helper
    await getClubApiAccess(clubId);

    const result = await query(
      `SELECT * FROM kb_categories WHERE club_id = $1 ORDER BY "order" ASC, name ASC`,
      [clubId],
    );

    return NextResponse.json({ categories: result.rows });
  } catch (error: any) {
    console.error("KB Categories GET Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Permission check using unified helper
    const access = await getClubApiAccess(clubId);
    if (!hasModuleAccess(access, "kb", "edit", clubId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, description, parent_id, icon, order } = await request.json();

    const result = await query(
      `INSERT INTO kb_categories (club_id, name, description, parent_id, icon, "order")
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
      [clubId, name, description, parent_id || null, icon || null, order || 0],
    );

    return NextResponse.json({ category: result.rows[0] });
  } catch (error: any) {
    console.error("KB Categories POST Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}
