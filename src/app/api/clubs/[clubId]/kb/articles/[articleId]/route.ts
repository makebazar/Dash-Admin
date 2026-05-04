import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { getClubApiAccess, hasModuleAccess } from "@/lib/club-api-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string; articleId: string }> },
) {
  try {
    const { clubId, articleId } = await params;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Access check using unified helper
    await getClubApiAccess(clubId);

    const result = await query(
      `SELECT a.*, u.full_name as author_name, u2.full_name as updated_by_name
             FROM kb_articles a
             LEFT JOIN users u ON u.id = a.created_by
             LEFT JOIN users u2 ON u2.id = a.updated_by
             WHERE a.id = $1 AND a.club_id = $2`,
      [articleId, clubId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({ article: result.rows[0] });
  } catch (error: any) {
    console.error("KB Article GET Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clubId: string; articleId: string }> },
) {
  try {
    const { clubId, articleId } = await params;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Permission check using unified helper
    const access = await getClubApiAccess(clubId);
    if (!hasModuleAccess(access, "kb", "edit", clubId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, content, category_id, order } = await request.json();

    const result = await query(
      `UPDATE kb_articles
             SET title = $1, content = $2, category_id = $3, "order" = $4, updated_by = $5, updated_at = NOW()
             WHERE id = $6 AND club_id = $7
             RETURNING *`,
      [title, content, category_id, order || 0, userId, articleId, clubId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({ article: result.rows[0] });
  } catch (error: any) {
    console.error("KB Article PUT Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clubId: string; articleId: string }> },
) {
  try {
    const { clubId, articleId } = await params;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Permission check using unified helper
    const access = await getClubApiAccess(clubId);
    if (!hasModuleAccess(access, "kb", "edit", clubId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await query(
      `DELETE FROM kb_articles WHERE id = $1 AND club_id = $2`,
      [articleId, clubId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("KB Article DELETE Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}
