
import { requireReportingApiKey } from '@/lib/reporting-api-key-guard';
import { NextResponse } from 'next/server';
import { query } from '@/db';
import { requireClubApiAccess } from '@/lib/club-api-access';
import { z } from 'zod';

// Common period schema
const PeriodSchema = z.enum(['today', 'yesterday', 'last7days', 'last30days', 'this_month']);

// Schema for Revenue queries
const RevenueQuerySchema = z.object({
  query: z.literal('revenue'),
  period: PeriodSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  shiftType: z.enum(['DAY', 'NIGHT']).optional(),
});

// Schema for Shifts queries
const ShiftsQuerySchema = z.object({
  query: z.literal('shifts'),
  period: PeriodSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'CLOSED']).optional(),
});

// Helper to get date range from period
function getDateRange(period: z.infer<typeof PeriodSchema> | undefined, customStartDate?: string, customEndDate?: string) {
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


export async function GET(
  request: Request,
  { params }: { params: { clubId: string } }
) {
  try {
    const { clubId } = params;
    await requireClubApiAccess(clubId); // Keep session-based access for the main app
    await requireReportingApiKey(); // Add API key check for external services


    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const rawQuery = Object.fromEntries(searchParams.entries());

    // --- REVENUE QUERY ---
    if (rawQuery.query === 'revenue') {
      const validation = RevenueQuerySchema.safeParse(rawQuery);
      if (!validation.success) {
        return NextResponse.json({ error: 'Invalid query parameters', details: validation.error.issues }, { status: 400 });
      }
      
      const { period, startDate, endDate, employeeId, shiftType } = validation.data;
      const { startDateSql, endDateSql } = getDateRange(period, startDate, endDate);
      
      const queryParams: any[] = [clubId, startDateSql, endDateSql];
      let filterConditions = '';

      if (employeeId) {
        queryParams.push(employeeId);
        filterConditions += ` AND user_id = $${queryParams.length}`;
      }
      if (shiftType) {
        queryParams.push(shiftType);
        filterConditions += ` AND shift_type = $${queryParams.length}`;
      }

      const sql = `
        SELECT 
          SUM(cash_income + card_income) as total_revenue,
          SUM(expenses) as total_expenses,
          (SUM(cash_income + card_income) - SUM(expenses)) as net_revenue,
          SUM(cash_income) as cash_revenue,
          SUM(card_income) as card_revenue,
          COUNT(id) as shift_count
        FROM shifts
        WHERE club_id = $1 AND check_in::date BETWEEN $2 AND $3
        ${filterConditions};
      `;
      
      const result = await query(sql, queryParams);

      return NextResponse.json(result.rows[0] || {
        total_revenue: 0, total_expenses: 0, net_revenue: 0,
        cash_revenue: 0, card_revenue: 0, shift_count: 0,
      });

    // --- SHIFTS QUERY ---
    } else if (rawQuery.query === 'shifts') {
        const validation = ShiftsQuerySchema.safeParse(rawQuery);
        if (!validation.success) {
          return NextResponse.json({ error: 'Invalid query parameters', details: validation.error.issues }, { status: 400 });
        }
        
        const { period, startDate, endDate, employeeId, status } = validation.data;
        const { startDateSql, endDateSql } = getDateRange(period, startDate, endDate);

        const queryParams: any[] = [clubId, startDateSql, endDateSql];
        let filterConditions = '';
  
        if (employeeId) {
          queryParams.push(employeeId);
          filterConditions += ` AND user_id = $${queryParams.length}`;
        }
        if (status) {
          queryParams.push(status);
          filterConditions += ` AND status = $${queryParams.length}`;
        }

        const sql = `
            SELECT 
                COUNT(id)::int as total_shifts,
                COALESCE(SUM(total_hours), 0)::float as total_hours,
                COALESCE(AVG(total_hours), 0)::float as average_shift_duration,
                COUNT(CASE WHEN shift_type = 'DAY' THEN 1 END)::int as day_shifts_count,
                COUNT(CASE WHEN shift_type = 'NIGHT' THEN 1 END)::int as night_shifts_count
            FROM shifts
            WHERE club_id = $1 AND check_in::date BETWEEN $2 AND $3
            ${filterConditions};
        `;

        const result = await query(sql, queryParams);

        // Ensure all fields are numbers, even if null from DB
        const data = result.rows[0];
        const responseData = {
            total_shifts: Number(data?.total_shifts || 0),
            total_hours: Number(data?.total_hours || 0),
            average_shift_duration: Number(data?.average_shift_duration || 0),
            day_shifts_count: Number(data?.day_shifts_count || 0),
            night_shifts_count: Number(data?.night_shifts_count || 0),
        };

        return NextResponse.json(responseData);

    } else {
        return NextResponse.json({ error: `Unsupported query type: '${rawQuery.query}'` }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Reporting API Error:', error);
    const status = error?.status || 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
