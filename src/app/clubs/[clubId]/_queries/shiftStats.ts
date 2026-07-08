import { query } from "@/db";
import { normalizeMetricValue } from "../_formatters";
import type { MetricMeta } from "../_types";

export async function getReportMetricMeta(clubId: string): Promise<MetricMeta> {
  const templateRes = await query(
    `SELECT schema FROM club_report_templates WHERE club_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1`,
    [clubId],
  );
  const templateSchema = templateRes.rows[0]?.schema;
  const fields = Array.isArray(templateSchema)
    ? templateSchema
    : templateSchema?.fields || [];
  const metricMeta: MetricMeta = {
    cash_income: { category: "INCOME", label: "Наличные" },
    card_income: { category: "INCOME", label: "Безналичные" },
    expenses: { category: "EXPENSE", label: "Расходы" },
    expenses_cash: { category: "EXPENSE", label: "Расходы наличными" },
    receipts_count: { category: "OTHER", label: "Количество чеков" },
  };
  fields.forEach((field: any) => {
    const key = field.metric_key || field.key;
    if (!key) return;
    const previous = metricMeta[key];
    metricMeta[key] = {
      category:
        field.field_type ||
        field.calculation_category ||
        previous?.category ||
        "OTHER",
      label:
        field.custom_label ||
        field.employee_label ||
        field.label ||
        field.name ||
        previous?.label ||
        key,
    };
  });
  return metricMeta;
}

export function calculateShiftIncomeTotal(
  shift: {
    cash_income?: number | string | null;
    card_income?: number | string | null;
    report_data?: unknown;
  },
  metricMeta: MetricMeta,
): number {
  let total = 0;
  const cash = normalizeMetricValue(shift.cash_income);
  const card = normalizeMetricValue(shift.card_income);
  if (
    metricMeta["cash_income"]?.category === "INCOME" ||
    !metricMeta["cash_income"]
  )
    total += cash;
  if (
    metricMeta["card_income"]?.category === "INCOME" ||
    !metricMeta["card_income"]
  )
    total += card;
  const reportData =
    typeof shift.report_data === "string"
      ? JSON.parse(shift.report_data || "{}")
      : shift.report_data;
  if (
    reportData &&
    typeof reportData === "object" &&
    !Array.isArray(reportData)
  ) {
    Object.entries(reportData).forEach(([key, value]) => {
      if (
        metricMeta[key]?.category === "INCOME" &&
        ![
          "cash_income",
          "card_income",
          "total_revenue",
          "revenue_cash",
          "revenue_card",
          "cash",
          "card",
          "receipts_count",
        ].includes(key)
      ) {
        total += normalizeMetricValue(value);
      }
    });
  }
  return total;
}

export function calculateShiftBarSales(
  shift: { report_data?: unknown },
  metricMeta: MetricMeta,
): number {
  let total = 0;
  const reportData =
    typeof shift.report_data === "string"
      ? JSON.parse(shift.report_data || "{}")
      : shift.report_data;
  if (
    reportData &&
    typeof reportData === "object" &&
    !Array.isArray(reportData)
  ) {
    Object.entries(reportData).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      const label = (metricMeta[key]?.label || "").toLowerCase();
      if (
        lowerKey === "bar" ||
        lowerKey === "bar_revenue" ||
        label.includes("бар")
      ) {
        total += normalizeMetricValue(value);
      }
    });
  }
  return total;
}

export function calculateShiftReceiptsCount(shift: {
  report_data?: unknown;
}): number {
  const reportData =
    typeof shift.report_data === "string"
      ? JSON.parse(shift.report_data || "{}")
      : shift.report_data;
  if (
    reportData &&
    typeof reportData === "object" &&
    !Array.isArray(reportData)
  ) {
    if ("receipts_count" in reportData) {
      return normalizeMetricValue((reportData as any).receipts_count);
    }
  }
  return 0;
}

export function buildRevenueBreakdown(
  rows: any[],
  metricMeta: MetricMeta,
): Array<{ key: string; label: string; amount: number }> {
  const totals = new Map<string, { label: string; amount: number }>();
  const add = (key: string, amount: number) => {
    if (!Number.isFinite(amount) || amount === 0) return;
    const label = metricMeta[key]?.label || key;
    const current = totals.get(key) || { label, amount: 0 };
    current.amount += amount;
    totals.set(key, current);
  };
  rows.forEach((row: any) => {
    if (
      metricMeta["cash_income"]?.category === "INCOME" ||
      !metricMeta["cash_income"]
    )
      add("cash_income", normalizeMetricValue(row.cash_income));
    if (
      metricMeta["card_income"]?.category === "INCOME" ||
      !metricMeta["card_income"]
    )
      add("card_income", normalizeMetricValue(row.card_income));
    const reportData =
      typeof row.report_data === "string"
        ? JSON.parse(row.report_data || "{}")
        : row.report_data;
    if (
      reportData &&
      typeof reportData === "object" &&
      !Array.isArray(reportData)
    ) {
      Object.entries(reportData).forEach(([key, value]) => {
        if (
          metricMeta[key]?.category === "INCOME" &&
          ![
            "cash_income",
            "card_income",
            "total_revenue",
            "revenue_cash",
            "revenue_card",
            "cash",
            "card",
            "receipts_count",
          ].includes(key)
        ) {
          add(key, normalizeMetricValue(value));
        }
      });
    }
  });
  return Array.from(totals.entries())
    .map(([key, value]) => ({ key, label: value.label, amount: value.amount }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getShiftRevenueRows(
  clubId: string,
  startDate: string,
  endDate: string,
) {
  const result = await query(
    `SELECT s.id, s.cash_income, s.card_income, s.expenses, s.report_data, COALESCE(s.shift_type, 'DAY') as shift_type, s.check_in as period_at
         FROM shifts s LEFT JOIN shift_reports sr ON s.shift_report_id = sr.id
         WHERE COALESCE(s.club_id, sr.club_id) = $1 AND s.status NOT IN ('ACTIVE', 'CANCELLED') AND s.check_in >= $2::timestamp AND s.check_in < $3::timestamp`,
    [clubId, startDate, endDate],
  );
  return result.rows;
}

