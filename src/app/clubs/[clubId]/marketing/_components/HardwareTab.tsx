"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  ExternalLink, 
  Search 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClubAnalytics, ClubPcStat, ClubZoneStat } from "./segmentation";

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
}

interface WorkplaceHealth {
  id: number | string;
  name: string;
  zone: string;
  openIssuesCount: number;
  lastCleanedAt: string | null;
}

export function normalizeWorkstationName(str: unknown): string {
  if (!str) return "";
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/^пк/g, "pc")
    .replace(/[\s\-_]/g, "")
    .replace(/^([a-zа-я]+)0*(\d+)$/, "$1$2");
}

export function HardwareTab({ clubId, analytics }: Props) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [filterIssueOnly, setFilterIssueOnly] = useState(false);
  const [filterUnderperformingOnly, setFilterUnderperformingOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [workplaceHealthMap, setWorkplaceHealthMap] = useState<Map<string, WorkplaceHealth>>(new Map());
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Fetch real equipment and maintenance state from DashAdmin
  useEffect(() => {
    if (!clubId) return;
    setLoadingHealth(true);
    fetch(`/api/clubs/${clubId}/workplaces`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.workstations)) {
          const map = new Map<string, WorkplaceHealth>();
          const eqList: any[] = Array.isArray(data.equipment) ? data.equipment : [];

          // Group issues and cleaning by workstation_id
          const issuesByWorkstation = new Map<number | string, number>();
          const cleaningByWorkstation = new Map<number | string, string | null>();

          for (const eq of eqList) {
            if (eq.workstation_id) {
              const prevIssues = issuesByWorkstation.get(eq.workstation_id) || 0;
              issuesByWorkstation.set(eq.workstation_id, prevIssues + (eq.open_issues_count || 0));

              if (eq.last_cleaned_at) {
                const prevDate = cleaningByWorkstation.get(eq.workstation_id);
                if (!prevDate || new Date(eq.last_cleaned_at) > new Date(prevDate)) {
                  cleaningByWorkstation.set(eq.workstation_id, eq.last_cleaned_at);
                }
              }
            }
          }

          for (const w of data.workstations) {
            const normalizedKey = normalizeWorkstationName(w.name);
            map.set(normalizedKey, {
              id: w.id,
              name: w.name,
              zone: w.zone,
              openIssuesCount: issuesByWorkstation.get(w.id) || 0,
              lastCleanedAt: cleaningByWorkstation.get(w.id) || null,
            });
          }

          setWorkplaceHealthMap(map);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch workplace health:", err);
      })
      .finally(() => {
        setLoadingHealth(false);
      });
  }, [clubId]);

  const pcStats = analytics?.clubPcStats || [];
  const zoneStats = analytics?.clubZoneStats || [];

  // Filtered PCs
  const filteredPcs = useMemo(() => {
    return pcStats.filter((pc) => {
      if (selectedZone && pc.zone !== selectedZone) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!pc.pc.toLowerCase().includes(q) && !pc.zone.toLowerCase().includes(q)) return false;
      }

      const health = workplaceHealthMap.get(normalizeWorkstationName(pc.pc));
      if (filterIssueOnly && (!health || health.openIssuesCount === 0)) return false;
      if (filterUnderperformingOnly && pc.percentOfZoneAverage >= 80) return false;

      return true;
    });
  }, [pcStats, selectedZone, searchQuery, filterIssueOnly, filterUnderperformingOnly, workplaceHealthMap]);

  if (!analytics || pcStats.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-1.5 shadow-xs">
        <h3 className="font-bold text-base text-slate-900">
          Данные по ПК не загружены
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
          Для анализа экономики мест и доходности оборудования загрузите отчет «Покупка пакетов и тарифов» во вкладке «Загрузка».
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Zone Economics Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Экономика игровых зон
          </h2>
          {selectedZone && (
            <button
              onClick={() => setSelectedZone(null)}
              className="text-xs font-medium text-slate-600 hover:text-black transition-colors cursor-pointer"
            >
              Сбросить фильтр зоны (выбрана: {selectedZone})
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {zoneStats.map((z) => {
            const isSelected = selectedZone === z.zone;
            const pcsInZone = pcStats.filter((p) => p.zone === z.zone);
            const avgRubPerPc = pcsInZone.length > 0 ? Math.round(z.rub / pcsInZone.length) : 0;

            return (
              <div
                key={z.zone}
                onClick={() => setSelectedZone(isSelected ? null : z.zone)}
                className={cn(
                  "border rounded-xl p-5 cursor-pointer transition-all flex flex-col justify-between gap-3 relative group",
                  isSelected
                    ? "border-slate-900 bg-slate-50/80 shadow-xs ring-1 ring-slate-900"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-black transition-colors">
                      {z.zone}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {z.percentOfRub}% выручки
                    </span>
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-slate-900 mt-2 tabular-nums">
                    {z.rub.toLocaleString("ru")} ₽
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Мест</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{pcsInZone.length}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Сессий</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{z.sessions.toLocaleString("ru")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">На 1 ПК</span>
                    <span className="font-semibold text-slate-900 tabular-nums">{avgRubPerPc.toLocaleString("ru")} ₽</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PC Audit & Equipment Health Link */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900">
              Рейтинг мест и аудит оборудования
            </h3>
            <p className="text-slate-500 text-xs mt-1 font-medium">
              Сравнение выручки каждого ПК со средней нормой его зоны. Интеграция с модулем «Оборудование» DashAdmin подсвечивает открытые поломки.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterUnderperformingOnly(!filterUnderperformingOnly)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer",
                filterUnderperformingOnly
                  ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              Отстающие (&lt;80% нормы)
            </button>

            <button
              onClick={() => setFilterIssueOnly(!filterIssueOnly)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer",
                filterIssueOnly
                  ? "bg-rose-600 text-white border-rose-700 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              С открытыми поломками
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по номеру ПК или названию зоны (например: PC05, PS, Буткемп)..."
            className="w-full pl-9 pr-4 py-2 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* PC Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold text-xs">
                <th className="py-3 px-4">Рабочее место (ПК)</th>
                <th className="py-3 px-4">Зона</th>
                <th className="py-3 px-4 text-right">Выручка за период</th>
                <th className="py-3 px-4 text-right">Сессий</th>
                <th className="py-3 px-4 text-right">Уникальных гостей</th>
                <th className="py-3 px-4 text-center">Отклонение от нормы зоны</th>
                <th className="py-3 px-4 text-center">Состояние в клубе</th>
                <th className="py-3 px-4 text-center">Карточка места</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredPcs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs font-medium">
                    Мест по выбранным критериям не найдено
                  </td>
                </tr>
              ) : (
                filteredPcs.map((pc) => {
                  const health = workplaceHealthMap.get(normalizeWorkstationName(pc.pc));
                  const hasIssues = health && health.openIssuesCount > 0;
                  const dev = pc.percentOfZoneAverage;
                  const isUnder = dev < 80;
                  const isOver = dev > 115;

                  return (
                    <tr key={pc.pc} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                        {pc.pc}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">
                        {pc.zone}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                        {pc.rub.toLocaleString("ru")} ₽
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-700 tabular-nums font-medium">
                        {pc.sessions.toLocaleString("ru")}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-700 tabular-nums font-medium">
                        {pc.uniqueGuests.toLocaleString("ru")}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                            isUnder
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : isOver
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-700"
                          )}
                        >
                          {isUnder ? (
                            <TrendingDown className="w-3 h-3 text-red-500" />
                          ) : isOver ? (
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                          ) : null}
                          <span>{dev}% от нормы</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {hasIssues ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Поломок: {health.openIssuesCount}</span>
                          </span>
                        ) : health?.lastCleanedAt && !isNaN(new Date(health.lastCleanedAt).getTime()) ? (
                          <span className="text-[11px] text-slate-400">
                            Чистка: {new Date(health.lastCleanedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">В норме</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {health?.id ? (
                          <Link
                            href={`/clubs/${clubId}/equipment/workplaces/${health.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-800 transition-colors"
                            target="_blank"
                          >
                            <span>Открыть</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
