import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Moon,
  Sun,
  ArrowUpDown,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Shift } from "../_types";
import {
  formatDate,
  formatTime,
  formatMoney,
  getMetricValue,
  isWeekendDate,
} from "../_utils";

interface ShiftsDesktopTableProps {
  sortedShifts: Shift[];
  activeColumns: string[];
  clubTimezone: string;
  hasReceiptsCount: boolean;
  reportFields: any[];
  calculateShiftTotalIncome: (s: Shift) => number;
  onRowClick: (shift: Shift) => void;
  onSort: (column: string) => void;
}

export function ShiftsDesktopTable({
  sortedShifts,
  activeColumns,
  clubTimezone,
  hasReceiptsCount,
  reportFields,
  calculateShiftTotalIncome,
  onRowClick,
  onSort,
}: ShiftsDesktopTableProps) {
  // Drag & Wheel Horizontal Scroll Hooks
  const containerRef = useRef<HTMLDivElement>(null);
  const fakeScrollRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0, hasMoved: false });
  const draggedRef = useRef(false);

  // UI Navigation Scroll State
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollbarStyle, setScrollbarStyle] = useState<React.CSSProperties>({ display: "none" });
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  const scrollTable = (direction: "left" | "right") => {
    const container = containerRef.current;
    if (!container) return;
    const amount = container.clientWidth * 0.4;
    container.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const handleFakeScroll = () => {
    const container = containerRef.current;
    const fake = fakeScrollRef.current;
    if (!container || !fake) return;

    if (Math.abs(container.scrollLeft - fake.scrollLeft) > 1) {
      container.scrollLeft = fake.scrollLeft;
    }
  };

  // Sync scrollbar state, handle wheel events, and handle size/intersection changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (container.scrollWidth > container.clientWidth) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          container.scrollLeft += e.deltaY * 1.2;
        }
      }
    };

    const handleScroll = () => {
      const fake = fakeScrollRef.current;
      if (fake && Math.abs(fake.scrollLeft - container.scrollLeft) > 1) {
        fake.scrollLeft = container.scrollLeft;
      }
      setCanScrollLeft(container.scrollLeft > 5);
      setCanScrollRight(
        container.scrollLeft + container.clientWidth < container.scrollWidth - 5
      );
    };

    const updateVisibility = () => {
      const rect = container.getBoundingClientRect();
      const bottomIsOffscreen = rect.bottom > window.innerHeight;
      const topIsOnscreen = rect.top < window.innerHeight;

      setTableScrollWidth(container.scrollWidth);

      if (bottomIsOffscreen && topIsOnscreen && container.scrollWidth > container.clientWidth) {
        setScrollbarStyle({
          position: "fixed",
          bottom: 0,
          left: rect.left,
          width: rect.width,
          display: "block",
        });
      } else {
        setScrollbarStyle({
          display: "none",
        });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("scroll", handleScroll);

    // Listen to main scroll container (<main> element) and window scroll/resize
    const mainElement = document.querySelector("main") || window;
    mainElement.addEventListener("scroll", updateVisibility);
    window.addEventListener("scroll", updateVisibility);
    window.addEventListener("resize", updateVisibility);

    // ResizeObserver on the container to capture layout changes
    const resizeObserver = new ResizeObserver(() => {
      handleScroll();
      updateVisibility();
    });
    resizeObserver.observe(container);

    // Initial check
    setTimeout(() => {
      handleScroll();
      updateVisibility();
    }, 100);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("scroll", handleScroll);
      mainElement.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
      resizeObserver.disconnect();
    };
  }, [sortedShifts, activeColumns]);

  // Mouse drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only
    const container = containerRef.current;
    if (!container) return;

    dragStartRef.current = {
      x: e.clientX,
      scrollLeft: container.scrollLeft,
      hasMoved: false,
    };
    container.setAttribute("data-dragging", "true");
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || container.getAttribute("data-dragging") !== "true") return;

    e.preventDefault(); // Prevent text selection and browser defaults

    const start = dragStartRef.current;
    const dx = e.clientX - start.x;

    if (Math.abs(dx) > 5) {
      start.hasMoved = true;
      draggedRef.current = true;
    }

    container.scrollLeft = start.scrollLeft - dx * 1.5;
  };

  const handleMouseUpOrLeave = () => {
    const container = containerRef.current;
    if (!container) return;
    container.removeAttribute("data-dragging");
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (draggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      draggedRef.current = false;
    }
  };

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
    return (
      <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
        Закрыта
      </Badge>
    );
  };

  return (
    <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative group">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f8fafc;
        }
        .custom-scrollbar::-webkit-scrollbar {
          height: 10px;
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
          border: 2px solid #f8fafc;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `,
        }}
      />
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onClickCapture={handleClickCapture}
        className="overflow-x-auto select-none cursor-grab active:cursor-grabbing transition-all scroll-smooth custom-scrollbar"
      >
        <Table>
          <TableHeader className="bg-slate-50/95 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200 shadow-[inset_0_-1px_0_0_#e2e8f0]">
            <TableRow className="hover:bg-transparent">
              {activeColumns.map((colKey: string) => {
                switch (colKey) {
                  case "check_in":
                    return (
                      <TableHead
                        key="check_in"
                        className="h-12 cursor-pointer select-none text-slate-500 font-medium whitespace-nowrap"
                        onClick={() => onSort("check_in")}
                      >
                        <div className="flex items-center gap-2">
                          Дата <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </div>
                      </TableHead>
                    );
                  case "shift_type":
                    return (
                      <TableHead
                        key="shift_type"
                        className="h-12 text-slate-500 font-medium whitespace-nowrap"
                      >
                        Смена
                      </TableHead>
                    );
                  case "employee_name":
                    return (
                      <TableHead
                        key="employee_name"
                        className="h-12 cursor-pointer select-none text-slate-500 font-medium whitespace-nowrap"
                        onClick={() => onSort("employee_name")}
                      >
                        <div className="flex items-center gap-2">
                          Сотрудник <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </div>
                      </TableHead>
                    );
                  case "total_income":
                    return (
                      <TableHead
                        key="total_income"
                        className="h-12 text-right cursor-pointer select-none text-emerald-600 font-bold whitespace-nowrap"
                        onClick={() => onSort("total_income")}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Выручка <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </div>
                      </TableHead>
                    );
                  case "cash_income":
                    return (
                      <TableHead
                        key="cash_income"
                        className="h-12 text-right text-slate-500 font-medium whitespace-nowrap"
                      >
                        Наличные
                      </TableHead>
                    );
                  case "card_income":
                    return (
                      <TableHead
                        key="card_income"
                        className="h-12 text-right text-slate-500 font-medium whitespace-nowrap"
                      >
                        Безнал
                      </TableHead>
                    );
                  case "expenses":
                    return (
                      <TableHead
                        key="expenses"
                        className="h-12 text-right text-slate-500 font-medium whitespace-nowrap"
                      >
                        Расходы
                      </TableHead>
                    );
                  case "average_check":
                    return (
                      <TableHead
                        key="average_check"
                        className="h-12 text-right text-slate-500 font-medium whitespace-nowrap"
                      >
                        Средний чек
                      </TableHead>
                    );
                  case "status":
                    return (
                      <TableHead
                        key="status"
                        className="h-12 text-right text-slate-500 font-medium whitespace-nowrap"
                      >
                        Статус
                      </TableHead>
                    );
                  default: {
                    const field = reportFields.find((f) => f.metric_key === colKey);
                    if (!field) return null;
                    return (
                      <TableHead
                        key={field.metric_key}
                        className="h-12 text-right text-slate-500 font-medium whitespace-nowrap min-w-25 max-w-37.5 truncate"
                        title={field.custom_label || field.label || field.metric_key}
                      >
                        {field.custom_label || field.label || field.metric_key}
                      </TableHead>
                    );
                  }
                }
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedShifts.map((shift) => {
              const isWeekend = isWeekendDate(shift.check_in, clubTimezone);
              return (
                <TableRow
                  key={shift.id}
                  className={cn(
                    "hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0",
                    isWeekend && "bg-rose-50/30",
                  )}
                  onClick={() => onRowClick(shift)}
                >
                  {activeColumns.map((colKey: string) => {
                    switch (colKey) {
                      case "check_in":
                        return (
                          <TableCell key="check_in" className="py-4 whitespace-nowrap">
                            <div
                              className={cn(
                                "font-medium",
                                isWeekend ? "text-rose-600" : "text-slate-900",
                              )}
                            >
                              {formatDate(shift.check_in, clubTimezone)}
                            </div>
                            <div
                              className={cn(
                                "text-xs mt-0.5",
                                isWeekend ? "text-rose-500" : "text-slate-500",
                              )}
                            >
                              {formatTime(shift.check_in, clubTimezone)} —{" "}
                              {shift.check_out ? formatTime(shift.check_out, clubTimezone) : "..."}
                            </div>
                          </TableCell>
                        );
                      case "shift_type":
                        return (
                          <TableCell key="shift_type" className="py-4 whitespace-nowrap">
                            {(() => {
                              const hours = Number(shift.total_hours) || 0;
                              const isSutki = hours >= 20;
                              const isLongShift = !isSutki && hours >= 13;

                              return (
                                <div className="flex items-center gap-2">
                                  {shift.shift_type === "NIGHT" ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                                      <Moon className="h-3 w-3" /> Ночь
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-medium">
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
                                </div>
                              );
                            })()}
                          </TableCell>
                        );
                      case "employee_name":
                        return (
                          <TableCell
                            key="employee_name"
                            className="py-4 whitespace-nowrap font-medium text-slate-900"
                          >
                            <div>{shift.employee_name || "Неизвестно"}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {shift.total_hours ? `${Number(shift.total_hours).toFixed(1)} ч` : "-"}
                            </div>
                            {shift.report_mode === "NO_REPORT" && (
                              <div className="mt-1">
                                <Badge
                                  variant="secondary"
                                  className="bg-zinc-800 text-zinc-200 border border-zinc-700 h-5 px-2 text-[10px]"
                                >
                                  {shift.actor_role_name_snapshot || "Без отчёта"}
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                        );
                      case "total_income":
                        return (
                          <TableCell key="total_income" className="py-4 text-right whitespace-nowrap">
                            {shift.report_mode === "NO_REPORT" ? (
                              <span className="font-bold text-slate-400 tabular-nums text-base">
                                —
                              </span>
                            ) : (
                              <span className="font-bold text-emerald-600 tabular-nums text-base">
                                {formatMoney(calculateShiftTotalIncome(shift))}
                              </span>
                            )}
                          </TableCell>
                        );
                      case "cash_income":
                        return (
                          <TableCell
                            key="cash_income"
                            className="py-4 text-right font-medium text-slate-600 tabular-nums whitespace-nowrap"
                          >
                            {shift.report_mode === "NO_REPORT"
                              ? "-"
                              : formatMoney(getMetricValue(shift, "cash_income"))}
                          </TableCell>
                        );
                      case "card_income":
                        return (
                          <TableCell
                            key="card_income"
                            className="py-4 text-right font-medium text-slate-600 tabular-nums whitespace-nowrap"
                          >
                            {shift.report_mode === "NO_REPORT"
                              ? "-"
                              : formatMoney(getMetricValue(shift, "card_income"))}
                          </TableCell>
                        );
                      case "expenses":
                        return (
                          <TableCell
                            key="expenses"
                            className="py-4 text-right font-medium text-rose-600 tabular-nums whitespace-nowrap"
                          >
                            {shift.report_mode === "NO_REPORT"
                              ? "-"
                              : formatMoney(getMetricValue(shift, "expenses"))}
                          </TableCell>
                        );
                      case "average_check":
                        return (
                          <TableCell
                            key="average_check"
                            className="py-4 text-right font-medium text-blue-600 tabular-nums whitespace-nowrap"
                          >
                            {shift.report_mode === "NO_REPORT" ? (
                              "—"
                            ) : (
                              (() => {
                                const totalRevenue = calculateShiftTotalIncome(shift);
                                const receiptsCount = Number(
                                  shift.report_data?.receipts_count || 0,
                                );
                                return receiptsCount > 0
                                  ? formatMoney(totalRevenue / receiptsCount)
                                  : "—";
                              })()
                            )}
                          </TableCell>
                        );
                      case "status":
                        return (
                          <TableCell key="status" className="py-4 text-right whitespace-nowrap">
                            {getStatusBadge(shift)}
                          </TableCell>
                        );
                      default: {
                        const field = reportFields.find((f) => f.metric_key === colKey);
                        if (!field) return null;
                        return (
                          <TableCell
                            key={field.metric_key}
                            className="py-4 text-right text-slate-500 tabular-nums whitespace-nowrap"
                          >
                            {shift.report_mode === "NO_REPORT"
                              ? "-"
                              : shift.report_data &&
                                  shift.report_data[field.metric_key] !== undefined
                                ? field.field_type === "OTHER" ||
                                  field.metric_key === "receipts_count"
                                  ? getMetricValue(shift, field.metric_key).toLocaleString()
                                  : formatMoney(getMetricValue(shift, field.metric_key))
                                : "-"}
                          </TableCell>
                        );
                      }
                    }
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Sticky Horizontal Scrollbar */}
      <div
        ref={fakeScrollRef}
        onScroll={handleFakeScroll}
        className="fixed bottom-0 overflow-x-auto z-40 bg-slate-50 border-t border-slate-200 custom-scrollbar shadow-lg"
        style={{
          ...scrollbarStyle,
          height: "12px",
        }}
      >
        <div style={{ width: tableScrollWidth, height: "1px" }} />
      </div>

      {/* Floating UI Scroll Buttons */}
      {canScrollLeft && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            scrollTable("left");
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black active:scale-95 transition-all duration-200"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            scrollTable("right");
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black active:scale-95 transition-all duration-200"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
