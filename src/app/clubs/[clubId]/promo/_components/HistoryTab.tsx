"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  Gamepad2,
  User,
  Coins,
  Plus,
  ShoppingCart,
  Clock,
  Target,
  RefreshCw,
  Trophy,
  History,
  Search,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryTabProps {
  logs: {
    issuance: any[];
    games: any[];
    stats: any;
  };
  clubId: string;
}

export function HistoryTab({ logs, clubId }: HistoryTabProps) {
  // Explorer States
  const [activeSubTab, setActiveSubTab] = useState<"games" | "issuance">("games");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentLogs, setCurrentLogs] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page to 1 when search or filters change
  useEffect(() => {
    setPage(1);
  }, [activeSubTab, debouncedSearch, gameFilter, dateRange]);

  // Fetch paginated logs
  useEffect(() => {
    let active = true;
    const fetchLogs = async () => {
      setIsFetching(true);
      try {
        const offset = (page - 1) * pageSize;
        const url = `/api/promo/admin/logs?clubId=${clubId}&logType=${activeSubTab}&limit=${pageSize}&offset=${offset}&search=${encodeURIComponent(debouncedSearch)}&gameType=${gameFilter}&dateFilter=${dateRange}`;
        const res = await fetch(url);
        const data = await res.json();
        if (active && data.success) {
          setCurrentLogs(data.logs || []);
          setTotalLogs(data.total || 0);
        }
      } catch (err) {
        console.error("Error fetching logs:", err);
      } finally {
        if (active) setIsFetching(false);
      }
    };

    fetchLogs();
    return () => {
      active = false;
    };
  }, [clubId, activeSubTab, debouncedSearch, gameFilter, dateRange, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      {/* Stats Header */}
      <div className="space-y-6">
        {/* Row 1: Активность сегодня */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-4">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Пульс клуба (Сегодня)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Ticket className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Выдано билетов
                </div>
              </div>
              <div className="text-2xl font-black italic">
                {logs.stats?.tickets_issued_today || 0}{" "}
                <span className="text-xs not-italic font-bold text-slate-300">
                  шт.
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Gamepad2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Сыграно игр
                </div>
              </div>
              <div className="text-2xl font-black italic">
                {logs.stats?.games_played_today || 0}{" "}
                <span className="text-xs not-italic font-bold text-slate-300">
                  сессий
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Активные игроки
                </div>
              </div>
              <div className="text-2xl font-black italic">
                {logs.stats?.active_players_today || 0}{" "}
                <span className="text-xs not-italic font-bold text-slate-300">
                  чел.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Экономика месяца */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-4">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Экономика и КПД (Месяц)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm border-b-4 border-b-amber-500/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Coins className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Пополнения (Касса)
                </div>
              </div>
              <div className="flex flex-col">
                <div className="text-2xl font-black italic">
                  {Math.round(parseFloat(logs.stats?.real_topup_month || 0))}{" "}
                  <span className="text-xs not-italic font-bold text-slate-300">
                    ₽
                  </span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                  Сегодня:{" "}
                  <span className="text-amber-600">
                    +{Math.round(parseFloat(logs.stats?.real_topup_today || 0))} ₽
                  </span>
                </div>
              </div>
            </div>

            {(() => {
              const prizeMoneyMonth = parseFloat(logs.stats?.prize_money_month || 0);
              const bettingLossesMonth = parseFloat(logs.stats?.betting_losses_month || 0);
              const burnRateMonth = prizeMoneyMonth > 0 ? Math.round(bettingLossesMonth / prizeMoneyMonth * 100) : 0;
              let burnLabel = "🟢 В норме (35-50%)";
              let burnColor = "text-emerald-600 bg-emerald-50 border-emerald-100";
              if (burnRateMonth < 35) {
                burnLabel = "🟡 Низкое (риск инфляции)";
                burnColor = "text-amber-600 bg-amber-50 border-amber-100";
              } else if (burnRateMonth > 50) {
                burnLabel = "🔴 Высокое (риск выгорания)";
                burnColor = "text-rose-600 bg-rose-50 border-rose-100";
              }

              return (
                <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm border-b-4 border-b-emerald-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Plus className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Новые бонусы (Net)
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-2xl font-black italic">
                      {Math.round(prizeMoneyMonth)}{" "}
                      <span className="text-xs not-italic font-bold text-slate-300">
                        ₽
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      <div className="flex items-center gap-2">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">
                          СЕГОДНЯ: <span className="text-emerald-600">+{Math.round(parseFloat(logs.stats?.prize_money_today || 0))} ₽</span>
                        </div>
                        <div className="text-[9px] font-bold text-slate-300 uppercase border-l border-slate-100 pl-2">
                          СГОРЕЛО: <span className="text-slate-400">-{Math.round(parseFloat(logs.stats?.betting_losses_today || 0))} ₽</span>
                        </div>
                      </div>
                      <div className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded border inline-block w-fit tracking-wider", burnColor)}>
                        Сгорание: {burnRateMonth}% • {burnLabel}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm border-b-4 border-b-red-500/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-red-600" />
                </div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Оказано услуг
                </div>
              </div>
              <div className="flex flex-col">
                <div className="text-2xl font-black italic">
                  {Math.round(parseFloat(logs.stats?.bonuses_used_month || 0))}{" "}
                  <span className="text-xs not-italic font-bold text-slate-300">
                    ₽
                  </span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                  СЕГОДНЯ:{" "}
                  <span className="text-red-600">
                    {Math.round(parseFloat(logs.stats?.bonuses_used_today || 0))} ₽
                  </span>
                </div>
              </div>
            </div>

            {(() => {
              const realTopupMonth = parseFloat(logs.stats?.real_topup_month || 0);
              const bonusesUsedMonth = parseFloat(logs.stats?.bonuses_used_month || 0);
              const nomROI = bonusesUsedMonth > 0 ? Math.round(realTopupMonth / bonusesUsedMonth * 100) : 0;
              let roiLabel = "👍 В пределах нормы (65-85%)";
              let roiBadgeColor = "bg-white/20 text-white border-white/30";
              if (nomROI < 65) {
                roiLabel = "⚠️ Низкий КПД (лимиты мягкие)";
                roiBadgeColor = "bg-rose-500/30 text-rose-100 border-rose-400/30";
              } else if (nomROI > 85) {
                roiLabel = "🔥 Высокая окупаемость (>85%)";
                roiBadgeColor = "bg-emerald-500/30 text-emerald-100 border-emerald-400/30";
              }

              return (
                <div className="bg-indigo-600 p-5 rounded-3xl shadow-xl shadow-indigo-200 relative overflow-hidden group">
                  <div className="flex items-center gap-3 mb-2 relative z-10">
                    <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center">
                      <Target className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                      Окупаемость (ROI)
                    </div>
                  </div>
                  <div className="flex flex-col relative z-10">
                    <div className="text-2xl font-black italic text-white">
                      {nomROI}
                      <span className="text-xs not-italic font-bold text-indigo-200 ml-1">
                        %
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      <div className="text-[10px] font-bold text-white/60 uppercase">
                        Номинальный КПД
                      </div>
                      <div className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded border inline-block w-fit tracking-wider", roiBadgeColor)}>
                        {roiLabel}
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-colors" />
                </div>
              );
            })()}
          </div>
        </div>

        {/* Row 3: Детализация расходов и Реальная окупаемость */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-4">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Детализация расходов и Реальная Окупаемость (Месяц)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const withdrawsMonth = parseFloat(logs.stats?.withdraws_month || 0);
              const withdrawsToday = parseFloat(logs.stats?.withdraws_today || 0);
              const barBonusRetailMonth = parseFloat(logs.stats?.bar_bonus_retail_month || 0);
              const barBonusRetailToday = parseFloat(logs.stats?.bar_bonus_retail_today || 0);
              const barBonusCostMonth = parseFloat(logs.stats?.bar_bonus_cost_month || 0);
              const barBonusCostToday = parseFloat(logs.stats?.bar_bonus_cost_today || 0);
              const realTopupMonth = parseFloat(logs.stats?.real_topup_month || 0);

              const realExpense = withdrawsMonth + barBonusCostMonth;
              const realROI = realExpense > 0 
                ? Math.round(realTopupMonth / realExpense * 100) 
                : 0;
              const netProfit = realTopupMonth - realExpense;

              let realRoiLabel = "👍 Хорошая окупаемость";
              let realRoiBadgeColor = "bg-white/20 text-white border-white/30";
              if (realROI > 120) {
                realRoiLabel = "🔥 Отличная окупаемость (>120%)";
                realRoiBadgeColor = "bg-white/30 text-white border-white/40 shadow-sm animate-pulse";
              } else if (realROI < 100) {
                realRoiLabel = "⚠️ Внимание: окупаемость < 100%";
                realRoiBadgeColor = "bg-rose-500/30 text-rose-100 border-rose-400/30";
              }

              return (
                <>
                  {/* Card 1: Выводы на ПК */}
                  <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm border-b-4 border-b-sky-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                        <Coins className="w-4 h-4 text-sky-600" />
                      </div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Выводы на баланс
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="text-2xl font-black italic">
                        {Math.round(withdrawsMonth)}{" "}
                        <span className="text-xs not-italic font-bold text-slate-300">
                          ₽
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                        Сегодня:{" "}
                        <span className="text-sky-600">
                          +{Math.round(withdrawsToday)} ₽
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Покупки в баре (розница) */}
                  <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm border-b-4 border-b-orange-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Покупки в баре (Розница)
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="text-2xl font-black italic">
                        {Math.round(barBonusRetailMonth)}{" "}
                        <span className="text-xs not-italic font-bold text-slate-300">
                          бон.
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                        Сегодня:{" "}
                        <span className="text-orange-600">
                          +{Math.round(barBonusRetailToday)} бон.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Себестоимость подарков */}
                  <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm border-b-4 border-b-rose-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                        <Target className="w-4 h-4 text-rose-600" />
                      </div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Себестоимость подарков
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="text-2xl font-black italic">
                        {Math.round(barBonusCostMonth)}{" "}
                        <span className="text-xs not-italic font-bold text-slate-300">
                          ₽
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                        Сегодня:{" "}
                        <span className="text-rose-600">
                          +{Math.round(barBonusCostToday)} ₽
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Реальный ROI (по себестоимости) */}
                  <div className="bg-emerald-600 p-5 rounded-3xl shadow-xl shadow-emerald-200 relative overflow-hidden group">
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                      <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-white" />
                      </div>
                      <div className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                        Реальный ROI (Чистый КПД)
                      </div>
                    </div>
                    <div className="flex flex-col relative z-10">
                      <div className="text-2xl font-black italic text-white">
                        {realROI}
                        <span className="text-xs not-italic font-bold text-emerald-200 ml-1">
                          %
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="text-[10px] font-bold text-white/80 uppercase">
                          Профит:{" "}
                          <span className="text-white font-black">
                            {netProfit > 0 ? `+${Math.round(netProfit)}` : Math.round(netProfit)} ₽
                          </span>
                        </div>
                        <div className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded border inline-block w-fit tracking-wider", realRoiBadgeColor)}>
                          {realRoiLabel}
                        </div>
                      </div>
                    </div>
                    {/* Pattern background */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-colors" />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* EXTENDED LOGS EXPLORER */}
      <div className="space-y-6 bg-white border border-slate-200 p-6 md:p-8 rounded-[2.5rem] shadow-sm">
        {/* Header & Sub-Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <History className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase italic text-slate-900">
                Журнал <span className="text-indigo-600">операций</span>
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Просмотр и фильтрация всех логов
              </p>
            </div>
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
            <button
              onClick={() => setActiveSubTab("games")}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200 font-black uppercase italic text-xs tracking-wider",
                activeSubTab === "games"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              Игры и Действия
            </button>
            <button
              onClick={() => setActiveSubTab("issuance")}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200 font-black uppercase italic text-xs tracking-wider",
                activeSubTab === "issuance"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Ticket className="w-3.5 h-3.5" />
              Начисления билетов
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
              Поиск игрока
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Имя или телефон..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-2xl py-3.5 pl-11 pr-4 text-xs font-bold transition-all outline-none"
              />
            </div>
          </div>

          {/* Date Filter Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
              Период времени
            </label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-2xl py-3.5 pl-11 pr-10 text-xs font-bold transition-all outline-none appearance-none cursor-pointer"
              >
                <option value="all">За всё время</option>
                <option value="today">Сегодня</option>
                <option value="yesterday">Вчера</option>
                <option value="week">За 7 дней</option>
                <option value="month">За 30 дней</option>
              </select>
            </div>
          </div>

          {/* Game Type Filter (Only for Games tab) */}
          {activeSubTab === "games" && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                Тип операции
              </label>
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  value={gameFilter}
                  onChange={(e) => setGameFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-2xl py-3.5 pl-11 pr-10 text-xs font-bold transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="all">Все операции</option>
                  <option value="mines">Mines (Мины)</option>
                  <option value="rocket">Rocket (Краш)</option>
                  <option value="dice">Кости</option>
                  <option value="safe">Сейф</option>
                  <option value="cards">Карты</option>
                  <option value="flappy">Flappy</option>
                  <option value="CASE_OPEN">Открытие кейсов</option>
                  <option value="CASE_REFUND">Возврат за кейсы</option>
                  <option value="BAR_BONUS_PURCHASE">Покупки в Маркете</option>
                  <option value="WITHDRAW">Выводы на ПК</option>
                  <option value="rewards">Пополнения и квесты</option>
                  <option value="other_games">Прочие действия</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Logs Table Area */}
        <div className="bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden relative min-h-[300px]">
          {isFetching && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Загрузка логов...
                </span>
              </div>
            </div>
          )}

          {currentLogs.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-bold uppercase italic text-xs flex flex-col items-center gap-2">
              <History className="w-8 h-8 text-slate-300 mb-1" />
              Логи не найдены
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-100/50">
                    <th className="px-6 py-4">Игрок</th>
                    {activeSubTab === "games" ? (
                      <>
                        <th className="px-6 py-4">Тип действия</th>
                        <th className="px-6 py-4">Событие / Результат</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4">Источник</th>
                        <th className="px-6 py-4">Количество билетов</th>
                      </>
                    )}
                    <th className="px-6 py-4 text-right">Время</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {currentLogs.map((log) => (
                    <tr key={log.id} className="text-xs hover:bg-slate-50 transition-colors">
                      {/* Column 1: Player info */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">
                          {log.player_name || "Неизвестный"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {log.player_phone}
                        </div>
                      </td>

                      {activeSubTab === "games" ? (
                        <>
                          {/* Column 2 (Games): Action type */}
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-600 uppercase tracking-wider">
                              {log.game_type}
                            </span>
                          </td>
                          {/* Column 3 (Games): Result / Prize */}
                          <td className="px-6 py-4">
                            {log.prize_name ? (
                              <div
                                className={cn(
                                  "flex items-center gap-1.5 font-bold text-xs",
                                  log.prize_type === "topup"
                                    ? "text-blue-600"
                                    : log.prize_type === "bar"
                                      ? "text-orange-600"
                                      : log.prize_type === "withdraw"
                                        ? "text-red-600"
                                        : log.prize_type === "bet"
                                          ? "text-slate-400 font-medium"
                                          : "text-emerald-600"
                                )}
                              >
                                {log.prize_type === "topup" && <Plus className="w-3.5 h-3.5" />}
                                {log.prize_type === "bar" && <ShoppingCart className="w-3.5 h-3.5" />}
                                {log.prize_type === "withdraw" && <Clock className="w-3.5 h-3.5" />}
                                {log.prize_type === "quest" && <Target className="w-3.5 h-3.5" />}
                                {log.prize_type === "bet" && <RefreshCw className="w-3.5 h-3.5" />}
                                {![
                                  "topup",
                                  "bar",
                                  "withdraw",
                                  "quest",
                                  "bet",
                                ].includes(log.prize_type) && <Trophy className="w-3.5 h-3.5" />}
                                {log.prize_name}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-bold uppercase italic tracking-widest text-[9px]">
                                Проигрыш
                              </span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Column 2 (Issuance): Source */}
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-600 uppercase tracking-wider">
                              {log.source === "admin_manual" ? "Админ" : "Автоматически"}
                            </span>
                          </td>
                          {/* Column 3 (Issuance): Count */}
                          <td className="px-6 py-4 font-black text-orange-600 text-sm">
                            +{log.batch_count || 1}
                          </td>
                        </>
                      )}

                      {/* Last Column: Time */}
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-400 text-right whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination Row */}
        {totalLogs > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
            {/* Logs Count Info */}
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Показано {currentLogs.length} из {totalLogs} записей
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isFetching}
                className="p-2.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl transition-all outline-none"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>

              <div className="text-xs font-black uppercase italic tracking-wider text-slate-900 px-4">
                Страница {page} из {totalPages}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isFetching}
                className="p-2.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl transition-all outline-none"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
