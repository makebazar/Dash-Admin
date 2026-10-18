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
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SnapshotSummary, SnapshotFull } from "./types";
import type { ClubAnalytics, ClientProfile } from "./segmentation";

interface Props {
  clubId: string;
  activeSnapshot: SnapshotFull | null;
  currentAnalytics: ClubAnalytics | null;
}

type SubTab = "churn" | "downgrade" | "growth" | "newbies";

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
  const [loadingData, setLoadingData] = useState(false);

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
            setCurrentSnapshotId(data[0].id);
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to load snapshots list for retention:", err);
      })
      .finally(() => setLoadingList(false));
  }, [clubId]);

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

  // Map guests for comparison
  const comparison = useMemo(() => {
    if (!baseData || !compareData) return null;

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

  // Export phones of active subtab
  const handleExportPhones = () => {
    if (!comparison) return;
    let phones: string[] = [];
    if (activeSubTab === "churn") {
      phones = comparison.churned.map((c) => c.profile.phone).filter(Boolean);
    } else if (activeSubTab === "downgrade") {
      phones = comparison.downgraded.map((d) => d.profile.phone).filter(Boolean);
    } else if (activeSubTab === "growth") {
      phones = comparison.growth.map((g) => g.profile.phone).filter(Boolean);
    } else if (activeSubTab === "newbies") {
      phones = comparison.newbies.map((n) => n.phone).filter(Boolean);
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

  if (snapshots.length < 2 && !activeSnapshot && !currentAnalytics) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
        <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="font-black text-base uppercase tracking-tight text-slate-700">
          Нужно минимум 2 среза для сравнения
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Чтобы выявить отток гостей, потерянную выручку и динамику удержания, сохраните минимум два периода (например: Сентябрь и Октябрь) во вкладке «Срезы и Загрузка».
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selectors Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              1. Базовый период (Прошлый)
            </span>
            <select
              value={baseSnapshotId}
              onChange={(e) => setBaseSnapshotId(e.target.value)}
              className="px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
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
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              2. Текущий период (Для сравнения)
            </span>
            <select
              value={currentSnapshotId}
              onChange={(e) => setCurrentSnapshotId(e.target.value)}
              className="px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
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

        {comparison && (
          <button
            onClick={handleExportPhones}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider bg-slate-900 text-white rounded-xl shadow-md hover:bg-slate-800 transition-all self-start md:self-auto"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
            <span>Скачать телефоны ({activeSubTab})</span>
          </button>
        )}
      </div>

      {comparison && (
        <>
          {/* Macro Deltas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400">Дельта выручки</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-900">
                  {comparison.revDelta >= 0 ? "+" : ""}{comparison.revDelta.toLocaleString("ru")} ₽
                </span>
                <span className={cn(
                  "text-xs font-bold",
                  comparison.revDelta >= 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  ({comparison.revDeltaPercent >= 0 ? "+" : ""}{comparison.revDeltaPercent}%)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block">
                {comparison.baseRev.toLocaleString("ru")} ₽ → {comparison.currRev.toLocaleString("ru")} ₽
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400">Потерянная выручка (Отток)</span>
              <div className="text-xl font-black text-red-600">
                -{comparison.totalLostRevenue.toLocaleString("ru")} ₽
              </div>
              <span className="text-[11px] text-slate-400 block">
                Траты гостей, которые перестали ходить
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400">Ушедшие гости</span>
              <div className="text-xl font-black text-slate-900">
                {comparison.churned.length} чел.
              </div>
              <span className="text-[11px] text-slate-400 block">
                Были в прошлом, 0 визитов в этом
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400">Новые гости</span>
              <div className="text-xl font-black text-emerald-600">
                +{comparison.newbies.length} чел.
              </div>
              <span className="text-[11px] text-slate-400 block">
                Впервые пришли в этом периоде
              </span>
            </div>
          </div>

          {/* Subtabs Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveSubTab("churn")}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2",
                activeSubTab === "churn"
                  ? "bg-red-50 text-red-700 border border-red-200 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <UserMinus className="w-3.5 h-3.5" />
              <span>Отток ({comparison.churned.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab("downgrade")}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2",
                activeSubTab === "downgrade"
                  ? "bg-amber-50 text-amber-700 border border-amber-200 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Падение активности &gt;50% ({comparison.downgraded.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab("growth")}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2",
                activeSubTab === "growth"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Выросшие клиенты ({comparison.growth.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab("newbies")}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2",
                activeSubTab === "newbies"
                  ? "bg-violet-50 text-violet-700 border border-violet-200 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Новые гости ({comparison.newbies.length})</span>
            </button>
          </div>

          {/* List Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm uppercase tracking-wider text-slate-800">
                {activeSubTab === "churn" && "Клиенты в оттоке (ранжированы по сумме потерянной выручки)"}
                {activeSubTab === "downgrade" && "Клиенты с падением трат более чем на 50%"}
                {activeSubTab === "growth" && "Клиенты с приростом трат более чем на 50%"}
                {activeSubTab === "newbies" && "Новые гости периода (ранжированы по тратам)"}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-wider">
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
                      <td className="py-3.5 px-4 font-black text-slate-900">{c.profile.name || "Гость"}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{c.profile.phone}</td>
                      <td className="py-3.5 px-4 text-right font-black text-red-600">
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
                      <td className="py-3.5 px-4 font-black text-slate-900">{g.profile.name || "Гость"}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{g.profile.phone}</td>
                      <td className="py-3.5 px-4 text-right text-slate-600">{g.baseSpent.toLocaleString("ru")} ₽</td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-600">+{g.currentSpent.toLocaleString("ru")} ₽</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          +{g.growPercent}%
                        </span>
                      </td>
                    </tr>
                  ))}

                  {activeSubTab === "newbies" && comparison.newbies.map((n) => (
                    <tr key={n.phone} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-black text-slate-900">{n.name || "Гость"}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{n.phone}</td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">{n.totalSpent.toLocaleString("ru")} ₽</td>
                      <td className="py-3.5 px-4 text-right text-slate-700">{n.visits || n.txCount || 1}</td>
                      <td className="py-3.5 px-4 text-slate-500">{n.favoriteZone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
