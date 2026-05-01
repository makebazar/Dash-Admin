import { NextResponse } from 'next/server';
import { requireBotAuth } from '@/lib/bot-auth';
import { query } from '@/db';
import { z } from 'zod';

const PeriodSchema = z.enum(['today', 'yesterday', 'last7days', 'last30days', 'this_month']);

const EmployeeHoursQuerySchema = z.object({
  clubId: z.string().optional(),
  employeeId: z.string().uuid('Employee ID must be a valid UUID').optional(),
  employeeName: z.string().optional(), // Можно искать по имени
  period: PeriodSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

function getDateRange(period?: z.infer<typeof PeriodSchema>, customStartDate?: string, customEndDate?: string) {
  if (customStartDate && customEndDate) {
    return { startDateSql: customStartDate, endDateSql: customEndDate };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate: Date;
  let endDate: Date;

  switch (period) {
    case 'today':
      startDate = today;
      endDate = today;
      break;
    case 'last7days':
      startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      endDate = today;
      break;
    case 'last30days':
      startDate = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
      endDate = today;
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = today;
      break;
    case 'yesterday':
    default:
      startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      endDate = startDate;
      break;
  }
  return {
    startDateSql: startDate.toISOString().slice(0, 10),
    endDateSql: endDate.toISOString().slice(0, 10)
  };
}

// GET /api/ai-tools/employee-hours
// Returns hours worked by employees
export async function GET(request: Request) {
  const { context, error } = await requireBotAuth(request);
  if (error) return error;

  if (!context!.selectedClubId) {
    return NextResponse.json({
      error: 'No club selected. Please select a club first'
    }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const validation = EmployeeHoursQuerySchema.safeParse(rawQuery);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: validation.error.issues 
      }, { status: 400 });
    }

    const { clubId, employeeId, employeeName, period, startDate, endDate } = validation.data;
    const targetClubId = clubId || String(context!.selectedClubId);
    const { startDateSql, endDateSql } = getDateRange(period, startDate, endDate);

    // Если указан конкретный сотрудник
    if (employeeId) {
      const result = await query(
        `
        SELECT 
          u.id,
          u.full_name,
          COUNT(s.id)::int as shifts_count,
          COALESCE(SUM(s.total_hours), 0)::numeric as total_hours,
          COALESCE(AVG(s.total_hours), 0)::numeric as avg_shift_hours,
          COALESCE(SUM(s.cash_income + s.card_income), 0)::numeric as total_revenue
        FROM users u
        LEFT JOIN shifts s ON s.user_id = u.id AND s.club_id = $1 AND s.check_in::date BETWEEN $2 AND $3
        WHERE u.id = $4
        GROUP BY u.id, u.full_name
        `,
        [targetClubId, startDateSql, endDateSql, employeeId]
      );

      if (result.rowCount === 0) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      const data = result.rows[0];

      return NextResponse.json({
        club_id: targetClubId,
        club_name: context!.selectedClubName,
        period: {
          start: startDateSql,
          end: endDateSql,
          label: period || 'custom'
        },
        employee: {
          id: data.id,
          name: data.full_name
        },
        stats: {
          shifts_count: parseInt(data.shifts_count || 0),
          total_hours: parseFloat(data.total_hours || 0),
          avg_shift_hours: Math.round(parseFloat(data.avg_shift_hours || 0) * 10) / 10,
          total_revenue: parseFloat(data.total_revenue || 0)
        }
      });
    }

    // Если указан employeeName — ищем всех подходящих сотрудников
    if (employeeName) {
      const result = await query(
        `
        SELECT 
          u.id,
          u.full_name,
          COUNT(s.id)::int as shifts_count,
          COALESCE(SUM(s.total_hours), 0)::numeric as total_hours,
          COALESCE(SUM(s.cash_income + s.card_income), 0)::numeric as total_revenue
        FROM users u
        JOIN club_employees ce ON ce.user_id = u.id AND ce.club_id = $1 AND ce.dismissed_at IS NULL
        LEFT JOIN shifts s ON s.user_id = u.id AND s.club_id = $1 AND s.check_in::date BETWEEN $2 AND $3
        WHERE LOWER(u.full_name) LIKE LOWER($4)
        GROUP BY u.id, u.full_name
        ORDER BY total_hours DESC
        LIMIT 10
        `,
        [targetClubId, startDateSql, endDateSql, `%${employeeName}%`]
      );

      return NextResponse.json({
        club_id: targetClubId,
        club_name: context!.selectedClubName,
        period: {
          start: startDateSql,
          end: endDateSql,
          label: period || 'custom'
        },
        search_query: employeeName,
        employees: result.rows.map(emp => ({
          id: emp.id,
          name: emp.full_name,
          shifts_count: parseInt(emp.shifts_count || 0),
          total_hours: parseFloat(emp.total_hours || 0),
          total_revenue: parseFloat(emp.total_revenue || 0)
        }))
      });
    }

    // Если ничего не указано — возвращаем всех сотрудников
    const result = await query(
      `
      SELECT 
        u.id,
        u.full_name,
        COUNT(s.id)::int as shifts_count,
        COALESCE(SUM(s.total_hours), 0)::numeric as total_hours,
        COALESCE(AVG(s.total_hours), 0)::numeric as avg_shift_hours,
        COALESCE(SUM(s.cash_income + s.card_income), 0)::numeric as total_revenue
      FROM club_employees ce
      JOIN users u ON ce.user_id = u.id
      LEFT JOIN shifts s ON s.user_id = u.id AND s.club_id = $1 AND s.check_in::date BETWEEN $2 AND $3
      WHERE ce.club_id = $1 AND ce.dismissed_at IS NULL
      GROUP BY u.id, u.full_name
      ORDER BY total_hours DESC
      `,
      [targetClubId, startDateSql, endDateSql]
    );

    return NextResponse.json({
      club_id: targetClubId,
      club_name: context!.selectedClubName,
      period: {
        start: startDateSql,
        end: endDateSql,
        label: period || 'custom'
      },
      employees: result.rows.map(emp => ({
        id: emp.id,
        name: emp.full_name,
        shifts_count: parseInt(emp.shifts_count || 0),
        total_hours: parseFloat(emp.total_hours || 0),
        avg_shift_hours: Math.round(parseFloat(emp.avg_shift_hours || 0) * 10) / 10,
        total_revenue: parseFloat(emp.total_revenue || 0)
      }))
    });

  } catch (error: any) {
    console.error('Employee hours tool error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}