import React from "react";
import { Sun, Moon } from "lucide-react";
import { formatMoney } from "../_utils";

interface SummaryGridProps {
  totalRevenue: number;
  totals: {
    totalCash: number;
    totalCard: number;
    totalExpensesCore: number;
  };
  customFieldTotals: any[];
  receiptsTotal: number;
  averageReceipt: number;
  totalExpenses: number;
  shiftsCount: number;
  dayShiftsCount: number;
  nightShiftsCount: number;
  monthlyForecast: {
    total: number;
    daysLeft: number;
    daysElapsed: number;
  } | null;
  selectedMonth: string;
}

export function SummaryGrid({
  totalRevenue,
  totals,
  customFieldTotals,
  receiptsTotal,
  averageReceipt,
  totalExpenses,
  shiftsCount,
  dayShiftsCount,
  nightShiftsCount,
  monthlyForecast,
  selectedMonth,
}: SummaryGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
      {/* 1. Revenue Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-55">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Выручка
          </p>
          <p className="text-3xl lg:text-4xl font-bold text-emerald-600 tracking-tight whitespace-nowrap">
            {formatMoney(totalRevenue)}
          </p>
        </div>
        <div className="space-y-3 mt-auto">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 truncate mr-2">Наличные</span>
            <span className="font-medium text-slate-900 whitespace-nowrap">
              {formatMoney(totals.totalCash)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 truncate mr-2">Безналичные</span>
            <span className="font-medium text-slate-900 whitespace-nowrap">
              {formatMoney(totals.totalCard)}
            </span>
          </div>
          {customFieldTotals
            .filter(
              (f) =>
                (f.field_type === "OTHER" ||
                  f.field_type === "INCOME" ||
                  !f.field_type) &&
                f.metric_key !== "receipts_count" &&
                f.show_in_stats,
            )
            .map((field) => (
              <div
                key={field.metric_key}
                className="flex items-center justify-between text-sm"
              >
                <span
                  className="text-slate-500 truncate mr-2"
                  title={field.custom_label}
                >
                  {field.custom_label}
                </span>
                <span className="font-medium text-emerald-600 whitespace-nowrap">
                  {formatMoney(field.total || 0)}
                </span>
              </div>
            ))}
          {customFieldTotals
            .filter((f) => f.metric_key === "receipts_count")
            .map((field) => (
              <div
                key={field.metric_key}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-500 truncate mr-2">
                  {field.custom_label}
                </span>
                <span className="font-medium text-slate-900 whitespace-nowrap">
                  {(field.total || 0).toLocaleString()}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* 2. Average Check Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-55">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Средний чек
          </p>
          <p className="text-3xl lg:text-4xl font-bold text-blue-600 tracking-tight whitespace-nowrap">
            {averageReceipt > 0 ? formatMoney(averageReceipt) : "—"}
          </p>
        </div>
        <div className="space-y-3 mt-auto">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 truncate mr-2">Всего чеков</span>
            <span className="font-medium text-slate-900 whitespace-nowrap">
              {receiptsTotal.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 truncate mr-2">Общая выручка</span>
            <span className="font-medium text-slate-900 whitespace-nowrap">
              {formatMoney(totalRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Shifts & Expenses Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-55">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Смены и Расходы
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
              {shiftsCount}
            </p>
            <p className="text-sm text-slate-500 font-medium">смен</p>
          </div>
        </div>
        <div className="space-y-3 mt-auto pt-4 border-t border-slate-50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">Всего расходов</span>
            <span className="font-bold text-rose-600 whitespace-nowrap">
              -{formatMoney(totalExpenses)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pl-2">
            <span>Из них касса</span>
            <span>{formatMoney(totals.totalExpensesCore)}</span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2">
            <span className="flex items-center gap-1.5 text-slate-500 truncate mr-2">
              <Sun className="h-3.5 w-3.5 text-orange-500 shrink-0" /> Дневные
            </span>
            <span className="font-medium text-slate-900 whitespace-nowrap">
              {dayShiftsCount}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-slate-500 truncate mr-2">
              <Moon className="h-3.5 w-3.5 text-blue-500 shrink-0" /> Ночные
            </span>
            <span className="font-medium text-slate-900 whitespace-nowrap">
              {nightShiftsCount}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Forecast Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between h-full min-h-55">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Прогноз (Месяц)
          </p>
          <p className="text-3xl lg:text-4xl font-bold text-blue-600 tracking-tight whitespace-nowrap">
            {monthlyForecast
              ? formatMoney(monthlyForecast.total)
              : formatMoney(totalRevenue)}
          </p>
        </div>
        <div className="mt-auto">
          <p className="text-sm text-slate-500 leading-relaxed">
            {monthlyForecast && monthlyForecast.daysLeft > 0
              ? `На основе динамики по дням недели · ещё ${monthlyForecast.daysLeft} дн.`
              : "На основе текущей динамики выручки"}
          </p>
        </div>
      </div>
    </div>
  );
}
