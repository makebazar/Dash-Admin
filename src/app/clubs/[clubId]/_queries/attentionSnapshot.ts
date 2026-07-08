import { query } from "@/db";
import type { AttentionSnapshot } from "../_types";

export async function getAttentionSnapshot(
  clubId: string,
): Promise<AttentionSnapshot> {
  const [
    criticalItemsResult,
    activeIssuesResult,
    overdueTasksResult,
    activeIssuesCountResult,
    overdueTasksCountResult,
  ] = await Promise.all([
    // 1. Warehouse Critical Items
    query(
      `SELECT 
         id, 
         name, 
         current_stock, 
         min_stock_level, 
         COALESCE(abc_category, 'C') as abc_category,
         COALESCE(sales_velocity, 0)::float as sales_velocity,
         CASE 
           WHEN COALESCE(sales_velocity, 0) > 0 THEN (current_stock::float / COALESCE(sales_velocity, 0)::float)
           ELSE NULL
         END as days_left,
         COUNT(*) OVER() as total_critical_count
       FROM warehouse_products 
       WHERE club_id = $1 
         AND is_active = TRUE
         AND (
           current_stock <= 0 
           OR (min_stock_level > 0 AND current_stock <= min_stock_level)
           OR (COALESCE(abc_category, 'C') IN ('A', 'B') AND COALESCE(sales_velocity, 0) > 0 AND (current_stock::float / COALESCE(sales_velocity, 0)::float) < 3.0)
         )
       ORDER BY 
         CASE COALESCE(abc_category, 'C') 
           WHEN 'A' THEN 1 
           WHEN 'B' THEN 2 
           ELSE 3 
         END ASC,
         CASE WHEN current_stock <= 0 THEN 0 ELSE 1 END ASC,
         CASE 
           WHEN COALESCE(sales_velocity, 0) > 0 THEN (current_stock::float / COALESCE(sales_velocity, 0)::float) 
           ELSE 9999 
         END ASC,
         (current_stock - min_stock_level) ASC,
         name ASC
       LIMIT 5`,
      [clubId],
    ),
    // 2. Active Equipment Issues Grouped by Zone
    query(
      `SELECT 
         COALESCE(w.zone, 'Общая') as zone_name,
         COUNT(ei.id)::int as issues_count,
         COUNT(CASE WHEN ei.severity = 'CRITICAL' THEN 1 END)::int as critical_count,
         JSON_AGG(JSON_BUILD_OBJECT(
           'id', ei.id,
           'title', ei.title,
           'equipmentName', e.name,
           'equipmentType', e.type,
           'severity', ei.severity
         )) as issues
       FROM equipment_issues ei
       JOIN equipment e ON ei.equipment_id = e.id
       LEFT JOIN club_workstations w ON e.workstation_id = w.id
       WHERE e.club_id = $1 AND ei.status IN ('OPEN', 'IN_PROGRESS')
       GROUP BY COALESCE(w.zone, 'Общая')
       ORDER BY 
         MAX(CASE ei.severity 
           WHEN 'CRITICAL' THEN 1 
           WHEN 'HIGH' THEN 2 
           WHEN 'MEDIUM' THEN 3 
           WHEN 'LOW' THEN 4 
           ELSE 5 
         END) ASC,
         issues_count DESC`,
      [clubId],
    ),
    // 4. Overdue Maintenance Tasks Grouped by Zone
    query(
      `SELECT 
         COALESCE(w.zone, 'Общая') as zone_name,
         COUNT(mt.id)::int as tasks_count,
         MAX((CURRENT_DATE - mt.due_date)::int) as max_days_overdue,
         JSON_AGG(JSON_BUILD_OBJECT(
           'id', mt.id,
           'taskType', mt.task_type,
           'equipmentName', e.name,
           'equipmentType', e.type,
           'daysOverdue', (CURRENT_DATE - mt.due_date)::int
         )) as tasks
       FROM equipment_maintenance_tasks mt
       JOIN equipment e ON mt.equipment_id = e.id
       LEFT JOIN club_workstations w ON e.workstation_id = w.id
       WHERE e.club_id = $1 
         AND mt.status IN ('PENDING', 'IN_PROGRESS', 'REWORK')
         AND mt.due_date < CURRENT_DATE
       GROUP BY COALESCE(w.zone, 'Общая')
       ORDER BY max_days_overdue DESC, tasks_count DESC`,
      [clubId],
    ),
    // 5. Total Active Issues Count
    query(
      `SELECT COUNT(*)::int as count 
       FROM equipment_issues ei
       JOIN equipment e ON ei.equipment_id = e.id
       WHERE e.club_id = $1 AND ei.status IN ('OPEN', 'IN_PROGRESS')`,
      [clubId],
    ),
    // 6. Total Overdue Tasks Count
    query(
      `SELECT COUNT(*)::int as count
       FROM equipment_maintenance_tasks mt
       JOIN equipment e ON mt.equipment_id = e.id
       WHERE e.club_id = $1 
         AND mt.status IN ('PENDING', 'IN_PROGRESS', 'REWORK')
         AND mt.due_date < CURRENT_DATE`,
      [clubId],
    ),
  ]);

  const criticalItems = criticalItemsResult.rows.map((row: any) => ({
    id: String(row.id),
    name: String(row.name),
    currentStock: Number(row.current_stock || 0),
    minStockLevel: Number(row.min_stock_level || 0),
    abcCategory: String(row.abc_category),
    salesVelocity: Number(row.sales_velocity || 0),
    daysLeft: row.days_left !== null ? Number(row.days_left) : null,
  }));

  const zoneIssues = activeIssuesResult.rows.map((row: any) => ({
    zoneName: String(row.zone_name),
    issuesCount: Number(row.issues_count || 0),
    criticalCount: Number(row.critical_count || 0),
    issues: Array.isArray(row.issues) ? row.issues : [],
  }));

  const zoneTasks = overdueTasksResult.rows.map((row: any) => ({
    zoneName: String(row.zone_name),
    tasksCount: Number(row.tasks_count || 0),
    maxDaysOverdue: Number(row.max_days_overdue || 0),
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
  }));

  return {
    criticalStockCount: Number(
      criticalItemsResult.rows[0]?.total_critical_count || 0,
    ),
    criticalItems,
    activeIssuesCount: Number(activeIssuesCountResult.rows[0]?.count || 0),
    overdueTasksCount: Number(overdueTasksCountResult.rows[0]?.count || 0),
    zoneIssues,
    zoneTasks,
  };
}
