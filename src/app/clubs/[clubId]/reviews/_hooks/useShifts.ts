"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { ShiftReviewItem, ShiftReportField } from "../types";

export function useShifts(clubId: string) {
  const router = useRouter();
  const [shifts, setShifts] = useState<ShiftReviewItem[]>([]);
  const [isShiftsLoading, setIsShiftsLoading] = useState(true);
  const [isSubmittingShift, setIsSubmittingShift] = useState<string | null>(
    null,
  );
  const [shiftsTab, setShiftsTab] = useState<"active" | "history">("active");
  const [filterShiftMonth, setFilterShiftMonth] = useState<string>(() =>
    format(new Date(), "yyyy-MM"),
  );
  const [shiftReportFields, setShiftReportFields] = useState<ShiftReportField[]>(
    [],
  );

  const fetchShiftsForReview = async (id: string, silent = false) => {
    if (!silent) setIsShiftsLoading(true);
    try {
      const res = await fetch(`/api/clubs/${id}/shifts`);
      const data = await res.json();
      if (res.ok && Array.isArray(data?.shifts)) {
        setShifts(data.shifts);
      }
    } catch (error) {
      console.error("Error fetching shifts:", error);
    } finally {
      if (!silent) setIsShiftsLoading(false);
    }
  };

  const fetchShiftReportTemplate = async (id: string) => {
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
          (field: ShiftReportField) =>
            !standardKeys.includes(field.metric_key) &&
            !standardKeys.some((key) => field.metric_key.includes(key)),
        );
        setShiftReportFields(customFields);
      }
    } catch (error) {
      console.error("Error fetching shift report template:", error);
    }
  };

  useEffect(() => {
    if (clubId) {
      fetchShiftsForReview(clubId);
      fetchShiftReportTemplate(clubId);
    }
  }, [clubId]);

  // Computed
  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const isIncoming = Boolean(shift.check_out) && shift.status !== "VERIFIED";
      const isHistoryItem = shift.status === "VERIFIED";

      if (shiftsTab === "active" && !isIncoming) return false;
      if (shiftsTab === "history" && !isHistoryItem) return false;

      if (filterShiftMonth !== "all") {
        const monthKey = format(new Date(shift.check_in), "yyyy-MM");
        if (monthKey !== filterShiftMonth) return false;
      }

      return true;
    });
  }, [shifts, shiftsTab, filterShiftMonth]);

  const pendingShifts = useMemo(() => {
    return shifts.filter((shift) => {
      if (!shift.check_out || shift.status === "VERIFIED") return false;
      if (filterShiftMonth !== "all") {
        const monthKey = format(new Date(shift.check_in), "yyyy-MM");
        if (monthKey !== filterShiftMonth) return false;
      }
      return true;
    }).length;
  }, [shifts, filterShiftMonth]);

  const shiftMonths = useMemo(() => {
    const months = Array.from(
      new Set(
        shifts.map((shift) => format(new Date(shift.check_in), "yyyy-MM")),
      ),
    );
    const currentMonth = format(new Date(), "yyyy-MM");
    if (!months.includes(currentMonth)) months.push(currentMonth);
    return months.sort((a, b) => b.localeCompare(a));
  }, [shifts]);

  const currentShiftMonthIndex = shiftMonths.indexOf(filterShiftMonth);

  useEffect(() => {
    if (
      shiftsTab === "history" &&
      shiftMonths.length > 0 &&
      !shiftMonths.includes(filterShiftMonth)
    ) {
      setFilterShiftMonth(shiftMonths[0]);
    }
  }, [shiftMonths, filterShiftMonth, shiftsTab]);

  // Handlers
  const handleVerifyShiftForReview = async (shift: ShiftReviewItem) => {
    if (typeof window !== "undefined") {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;

    setIsSubmittingShift(shift.id);
    try {
      const res = await fetch(`/api/clubs/${clubId}/shifts/${shift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VERIFIED" }),
      });

      if (res.ok) {
        await fetchShiftsForReview(clubId, true);
        if (typeof window !== "undefined") {
          setTimeout(() => {
            window.scrollTo(0, scrollY);
          }, 0);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка подтверждения смены");
      }
    } catch (error) {
      console.error("Error verifying shift:", error);
      alert("Ошибка подтверждения смены");
    } finally {
      setIsSubmittingShift(null);
    }
  };

  const handleOpenShift = (shiftId: string) => {
    router.push(`/clubs/${clubId}/shifts/${shiftId}?from=reviews`);
  };

  return {
    // State
    shifts,
    isShiftsLoading,
    isSubmittingShift,
    shiftsTab,
    setShiftsTab,
    filterShiftMonth,
    setFilterShiftMonth,
    shiftReportFields,
    // Computed
    filteredShifts,
    pendingShifts,
    shiftMonths,
    currentShiftMonthIndex,
    // Handlers
    fetchShiftsForReview,
    handleVerifyShiftForReview,
    handleOpenShift,
  };
}

export type UseShiftsReturn = ReturnType<typeof useShifts>;
