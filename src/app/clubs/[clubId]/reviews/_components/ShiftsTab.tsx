"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Loader2,
  CheckCircle2,
  CheckCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { UseShiftsReturn } from "../_hooks/useShifts";
import {
  getShiftMetricValue,
  formatShiftMoney,
  formatShiftCorrectionValue,
} from "../_utils/reviews-utils";

interface ShiftsTabProps extends UseShiftsReturn {
  clubId: string;
}

export function ShiftsTab({
  clubId,
  shifts,
  isShiftsLoading,
  isSubmittingShift,
  shiftsTab,
  setShiftsTab,
  filterShiftMonth,
  setFilterShiftMonth,
  shiftReportFields,
  filteredShifts,
  shiftMonths,
  currentShiftMonthIndex,
  fetchShiftsForReview,
  handleVerifyShiftForReview,
  handleOpenShift,
}: ShiftsTabProps) {
  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <Tabs
        value={shiftsTab}
        onValueChange={(v) => setShiftsTab(v as "active" | "history")}
        className="w-full"
      >
        <TabsList className="flex h-auto w-full justify-start gap-6 overflow-x-auto rounded-none bg-transparent p-0 mb-6">
          <TabsTrigger
            value="active"
            className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all"
          >
            Ожидают проверки
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all"
          >
            История
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {shiftsTab === "history" && (
              <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 shadow-sm px-3 h-10 w-[240px]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                  onClick={() => {
                    const nextIndex = currentShiftMonthIndex + 1;
                    if (nextIndex < shiftMonths.length) {
                      setFilterShiftMonth(shiftMonths[nextIndex]);
                    }
                  }}
                  disabled={
                    currentShiftMonthIndex === -1 ||
                    currentShiftMonthIndex >= shiftMonths.length - 1
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {format(
                      new Date(`${filterShiftMonth}-01`),
                      "MMMM yyyy",
                      { locale: ru },
                    )}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                  onClick={() => {
                    const nextIndex = currentShiftMonthIndex - 1;
                    if (nextIndex >= 0) {
                      setFilterShiftMonth(shiftMonths[nextIndex]);
                    }
                  }}
                  disabled={currentShiftMonthIndex <= 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 border-slate-100 pt-3 sm:pt-0 mt-2 sm:mt-0">
            <div className="text-sm font-medium text-slate-500">
              Показано:{" "}
              <span className="text-slate-900">{filteredShifts.length}</span>{" "}
              смен
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchShiftsForReview(clubId)}
              disabled={isShiftsLoading}
              className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 shrink-0"
            >
              <RotateCcw
                className={cn("h-4 w-4", isShiftsLoading && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isShiftsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : filteredShifts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">
            {shiftsTab === "active"
              ? "Нет смен на подтверждение"
              : "Нет подтвержденных смен"}
          </h3>
          <p>
            {shiftsTab === "active"
              ? "Все закрытые смены уже подтверждены или еще не завершены."
              : "В выбранном месяце пока нет подтвержденных смен."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-24">
          {filteredShifts.map((shift) => {
            const cashIncome = getShiftMetricValue(shift, "cash_income");
            const cardIncome = getShiftMetricValue(shift, "card_income");
            const expenses = getShiftMetricValue(shift, "expenses");
            const customIncome = shiftReportFields
              .filter((field) => field.field_type === "INCOME")
              .reduce(
                (sum, field) =>
                  sum + getShiftMetricValue(shift, field.metric_key),
                0,
              );
            const totalIncome = cashIncome + cardIncome + customIncome;

            return (
              <Card key={shift.id} className="shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-base">
                            {shift.employee_name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {shift.shift_type === "NIGHT" ? "Ночная" : "Дневная"}
                          </Badge>
                          {shift.status === "VERIFIED" ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">
                              Подтверждена
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-blue-600 border-blue-200 bg-blue-50"
                            >
                              Ожидает подтверждения
                            </Badge>
                          )}
                          {shift.has_owner_corrections && (
                            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-0">
                              Есть правки владельца
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          <span>
                            {format(
                              new Date(shift.check_in),
                              "dd.MM.yyyy",
                              { locale: ru },
                            )}
                          </span>
                          <span>
                            {format(new Date(shift.check_in), "HH:mm")}{" "}
                            -{" "}
                            {shift.check_out
                              ? format(new Date(shift.check_out), "HH:mm")
                              : "..."}
                          </span>
                          <span>
                            {Number(shift.total_hours || 0).toFixed(1)} ч
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 rounded-lg border bg-muted/20 px-3 py-2 text-right">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Итого
                        </div>
                        <div className="text-lg font-bold text-green-600 tabular-nums">
                          {formatShiftMoney(totalIncome)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      <div className="rounded-md bg-muted/20 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Наличные
                        </div>
                        <div className="text-sm font-medium tabular-nums">
                          {formatShiftMoney(cashIncome)}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/20 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Безнал
                        </div>
                        <div className="text-sm font-medium tabular-nums">
                          {formatShiftMoney(cardIncome)}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/20 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Расходы
                        </div>
                        <div className="text-sm font-medium text-orange-600 tabular-nums">
                          {formatShiftMoney(expenses)}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/20 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Часы
                        </div>
                        <div className="text-sm font-medium tabular-nums">
                          {shift.total_hours &&
                          !Number.isNaN(Number(shift.total_hours))
                            ? `${Number(shift.total_hours).toFixed(1)}ч`
                            : "-"}
                        </div>
                      </div>
                      {shiftReportFields.map((field) => {
                        const raw = shift.report_data?.[field.metric_key];
                        const parsed = parseFloat(String(raw));
                        const value =
                          raw === null || raw === undefined || raw === ""
                            ? "-"
                            : !Number.isNaN(parsed)
                              ? formatShiftMoney(parsed)
                              : String(raw);
                        return (
                          <div
                            key={field.metric_key}
                            className="rounded-md bg-muted/20 p-2"
                          >
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                              {field.custom_label}
                            </div>
                            <div className="text-sm font-medium tabular-nums">
                              {value}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {shift.report_comment && (
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 border">
                        {shift.report_comment}
                      </div>
                    )}
                    {shift.owner_notes && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                        <span className="font-medium">Заметка владельца:</span>{" "}
                        {shift.owner_notes}
                      </div>
                    )}
                    {shift.has_owner_corrections &&
                      (shift.owner_correction_changes &&
                      shift.owner_correction_changes.length > 0 ? (
                        <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-3 text-sm text-orange-900">
                          <div className="mb-2 font-medium">Правки владельца</div>
                          <div className="space-y-2">
                            {shift.owner_correction_changes
                              .slice(0, 3)
                              .map((change, index) => (
                                <div
                                  key={`${change.field}-${index}`}
                                  className="rounded-md bg-white/80 px-2.5 py-2"
                                >
                                  <div className="text-xs font-medium uppercase tracking-wide text-orange-700">
                                    {change.label}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Было:{" "}
                                    <span className="text-foreground">
                                      {formatShiftCorrectionValue(
                                        change,
                                        change.before,
                                      )}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    Стало:{" "}
                                    <span className="text-foreground">
                                      {formatShiftCorrectionValue(
                                        change,
                                        change.after,
                                      )}
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                          {shift.owner_correction_changes.length > 3 && (
                            <div className="mt-2 text-xs text-orange-700">
                              И еще{" "}
                              {shift.owner_correction_changes.length - 3} правки
                              в карточке смены
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                          Детализация правок для этой смены не сохранена, потому
                          что она была изменена до добавления diff.
                        </div>
                      ))}

                    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto sm:min-w-[170px]"
                        onClick={() => handleOpenShift(shift.id)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Открыть смену
                      </Button>
                      {shift.status !== "VERIFIED" && (
                        <Button
                          className="w-full bg-green-600 text-white hover:bg-green-700 sm:w-auto sm:min-w-[170px]"
                          onClick={() => handleVerifyShiftForReview(shift)}
                          disabled={isSubmittingShift === shift.id}
                        >
                          {isSubmittingShift === shift.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-2 h-4 w-4" />
                          )}
                          Подтвердить
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
