"use client";

import { useState, useEffect } from "react";
import { 
  FolderArchive, 
  Calendar, 
  Users, 
  TrendingUp, 
  Trash2, 
  Check, 
  Loader2, 
  Save, 
  Clock, 
  AlertCircle,
  FileSpreadsheet,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SnapshotSummary, SnapshotFull } from "./types";
import type { ClubAnalytics } from "./segmentation";
import { detectPeriod, formatPeriod } from "./periodDetection";

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
  fileNames: (string | null)[];
  summaryRows?: Record<string, unknown>[] | null;
  packageRows?: Record<string, unknown>[] | null;
  activeSnapshot: SnapshotFull | null;
  onSelectSnapshot: (snapshot: SnapshotFull) => void;
  onSnapshotSaved?: (snapshot: SnapshotFull) => void;
}

export function SnapshotsManager({
  clubId,
  analytics,
  fileNames,
  summaryRows = null,
  packageRows = null,
  activeSnapshot,
  onSelectSnapshot,
  onSnapshotSaved,
}: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Period auto-detection from file names, summary rows, and package rows
  const detected = detectPeriod(fileNames, packageRows, summaryRows);

  const [startDate, setStartDate] = useState<string>(detected.periodStart || "");
  const [endDate, setEndDate] = useState<string>(detected.periodEnd || "");
  const [snapshotName, setSnapshotName] = useState<string>(detected.name);

  // Update whenever detected period changes (e.g. new files uploaded)
  useEffect(() => {
    if (detected.periodStart) setStartDate(detected.periodStart);
    if (detected.periodEnd) setEndDate(detected.periodEnd);
    if (detected.name) setSnapshotName(detected.name);
  }, [detected.periodStart, detected.periodEnd, detected.name]);

  // Handle manual date changes
  const handleDateChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    if (newStart && newEnd) {
      const formatted = formatPeriod(newStart, newEnd);
      setSnapshotName(formatted.name);
    }
  };

  const loadSnapshotsList = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/marketing/snapshots`);
      if (!res.ok) throw new Error("Не удалось загрузить список срезов");
      const data = await res.json();
      if (Array.isArray(data)) {
        setSnapshots(data);
      }
    } catch (err: any) {
      setError(err?.message || "Ошибка загрузки срезов");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (clubId) {
      loadSnapshotsList();
    }
  }, [clubId]);

  const handleSaveCurrentSnapshot = async () => {
    if (!analytics) return;
    setSaving(true);
    setError(null);
    try {
      // Compact guest profiles to keep payload small (~1-2MB instead of 10MB+)
      const compactProfiles = analytics.profiles.map((p) => {
        const item: Record<string, any> = {
          phone: p.phone,
          name: p.name || "",
          totalSpent: Math.round(p.totalSpent || 0),
          balance: Math.round(p.balance || 0),
          status: p.status,
        };
        if (p.isWhale) item.isWhale = true;
        if (p.visits) item.visits = p.visits;
        if (p.playedMinutes) item.playedMinutes = p.playedMinutes;
        if (p.playedHours) item.playedHours = p.playedHours;
        if (p.hourlyYield) item.hourlyYield = Math.round(p.hourlyYield);
        if (p.bonusBalance) item.bonusBalance = Math.round(p.bonusBalance);
        if (p.bonusAccrued) item.bonusAccrued = Math.round(p.bonusAccrued);
        if (p.bonusSpent) item.bonusSpent = Math.round(p.bonusSpent);
        if (p.favoriteZone) item.favoriteZone = p.favoriteZone;
        if (p.favoriteTariff) item.favoriteTariff = p.favoriteTariff;
        if (p.favoriteSeat) item.favoriteSeat = p.favoriteSeat;
        if (p.topSeats && p.topSeats.length > 0) item.topSeats = p.topSeats;
        if (p.packageSpentRub !== undefined) item.packageSpentRub = Math.round(p.packageSpentRub);
        if (p.packageSpentBonus !== undefined) item.packageSpentBonus = Math.round(p.packageSpentBonus);
        if (p.packageCount !== undefined) item.packageCount = p.packageCount;
        if (p.topupAdmin !== undefined) item.topupAdmin = Math.round(p.topupAdmin);
        if (p.topupLK !== undefined) item.topupLK = Math.round(p.topupLK);
        if (p.topupApp !== undefined) item.topupApp = Math.round(p.topupApp);
        if (p.spentShop !== undefined) item.spentShop = Math.round(p.spentShop);
        if (p.gamerPersona && p.gamerPersona !== "regular") item.gamerPersona = p.gamerPersona;
        if (p.preferredTime) item.preferredTime = p.preferredTime;
        if (p.favoriteDay) item.favoriteDay = p.favoriteDay;
        if (p.topDays && p.topDays.length > 0) item.topDays = p.topDays;
        if (p.dayPattern) item.dayPattern = p.dayPattern;
        if (p.lastAuth) item.lastAuth = p.lastAuth instanceof Date ? p.lastAuth.toISOString() : String(p.lastAuth);
        if (p.daysSince !== null && p.daysSince !== undefined) item.daysSince = p.daysSince;
        return item;
      });

      // Compute monthlyBreakdown if packageRows are available
      const monthlyBreakdown: Record<string, { rub: number; bonus: number; sessions: number; hours: number }> = {};
      if (packageRows && packageRows.length > 0) {
        for (const row of packageRows) {
          const rawDate = row["Дата покупки тарифа"] || row["Дата покупки"] || row["Дата"];
          if (!rawDate) continue;
          const s = String(rawDate);
          const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
          if (!m) continue;
          const ym = `${m[3]}-${m[2]}`;
          if (!monthlyBreakdown[ym]) {
            monthlyBreakdown[ym] = { rub: 0, bonus: 0, sessions: 0, hours: 0 };
          }
          const rub = parseFloat(String(row["Списано рублей"] || 0).replace(/\s/g, "").replace(",", ".")) || 0;
          const bonus = parseFloat(String(row["Списано бонусов"] || 0).replace(/\s/g, "").replace(",", ".")) || 0;
          const tariff = String(row["Название тарифа"] || "").toLowerCase();
          let hrs = 1;
          if (tariff.includes("ночь")) hrs = 8;
          else {
            const hm = tariff.match(/(\d+)\s*(?:час|ч)/);
            if (hm) hrs = parseInt(hm[1], 10);
          }
          monthlyBreakdown[ym].rub = Math.round(monthlyBreakdown[ym].rub + rub);
          monthlyBreakdown[ym].bonus = Math.round(monthlyBreakdown[ym].bonus + bonus);
          monthlyBreakdown[ym].sessions += 1;
          monthlyBreakdown[ym].hours += hrs;
        }
      }

      const payload = {
        name: (snapshotName || detected.name || "Срез данных").trim(),
        period_start: startDate || detected.periodStart || null,
        period_end: endDate || detected.periodEnd || null,
        file_names: fileNames.filter(Boolean),
        summary_metrics: {
          totalRevenueInLog: analytics.totalRevenueInLog,
          totalGuests: analytics.totalGuests,
          totalHoursPlayed: analytics.totalHoursPlayed,
          avgHourlyYield: analytics.avgHourlyYield,
          totalVisits: analytics.totalVisits,
          activeCount: analytics.activeCount,
          churnedCount: analytics.churnedCount,
          totalPackageRub: analytics.totalPackageRub,
          totalBonusAccrued: analytics.totalBonusAccrued,
          totalBonusSpent: analytics.totalBonusSpent,
          overallBonusEmissionRate: analytics.overallBonusEmissionRate,
          abandonedBalance: analytics.abandonedBalance,
          abandonedBonus: analytics.abandonedBonus,
          monthlyBreakdown: Object.keys(monthlyBreakdown).length > 0 ? monthlyBreakdown : undefined,
        },
        guests_data: compactProfiles,
        pc_data: analytics.clubPcStats || [],
      };

      const res = await fetch(`/api/clubs/${clubId}/marketing/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка при сохранении среза в базу");
      }

      const result = await res.json();
      await loadSnapshotsList();

      // Set active
      if (result.snapshot) {
        const fullRes = await fetch(`/api/clubs/${clubId}/marketing/snapshots/${result.snapshot.id}`);
        if (fullRes.ok) {
          const fullData = await fullRes.json();
          onSelectSnapshot(fullData);
          if (onSnapshotSaved) onSnapshotSaved(fullData);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Не удалось сохранить срез");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSnapshot = async (id: string) => {
    setLoadingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/marketing/snapshots/${id}`);
      if (!res.ok) throw new Error("Не удалось загрузить данные среза");
      const fullSnapshot: SnapshotFull = await res.json();
      onSelectSnapshot(fullSnapshot);
    } catch (err: any) {
      setError(err?.message || "Ошибка загрузки среза");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteSnapshot = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Вы уверены, что хотите удалить этот сохраненный срез?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/clubs/${clubId}/marketing/snapshots/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Не удалось удалить срез");
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      setError(err?.message || "Ошибка удаления");
    } finally {
      setDeletingId(null);
    }
  };

  // Calculate days difference
  let daysSpan: number | null = null;
  if (startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diff > 0) daysSpan = diff;
  }

  return (
    <div className="space-y-6">
      {/* Save current snapshot bar with explicit Date Range controls */}
      {analytics && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FolderArchive className="w-5 h-5 text-slate-700" />
                <h3 className="font-bold text-sm text-slate-900">
                  Сохранение среза за период
                </h3>
                {daysSpan && (
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                    {daysSpan} {daysSpan === 1 ? "день" : daysSpan < 5 ? "дня" : "дней"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Укажите диапазон дат периода отчета. Срез сохранится в базу данных и будет доступен для анализа и сравнения.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-3 border-t border-slate-100">
            {/* Date range pickers */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">
                Диапазон дат отчета
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleDateChange(e.target.value, endDate)}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <span className="text-slate-400 font-bold">—</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleDateChange(startDate, e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>
            </div>

            {/* Snapshot name */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">
                Название среза
              </label>
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="Например: Сентябрь 2024..."
                className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            {/* Save Button */}
            <div className="pt-2 md:pt-0">
              <button
                onClick={handleSaveCurrentSnapshot}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium bg-black hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Сохранение в базу…</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Сохранить срез в базу</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Snapshots list */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-slate-500" />
              <span>История сохраненных срезов клуба ({snapshots.length})</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Выбирайте нужный период для просмотра или сравнения
            </p>
          </div>
          {loadingList && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>

        {snapshots.length === 0 && !loadingList ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl space-y-2">
            <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">
              Сохраненных срезов пока нет
            </p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto font-medium">
              Загрузите отчеты выше и нажмите «Сохранить срез в базу», чтобы зафиксировать период в системе.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {snapshots.map((snap) => {
              const isActive = activeSnapshot?.id === snap.id;
              const isLoadingThis = loadingId === snap.id;
              const isDeletingThis = deletingId === snap.id;
              const rev = snap.summary_metrics?.totalRevenueInLog ?? 0;
              const guests = snap.guests_count || snap.summary_metrics?.totalGuests || 0;

              return (
                <div
                  key={snap.id}
                  onClick={() => !isLoadingThis && handleLoadSnapshot(snap.id)}
                  className={cn(
                    "border rounded-xl p-4 transition-all cursor-pointer flex flex-col justify-between gap-3 text-left relative group",
                    isActive
                      ? "border-slate-900 bg-slate-50/80 shadow-xs ring-1 ring-slate-900"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-slate-900 group-hover:text-black transition-colors">
                          {snap.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-semibold bg-slate-900 text-white px-2 py-0.5 rounded-full">
                            Активен
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {(() => {
                          if (snap.period_start && snap.period_end) {
                            const s = new Date(snap.period_start);
                            const e = new Date(snap.period_end);
                            if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
                              return (
                                <span>
                                  {s.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} — {e.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                                </span>
                              );
                            }
                          }
                          const c = new Date(snap.created_at);
                          return (
                            <span>
                              {!isNaN(c.getTime()) ? c.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "—"}
                            </span>
                          );
                        })()}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleDeleteSnapshot(snap.id, e)}
                      disabled={isDeletingThis}
                      className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors"
                      title="Удалить срез"
                    >
                      {isDeletingThis ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">Выручка</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {rev > 0 ? `${rev.toLocaleString("ru")} ₽` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">Гостей</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {guests > 0 ? guests.toLocaleString("ru") : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {snap.file_names?.length || 0} файлов
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors",
                        isActive
                          ? "text-slate-900 bg-white border border-slate-200"
                          : "text-slate-600 group-hover:text-slate-900"
                      )}
                    >
                      {isLoadingThis ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Загрузка…</span>
                        </>
                      ) : isActive ? (
                        <span>✓ Выбран</span>
                      ) : (
                        <span>Открыть →</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
