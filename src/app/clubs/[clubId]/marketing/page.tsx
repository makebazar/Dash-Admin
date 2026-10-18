"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { UploadTab } from "./_components/UploadTab";
import { AnalyticsTab } from "./_components/AnalyticsTab";
import { HardwareTab } from "./_components/HardwareTab";
import { RetentionTab } from "./_components/RetentionTab";
import { cn } from "@/lib/utils";
import { 
  FolderArchive, 
  BarChart3, 
  Monitor, 
  Users, 
  Database,
  Calendar,
  Sparkles
} from "lucide-react";
import { buildClubAnalytics, type ClubAnalytics, type WorkstationInfo, type ClientProfile } from "./_components/segmentation";
import { detectPeriod } from "./_components/periodDetection";
import type { SnapshotFull } from "./_components/types";

const TABS = [
  { id: "analytics", label: "Гости и Персоны", icon: BarChart3 },
  { id: "hardware", label: "Зоны и Железо", icon: Monitor },
  { id: "retention", label: "Удержание и Динамика", icon: Users },
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
      return buildClubAnalytics(
        guestRows || [],
        txRows || [],
        summaryRows || [],
        packageRows || [],
        workstations
      );
    }

    // Otherwise if a saved snapshot is selected, reconstruct analytics
    if (activeSnapshot) {
      const rawGuests = activeSnapshot.guests_data || [];
      const pc = activeSnapshot.pc_data || [];
      const sm = activeSnapshot.summary_metrics || {};

      // Enrich profiles with properly computed ratios and categories
      const enrichedProfiles: ClientProfile[] = rawGuests.map((p) => {
        const totalSpent = p.totalSpent || 0;
        const bonusAccrued = p.bonusAccrued || 0;
        const bonusSpent = p.bonusSpent || 0;
        const bonusBalance = p.bonusBalance || 0;
        const balance = p.balance || 0;
        const txCount = p.txCount || (totalSpent > 0 ? 1 : 0);
        const avgTx = p.avgTx || (txCount > 0 ? Math.round(totalSpent / txCount) : 0);

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
          if (bonusAccrued >= 200 && (bonusGivenRatio >= 40 || totalSpent === 0)) {
            valueCategory = "bonus_heavy";
          } else if (bonusGivenRatio <= 10 && totalSpent >= 2000) {
            valueCategory = "diamond";
          } else if (bonusGivenRatio <= 25 && totalSpent >= 1000) {
            valueCategory = "loyal";
          }
        }

        const isWhale = p.isWhale || totalSpent >= 2000;

        return {
          ...p,
          totalSpent,
          bonusAccrued,
          bonusSpent,
          bonusBalance,
          balance,
          txCount,
          avgTx,
          bonusGivenRatio,
          cashShare,
          valueCategory,
          isWhale,
          lastAuth: p.lastAuth ? new Date(p.lastAuth) : null,
          regDate: p.regDate ? new Date(p.regDate) : null,
        };
      });

      // Reconstruct zone stats from PC stats if available
      const zoneMap = new Map<string, { rub: number; sessions: number }>();
      let totalRub = sm.totalRevenueInLog || 0;
      for (const p of pc) {
        const existing = zoneMap.get(p.zone) || { rub: 0, sessions: 0 };
        existing.rub += p.rub;
        existing.sessions += p.sessions;
        zoneMap.set(p.zone, existing);
      }

      const clubZoneStats = Array.from(zoneMap.entries()).map(([zone, d]) => ({
        zone,
        sessions: d.sessions,
        rub: d.rub,
        bonus: 0,
        percentOfRub: totalRub > 0 ? Math.round((d.rub / totalRub) * 1000) / 10 : 0,
        uniqueGuests: 0,
      }));

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

      const totalBonusAccrued = sm.totalBonusAccrued ?? (
        computedBonusAccrued > 0 
          ? computedBonusAccrued 
          : (sm.overallBonusEmissionRate && sm.totalRevenueInLog 
              ? Math.round(sm.totalRevenueInLog * (sm.overallBonusEmissionRate / 100)) 
              : 0)
      );

      const abandonedBalance = sm.abandonedBalance ?? (sm as any).churnedBal ?? computedAbandonedBalance;
      const abandonedBonus = sm.abandonedBonus ?? (sm as any).churnedBonus ?? computedAbandonedBonus;
      const totalBonusSpent = sm.totalBonusSpent ?? computedBonusSpent;

      const reportDateFrom = activeSnapshot.period_start ? new Date(activeSnapshot.period_start) : null;
      const reportDateTo = activeSnapshot.period_end ? new Date(activeSnapshot.period_end) : null;
      const reportDays = (reportDateFrom && reportDateTo && !isNaN(reportDateFrom.getTime()) && !isNaN(reportDateTo.getTime()))
        ? Math.max(1, Math.round((reportDateTo.getTime() - reportDateFrom.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      const whales = enrichedProfiles
        .filter((p) => p.isWhale || p.totalSpent >= 2000)
        .sort((a, b) => b.totalSpent - a.totalSpent);

      const topChurned = enrichedProfiles
        .filter((p) => p.status === "churned" && p.totalSpent > 0)
        .sort((a, b) => b.totalSpent - a.totalSpent);

      const atRisk = enrichedProfiles
        .filter((p) => p.status === "cooling" && (p.totalSpent > 0 || p.balance > 100))
        .sort((a, b) => b.totalSpent - a.totalSpent);

      return {
        profiles: enrichedProfiles,
        clubPcStats: pc,
        totalGuests: sm.totalGuests || enrichedProfiles.length,
        totalRevenueInLog: sm.totalRevenueInLog || 0,
        totalBonusAccrued,
        totalBonusSpent,
        overallBonusEmissionRate: sm.overallBonusEmissionRate || (sm.totalRevenueInLog > 0 ? Math.round((totalBonusAccrued / sm.totalRevenueInLog) * 1000) / 10 : 0),
        overallBonusShareOfTotal: 0,
        avgHourlyYield: sm.avgHourlyYield || 0,
        activeCount: sm.activeCount || enrichedProfiles.filter((p) => p.status === "active").length,
        coolingCount: sm.coolingCount || enrichedProfiles.filter((p) => p.status === "cooling").length,
        churnedCount: sm.churnedCount || enrichedProfiles.filter((p) => p.status === "churned").length,
        abandonedBalance,
        abandonedBonus,
        whales,
        topChurned,
        atRisk,
        hasSummaryReport: true,
        reportDateFrom,
        reportDateTo,
        reportDays,
        totalPlayedMinutes: (sm.totalHoursPlayed || 0) * 60,
        totalHoursPlayed: sm.totalHoursPlayed || 0,
        totalVisits: sm.totalVisits || 0,
        hasPackagesReport: pc.length > 0,
        totalPackageRub: sm.totalPackageRub || 0,
        clubZoneStats,
        clubTariffStats,
        parsedAt: new Date(activeSnapshot.created_at),
      };
    }

    return null;
  }, [guestRows, txRows, summaryRows, packageRows, workstations, activeSnapshot]);

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
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 font-black uppercase italic text-xs tracking-wider",
                  activeTab === tab.id
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-102"
                    : "bg-white text-slate-400 hover:text-slate-700 border border-slate-200"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
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
          <AnalyticsTab analytics={analytics} />
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
      </div>
    </div>
  );
}
