import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string; issueId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId, issueId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify access
    const accessCheck = await query(
      `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
      [clubId, userId],
    );

    if ((accessCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure table has photos column (idempotent)
    await query(
      `ALTER TABLE equipment_issue_comments ADD COLUMN IF NOT EXISTS photos TEXT[]`,
    );

    const result = await query(
      `WITH combined_comments AS (
                -- Incident comments
                SELECT
                    c.id, c.user_id, c.content, c.is_system_message, c.photos, c.created_at,
                    u.full_name as author_name,
                    COALESCE(ce.role, r.name, 'User') as author_role
                FROM equipment_issue_comments c
                LEFT JOIN users u ON c.user_id = u.id
                LEFT JOIN club_employees ce ON u.id = ce.user_id AND ce.club_id = $2
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE c.issue_id = $1

                UNION ALL

                -- Assignment comments (if linked)
                SELECT
                    ac.id, ac.user_id, ac.content, ac.is_system_message, ac.photos, ac.created_at,
                    u.full_name as author_name,
                    COALESCE(ce.role, r.name, 'User') as author_role
                FROM employee_task_comments ac
                LEFT JOIN users u ON ac.user_id = u.id
                LEFT JOIN club_employees ce ON u.id = ce.user_id AND ce.club_id = $2
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE ac.task_id = (SELECT id FROM employee_tasks WHERE linked_issue_id = $1 LIMIT 1)
            )
            SELECT * FROM combined_comments
            ORDER BY created_at ASC`,
      [issueId, clubId],
    );

    return NextResponse.json({ comments: result.rows });
  } catch (error) {
    console.error("Get Comments Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string; issueId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId, issueId } = await params;
    const body = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify access
    const accessCheck = await query(
      `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
      [clubId, userId],
    );

    if ((accessCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { content, is_system_message, photos } = body;

    if (!content && (!photos || photos.length === 0)) {
      return NextResponse.json(
        { error: "Content or photos are required" },
        { status: 400 },
      );
    }

    // Ensure table has photos column
    await query(
      `ALTER TABLE equipment_issue_comments ADD COLUMN IF NOT EXISTS photos TEXT[]`,
    );

    const result = await query(
      `INSERT INTO equipment_issue_comments (issue_id, user_id, content, is_system_message, photos)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
      [
        issueId,
        userId,
        content || "",
        is_system_message || false,
        photos || null,
      ],
    );

    // Fetch user details for response
    const userResult = await query(
      `SELECT
                u.full_name,
                COALESCE(ce.role, r.name, 'User') as role
             FROM users u
             LEFT JOIN club_employees ce ON u.id = ce.user_id AND ce.club_id = $2
             LEFT JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1`,
      [userId, clubId],
    );

    const newComment = {
      ...result.rows[0],
      author_name: userResult.rows[0]?.full_name,
      author_role: userResult.rows[0]?.role,
    };

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("Create Comment Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
