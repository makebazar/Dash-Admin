"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { UploadTab } from "./_components/UploadTab";
import { AnalyticsTab } from "./_components/AnalyticsTab";
import { HardwareTab } from "./_components/HardwareTab";
import { RetentionTab } from "./_components/RetentionTab";
import { TasksTab } from "./_components/TasksTab";
import { SettingsTab } from "./_components/SettingsTab";
import { SmsTab } from "./_components/SmsTab";
import { VkTab } from "./_components/VkTab";
import { AttributionTab } from "./_components/AttributionTab";
import { cn } from "@/lib/utils";
import { 
  FolderArchive, 
  BarChart3, 
  Monitor, 
  Users, 
  Database,
  Calendar,
  Sparkles,
  CheckSquare,
  MessageSquare,
  Share2,
  Settings,
  TrendingUp
} from "lucide-react";
import { buildClubAnalytics, type ClubAnalytics, type WorkstationInfo, type ClientProfile, type DateFilter, type ClubPcStat } from "./_components/segmentation";
import { detectPeriod } from "./_components/periodDetection";
import type { SnapshotFull } from "./_components/types";

const TABS = [
  { id: "analytics", label: "Гости и Персоны", icon: BarChart3 },
  { id: "tasks", label: "Задачи смене", icon: CheckSquare },
  { id: "sms", label: "SMS-рассылки", icon: MessageSquare },
  { id: "vk", label: "VK Реклама", icon: Share2 },
  { id: "attribution", label: "Сквозная аналитика", icon: TrendingUp },
  { id: "hardware", label: "Зоны и Железо", icon: Monitor },
  { id: "retention", label: "Удержание", icon: Users },
  { id: "settings", label: "Исключения", icon: Settings },
  { id: "upload", label: "Срезы и Загрузка", icon: FolderArchive },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function MarketingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const clubId = (params?.clubId as string) || "1";

  const tabParam = searchParams.get("tab") as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(tabParam ?? "upload");

  // Active saved snapshot (if loaded from history)
  const [activeSnapshot, setActiveSnapshot] = useState<SnapshotFull | null>(null);

  // Active date filter (selected month or custom date range)
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);

  // Raw file rows uploaded in session
  const [guestRows, setGuestRows] = useState<Record<string, unknown>[] | null>(null);
  const [guestFileName, setGuestFileName] = useState<string | null>(null);

  const [txRows, setTxRows] = useState<Record<string, unknown>[] | null>(null);
  const [txFileName, setTxFileName] = useState<string | null>(null);

  const [summaryRows, setSummaryRows] = useState<Record<string, unknown>[] | null>(null);
  const [summaryFileName, setSummaryFileName] = useState<string | null>(null);

  const [packageRows, setPackageRows] = useState<Record<string, unknown>[] | null>(null);
  const [packageFileName, setPackageFileName] = useState<string | null>(null);

  // Workstations from equipment module for zone mapping
  const [workstations, setWorkstations] = useState<WorkstationInfo[]>([]);

  // Excluded phones blacklist
  const [excludedPhones, setExcludedPhones] = useState<string[]>([]);

  // Load excluded phones from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`marketing_excluded_phones_${clubId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setExcludedPhones(parsed);
        }
      } catch (err) {
        console.warn("Failed to load excluded phones:", err);
      }
    }
  }, [clubId]);

  const handleSaveExcludedPhones = (phones: string[]) => {
    setExcludedPhones(phones);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`marketing_excluded_phones_${clubId}`, JSON.stringify(phones));
      } catch (e) {
        console.warn("Failed to save excluded phones:", e);
      }
    }
  };

  useEffect(() => {
    if (!clubId) return;
    fetch(`/api/clubs/${clubId}/workstations`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWorkstations(data.map((w: any) => ({ name: w.name, zone: w.zone })));
        }
      })
      .catch((err) => {
        console.warn("Could not fetch workstations for zone mapping:", err);
      });
  }, [clubId]);

  // Auto-load latest snapshot on mount if no files and no snapshot loaded
  useEffect(() => {
    if (guestRows || txRows || summaryRows || packageRows || activeSnapshot) return;

    let isMounted = true;
    fetch(`/api/clubs/${clubId}/marketing/snapshots`)
      .then((res) => (res.ok ? res.json() : []))
      .then(async (snapshots: any[]) => {
        if (!isMounted || !Array.isArray(snapshots) || snapshots.length === 0) return;
        const latest = snapshots[0];
        const detailRes = await fetch(`/api/clubs/${clubId}/marketing/snapshots/${latest.id}`);
        if (!isMounted || !detailRes.ok) return;
        const fullSnapshot = await detailRes.json();
        if (!isMounted) return;
        setActiveSnapshot(fullSnapshot);
        if (!tabParam) {
          setActiveTab("analytics");
        }
      })
      .catch((err) => {
        console.warn("Auto-load snapshot error:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [clubId]);

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    const p = new URLSearchParams(window.location.search);
    p.set("tab", id);
    router.replace(`?${p.toString()}`);
  };

  // Build unified analytics automatically: from raw files OR from active snapshot
  const analytics: ClubAnalytics | null = useMemo(() => {
    // If raw files are uploaded, prioritize them
    if (guestRows || txRows || summaryRows || packageRows) {
      const built = buildClubAnalytics(
        guestRows || [],
        txRows || [],
        summaryRows || [],
        packageRows || [],
        workstations,
        dateFilter
      );
      if (built && excludedPhones.length > 0) {
        built.profiles = built.profiles.filter((p) => {
          const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
          return !excludedPhones.includes(norm);
        });
        built.whales = built.whales.filter((p) => {
          const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
          return !excludedPhones.includes(norm);
        });
        built.topChurned = built.topChurned.filter((p) => {
          const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
          return !excludedPhones.includes(norm);
        });
        built.atRisk = built.atRisk.filter((p) => {
          const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
          return !excludedPhones.includes(norm);
        });
      }
      return built;
    }

    // Otherwise if a saved snapshot is selected, reconstruct analytics
    if (activeSnapshot) {
      const rawGuests = (activeSnapshot.guests_data || []).filter((p) => {
        if (excludedPhones.length === 0) return true;
        const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
        return !excludedPhones.includes(norm);
      });
      const pc = activeSnapshot.pc_data || [];
      const sm = activeSnapshot.summary_metrics || {};

      const fullDateFrom = activeSnapshot.period_start ? new Date(activeSnapshot.period_start) : null;
      const fullDateTo = activeSnapshot.period_end ? new Date(activeSnapshot.period_end) : null;
      const datasetDateFrom = fullDateFrom;
      const datasetDateTo = fullDateTo;

      const reportDateFrom = dateFilter?.startDate || datasetDateFrom;
      const reportDateTo = dateFilter?.endDate || datasetDateTo;

      const fullDays = (fullDateFrom && fullDateTo && !isNaN(fullDateFrom.getTime()) && !isNaN(fullDateTo.getTime()))
        ? Math.max(1, Math.round((fullDateTo.getTime() - fullDateFrom.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      const reportDays = (reportDateFrom && reportDateTo && !isNaN(reportDateFrom.getTime()) && !isNaN(reportDateTo.getTime()))
        ? Math.max(1, Math.round((reportDateTo.getTime() - reportDateFrom.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      const dStart = dateFilter?.startDate;
      const dEnd = dateFilter?.endDate;
      const filterYm = (dStart && dEnd)
        ? `${dStart.getFullYear()}-${String(dStart.getMonth() + 1).padStart(2, "0")}`
        : null;

      // Check if filter is a full month
      const isMonthFilter = Boolean(filterYm && dStart && dEnd && 
        dStart.getDate() === 1 && 
        (new Date(dStart.getFullYear(), dStart.getMonth() + 1, 0).getDate() === dEnd.getDate()));

      const monthData = (isMonthFilter && sm.monthlyBreakdown && filterYm) ? sm.monthlyBreakdown[filterYm] : null;

      const scaleRatio = monthData
        ? (monthData.rub / (sm.totalPackageRub || sm.totalRevenueInLog || 1))
        : ((dateFilter && fullDays && reportDays) ? Math.min(1, reportDays / fullDays) : 1);

      const whaleThreshold = (dateFilter && fullDays && reportDays)
        ? Math.max(500, Math.round(2000 * scaleRatio))
        : 2000;

      // Scaled PC stats
      const clubPcStats: ClubPcStat[] = pc.map((item) => ({
        ...item,
        rub: Math.round((item.rub || 0) * scaleRatio),
        bonus: Math.round((item.bonus || 0) * scaleRatio),
        sessions: Math.max(0, Math.round((item.sessions || 0) * scaleRatio)),
      }));

      // Reconstruct zone stats from PC stats
      const zoneMap = new Map<string, { rub: number; bonus: number; sessions: number }>();
      let totalRub = 0;
      for (const p of clubPcStats) {
        const existing = zoneMap.get(p.zone) || { rub: 0, bonus: 0, sessions: 0 };
        existing.rub += (p.rub || 0);
        existing.bonus += (p.bonus || 0);
        existing.sessions += (p.sessions || 0);
        zoneMap.set(p.zone, existing);
        totalRub += (p.rub || 0);
      }

      const clubZoneStats = Array.from(zoneMap.entries()).map(([zone, d]) => ({
        zone,
        sessions: d.sessions,
        rub: d.rub,
        bonus: d.bonus,
        percentOfRub: totalRub > 0 ? Math.round((d.rub / totalRub) * 1000) / 10 : 0,
        uniqueGuests: 0,
      }));

      // Enrich profiles with properly computed ratios and categories
      const enrichedProfiles: ClientProfile[] = rawGuests
        .map((p) => {
          const totalSpent = Math.round((p.totalSpent || 0) * scaleRatio);
          const bonusAccrued = Math.round((p.bonusAccrued || 0) * scaleRatio);
          const bonusSpent = Math.round((p.bonusSpent || 0) * scaleRatio);
          const bonusBalance = p.bonusBalance || 0;
          const balance = p.balance || 0;
          const visits = p.visits !== undefined ? Math.max(0, Math.round(p.visits * scaleRatio)) : undefined;
          const playedMinutes = p.playedMinutes !== undefined ? Math.round(p.playedMinutes * scaleRatio) : undefined;
          const playedHours = playedMinutes !== undefined ? Math.round((playedMinutes / 60) * 10) / 10 : undefined;
          const txCount = p.txCount ? Math.max(0, Math.round(p.txCount * scaleRatio)) : (totalSpent > 0 ? 1 : 0);
          const avgTx = txCount > 0 ? Math.round(totalSpent / txCount) : 0;
          const packageSpentRub = p.packageSpentRub !== undefined ? Math.round(p.packageSpentRub * scaleRatio) : undefined;
          const packageSpentBonus = p.packageSpentBonus !== undefined ? Math.round(p.packageSpentBonus * scaleRatio) : undefined;
          const packageCount = p.packageCount !== undefined ? Math.round(p.packageCount * scaleRatio) : undefined;
          const topupAdmin = p.topupAdmin !== undefined ? Math.round(p.topupAdmin * scaleRatio) : undefined;
          const topupLK = p.topupLK !== undefined ? Math.round(p.topupLK * scaleRatio) : undefined;
          const topupApp = p.topupApp !== undefined ? Math.round(p.topupApp * scaleRatio) : undefined;
          const spentShop = p.spentShop !== undefined ? Math.round(p.spentShop * scaleRatio) : undefined;

          let hourlyYield: number | undefined = p.hourlyYield;
          if (playedHours && playedHours > 0 && totalSpent > 0) {
            hourlyYield = Math.round(totalSpent / playedHours);
          } else if (playedMinutes && playedMinutes >= 15 && totalSpent > 0) {
            hourlyYield = Math.round(totalSpent / (playedMinutes / 60));
          }

          const bonusGivenRatio = p.bonusGivenRatio ?? (
            totalSpent > 0
              ? Math.round((bonusAccrued / totalSpent) * 100)
              : (bonusAccrued > 0 ? 999 : 0)
          );

          const totalAdditions = totalSpent + bonusAccrued;
          const cashShare = p.cashShare ?? (
            totalAdditions > 0 ? Math.round((totalSpent / totalAdditions) * 100) : 100
          );

          let valueCategory: ClientProfile["valueCategory"] = p.valueCategory || "standard";
          if (!p.valueCategory) {
            if (bonusAccrued >= Math.round(200 * scaleRatio) && (bonusGivenRatio >= 40 || totalSpent === 0)) {
              valueCategory = "bonus_heavy";
            } else if (bonusGivenRatio <= 10 && totalSpent >= whaleThreshold) {
              valueCategory = "diamond";
            } else if (bonusGivenRatio <= 25 && totalSpent >= Math.round(1000 * scaleRatio)) {
              valueCategory = "loyal";
            }
          }

          const isWhale = totalSpent >= whaleThreshold;

          let preferredTime: ClientProfile["preferredTime"] = p.preferredTime;
          if (!preferredTime) {
            if (p.gamerPersona === "night_owl" || (p.favoriteTariff && p.favoriteTariff.toLowerCase().includes("ночь"))) {
              preferredTime = "night";
            } else if (p.favoriteTariff && p.favoriteTariff.toLowerCase().includes("утро")) {
              preferredTime = "morning";
            } else if (p.favoriteTariff && p.favoriteTariff.toLowerCase().includes("день")) {
              preferredTime = "day";
            } else if (p.favoriteTariff && p.favoriteTariff.toLowerCase().includes("вечер")) {
              preferredTime = "evening";
            } else if (p.lastAuth) {
              const d = new Date(p.lastAuth);
              if (!isNaN(d.getTime())) {
                const h = d.getHours();
                if (h >= 22 || h < 6) preferredTime = "night";
                else if (h >= 6 && h < 12) preferredTime = "morning";
                else if (h >= 12 && h < 17) preferredTime = "day";
                else preferredTime = "evening";
              }
            }
          }

          let dayPattern: ClientProfile["dayPattern"] = p.dayPattern;
          let favoriteDay: string | undefined = p.favoriteDay;
          if (!dayPattern && p.lastAuth) {
            const d = new Date(p.lastAuth);
            if (!isNaN(d.getTime())) {
              const day = d.getDay();
              const DAY_NAMES = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
              favoriteDay = DAY_NAMES[day];
              dayPattern = (day === 0 || day === 5 || day === 6) ? "weekend" : "weekday";
            }
          }

          return {
            ...p,
            totalSpent,
            bonusAccrued,
            bonusSpent,
            bonusBalance,
            balance,
            txCount,
            avgTx,
            visits,
            playedMinutes,
            playedHours,
            hourlyYield,
            packageSpentRub,
            packageSpentBonus,
            packageCount,
            topupAdmin,
            topupLK,
            topupApp,
            spentShop,
            bonusGivenRatio,
            cashShare,
            valueCategory,
            isWhale,
            preferredTime,
            favoriteDay,
            dayPattern,
            lastAuth: p.lastAuth ? new Date(p.lastAuth) : null,
            regDate: p.regDate ? new Date(p.regDate) : null,
          };
        })
        .filter((p) => {
          if (!dateFilter) return true;
          return p.totalSpent > 0 || (p.visits !== undefined && p.visits > 0);
        });

      // Reconstruct tariff stats if available from profiles
      const tariffMap = new Map<string, { count: number; rub: number; bonus: number }>();
      for (const p of enrichedProfiles) {
        if (p.favoriteTariff) {
          const t = tariffMap.get(p.favoriteTariff) || { count: 0, rub: 0, bonus: 0 };
          t.count += p.packageCount || 1;
          t.rub += p.packageSpentRub || 0;
          t.bonus += p.packageSpentBonus || 0;
          tariffMap.set(p.favoriteTariff, t);
        }
      }
      const clubTariffStats = Array.from(tariffMap.entries()).map(([name, d]) => ({
        name,
        type: "Пакет",
        count: d.count,
        rub: d.rub,
        bonus: d.bonus,
      })).sort((a, b) => b.rub - a.rub);

      const computedAbandonedBalance = enrichedProfiles
        .filter((p) => p.status === "churned" && p.balance > 0)
        .reduce((sum, p) => sum + p.balance, 0);

      const computedAbandonedBonus = enrichedProfiles
        .filter((p) => p.status === "churned" && p.bonusBalance > 0)
        .reduce((sum, p) => sum + p.bonusBalance, 0);

      const computedBonusAccrued = enrichedProfiles.reduce((sum, p) => sum + p.bonusAccrued, 0);
      const computedBonusSpent = enrichedProfiles.reduce((sum, p) => sum + p.bonusSpent, 0);

      const totalBonusSpent = monthData
        ? (monthData.bonusSpent ?? monthData.bonus ?? 0)
        : Math.round((sm.totalBonusSpent ?? (sm.totalPackageBonus || computedBonusSpent)) * scaleRatio);

      const totalBonusAccrued = monthData
        ? (monthData.bonusAccrued ?? (monthData.rub > 0 ? Math.round(monthData.rub * ((sm.overallBonusEmissionRate || 15.5) / 100)) : 0))
        : Math.round((sm.totalBonusAccrued ?? (
            computedBonusAccrued > 0 
              ? computedBonusAccrued 
              : (sm.overallBonusEmissionRate && sm.totalRevenueInLog 
                  ? Math.round(sm.totalRevenueInLog * (sm.overallBonusEmissionRate / 100)) 
                  : 0)
          )) * scaleRatio);

      const abandonedBalance = Math.round((sm.abandonedBalance ?? (sm as any).churnedBal ?? computedAbandonedBalance) * scaleRatio);
      const abandonedBonus = Math.round((sm.abandonedBonus ?? (sm as any).churnedBonus ?? computedAbandonedBonus) * scaleRatio);

      const whales = enrichedProfiles
        .filter((p) => p.isWhale || p.totalSpent >= whaleThreshold)
        .sort((a, b) => b.totalSpent - a.totalSpent);

      const topChurned = enrichedProfiles
        .filter((p) => p.status === "churned" && p.totalSpent > 0)
        .sort((a, b) => b.totalSpent - a.totalSpent);

      const atRisk = enrichedProfiles
        .filter((p) => p.status === "cooling" && (p.totalSpent > 0 || p.balance > 100))
        .sort((a, b) => b.totalSpent - a.totalSpent);

      const totalRevenueInLog = monthData
        ? monthData.rub
        : Math.round((sm.totalPackageRub || sm.totalRevenueInLog || 0) * scaleRatio);
      const totalHoursPlayed = monthData
        ? monthData.hours
        : Math.round((sm.totalHoursPlayed || 0) * scaleRatio);
      const totalVisits = monthData
        ? monthData.sessions
        : Math.round((sm.totalVisits || 0) * scaleRatio);
      const totalPackageRub = monthData
        ? monthData.rub
        : Math.round((sm.totalPackageRub || 0) * scaleRatio);
      const avgHourlyYield = (totalHoursPlayed > 0 && totalRevenueInLog > 0)
        ? Math.round(totalRevenueInLog / totalHoursPlayed)
        : (sm.avgHourlyYield || 0);

      const overallBonusEmissionRate = totalRevenueInLog > 0
        ? Math.round((totalBonusAccrued / totalRevenueInLog) * 1000) / 10
        : (sm.overallBonusEmissionRate || 0);

      return {
        profiles: enrichedProfiles,
        clubPcStats,
        totalGuests: dateFilter ? enrichedProfiles.length : (sm.totalGuests || enrichedProfiles.length),
        totalRevenueInLog,
        totalBonusAccrued,
        totalBonusSpent,
        overallBonusEmissionRate,
        overallBonusShareOfTotal: 0,
        avgHourlyYield,
        activeCount: Math.round((sm.activeCount || enrichedProfiles.filter((p) => p.status === "active").length) * scaleRatio),
        coolingCount: Math.round((sm.coolingCount || enrichedProfiles.filter((p) => p.status === "cooling").length) * scaleRatio),
        churnedCount: Math.round((sm.churnedCount || enrichedProfiles.filter((p) => p.status === "churned").length) * scaleRatio),
        abandonedBalance,
        abandonedBonus,
        whales,
        topChurned,
        atRisk,
        hasSummaryReport: true,
        reportDateFrom,
        reportDateTo,
        reportDays,
        datasetDateFrom,
        datasetDateTo,
        totalPlayedMinutes: (sm.totalHoursPlayed || 0) * 60 * scaleRatio,
        totalHoursPlayed,
        totalVisits,
        hasPackagesReport: clubPcStats.length > 0,
        totalPackageRub,
        clubZoneStats,
        clubTariffStats,
        parsedAt: new Date(activeSnapshot.created_at),
      };
    }

    return null;
  }, [guestRows, txRows, summaryRows, packageRows, workstations, activeSnapshot, dateFilter, excludedPhones]);

  const handleClearAll = () => {
    setGuestRows(null);
    setGuestFileName(null);
    setTxRows(null);
    setTxFileName(null);
    setSummaryRows(null);
    setSummaryFileName(null);
    setPackageRows(null);
    setPackageFileName(null);
    setActiveSnapshot(null);
    setDateFilter(null);
  };

  const handleSelectSnapshot = (snapshot: SnapshotFull) => {
    // Clear raw upload rows so the loaded snapshot displays
    setGuestRows(null);
    setGuestFileName(null);
    setTxRows(null);
    setTxFileName(null);
    setSummaryRows(null);
    setSummaryFileName(null);
    setPackageRows(null);
    setPackageFileName(null);

    setActiveSnapshot(snapshot);
    setDateFilter(null);
    handleTabChange("analytics");
  };

  const loadedFilesCount = [guestRows, txRows, summaryRows, packageRows].filter(Boolean).length;

  const currentPeriod = useMemo(() => {
    return detectPeriod(
      [guestFileName, txFileName, summaryFileName, packageFileName],
      packageRows,
      summaryRows
    );
  }, [guestFileName, txFileName, summaryFileName, packageFileName, packageRows, summaryRows]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter italic uppercase text-slate-900">
              База гостей <span className="text-violet-600">&amp; Аналитика</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
              Сквозная аналитика реальной выручки, часов, зон клуба и LTV клиентов (без бонусов)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeSnapshot ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-xl mr-2">
                <Calendar className="w-3.5 h-3.5 text-violet-600" />
                <span>Период: <b>{activeSnapshot.name}</b></span>
                {(() => {
                  if (!activeSnapshot.period_start || !activeSnapshot.period_end) return null;
                  const s = new Date(activeSnapshot.period_start);
                  const e = new Date(activeSnapshot.period_end);
                  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
                  return (
                    <span className="text-[10px] text-violet-500 font-normal">
                      ({s.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} — {e.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })})
                    </span>
                  );
                })()}
              </span>
            ) : loadedFilesCount > 0 ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl mr-2">
                <Calendar className="w-3.5 h-3.5 text-violet-600" />
                <span>Период: <b>{currentPeriod.name}</b></span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ({loadedFilesCount}/4 отчетов)
                </span>
              </span>
            ) : null}

            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-200 font-black uppercase italic text-xs tracking-wider relative",
                  activeTab === tab.id
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-102"
                    : "bg-white text-slate-400 hover:text-slate-700 border border-slate-200"
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.id === "settings" && excludedPhones.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black not-italic">
                    {excludedPhones.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "upload" && (
          <UploadTab
            clubId={clubId}
            analytics={analytics}
            activeSnapshot={activeSnapshot}
            onSelectSnapshot={handleSelectSnapshot}

            guestRows={guestRows}
            guestFileName={guestFileName}
            setGuestData={(r, name) => { setGuestRows(r); setGuestFileName(name); setActiveSnapshot(null); }}

            txRows={txRows}
            txFileName={txFileName}
            setTxData={(r, name) => { setTxRows(r); setTxFileName(name); setActiveSnapshot(null); }}

            summaryRows={summaryRows}
            summaryFileName={summaryFileName}
            setSummaryData={(r, name) => { setSummaryRows(r); setSummaryFileName(name); setActiveSnapshot(null); }}

            packageRows={packageRows}
            packageFileName={packageFileName}
            setPackageData={(r, name) => { setPackageRows(r); setPackageFileName(name); setActiveSnapshot(null); }}

            onGoToAnalytics={() => handleTabChange("analytics")}
            onClearAll={handleClearAll}
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsTab 
            analytics={analytics} 
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
          />
        )}

        {activeTab === "tasks" && (
          <TasksTab 
            clubId={clubId} 
            analytics={analytics} 
            excludedPhones={excludedPhones}
          />
        )}

        {activeTab === "sms" && (
          <SmsTab 
            clubId={clubId} 
            analytics={analytics} 
            excludedPhones={excludedPhones}
          />
        )}

        {activeTab === "vk" && (
          <VkTab 
            clubId={clubId} 
            analytics={analytics} 
            excludedPhones={excludedPhones}
          />
        )}

        {activeTab === "attribution" && (
          <AttributionTab 
            clubId={clubId} 
            analytics={analytics} 
            onNavigateToSms={() => handleTabChange("sms")}
            onNavigateToVk={() => handleTabChange("vk")}
          />
        )}

        {activeTab === "hardware" && (
          <HardwareTab clubId={clubId} analytics={analytics} />
        )}

        {activeTab === "retention" && (
          <RetentionTab 
            clubId={clubId} 
            activeSnapshot={activeSnapshot} 
            currentAnalytics={analytics} 
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab 
            clubId={clubId} 
            excludedPhones={excludedPhones}
            onSaveExcludedPhones={handleSaveExcludedPhones}
          />
        )}
      </div>
    </div>
  );
}
