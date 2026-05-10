import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { getEmployeeRoleAccess } from "@/lib/employee-role-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string; taskId: string }> },
) {
  try {
    const { clubId, taskId } = await params;
    const roleAccess = await getEmployeeRoleAccess(clubId);

    if (!roleAccess.settings.assignments_enabled) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check task access
    const taskCheck = await query(
      `SELECT id, assigned_to, created_by, linked_issue_id FROM employee_tasks WHERE id = $1 AND club_id = $2`,
      [taskId, clubId],
    );
    if ((taskCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = taskCheck.rows[0];
    const isManager =
      roleAccess.roleName === "Владелец" ||
      roleAccess.roleName === "Управляющий" ||
      roleAccess.roleName === "Администратор системы";
    const isAssigned = task.assigned_to === roleAccess.userId;

    if (!isManager && !isAssigned) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await query(
      `WITH combined_comments AS (
            -- Task comments
            SELECT
                c.id,
                c.user_id,
                c.content,
                c.is_system_message,
                c.photos,
                c.created_at,
                u.full_name as user_name
            FROM employee_task_comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.task_id = $1

            UNION ALL

            -- Incident comments (if linked)
            SELECT
                ic.id,
                ic.user_id,
                ic.content,
                ic.is_system_message,
                ic.photos,
                ic.created_at,
                u.full_name as user_name
            FROM equipment_issue_comments ic
            LEFT JOIN users u ON ic.user_id = u.id
            WHERE ic.issue_id = (SELECT linked_issue_id FROM employee_tasks WHERE id = $1)
        )
        SELECT * FROM combined_comments
        ORDER BY created_at ASC`,
      [taskId],
    );

    return NextResponse.json({ comments: result.rows });
  } catch (error: any) {
    console.error("Get Task Comments Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string; taskId: string }> },
) {
  try {
    const { clubId, taskId } = await params;
    const roleAccess = await getEmployeeRoleAccess(clubId);

    if (!roleAccess.settings.assignments_enabled) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check task access
    const taskCheck = await query(
      `SELECT id, assigned_to, created_by, linked_issue_id FROM employee_tasks WHERE id = $1 AND club_id = $2`,
      [taskId, clubId],
    );
    if ((taskCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = taskCheck.rows[0];
    const isManager =
      roleAccess.roleName === "Владелец" ||
      roleAccess.roleName === "Управляющий" ||
      roleAccess.roleName === "Администратор системы";
    const isAssigned = task.assigned_to === roleAccess.userId;

    if (!isManager && !isAssigned) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { content, photos } = body;

    if (!content && (!photos || photos.length === 0)) {
      return NextResponse.json(
        { error: "Content or photos are required" },
        { status: 400 },
      );
    }

    const result = await query(
      `INSERT INTO employee_task_comments (task_id, user_id, content, photos)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
      [taskId, roleAccess.userId, content || "", photos || null],
    );

    return NextResponse.json({ comment: result.rows[0] });
  } catch (error: any) {
    console.error("Create Task Comment Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}
