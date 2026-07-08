import { query } from "@/db";
import {
  getReportMetricMeta,
  calculateShiftIncomeTotal,
  calculateShiftBarSales,
  calculateShiftReceiptsCount,
} from "./shiftStats";
import type { AdminPerformanceItem } from "../_types";

export async function getAdminPerformance(
  clubId: string,
  currentStart: Date,
  currentEnd: Date,
  prevStart: Date,
  prevEnd: Date,
): Promise<AdminPerformanceItem[]> {
  const [
    currentResult,
    previousResult,
    currentEvalResult,
    previousEvalResult,
    overdueTasksResult,
    assignedSpotsResult,
  ] = await Promise.all([
    query(
      `SELECT s.user_id, s.cash_income, s.card_income, s.expenses, s.report_data, s.check_in,
              u.full_name as user_name, COALESCE(r.name, 'Администратор') as role_name
       FROM shifts s 
       JOIN users u ON s.user_id = u.id 
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN shift_reports sr ON s.shift_report_id = sr.id
       WHERE COALESCE(s.club_id, sr.club_id) = $1 
         AND s.status NOT IN ('ACTIVE', 'CANCELLED') 
         AND s.check_in >= $2::timestamp 
         AND s.check_in <= $3::timestamp`,
      [clubId, currentStart.toISOString(), currentEnd.toISOString()],
    ),
    query(
      `SELECT s.user_id, s.cash_income, s.card_income, s.expenses, s.report_data, s.check_in,
              u.full_name as user_name, COALESCE(r.name, 'Администратор') as role_name
       FROM shifts s 
       JOIN users u ON s.user_id = u.id 
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN shift_reports sr ON s.shift_report_id = sr.id
       WHERE COALESCE(s.club_id, sr.club_id) = $1 
         AND s.status NOT IN ('ACTIVE', 'CANCELLED') 
         AND s.check_in >= $2::timestamp 
         AND s.check_in <= $3::timestamp`,
      [clubId, prevStart.toISOString(), prevEnd.toISOString()],
    ),
    query(
      `SELECT employee_id, AVG((total_score / NULLIF(max_score, 0)) * 100)::float as avg_score
       FROM evaluations
       WHERE club_id = $1 
         AND evaluation_date >= $2::timestamp 
         AND evaluation_date <= $3::timestamp
         AND max_score > 0
       GROUP BY employee_id`,
      [clubId, currentStart.toISOString(), currentEnd.toISOString()],
    ),
    query(
      `SELECT employee_id, AVG((total_score / NULLIF(max_score, 0)) * 100)::float as avg_score
       FROM evaluations
       WHERE club_id = $1 
         AND evaluation_date >= $2::timestamp 
         AND evaluation_date <= $3::timestamp
         AND max_score > 0
       GROUP BY employee_id`,
      [clubId, prevStart.toISOString(), prevEnd.toISOString()],
    ),
    query(
      `SELECT 
         COALESCE(
           mt.assigned_user_id,
           CASE
             WHEN e.assignment_mode = 'DIRECT' THEN e.assigned_user_id
             WHEN e.assignment_mode = 'FREE_POOL' THEN NULL
             ELSE COALESCE(w.assigned_user_id, z.assigned_user_id)
           END
         ) AS assigned_user_id,
         COUNT(mt.id)::int as overdue_count
       FROM equipment_maintenance_tasks mt
       JOIN equipment e ON mt.equipment_id = e.id
       LEFT JOIN club_workstations w ON e.workstation_id = w.id
       LEFT JOIN club_zones z ON z.club_id = e.club_id AND z.name = w.zone
       WHERE e.club_id = $1
         AND mt.status IN ('PENDING', 'IN_PROGRESS', 'REWORK')
         AND mt.due_date < NOW()
       GROUP BY 1`,
      [clubId],
    ),
    query(
      `SELECT user_id, COUNT(*)::int as count FROM (
         SELECT assigned_user_id as user_id FROM club_workstations WHERE club_id = $1 AND assigned_user_id IS NOT NULL
         UNION ALL
         SELECT assigned_user_id as user_id FROM club_zones WHERE club_id = $1 AND assigned_user_id IS NOT NULL
         UNION ALL
         SELECT assigned_user_id as user_id FROM equipment WHERE club_id = $1 AND assigned_user_id IS NOT NULL
       ) t GROUP BY user_id`,
      [clubId],
    ),
  ]);

  const metricMeta = await getReportMetricMeta(clubId);
  const performanceMap = new Map<
    string,
    {
      userName: string;
      roleName: string;
      currentShiftsCount: number;
      currentRevenue: number;
      previousShiftsCount: number;
      previousRevenue: number;
      currentBarSales: number;
      previousBarSales: number;
      currentReceiptsCount: number;
      previousReceiptsCount: number;
    }
  >();

  currentResult.rows.forEach((row: any) => {
    const userId = String(row.user_id);
    const rev = calculateShiftIncomeTotal(row, metricMeta);
    const barSales = calculateShiftBarSales(row, metricMeta);
    const receiptsCount = calculateShiftReceiptsCount(row);

    if (!performanceMap.has(userId)) {
      performanceMap.set(userId, {
        userName: row.user_name || "Неизвестно",
        roleName: row.role_name || "Администратор",
        currentShiftsCount: 0,
        currentRevenue: 0,
        previousShiftsCount: 0,
        previousRevenue: 0,
        currentBarSales: 0,
        previousBarSales: 0,
        currentReceiptsCount: 0,
        previousReceiptsCount: 0,
      });
    }

    const stats = performanceMap.get(userId)!;
    stats.currentShiftsCount += 1;
    stats.currentRevenue += rev;
    stats.currentBarSales += barSales;
    stats.currentReceiptsCount += receiptsCount;
  });

  previousResult.rows.forEach((row: any) => {
    const userId = String(row.user_id);
    const rev = calculateShiftIncomeTotal(row, metricMeta);
    const barSales = calculateShiftBarSales(row, metricMeta);
    const receiptsCount = calculateShiftReceiptsCount(row);

    if (!performanceMap.has(userId)) {
      performanceMap.set(userId, {
        userName: row.user_name || "Неизвестно",
        roleName: row.role_name || "Администратор",
        currentShiftsCount: 0,
        currentRevenue: 0,
        previousShiftsCount: 0,
        previousRevenue: 0,
        currentBarSales: 0,
        previousBarSales: 0,
        currentReceiptsCount: 0,
        previousReceiptsCount: 0,
      });
    }

    const stats = performanceMap.get(userId)!;
    stats.previousShiftsCount += 1;
    stats.previousRevenue += rev;
    stats.previousBarSales += barSales;
    stats.previousReceiptsCount += receiptsCount;
  });

  // Map evaluations
  const currentEvalMap = new Map<string, number>();
  currentEvalResult.rows.forEach((row: any) => {
    currentEvalMap.set(String(row.employee_id), Number(row.avg_score));
  });

  const previousEvalMap = new Map<string, number>();
  previousEvalResult.rows.forEach((row: any) => {
    previousEvalMap.set(String(row.employee_id), Number(row.avg_score));
  });

  const overdueTasksMap = new Map<string, number>();
  overdueTasksResult.rows.forEach((row: any) => {
    if (row.assigned_user_id) {
      overdueTasksMap.set(
        String(row.assigned_user_id),
        Number(row.overdue_count || 0),
      );
    }
  });

  const assignedSpotsMap = new Map<string, number>();
  assignedSpotsResult.rows.forEach((row: any) => {
    if (row.user_id) {
      assignedSpotsMap.set(String(row.user_id), Number(row.count || 0));
    }
  });

  return Array.from(performanceMap.entries())
    .map(([userId, stats]) => ({
      userId,
      userName: stats.userName,
      roleName: stats.roleName,
      currentShiftsCount: stats.currentShiftsCount,
      currentRevenue: stats.currentRevenue,
      previousShiftsCount: stats.previousShiftsCount,
      previousRevenue: stats.previousRevenue,
      currentEvalScore: currentEvalMap.has(userId)
        ? currentEvalMap.get(userId)!
        : null,
      previousEvalScore: previousEvalMap.has(userId)
        ? previousEvalMap.get(userId)!
        : null,
      currentBarSales: stats.currentBarSales,
      previousBarSales: stats.previousBarSales,
      currentReceiptsCount: stats.currentReceiptsCount,
      previousReceiptsCount: stats.previousReceiptsCount,
      assignedSpotsCount: assignedSpotsMap.get(userId) || 0,
      overdueTasksCount: overdueTasksMap.get(userId) || 0,
    }))
    .filter((admin) => admin.currentShiftsCount > 0)
    .sort((a, b) => b.currentRevenue - a.currentRevenue);
}
