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
  Calendar,
  RotateCcw,
  CalendarRange,
  Monitor,
  Wrench,
  Settings2,
  X,
  Plus,
  Users,
  Flame,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SnapshotFull } from "./types";
import type { DateFilter } from "./segmentation";
import {
  extractBonusOperations,
  matchOperationsWithShifts,
  extractPackageSessions,
  matchOperationsWithPC,
  parseSpreadsheetFile,
  BONUS_CATEGORIES,
  type BonusOperation,
  type BonusCategory,
  type BonusRiskLevel,
  type ShiftInfo,
} from "./bonusAudit";

export interface AnomalousGuest {
  phone: string;
  guestName: string;
  totalBonus: number;
  opCount: number;
  noCommentCount: number;
  noCommentRate: number;
  criticalCount: number;
  warningCount: number;
  offShiftCount: number;
  reasons: string[];
  admins: string[];
  rawAuthors: string[];
  pcs: string[];
  lastDateStr: string;
}

interface Props {
  clubId: string;
  txRows: Record<string, unknown>[] | null;
  packageRows?: Record<string, unknown>[] | null;
  activeSnapshot: SnapshotFull | null;
  dateFilter?: DateFilter | null;
  onUploadTxRows?: (rows: Record<string, unknown>[], filename: string) => void;
}

