"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Users,
  Wallet,
  TrendingDown,
  AlertTriangle,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Calendar,
  Clock,
  Sparkles,
  Percent,
  Flame,
  BadgeAlert,
  SlidersHorizontal,
  RotateCcw,
  X,
  Plus,
  ShoppingBag,
  Gift,
  HelpCircle,
  ChevronUp,
  ChevronDown,
  Gamepad2,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type ClubAnalytics, type ClientProfile, type DateFilter, getAvailableMonths, type MonthOption } from "./segmentation";

interface Props {
  analytics: ClubAnalytics | null;
  dateFilter?: DateFilter | null;
  onDateFilterChange?: (filter: DateFilter | null) => void;
}

type ViewMode = "whales" | "churned" | "atRisk" | "bonusHeavy" | "all";

export type ColumnId =
  | "name"
  | "phone"
  | "spent"
  | "preferredTime"
  | "favoriteDay"
  | "topupAdmin"
  | "topupLK"
  | "topupApp"
  | "hourlyYield"
  | "favoriteZone"
  | "favoriteTariff"
  | "favoriteSeat"
  | "packageSpentRub"
  | "packageSpentBonus"
  | "bonusAccrued"
  | "bonusSpent"
  | "bonusBalance"
  | "visits"
  | "hours"
  | "balance"
  | "days"
  | "category";

interface ColumnMeta {
  id: ColumnId;
  label: string;
  align: "left" | "right";
  sortable: boolean;
  defaultVisible: boolean;
  minWidth: string;
}

const ALL_COLUMNS: ColumnMeta[] = [
  { id: "name", label: "Клиент", align: "left", sortable: true, defaultVisible: true, minWidth: "min-w-[190px]" },
  { id: "phone", label: "Телефон", align: "left", sortable: false, defaultVisible: true, minWidth: "min-w-[130px]" },
  { id: "spent", label: "Реальная выручка", align: "right", sortable: true, defaultVisible: true, minWidth: "min-w-[150px]" },
  { id: "preferredTime", label: "Время визитов", align: "left", sortable: true, defaultVisible: true, minWidth: "min-w-[160px]" },
  { id: "favoriteDay", label: "Дни визитов", align: "left", sortable: true, defaultVisible: true, minWidth: "min-w-[155px]" },
  { id: "favoriteZone", label: "Любимая зона", align: "left", sortable: true, defaultVisible: true, minWidth: "min-w-[130px]" },
  { id: "favoriteTariff", label: "Любимый тариф", align: "left", sortable: true, defaultVisible: true, minWidth: "min-w-[175px]" },
  { id: "favoriteSeat", label: "Любимый ПК/ТВ", align: "left", sortable: true, defaultVisible: false, minWidth: "min-w-[110px]" },
  { id: "packageSpentRub", label: "Тарифы (₽)", align: "right", sortable: true, defaultVisible: false, minWidth: "min-w-[120px]" },
  { id: "packageSpentBonus", label: "Бонусы на тарифы", align: "right", sortable: true, defaultVisible: false, minWidth: "min-w-[135px]" },
  { id: "topupAdmin", label: "Касса (₽)", align: "right", sortable: true, defaultVisible: false, minWidth: "min-w-[115px]" },
  { id: "topupLK", label: "Через ЛК (₽)", align: "right", sortable: true, defaultVisible: false, minWidth: "min-w-[115px]" },
  { id: "topupApp", label: "Моб. прил. (₽)", align: "right", sortable: true, defaultVisible: false, minWidth: "min-w-[125px]" },
  { id: "hourlyYield", label: "Доходность (₽/ч)", align: "right", sortable: true, defaultVisible: true, minWidth: "min-w-[130px]" },
  { id: "bonusAccrued", label: "Выдано бонусов", align: "right", sortable: true, defaultVisible: true, minWidth: "min-w-[135px]" },
  { id: "bonusSpent", label: "Списано бонусов", align: "right", sortable: true, defaultVisible: true, minWidth: "min-w-[130px]" },
  { id: "bonusBalance", label: "Бонусный баланс", align: "right", sortable: true, defaultVisible: true, minWidth: "min-w-[130px]" },
  { id: "visits", label: "Визитов", align: "right", sortable: true, defaultVisible: true, minWidth: "min-w-[100px]" },
  { id: "hours", label: "Часов в ПК", align: "right", sortable: true, defaultVisible: true, minWidth: "min-w-[115px]" },
  { id: "balance", label: "Баланс (Руб)", align: "right", sortable: true, defaultVisible: true, minWidth: "min-w-[120px]" },
  { id: "days", label: "Последний визит", align: "left", sortable: true, defaultVisible: true, minWidth: "min-w-[150px]" },
  { id: "category", label: "Категория", align: "left", sortable: false, defaultVisible: true, minWidth: "min-w-[125px]" },
];

const DEFAULT_ORDER: ColumnId[] = ALL_COLUMNS.map((c) => c.id);

export interface SortRule {
  key: ColumnId;
  desc: boolean;
}

