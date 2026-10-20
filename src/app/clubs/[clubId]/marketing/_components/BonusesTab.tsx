"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Clock,
  UserCheck,
  UserX,
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SnapshotFull } from "./types";
import type { DateFilter } from "./segmentation";
import {
  extractBonusOperations,
  matchOperationsWithShifts,
  parseSpreadsheetFile,
  BONUS_CATEGORIES,
  type BonusOperation,
  type BonusCategory,
  type BonusRiskLevel,
  type ShiftInfo,
} from "./bonusAudit";

interface Props {
  clubId: string;
  txRows: Record<string, unknown>[] | null;
  activeSnapshot: SnapshotFull | null;
  dateFilter?: DateFilter | null;
  onUploadTxRows?: (rows: Record<string, unknown>[], filename: string) => void;
}

export function BonusesTab({
  clubId,
  txRows,
  activeSnapshot,
  dateFilter,
  onUploadTxRows,
}: Props) {
  const [shifts, setShifts] = useState<ShiftInfo[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [shiftsError, setShiftsError] = useState<string | null>(null);

  // Local fallback file upload if txRows wasn't loaded via UploadTab
  const [localTxRows, setLocalTxRows] = useState<Record<string, unknown>[] | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [parsingLocalFile, setParsingLocalFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<BonusCategory | "all">("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedRisk, setSelectedRisk] = useState<"all" | "anomalies_only" | "critical" | "warning" | "normal">("all");
  const [selectedShiftStatus, setSelectedShiftStatus] = useState<"all" | "in_shift" | "off_shift">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load shifts for this club
  const fetchShifts = async () => {
    if (!clubId) return;
    setLoadingShifts(true);
    setShiftsError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/shifts?limit=500`);
      if (!res.ok) throw new Error("Не удалось загрузить данные смен");
      const data = await res.json();
      setShifts(data.shifts || []);
    } catch (err: any) {
      console.warn("Error fetching shifts:", err);
      setShiftsError(err?.message || "Ошибка загрузки смен");
    } finally {
      setLoadingShifts(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [clubId]);

  // Extract raw bonus operations from either live txRows, local uploaded rows, or saved snapshot
  const rawOperations: BonusOperation[] = useMemo(() => {
    // 1. Live or local file upload
    const currentRows = txRows || localTxRows;
    if (currentRows && currentRows.length > 0) {
      return extractBonusOperations(currentRows);
    }

    // 2. Active saved snapshot
    if (activeSnapshot?.summary_metrics?.bonus_operations) {
      const ops = activeSnapshot.summary_metrics.bonus_operations as any[];
      return ops.map((op) => ({
        ...op,
        date: op.dateStr ? new Date(op.dateStr) : null,
      }));
    }

    return [];
  }, [txRows, localTxRows, activeSnapshot]);

  // Match operations with employee shifts
  const shiftMatchedOperations: BonusOperation[] = useMemo(() => {
    return matchOperationsWithShifts(rawOperations, shifts);
  }, [rawOperations, shifts]);

  // Apply optional global date filter
  const dateFilteredOperations: BonusOperation[] = useMemo(() => {
    if (!dateFilter || (!dateFilter.startDate && !dateFilter.endDate)) {
      return shiftMatchedOperations;
    }
    const start = dateFilter.startDate ? dateFilter.startDate.getTime() : 0;
    const end = dateFilter.endDate ? dateFilter.endDate.getTime() : Infinity;

    return shiftMatchedOperations.filter((op) => {
      if (!op.date) return true;
      const t = op.date.getTime();
      return t >= start && t <= end;
    });
  }, [shiftMatchedOperations, dateFilter]);

  // Unique employees list for dropdown filter
  const employeeList = useMemo(() => {
    const set = new Set<string>();
    for (const op of dateFilteredOperations) {
      if (op.matchedEmployeeName) set.add(op.matchedEmployeeName);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [dateFilteredOperations]);

  // High-level KPIs
  const kpis = useMemo(() => {
    const totalCount = dateFilteredOperations.length;
    const totalSum = dateFilteredOperations.reduce((acc, o) => acc + o.amount, 0);

    const withComment = dateFilteredOperations.filter((o) => o.category !== "no_comment");
    const withoutComment = dateFilteredOperations.filter((o) => o.category === "no_comment");
    const commentDisciplineRate = totalCount > 0 ? Math.round((withComment.length / totalCount) * 100) : 100;

    const criticalCount = dateFilteredOperations.filter((o) => o.riskLevel === "critical").length;
    const warningCount = dateFilteredOperations.filter((o) => o.riskLevel === "warning").length;
    const anomaliesCount = criticalCount + warningCount;

    const inShiftCount = dateFilteredOperations.filter((o) => !o.isOffShift).length;
    const offShiftCount = dateFilteredOperations.filter((o) => o.isOffShift).length;
    const shiftMatchRate = totalCount > 0 ? Math.round((inShiftCount / totalCount) * 100) : 100;

    const avgAmount = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;

    return {
      totalCount,
      totalSum,
      withCommentCount: withComment.length,
      withoutCommentCount: withoutComment.length,
      commentDisciplineRate,
      criticalCount,
      warningCount,
      anomaliesCount,
      inShiftCount,
      offShiftCount,
      shiftMatchRate,
      avgAmount,
    };
  }, [dateFilteredOperations]);

  // Category counts and sums
  const categoryStats = useMemo(() => {
    const map = new Map<BonusCategory, { count: number; sum: number }>();
    for (const c of BONUS_CATEGORIES) {
      map.set(c.id, { count: 0, sum: 0 });
    }
    for (const op of dateFilteredOperations) {
      const cur = map.get(op.category) || { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += op.amount;
      map.set(op.category, cur);
    }
    return map;
  }, [dateFilteredOperations]);

  // Employee shift summary table
  const employeeSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        count: number;
        sum: number;
        noCommentCount: number;
        anomaliesCount: number;
        criticalCount: number;
        isOffShift: boolean;
        isApi: boolean;
      }
    >();

    for (const op of dateFilteredOperations) {
      const name = op.matchedEmployeeName || "Вне смены";
      const isApi = name.includes("API") || op.category === "spin_reward";
      const isOffShift = Boolean(op.isOffShift);

      const entry = map.get(name) || {
        name,
        count: 0,
        sum: 0,
        noCommentCount: 0,
        anomaliesCount: 0,
        criticalCount: 0,
        isOffShift,
        isApi,
      };

      entry.count += 1;
      entry.sum += op.amount;
      if (op.category === "no_comment") entry.noCommentCount += 1;
      if (op.riskLevel === "warning" || op.riskLevel === "critical") entry.anomaliesCount += 1;
      if (op.riskLevel === "critical") entry.criticalCount += 1;

      map.set(name, entry);
    }

    return Array.from(map.values()).sort((a, b) => b.sum - a.sum);
  }, [dateFilteredOperations]);

  // Filtered & sorted operations for the table
  const filteredOperations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return dateFilteredOperations
      .filter((op) => {
        // Search query
        if (q) {
          const matchPhone = op.phone.includes(q);
          const matchGuest = op.guestName.toLowerCase().includes(q);
          const matchComment = op.comment.toLowerCase().includes(q);
          const matchAuthor = (op.matchedEmployeeName || "").toLowerCase().includes(q);
          const matchCategory = op.categoryLabel.toLowerCase().includes(q);
          if (!matchPhone && !matchGuest && !matchComment && !matchAuthor && !matchCategory) {
            return false;
          }
        }

        // Category filter
        if (selectedCategory !== "all" && op.category !== selectedCategory) {
          return false;
        }

        // Employee filter
        if (selectedEmployee !== "all" && op.matchedEmployeeName !== selectedEmployee) {
          return false;
        }

        // Risk filter
        if (selectedRisk === "anomalies_only" && op.riskLevel === "normal") {
          return false;
        }
        if (selectedRisk === "critical" && op.riskLevel !== "critical") {
          return false;
        }
        if (selectedRisk === "warning" && op.riskLevel !== "warning") {
          return false;
        }
        if (selectedRisk === "normal" && op.riskLevel !== "normal") {
          return false;
        }

        // Shift status filter
        if (selectedShiftStatus === "in_shift" && op.isOffShift) {
          return false;
        }
        if (selectedShiftStatus === "off_shift" && !op.isOffShift) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "date_desc") {
          return (b.date?.getTime() || 0) - (a.date?.getTime() || 0);
        }
        if (sortBy === "date_asc") {
          return (a.date?.getTime() || 0) - (b.date?.getTime() || 0);
        }
        if (sortBy === "amount_desc") {
          return b.amount - a.amount;
        }
        if (sortBy === "amount_asc") {
          return a.amount - b.amount;
        }
        return 0;
      });
  }, [
    dateFilteredOperations,
    searchQuery,
    selectedCategory,
    selectedEmployee,
    selectedRisk,
    selectedShiftStatus,
    sortBy,
  ]);

  // Pagination
  const totalPages = Math.ceil(filteredOperations.length / pageSize) || 1;
  const paginatedOperations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOperations.slice(start, start + pageSize);
  }, [filteredOperations, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    selectedCategory,
    selectedEmployee,
    selectedRisk,
    selectedShiftStatus,
    sortBy,
    pageSize,
  ]);

  // Handle local file drop or selection
  const handleFileDrop = async (file: File) => {
    setParsingLocalFile(true);
    try {
      const rows = await parseSpreadsheetFile(file);
      setLocalTxRows(rows);
      setLocalFileName(file.name);
      if (onUploadTxRows) {
        onUploadTxRows(rows, file.name);
      }
    } catch (err: any) {
      alert("Ошибка при чтении файла: " + (err?.message || "Неверный формат"));
    } finally {
      setParsingLocalFile(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredOperations.length === 0) return;
    const header = [
      "Дата и время",
      "Сотрудник (Смена)",
      "Статус смены",
      "Клиент",
      "Телефон",
      "Сумма бонусов",
      "Категория",
      "Комментарий",
      "Уровень риска",
      "Причины риска",
      "Источник",
    ];

    const rows = filteredOperations.map((op) => [
      op.dateStr,
      op.matchedEmployeeName || "Вне смены",
      op.isOffShift ? "Вне смены" : "В смену",
      `"${op.guestName.replace(/"/g, '""')}"`,
      op.phone,
      op.amount,
      `"${op.categoryLabel.replace(/"/g, '""')}"`,
      `"${(op.comment || "").replace(/"/g, '""')}"`,
      op.riskLevel,
      `"${(op.riskReasons || []).join("; ").replace(/"/g, '""')}"`,
      `"${(op.source || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [header.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bonus_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedCategory !== "all" ||
    selectedEmployee !== "all" ||
    selectedRisk !== "all" ||
    selectedShiftStatus !== "all";

  // If no operations exist at all, show friendly upload callout
  if (rawOperations.length === 0) {
    return (
      <div className="space-y-6 font-sans">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Аудит ручных начислений бонусов
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Контроль обоснований, сверка с реальными сменами сотрудников и поиск аномалий
          </p>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleFileDrop(e.dataTransfer.files[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-violet-400 bg-white hover:bg-violet-50/20 rounded-2xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 max-w-2xl mx-auto shadow-xs"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileDrop(e.target.files[0]);
            }}
          />

          <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center shadow-xs">
            {parsingLocalFile ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>

          <div className="space-y-1">
            <h3 className="font-semibold text-base text-slate-900">
              Загрузите отчет «Лог ручных начислений/списаний»
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Перетащите файл сюда или нажмите для выбора (.xlsx / .csv). Файл содержит журнал операций по кассе с комментариями и датами.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>SmartShell: Отчеты → Лог ручных начислений/списаний</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-slate-900">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Аудит ручных начислений бонусов
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Сверка начислений со сменами администраторов, разбор комментариев и выявление злоупотреблений
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          <button
            type="button"
            onClick={fetchShifts}
            disabled={loadingShifts}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs cursor-pointer transition-all disabled:opacity-50"
            title="Обновить список смен из базы"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-slate-500", loadingShifts && "animate-spin")} />
            <span>Смены ({shifts.length})</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs cursor-pointer transition-all"
            title="Выгрузить отфильтрованные строки в CSV файл"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Экспорт в CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Всего выдано */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Всего начислено бонусов</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {kpis.totalSum.toLocaleString("ru")} <span className="text-lg font-semibold text-slate-500">Б</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>{kpis.totalCount.toLocaleString("ru")} начислений</span>
            <span className="font-mono text-slate-600">ср. {kpis.avgAmount} Б</span>
          </div>
        </div>

        {/* Card 2: Дисциплина комментариев */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Дисциплина комментариев</span>
            {kpis.withoutCommentCount > 0 ? (
              <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                {kpis.withoutCommentCount} без комм.
              </span>
            ) : (
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                100% заполнено
              </span>
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {kpis.commentDisciplineRate}%
          </div>
          <div className="mt-2">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${kpis.commentDisciplineRate}%` }}
              ></div>
              <div
                className="bg-rose-500 h-full"
                style={{ width: `${100 - kpis.commentDisciplineRate}%` }}
              ></div>
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
              <span>{kpis.withCommentCount} с причиной</span>
              <span className={kpis.withoutCommentCount > 0 ? "text-rose-600 font-semibold" : ""}>
                {kpis.withoutCommentCount} пустых
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Аномалии и риски */}
        <div
          onClick={() => {
            if (selectedRisk === "anomalies_only") {
              setSelectedRisk("all");
            } else {
              setSelectedRisk("anomalies_only");
            }
          }}
          className={cn(
            "border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all",
            kpis.anomaliesCount > 0
              ? selectedRisk === "anomalies_only"
                ? "bg-rose-50 border-rose-300 ring-2 ring-rose-200"
                : "bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/30"
              : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="flex items-center gap-1 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>Аномалии и риски</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {selectedRisk === "anomalies_only" ? "Фильтр активен" : "Нажмите для фильтра"}
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-baseline gap-2">
            <span>{kpis.anomaliesCount}</span>
            <span className="text-xs font-normal text-slate-500">операций</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span className="text-rose-700 font-semibold">{kpis.criticalCount} критических</span>
            <span className="text-amber-700 font-semibold">{kpis.warningCount} предупреждений</span>
          </div>
        </div>

        {/* Card 4: Привязка к сменам */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Сверка со сменами</span>
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
              {shifts.length} смен в базе
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {kpis.shiftMatchRate}%
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span className="text-emerald-700 font-medium">
              {kpis.inShiftCount} в открытую смену
            </span>
            <span className={kpis.offShiftCount > 0 ? "text-amber-700 font-semibold" : ""}>
              {kpis.offShiftCount} вне смен / API
            </span>
          </div>
        </div>
      </div>

      {/* Category Pills (Обоснования начислений) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Категории и обоснования начислений
          </h3>
          {selectedCategory !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className="text-xs text-violet-600 hover:text-violet-800 font-medium cursor-pointer"
            >
              Сбросить фильтр категории
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Chip All */}
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-2 border",
              selectedCategory === "all"
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            <span>Все категории</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums",
                selectedCategory === "all" ? "bg-slate-800 text-slate-200" : "bg-white text-slate-600 border border-slate-200"
              )}
            >
              {kpis.totalCount}
            </span>
          </button>

          {/* Individual Category Chips */}
          {BONUS_CATEGORIES.map((cat) => {
            const stat = categoryStats.get(cat.id) || { count: 0, sum: 0 };
            const isActive = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isActive ? "all" : cat.id)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-2 border",
                  isActive
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : cat.id === "no_comment" && stat.count > 0
                    ? "bg-rose-50/70 text-rose-800 border-rose-200 hover:bg-rose-100/60"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                )}
              >
                <span>{cat.label}</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums",
                    isActive
                      ? "bg-slate-800 text-slate-200"
                      : cat.id === "no_comment"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-white text-slate-600 border border-slate-200"
                  )}
                >
                  {stat.count} • {stat.sum.toLocaleString("ru")} Б
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Staff & Shifts Summary Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm text-slate-900">
              Сводка по сотрудникам на смене
            </h3>
            <p className="text-xs text-slate-500">
              Определено через сопоставление времени операции с открытыми сменами в DashAdmin
            </p>
          </div>
          {selectedEmployee !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedEmployee("all")}
              className="text-xs font-medium text-violet-600 hover:text-violet-800 self-start sm:self-auto cursor-pointer"
            >
              Сбросить фильтр сотрудника ({selectedEmployee})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold tracking-wider text-[11px]">
                <th className="py-2.5 px-4 min-w-[180px]">Сотрудник на смене</th>
                <th className="py-2.5 px-4 min-w-[100px] text-right">Начислений</th>
                <th className="py-2.5 px-4 min-w-[120px] text-right">Сумма бонусов</th>
                <th className="py-2.5 px-4 min-w-[130px] text-center">Без комментария</th>
                <th className="py-2.5 px-4 min-w-[110px] text-center">Аномалии</th>
                <th className="py-2.5 px-4 min-w-[110px] text-right">Средний чек</th>
                <th className="py-2.5 px-4 min-w-[110px] text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {employeeSummaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Нет данных по сотрудникам за выбранный период.
                  </td>
                </tr>
              ) : (
                employeeSummaries.map((emp) => {
                  const isSelected = selectedEmployee === emp.name;
                  const avg = emp.count > 0 ? Math.round(emp.sum / emp.count) : 0;
                  const noCommentRate = emp.count > 0 ? Math.round((emp.noCommentCount / emp.count) * 100) : 0;

                  return (
                    <tr
                      key={emp.name}
                      className={cn(
                        "hover:bg-slate-50/70 transition-colors",
                        isSelected && "bg-violet-50/50"
                      )}
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                        {emp.isApi ? (
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        ) : emp.isOffShift ? (
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        )}
                        <span>{emp.name}</span>
                        {emp.isOffShift && (
                          <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">
                            вне смены
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {emp.count}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                        {emp.sum.toLocaleString("ru")} Б
                      </td>
                      <td className="py-3 px-4 text-center">
                        {emp.noCommentCount > 0 ? (
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums",
                              noCommentRate >= 20
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                            )}
                          >
                            {emp.noCommentCount} ({noCommentRate}%)
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium text-[11px]">0 (0%)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {emp.anomaliesCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
                            {emp.anomaliesCount}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {avg} Б
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployee(isSelected ? "all" : emp.name)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                            isSelected
                              ? "bg-violet-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          )}
                        >
                          {isSelected ? "Выбран" : "Показать"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Operations Audit Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
        {/* Controls row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по телефону, клиенту, комментарию или сотруднику…"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
          </div>

          {/* Filters & Sorters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Risk filter */}
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Все риски (любые)</option>
              <option value="anomalies_only">Только с аномалиями</option>
              <option value="critical">Только критические</option>
              <option value="warning">Только предупреждения</option>
              <option value="normal">Только в норме</option>
            </select>

            {/* Employee filter */}
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none cursor-pointer max-w-[160px]"
            >
              <option value="all">Все сотрудники</option>
              {employeeList.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
            </select>

            {/* Shift status filter */}
            <select
              value={selectedShiftStatus}
              onChange={(e) => setSelectedShiftStatus(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Все статусы смены</option>
              <option value="in_shift">Только в смену</option>
              <option value="off_shift">Только вне смены</option>
            </select>

            {/* Sort order */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="date_desc">Дата: новые сначала</option>
              <option value="date_asc">Дата: старые сначала</option>
              <option value="amount_desc">Сумма: по убыванию</option>
              <option value="amount_asc">Сумма: по возрастанию</option>
            </select>

            {/* Clear all filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setSelectedEmployee("all");
                  setSelectedRisk("all");
                  setSelectedShiftStatus("all");
                }}
                className="px-2.5 py-2 text-xs font-medium text-rose-600 hover:text-rose-800 cursor-pointer"
                title="Сбросить все активные фильтры"
              >
                Сбросить
              </button>
            )}
          </div>
        </div>

        {/* Results summary counter */}
        <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
          <span>
            Показано <b className="text-slate-900 font-mono">{filteredOperations.length}</b> из{" "}
            <span className="font-mono">{dateFilteredOperations.length}</span> операций
          </span>
          <div className="flex items-center gap-2">
            <span>Строк на странице:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg text-xs px-2 py-1 text-slate-700"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold tracking-wider text-[11px]">
                <th className="py-2.5 px-3 w-10 text-slate-400">№</th>
                <th className="py-2.5 px-3 min-w-[125px]">Дата и время</th>
                <th className="py-2.5 px-3 min-w-[160px]">Администратор (Смена)</th>
                <th className="py-2.5 px-3 min-w-[150px]">Клиент</th>
                <th className="py-2.5 px-3 min-w-[90px] text-right">Сумма</th>
                <th className="py-2.5 px-3 min-w-[140px]">Категория</th>
                <th className="py-2.5 px-3 min-w-[240px]">Комментарий / Обоснование</th>
                <th className="py-2.5 px-3 min-w-[140px]">Контроль / Риск</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {paginatedOperations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Нет операций, соответствующих выбранным критериям поиска и фильтрации.
                  </td>
                </tr>
              ) : (
                paginatedOperations.map((op, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const formattedPhone = op.phone
                    ? `+7 (${op.phone.slice(0, 3)}) ${op.phone.slice(3, 6)}-${op.phone.slice(6, 8)}-${op.phone.slice(8, 10)}`
                    : "—";

                  const isCopied = copiedKey === `op_${op.id}`;

                  return (
                    <tr key={op.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* № */}
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] align-top">
                        {globalIdx}
                      </td>

                      {/* Date & Time */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        <div className="font-mono text-slate-900 font-medium">
                          {op.dateStr || "—"}
                        </div>
                      </td>

                      {/* Employee / Shift info */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-semibold text-slate-900 leading-tight">
                          {op.matchedEmployeeName || "Вне смены"}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {op.isOffShift ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                              <UserX className="w-3 h-3" />
                              <span>Вне смены</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              <UserCheck className="w-3 h-3" />
                              <span>Смена</span>
                            </span>
                          )}
                          {op.source && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({op.source})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Guest name & phone with copy */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-semibold text-slate-900 truncate max-w-[150px]" title={op.guestName}>
                          {op.guestName}
                        </div>
                        {op.phone ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-[11px] text-slate-500">
                              {formattedPhone}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(op.phone, `op_${op.id}`)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer rounded"
                              title="Скопировать телефон"
                            >
                              {isCopied ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          +{op.amount}
                        </span>{" "}
                        <span className="text-[11px] font-medium text-slate-500">Б</span>
                      </td>

                      {/* Category Badge */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                            op.category === "tech_issue" && "bg-amber-50 text-amber-800 border-amber-200",
                            op.category === "marketing" && "bg-emerald-50 text-emerald-800 border-emerald-200",
                            op.category === "spin_reward" && "bg-indigo-50 text-indigo-800 border-indigo-200",
                            op.category === "cashier_correction" && "bg-blue-50 text-blue-800 border-blue-200",
                            op.category === "no_comment" && "bg-rose-50 text-rose-800 border-rose-200",
                            op.category === "other" && "bg-slate-100 text-slate-700 border-slate-200"
                          )}
                        >
                          {op.categoryLabel}
                        </span>
                      </td>

                      {/* Comment / Justification */}
                      <td className="py-2.5 px-3 align-top">
                        {op.comment ? (
                          <div className="text-slate-700 text-xs leading-snug break-words">
                            {op.comment}
                          </div>
                        ) : (
                          <div className="text-rose-500 italic text-[11px] font-medium">
                            — Обоснование не указано —
                          </div>
                        )}
                      </td>

                      {/* Risk / Anomaly control */}
                      <td className="py-2.5 px-3 align-top">
                        {op.riskLevel === "critical" ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-300">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              <span>Критический риск</span>
                            </span>
                            {op.riskReasons.map((r, i) => (
                              <div key={i} className="text-[10px] text-rose-700 font-medium leading-tight">
                                • {r}
                              </div>
                            ))}
                          </div>
                        ) : op.riskLevel === "warning" ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Внимание</span>
                            </span>
                            {op.riskReasons.map((r, i) => (
                              <div key={i} className="text-[10px] text-amber-700 font-medium leading-tight">
                                • {r}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>В норме</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Страница <b className="text-slate-900">{currentPage}</b> из{" "}
              <b className="text-slate-900">{totalPages}</b>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
