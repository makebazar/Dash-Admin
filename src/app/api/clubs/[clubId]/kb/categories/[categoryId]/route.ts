import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { getClubApiAccess, hasModuleAccess } from "@/lib/club-api-access";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clubId: string; categoryId: string }> },
) {
  try {
    const { clubId, categoryId } = await params;
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
      `UPDATE kb_categories
             SET name = $1, description = $2, parent_id = $3, icon = $4, "order" = $5, updated_at = NOW()
             WHERE id = $6 AND club_id = $7
             RETURNING *`,
      [
        name,
        description,
        parent_id || null,
        icon || null,
        order || 0,
        categoryId,
        clubId,
      ],
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ category: result.rows[0] });
  } catch (error: any) {
    console.error("KB Category PUT Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clubId: string; categoryId: string }> },
) {
  try {
    const { clubId, categoryId } = await params;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Permission check using unified helper
    const access = await getClubApiAccess(clubId);
    if (!hasModuleAccess(access, "kb", "edit", clubId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await query(
      `DELETE FROM kb_categories WHERE id = $1 AND club_id = $2`,
      [categoryId, clubId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("KB Category DELETE Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}