export function AnalyticsTab({ analytics, dateFilter, onDateFilterChange }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("whales");
  const [search, setSearch] = useState("");
  const [minSpent, setMinSpent] = useState<number>(0);
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [selectedPersona, setSelectedPersona] = useState<string>("all");
  const [selectedTime, setSelectedTime] = useState<string>("all");
  const [selectedDayPattern, setSelectedDayPattern] = useState<string>("all");

  const datasetFrom = analytics?.datasetDateFrom || analytics?.reportDateFrom;
  const datasetTo = analytics?.datasetDateTo || analytics?.reportDateTo;

  const availableMonths = useMemo(() => {
    if (!datasetFrom || !datasetTo) return [];
    return getAvailableMonths(datasetFrom, datasetTo);
  }, [datasetFrom, datasetTo]);

  const totalDatasetDays = useMemo(() => {
    if (!datasetFrom || !datasetTo) return analytics?.reportDays || 0;
    return Math.max(1, Math.round(Math.abs(datasetTo.getTime() - datasetFrom.getTime()) / 86_400_000));
  }, [datasetFrom, datasetTo, analytics?.reportDays]);

  const datasetStartIso = useMemo(() => {
    if (!datasetFrom || isNaN(datasetFrom.getTime())) return "";
    return datasetFrom.toISOString().slice(0, 10);
  }, [datasetFrom]);

  const datasetEndIso = useMemo(() => {
    if (!datasetTo || isNaN(datasetTo.getTime())) return "";
    return datasetTo.toISOString().slice(0, 10);
  }, [datasetTo]);

  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    if (dateFilter?.startDate && dateFilter?.endDate) {
      setCustomStart(dateFilter.startDate.toISOString().slice(0, 10));
      setCustomEnd(dateFilter.endDate.toISOString().slice(0, 10));
    } else if (analytics?.reportDateFrom && analytics?.reportDateTo) {
      setCustomStart(analytics.reportDateFrom.toISOString().slice(0, 10));
      setCustomEnd(analytics.reportDateTo.toISOString().slice(0, 10));
    }
  }, [dateFilter, analytics?.reportDateFrom, analytics?.reportDateTo]);

  const isFiltered = !!dateFilter;

  const handleSelectMonth = (m: MonthOption) => {
    onDateFilterChange?.({
      startDate: m.startDate,
      endDate: m.endDate,
      monthKey: m.key,
    });
  };

  const handleSelectAllPeriod = () => {
    onDateFilterChange?.(null);
  };

  const handleApplyCustomRange = () => {
    if (!customStart || !customEnd) return;
    const s = new Date(`${customStart}T00:00:00`);
    const e = new Date(`${customEnd}T23:59:59`);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
    onDateFilterChange?.({
      startDate: s,
      endDate: e,
      monthKey: undefined,
    });
  };

  // Multi-column sort rules
  const [sortRules, setSortRules] = useState<SortRule[]>([
    { key: "spent", desc: true },
  ]);

  // Column Visibility & Order
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("dashadmin_marketing_columns_order_v3");
        if (saved) {
          const parsed: ColumnId[] = JSON.parse(saved);
          const missing = DEFAULT_ORDER.filter((c) => !parsed.includes(c));
          return [...parsed, ...missing];
        }
      } catch {}
    }
    return DEFAULT_ORDER;
  });

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>(() => {
    const allVis: Record<string, boolean> = {};
    ALL_COLUMNS.forEach((c) => { allVis[c.id] = c.defaultVisible; });
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("dashadmin_marketing_columns_vis_v3");
        if (saved) return { ...allVis, ...JSON.parse(saved) };
      } catch {}
    }
    return allVis as Record<ColumnId, boolean>;
  });

  const [showColSettings, setShowColSettings] = useState(false);
  const [showSortSettings, setShowSortSettings] = useState(false);

  const colSettingsRef = useRef<HTMLDivElement>(null);
  const sortSettingsRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const scrollTable = (direction: "left" | "right") => {
    if (tableContainerRef.current) {
      const amount = direction === "left" ? -450 : 450;
      tableContainerRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colSettingsRef.current && !colSettingsRef.current.contains(e.target as Node)) {
        setShowColSettings(false);
      }
      if (sortSettingsRef.current && !sortSettingsRef.current.contains(e.target as Node)) {
        setShowSortSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Save column prefs to localStorage
  const saveColPrefs = (newOrder: ColumnId[], newVis: Record<ColumnId, boolean>) => {
    setColumnOrder(newOrder);
    setVisibleColumns(newVis);
    try {
      localStorage.setItem("dashadmin_marketing_columns_order_v3", JSON.stringify(newOrder));
      localStorage.setItem("dashadmin_marketing_columns_vis_v3", JSON.stringify(newVis));
    } catch {}
  };

  const toggleColumnVis = (colId: ColumnId) => {
    const updated = { ...visibleColumns, [colId]: !visibleColumns[colId] };
    saveColPrefs(columnOrder, updated);
  };

  const moveColumn = (colId: ColumnId, direction: "up" | "down") => {
    const idx = columnOrder.indexOf(colId);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= columnOrder.length) return;

    const newOrder = [...columnOrder];
    const [removed] = newOrder.splice(idx, 1);
    newOrder.splice(targetIdx, 0, removed);
    saveColPrefs(newOrder, visibleColumns);
  };

  const resetColumns = () => {
    const allVis: Record<string, boolean> = {};
    ALL_COLUMNS.forEach((c) => { allVis[c.id] = c.defaultVisible; });
    saveColPrefs(DEFAULT_ORDER, allVis as Record<ColumnId, boolean>);
  };

  // Multi-column sorting handlers
  const handleHeaderClick = (colId: ColumnId, isShift: boolean) => {
    const existingIdx = sortRules.findIndex((r) => r.key === colId);

    if (isShift) {
      // Shift+Click: toggle or append secondary rule
      if (existingIdx !== -1) {
        const updated = [...sortRules];
        updated[existingIdx] = { key: colId, desc: !updated[existingIdx].desc };
        setSortRules(updated);
      } else {
        setSortRules([...sortRules, { key: colId, desc: true }]);
      }
    } else {
      // Regular click: toggle direction if already first rule, otherwise make it sole primary rule
      if (sortRules.length === 1 && sortRules[0].key === colId) {
        setSortRules([{ key: colId, desc: !sortRules[0].desc }]);
      } else {
        setSortRules([{ key: colId, desc: true }]);
      }
    }
  };

  const addSortRule = (colId: ColumnId) => {
    if (sortRules.some((r) => r.key === colId)) return;
    setSortRules([...sortRules, { key: colId, desc: true }]);
  };

  const updateSortRule = (idx: number, key: ColumnId, desc: boolean) => {
    const updated = [...sortRules];
    updated[idx] = { key, desc };
    setSortRules(updated);
  };

  const removeSortRule = (idx: number) => {
    const filtered = sortRules.filter((_, i) => i !== idx);
    setSortRules(filtered.length > 0 ? filtered : [{ key: "spent", desc: true }]);
  };

  // Bonus heavy clients
  const bonusHeavyClients = useMemo(() => {
    if (!analytics) return [];
    return analytics.profiles
      .filter((p) => p.valueCategory === "bonus_heavy")
      .sort((a, b) => b.bonusAccrued - a.bonusAccrued);
  }, [analytics]);

  // Filter & Multi-sort
  const displayList = useMemo(() => {
    if (!analytics) return [];
    let list: ClientProfile[] = [];
    if (viewMode === "whales") list = analytics.whales;
    else if (viewMode === "churned") list = analytics.topChurned;
    else if (viewMode === "atRisk") list = analytics.atRisk;
    else if (viewMode === "bonusHeavy") list = bonusHeavyClients;
    else list = analytics.profiles;

    if (minSpent > 0) {
      list = list.filter((p) => p.totalSpent >= minSpent);
    }

    if (selectedZone !== "all") {
      list = list.filter((p) => p.favoriteZone === selectedZone);
    }

    if (selectedPersona !== "all") {
      list = list.filter((p) => p.gamerPersona === selectedPersona);
    }

    if (selectedTime !== "all") {
      list = list.filter((p) => p.preferredTime === selectedTime);
    }

    if (selectedDayPattern !== "all") {
      list = list.filter((p) => p.dayPattern === selectedDayPattern);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.favoriteZone && p.favoriteZone.toLowerCase().includes(q)) ||
          (p.favoriteTariff && p.favoriteTariff.toLowerCase().includes(q)) ||
          (p.favoriteSeat && p.favoriteSeat.toLowerCase().includes(q)) ||
          (p.favoriteDay && p.favoriteDay.toLowerCase().includes(q))
      );
    }

    const getVal = (p: ClientProfile, key: ColumnId): number | string => {
      switch (key) {
        case "name": return p.name.toLowerCase();
        case "spent": return p.totalSpent;
        case "preferredTime": return p.preferredTime ?? "";
        case "favoriteDay": return p.favoriteDay ?? "";
        case "topupAdmin": return p.topupAdmin ?? 0;
        case "topupLK": return p.topupLK ?? 0;
        case "topupApp": return p.topupApp ?? 0;
        case "hourlyYield": return p.hourlyYield ?? -1;
        case "favoriteZone": return p.favoriteZone ?? "";
        case "favoriteTariff": return p.favoriteTariff ?? "";
        case "favoriteSeat": return p.favoriteSeat ?? "";
        case "packageSpentRub": return p.packageSpentRub ?? 0;
        case "packageSpentBonus": return p.packageSpentBonus ?? 0;
        case "bonusAccrued": return p.bonusAccrued;
        case "bonusSpent": return p.bonusSpent;
        case "bonusBalance": return p.bonusBalance;
        case "visits": return p.visits ?? 0;
        case "hours": return p.playedMinutes ? p.playedMinutes / 60 : 0;
        case "balance": return p.balance;
        case "days": return p.daysSince ?? 99999;
        default: return 0;
      }
    };

    return [...list].sort((a, b) => {
      for (const rule of sortRules) {
        const valA = getVal(a, rule.key);
        const valB = getVal(b, rule.key);

        if (typeof valA === "string" && typeof valB === "string") {
          const comp = valA.localeCompare(valB, "ru");
          if (comp !== 0) return rule.desc ? -comp : comp;
        } else {
          const numA = Number(valA);
          const numB = Number(valB);
          if (numA !== numB) {
            return rule.desc ? numB - numA : numA - numB;
          }
        }
      }
      return 0;
    });
  }, [analytics, viewMode, search, sortRules, bonusHeavyClients, minSpent, selectedZone, selectedPersona, selectedTime]);

  const totalBonusOnHands = useMemo(() => {
    if (!analytics) return 0;
    return analytics.profiles.reduce((sum, p) => sum + p.bonusBalance, 0);
  }, [analytics]);

  const activeColumns = useMemo(() => {
    return columnOrder
      .filter((id) => visibleColumns[id])
      .map((id) => ALL_COLUMNS.find((c) => c.id === id)!)
      .filter(Boolean);
  }, [columnOrder, visibleColumns]);

  const formatDate = (d: Date | string | null | undefined) => {
    if (!d) return "—";
    try {
      const dateObj = d instanceof Date ? d : new Date(d);
      if (isNaN(dateObj.getTime())) return "—";
      return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(dateObj);
    } catch {
      return "—";
    }
  };

  if (!analytics) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center space-y-3">
        <Users className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="font-bold text-sm text-slate-700">
          Данные не загружены
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Перейдите на вкладку «Загрузка отчетов» и загрузите один или несколько файлов Langame.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Banner with Quick Month Selector and Custom Date Range */}
      {analytics.reportDateFrom && analytics.reportDateTo && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 md:p-5 shadow-sm space-y-3.5">
          {/* Top Line: Active dates, days, monthly revenue/hours metrics, and reset button */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Calendar className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-slate-400">Период выгрузки:</span>
              <span className="text-xs font-semibold text-white">
                {formatDate(analytics.reportDateFrom)} — {formatDate(analytics.reportDateTo)}
                {analytics.reportDays ? ` (${analytics.reportDays} дн.)` : ""}
              </span>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleSelectAllPeriod}
                  className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-300 hover:text-white bg-violet-950/80 hover:bg-violet-900 border border-violet-700/60 px-2.5 py-1 rounded-lg transition-colors shadow-sm"
                  title="Сбросить на весь период выгрузки"
                >
                  <RotateCcw className="w-3 h-3 text-violet-400" />
                  <span>Весь период ({totalDatasetDays} дн.)</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-300 flex-wrap">
              <span>
                Выручка в месяц:{" "}
                <b className="text-white font-semibold">
                  {analytics.reportDays
                    ? Math.round(analytics.totalRevenueInLog / (analytics.reportDays / 30)).toLocaleString("ru")
                    : 0}{" "}
                  ₽
                </b>
              </span>
              <span>·</span>
              <span>
                Часов в месяц:{" "}
                <b className="text-white font-semibold">
                  {analytics.reportDays && analytics.totalHoursPlayed
                    ? Math.round(analytics.totalHoursPlayed / (analytics.reportDays / 30)).toLocaleString("ru")
                    : 0}{" "}
                  ч
                </b>
              </span>
            </div>
          </div>

          {/* Bottom Line: Quick Month Pills + Custom Date Range Inputs */}
          <div className="pt-3 border-t border-slate-800/90 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Quick Month Selector */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-slate-400 mr-1">Быстрый выбор:</span>

              <button
                type="button"
                onClick={handleSelectAllPeriod}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-lg font-medium transition-all",
                  !isFiltered
                    ? "bg-violet-600 text-white shadow-sm ring-1 ring-violet-400 font-semibold"
                    : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60"
                )}
              >
                Все ({totalDatasetDays} дн.)
              </button>

              {availableMonths.map((m) => {
                const isSelected = dateFilter?.monthKey === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => handleSelectMonth(m)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-lg font-medium transition-all",
                      isSelected
                        ? "bg-violet-600 text-white shadow-sm ring-1 ring-violet-400 font-semibold"
                        : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60"
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Range Picker */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="text-[11px] text-slate-400">Диапазон:</span>
              <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-lg px-2.5 py-1">
                <span className="text-[11px] text-slate-400">С</span>
                <input
                  type="date"
                  value={customStart}
                  min={datasetStartIso}
                  max={datasetEndIso}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-transparent text-white text-xs outline-none cursor-pointer [color-scheme:dark]"
                />
                <span className="text-[11px] text-slate-400">По</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || datasetStartIso}
                  max={datasetEndIso}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-transparent text-white text-xs outline-none cursor-pointer [color-scheme:dark]"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomRange}
                  disabled={!customStart || !customEnd}
                  className="ml-1 px-2.5 py-0.5 rounded bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-medium text-[11px] transition-colors"
                >
                  ОК
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zone Analytics Cards (from Table 4 & Workstations) */}
      {analytics.hasPackagesReport && analytics.clubZoneStats && analytics.clubZoneStats.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-violet-100 text-violet-700">
                  <Gamepad2 className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight">
                  Распределение по игровым зонам клуба
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Выручка, популярность и списания бонусов по зонам (сопоставлено с оборудованием клуба)
              </p>
            </div>

            {selectedZone !== "all" && (
              <button
                onClick={() => setSelectedZone("all")}
                className="text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 w-fit"
              >
                <span>Сбросить фильтр зоны ({selectedZone})</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {analytics.clubZoneStats.map((z) => {
              const isSelected = selectedZone === z.zone;
              return (
                <div
                  key={z.zone}
                  onClick={() => setSelectedZone(isSelected ? "all" : z.zone)}
                  className={cn(
                    "cursor-pointer rounded-xl p-3.5 border transition-all text-left flex flex-col justify-between group",
                    isSelected
                      ? "border-violet-600 bg-violet-50/70 shadow-sm ring-1 ring-violet-500"
                      : "border-slate-200/80 hover:border-violet-300 hover:bg-slate-50/70"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-800 truncate" title={z.zone}>
                      {z.zone}
                    </span>
                    <span className="text-[10px] font-semibold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
                      {z.percentOfRub}%
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-0.5">
                    <div className="text-base font-black tracking-tight text-slate-900 tabular-nums">
                      {Math.round(z.rub).toLocaleString("ru")} ₽
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{z.sessions.toLocaleString("ru")} сесс.</span>
                      {z.bonus > 0 ? (
                        <span className="text-amber-600 font-medium">-{Math.round(z.bonus).toLocaleString("ru")} Б</span>
                      ) : (
                        <span className="text-slate-400 font-medium">0 Б</span>
                      )}
                    </div>
                  </div>

                  <span className={cn(
                    "text-[10px] font-bold uppercase mt-2 pt-1 border-t text-center block transition-colors",
                    isSelected ? "text-violet-700 border-violet-200" : "text-slate-400 border-slate-100 group-hover:text-violet-600"
                  )}>
                    {isSelected ? "✓ Выбрано" : "Фильтровать"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Top Tariffs Bar */}
          {analytics.clubTariffStats && analytics.clubTariffStats.length > 0 && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
                Топ тарифов клуба:
              </span>
              {analytics.clubTariffStats.slice(0, 6).map((t, idx) => (
                <span
                  key={t.name + idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-700 border border-slate-200"
                >
                  <span className="font-semibold text-slate-900">{t.name}</span>
                  <span className="text-[10px] text-slate-400 font-medium">({t.count} пок. · {Math.round(t.rub).toLocaleString("ru")} ₽)</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-medium">Реальная выручка</span>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2 tabular-nums">
            {Math.round(analytics.totalRevenueInLog).toLocaleString("ru")} ₽
          </p>
          <span className="text-[11px] text-slate-400 mt-1">касса, ЛК, моб. приложение</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Бонусы</span>
            {analytics.overallBonusEmissionRate > 0 && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded">
                {analytics.overallBonusEmissionRate}% эмиссия
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-slate-400">Списано на ПК:</span>
                <span className="text-base font-bold text-slate-900 tabular-nums">
                  {Math.round(analytics.totalBonusSpent || 0).toLocaleString("ru")} Б
                </span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-[11px] text-slate-400">Выдано клубом:</span>
              <span className="text-xs font-bold text-amber-600 tabular-nums">
                {Math.round(analytics.totalBonusAccrued || 0).toLocaleString("ru")} Б
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">оплачено бонусами / начислено</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-medium">Доходность часа</span>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2 tabular-nums">
            {analytics.avgHourlyYield} ₽/ч
          </p>
          <span className="text-[11px] text-slate-400 mt-1">средняя за машино-час</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-medium">Игровое время</span>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2 tabular-nums">
            {(analytics.totalHoursPlayed ?? 0).toLocaleString("ru")} ч
          </p>
          <span className="text-[11px] text-slate-400 mt-1">{(analytics.totalVisits ?? 0).toLocaleString("ru")} визитов</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-medium">Клиенты в оттоке</span>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2 tabular-nums">
            {analytics.churnedCount.toLocaleString("ru")}
          </p>
          <span className="text-[11px] text-slate-400 mt-1">не были &gt; 30 дней</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-medium">Забытые деньги</span>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2 tabular-nums">
            {Math.round(analytics.abandonedBalance).toLocaleString("ru")} ₽
          </p>
          <span className="text-[11px] text-slate-400 mt-1">+ {Math.round(analytics.abandonedBonus).toLocaleString("ru")} Б</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Segment Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "whales" as const, label: "Топ клиентов", count: analytics.whales.length },
              { id: "churned" as const, label: "Отток", count: analytics.topChurned.length },
              { id: "atRisk" as const, label: "Остывают", count: analytics.atRisk.length },
              { id: "bonusHeavy" as const, label: "Бонусоеды", count: bonusHeavyClients.length },
              { id: "all" as const, label: "Все гости", count: analytics.profiles.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5",
                  viewMode === tab.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <span>{tab.label}</span>
                <span className={cn(
                  "text-[10px] tabular-nums font-normal",
                  viewMode === tab.id ? "text-slate-300" : "text-slate-400"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
            {/* Revenue Threshold Filter */}
            <div className="flex items-center gap-1 border-l pl-3 border-slate-200">
              <span className="text-[11px] text-slate-400 font-medium mr-0.5">Чек от:</span>
              {[
                { label: "Все", val: 0 },
                { label: "5 000 ₽", val: 5000 },
                { label: "10 000 ₽", val: 10000 },
                { label: "20 000 ₽", val: 20000 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setMinSpent(opt.val)}
                  className={cn(
                    "px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                    minSpent === opt.val
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Persona / Gaming Style Filter */}
            {analytics.hasPackagesReport && (
              <div className="flex items-center gap-1 border-l pl-3 border-slate-200">
                <span className="text-[11px] text-slate-400 font-medium mr-0.5">Стиль:</span>
                {[
                  { id: "all", label: "Все" },
                  { id: "night_owl", label: "🌙 Ночники" },
                  { id: "console", label: "🎮 PS Зона" },
                  { id: "bootcamp", label: "🚀 Буткемп" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedPersona(opt.id)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                      selectedPersona === opt.id
                        ? "bg-slate-900 text-white font-semibold"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Preferred Time Filter */}
            <div className="flex items-center gap-1 border-l pl-3 border-slate-200">
              <span className="text-[11px] text-slate-400 font-medium mr-0.5">Время:</span>
              {[
                { id: "all", label: "Все", icon: null, color: "" },
                { id: "night", label: "Ночь", icon: Moon, color: "text-indigo-500" },
                { id: "evening", label: "Вечер", icon: Sunset, color: "text-purple-500" },
                { id: "day", label: "День", icon: Sun, color: "text-amber-500" },
                { id: "morning", label: "Утро", icon: Sunrise, color: "text-emerald-500" },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedTime(opt.id)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1",
                      selectedTime === opt.id
                        ? "bg-slate-900 text-white font-semibold"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {Icon && <Icon className={cn("w-3 h-3 shrink-0", selectedTime === opt.id ? "text-white" : opt.color)} />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Preferred Day Pattern Filter */}
            <div className="flex items-center gap-1 border-l pl-3 border-slate-200">
              <span className="text-[11px] text-slate-400 font-medium mr-0.5">Дни:</span>
              {[
                { id: "all", label: "Все" },
                { id: "weekend", label: "🎉 Выходные" },
                { id: "weekday", label: "💼 Будни" },
                { id: "mixed", label: "🔄 Смешанные" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedDayPattern(opt.id)}
                  className={cn(
                    "px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                    selectedDayPattern === opt.id
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Tools: Search, Multi-Sort & Column Manager */}
          <div className="flex items-center gap-2 relative">
            <div className="relative w-full md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Поиск по имени/телефону…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
              />
            </div>

            {/* Multi-Sort Popover */}
            <div className="relative" ref={sortSettingsRef}>
              <button
                onClick={() => setShowSortSettings(!showSortSettings)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors",
                  showSortSettings || sortRules.length > 1
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
                title="Настройка групповой сортировки"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Сортировка ({sortRules.length})</span>
              </button>

              {showSortSettings && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">Групповая сортировка</span>
                      <span className="text-[11px] text-slate-400 block">Правила применяются по порядку (1 $\rightarrow$ 2 $\rightarrow$ 3)</span>
                    </div>
                    <button
                      onClick={() => setSortRules([{ key: "spent", desc: true }])}
                      className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Сброс</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sortRules.map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-4 text-center">{idx + 1}.</span>
                        <select
                          value={rule.key}
                          onChange={(e) => updateSortRule(idx, e.target.value as ColumnId, rule.desc)}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 flex-1 focus:outline-none"
                        >
                          {ALL_COLUMNS.filter((c) => c.sortable).map((c) => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => updateSortRule(idx, rule.key, !rule.desc)}
                          className="px-2 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-slate-700 w-24 text-center"
                        >
                          {rule.desc ? "Убывание ↓" : "Возраст. ↑"}
                        </button>
                        {sortRules.length > 1 && (
                          <button
                            onClick={() => removeSortRule(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {sortRules.length < 4 && (
                    <button
                      onClick={() => {
                        const unused = ALL_COLUMNS.find((c) => c.sortable && !sortRules.some((r) => r.key === c.id));
                        if (unused) addSortRule(unused.id);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Добавить следующий уровень</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Column settings button */}
            <div className="relative" ref={colSettingsRef}>
              <button
                onClick={() => setShowColSettings(!showColSettings)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors",
                  showColSettings
                    ? "bg-slate-100 border-slate-300 text-slate-900"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
                title="Настройка колонок и порядка"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Колонки ({activeColumns.length})</span>
              </button>

              {/* Column Settings Popover */}
              {showColSettings && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-800">Порядок и видимость колонок</span>
                    <button
                      onClick={resetColumns}
                      className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Сбросить</span>
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                    {columnOrder.map((colId, idx) => {
                      const col = ALL_COLUMNS.find((c) => c.id === colId);
                      if (!col) return null;
                      const isVis = visibleColumns[colId];

                      return (
                        <div
                          key={colId}
                          className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg text-xs group"
                        >
                          <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                            <input
                              type="checkbox"
                              checked={isVis}
                              onChange={() => toggleColumnVis(colId)}
                              className="rounded border-slate-300 text-slate-900 focus:ring-0 w-3.5 h-3.5"
                            />
                            <span className={cn(!isVis && "text-slate-400 line-through")}>
                              {col.label}
                            </span>
                          </label>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              disabled={idx === 0}
                              onClick={() => moveColumn(colId, "up")}
                              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={idx === columnOrder.length - 1}
                              onClick={() => moveColumn(colId, "down")}
                              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Sort Rules Tag Bar */}
        <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400">Порядок сортировки:</span>
            {sortRules.map((rule, idx) => {
              const col = ALL_COLUMNS.find((c) => c.id === rule.key);
              if (!col) return null;
              return (
                <span
                  key={rule.key}
                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[11px] text-slate-700 shadow-2xs"
                >
                  <span className="font-semibold text-slate-400">{idx + 1}.</span>
                  <span>{col.label}</span>
                  {rule.desc ? <ArrowDown className="w-3 h-3 text-slate-500" /> : <ArrowUp className="w-3 h-3 text-slate-500" />}
                  {sortRules.length > 1 && (
                    <button
                      onClick={() => removeSortRule(idx)}
                      className="hover:text-red-500 transition-colors ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              Совет: зажмите <b>Shift</b> и кликните по колонке для мульти-сортировки
            </span>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => scrollTable("left")}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                title="Прокрутить таблицу влево"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-slate-400 px-1 select-none flex items-center gap-1 font-medium">
                <ArrowLeftRight className="w-2.5 h-2.5" />
                <span>Прокрутка</span>
              </span>
              <button
                type="button"
                onClick={() => scrollTable("right")}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                title="Прокрутить таблицу вправо"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div ref={tableContainerRef} className="overflow-x-auto relative scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-500 border-b border-slate-200">
              <tr>
                {activeColumns.map((col) => {
                  const sortIdx = sortRules.findIndex((r) => r.key === col.id);
                  const isSorted = sortIdx !== -1;
                  const currentRule = isSorted ? sortRules[sortIdx] : null;
                  const isNameCol = col.id === "name";

                  return (
                    <th
                      key={col.id}
                      onClick={(e) => col.sortable && handleHeaderClick(col.id, e.shiftKey)}
                      className={cn(
                        "py-3 px-3.5 text-xs font-semibold select-none whitespace-nowrap",
                        col.minWidth,
                        col.align === "right" ? "text-right" : "text-left",
                        col.sortable ? "cursor-pointer hover:text-slate-900 transition-colors" : "",
                        isSorted ? "text-slate-900 bg-slate-100/70" : "",
                        isNameCol ? "sticky left-0 z-20 bg-slate-50 border-r border-slate-200/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]" : ""
                      )}
                    >
                      <div className={cn("inline-flex items-center gap-1", col.align === "right" ? "justify-end" : "justify-start")}>
                        <span>{col.label}</span>
                        {isSorted && (
                          <span className="inline-flex items-center text-slate-900 font-bold ml-0.5">
                            {currentRule?.desc ? (
                              <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUp className="w-3 h-3" />
                            )}
                            {sortRules.length > 1 && (
                              <span className="text-[9px] -ml-0.5 font-bold">{sortIdx + 1}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {displayList.slice(0, 100).map((client, idx) => {
                // Calculate channel breakdown & unambiguous label
                const adminVal = client.topupAdmin || 0;
                const lkVal = client.topupLK || 0;
                const appVal = client.topupApp || 0;
                const totalReal = client.totalSpent;

                let channelLabel = "";
                let channelTooltip = "";

                const totalChannels = adminVal + lkVal + appVal;
                if (totalChannels > 0) {
                  const adminPct = Math.round((adminVal / totalChannels) * 100);
                  const lkPct = Math.round((lkVal / totalChannels) * 100);
                  const appPct = Math.round((appVal / totalChannels) * 100);

                  if (adminPct === 100) channelLabel = "только касса";
                  else if (lkPct === 100) channelLabel = "только ЛК";
                  else if (appPct === 100) channelLabel = "только моб. прил.";
                  else if (adminPct >= lkPct && adminPct >= appPct) channelLabel = `касса ${adminPct}%`;
                  else if (lkPct >= adminPct && lkPct >= appPct) channelLabel = `ЛК ${lkPct}%`;
                  else if (appPct >= adminPct && appPct >= lkPct) channelLabel = `моб. прил. ${appPct}%`;

                  channelTooltip = `Касса: ${Math.round(adminVal).toLocaleString()} ₽ | ЛК: ${Math.round(lkVal).toLocaleString()} ₽ | Моб. прил.: ${Math.round(appVal).toLocaleString()} ₽`;
                } else if (totalReal > 0) {
                  const cashPct = client.cashShare ?? 100;
                  if (cashPct >= 99) {
                    channelLabel = "100% рубли";
                    channelTooltip = "Все пополнения чистыми деньгами, без начисленных бонусов";
                  } else {
                    channelLabel = `рубли ${cashPct}%`;
                    channelTooltip = `Доля реальных денег: ${cashPct}% | Выдано бонусов: ${client.bonusAccrued} Б (${client.bonusGivenRatio}% к тратам)`;
                  }
                }

                return (
                  <tr
                    key={client.phone + idx}
                    className="group hover:bg-slate-50/70 transition-colors"
                  >
                    {activeColumns.map((col) => {
                      switch (col.id) {
                        case "name":
                          return (
                            <td
                              key={col.id}
                              className="py-3 px-3.5 font-medium text-slate-900 whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]"
                            >
                              {client.name || "Гость"}
                            </td>
                          );

                        case "phone":
                          return (
                            <td key={col.id} className="py-3 px-3.5 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                              {client.phone ? `+7 ${client.phone}` : "—"}
                            </td>
                          );

                        case "spent":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums whitespace-nowrap">
                              {client.totalSpent > 0 ? (
                                <div title={channelTooltip}>
                                  <span className="font-semibold text-slate-900">
                                    {Math.round(client.totalSpent).toLocaleString("ru")} ₽
                                  </span>
                                  {channelLabel && (
                                    <span className="text-[10px] text-slate-400 block font-normal cursor-help">
                                      {channelLabel}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300">0 ₽</span>
                              )}
                            </td>
                          );

                        case "preferredTime":
                          return (
                            <td key={col.id} className="py-3 px-3.5 whitespace-nowrap">
                              {client.preferredTime === "night" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50/80 text-indigo-700 border border-indigo-200/60">
                                  <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  <span>Ночь <span className="text-[10px] text-indigo-500/80 font-normal">(22–06)</span></span>
                                </span>
                              ) : client.preferredTime === "evening" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-purple-50/80 text-purple-700 border border-purple-200/60">
                                  <Sunset className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                  <span>Вечер <span className="text-[10px] text-purple-500/80 font-normal">(17–22)</span></span>
                                </span>
                              ) : client.preferredTime === "day" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-50/80 text-amber-700 border border-amber-200/60">
                                  <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span>День <span className="text-[10px] text-amber-500/80 font-normal">(12–17)</span></span>
                                </span>
                              ) : client.preferredTime === "morning" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50/80 text-emerald-700 border border-emerald-200/60">
                                  <Sunrise className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  <span>Утро <span className="text-[10px] text-emerald-500/80 font-normal">(06–12)</span></span>
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          );

                        case "favoriteDay":
                          return (
                            <td key={col.id} className="py-3 px-3.5 whitespace-nowrap">
                              {client.dayPattern === "weekend" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-blue-50/80 text-blue-700 border border-blue-200/60">
                                  <span>Выходные</span>
                                  {client.favoriteDay && (
                                    <span className="text-[10px] text-blue-500 font-normal">({client.favoriteDay.slice(0, 2)})</span>
                                  )}
                                </span>
                              ) : client.dayPattern === "weekday" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-teal-50/80 text-teal-700 border border-teal-200/60">
                                  <span>Будни</span>
                                  {client.favoriteDay && (
                                    <span className="text-[10px] text-teal-600 font-normal">({client.favoriteDay.slice(0, 2)})</span>
                                  )}
                                </span>
                              ) : client.dayPattern === "mixed" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                  <span>Смешанные</span>
                                  {client.favoriteDay && (
                                    <span className="text-[10px] text-slate-500 font-normal">({client.favoriteDay.slice(0, 2)})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          );

                        case "topupAdmin":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums font-medium text-slate-700 whitespace-nowrap">
                              {adminVal > 0 ? `${Math.round(adminVal).toLocaleString("ru")} ₽` : <span className="text-slate-300">0 ₽</span>}
                            </td>
                          );

                        case "topupLK":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums font-medium text-slate-700 whitespace-nowrap">
                              {lkVal > 0 ? `${Math.round(lkVal).toLocaleString("ru")} ₽` : <span className="text-slate-300">0 ₽</span>}
                            </td>
                          );

                        case "topupApp":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums font-medium text-slate-700 whitespace-nowrap">
                              {appVal > 0 ? `${Math.round(appVal).toLocaleString("ru")} ₽` : <span className="text-slate-300">0 ₽</span>}
                            </td>
                          );

                        case "hourlyYield":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums whitespace-nowrap">
                              {client.hourlyYield !== undefined ? (
                                <span className={cn(
                                  "font-semibold",
                                  client.hourlyYield >= 100
                                    ? "text-slate-900"
                                    : client.hourlyYield >= 60
                                    ? "text-slate-600"
                                    : "text-rose-600"
                                )}>
                                  {client.hourlyYield} ₽/ч
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );

                        case "favoriteZone":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-xs whitespace-nowrap">
                              {client.favoriteZone ? (
                                <span className="font-medium text-slate-800">
                                  {client.favoriteZone}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );

                        case "favoriteTariff":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-xs text-slate-700 whitespace-nowrap">
                              {client.favoriteTariff ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-slate-800">{client.favoriteTariff}</span>
                                  {client.packageCount && (
                                    <span className="text-[10px] text-slate-400">({client.packageCount}x)</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );

                        case "favoriteSeat":
                          return (
                            <td key={col.id} className="py-3 px-3.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                              {client.favoriteSeat || <span className="text-slate-300">—</span>}
                            </td>
                          );

                        case "packageSpentRub":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums font-medium text-slate-800 whitespace-nowrap">
                              {client.packageSpentRub !== undefined && client.packageSpentRub > 0
                                ? `${Math.round(client.packageSpentRub).toLocaleString("ru")} ₽`
                                : <span className="text-slate-300">—</span>}
                            </td>
                          );

                        case "packageSpentBonus":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums font-medium text-amber-700 whitespace-nowrap">
                              {client.packageSpentBonus !== undefined && client.packageSpentBonus > 0
                                ? `${Math.round(client.packageSpentBonus).toLocaleString("ru")} Б`
                                : <span className="text-slate-300">—</span>}
                            </td>
                          );

                        case "bonusAccrued":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums whitespace-nowrap">
                              {client.bonusAccrued > 0 ? (
                                <div>
                                  <span className="font-medium text-amber-700">
                                    +{Math.round(client.bonusAccrued).toLocaleString("ru")} Б
                                  </span>
                                  {client.totalSpent > 0 && (
                                    <span className={cn(
                                      "text-[10px] block font-normal",
                                      client.bonusGivenRatio > 35 ? "text-rose-600 font-semibold" : "text-slate-400"
                                    )}>
                                      {client.bonusGivenRatio}% к кассе
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300">0 Б</span>
                              )}
                            </td>
                          );

                        case "bonusSpent":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums whitespace-nowrap">
                              {client.bonusSpent > 0 ? (
                                <span className="text-slate-700 font-medium">
                                  {Math.round(client.bonusSpent).toLocaleString("ru")} Б
                                </span>
                              ) : (
                                <span className="text-slate-300">0 Б</span>
                              )}
                            </td>
                          );

                        case "bonusBalance":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums whitespace-nowrap">
                              {client.bonusBalance > 0 ? (
                                <span className="font-semibold text-slate-800">
                                  {Math.round(client.bonusBalance).toLocaleString("ru")} Б
                                </span>
                              ) : (
                                <span className="text-slate-300">0 Б</span>
                              )}
                            </td>
                          );

                        case "visits":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums whitespace-nowrap">
                              {client.visits !== undefined ? (
                                <span className="font-medium text-slate-800">
                                  {client.visits} виз.
                                </span>
                              ) : client.txCount > 0 ? (
                                <span className="text-slate-500">{client.txCount} оп.</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );

                        case "hours":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums whitespace-nowrap">
                              {client.playedHours !== undefined ? (
                                <div>
                                  <span className="font-medium text-slate-900">
                                    {client.playedHours} ч
                                  </span>
                                  {client.avgSessionMinutes && client.avgSessionMinutes > 0 && (
                                    <span className="text-[10px] text-slate-400 block font-normal">
                                      ср. {Math.round(client.avgSessionMinutes / 60 * 10) / 10} ч
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );

                        case "balance":
                          return (
                            <td key={col.id} className="py-3 px-3.5 text-right tabular-nums font-medium whitespace-nowrap">
                              {client.balance > 0 ? (
                                <span className="text-slate-900">
                                  {Math.round(client.balance).toLocaleString("ru")} ₽
                                </span>
                              ) : (
                                <span className="text-slate-300">0 ₽</span>
                              )}
                            </td>
                          );

                        case "days":
                          return (
                            <td key={col.id} className="py-3 px-3.5 tabular-nums text-slate-600 whitespace-nowrap">
                              <div>{formatDate(client.lastAuth)}</div>
                              {client.daysSince !== null && (
                                <span className={cn(
                                  "text-[10px] block font-normal",
                                  client.daysSince <= 7
                                    ? "text-emerald-600"
                                    : client.daysSince <= 30
                                    ? "text-amber-600"
                                    : "text-slate-400"
                                )}>
                                  {client.daysSince === 0
                                    ? "сегодня"
                                    : `${client.daysSince} дн. назад`}
                                </span>
                              )}
                            </td>
                          );

                        case "category":
                          return (
                            <td key={col.id} className="py-3 px-3.5 whitespace-nowrap">
                              {client.valueCategory === "diamond" && (
                                <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span>Золотой</span>
                                </span>
                              )}
                              {client.valueCategory === "loyal" && (
                                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span>Лояльный</span>
                                </span>
                              )}
                              {client.valueCategory === "bonus_heavy" && (
                                <span className="inline-flex items-center gap-1.5 text-rose-700 font-semibold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  <span>Бонусоед</span>
                                </span>
                              )}
                              {client.valueCategory === "standard" && (
                                <span className="text-slate-400 text-[11px]">Обычный</span>
                              )}
                            </td>
                          );

                        default:
                          return null;
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {displayList.length > 100 && (
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-400">
            Показаны первые 100 из {displayList.length.toLocaleString("ru")} клиентов. Используйте поиск для точной выборки.
          </div>
        )}
      </div>
    </div>
  );
}
