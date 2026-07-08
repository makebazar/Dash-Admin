import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Clock,
  CalendarDays,
  RefreshCw,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { ShiftsMobileList } from "./ShiftsMobileList";
import { ShiftsDesktopTable } from "./ShiftsDesktopTable";
import { ShiftExcelImport } from "@/components/payroll/ShiftExcelImport";
import { cn } from "@/lib/utils";
import { Shift } from "../_types";
import { MaskedDateInput } from "./MaskedInputs";
import {
  formatDate,
  formatTime,
  formatMoney,
  getMetricValue,
  isWeekendDate,
} from "../_utils";

interface ShiftsListProps {
  clubId: string;
  sortedShifts: Shift[];
  employees: { id: string; full_name: string }[];
  reportEmployees: { id: string; full_name: string }[];
  reportFields: any[];
  clubTimezone: string;
  isLoading: boolean;
  filterStartDate: string;
  filterEndDate: string;
  filterStartDateDisplay: string;
  filterEndDateDisplay: string;
  selectedMonth: string;
  filterEmployee: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  hasReceiptsCount: boolean;
  calculateShiftTotalIncome: (s: Shift) => number;
  onSort: (column: string) => void;
  onFilterStartDateChange: (display: string, internal: string) => void;
  onFilterEndDateChange: (display: string, internal: string) => void;
  onCustomDateFilter: () => void;
  onClearFilters: () => void;
  onMonthSelect: (offset: number) => void;
  onFilterEmployeeChange: (val: string) => void;
  onRefresh: () => void;
  onRowClick: (shift: Shift) => void;
  openCreateModal: () => void;
}

