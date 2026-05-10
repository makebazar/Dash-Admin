import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { getEmployeeRoleAccess } from "@/lib/employee-role-access";

async function ensureEquipmentTable() {
  // 1. Create table if not exists
  await query(`
        CREATE TABLE IF NOT EXISTS employee_task_equipment (
            task_id UUID NOT NULL REFERENCES employee_tasks(id) ON DELETE CASCADE,
            equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
            PRIMARY KEY (task_id, equipment_id)
        );
        CREATE INDEX IF NOT EXISTS idx_employee_task_equipment_task ON employee_task_equipment(task_id);
        CREATE INDEX IF NOT EXISTS idx_employee_task_equipment_equipment ON employee_task_equipment(equipment_id);
    `);

  // 2. Disable the legacy trigger that causes duplicates
  await query(
    `DROP TRIGGER IF EXISTS trigger_create_task_from_issue ON equipment_issues;`,
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const roleAccess = await getEmployeeRoleAccess(clubId);

    if (!roleAccess.settings.assignments_enabled) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureEquipmentTable();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    let assignedTo = searchParams.get("assigned_to");

    const isManager =
      roleAccess.roleName === "Владелец" ||
      roleAccess.roleName === "Управляющий" ||
      roleAccess.roleName === "Администратор системы";

    if (!isManager && !assignedTo) {
      assignedTo = roleAccess.userId;
    }

    let sql = `
        SELECT
            t.*,
            u_assigned.full_name as assigned_to_name,
            u_created.full_name as created_by_name,
            (
                SELECT json_agg(json_build_object(
                    'id', e.id,
                    'name', e.name,
                    'identifier', e.identifier,
                    'type_name', et.name_ru
                ))
                FROM employee_task_equipment ete
                JOIN equipment e ON ete.equipment_id = e.id
                LEFT JOIN equipment_types et ON e.type = et.code
                WHERE ete.task_id = t.id
            ) as equipment,
            (
                SELECT COUNT(*)
                FROM (
                    SELECT id FROM employee_task_comments WHERE task_id = t.id
                    UNION ALL
                    SELECT id FROM equipment_issue_comments WHERE issue_id = t.linked_issue_id
                ) as combined
            ) as comments_count
        FROM employee_tasks t
        LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
        LEFT JOIN users u_created ON t.created_by = u_created.id
        WHERE t.club_id = $1
    `;
    const values: any[] = [clubId];

    if (status) {
      values.push(status);
      sql += ` AND t.status = $${values.length}`;
    }

    if (assignedTo) {
      values.push(assignedTo);
      sql += ` AND t.assigned_to = $${values.length}`;
    }

    sql += ` ORDER BY t.created_at DESC`;

    const result = await query(sql, values);
    return NextResponse.json({ tasks: result.rows });
  } catch (error: any) {
    console.error("Get Employee Tasks Error:", error);
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
    const roleAccess = await getEmployeeRoleAccess(clubId);

    if (!roleAccess.settings.assignments_enabled) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isManager =
      roleAccess.roleName === "Владелец" ||
      roleAccess.roleName === "Управляющий" ||
      roleAccess.roleName === "Администратор системы";
    if (!isManager) {
      return NextResponse.json(
        { error: "Only managers can create assignments" },
        { status: 403 },
      );
    }

    await ensureEquipmentTable();

    const body = await request.json();
    const {
      title,
      description,
      assigned_to,
      priority,
      due_date,
      equipment_ids,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO employee_tasks (
                club_id, title, description, assigned_to, created_by, priority, due_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
      [
        clubId,
        title,
        description || null,
        assigned_to === "none" ? null : assigned_to || null,
        roleAccess.userId,
        priority || "MEDIUM",
        due_date || null,
      ],
    );

    const task = result.rows[0];

    // Link equipment
    if (Array.isArray(equipment_ids) && equipment_ids.length > 0) {
      const placeholders = equipment_ids
        .map((_, i) => `($1, $${i + 2})`)
        .join(", ");
      await query(
        `INSERT INTO employee_task_equipment (task_id, equipment_id) VALUES ${placeholders}`,
        [task.id, ...equipment_ids],
      );
    }

    return NextResponse.json({ task });
  } catch (error: any) {
    console.error("Create Employee Task Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}
