import {
  formatDateKeyInTimezone,
  getDateObject,
  isWeekendDate,
  formatWeekdayFull,
  formatWeekdayShortByIndex,
  formatShiftType,
  formatCurrency,
  formatSignedPercent,
} from "../_formatters";
import {
  getClubTimezone,
} from "./revenueTrend";
import {
  getReportMetricMeta,
  getShiftRevenueRows,
  calculateShiftIncomeTotal,
  calculateShiftBarSales,
  calculateShiftReceiptsCount,
} from "./shiftStats";
import type { RevenueInsightsSnapshot } from "../_types";

export async function getRevenueInsights(
  clubId: string,
  lookbackDays: number,
): Promise<RevenueInsightsSnapshot> {
  const clubTimezone = await getClubTimezone(clubId);
  const metricMeta = await getReportMetricMeta(clubId);
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - lookbackDays);

  const rows = await getShiftRevenueRows(
    clubId,
    startDate.toISOString(),
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  );
  const dailyTotals = new Map<string, number>();
  const dailyReceipts = new Map<string, number>();
  const dailyBarTotals = new Map<string, number>();
  const shiftTypeDailyTotals = new Map<string, number>();

  let lookbackTotalRevenue = 0;
  let lookbackTotalBarSales = 0;

  rows.forEach((row: any) => {
    const dateKey = formatDateKeyInTimezone(row.period_at, clubTimezone);
    const amount = calculateShiftIncomeTotal(row, metricMeta);
    const barAmount = calculateShiftBarSales(row, metricMeta);
    const receiptsCount = calculateShiftReceiptsCount(row);

    dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + amount);
    dailyReceipts.set(dateKey, (dailyReceipts.get(dateKey) || 0) + receiptsCount);
    dailyBarTotals.set(dateKey, (dailyBarTotals.get(dateKey) || 0) + barAmount);

    lookbackTotalRevenue += amount;
    lookbackTotalBarSales += barAmount;

    const shiftTypeKey = `${dateKey}:${row.shift_type || "DAY"}`;
    shiftTypeDailyTotals.set(
      shiftTypeKey,
      (shiftTypeDailyTotals.get(shiftTypeKey) || 0) + amount,
    );
  });

  const weekdayStats = new Map<number, { total: number; count: number }>();
  const weekendStats = { total: 0, receipts: 0, count: 0 };
  const weekdayOnlyStats = { total: 0, receipts: 0, count: 0 };
  Array.from({ length: 7 }, (_, weekday) => {
    weekdayStats.set(weekday, { total: 0, count: 0 });
  });

  const dailyEntries = Array.from(dailyTotals.entries())
    .map(([date, revenue]) => ({
      date,
      revenue,
      weekday: getDateObject(date).getDay(),
      isWeekend: isWeekendDate(date),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  dailyEntries.forEach((entry) => {
    const current = weekdayStats.get(entry.weekday) || { total: 0, count: 0 };
    current.total += entry.revenue;
    current.count += 1;
    weekdayStats.set(entry.weekday, current);

    const receipts = dailyReceipts.get(entry.date) || 0;

    if (entry.isWeekend) {
      weekendStats.total += entry.revenue;
      weekendStats.receipts += receipts;
      weekendStats.count += 1;
    } else {
      weekdayOnlyStats.total += entry.revenue;
      weekdayOnlyStats.receipts += receipts;
      weekdayOnlyStats.count += 1;
    }
  });

  const weekdayAverages = [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const stats = weekdayStats.get(weekday) || { total: 0, count: 0 };
    return {
      weekday,
      label: formatWeekdayFull(weekday),
      shortLabel: formatWeekdayShortByIndex(weekday),
      avgRevenue: stats.count > 0 ? stats.total / stats.count : 0,
      isWeekend: weekday === 0 || weekday === 6,
    };
  });

  const weekdaysWithData = weekdayAverages.filter(
    (item) => item.avgRevenue > 0,
  );
  const bestWeekday = weekdaysWithData.reduce(
    (best, item) => (!best || item.avgRevenue > best.avgRevenue ? item : best),
    null as (typeof weekdaysWithData)[number] | null,
  );
  const weakestWeekday = weekdaysWithData.reduce(
    (worst, item) =>
      !worst || item.avgRevenue < worst.avgRevenue ? item : worst,
    null as (typeof weekdaysWithData)[number] | null,
  );

  const weekendAvg =
    weekendStats.count > 0 ? weekendStats.total / weekendStats.count : 0;
  const weekdayAvg =
    weekdayOnlyStats.count > 0
      ? weekdayOnlyStats.total / weekdayOnlyStats.count
      : 0;

  const weekendAvgCheck =
    weekendStats.receipts > 0
      ? weekendStats.total / weekendStats.receipts
      : 0;
  const weekdayAvgCheck =
    weekdayOnlyStats.receipts > 0
      ? weekdayOnlyStats.total / weekdayOnlyStats.receipts
      : 0;
  const checkDeltaPercent =
    weekdayAvgCheck > 0
      ? ((weekendAvgCheck - weekdayAvgCheck) / weekdayAvgCheck) * 100
      : 0;

  // Bar sales weekday stats
  const barWeekdayTotals = new Map<number, { total: number; count: number }>();
  Array.from({ length: 7 }, (_, w) =>
    barWeekdayTotals.set(w, { total: 0, count: 0 }),
  );
  dailyBarTotals.forEach((barRev, dateKey) => {
    const wday = getDateObject(dateKey).getDay();
    const curr = barWeekdayTotals.get(wday)!;
    curr.total += barRev;
    curr.count += 1;
  });

  let bestBarWeekday = -1;
  let maxBarAvg = 0;
  barWeekdayTotals.forEach((stats, wday) => {
    const avg = stats.count > 0 ? stats.total / stats.count : 0;
    if (avg > maxBarAvg) {
      maxBarAvg = avg;
      bestBarWeekday = wday;
    }
  });

  const shiftTypeCombos = Array.from(shiftTypeDailyTotals.entries()).reduce(
    (acc, [key, value]) => {
      const [, shiftType] = key.split(":");
      const date = key.slice(0, 10);
      const weekday = getDateObject(date).getDay();
      const comboKey = `${shiftType}:${weekday}`;
      const current = acc.get(comboKey) || {
        shiftType,
        weekday,
        total: 0,
        count: 0,
      };
      current.total += value;
      current.count += 1;
      acc.set(comboKey, current);
      return acc;
    },
    new Map<
      string,
      { shiftType: string; weekday: number; total: number; count: number }
    >(),
  );

  const bestShiftCombo =
    Array.from(shiftTypeCombos.values())
      .filter((item) => item.count >= 2)
      .map((item) => ({ ...item, avgRevenue: item.total / item.count }))
      .sort((a, b) => b.avgRevenue - a.avgRevenue)[0] || null;

  const latestEntry = dailyEntries[dailyEntries.length - 1] || null;
  const latestWeekdayBaseline = latestEntry
    ? weekdayAverages.find((item) => item.weekday === latestEntry.weekday)
        ?.avgRevenue || 0
    : 0;
  const latestVsTypical =
    latestEntry && latestWeekdayBaseline > 0
      ? ((latestEntry.revenue - latestWeekdayBaseline) /
          latestWeekdayBaseline) *
        100
      : 0;

  const insights: RevenueInsightsSnapshot["insights"] = [];

  // 1. High Priority: Yesterday Anomaly
  if (latestEntry && Math.abs(latestVsTypical) >= 10) {
    const dayLabel = formatWeekdayFull(latestEntry.weekday);
    insights.push({
      title: `Вчера (${dayLabel})`,
      value: formatSignedPercent(latestVsTypical),
      description:
        latestVsTypical >= 0
          ? `Выручка ${formatCurrency(latestEntry.revenue)} (на ${formatCurrency(Math.round(latestEntry.revenue - latestWeekdayBaseline))} выше нормы)`
          : `Выручка ${formatCurrency(latestEntry.revenue)} (на ${formatCurrency(Math.round(latestWeekdayBaseline - latestEntry.revenue))} ниже нормы)`,
      tone: latestVsTypical >= 0 ? "success" : "warning",
    });
  }

  // 2. Strongest & Weakest Days
  if (bestWeekday)
    insights.push({
      title: "Сильный день",
      value: bestWeekday.label,
      description: `В среднем ${formatCurrency(bestWeekday.avgRevenue)} за день`,
      tone: "success",
    });
  if (weakestWeekday)
    insights.push({
      title: "Слабый день",
      value: weakestWeekday.label,
      description: `Обычно просадка тут: ${formatCurrency(weakestWeekday.avgRevenue)}`,
      tone: "warning",
    });

  // 3. Bar Sales Share
  if (lookbackTotalRevenue > 0 && lookbackTotalBarSales > 0) {
    const barPercent = (lookbackTotalBarSales / lookbackTotalRevenue) * 100;
    const bestBarDayLabel =
      bestBarWeekday !== -1 ? formatWeekdayFull(bestBarWeekday) : "";
    insights.push({
      title: "Доля продаж бара",
      value: `${barPercent.toFixed(1)}% выручки`,
      description: `В среднем ${formatCurrency(Math.round(lookbackTotalBarSales / lookbackDays))}/день. Лучший день: ${bestBarDayLabel}`,
      tone: barPercent >= 15 ? "success" : "default",
    });
  }

  // 4. Weekend vs Weekday Avg Check
  if (
    weekendAvgCheck > 0 &&
    weekdayAvgCheck > 0 &&
    Math.abs(checkDeltaPercent) >= 2
  ) {
    insights.push({
      title: "Чек в выходные",
      value: formatSignedPercent(checkDeltaPercent),
      description: `В среднем ${formatCurrency(Math.round(weekendAvgCheck))} против ${formatCurrency(Math.round(weekdayAvgCheck))} в будни`,
      tone:
        checkDeltaPercent >= 5
          ? "success"
          : checkDeltaPercent <= -5
            ? "warning"
            : "default",
    });
  }

  // 5. Strongest shift combination (fallback or 5th slot)
  if (bestShiftCombo && insights.length < 4) {
    insights.push({
      title: "Сильная смена",
      value: `${formatShiftType(bestShiftCombo.shiftType)} · ${formatWeekdayFull(bestShiftCombo.weekday)}`,
      description: `В среднем ${formatCurrency(bestShiftCombo.avgRevenue)}`,
      tone: "default",
    });
  }

  return { insights: insights.slice(0, 4) };
}