export function ShiftsList({
  clubId,
  sortedShifts,
  employees,
  reportEmployees,
  reportFields,
  clubTimezone,
  isLoading,
  filterStartDate,
  filterEndDate,
  filterStartDateDisplay,
  filterEndDateDisplay,
  selectedMonth,
  filterEmployee,
  sortBy,
  sortOrder,
  hasReceiptsCount,
  calculateShiftTotalIncome,
  onSort,
  onFilterStartDateChange,
  onFilterEndDateChange,
  onCustomDateFilter,
  onClearFilters,
  onMonthSelect,
  onFilterEmployeeChange,
  onRefresh,
  onRowClick,
  openCreateModal,
}: ShiftsListProps) {

  // Column Reordering & Toggle State
  const defaultOrder = useMemo(() => [
    "check_in",
    "shift_type",
    "employee_name",
    "total_income",
    "cash_income",
    "card_income",
    "expenses",
    "average_check",
    ...reportFields.map((f) => f.metric_key),
    "status",
  ], [reportFields]);

  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/clubs/${clubId}/shifts/column-settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.columnOrder && Array.isArray(data.columnOrder) && data.columnOrder.length > 0) {
          setColumnOrder(data.columnOrder);
        }
        if (data.hiddenColumns && Array.isArray(data.hiddenColumns)) {
          setHiddenColumns(data.hiddenColumns);
        }
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load column settings from server:", err);
        setIsLoaded(true);
      });
  }, [clubId]);

  const currentOrder = useMemo(() => {
    if (!isLoaded) return defaultOrder;
    const merged = [...columnOrder];
    defaultOrder.forEach((item: string) => {
      if (!merged.includes(item)) merged.push(item);
    });
    return merged;
  }, [columnOrder, defaultOrder, isLoaded]);

  // Filter out columns that don't make sense for the current template
  const activeColumns = useMemo(() => {
    return currentOrder.filter((colKey: string) => {
      if (hiddenColumns.includes(colKey)) return false;
      if (colKey === "average_check" && !hasReceiptsCount) return false;
      if (
        ![
          "check_in",
          "shift_type",
          "employee_name",
          "total_income",
          "cash_income",
          "card_income",
          "expenses",
          "average_check",
          "status",
        ].includes(colKey)
      ) {
        return reportFields.some((f) => f.metric_key === colKey);
      }
      return true;
    });
  }, [currentOrder, hiddenColumns, hasReceiptsCount, reportFields]);

  const getColumnLabel = (key: string) => {
    const field = reportFields.find((f) => f.metric_key === key);
    if (field) return field.custom_label || field.label || key;

    const labels: Record<string, string> = {
      check_in: "Дата",
      shift_type: "Смена",
      employee_name: "Сотрудник",
      total_income: "Выручка",
      cash_income: "Наличные",
      card_income: "Безнал",
      expenses: "Расходы",
      average_check: "Средний чек",
      status: "Статус",
    };
    return labels[key] || key;
  };

  const saveSettingsToServer = (newOrder: string[], newHidden: string[]) => {
    fetch(`/api/clubs/${clubId}/shifts/column-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnOrder: newOrder, hiddenColumns: newHidden }),
    }).catch((err) => console.error("Failed to save column settings to server:", err));
  };

  const handleMoveColumn = (colKey: string, direction: "up" | "down") => {
    const newOrder = [...currentOrder];
    const index = newOrder.indexOf(colKey);
    if (index === -1) return;

    const activeIndex = activeColumns.indexOf(colKey);
    if (activeIndex === -1) return;

    const targetActiveIndex = direction === "up" ? activeIndex - 1 : activeIndex + 1;
    if (targetActiveIndex < 0 || targetActiveIndex >= activeColumns.length) return;

    const targetColKey = activeColumns[targetActiveIndex];
    const targetIndex = newOrder.indexOf(targetColKey);
    if (targetIndex === -1) return;

    // Swap
    newOrder[index] = targetColKey;
    newOrder[targetIndex] = colKey;

    setColumnOrder(newOrder);
    saveSettingsToServer(newOrder, hiddenColumns);
  };

  const handleToggleColumn = (colKey: string) => {
    let newHidden = [...hiddenColumns];
    if (newHidden.includes(colKey)) {
      newHidden = newHidden.filter((k) => k !== colKey);
    } else {
      newHidden.push(colKey);
    }
    setHiddenColumns(newHidden);
    saveSettingsToServer(currentOrder, newHidden);
  };

  const handleResetColumns = () => {
    setColumnOrder(defaultOrder);
    setHiddenColumns([]);
    saveSettingsToServer(defaultOrder, []);
  };


  return (
    <div>
      {/* Header Controls */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
            Смены
          </h1>
          <div className="flex items-center gap-3">
            <ShiftExcelImport
              clubId={clubId}
              employees={employees}
              customFields={reportFields.map((f) => ({
                metric_key: f.metric_key,
                custom_label: f.custom_label || f.label || f.metric_key,
              }))}
              onSuccess={onRefresh}
            />

            {/* Column Order/Visibility Settings Button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  title="Настройка колонок"
                  className="h-12 rounded-xl px-4 border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-all"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 rounded-2xl border-slate-200 shadow-xl" align="end">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-slate-800">Колонки таблицы</h3>
                  <Button
                    variant="ghost"
                    onClick={handleResetColumns}
                    className="h-6 text-[10px] text-muted-foreground hover:text-black px-1"
                  >
                    Сбросить
                  </Button>
                </div>
                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                  {currentOrder
                    .filter((key: string) => key !== "average_check" || hasReceiptsCount)
                    .filter((key: string) => {
                      if (
                        ![
                          "check_in",
                          "shift_type",
                          "employee_name",
                          "total_income",
                          "cash_income",
                          "card_income",
                          "expenses",
                          "average_check",
                          "status",
                        ].includes(key)
                      ) {
                        return reportFields.some((f: any) => f.metric_key === key);
                      }
                      return true;
                    })
                    .map((colKey: string, index: number, arr: string[]) => {
                      const isHidden = hiddenColumns.includes(colKey);
                      return (
                        <div
                          key={colKey}
                          className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 border border-transparent transition-all"
                        >
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none truncate flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={!isHidden}
                              onChange={() => handleToggleColumn(colKey)}
                              className="rounded border-slate-300 text-black focus:ring-black h-4 w-4"
                            />
                            <span className="truncate">{getColumnLabel(colKey)}</span>
                          </label>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Button
                              variant="ghost"
                              disabled={index === 0}
                              onClick={() => handleMoveColumn(colKey, "up")}
                              className="h-6 w-6 p-0 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={index === arr.length - 1}
                              onClick={() => handleMoveColumn(colKey, "down")}
                              className="h-6 w-6 p-0 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={isLoading}
              title="Обновить данные"
              className="h-12 rounded-xl px-4 border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-all"
            >
              <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
            </Button>
            <Button
              onClick={openCreateModal}
              className="h-12 min-w-12 rounded-xl px-4 sm:px-6 bg-black text-white hover:bg-slate-800 font-medium transition-all"
            >
              <span className="sm:hidden text-lg leading-none">+</span>
              <span className="hidden sm:inline">Добавить смену</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Date Filters Popovers */}
      <div className="mb-12 flex flex-col lg:flex-row gap-4 items-start lg:items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-full lg:w-auto min-w-50">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-12 w-full justify-start text-left font-medium text-base capitalize rounded-xl hover:bg-slate-50",
                  !selectedMonth && "text-slate-400",
                )}
              >
                <CalendarDays className="mr-3 h-5 w-5 text-slate-400 shrink-0" />
                <span className="truncate">
                  {selectedMonth
                    ? (() => {
                        const now = new Date();
                        const target = new Date(
                          now.getFullYear(),
                          now.getMonth() + parseInt(selectedMonth),
                          1,
                        );
                        return target.toLocaleString("ru-RU", {
                          month: "long",
                          year: "numeric",
                        });
                      })()
                    : "Выберите месяц"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-50 p-2 rounded-xl border-slate-200 shadow-lg"
              align="start"
            >
              <div className="grid gap-1">
                {[0, -1, -2, -3].map((offset) => {
                  const now = new Date();
                  const target = new Date(
                    now.getFullYear(),
                    now.getMonth() + offset,
                    1,
                  );
                  const label = target.toLocaleString("ru-RU", {
                    month: "long",
                    year: "numeric",
                  });
                  return (
                    <Button
                      key={offset}
                      variant={selectedMonth === String(offset) ? "secondary" : "ghost"}
                      className="justify-start w-full capitalize h-10 px-3 font-medium rounded-lg"
                      onClick={() => onMonthSelect(offset)}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="h-8 w-px bg-slate-200 hidden lg:block" />

        <div className="flex flex-col sm:flex-row flex-1 w-full lg:w-auto gap-2">
          <MaskedDateInput
            value={filterStartDateDisplay}
            onValueChange={onFilterStartDateChange}
            className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all w-full"
            placeholder="С (ДД.ММ.ГГГГ)"
          />
          <MaskedDateInput
            value={filterEndDateDisplay}
            onValueChange={onFilterEndDateChange}
            className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all w-full"
            placeholder="По (ДД.ММ.ГГГГ)"
          />
          <Button
            variant="secondary"
            onClick={onCustomDateFilter}
            className="h-12 rounded-xl px-6 bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition-all w-full sm:w-auto"
          >
            Найти
          </Button>
        </div>

        <div className="h-8 w-px bg-slate-200 hidden lg:block" />

        <div className="flex-1 w-full lg:w-auto min-w-50">
          <Select
            value={filterEmployee || "all"}
            onValueChange={(val) => onFilterEmployeeChange(val === "all" ? "" : val)}
          >
            <SelectTrigger className="h-12 w-full rounded-xl border-transparent hover:bg-slate-50 focus:ring-0 font-medium text-base shadow-none">
              <SelectValue placeholder="Сотрудник" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 shadow-lg">
              <SelectItem value="all" className="font-medium">
                Все сотрудники
              </SelectItem>
              {reportEmployees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id} className="font-medium">
                  {emp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(filterStartDate || filterEndDate || (selectedMonth && selectedMonth !== "0")) && (
          <>
            <div className="h-8 w-px bg-slate-200 hidden lg:block" />
            <Button
              variant="ghost"
              onClick={onClearFilters}
              className="h-12 rounded-xl px-4 text-slate-400 hover:text-slate-700 hover:bg-slate-50 font-medium w-full lg:w-auto"
            >
              Сбросить
            </Button>
          </>
        )}
      </div>

      {/* Shifts History List */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-6">История смен</h2>

        {sortedShifts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
            <Clock className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-lg">Смен за этот период не найдено</p>
          </div>
        ) : (
          <>
            <ShiftsMobileList
              sortedShifts={sortedShifts}
              clubTimezone={clubTimezone}
              hasReceiptsCount={hasReceiptsCount}
              reportFields={reportFields}
              calculateShiftTotalIncome={calculateShiftTotalIncome}
              onRowClick={onRowClick}
            />

            <ShiftsDesktopTable
              sortedShifts={sortedShifts}
              activeColumns={activeColumns}
              clubTimezone={clubTimezone}
              hasReceiptsCount={hasReceiptsCount}
              reportFields={reportFields}
              calculateShiftTotalIncome={calculateShiftTotalIncome}
              onRowClick={onRowClick}
              onSort={onSort}
            />
          </>
        )}
      </div>
    </div>
  );
}

