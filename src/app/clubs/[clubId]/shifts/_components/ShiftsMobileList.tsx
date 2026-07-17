import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Moon, Sun, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Shift } from "../_types";
import {
  formatDate,
  formatTime,
  formatMoney,
  getMetricValue,
  isWeekendDate,
} from "../_utils";

interface ShiftsMobileListProps {
  sortedShifts: Shift[];
  clubTimezone: string;
  hasReceiptsCount: boolean;
  reportFields: any[];
  calculateShiftTotalIncome: (s: Shift) => number;
  onRowClick: (shift: Shift) => void;
}

export function ShiftsMobileList({
  sortedShifts,
  clubTimezone,
  hasReceiptsCount,
  reportFields,
  calculateShiftTotalIncome,
  onRowClick,
}: ShiftsMobileListProps) {
  const getStatusBadge = (shift: Shift) => {
    if (!shift.check_out) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          Активна
        </Badge>
      );
    }
    if (shift.status === "VERIFIED") {
      if (shift.has_owner_corrections) {
        return (
          <Badge
            className="bg-orange-500/10 text-orange-500 border-orange-500/20"
            aria-label="Подтверждена, есть правки"
            title="Подтверждена, есть правки"
          >
            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            Подтверждена
          </Badge>
        );
      }
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          ✓ Подтверждена
        </Badge>
      );
    }
    const hasDiscrepancy = shift.report_data?.has_discrepancies === true;
    if (hasDiscrepancy) {
      return (
        <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20" title="В кассе обнаружены расхождения!">
          <AlertTriangle className="mr-1 h-3.5 w-3.5" />
          Закрыта
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
        Закрыта
      </Badge>
    );
  };

  return (
    <div className="md:hidden space-y-3">
      {sortedShifts.map((shift) => {
        const isWeekend = isWeekendDate(shift.check_in, clubTimezone);
        const isNoReport = shift.report_mode === "NO_REPORT";
        const hours = Number(shift.total_hours) || 0;
        const isSutki = hours >= 20;
        const isLongShift = !isSutki && hours >= 13;
        return (
          <div
            key={shift.id}
            className="bg-white rounded-2xl border border-slate-200 p-4 font-sans select-none cursor-pointer"
            onClick={() => onRowClick(shift)}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "font-bold text-lg whitespace-nowrap",
                      isWeekend ? "text-rose-600" : "text-slate-900",
                    )}
                  >
                    {formatDate(shift.check_in, clubTimezone)}
                  </span>
                  {shift.shift_type === "NIGHT" ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                      <Moon className="h-3 w-3" /> Ночь
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 text-xs font-medium">
                      <Sun className="h-3 w-3" /> День
                    </span>
                  )}
                  {isSutki && (
                    <Badge
                      variant="secondary"
                      className="bg-violet-100 text-violet-700 border border-violet-200 h-5 px-2 text-[10px]"
                    >
                      Сутки
                    </Badge>
                  )}
                  {!isSutki && isLongShift && (
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-700 border border-slate-200 h-5 px-2 text-[10px]"
                    >
                      Длинная смена
                    </Badge>
                  )}
                  {isNoReport && (
                    <Badge
                      variant="secondary"
                      className="bg-zinc-800 text-zinc-200 border border-zinc-700 h-5 px-2 text-[10px]"
                    >
                      {shift.actor_role_name_snapshot || "Хостес"}
                    </Badge>
                  )}
                </div>
                <div className="text-sm font-medium text-slate-700 truncate">
                  {shift.employee_name || "Неизвестно"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {formatTime(shift.check_in, clubTimezone)} —{" "}
                  {shift.check_out ? formatTime(shift.check_out, clubTimezone) : "..."}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    isNoReport ? "text-slate-400" : "text-emerald-600",
                  )}
                >
                  {isNoReport ? "—" : formatMoney(calculateShiftTotalIncome(shift))}
                </div>
                <div className="mt-1 flex justify-end">{getStatusBadge(shift)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">
                  Часы
                </div>
                <div className="text-sm font-bold text-slate-900 tabular-nums">
                  {shift.total_hours && !isNaN(Number(shift.total_hours))
                    ? `${Number(shift.total_hours).toFixed(1)}ч`
                    : "-"}
                </div>
              </div>
              {isNoReport ? (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">
                    Отчёт
                  </div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">
                    Не требуется
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">
                      Нал
                    </div>
                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatMoney(shift.cash_income)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">
                      Безнал
                    </div>
                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatMoney(shift.card_income)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-rose-400 mb-1">
                      Расходы
                    </div>
                    <div className="text-sm font-bold text-rose-600 tabular-nums">
                      {formatMoney(shift.expenses)}
                    </div>
                  </div>
                  {hasReceiptsCount && (
                    <div className="rounded-xl bg-blue-50/50 border border-blue-100/50 p-3">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-blue-400 mb-1">
                        Ср. чек
                      </div>
                      <div className="text-sm font-bold text-blue-600 tabular-nums">
                        {(() => {
                          const totalRevenue = calculateShiftTotalIncome(shift);
                          const receiptsCount = Number(shift.report_data?.receipts_count || 0);
                          return receiptsCount > 0
                            ? formatMoney(totalRevenue / receiptsCount)
                            : "—";
                        })()}
                      </div>
                    </div>
                  )}
                  {reportFields.map((field: any) => {
                    const raw = shift.report_data?.[field.metric_key];
                    const parsed = parseFloat(String(raw));
                    const valStr = Array.isArray(raw)
                      ? formatMoney(getMetricValue(shift, field.metric_key))
                      : raw === null || raw === undefined || raw === ""
                        ? "-"
                        : !Number.isNaN(parsed)
                          ? formatMoney(parsed)
                          : String(raw);

                    return (
                      <div
                        key={field.metric_key}
                        className="rounded-xl bg-slate-50 border border-slate-100 p-3"
                      >
                        <div
                          className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1 truncate"
                          title={field.custom_label}
                        >
                          {field.custom_label}
                        </div>
                        <div className="text-sm font-bold text-slate-900 tabular-nums">
                          {valStr}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl border-slate-200 text-slate-700 font-medium hover:bg-slate-50 hover:text-black"
                onClick={(e) => {
                  e.stopPropagation();
                  onRowClick(shift);
                }}
              >
                Открыть смену
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
