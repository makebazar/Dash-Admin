"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

// Sub-components
import { SummaryGrid } from "./_components/SummaryGrid";
import { ShiftsList } from "./_components/ShiftsList";
import { ShiftDetailDialog } from "./_components/ShiftDetailDialog";
import { EditShiftDialog } from "./_components/EditShiftDialog";
import { CreateShiftDialog } from "./_components/CreateShiftDialog";

// Types & Utils
import { Shift, ShiftDetails } from "./_types";
import {
  getMetricValue,
  dateToDisplay,
  formatMoney,
} from "./_utils";

export default function ShiftsPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const router = useRouter();
  const [clubId, setClubId] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedShiftDetails] = useState<ShiftDetails | null>(null);
  const [isLoadingDetails] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [clubTimezone, setClubTimezone] = useState("Europe/Moscow");

  // Create shift modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);

  // Date filter state
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterStartDateDisplay, setFilterStartDateDisplay] = useState("");
  const [filterEndDateDisplay, setFilterEndDateDisplay] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("0");

  const [reportFields, setReportFields] = useState<any[]>([]);

  // Previous month shifts for fallback
  const [prevMonthShifts, setPrevMonthShifts] = useState<Shift[]>([]);

  // Sort state
  const [sortBy, setSortBy] = useState<string>("check_in");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const lastRevenueRef = useRef<number | null>(null);

  // Abort controller ref for fetching shifts
  const fetchAbortController = useRef<AbortController | null>(null);

  const calculateShiftTotalIncome = useCallback(
    (shift: Shift) => {
      const cash = getMetricValue(shift, "cash_income");
      const card = getMetricValue(shift, "card_income");
      const customIncome = reportFields
        .filter(
          (f) => f.field_type === "INCOME" && f.metric_key !== "receipts_count",
        )
        .reduce((sum, f) => sum + getMetricValue(shift, f.metric_key), 0);
      return cash + card + customIncome;
    },
    [reportFields],
  );

  useEffect(() => {
    params.then((p) => {
      setClubId(p.clubId);
      fetchClubSettings(p.clubId);
      fetchReportTemplate(p.clubId);
      fetchEmployees(p.clubId);

      // Prefetch previous month shifts for forecast fallback
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevStart = `${prevYear}-${pad(prevMonth)}-01`;
      const lastDay = new Date(prevYear, prevMonth, 0).getDate();
      const prevEnd = `${prevYear}-${pad(prevMonth)}-${pad(lastDay)}`;
      fetch(`/api/clubs/${p.clubId}/shifts?startDate=${prevStart}&endDate=${prevEnd}`)
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.shifts)) setPrevMonthShifts(d.shifts);
        })
        .catch(() => {});
    });
  }, [params]);

  const fetchReportTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/clubs/${id}/settings/reports`);
      const data = await res.json();
      if (res.ok && data.currentTemplate) {
        const standardKeys = [
          "cash_income",
          "card_income",
          "expenses_cash",
          "shift_comment",
          "expenses",
        ];
        const customFields = data.currentTemplate.schema.filter(
          (f: any) =>
            !standardKeys.includes(f.metric_key) &&
            !standardKeys.some((k) => f.metric_key.includes(k)),
        );
        setReportFields(customFields);
      }
    } catch (error) {
      console.error("Error fetching report template:", error);
    }
  };

  const fetchClubSettings = async (id: string) => {
    try {
      const res = await fetch(`/api/clubs/${id}/settings`);
      const data = await res.json();
      if (res.ok && data.club?.timezone) {
        setClubTimezone(data.club.timezone);
      }
    } catch (error) {
      console.error("Error fetching club settings:", error);
    }
  };

  const fetchEmployees = async (id: string) => {
    try {
      const res = await fetch(`/api/clubs/${id}/employees`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.employees)) {
        setEmployees(
          data.employees.map((e: any) => ({
            id: e.id,
            full_name: e.full_name,
          })),
        );
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchShifts = useCallback(
    async (id: string, startDate?: string, endDate?: string) => {
      if (fetchAbortController.current) {
        fetchAbortController.current.abort();
      }
      fetchAbortController.current = new AbortController();

      setIsLoading(true);
      try {
        let url = `/api/clubs/${id}/shifts`;
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (params.toString()) url += "?" + params.toString();

        const res = await fetch(url, {
          signal: fetchAbortController.current.signal,
        });
        const data = await res.json();
        if (res.ok) {
          const newShifts = Array.isArray(data.shifts) ? data.shifts : [];
          setShifts(newShifts);

          const currentTotalRevenue = newShifts.reduce(
            (sum: number, s: Shift) =>
              sum + (parseFloat(String(s.cash_income)) || 0) + (parseFloat(String(s.card_income)) || 0),
            0,
          );
          if (
            lastRevenueRef.current !== null &&
            Math.abs(currentTotalRevenue - lastRevenueRef.current) > 100000
          ) {
            console.warn(`[Metrics] Significant revenue jump detected`);
          }
          lastRevenueRef.current = currentTotalRevenue;
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching shifts:", error);
        }
      } finally {
        if (
          fetchAbortController.current &&
          !fetchAbortController.current.signal.aborted
        ) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const handleMonthSelect = useCallback(
    (monthOffset: number) => {
      const now = new Date();
      const target = new Date(
        now.getFullYear(),
        now.getMonth() + monthOffset,
        1,
      );
      const year = target.getFullYear();
      const monthIndex = target.getMonth();
      const pad = (n: number) => String(n).padStart(2, "0");
      const startStr = `${year}-${pad(monthIndex + 1)}-01`;
      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      const endStr = `${year}-${pad(monthIndex + 1)}-${pad(lastDay)}`;

      setSelectedMonth(String(monthOffset));
      setFilterStartDate(startStr);
      setFilterEndDate(endStr);
      setFilterStartDateDisplay(dateToDisplay(startStr));
      setFilterEndDateDisplay(dateToDisplay(endStr));

      setSortBy("check_in");
      setSortOrder("desc");

      if (clubId) {
        fetchShifts(clubId, startStr, endStr);
      }
    },
    [clubId, fetchShifts],
  );

  // Initial load
  useEffect(() => {
    if (clubId && !filterStartDate && !filterEndDate) {
      handleMonthSelect(0);
    }
  }, [clubId, handleMonthSelect, filterStartDate, filterEndDate]);

  const handleCustomDateFilter = () => {
    if (filterStartDate || filterEndDate) {
      setSelectedMonth("");
      fetchShifts(clubId, filterStartDate, filterEndDate);
    } else {
      clearFilters();
    }
  };

  const clearFilters = () => {
    setSelectedMonth("0");
    handleMonthSelect(0);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const reportEmployees = useMemo(() => {
    const uniqueEmployees = new Map<string, string>();

    shifts.forEach((shift) => {
      if (!shift.user_id || !shift.employee_name) return;
      if (!uniqueEmployees.has(shift.user_id)) {
        uniqueEmployees.set(shift.user_id, shift.employee_name);
      }
    });

    return Array.from(uniqueEmployees.entries())
      .map(([id, full_name]) => ({ id, full_name }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));
  }, [shifts]);

  // Filter shifts based on employee
  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      if (!filterEmployee) return true;
      return shift.user_id === filterEmployee;
    });
  }, [shifts, filterEmployee]);

  // Sort filtered shifts
  const sortedShifts = useMemo(() => {
    return [...filteredShifts].sort((a, b) => {
      let aVal: any = a[sortBy as keyof Shift];
      let bVal: any = b[sortBy as keyof Shift];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (["cash_income", "card_income", "expenses"].includes(sortBy)) {
        aVal = getMetricValue(a, sortBy);
        bVal = getMetricValue(b, sortBy);
      } else if (sortBy === "total_hours") {
        aVal = parseFloat(String(aVal)) || 0;
        bVal = parseFloat(String(bVal)) || 0;
      }

      if (sortBy === "total_income") {
        aVal = calculateShiftTotalIncome(a);
        bVal = calculateShiftTotalIncome(b);
      }

      if (sortBy === "check_in") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (sortBy === "employee_name") {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredShifts, sortBy, sortOrder, calculateShiftTotalIncome]);

  // Calculate totals based on filtered shifts
  const totals = useMemo(() => {
    const currentDisplayShifts = filteredShifts;
    const totalCash = currentDisplayShifts.reduce(
      (sum, s) => sum + getMetricValue(s, "cash_income"),
      0,
    );
    const totalCard = currentDisplayShifts.reduce(
      (sum, s) => sum + getMetricValue(s, "card_income"),
      0,
    );
    const totalExpensesCore = currentDisplayShifts.reduce(
      (sum, s) => sum + getMetricValue(s, "expenses"),
      0,
    );

    return { totalCash, totalCard, totalExpensesCore };
  }, [filteredShifts]);

  // Calculate income and expenses from custom fields
  const customFieldTotals = useMemo(() => {
    return reportFields.map((field) => {
      const total = filteredShifts.reduce((sum, s) => {
        return sum + getMetricValue(s, field.metric_key);
      }, 0);
      return { ...field, total };
    });
  }, [filteredShifts, reportFields]);

  const totalCustomIncome = useMemo(
    () =>
      customFieldTotals
        .filter(
          (f) => f.field_type === "INCOME" && f.metric_key !== "receipts_count",
        )
        .reduce((sum, f) => sum + f.total, 0),
    [customFieldTotals],
  );

  const totalCustomExpenses = useMemo(
    () =>
      customFieldTotals
        .filter(
          (f) => f.field_type === "EXPENSE" || f.field_type === "EXPENSE_LIST",
        )
        .reduce((sum, f) => sum + f.total, 0),
    [customFieldTotals],
  );

  const totalRevenue = totals.totalCash + totals.totalCard + totalCustomIncome;
  const totalExpenses = totals.totalExpensesCore + totalCustomExpenses;

  const receiptsTotal = useMemo(() => {
    return (
      customFieldTotals.find((f) => f.metric_key === "receipts_count")?.total ||
      0
    );
  }, [customFieldTotals]);

  const averageReceipt = useMemo(() => {
    if (receiptsTotal > 0) return totalRevenue / receiptsTotal;
    return 0;
  }, [totalRevenue, receiptsTotal]);

  const hasReceiptsCount = useMemo(() => {
    return reportFields.some((f) => f.metric_key === "receipts_count");
  }, [reportFields]);

  // Weekday-weighted monthly forecast (same math as RevenueTrendChart, with prev-month fallback)
  const monthlyForecast = useMemo(() => {
    if (selectedMonth !== "0" || filteredShifts.length === 0) return null;

    // Helper: get YYYY-MM-DD in club timezone (matches server AT TIME ZONE grouping)
    const toTZDateKey = (isoStr: string) => {
      try {
        return new Intl.DateTimeFormat("sv-SE", { timeZone: clubTimezone }).format(new Date(isoStr));
      } catch {
        return isoStr.slice(0, 10);
      }
    };

    // "Today" in club timezone
    const nowInTZ = new Intl.DateTimeFormat("sv-SE", { timeZone: clubTimezone }).format(new Date());
    const [tzYear, tzMonth0, tzDay] = nowInTZ.split("-").map(Number);
    const year = tzYear;
    const month = tzMonth0 - 1; // JS month (0-indexed)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = tzDay;

    // 1. Build daily array from day 1 to today to trim trailing zero days exactly like dashboard
    const dailyData = Array.from({ length: today }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      return {
        date: dateStr,
        revenue: 0,
        receiptsCount: 0,
      };
    });

    // Populate actual shifts into dailyData
    filteredShifts.forEach((shift) => {
      if (!shift.check_in) return;
      const dateKey = toTZDateKey(shift.check_in);
      const [y, m, d] = dateKey.split("-").map(Number);
      if (y === year && m === month + 1 && d <= today) {
        const idx = d - 1;
        if (dailyData[idx]) {
          dailyData[idx].revenue += calculateShiftTotalIncome(shift);
          dailyData[idx].receiptsCount += getMetricValue(shift, "receipts_count");
        }
      }
    });

    // 2. Trim trailing zero days (identical to dashboard)
    while (dailyData.length > 1) {
      const lastItem = dailyData[dailyData.length - 1];
      if (lastItem.revenue === 0 && lastItem.receiptsCount === 0) {
        dailyData.pop();
      } else {
        break;
      }
    }

    const actualDaysCount = dailyData.length;

    // 3. Per-weekday averages from CURRENT month (trimmed)
    const weekdayRevenues: Record<number, number[]> = {};
    for (let i = 0; i < 7; i++) weekdayRevenues[i] = [];
    dailyData.forEach((item) => {
      const w = new Date(item.date + "T12:00:00").getDay();
      weekdayRevenues[w].push(item.revenue);
    });

    // Per-weekday averages from PREVIOUS month (fallback, same as RevenueTrendChart)
    const prevDailyTotals = new Map<string, { revenue: number; receiptsCount: number }>();
    prevMonthShifts.forEach((shift) => {
      if (!shift.check_in) return;
      const dateKey = toTZDateKey(shift.check_in);
      const rev = calculateShiftTotalIncome(shift);
      const rec = getMetricValue(shift, "receipts_count");
      const existing = prevDailyTotals.get(dateKey) || { revenue: 0, receiptsCount: 0 };
      prevDailyTotals.set(dateKey, {
        revenue: existing.revenue + rev,
        receiptsCount: existing.receiptsCount + rec,
      });
    });
    const prevWeekdayRevenues: Record<number, number[]> = {};
    for (let i = 0; i < 7; i++) prevWeekdayRevenues[i] = [];
    prevDailyTotals.forEach((val, dateKey) => {
      const w = new Date(dateKey + "T12:00:00").getDay();
      prevWeekdayRevenues[w].push(val.revenue);
    });

    // Final per-weekday avg: current month first, fallback to prev month
    const avgRevenues: Record<number, number> = {};
    for (let i = 0; i < 7; i++) {
      if (weekdayRevenues[i].length > 0) {
        avgRevenues[i] = weekdayRevenues[i].reduce((s, v) => s + v, 0) / weekdayRevenues[i].length;
      } else if (prevWeekdayRevenues[i].length > 0) {
        avgRevenues[i] = prevWeekdayRevenues[i].reduce((s, v) => s + v, 0) / prevWeekdayRevenues[i].length;
      } else {
        avgRevenues[i] = 0;
      }
    }

    // Sum actual revenue already accumulated this month (up to today, or up to trimmed day)
    const actualTotal = dailyData.reduce((s, item) => s + item.revenue, 0);

    // Project remaining days (trimmed days + 1 → end of month) using weekday avg
    let projected = 0;
    for (let d = actualDaysCount + 1; d <= daysInMonth; d++) {
      const w = new Date(year, month, d).getDay();
      projected += avgRevenues[w] || 0;
    }

    return {
      total: Math.round(actualTotal + projected),
      daysLeft: daysInMonth - actualDaysCount,
      daysElapsed: actualDaysCount,
    };
  }, [selectedMonth, filteredShifts, prevMonthShifts, calculateShiftTotalIncome, clubTimezone]);

  if (isLoading && shifts.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleOpenEdit = (shift: Shift) => {
    setEditingShift(shift);
  };

  const handleRowClick = (shift: Shift) => {
    router.push(`/clubs/${clubId}/shifts/${shift.id}`);
  };

  const handleRefresh = () => {
    fetchShifts(clubId, filterStartDate, filterEndDate);
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] flex-col font-sans text-slate-900 selection:bg-black/10">
      <main className="mx-auto max-w-6xl w-full flex-1 px-6 sm:px-8 py-12 md:py-20">
        <SummaryGrid
          totalRevenue={totalRevenue}
          totals={totals}
          customFieldTotals={customFieldTotals}
          receiptsTotal={receiptsTotal}
          averageReceipt={averageReceipt}
          totalExpenses={totalExpenses}
          shiftsCount={shifts.length}
          dayShiftsCount={shifts.filter((s) => s.shift_type !== "NIGHT").length}
          nightShiftsCount={shifts.filter((s) => s.shift_type === "NIGHT").length}
          monthlyForecast={monthlyForecast}
          selectedMonth={selectedMonth}
        />

        <ShiftsList
          clubId={clubId}
          sortedShifts={sortedShifts}
          employees={employees}
          reportEmployees={reportEmployees}
          reportFields={reportFields}
          clubTimezone={clubTimezone}
          isLoading={isLoading}
          filterStartDate={filterStartDate}
          filterEndDate={filterEndDate}
          filterStartDateDisplay={filterStartDateDisplay}
          filterEndDateDisplay={filterEndDateDisplay}
          selectedMonth={selectedMonth}
          filterEmployee={filterEmployee}
          sortBy={sortBy}
          sortOrder={sortOrder}
          hasReceiptsCount={hasReceiptsCount}
          calculateShiftTotalIncome={calculateShiftTotalIncome}
          onSort={handleSort}
          onFilterStartDateChange={(display, internal) => {
            setFilterStartDateDisplay(display);
            setFilterStartDate(internal);
          }}
          onFilterEndDateChange={(display, internal) => {
            setFilterEndDateDisplay(display);
            setFilterEndDate(internal);
          }}
          onCustomDateFilter={handleCustomDateFilter}
          onClearFilters={clearFilters}
          onMonthSelect={handleMonthSelect}
          onFilterEmployeeChange={setFilterEmployee}
          onRefresh={handleRefresh}
          onRowClick={handleRowClick}
          openCreateModal={() => setIsCreateModalOpen(true)}
        />

        {/* Modal Dialogs */}
        <ShiftDetailDialog
          isOpen={!!selectedShift}
          onOpenChange={(open) => {
            if (!open) setSelectedShift(null);
          }}
          shift={selectedShift}
          shiftDetails={selectedShiftDetails}
          isLoadingDetails={isLoadingDetails}
          timezone={clubTimezone}
          calculateShiftTotalIncome={calculateShiftTotalIncome}
        />

        <EditShiftDialog
          isOpen={!!editingShift}
          onOpenChange={(open) => {
            if (!open) setEditingShift(null);
          }}
          editingShift={editingShift}
          clubId={clubId}
          reportFields={reportFields}
          clubTimezone={clubTimezone}
          onSuccess={handleRefresh}
        />

        <CreateShiftDialog
          isOpen={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          clubId={clubId}
          employees={employees}
          reportFields={reportFields}
          clubTimezone={clubTimezone}
          onSuccess={handleRefresh}
        />
      </main>
    </div>
  );
}
