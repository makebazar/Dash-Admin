import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get("session_user_id")?.value;
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetDate = body.date || new Date().toISOString().split("T")[0];
    const autoAssign = body.auto_assign !== false;
    const dryRun = body.dry_run === true;

    const today = new Date(targetDate);
    today.setHours(0, 0, 0, 0);

    const equipmentResult = await query(
      `SELECT e.id, e.name, e.cleaning_interval_days, e.last_cleaned_at, 
              COALESCE(e.assigned_user_id, pe.assigned_user_id) as assigned_user_id, 
              e.is_active, pe.is_active as parent_is_active,
              et.code as type_code, et.name_ru as type_name
             FROM equipment e
             JOIN equipment_types et ON e.type = et.code
             LEFT JOIN equipment pe ON e.parent_equipment_id = pe.id
             WHERE e.club_id = $1 AND e.is_active = TRUE
               AND (pe.id IS NULL OR pe.is_active = TRUE)
               AND (e.cleaning_interval_days IS NOT NULL AND e.cleaning_interval_days > 0)
               AND (e.maintenance_enabled IS NULL OR e.maintenance_enabled = TRUE)`,
      [clubId],
    );

    const equipmentRows = equipmentResult.rows;
    if (equipmentRows.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0, dry_run: dryRun });
    }

    const equipmentIds = equipmentRows.map((r: any) => r.id);

    const activeEmployeesResult = await query(
      `SELECT user_id FROM club_employees
             WHERE club_id = $1 AND is_active = TRUE AND dismissed_at IS NULL
               AND show_in_schedule = TRUE
             UNION
             SELECT owner_id as user_id FROM clubs WHERE id = $1 AND owner_id IS NOT NULL`,
      [clubId],
    );
    const activeEmployeeIds = new Set(
      activeEmployeesResult.rows.map((r: any) => r.user_id),
    );

    const existingTasksResult = await query(
      `SELECT equipment_id, status, due_date
             FROM equipment_maintenance_tasks
             WHERE equipment_id = ANY($1)
               AND task_type = 'CLEANING'
               AND status IN ('PENDING', 'IN_PROGRESS', 'REWORK')`,
      [equipmentIds],
    );
    const existingPendingTasks = new Set(
      existingTasksResult.rows.map((r: any) => r.equipment_id),
    );

    const scheduleRes = await query(
      `SELECT user_id, TO_CHAR(date, 'YYYY-MM-DD') as date
             FROM work_schedules
             WHERE club_id = $1`,
      [clubId],
    );
    const employeeShifts = new Map<string, Set<string>>();
    scheduleRes.rows.forEach((r: any) => {
      const userId = String(r.user_id);
      if (!employeeShifts.has(userId)) employeeShifts.set(userId, new Set());
      employeeShifts.get(userId)!.add(String(r.date));
    });

    const findNextShiftDate = (
      userId: string,
      targetDate: string,
      visited: Set<string>,
    ): string | null => {
      const shiftDates = employeeShifts.get(userId);
      if (!shiftDates || shiftDates.size === 0) return null;

      const target = new Date(targetDate);
      let current = new Date(target);
      const maxIterations = 365;
      let iterations = 0;

      while (iterations < maxIterations) {
        iterations++;
        const dateStr = current.toISOString().split("T")[0];
        if (shiftDates.has(dateStr)) {
          return dateStr;
        }
        current.setDate(current.getDate() + 1);
        if (visited.has(dateStr + userId)) break;
        visited.add(dateStr + userId);
      }
      return null;
    };

    let createdCount = 0;
    const skippedEquipment: string[] = [];
    const createdTasks: any[] = [];

    for (const eq of equipmentRows) {
      if (existingPendingTasks.has(eq.id)) {
        skippedEquipment.push(eq.id);
        continue;
      }

      const intervalDays = Math.max(1, Number(eq.cleaning_interval_days) || 30);
      let lastCleaned = eq.last_cleaned_at
        ? new Date(eq.last_cleaned_at)
        : null;

      let nextDue = lastCleaned
        ? new Date(lastCleaned.getTime() + intervalDays * 24 * 60 * 60 * 1000)
        : new Date(today);

      nextDue.setHours(0, 0, 0, 0);

      if (nextDue > today) {
        skippedEquipment.push(eq.id);
        continue;
      }

      const dueDateStr = nextDue.toISOString().split("T")[0];
      let assignedUserId = eq.assigned_user_id ?? null;

      if (autoAssign) {
        if (assignedUserId && !activeEmployeeIds.has(assignedUserId)) {
          assignedUserId = null;
        }

        if (!assignedUserId) {
          for (const empId of activeEmployeeIds) {
            const shiftDate = findNextShiftDate(
              empId,
              dueDateStr,
              new Set<string>(),
            );
            if (shiftDate) {
              assignedUserId = empId;
              break;
            }
          }
        }
      }

      if (dryRun) {
        createdTasks.push({
          equipment_id: eq.id,
          equipment_name: eq.name,
          type_name: eq.type_name,
          due_date: dueDateStr,
          assigned_user_id: assignedUserId,
        });
      } else {
        await query(
          `INSERT INTO equipment_maintenance_tasks
                     (club_id, equipment_id, task_type, due_date, assigned_user_id, status, created_by)
                     VALUES ($1, $2, 'CLEANING', $3, $4, 'PENDING', $5)`,
          [clubId, eq.id, dueDateStr, assignedUserId, userId],
        );
        createdTasks.push({
          equipment_id: eq.id,
          equipment_name: eq.name,
          due_date: dueDateStr,
        });
      }
      createdCount++;
    }

    return NextResponse.json({
      created: createdCount,
      skipped: skippedEquipment.length,
      dry_run: dryRun,
      tasks: createdTasks,
    });
  } catch (error: any) {
    console.error("Auto-generate cleaning tasks error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
