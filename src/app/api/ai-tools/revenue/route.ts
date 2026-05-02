import { NextResponse } from 'next/server';
import { requireBotAuth } from '@/lib/bot-auth';
import { query } from '@/db';
import { z } from 'zod';

const PeriodSchema = z.enum(['today', 'yesterday', 'last7days', 'last30days', 'this_month']);

const RevenueQuerySchema = z.object({
  clubId: z.string().optional(), // Если не указан — используется selectedClub
  period: PeriodSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  shiftType: z.enum(['DAY', 'NIGHT']).optional(),
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

// GET /api/ai-tools/revenue
// Returns revenue data for the authenticated bot user
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
    const validation = RevenueQuerySchema.safeParse(rawQuery);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: validation.error.issues 
      }, { status: 400 });
    }

    const { clubId, period, startDate, endDate, shiftType } = validation.data;
    
    // Используем указанный clubId или selectedClub
    const targetClubId = clubId || String(context!.selectedClubId);
    const { startDateSql, endDateSql } = getDateRange(period, startDate, endDate);

    const queryParams: any[] = [targetClubId, startDateSql, endDateSql];
    let filterConditions = '';

    if (shiftType) {
      queryParams.push(shiftType);
      filterConditions += ` AND shift_type = $${queryParams.length}`;
    }

    const sql = `
      SELECT 
        SUM(cash_income + card_income)::numeric as total_revenue,
        SUM(expenses)::numeric as total_expenses,
        (SUM(cash_income + card_income) - SUM(expenses))::numeric as net_revenue,
        SUM(cash_income)::numeric as cash_revenue,
        SUM(card_income)::numeric as card_revenue,
        COUNT(id)::int as shift_count,
        COALESCE(SUM(total_hours), 0)::numeric as total_hours,
        COUNT(DISTINCT user_id)::int as employees_count
      FROM shifts
      WHERE club_id = $1 AND check_in::date BETWEEN $2 AND $3
      ${filterConditions};
    `;

    // Получаем системные метрики (тип MONEY)
    const metricsSql = `
      SELECT key, label, type 
      FROM system_metrics 
      WHERE type = 'MONEY';
    `;
    const metricsResult = await query(metricsSql, []);

    // Получаем кастомные метрики клуба (тип MONEY)
    const customMetricsSql = `
      SELECT key, label, type 
      FROM club_custom_metrics 
      WHERE club_id = $1 AND type = 'MONEY' AND is_active = true;
    `;
    const customMetricsResult = await query(customMetricsSql, [targetClubId]);

    // Получаем суммы по всем метрикам из report_data
    const allMetricKeys = [
      ...metricsResult.rows.map(r => r.key),
      ...customMetricsResult.rows.map(r => r.key)
    ];

    // Получаем данные с aggregated metrics из report_data
    const aggregatedMetrics: Record<string, { sum: number; label: string }> = {};
    
    for (const metric of metricsResult.rows) {
      aggregatedMetrics[metric.key] = { sum: 0, label: metric.label };
    }
    for (const metric of customMetricsResult.rows) {
      aggregatedMetrics[metric.key] = { sum: 0, label: metric.label };
    }

    const metricsSumSql = `
      SELECT report_data
      FROM shifts
      WHERE club_id = $1 AND check_in::date BETWEEN $2 AND $3
        AND report_data IS NOT NULL AND report_data != '{}'::jsonb
      ${filterConditions};
    `;
    const metricsDataResult = await query(metricsSumSql, queryParams);

    for (const row of metricsDataResult.rows) {
      const data = row.report_data as Record<string, unknown>;
      for (const key of allMetricKeys) {
        if (data && data[key] !== undefined) {
          const val = parseFloat(String(data[key])) || 0;
          aggregatedMetrics[key].sum += val;
        }
      }
    }

    const result = await query(sql, queryParams);
    const data = result.rows[0];

    // Формируем объект custom_metrics с суммами
    const customMetrics: Record<string, { sum: number; label: string }> = {};
    for (const [key, val] of Object.entries(aggregatedMetrics)) {
      if (val.sum > 0) {
        customMetrics[key] = val;
      }
    }

    return NextResponse.json({
      club_id: targetClubId,
      club_name: context!.selectedClubName,
      period: {
        start: startDateSql,
        end: endDateSql,
        label: period || 'custom'
      },
      revenue: {
        total: parseFloat(data?.total_revenue || 0),
        expenses: parseFloat(data?.total_expenses || 0),
        net: parseFloat(data?.net_revenue || 0),
        cash: parseFloat(data?.cash_revenue || 0),
        card: parseFloat(data?.card_revenue || 0)
      },
      shifts: {
        count: parseInt(data?.shift_count || 0),
        total_hours: parseFloat(data?.total_hours || 0),
        employees: parseInt(data?.employees_count || 0)
      },
      custom_metrics: customMetrics
    });

  } catch (error: any) {
    console.error('Revenue tool error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}