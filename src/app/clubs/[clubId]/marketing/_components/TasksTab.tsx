"use client";

import { useState, useMemo, useEffect } from "react";
import { Copy, Check, Search, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientProfile, ClubAnalytics } from "./segmentation";

export type ShiftContactStatus = "none" | "contacted" | "booked" | "no_answer" | "rejected";

export interface ShiftTaskRecord {
  phone: string;
  clientName: string;
  status: ShiftContactStatus;
  contactedAt?: string; // ISO date string
  adminNote?: string;
}

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
  excludedPhones: string[];
}

const DAYS_OF_WEEK = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

const ORDERED_DAYS = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

const TIME_SLOTS = [
  { id: "all", label: "Любое время" },
  { id: "morning", label: "Утро (08:00–13:00)" },
  { id: "day", label: "День (13:00–18:00)" },
  { id: "evening", label: "Вечер (18:00–23:00)" },
  { id: "night", label: "Ночь (23:00–08:00)" },
];

export function TasksTab({ clubId, analytics, excludedPhones }: Props) {
  const storageKey = `marketing_shift_tasks_${clubId}`;

  // Constructor Filters
  const todayDayName = useMemo(() => DAYS_OF_WEEK[new Date().getDay()], []);
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [selectedTime, setSelectedTime] = useState<string>("all");
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [pcInput, setPcInput] = useState<string>("");
  const [sortMode, setSortMode] = useState<"match" | "spent_desc" | "days_desc" | "balance_desc">("match");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Copy Feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Stored Shift Task Records: map normalized 10-digit phone -> ShiftTaskRecord
  const [recordsMap, setRecordsMap] = useState<Record<string, ShiftTaskRecord>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setRecordsMap(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to read shift task records:", e);
    }
  }, [storageKey]);

  const saveRecord = (phone: string, clientName: string, status: ShiftContactStatus) => {
    const norm = phone.replace(/\D/g, "").slice(-10);
    const existing = recordsMap[norm];
    const newRecord: ShiftTaskRecord = {
      phone: norm,
      clientName: clientName || existing?.clientName || "Гость",
      status,
      contactedAt: status !== "none" ? (existing?.contactedAt || new Date().toISOString()) : undefined,
    };
    const updated = { ...recordsMap, [norm]: newRecord };
    setRecordsMap(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to persist shift task record:", e);
      }
    }
  };

  const handleResetRecords = () => {
    if (!confirm("Сбросить историю контактов текущей смены?")) return;
    setRecordsMap({});
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 1800);
  };

  // Extract distinct zones from profiles
  const availableZones = useMemo(() => {
    if (!analytics || !analytics.profiles) return [];
    const set = new Set<string>();
    for (const p of analytics.profiles) {
      if (p.favoriteZone && p.favoriteZone !== "—") {
        set.add(p.favoriteZone);
      }
    }
    return Array.from(set).sort();
  }, [analytics]);

  // Clean PC tokens from user input
  const pcTokens = useMemo(() => {
    return pcInput
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }, [pcInput]);

  // Ranked and filtered client list
  const rankedClients = useMemo(() => {
    if (!analytics || !analytics.profiles) return [];

    const query = searchQuery.trim().toLowerCase();
    const resolvedDay = selectedDay === "today" ? todayDayName : selectedDay;

    return analytics.profiles
      .filter((p) => {
        const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
        if (excludedPhones.includes(norm)) return false;

        // Search query filter
        if (query) {
          const matchName = (p.name || "").toLowerCase().includes(query);
          const matchPhone = (p.phone || "").replace(/\D/g, "").includes(query);
          if (!matchName && !matchPhone) return false;
        }

        // Contact status filter
        const rec = recordsMap[norm];
        const currentStatus: ShiftContactStatus = rec?.status || "none";
        if (statusFilter !== "all" && currentStatus !== statusFilter) {
          return false;
        }

        return true;
      })
      .map((p) => {
        const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
        const rec = recordsMap[norm];

        let score = 0;
        const matchReasons: string[] = [];

        // 1. Day match
        const isDayMatch = resolvedDay !== "all" && p.favoriteDay === resolvedDay;
        if (isDayMatch) {
          score += 40;
          matchReasons.push(p.favoriteDay || resolvedDay);
        } else if (p.favoriteDay) {
          matchReasons.push(p.favoriteDay);
        }

        // 2. Time slot match
        const isTimeMatch = selectedTime !== "all" && p.preferredTime === selectedTime;
        if (isTimeMatch && p.preferredTime) {
          score += 35;
          const slotLabel = TIME_SLOTS.find((s) => s.id === p.preferredTime)?.label?.split(" ")[0] || p.preferredTime;
          matchReasons.push(slotLabel);
        } else if (p.preferredTime) {
          const slotLabel = TIME_SLOTS.find((s) => s.id === p.preferredTime)?.label?.split(" ")[0] || p.preferredTime;
          matchReasons.push(slotLabel);
        }

        // 3. Zone match
        const isZoneMatch = selectedZone !== "all" && p.favoriteZone === selectedZone;
        if (isZoneMatch) {
          score += 30;
          matchReasons.push(p.favoriteZone || selectedZone);
        } else if (p.favoriteZone && p.favoriteZone !== "—") {
          matchReasons.push(p.favoriteZone);
        }

        // 4. PC match
        let isPcMatch = false;
        if (pcTokens.length > 0 && p.favoriteSeat) {
          const seatLower = p.favoriteSeat.toLowerCase();
          const seatDigits = seatLower.replace(/\D/g, "");
          isPcMatch = pcTokens.some((tok) => {
            const tokDigits = tok.replace(/\D/g, "");
            return seatLower.includes(tok) || (tokDigits && seatDigits === tokDigits);
          });
          if (isPcMatch) {
            score += 50;
            matchReasons.push(p.favoriteSeat);
          }
        } else if (p.favoriteSeat && p.favoriteSeat !== "—") {
          matchReasons.push(p.favoriteSeat);
        }

        // 5. Customer value & re-engagement bonuses
        if (p.daysSince && p.daysSince >= 7 && p.daysSince <= 30) {
          score += 15; // prime window for reactivation
        }
        if (p.isWhale) {
          score += 10;
        }
        if ((p.balance || 0) > 100) {
          score += 8;
        }

        // Attribution: check if guest returned after shift contact
        let attributionResult: "returned" | "waiting" | "none" = "none";
        let attributedAmount = 0;
        if (rec?.contactedAt) {
          const contactDate = new Date(rec.contactedAt);
          const lastVisitDate = p.lastAuth ? new Date(p.lastAuth) : null;
          if (lastVisitDate && lastVisitDate.getTime() >= contactDate.getTime() - 60_000) {
            attributionResult = "returned";
            // Rough attribution value: avg transaction or balance top-up
            attributedAmount = p.avgTx || Math.round(p.totalSpent / Math.max(1, p.txCount || 1)) || 500;
          } else {
            attributionResult = "waiting";
          }
        }

        // Generate tailored shift script
        const firstName = p.name ? p.name.split(" ")[0].trim() : "друг";
        const targetDayText = resolvedDay !== "all" ? resolvedDay.toLowerCase() : (p.favoriteDay ? p.favoriteDay.toLowerCase() : "сегодня");
        const targetTimeText = selectedTime === "morning" ? "утром"
          : selectedTime === "day" ? "днем"
          : selectedTime === "evening" ? "вечером"
          : selectedTime === "night" ? "на ночь"
          : "на вечер";
        const seatText = p.favoriteSeat ? `твой любимый ${p.favoriteSeat}` : "место в клубе";
        const zoneText = p.favoriteZone && p.favoriteZone !== "—" ? `в зоне ${p.favoriteZone}` : "";

        let script = "";
        if ((p.balance || 0) >= 150) {
          script = `Привет, ${firstName}! Напоминаем, что у тебя ${Math.round(p.balance)} ₽ на счете в клубе. ${seatText} ${zoneText} ${targetTimeText} свободен, забронировать за тобой?`;
        } else {
          script = `Привет, ${firstName}! Это администратор Colizeum. ${targetDayText} ${targetTimeText} ${seatText} ${zoneText} свободен. Забронировать место на катку?`;
        }

        return {
          profile: p,
          normPhone: norm,
          record: rec,
          score,
          matchDesc: matchReasons.length > 0 ? matchReasons.join(" • ") : "Любое время и зона",
          script,
          attributionResult,
          attributedAmount,
        };
      })
      .sort((a, b) => {
        if (sortMode === "match") {
          return b.score - a.score;
        }
        if (sortMode === "spent_desc") {
          return (b.profile.totalSpent || 0) - (a.profile.totalSpent || 0);
        }
        if (sortMode === "days_desc") {
          return (b.profile.daysSince || 0) - (a.profile.daysSince || 0);
        }
        if (sortMode === "balance_desc") {
          return (b.profile.balance || 0) - (a.profile.balance || 0);
        }
        return b.score - a.score;
      });
  }, [
    analytics,
    excludedPhones,
    searchQuery,
    selectedDay,
    todayDayName,
    selectedTime,
    selectedZone,
    pcTokens,
    sortMode,
    statusFilter,
    recordsMap,
  ]);

  // Overall Shift Statistics
  const shiftStats = useMemo(() => {
    let contactedCount = 0;
    let bookedCount = 0;
    let returnedCount = 0;
    let totalRevenue = 0;

    for (const item of rankedClients) {
      const st = item.record?.status;
      if (st && st !== "none") {
        contactedCount++;
        if (st === "booked") bookedCount++;
        if (item.attributionResult === "returned") {
          returnedCount++;
          totalRevenue += item.attributedAmount;
        }
      }
    }

    const conversionRate = contactedCount > 0 ? Math.round((returnedCount / contactedCount) * 100) : 0;

    return {
      total: rankedClients.length,
      contactedCount,
      bookedCount,
      returnedCount,
      conversionRate,
      totalRevenue,
    };
  }, [rankedClients]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(rankedClients.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rankedClients.slice(start, start + pageSize);
  }, [rankedClients, currentPage, pageSize]);

  if (!analytics || !analytics.profiles || analytics.profiles.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
        Загрузите отчеты клуба во вкладке «Загрузка отчетов», чтобы сформировать базу гостей для работы смены.
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans text-slate-900">
      {/* Top Header & Plain Text Summary */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Задачи смене • Дозагрузка клуба
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Подбор и ранжирование гостей под свободные слоты, дни недели и номера ПК для заполнения зала
          </p>
        </div>

        {/* Clean Shift Summary */}
        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap self-start md:self-auto bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg">
          <span>В выборке: <b className="text-slate-900 font-mono">{shiftStats.total}</b> чел.</span>
          <span className="text-slate-300">|</span>
          <span>Связались: <b className="text-slate-900 font-mono">{shiftStats.contactedCount}</b></span>
          <span className="text-slate-300">|</span>
          <span>Забронировали: <b className="text-emerald-700 font-mono">{shiftStats.bookedCount}</b></span>
          <span className="text-slate-300">|</span>
          <span>Пришли: <b className="text-slate-900 font-mono">{shiftStats.returnedCount}</b> ({shiftStats.conversionRate}%)</span>
          <span className="text-slate-300">|</span>
          <span>Выручка: <b className="text-slate-900 font-mono">{shiftStats.totalRevenue.toLocaleString("ru")} ₽</b></span>

          {shiftStats.contactedCount > 0 && (
            <button
              type="button"
              onClick={handleResetRecords}
              className="ml-2 text-[11px] text-slate-400 hover:text-rose-600 underline"
              title="Сбросить статус текущей смены"
            >
              Сброс
            </button>
          )}
        </div>
      </div>

      {/* Lightweight Slot Constructor */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Day of Week */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">День недели</label>
            <select
              value={selectedDay}
              onChange={(e) => {
                setSelectedDay(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-slate-400 font-medium cursor-pointer"
            >
              <option value="all">Все дни</option>
              <option value="today">Сегодня ({todayDayName})</option>
              {ORDERED_DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Time Slot */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">Время слота</label>
            <select
              value={selectedTime}
              onChange={(e) => {
                setSelectedTime(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-slate-400 font-medium cursor-pointer"
            >
              {TIME_SLOTS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Zone */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">Зона клуба</label>
            <select
              value={selectedZone}
              onChange={(e) => {
                setSelectedZone(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-slate-400 font-medium cursor-pointer"
            >
              <option value="all">Все зоны</option>
              {availableZones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>

          {/* PC Numbers */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">Номера ПК (через запятую)</label>
            <input
              type="text"
              value={pcInput}
              onChange={(e) => {
                setPcInput(e.target.value);
                setPage(1);
              }}
              placeholder="Напр: 14, 15, 16"
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-slate-400 font-mono placeholder:font-sans"
            />
          </div>

          {/* Sorting */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">Сортировка</label>
            <select
              value={sortMode}
              onChange={(e) => {
                setSortMode(e.target.value as any);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-slate-400 font-medium cursor-pointer"
            >
              <option value="match">По совпадению (Match)</option>
              <option value="spent_desc">По чеку LTV (макс)</option>
              <option value="days_desc">Не были дольше всех</option>
              <option value="balance_desc">С балансом на счете</option>
            </select>
          </div>

          {/* Shift Status Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">Статус смены</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-slate-400 font-medium cursor-pointer"
            >
              <option value="all">Все статусы</option>
              <option value="none">Не связывались</option>
              <option value="contacted">Связались</option>
              <option value="booked">Забронировал</option>
              <option value="no_answer">Не ответил</option>
              <option value="rejected">Отказ</option>
            </select>
          </div>
        </div>

        {/* Quick Search */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Поиск по имени или телефону..."
              className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-400 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <span>Показано: <b>{paginatedClients.length}</b> из <b>{rankedClients.length}</b></span>
            {(selectedDay !== "all" || selectedTime !== "all" || selectedZone !== "all" || pcInput || statusFilter !== "all" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDay("all");
                  setSelectedTime("all");
                  setSelectedZone("all");
                  setPcInput("");
                  setStatusFilter("all");
                  setSearchQuery("");
                  setPage(1);
                }}
                className="text-slate-400 hover:text-slate-800 underline ml-1"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Clean Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold tracking-wider text-[11px]">
                <th className="py-2.5 px-3 w-10 text-slate-400">№</th>
                <th className="py-2.5 px-3 min-w-[140px]">Гость</th>
                <th className="py-2.5 px-3 min-w-[130px]">Телефон</th>
                <th className="py-2.5 px-3 min-w-[170px]">Совпадение со слотом</th>
                <th className="py-2.5 px-3 min-w-[130px]">LTV • Баланс</th>
                <th className="py-2.5 px-3 min-w-[280px]">Текст сообщения / скрипт</th>
                <th className="py-2.5 px-3 min-w-[130px]">Отметка смены</th>
                <th className="py-2.5 px-3 min-w-[110px]">Результат</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Нет гостей, подходящих под выбранные параметры слота.
                  </td>
                </tr>
              ) : (
                paginatedClients.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const p = item.profile;
                  const norm = item.normPhone;
                  const formattedPhone = `+7 (${norm.slice(0, 3)}) ${norm.slice(3, 6)}-${norm.slice(6, 8)}-${norm.slice(8, 10)}`;
                  const isPhoneCopied = copiedKey === `phone_${norm}`;
                  const isScriptCopied = copiedKey === `script_${norm}`;
                  const currentStatus = item.record?.status || "none";

                  return (
                    <tr key={norm} className="hover:bg-slate-50/70 transition-colors">
                      {/* № */}
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] align-top">
                        {globalIdx}
                      </td>

                      {/* Guest Name & Simple Subtitle */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-semibold text-slate-900 leading-tight">
                          {p.name || "Гость клуба"}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {p.isWhale ? "VIP-кит" : p.daysSince ? `не был ${p.daysSince} дн.` : "Регуляр"}
                        </div>
                      </td>

                      {/* Phone with 1-click copy */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(`+7${norm}`, `phone_${norm}`)}
                          className="font-mono text-xs text-slate-800 hover:text-slate-950 flex items-center gap-1.5 text-left group"
                          title="Кликните, чтобы скопировать номер"
                        >
                          <span>{formattedPhone}</span>
                          {isPhoneCopied ? (
                            <span className="text-[10px] text-emerald-600 font-sans font-medium">✓ скопирован</span>
                          ) : (
                            <Copy className="w-3 h-3 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
                          )}
                        </button>
                      </td>

                      {/* Match Details */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-medium text-slate-800 leading-tight">
                          {item.matchDesc}
                        </div>
                        {item.score > 0 && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            индекс совпадения: {item.score}
                          </div>
                        )}
                      </td>

                      {/* LTV & Balance */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap font-mono text-[11px]">
                        <div className="font-semibold text-slate-900">
                          {Math.round(p.totalSpent || 0).toLocaleString("ru")} ₽
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          Баланс: {Math.round(p.balance || 0).toLocaleString("ru")} ₽
                          {(p.bonusBalance || 0) > 0 && ` • ${Math.round(p.bonusBalance)} Б`}
                        </div>
                      </td>

                      {/* Ready Script with Copy button */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11px] text-slate-700 leading-relaxed font-sans select-all pr-1">
                            «{item.script}»
                          </p>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.script, `script_${norm}`)}
                            className={cn(
                              "text-xs px-2 py-1 rounded border transition-colors shrink-0 flex items-center gap-1 font-medium whitespace-nowrap",
                              isScriptCopied
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                            )}
                            title="Скопировать текст сообщения"
                          >
                            {isScriptCopied ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Скопировано</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-400" />
                                <span>Скопировать</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Shift Contact Status Selector */}
                      <td className="py-2.5 px-3 align-top">
                        <select
                          value={currentStatus}
                          onChange={(e) => saveRecord(p.phone, p.name, e.target.value as ShiftContactStatus)}
                          className={cn(
                            "w-full text-xs border rounded-md px-2 py-1 font-medium focus:outline-none cursor-pointer transition-colors",
                            currentStatus === "booked"
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold"
                              : currentStatus === "contacted"
                              ? "bg-blue-50 border-blue-300 text-blue-800"
                              : currentStatus === "rejected"
                              ? "bg-slate-100 border-slate-200 text-slate-500"
                              : currentStatus === "no_answer"
                              ? "bg-amber-50 border-amber-300 text-amber-800"
                              : "bg-white border-slate-200 text-slate-600"
                          )}
                        >
                          <option value="none">Не связывались</option>
                          <option value="contacted">Связались</option>
                          <option value="booked">Забронировал</option>
                          <option value="no_answer">Не ответил</option>
                          <option value="rejected">Отказ</option>
                        </select>
                      </td>

                      {/* Attribution / Did client arrive? */}
                      <td className="py-2.5 px-3 align-top whitespace-nowrap text-xs">
                        {item.attributionResult === "returned" ? (
                          <span className="font-semibold text-emerald-700 font-mono">
                            Пришел (+{item.attributedAmount.toLocaleString("ru")} ₽)
                          </span>
                        ) : item.attributionResult === "waiting" ? (
                          <span className="text-slate-400 text-[11px]">
                            Пока не был
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Clean Pagination Footer */}
        {rankedClients.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Строк на странице:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-800 cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-mono">
                Страница {currentPage} из {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Предыдущая страница"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Следующая страница"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
