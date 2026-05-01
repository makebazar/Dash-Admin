import { NextResponse } from 'next/server';
import { requireBotAuth } from '@/lib/bot-auth';
import { query } from '@/db';
import { z } from 'zod';

const PeriodSchema = z.enum(['today', 'yesterday', 'last7days', 'last30days', 'this_month']);

const ShiftsQuerySchema = z.object({
  clubId: z.string().optional(),
  period: PeriodSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['ACTIVE', 'CLOSED']).optional(),
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

// GET /api/ai-tools/shifts-summary
// Returns summary statistics for shifts
export async function GET(request: Request) {
  const { context, error } = await requireBotAuth(request);
  if (error) return error;

  if (!context!.selectedClubId) {
    return NextResponse.json({
      error: 'No club selected. Please select a club first using /api/ai-tools/select-club'
    }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const validation = ShiftsQuerySchema.safeParse(rawQuery);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: validation.error.issues 
      }, { status: 400 });
    }

    const { clubId, period, startDate, endDate, status } = validation.data;
    const targetClubId = clubId || String(context!.selectedClubId);
    const { startDateSql, endDateSql } = getDateRange(period, startDate, endDate);

    const queryParams: any[] = [targetClubId, startDateSql, endDateSql];
    let filterConditions = '';

    if (status) {
      queryParams.push(status);
      filterConditions += ` AND status = $${queryParams.length}`;
    }

    const sql = `
      SELECT 
        COUNT(id)::int as total_shifts,
        COALESCE(SUM(total_hours), 0)::numeric as total_hours,
        COALESCE(AVG(total_hours), 0)::numeric as average_shift_duration,
        COUNT(CASE WHEN shift_type = 'DAY' THEN 1 END)::int as day_shifts,
        COUNT(CASE WHEN shift_type = 'NIGHT' THEN 1 END)::int as night_shifts,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as active_shifts,
        COUNT(CASE WHEN status = 'CLOSED' THEN 1 END)::int as closed_shifts,
        COUNT(DISTINCT user_id)::int as unique_employees
      FROM shifts
      WHERE club_id = $1 AND check_in::date BETWEEN $2 AND $3
      ${filterConditions};
    `;

    const result = await query(sql, queryParams);
    const data = result.rows[0];

    return NextResponse.json({
      club_id: targetClubId,
      club_name: context!.selectedClubName,
      period: {
        start: startDateSql,
        end: endDateSql,
        label: period || 'custom'
      },
      summary: {
        total_shifts: parseInt(data?.total_shifts || 0),
        total_hours: parseFloat(data?.total_hours || 0),
        average_duration_hours: Math.round(parseFloat(data?.average_shift_duration || 0) * 10) / 10,
        day_shifts: parseInt(data?.day_shifts || 0),
        night_shifts: parseInt(data?.night_shifts || 0),
        active_shifts: parseInt(data?.active_shifts || 0),
        closed_shifts: parseInt(data?.closed_shifts || 0),
        unique_employees: parseInt(data?.unique_employees || 0)
      }
    });

  } catch (error: any) {
    console.error('Shifts summary tool error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}