"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Users, 
  UserMinus, 
  UserPlus, 
  TrendingDown, 
  TrendingUp, 
  ArrowRight, 
  Download, 
  Calendar, 
  Loader2, 
  AlertCircle,
  FileSpreadsheet,
  Percent,
  Search,
  Check,
  Sparkles,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SnapshotSummary, SnapshotFull } from "./types";
import type { ClubAnalytics, ClientProfile } from "./segmentation";

interface Props {
  clubId: string;
  activeSnapshot: SnapshotFull | null;
  currentAnalytics: ClubAnalytics | null;
}

type SubTab = "churn" | "downgrade" | "growth" | "newbies" | "cooling" | "with_balance";

export function RetentionTab({ clubId, activeSnapshot, currentAnalytics }: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected snapshot IDs
  const [baseSnapshotId, setBaseSnapshotId] = useState<string>("");
  const [currentSnapshotId, setCurrentSnapshotId] = useState<string>("");

  // Loaded full snapshots
  const [baseData, setBaseData] = useState<SnapshotFull | null>(null);
  const [compareData, setCompareData] = useState<SnapshotFull | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("churn");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Load snapshots list
  useEffect(() => {
    if (!clubId) return;
    setLoadingList(true);
    fetch(`/api/clubs/${clubId}/marketing/snapshots`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSnapshots(data);
          // Auto-select latest two if available
          if (data.length >= 2) {
            setCurrentSnapshotId(data[0].id);
            setBaseSnapshotId(data[1].id);
          } else if (data.length === 1) {
            if (currentAnalytics) {
              setBaseSnapshotId(data[0].id);
              setCurrentSnapshotId("");
            } else {
              setBaseSnapshotId(data[0].id);
              setCurrentSnapshotId(data[0].id);
            }
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to load snapshots list for retention:", err);
      })
      .finally(() => setLoadingList(false));
  }, [clubId, currentAnalytics]);

  // Load Base snapshot
  useEffect(() => {
    if (!baseSnapshotId) {
      setBaseData(null);
      return;
    }
    fetch(`/api/clubs/${clubId}/marketing/snapshots/${baseSnapshotId}`)
      .then((res) => res.json())
      .then((data) => setBaseData(data))
      .catch((err) => console.warn("Failed to load base snapshot:", err));
  }, [baseSnapshotId, clubId]);

  // Load Compare snapshot (or fallback to activeSnapshot / currentAnalytics)
  useEffect(() => {
    if (!currentSnapshotId) {
      if (activeSnapshot) {
        setCompareData(activeSnapshot);
      } else if (currentAnalytics) {
        setCompareData({
          id: "live",
          club_id: Number(clubId),
          name: "Текущая загрузка",
          period_start: null,
          period_end: null,
          file_names: [],
          summary_metrics: {
            totalRevenueInLog: currentAnalytics.totalRevenueInLog,
            totalGuests: currentAnalytics.totalGuests,
          },
          guests_data: currentAnalytics.profiles,
          pc_data: currentAnalytics.clubPcStats || [],
          created_at: new Date().toISOString(),
        });
      }
      return;
    }

    fetch(`/api/clubs/${clubId}/marketing/snapshots/${currentSnapshotId}`)
      .then((res) => res.json())
      .then((data) => setCompareData(data))
      .catch((err) => console.warn("Failed to load compare snapshot:", err));
  }, [currentSnapshotId, activeSnapshot, currentAnalytics, clubId]);

  // Map guests for comparison if two DISTINCT periods are selected
  const comparison = useMemo(() => {
    if (!baseData || !compareData) return null;
    if (baseData.id === compareData.id) return null;

    const baseProfiles = baseData.guests_data || [];
    const currentProfiles = compareData.guests_data || [];

    const baseMap = new Map<string, ClientProfile>();
    for (const p of baseProfiles) {
      if (p.phone) baseMap.set(p.phone, p);
    }

    const currentMap = new Map<string, ClientProfile>();
    for (const p of currentProfiles) {
      if (p.phone) currentMap.set(p.phone, p);
    }

    // 1. Churned: was in base, 0 in current
    const churned: { profile: ClientProfile; lostRevenue: number; prevVisits: number }[] = [];
    let totalLostRevenue = 0;

    for (const [phone, bp] of baseMap.entries()) {
      if (!currentMap.has(phone)) {
        const lost = bp.totalSpent || 0;
        totalLostRevenue += lost;
        churned.push({
          profile: bp,
          lostRevenue: lost,
          prevVisits: bp.visits || bp.txCount || 1,
        });
      }
    }
    churned.sort((a, b) => b.lostRevenue - a.lostRevenue);

    // 2. Downgraded: spend dropped by >= 50%
    const downgraded: { profile: ClientProfile; baseSpent: number; currentSpent: number; dropPercent: number }[] = [];
    for (const [phone, cp] of currentMap.entries()) {
      const bp = baseMap.get(phone);
      if (bp && bp.totalSpent > 500) {
        const drop = bp.totalSpent - cp.totalSpent;
        const dropPercent = Math.round((drop / bp.totalSpent) * 100);
        if (dropPercent >= 50) {
          downgraded.push({
            profile: cp,
            baseSpent: bp.totalSpent,
            currentSpent: cp.totalSpent,
            dropPercent,
          });
        }
      }
    }
    downgraded.sort((a, b) => (b.baseSpent - b.currentSpent) - (a.baseSpent - a.currentSpent));

    // 3. Growth: spend grew by >= 50%
    const growth: { profile: ClientProfile; baseSpent: number; currentSpent: number; growPercent: number }[] = [];
    for (const [phone, cp] of currentMap.entries()) {
      const bp = baseMap.get(phone);
      if (bp && cp.totalSpent > bp.totalSpent && cp.totalSpent >= 500) {
        const diff = cp.totalSpent - bp.totalSpent;
        const growPercent = Math.round((diff / (bp.totalSpent || 1)) * 100);
        if (growPercent >= 50) {
          growth.push({
            profile: cp,
            baseSpent: bp.totalSpent,
            currentSpent: cp.totalSpent,
            growPercent,
          });
        }
      }
    }
    growth.sort((a, b) => (b.currentSpent - b.baseSpent) - (a.currentSpent - a.baseSpent));

    // 4. Newbies: in current, not in base
    const newbies: ClientProfile[] = [];
    for (const [phone, cp] of currentMap.entries()) {
      if (!baseMap.has(phone)) {
        newbies.push(cp);
      }
    }
    newbies.sort((a, b) => b.totalSpent - a.totalSpent);

    // Macro Deltas
    const baseRev = baseData.summary_metrics?.totalRevenueInLog ?? baseProfiles.reduce((s, p) => s + p.totalSpent, 0);
    const currRev = compareData.summary_metrics?.totalRevenueInLog ?? currentProfiles.reduce((s, p) => s + p.totalSpent, 0);
    const revDelta = currRev - baseRev;
    const revDeltaPercent = baseRev > 0 ? Math.round((revDelta / baseRev) * 100) : 0;

    const baseGuests = baseProfiles.length;
    const currGuests = currentProfiles.length;
    const guestsDelta = currGuests - baseGuests;

    return {
      churned,
      totalLostRevenue,
      downgraded,
      growth,
      newbies,
      baseRev,
      currRev,
      revDelta,
      revDeltaPercent,
      baseGuests,
      currGuests,
      guestsDelta,
    };
  }, [baseData, compareData]);

  // Single-Snapshot Retention Audit calculations (when 1 snapshot is active or selected)
  const singleSnapshot: SnapshotFull | null = compareData || baseData || activeSnapshot;
  const singleProfiles = useMemo(() => {
    return singleSnapshot?.guests_data || currentAnalytics?.profiles || [];
  }, [singleSnapshot, currentAnalytics]);

  const singleMetrics = useMemo(() => {
    if (!singleSnapshot && !currentAnalytics) return null;
    const sm = singleSnapshot?.summary_metrics || {};
    const totalGuests = sm.totalGuests || singleProfiles.length;

    const churned = singleProfiles.filter((p) => p.status === "churned");
    const cooling = singleProfiles.filter((p) => p.status === "cooling");
    const withBalance = singleProfiles
      .filter((p) => (p.balance || 0) > 0 || (p.bonusBalance || 0) > 0)
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));

    const abandonedBal = sm.abandonedBalance ?? (sm as any).churnedBal ?? churned.reduce((s, p) => s + (p.balance || 0), 0);
    const abandonedBonus = sm.abandonedBonus ?? (sm as any).churnedBonus ?? churned.reduce((s, p) => s + (p.bonusBalance || 0), 0);
    const churnPercent = totalGuests > 0 ? Math.round((churned.length / totalGuests) * 1000) / 10 : 0;

    return {
      totalGuests,
      churned,
      cooling,
      withBalance,
      abandonedBal,
      abandonedBonus,
      churnPercent,
    };
  }, [singleSnapshot, currentAnalytics, singleProfiles]);

  // Single snapshot filtered table rows
  const filteredSingleList = useMemo(() => {
    if (!singleMetrics) return [];
    let list: ClientProfile[] = [];
    if (activeSubTab === "churn") list = singleMetrics.churned;
    else if (activeSubTab === "cooling") list = singleMetrics.cooling;
    else if (activeSubTab === "with_balance") list = singleMetrics.withBalance;
    else list = singleMetrics.churned;

    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((p) => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    );
  }, [singleMetrics, activeSubTab, searchQuery]);

  // Export phones of active subtab (for dual comparison OR single snapshot audit)
  const handleExportPhones = () => {
    let phones: string[] = [];
    if (comparison) {
      if (activeSubTab === "churn") {
        phones = comparison.churned.map((c) => c.profile.phone).filter(Boolean);
      } else if (activeSubTab === "downgrade") {
        phones = comparison.downgraded.map((d) => d.profile.phone).filter(Boolean);
      } else if (activeSubTab === "growth") {
        phones = comparison.growth.map((g) => g.profile.phone).filter(Boolean);
      } else if (activeSubTab === "newbies") {
        phones = comparison.newbies.map((n) => n.phone).filter(Boolean);
      }
    } else if (singleMetrics) {
      phones = filteredSingleList.map((p) => p.phone).filter(Boolean);
    }

    if (phones.length === 0) return;

    // Clean international format +7...
    const formatted = phones.map((p) => {
      const clean = p.replace(/\D/g, "");
      if (clean.startsWith("8") && clean.length === 11) return "+7" + clean.slice(1);
      if (clean.startsWith("7") && clean.length === 11) return "+" + clean;
      return "+" + clean;
    });

    const blob = new Blob([formatted.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phones-${activeSubTab}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (snapshots.length === 0 && !activeSnapshot && !currentAnalytics) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
        <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="font-bold text-base text-slate-900">
          Срезы еще не созданы
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
          Для анализа удержания, оттока и динамики гостей сохраните хотя бы один период во вкладке «Срезы и Загрузка».
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selectors Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 block">
              1. Базовый период (Прошлый)
            </span>
            <select
              value={baseSnapshotId}
              onChange={(e) => setBaseSnapshotId(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="">Выберите прошлый срез...</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.guests_count || 0} гостей)
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 text-slate-400 hidden md:block">
            <ArrowRight className="w-4 h-4" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 block">
              2. Текущий период (Для сравнения)
            </span>
            <select
              value={currentSnapshotId}
              onChange={(e) => setCurrentSnapshotId(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="">Текущая загрузка / Активный срез</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.guests_count || 0} гостей)
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleExportPhones}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-black hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all self-start md:self-auto cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
          <span>Скачать телефоны ({activeSubTab})</span>
        </button>
      </div>

      {/* DUAL COMPARISON MODE (when 2 distinct periods are selected) */}
      {comparison ? (
        <>
          {/* Macro Deltas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Дельта выручки</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {comparison.revDelta >= 0 ? "+" : ""}{comparison.revDelta.toLocaleString("ru")} ₽
                </span>
                <span className={cn(
                  "text-xs font-bold",
                  comparison.revDelta >= 0 ? "text-emerald-600" : "text-rose-600"
                )}>
                  ({comparison.revDeltaPercent >= 0 ? "+" : ""}{comparison.revDeltaPercent}%)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                {comparison.baseRev.toLocaleString("ru")} ₽ → {comparison.currRev.toLocaleString("ru")} ₽
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Потерянная выручка (Отток)</span>
              <div className="text-2xl font-bold tracking-tight text-rose-600 tabular-nums">
                -{comparison.totalLostRevenue.toLocaleString("ru")} ₽
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Траты гостей, которые перестали ходить
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Ушедшие гости</span>
              <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {comparison.churned.length} чел.
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Были в прошлом, 0 визитов в этом
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Новые гости</span>
              <div className="text-2xl font-bold tracking-tight text-emerald-600 tabular-nums">
                +{comparison.newbies.length} чел.
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Впервые пришли в этом периоде
              </span>
            </div>
          </div>

          {/* Subtabs Navigation */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-xs gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
            {[
              { id: "churn", label: "Отток", count: comparison.churned.length, icon: UserMinus },
              { id: "downgrade", label: "Падение активности >50%", count: comparison.downgraded.length, icon: TrendingDown },
              { id: "growth", label: "Выросшие клиенты", count: comparison.growth.length, icon: TrendingUp },
              { id: "newbies", label: "Новые гости", count: comparison.newbies.length, icon: UserPlus },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                  activeSubTab === tab.id
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  activeSubTab === tab.id ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-500"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* List Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                {activeSubTab === "churn" && "Клиенты в оттоке (ранжированы по сумме потерянной выручки)"}
                {activeSubTab === "downgrade" && "Клиенты с падением трат более чем на 50%"}
                {activeSubTab === "growth" && "Клиенты с приростом трат более чем на 50%"}
                {activeSubTab === "newbies" && "Новые гости периода (ранжированы по тратам)"}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold text-xs">
                    <th className="py-3 px-4">Имя гостя</th>
                    <th className="py-3 px-4">Телефон</th>
                    {activeSubTab === "churn" && (
                      <>
                        <th className="py-3 px-4 text-right">Потеряно денег</th>
                        <th className="py-3 px-4 text-right">Визитов в прошлом</th>
                        <th className="py-3 px-4">Любимая зона</th>
                      </>
                    )}
                    {activeSubTab === "downgrade" && (
                      <>
                        <th className="py-3 px-4 text-right">Было в прошлом</th>
                        <th className="py-3 px-4 text-right">Стало сейчас</th>
                        <th className="py-3 px-4 text-center">Падение</th>
                      </>
                    )}
                    {activeSubTab === "growth" && (
                      <>
                        <th className="py-3 px-4 text-right">Было в прошлом</th>
                        <th className="py-3 px-4 text-right">Стало сейчас</th>
                        <th className="py-3 px-4 text-center">Прирост</th>
                      </>
                    )}
                    {activeSubTab === "newbies" && (
                      <>
                        <th className="py-3 px-4 text-right">Потрачено в первом периоде</th>
                        <th className="py-3 px-4 text-right">Визитов</th>
                        <th className="py-3 px-4">Зона</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {activeSubTab === "churn" && comparison.churned.map((c) => (
                    <tr key={c.profile.phone} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{c.profile.name || "Гость"}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{c.profile.phone}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-600 tabular-nums">
                        {c.lostRevenue.toLocaleString("ru")} ₽
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-700">{c.prevVisits}</td>
                      <td className="py-3.5 px-4 text-slate-500">{c.profile.favoriteZone || "—"}</td>
                    </tr>
                  ))}

                  {activeSubTab === "downgrade" && comparison.downgraded.map((d) => (
                    <tr key={d.profile.phone} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-black text-slate-900">{d.profile.name || "Гость"}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{d.profile.phone}</td>
                      <td className="py-3.5 px-4 text-right text-slate-600">{d.baseSpent.toLocaleString("ru")} ₽</td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">{d.currentSpent.toLocaleString("ru")} ₽</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-[11px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          -{d.dropPercent}%
                        </span>
                      </td>
                    </tr>
                  ))}

                  {activeSubTab === "growth" && comparison.growth.map((g) => (
                    <tr key={g.profile.phone} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{g.profile.name || "Гость"}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{g.profile.phone}</td>
                      <td className="py-3.5 px-4 text-right text-slate-600 tabular-nums">{g.baseSpent.toLocaleString("ru")} ₽</td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600 tabular-nums">+{g.currentSpent.toLocaleString("ru")} ₽</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          +{g.growPercent}%
                        </span>
                      </td>
                    </tr>
                  ))}

                  {activeSubTab === "newbies" && comparison.newbies.map((n) => (
                    <tr key={n.phone} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{n.name || "Гость"}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{n.phone}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">{n.totalSpent.toLocaleString("ru")} ₽</td>
                      <td className="py-3.5 px-4 text-right text-slate-700 tabular-nums">{n.visits || n.txCount || 1}</td>
                      <td className="py-3.5 px-4 text-slate-500">{n.favoriteZone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : singleMetrics ? (
        /* SINGLE-SNAPSHOT RETENTION AUDIT (when viewing 1 period) */
        <>
          {/* Helpful callout banner */}
          <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-violet-600 text-white rounded-lg">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Аудит удержания и оттока базы {singleSnapshot?.name ? `(Срез: ${singleSnapshot.name})` : ""}
                </p>
                <p className="text-[11px] text-slate-500">
                  Вы можете скачать базу номеров для SMS/VK рассылок по оттоку. Чтобы увидеть сравнение «Месяц к Месяцу» (рост, новичков и падения), выберите второй срез в селекторе выше.
                </p>
              </div>
            </div>
          </div>

          {/* Macro Audit Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Всего в базе клуба</span>
              <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {singleMetrics.totalGuests.toLocaleString("ru")} чел.
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Зарегистрированные профили
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500">В оттоке (&gt;30 дней)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-rose-600 tabular-nums">
                  {singleMetrics.churned.length.toLocaleString("ru")} чел.
                </span>
                <span className="text-xs font-bold text-rose-500">
                  ({singleMetrics.churnPercent}%)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Не посещали клуб более месяца
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Остывают (15–30 дней)</span>
              <div className="text-2xl font-bold tracking-tight text-amber-600 tabular-nums">
                {singleMetrics.cooling.length.toLocaleString("ru")} чел.
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Риск перехода в отток
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Забытые деньги</span>
              <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {Math.round(singleMetrics.abandonedBal).toLocaleString("ru")} ₽
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                + {Math.round(singleMetrics.abandonedBonus).toLocaleString("ru")} Б на спящих счетах
              </span>
            </div>
          </div>

          {/* Subtabs for Single Snapshot Audit */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-xs gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
            {[
              { id: "churn", label: "В оттоке 31+ дней", count: singleMetrics.churned.length, icon: UserMinus },
              { id: "cooling", label: "Остывают 15–30 дней", count: singleMetrics.cooling.length, icon: TrendingDown },
              { id: "with_balance", label: "С деньгами на балансе", count: singleMetrics.withBalance.length, icon: Wallet },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                  activeSubTab === tab.id
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  activeSubTab === tab.id ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-500"
                )}>
                  {tab.count.toLocaleString("ru")}
                </span>
              </button>
            ))}
          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {activeSubTab === "churn" && "Клиенты в оттоке (31+ дней без визита)"}
                  {activeSubTab === "cooling" && "Клиенты, которые остывают (15–30 дней)"}
                  {activeSubTab === "with_balance" && "Гости с остатком рублей или бонусов на счете"}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Показано {Math.min(100, filteredSingleList.length)} из {filteredSingleList.length.toLocaleString("ru")} гостей. Для полной базы нажмите «Скачать телефоны».
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Поиск по имени или телефону..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold text-xs">
                    <th className="py-3 px-4">Имя гостя</th>
                    <th className="py-3 px-4">Телефон</th>
                    <th className="py-3 px-4 text-right">Баланс (₽)</th>
                    <th className="py-3 px-4 text-right">Бонусы</th>
                    <th className="py-3 px-4 text-right">Потрачено в клубе</th>
                    <th className="py-3 px-4 text-center">Дней без визита</th>
                    <th className="py-3 px-4 text-center">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredSingleList.slice(0, 100).map((p, idx) => (
                    <tr key={(p.phone || "") + idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{p.name || "Гость"}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{p.phone || "—"}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                        {(p.balance || 0) > 0 ? `${(p.balance || 0).toLocaleString("ru")} ₽` : "0 ₽"}
                      </td>
                      <td className="py-3.5 px-4 text-right text-amber-600 font-semibold">
                        {(p.bonusBalance || 0) > 0 ? `${(p.bonusBalance || 0).toLocaleString("ru")} Б` : "0 Б"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                        {(p.totalSpent || 0).toLocaleString("ru")} ₽
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-500">
                        {p.daysSince !== null && p.daysSince !== undefined ? `${p.daysSince} дн.` : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold",
                            p.status === "churned"
                              ? "bg-red-50 text-red-600 border border-red-200"
                              : p.status === "cooling"
                              ? "bg-amber-50 text-amber-600 border border-amber-200"
                              : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          )}
                        >
                          {p.status === "churned" ? "Отток" : p.status === "cooling" ? "Остывает" : "Активен"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredSingleList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Гостей по заданным критериям не найдено
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto" />
          <p className="text-xs text-slate-400">Загрузка данных удержания...</p>
        </div>
      )}
    </div>
  );
}
