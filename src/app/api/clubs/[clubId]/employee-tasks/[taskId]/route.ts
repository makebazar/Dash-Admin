import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { getEmployeeRoleAccess } from "@/lib/employee-role-access";

async function ensureEquipmentTable() {
  await query(`
        CREATE TABLE IF NOT EXISTS employee_task_equipment (
            task_id UUID NOT NULL REFERENCES employee_tasks(id) ON DELETE CASCADE,
            equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
            PRIMARY KEY (task_id, equipment_id)
        );
        CREATE INDEX IF NOT EXISTS idx_employee_task_equipment_task ON employee_task_equipment(task_id);
        CREATE INDEX IF NOT EXISTS idx_employee_task_equipment_equipment ON employee_task_equipment(equipment_id);
    `);
}

const statusLabels: Record<string, string> = {
  OPEN: "К выполнению",
  IN_PROGRESS: "В работе",
  REVIEW: "Проверка",
  DONE: "Готово",
  CANCELLED: "Отменено",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clubId: string; taskId: string }> },
) {
  try {
    const { clubId, taskId } = await params;
    const roleAccess = await getEmployeeRoleAccess(clubId);

    if (!roleAccess.settings.assignments_enabled) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureEquipmentTable();

    // Check if user has access to this specific task
    const taskCheck = await query(
      `SELECT assigned_to, created_by, linked_issue_id FROM employee_tasks WHERE id = $1 AND club_id = $2`,
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
    const {
      status,
      report_text,
      report_photos,
      priority,
      due_date,
      assigned_to,
      equipment_ids,
    } = body;

    // Security check: only managers can mark as DONE (for final review) or other terminal statuses if needed
    // However, employees usually mark as REVIEW. Managers mark as DONE.
    if (status === "DONE" && !isManager) {
      return NextResponse.json(
        { error: "Only managers can finalize tasks" },
        { status: 403 },
      );
    }

    const updates: string[] = [];
    const values: any[] = [taskId, clubId];

    // Restrictions: only managers can change priority, due_date, and assignment
    if (priority && isManager) {
      updates.push(`priority = $${values.length + 1}`);
      values.push(priority);
    }
    if (due_date !== undefined && isManager) {
      updates.push(`due_date = $${values.length + 1}`);
      values.push(due_date || null);
    }
    if (assigned_to !== undefined && isManager) {
      updates.push(`assigned_to = $${values.length + 1}`);
      values.push(assigned_to === "none" ? null : assigned_to || null);
    }

    if (status) {
      updates.push(`status = $${values.length + 1}`);
      values.push(status);
    }
    if (report_text !== undefined) {
      updates.push(`report_text = $${values.length + 1}`);
      values.push(report_text || null);
    }
    if (report_photos !== undefined) {
      updates.push(`report_photos = $${values.length + 1}`);
      values.push(report_photos || null);
    }

    if (updates.length > 0) {
      await query(
        `UPDATE employee_tasks
                 SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND club_id = $2`,
        values,
      );
    }

    // Equipment link updates (only for managers)
    if (Array.isArray(equipment_ids) && isManager) {
      // Simple strategy: delete existing and insert new
      await query(`DELETE FROM employee_task_equipment WHERE task_id = $1`, [
        taskId,
      ]);
      if (equipment_ids.length > 0) {
        const placeholders = equipment_ids
          .map((_, i) => `($1, $${i + 2})`)
          .join(", ");
        await query(
          `INSERT INTO employee_task_equipment (task_id, equipment_id) VALUES ${placeholders}`,
          [taskId, ...equipment_ids],
        );
      }
    }

    // --- Automation: Sync with equipment_issues ---
    if (status && task.linked_issue_id) {
      let incidentStatus = null;
      if (status === "IN_PROGRESS") incidentStatus = "IN_PROGRESS";
      else if (status === "DONE") incidentStatus = "RESOLVED";
      else if (status === "OPEN") incidentStatus = "OPEN";

      if (incidentStatus) {
        await query(`UPDATE equipment_issues SET status = $1 WHERE id = $2`, [
          incidentStatus,
          task.linked_issue_id,
        ]);

        // Add system comment to incident
        await query(
          `INSERT INTO equipment_issue_comments (issue_id, content, is_system_message)
                 VALUES ($1, $2, TRUE)`,
          [
            task.linked_issue_id,
            `Статус инцидента изменен через поручение на: ${statusLabels[status] || status}`,
          ],
        );
      }
    }

    // Add system comment to task
    if (status) {
      const label = statusLabels[status] || status;
      await query(
        `INSERT INTO employee_task_comments (task_id, content, is_system_message)
                 VALUES ($1, $2, TRUE)`,
        [taskId, `Статус изменен на: ${label}`],
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update Employee Task Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clubId: string; taskId: string }> },
) {
  try {
    const { clubId, taskId } = await params;
    const roleAccess = await getEmployeeRoleAccess(clubId);

    const isManager =
      roleAccess.roleName === "Владелец" ||
      roleAccess.roleName === "Управляющий" ||
      roleAccess.roleName === "Администратор системы";

    if (!isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await query(`DELETE FROM employee_tasks WHERE id = $1 AND club_id = $2`, [
      taskId,
      clubId,
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete Employee Task Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

    await ensureEquipmentTable();

    const result = await query(
      `SELECT
            t.*,
            u_assigned.full_name as assigned_to_name,
            u_created.full_name as created_by_name,
            (
                SELECT json_agg(json_build_object(
                    'id', e.id,
                    'name', e.name,
                    'identifier', e.identifier,
                    'type_name', et.name_ru,
                    'workstation_name', w.name,
                    'workstation_zone', w.zone
                ))
                FROM employee_task_equipment ete
                JOIN equipment e ON ete.equipment_id = e.id
                LEFT JOIN equipment_types et ON e.type = et.code
                LEFT JOIN club_workstations w ON e.workstation_id = w.id
                WHERE ete.task_id = t.id
            ) as equipment
         FROM employee_tasks t
         LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
         LEFT JOIN users u_created ON t.created_by = u_created.id
         WHERE t.id = $1 AND t.club_id = $2`,
      [taskId, clubId],
    );

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = result.rows[0];
    const isManager =
      roleAccess.roleName === "Владелец" ||
      roleAccess.roleName === "Управляющий" ||
      roleAccess.roleName === "Администратор системы";
    const isAssigned = task.assigned_to === roleAccess.userId;

    if (!isManager && !isAssigned) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ task });
  } catch (error: any) {
    console.error("Get Single Employee Task Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}