export function BonusesTab({
  clubId,
  txRows,
  packageRows,
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
  const tableRef = useRef<HTMLDivElement>(null);

  // Period / Date Range Filtering
  const [periodMode, setPeriodMode] = useState<"all" | "month" | "custom" | "7d" | "30d">("all");
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<BonusCategory | "all">("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedPc, setSelectedPc] = useState<string>("all");
  const [selectedRisk, setSelectedRisk] = useState<"all" | "anomalies_only" | "critical" | "warning" | "normal">("all");
  const [selectedShiftStatus, setSelectedShiftStatus] = useState<"all" | "in_shift" | "off_shift">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Author exclusions ("Кем сделано", e.g. uprav, менеджер, etc.)
  const [excludedAuthors, setExcludedAuthors] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`marketing_bonus_excluded_authors_${clubId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }
    return ["uprav", "менеджер"];
  });
  const [isExclusionActive, setIsExclusionActive] = useState<boolean>(true);
  const [showExclusionSettings, setShowExclusionSettings] = useState<boolean>(false);
  const [newAuthorInput, setNewAuthorInput] = useState<string>("");

  // Summary section sub-tab: "shifts" (Сотрудники на смене) vs "guests" (Аномальные гости)
  const [summarySubTab, setSummarySubTab] = useState<"shifts" | "guests">("shifts");

  // Save excluded authors to localStorage
  const handleSaveExcludedAuthors = (list: string[]) => {
    setExcludedAuthors(list);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`marketing_bonus_excluded_authors_${clubId}`, JSON.stringify(list));
      } catch (e) {}
    }
  };

  const handleAddExcludedAuthor = (author: string) => {
    const trimmed = author.trim().toLowerCase();
    if (!trimmed || excludedAuthors.some((a) => a.toLowerCase() === trimmed)) return;
    const next = [...excludedAuthors, trimmed];
    handleSaveExcludedAuthors(next);
    setNewAuthorInput("");
  };

  const handleRemoveExcludedAuthor = (index: number) => {
    const next = excludedAuthors.filter((_, i) => i !== index);
    handleSaveExcludedAuthors(next);
  };

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

  // 1. Extract package sessions from packageRows (Таблица 4 / Покупка пакетов)
  const packageSessions = useMemo(() => {
    return extractPackageSessions(packageRows || []);
  }, [packageRows]);

  // 2. Map of guest favorite seats from active snapshot profiles
  const guestSeatsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (activeSnapshot?.guests_data) {
      for (const g of activeSnapshot.guests_data) {
        const norm = (g.phone || "").replace(/\D/g, "").slice(-10);
        if (norm && g.favoriteSeat && g.favoriteSeat !== "—") {
          map.set(norm, g.favoriteSeat);
        }
      }
    }
    return map;
  }, [activeSnapshot]);

  // 3. Match operations with employee shifts, then match with PC sessions & comments
  const fullyMatchedOperations: BonusOperation[] = useMemo(() => {
    const shiftMatched = matchOperationsWithShifts(rawOperations, shifts);
    return matchOperationsWithPC(shiftMatched, packageSessions, guestSeatsMap);
  }, [rawOperations, shifts, packageSessions, guestSeatsMap]);

  // Distinct authors found in log for suggestion pills
  const availableAuthors = useMemo(() => {
    const set = new Set<string>();
    for (const op of fullyMatchedOperations) {
      if (op.rawAuthor && op.rawAuthor.trim()) set.add(op.rawAuthor.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [fullyMatchedOperations]);

  // Filter out operations matching excluded authors (e.g. uprav, менеджер)
  const { operationsAfterAuthorExclusion, excludedOperationsCount, excludedOperationsSum } = useMemo(() => {
    if (!isExclusionActive || excludedAuthors.length === 0) {
      return {
        operationsAfterAuthorExclusion: fullyMatchedOperations,
        excludedOperationsCount: 0,
        excludedOperationsSum: 0,
      };
    }

    const lowerExcluded = excludedAuthors.map((a) => a.trim().toLowerCase()).filter(Boolean);

    let count = 0;
    let sum = 0;
    const kept: BonusOperation[] = [];

    for (const op of fullyMatchedOperations) {
      const auth = (op.rawAuthor || "").toLowerCase();
      const isEx = lowerExcluded.some((term) => auth.includes(term));
      if (isEx) {
        count += 1;
        sum += op.amount;
      } else {
        kept.push(op);
      }
    }

    return {
      operationsAfterAuthorExclusion: kept,
      excludedOperationsCount: count,
      excludedOperationsSum: sum,
    };
  }, [fullyMatchedOperations, isExclusionActive, excludedAuthors]);

  // Dataset date bounds & available distinct months
  const { datasetMinDate, datasetMaxDate, availableMonths, datasetMinIso, datasetMaxIso } = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    const monthsMap = new Map<
      string,
      {
        key: string;
        label: string;
        year: number;
        month: number;
        start: Date;
        end: Date;
        count: number;
      }
    >();

    const MONTH_NAMES = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];

    for (const op of operationsAfterAuthorExclusion) {
      if (!op.date) continue;
      const t = op.date.getTime();
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;

      const y = op.date.getFullYear();
      const m = op.date.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      if (!monthsMap.has(key)) {
        const start = new Date(y, m, 1, 0, 0, 0);
        const end = new Date(y, m + 1, 0, 23, 59, 59);
        monthsMap.set(key, {
          key,
          label: `${MONTH_NAMES[m]} ${y}`,
          year: y,
          month: m,
          start,
          end,
          count: 0,
        });
      }
      monthsMap.get(key)!.count += 1;
    }

    const minDate = isFinite(minTime) ? new Date(minTime) : null;
    const maxDate = isFinite(maxTime) ? new Date(maxTime) : null;
    const months = Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key));

    const toIsoDate = (d: Date | null) => {
      if (!d) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    return {
      datasetMinDate: minDate,
      datasetMaxDate: maxDate,
      availableMonths: months,
      datasetMinIso: toIsoDate(minDate),
      datasetMaxIso: toIsoDate(maxDate),
    };
  }, [operationsAfterAuthorExclusion]);

  // Compute active date range based on user's period selection
  const activeDateRange = useMemo<{ start: Date | null; end: Date | null; label: string }>(() => {
    const formatDate = (d: Date | null) => {
      if (!d) return "—";
      return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
    };

    if (periodMode === "month" && selectedMonthKey) {
      const found = availableMonths.find((m) => m.key === selectedMonthKey);
      if (found) {
        return {
          start: found.start,
          end: found.end,
          label: found.label,
        };
      }
    }

    if (periodMode === "7d" && datasetMaxDate) {
      const end = new Date(datasetMaxDate);
      const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
      return {
        start,
        end,
        label: `Последние 7 дней (${formatDate(start)} — ${formatDate(end)})`,
      };
    }

    if (periodMode === "30d" && datasetMaxDate) {
      const end = new Date(datasetMaxDate);
      const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
      return {
        start,
        end,
        label: `Последние 30 дней (${formatDate(start)} — ${formatDate(end)})`,
      };
    }

    if (periodMode === "custom" && customStartDate && customEndDate) {
      const s = new Date(customStartDate + "T00:00:00");
      const e = new Date(customEndDate + "T23:59:59");
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        return {
          start: s,
          end: e,
          label: `${formatDate(s)} — ${formatDate(e)}`,
        };
      }
    }

    // If parent dateFilter is present and user is in default mode
    if (periodMode === "all" && dateFilter && (dateFilter.startDate || dateFilter.endDate)) {
      return {
        start: dateFilter.startDate || datasetMinDate,
        end: dateFilter.endDate || datasetMaxDate,
        label: `Фильтр страницы (${formatDate(dateFilter.startDate)} — ${formatDate(dateFilter.endDate)})`,
      };
    }

    return {
      start: datasetMinDate,
      end: datasetMaxDate,
      label:
        datasetMinDate && datasetMaxDate
          ? `${formatDate(datasetMinDate)} — ${formatDate(datasetMaxDate)}`
          : "Весь период",
    };
  }, [
    periodMode,
    selectedMonthKey,
    availableMonths,
    datasetMaxDate,
    datasetMinDate,
    customStartDate,
    customEndDate,
    dateFilter,
  ]);

  const isPeriodFiltered =
    periodMode !== "all" || Boolean(dateFilter?.startDate || dateFilter?.endDate);

  // Apply active date filter to operations
  const dateFilteredOperations: BonusOperation[] = useMemo(() => {
    if (periodMode === "all" && !dateFilter?.startDate && !dateFilter?.endDate) {
      return operationsAfterAuthorExclusion;
    }

    const start = activeDateRange.start ? activeDateRange.start.getTime() : 0;
    const end = activeDateRange.end ? activeDateRange.end.getTime() : Infinity;

    return operationsAfterAuthorExclusion.filter((op) => {
      if (!op.date) return true;
      const t = op.date.getTime();
      return t >= start && t <= end;
    });
  }, [operationsAfterAuthorExclusion, activeDateRange, periodMode, dateFilter]);

  // Unique employees list for dropdown filter
  const employeeList = useMemo(() => {
    const set = new Set<string>();
    for (const op of dateFilteredOperations) {
      if (op.matchedEmployeeName) set.add(op.matchedEmployeeName);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [dateFilteredOperations]);

  // Unique matched PCs list for dropdown filter
  const distinctPcs = useMemo(() => {
    const set = new Set<string>();
    for (const op of dateFilteredOperations) {
      if (op.matchedPC) set.add(op.matchedPC);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
  }, [dateFilteredOperations]);

  // Top PCs with technical issue compensations
  const topCompensatedPcs = useMemo(() => {
    const map = new Map<string, { pc: string; count: number; sum: number }>();
    for (const op of dateFilteredOperations) {
      if (!op.matchedPC) continue;
      if (
        op.category === "tech_issue" ||
        op.comment.toLowerCase().includes("вылет") ||
        op.comment.toLowerCase().includes("краш") ||
        op.comment.toLowerCase().includes("завис")
      ) {
        const cur = map.get(op.matchedPC) || { pc: op.matchedPC, count: 0, sum: 0 };
        cur.count += 1;
        cur.sum += op.amount;
        map.set(op.matchedPC, cur);
      }
    }
    return Array.from(map.values())
      .filter((x) => x.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
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
    const matchedPcCount = dateFilteredOperations.filter((o) => Boolean(o.matchedPC)).length;
    const pcMatchRate = totalCount > 0 ? Math.round((matchedPcCount / totalCount) * 100) : 0;

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
      matchedPcCount,
      pcMatchRate,
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

  // Employee shift summary table (including raw author names from SmartShell export)
  const employeeSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        rawAuthors: Set<string>;
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
        rawAuthors: new Set<string>(),
        count: 0,
        sum: 0,
        noCommentCount: 0,
        anomaliesCount: 0,
        criticalCount: 0,
        isOffShift,
        isApi,
      };

      if (op.rawAuthor) {
        entry.rawAuthors.add(op.rawAuthor);
      }
      entry.count += 1;
      entry.sum += op.amount;
      if (op.category === "no_comment") entry.noCommentCount += 1;
      if (op.riskLevel === "warning" || op.riskLevel === "critical") entry.anomaliesCount += 1;
      if (op.riskLevel === "critical") entry.criticalCount += 1;

      map.set(name, entry);
    }

    return Array.from(map.values()).sort((a, b) => b.sum - a.sum);
  }, [dateFilteredOperations]);

  // Anomalous guests calculation
  const anomalousGuests: AnomalousGuest[] = useMemo(() => {
    const map = new Map<
      string,
      {
        phone: string;
        guestName: string;
        totalBonus: number;
        opCount: number;
        noCommentCount: number;
        noCommentSum: number;
        criticalCount: number;
        warningCount: number;
        offShiftCount: number;
        admins: Set<string>;
        rawAuthors: Set<string>;
        pcs: Set<string>;
        lastDate: Date | null;
        lastDateStr: string;
      }
    >();

    for (const op of dateFilteredOperations) {
      const phoneKey = op.phone || "no_phone";
      let entry = map.get(phoneKey);
      if (!entry) {
        entry = {
          phone: op.phone,
          guestName: op.guestName && op.guestName !== "Гость" ? op.guestName : "",
          totalBonus: 0,
          opCount: 0,
          noCommentCount: 0,
          noCommentSum: 0,
          criticalCount: 0,
          warningCount: 0,
          offShiftCount: 0,
          admins: new Set<string>(),
          rawAuthors: new Set<string>(),
          pcs: new Set<string>(),
          lastDate: null,
          lastDateStr: op.dateStr || "—",
        };
        map.set(phoneKey, entry);
      }

      if (!entry.guestName && op.guestName && op.guestName !== "Гость") {
        entry.guestName = op.guestName;
      }

      entry.totalBonus += op.amount;
      entry.opCount += 1;

      if (op.category === "no_comment") {
        entry.noCommentCount += 1;
        entry.noCommentSum += op.amount;
      }

      if (op.riskLevel === "critical") entry.criticalCount += 1;
      if (op.riskLevel === "warning") entry.warningCount += 1;
      if (op.isOffShift) entry.offShiftCount += 1;

      if (op.matchedEmployeeName) entry.admins.add(op.matchedEmployeeName);
      if (op.rawAuthor) entry.rawAuthors.add(op.rawAuthor);
      if (op.matchedPC) entry.pcs.add(op.matchedPC);

      if (op.date && (!entry.lastDate || op.date.getTime() > entry.lastDate.getTime())) {
        entry.lastDate = op.date;
        entry.lastDateStr = op.dateStr;
      }
    }

    const list: AnomalousGuest[] = [];

    for (const g of map.values()) {
      const reasons: string[] = [];

      if (g.criticalCount > 0) {
        reasons.push(`Критический риск (${g.criticalCount} оп.)`);
      }
      if (g.opCount >= 3) {
        reasons.push(`Серийные начисления (${g.opCount} раз)`);
      }
      if (g.noCommentCount >= 1 && (g.noCommentSum >= 200 || g.noCommentCount >= 2)) {
        reasons.push(`Без комментария (${g.noCommentCount} раз на ${g.noCommentSum.toLocaleString("ru")} Б)`);
      }
      if (g.totalBonus >= 1000) {
        reasons.push(`Крупная сумма бонусов (${g.totalBonus.toLocaleString("ru")} Б)`);
      }
      if (g.offShiftCount >= 1) {
        reasons.push(`Вне смены сотрудника (${g.offShiftCount} раз)`);
      }
      if (g.admins.size >= 3) {
        reasons.push(`Начисления от ${g.admins.size} разных сотрудников`);
      }

      if (reasons.length > 0) {
        list.push({
          phone: g.phone,
          guestName: g.guestName || "Гость",
          totalBonus: g.totalBonus,
          opCount: g.opCount,
          noCommentCount: g.noCommentCount,
          noCommentRate: g.opCount > 0 ? Math.round((g.noCommentCount / g.opCount) * 100) : 0,
          criticalCount: g.criticalCount,
          warningCount: g.warningCount,
          offShiftCount: g.offShiftCount,
          reasons,
          admins: Array.from(g.admins).filter(Boolean),
          rawAuthors: Array.from(g.rawAuthors).filter(Boolean),
          pcs: Array.from(g.pcs).filter(Boolean),
          lastDateStr: g.lastDateStr,
        });
      }
    }

    return list.sort((a, b) => {
      if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
      if (b.warningCount !== a.warningCount) return b.warningCount - a.warningCount;
      return b.totalBonus - a.totalBonus;
    });
  }, [dateFilteredOperations]);

  // Filtered & sorted operations for the audit table
  const filteredOperations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return dateFilteredOperations
      .filter((op) => {
        // Search query: checks phone, guest name, comment, employee on shift, raw author, AND matched PC!
        if (q) {
          const matchPhone = op.phone.includes(q);
          const matchGuest = op.guestName.toLowerCase().includes(q);
          const matchComment = op.comment.toLowerCase().includes(q);
          const matchAuthor = (op.matchedEmployeeName || "").toLowerCase().includes(q);
          const matchRawAuthor = (op.rawAuthor || "").toLowerCase().includes(q);
          const matchPC = (op.matchedPC || "").toLowerCase().includes(q);
          const matchCategory = op.categoryLabel.toLowerCase().includes(q);
          if (
            !matchPhone &&
            !matchGuest &&
            !matchComment &&
            !matchAuthor &&
            !matchRawAuthor &&
            !matchPC &&
            !matchCategory
          ) {
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

        // PC filter
        if (selectedPc !== "all" && op.matchedPC !== selectedPc) {
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
    selectedPc,
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
    selectedPc,
    selectedRisk,
    selectedShiftStatus,
    sortBy,
    pageSize,
    periodMode,
    selectedMonthKey,
    customStartDate,
    customEndDate,
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

  const handleResetPeriod = () => {
    setPeriodMode("all");
    setSelectedMonthKey(null);
    setCustomStartDate("");
    setCustomEndDate("");
  };

  // Export to CSV with matched employee, log author, AND matched PC
  const handleExportCSV = () => {
    if (filteredOperations.length === 0) return;
    const header = [
      "Дата и время",
      "Сотрудник (по смене)",
      "Кем сделано (в логе Langame)",
      "Статус смены",
      "Номер ПК / Место",
      "Источник определения ПК",
      "Тариф сессии на ПК",
      "Источник",
      "Клиент",
      "Телефон",
      "Сумма бонусов",
      "Категория",
      "Комментарий / Обоснование",
      "Уровень риска",
      "Причины риска",
    ];

    const rows = filteredOperations.map((op) => [
      op.dateStr,
      `"${(op.matchedEmployeeName || "Вне смены").replace(/"/g, '""')}"`,
      `"${(op.rawAuthor || "—").replace(/"/g, '""')}"`,
      op.isOffShift ? "Вне смены" : "В смену",
      `"${(op.matchedPC || "—").replace(/"/g, '""')}"`,
      `"${(op.matchedPCSource || "—").replace(/"/g, '""')}"`,
      `"${(op.matchedTariffName || "—").replace(/"/g, '""')}"`,
      `"${(op.source || "").replace(/"/g, '""')}"`,
      `"${op.guestName.replace(/"/g, '""')}"`,
      op.phone,
      op.amount,
      `"${op.categoryLabel.replace(/"/g, '""')}"`,
      `"${(op.comment || "").replace(/"/g, '""')}"`,
      op.riskLevel,
      `"${(op.riskReasons || []).join("; ").replace(/"/g, '""')}"`,
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

  // Export anomalous guests to CSV
  const handleExportAnomalousGuestsCSV = () => {
    if (anomalousGuests.length === 0) return;

    const headers = [
      "Телефон",
      "ФИО гостя",
      "Всего бонусов (Б)",
      "Кол-во операций",
      "Без комментария",
      "% без комментария",
      "Критических",
      "Предупреждений",
      "Вне смены",
      "Признаки аномалии",
      "Сотрудники",
      "Кем сделано в логе",
      "ПК / Места",
      "Последняя операция",
    ];

    const escapeCsv = (val: string | number | undefined) => {
      const s = String(val ?? "");
      if (s.includes(";") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = anomalousGuests.map((g) => [
      escapeCsv(g.phone),
      escapeCsv(g.guestName),
      g.totalBonus,
      g.opCount,
      g.noCommentCount,
      `${g.noCommentRate}%`,
      g.criticalCount,
      g.warningCount,
      g.offShiftCount,
      escapeCsv(g.reasons.join(" | ")),
      escapeCsv(g.admins.join(", ")),
      escapeCsv(g.rawAuthors.join(", ")),
      escapeCsv(g.pcs.join(", ")),
      escapeCsv(g.lastDateStr),
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `anomalous_guests_${clubId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedCategory !== "all" ||
    selectedEmployee !== "all" ||
    selectedPc !== "all" ||
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
            Контроль обоснований, сверка с реальными сменами сотрудников, номерами ПК и поиск аномалий
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
            <span>Langame: Работа с гостями → Лог ручных начислений/списаний</span>
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
            Сверка начислений со сменами администраторов, номерами ПК, разбор комментариев и выявление злоупотреблений
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
            onClick={() => setShowExclusionSettings(!showExclusionSettings)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium shadow-xs cursor-pointer transition-all",
              isExclusionActive && excludedAuthors.length > 0
                ? "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
            title="Настройка исключений по полю «Кем сделано» (uprav, менеджер и др.)"
          >
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            <span>Исключения («Кем сделано»)</span>
            {excludedAuthors.length > 0 && (
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono",
                  isExclusionActive
                    ? "bg-amber-200 text-amber-900"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {excludedAuthors.length}
              </span>
            )}
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

      {/* Exclusion Settings Panel */}
      {showExclusionSettings && (
        <div className="bg-gradient-to-r from-amber-50/90 to-orange-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-700" />
                <h3 className="text-sm font-bold text-amber-950">
                  Настройка исключений по автору («Кем сделано»)
                </h3>
              </div>
              <p className="text-xs text-amber-800/80 mt-0.5">
                Системные учетные записи (например, uprav, менеджер, api) не будут искажать статистику смен администраторов и расчет аномалий.
              </p>
            </div>

            {/* Toggle Active Switch */}
            <label className="flex items-center gap-2 cursor-pointer select-none self-start sm:self-auto bg-white/80 border border-amber-200 px-3 py-1.5 rounded-xl shadow-2xs">
              <input
                type="checkbox"
                checked={isExclusionActive}
                onChange={(e) => setIsExclusionActive(e.target.checked)}
                className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-amber-950">
                {isExclusionActive ? "Фильтр активен" : "Фильтр отключен"}
              </span>
            </label>
          </div>

          {/* Active excluded authors pills */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-amber-900 flex items-center justify-between">
              <span>Исключаемые ключевые слова ({excludedAuthors.length}):</span>
              {isExclusionActive && excludedOperationsCount > 0 && (
                <span className="text-[11px] font-normal text-amber-800">
                  Исключено сейчас: <b className="font-semibold">{excludedOperationsCount}</b> начислений на{" "}
                  <b className="font-semibold font-mono">{excludedOperationsSum.toLocaleString("ru")} Б</b>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {excludedAuthors.length === 0 ? (
                <span className="text-xs text-amber-700/60 italic">Список пуст. Все начисления учитываются.</span>
              ) : (
                excludedAuthors.map((author, idx) => (
                  <span
                    key={author + idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-medium shadow-2xs"
                  >
                    <span>{author}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExcludedAuthor(idx)}
                      className="text-amber-500 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors"
                      title="Удалить из исключений"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Add new exclusion input + Suggestions */}
          <div className="pt-2 border-t border-amber-200/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Input form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newAuthorInput.trim()) {
                  handleAddExcludedAuthor(newAuthorInput);
                }
              }}
              className="flex items-center gap-2 max-w-sm"
            >
              <input
                type="text"
                value={newAuthorInput}
                onChange={(e) => setNewAuthorInput(e.target.value)}
                placeholder="Добавить слово (напр. uprav)..."
                className="bg-white border border-amber-300 text-amber-950 placeholder:text-amber-700/50 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <button
                type="submit"
                disabled={!newAuthorInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-40 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
              >
                Добавить
              </button>
            </form>

            {/* Suggestions from log */}
            {availableAuthors.filter((a) => !excludedAuthors.some((ex) => ex.toLowerCase() === a.toLowerCase())).length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-[11px] text-amber-800/80">Найдено в логе:</span>
                {availableAuthors
                  .filter((a) => !excludedAuthors.some((ex) => ex.toLowerCase() === a.toLowerCase()))
                  .slice(0, 6)
                  .map((author) => (
                    <button
                      key={author}
                      type="button"
                      onClick={() => handleAddExcludedAuthor(author)}
                      className="px-2 py-0.5 rounded-lg bg-amber-100/80 hover:bg-amber-200/80 text-amber-900 border border-amber-200 text-[11px] font-mono transition-colors cursor-pointer"
                      title="Нажмите, чтобы добавить в исключения"
                    >
                      + {author}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Period & Date Range Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-violet-50 text-violet-600 border border-violet-100">
              <Calendar className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-slate-900">Период аудита:</span>
            <span className="text-xs text-slate-700 font-medium bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              {activeDateRange.label}
            </span>
            <span className="text-[11px] text-slate-400">
              ({dateFilteredOperations.length} начислений на {kpis.totalSum.toLocaleString("ru")} Б)
            </span>

            {isPeriodFiltered && (
              <button
                type="button"
                onClick={handleResetPeriod}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                title="Сбросить на полный период выгрузки"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Весь период</span>
              </button>
            )}
          </div>

          {/* Quick presets (7d, 30d) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPeriodMode("7d");
                setSelectedMonthKey(null);
              }}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer",
                periodMode === "7d"
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              7 дней
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodMode("30d");
                setSelectedMonthKey(null);
              }}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer",
                periodMode === "30d"
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              30 дней
            </button>
          </div>
        </div>

        {/* Months Bar & Custom Date Inputs */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Quick month pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Месяцы:</span>
            <button
              type="button"
              onClick={handleResetPeriod}
              className={cn(
                "text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer border",
                periodMode === "all"
                  ? "bg-violet-600 text-white border-violet-600 font-semibold shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              )}
            >
              Все
            </button>
            {availableMonths.map((m) => {
              const isSelected = periodMode === "month" && selectedMonthKey === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setPeriodMode("month");
                    setSelectedMonthKey(m.key);
                  }}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer border flex items-center gap-1.5",
                    isSelected
                      ? "bg-violet-600 text-white border-violet-600 font-semibold shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <span>{m.label}</span>
                  <span
                    className={cn(
                      "text-[10px] font-mono px-1 rounded",
                      isSelected ? "bg-violet-700 text-violet-100" : "bg-slate-200 text-slate-600"
                    )}
                  >
                    {m.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom Date Inputs */}
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="text-[11px] text-slate-400">Диапазон:</span>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
              <span className="text-[11px] text-slate-400">С</span>
              <input
                type="date"
                value={customStartDate}
                min={datasetMinIso}
                max={datasetMaxIso}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent text-slate-800 text-xs outline-none cursor-pointer"
              />
              <span className="text-[11px] text-slate-400">По</span>
              <input
                type="date"
                value={customEndDate}
                min={customStartDate || datasetMinIso}
                max={datasetMaxIso}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent text-slate-800 text-xs outline-none cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  if (customStartDate && customEndDate) {
                    setPeriodMode("custom");
                    setSelectedMonthKey(null);
                  }
                }}
                disabled={!customStartDate || !customEndDate}
                className="ml-1 px-2.5 py-0.5 rounded bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-medium text-[11px] transition-colors cursor-pointer"
              >
                ОК
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hardware / Problematic PCs Tip (if multiple compensations found on specific PCs) */}
      {topCompensatedPcs.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 sm:p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold text-amber-900">
              Выявлены ПК с частыми компенсациями за сбои / краши:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {topCompensatedPcs.map((item) => (
                <button
                  key={item.pc}
                  type="button"
                  onClick={() => setSelectedPc(selectedPc === item.pc ? "all" : item.pc)}
                  className={cn(
                    "px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer border",
                    selectedPc === item.pc
                      ? "bg-amber-800 text-white border-amber-800 shadow-xs"
                      : "bg-white text-amber-900 border-amber-300 hover:bg-amber-100"
                  )}
                  title="Нажмите, чтобы отфильтровать операции по этому ПК"
                >
                  {item.pc}: {item.count} раз ({item.sum} Б)
                </button>
              ))}
            </div>
          </div>
          {selectedPc !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedPc("all")}
              className="text-[11px] text-amber-800 hover:text-amber-950 underline self-start sm:self-auto cursor-pointer"
            >
              Сбросить фильтр ПК
            </button>
          )}
        </div>
      )}

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

        {/* Card 4: Привязка к сменам и ПК */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Сверка со сменами и ПК</span>
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
              {shifts.length} смен
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-baseline gap-2">
            <span>{kpis.shiftMatchRate}%</span>
            <span className="text-xs font-normal text-slate-500">сменных</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span className="text-emerald-700 font-medium">
              {kpis.inShiftCount} в смену
            </span>
            <span className="text-slate-600 font-medium">
              {kpis.matchedPcCount} с ПК ({kpis.pcMatchRate}%)
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

      {/* Staff & Shifts Summary OR Anomalous Guests Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSummarySubTab("shifts")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border",
                summarySubTab === "shifts"
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Сводка по смене ({employeeSummaries.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSummarySubTab("guests")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border",
                summarySubTab === "guests"
                  ? "bg-rose-900 text-white border-rose-900 shadow-xs"
                  : anomalousGuests.length > 0
                  ? "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Аномальные гости ({anomalousGuests.length})</span>
              {anomalousGuests.filter((g) => g.criticalCount > 0).length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              )}
            </button>
          </div>

          {summarySubTab === "shifts" ? (
            selectedEmployee !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedEmployee("all")}
                className="text-xs font-medium text-violet-600 hover:text-violet-800 self-start md:self-auto cursor-pointer"
              >
                Сбросить фильтр сотрудника ({selectedEmployee})
              </button>
            )
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportAnomalousGuestsCSV}
                disabled={anomalousGuests.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs cursor-pointer transition-all disabled:opacity-40"
                title="Скачать список аномальных гостей в формате CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Экспорт аномальных гостей (.csv)</span>
              </button>
            </div>
          )}
        </div>

        {summarySubTab === "shifts" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold tracking-wider text-[11px]">
                  <th className="py-2.5 px-4 min-w-[170px]">Сотрудник на смене</th>
                  <th className="py-2.5 px-4 min-w-[190px]">Кем сделано в логе (Langame)</th>
                  <th className="py-2.5 px-4 min-w-[90px] text-right">Начислений</th>
                  <th className="py-2.5 px-4 min-w-[110px] text-right">Сумма бонусов</th>
                  <th className="py-2.5 px-4 min-w-[125px] text-center">Без комментария</th>
                  <th className="py-2.5 px-4 min-w-[95px] text-center">Аномалии</th>
                  <th className="py-2.5 px-4 min-w-[100px] text-right">Средний чек</th>
                  <th className="py-2.5 px-4 min-w-[100px] text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {employeeSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Нет данных по сотрудникам за выбранный период.
                    </td>
                  </tr>
                ) : (
                  employeeSummaries.map((emp) => {
                    const isSelected = selectedEmployee === emp.name;
                    const avg = emp.count > 0 ? Math.round(emp.sum / emp.count) : 0;
                    const noCommentRate = emp.count > 0 ? Math.round((emp.noCommentCount / emp.count) * 100) : 0;
                    const rawAuthorsStr = Array.from(emp.rawAuthors).filter(Boolean).join(", ") || "—";

                    return (
                      <tr
                        key={emp.name}
                        className={cn(
                          "hover:bg-slate-50/70 transition-colors",
                          isSelected && "bg-violet-50/50"
                        )}
                      >
                        {/* Сотрудник на смене */}
                        <td className="py-3 px-4 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            {emp.isApi ? (
                              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            ) : emp.isOffShift ? (
                              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            )}
                            <span className="font-semibold">{emp.name}</span>
                          </div>
                          {emp.isOffShift && (
                            <div className="mt-0.5">
                              <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">
                                вне открытой смены
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Кем сделано в логе */}
                        <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                          <span className="text-slate-800 font-medium">{rawAuthorsStr}</span>
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold tracking-wider text-[11px]">
                  <th className="py-2.5 px-4 w-10 text-slate-400">№</th>
                  <th className="py-2.5 px-4 min-w-[170px]">Гость (ФИО / Телефон)</th>
                  <th className="py-2.5 px-4 min-w-[120px] text-right">Всего начислено</th>
                  <th className="py-2.5 px-4 min-w-[130px] text-center">Без комментария</th>
                  <th className="py-2.5 px-4 min-w-[240px]">Выявленные признаки</th>
                  <th className="py-2.5 px-4 min-w-[180px]">Кто начислял</th>
                  <th className="py-2.5 px-4 min-w-[120px]">ПК / Места</th>
                  <th className="py-2.5 px-4 min-w-[110px] text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {anomalousGuests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Подозрительных начислений и серийных аномалий среди гостей не обнаружено.
                    </td>
                  </tr>
                ) : (
                  anomalousGuests.map((guest, idx) => {
                    const formattedPhone = guest.phone
                      ? `+7 (${guest.phone.slice(0, 3)}) ${guest.phone.slice(3, 6)}-${guest.phone.slice(6, 8)}-${guest.phone.slice(8, 10)}`
                      : "—";
                    const isCopied = copiedKey === `guest_${guest.phone}`;

                    return (
                      <tr
                        key={guest.phone || idx}
                        className={cn(
                          "hover:bg-slate-50/70 transition-colors",
                          guest.criticalCount > 0 && "bg-rose-50/25"
                        )}
                      >
                        {/* № */}
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px] align-top">
                          {idx + 1}
                        </td>

                        {/* Гость */}
                        <td className="py-3 px-4 align-top">
                          <div className="font-bold text-slate-900 text-xs">
                            {guest.guestName || "Гость"}
                          </div>
                          {guest.phone && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] text-slate-600 font-medium">
                                {formattedPhone}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(guest.phone, `guest_${guest.phone}`)}
                                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-colors"
                                title="Скопировать номер телефона"
                              >
                                {isCopied ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                          {guest.lastDateStr && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Посл: {guest.lastDateStr}
                            </div>
                          )}
                        </td>

                        {/* Всего начислено */}
                        <td className="py-3 px-4 align-top text-right">
                          <div className="font-mono font-bold text-slate-900 text-sm">
                            {guest.totalBonus.toLocaleString("ru")} <span className="text-[11px] font-medium text-slate-500">Б</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {guest.opCount} начислений
                          </div>
                        </td>

                        {/* Без комментария */}
                        <td className="py-3 px-4 align-top text-center">
                          {guest.noCommentCount > 0 ? (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums inline-block",
                                guest.noCommentRate >= 30
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              )}
                            >
                              {guest.noCommentCount} из {guest.opCount} ({guest.noCommentRate}%)
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium text-[11px]">Все с комментарием</span>
                          )}
                        </td>

                        {/* Выявленные признаки */}
                        <td className="py-3 px-4 align-top">
                          <div className="flex flex-wrap gap-1">
                            {guest.reasons.map((r, i) => {
                              const isCrit = r.includes("Критический") || r.includes("Без комментария");
                              return (
                                <span
                                  key={i}
                                  className={cn(
                                    "text-[10px] font-medium px-2 py-0.5 rounded-md border",
                                    isCrit
                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : "bg-amber-50 text-amber-800 border-amber-200"
                                  )}
                                >
                                  {r}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Кто начислял */}
                        <td className="py-3 px-4 align-top">
                          <div className="space-y-1">
                            {guest.admins.length > 0 && (
                              <div className="text-xs font-semibold text-slate-800">
                                {guest.admins.join(", ")}
                              </div>
                            )}
                            {guest.rawAuthors.length > 0 && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                В логе: {guest.rawAuthors.join(", ")}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* ПК / Места */}
                        <td className="py-3 px-4 align-top">
                          {guest.pcs.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {guest.pcs.map((pc) => (
                                <span
                                  key={pc}
                                  className="font-mono text-[11px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-800 border border-slate-200"
                                >
                                  {pc}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* Действие */}
                        <td className="py-3 px-4 align-top text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery(guest.phone || guest.guestName);
                              tableRef.current?.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 font-medium text-xs border border-violet-200 transition-colors cursor-pointer"
                            title="Отфильтровать журнал по операциям этого гостя"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Все операции</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Main Operations Audit Table */}
      <div ref={tableRef} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
        {/* Controls row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по клиенту, телефону, ПК, комментарию, смене или автору лога…"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
          </div>

          {/* Filters & Sorters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* PC filter */}
            <select
              value={selectedPc}
              onChange={(e) => setSelectedPc(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none cursor-pointer max-w-[130px]"
            >
              <option value="all">Все ПК ({distinctPcs.length})</option>
              {distinctPcs.map((pc) => (
                <option key={pc} value={pc}>
                  {pc}
                </option>
              ))}
            </select>

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
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none cursor-pointer max-w-[150px]"
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
              <option value="all">Все смены</option>
              <option value="in_shift">В смену</option>
              <option value="off_shift">Вне смены</option>
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
                  setSelectedPc("all");
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
                <th className="py-2.5 px-3 min-w-[190px]">Сотрудник / В логе</th>
                <th className="py-2.5 px-3 min-w-[130px]">ПК / Место</th>
                <th className="py-2.5 px-3 min-w-[140px]">Клиент</th>
                <th className="py-2.5 px-3 min-w-[85px] text-right">Сумма</th>
                <th className="py-2.5 px-3 min-w-[135px]">Категория</th>
                <th className="py-2.5 px-3 min-w-[220px]">Комментарий / Обоснование</th>
                <th className="py-2.5 px-3 min-w-[135px]">Контроль / Риск</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {paginatedOperations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
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

                      {/* Employee / Shift info + Raw Author from SmartShell log */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-semibold text-slate-900 leading-tight">
                          {op.matchedEmployeeName || "Вне смены"}
                        </div>
                        {op.rawAuthor && (
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                            В логе: <span className="text-slate-800 font-medium">{op.rawAuthor}</span>
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {op.isOffShift ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              <UserX className="w-3 h-3" />
                              <span>Вне смены</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <UserCheck className="w-3 h-3" />
                              <span>{op.matchedShiftType || "Смена"}</span>
                            </span>
                          )}
                          {op.source && (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                              {op.source}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Matched PC / Seat */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        {op.matchedPC ? (
                          <div>
                            <div className="font-mono font-bold text-slate-900 text-xs flex items-center gap-1">
                              <Monitor className="w-3.5 h-3.5 text-slate-400" />
                              <span>{op.matchedPC}</span>
                            </div>
                            <div className="mt-0.5">
                              {op.matchedPCSource === "session_exact" && (
                                <span
                                  className="inline-flex items-center text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200"
                                  title={op.matchedTariffName ? `Тариф: ${op.matchedTariffName}` : ""}
                                >
                                  Сессия {op.matchedTariffName ? `(${op.matchedTariffName})` : ""}
                                </span>
                              )}
                              {op.matchedPCSource === "session_day" && (
                                <span className="inline-flex items-center text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                  В этот день
                                </span>
                              )}
                              {op.matchedPCSource === "comment" && (
                                <span className="inline-flex items-center text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                  Из комментария
                                </span>
                              )}
                              {op.matchedPCSource === "favorite" && (
                                <span className="inline-flex items-center text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.2 rounded">
                                  Любимый ПК
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Guest name & phone with copy */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-semibold text-slate-900 truncate max-w-[140px]" title={op.guestName}>
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
