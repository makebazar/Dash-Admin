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
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Access check using unified helper
    const access = await getClubApiAccess(clubId);

    let sql = `SELECT * FROM kb_articles WHERE club_id = $1`;
    const queryParams: any[] = [clubId];

    if (categoryId) {
      sql += ` AND category_id = $2`;
      queryParams.push(categoryId);
    }

    sql += ` ORDER BY "order" ASC, title ASC`;

    const result = await query(sql, queryParams);

    return NextResponse.json({ articles: result.rows });
  } catch (error: any) {
    console.error("KB Articles GET Error:", error);
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

    // Use can_edit_settings for managing KB
    if (!hasModuleAccess(access, "kb", "edit", clubId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, content, category_id, order } = await request.json();

    const result = await query(
      `INSERT INTO kb_articles (club_id, category_id, title, content, "order", created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $6)
             RETURNING *`,
      [clubId, category_id, title, content, order || 0, userId],
    );

    return NextResponse.json({ article: result.rows[0] });
  } catch (error: any) {
    console.error("KB Articles POST Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}
