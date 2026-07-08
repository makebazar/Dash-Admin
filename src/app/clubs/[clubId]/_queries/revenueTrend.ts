import { query } from "@/db";
import {
  formatDateKeyInTimezone,
  normalizeMetricValue,
} from "../_formatters";
import {
  getReportMetricMeta,
  getShiftRevenueRows,
  calculateShiftIncomeTotal,
  calculateShiftReceiptsCount,
} from "./shiftStats";
import type { RevenuePoint } from "../_types";

export async function getClubTimezone(clubId: string) {
  const result = await query(
    `SELECT COALESCE(timezone, 'Europe/Moscow') as timezone FROM clubs WHERE id = $1`,
    [clubId],
  );
  return result.rows[0]?.timezone || "Europe/Moscow";
}

export async function getRevenueTrendForDates(
  clubId: string,
  startDate: Date,
  endDate: Date,
): Promise<RevenuePoint[]> {
  const clubTimezone = await getClubTimezone(clubId);
  const metricMeta = await getReportMetricMeta(clubId);

  const rows = await getShiftRevenueRows(
    clubId,
    startDate.toISOString(),
    endDate.toISOString(),
  );

  const revenueByDate = new Map<string, number>();
  const receiptsByDate = new Map<string, number>();
  const metricsByDate = new Map<string, Map<string, number>>();

  rows.forEach((row: any) => {
    const key = formatDateKeyInTimezone(row.period_at, clubTimezone);
    const currentRev = revenueByDate.get(key) || 0;
    revenueByDate.set(
      key,
      currentRev + calculateShiftIncomeTotal(row, metricMeta),
    );
    const currentRec = receiptsByDate.get(key) || 0;
    receiptsByDate.set(key, currentRec + calculateShiftReceiptsCount(row));

    if (!metricsByDate.has(key)) {
      metricsByDate.set(key, new Map<string, number>());
    }
    const dayMetrics = metricsByDate.get(key)!;
    const addMetric = (metricKey: string, val: number) => {
      if (!Number.isFinite(val) || val === 0) return;
      dayMetrics.set(metricKey, (dayMetrics.get(metricKey) || 0) + val);
    };

    addMetric("cash_income", normalizeMetricValue(row.cash_income));
    addMetric("card_income", normalizeMetricValue(row.card_income));

    const reportData =
      typeof row.report_data === "string"
        ? JSON.parse(row.report_data || "{}")
        : row.report_data;
    if (
      reportData &&
      typeof reportData === "object" &&
      !Array.isArray(reportData)
    ) {
      Object.entries(reportData).forEach(([k, v]) => {
        if (
          ![
            "cash_income",
            "card_income",
            "total_revenue",
            "revenue_cash",
            "revenue_card",
            "cash",
            "card",
            "receipts_count",
          ].includes(k)
        ) {
          const numVal = normalizeMetricValue(v);
          if (numVal !== 0) {
            addMetric(k, numVal);
          }
        }
      });
    }
  });

  const points: RevenuePoint[] = [];
  const curr = new Date(startDate);
  while (curr <= endDate) {
    const key = formatDateKeyInTimezone(curr, clubTimezone);
    const dayMetricsMap = metricsByDate.get(key);
    const metrics: Record<string, number> = {};
    if (dayMetricsMap) {
      dayMetricsMap.forEach((val, k) => {
        metrics[k] = val;
      });
    }

    points.push({
      date: key,
      revenue: revenueByDate.get(key) || 0,
      receiptsCount: receiptsByDate.get(key) || 0,
      metrics,
    });
    curr.setDate(curr.getDate() + 1);
  }
  return points;
}
