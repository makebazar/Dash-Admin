import { query } from "@/db";
import { formatLocalDate } from "@/lib/utils";
import { getClubTimezone } from "./revenueTrend";
import { formatDateKeyInTimezone } from "../_formatters";
import type { ActiveShift, NextScheduledShift } from "../_types";

export async function getActiveShiftsSnapshot(
  clubId: string,
): Promise<ActiveShift[]> {
  const result = await query(
    `SELECT s.id, s.check_in, s.total_hours, COALESCE(s.shift_type, 'DAY') as shift_type, u.full_name as user_name, COALESCE(r.name, 'Сотрудник') as role_name
         FROM shifts s JOIN users u ON s.user_id = u.id LEFT JOIN roles r ON u.role_id = r.id
         WHERE s.club_id = $1 AND s.status = 'ACTIVE' ORDER BY s.check_in DESC`,
    [clubId],
  );
  return result.rows.map((row: any) => ({
    id: String(row.id),
    userName: row.user_name,
    role: row.role_name,
    shiftType: row.shift_type || "DAY",
    checkIn: row.check_in,
    totalHours: Number(row.total_hours || 0),
  }));
}

export async function getNextScheduledShift(
  clubId: string,
): Promise<NextScheduledShift> {
  const clubTimezone = await getClubTimezone(clubId);
  const todayKey = formatDateKeyInTimezone(new Date(), clubTimezone);
  const result = await query(
    `WITH active_today AS (
            SELECT s.user_id, COALESCE(s.shift_type, 'DAY') as shift_type FROM shifts s
            WHERE s.club_id = $1 AND s.status = 'ACTIVE' AND DATE(((s.check_in AT TIME ZONE 'UTC') AT TIME ZONE $2)) = $3::date
         )
         SELECT ws.date, ws.shift_type, u.full_name as user_name
         FROM work_schedules ws JOIN users u ON u.id = ws.user_id LEFT JOIN active_today a ON a.user_id = ws.user_id AND a.shift_type = ws.shift_type
         WHERE ws.club_id = $1 AND ws.date >= $3::date AND a.user_id IS NULL
         ORDER BY ws.date ASC, CASE ws.shift_type WHEN 'DAY' THEN 1 WHEN 'NIGHT' THEN 2 ELSE 3 END ASC LIMIT 1`,
    [clubId, clubTimezone, todayKey],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    userName: row.user_name,
    shiftType: row.shift_type || "DAY",
    date:
      row.date instanceof Date ? formatLocalDate(row.date) : String(row.date),
  };
}
