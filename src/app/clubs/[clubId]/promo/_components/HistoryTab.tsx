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

const getGameTypeRussian = (type: string) => {
  const t = type?.toLowerCase() || "";
  switch (t) {
    case "service_award":
      return "Услуга";
    case "service_award_voided":
      return "Отмена услуги";
    case "topup":
    case "smartshell_topup":
      return "Пополнение";
    case "topup_voided":
      return "Отмена пополнения";
    case "withdraw":
      return "Вывод";
    case "bar_bonus_purchase":
    case "pos_sale":
      return "Покупка в баре";
    case "case_open":
      return "Открытие кейса";
    case "case_refund":
      return "Возврат за кейс";
    case "wheel":
      return "Колесо фортуны";
    case "safe":
      return "Сейф";
    case "dice":
      return "Кости";
    case "cards":
      return "Карты";
    case "defuse":
      return "Сапёр C4";
    case "flappy":
      return "Флаппи";
    case "mines":
      return "Мины";
    case "rocket":
      return "Ракета";
    case "plinko":
      return "Плинко";
    case "tower":
      return "Башня";
    case "coinflip":
      return "Монетка";
    case "hilo":
      return "Hi-Lo";
    case "visit":
      return "Визит";
    case "tournament":
      return "Турнир";
    case "frag":
      return "Матч / Фраги";
    case "quest_reward":
      return "Квест";
    case "referral_fixed_award":
    case "referral_percent_award":
      return "Реферал";
    default:
      if (t.startsWith("inventory_use")) return "Предмет";
      return type || "Действие";
  }
};

const getTicketSourceRussian = (src: string) => {
  switch (src?.toLowerCase()) {
    case "topup":
      return "Пополнение";
    case "pos_sale":
      return "Бар / Продажа";
    case "service_award":
      return "Услуга";
    case "admin_manual":
    case "admin_edit":
      return "Администратор";
    case "quest_reward":
      return "Квест";
    case "bp_reward":
      return "Battle Pass";
    case "registration_bonus":
    case "welcome_bonus":
      return "Регистрация";
    case "login_bonus":
      return "Вход";
    default:
      return src || "Система";
  }
};

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
  const [totalLogs, setTotalLogs] = useState(() => (logs?.games?.length || 0));
  const [currentLogs, setCurrentLogs] = useState<any[]>(() => logs?.games || []);
  const [isFetching, setIsFetching] = useState(() => !logs?.games?.length);

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
    <div className="space-y-8">
      {/* Stats Header */}
      {(() => {
        const realTopupMonth = Math.round(parseFloat(logs.stats?.real_topup_month || 0));
        const realTopupToday = Math.round(parseFloat(logs.stats?.real_topup_today || 0));
        const bonusesUsedMonth = Math.round(parseFloat(logs.stats?.bonuses_used_month || 0));
        const bonusesUsedToday = Math.round(parseFloat(logs.stats?.bonuses_used_today || 0));
        const cashbackPercent =
          realTopupMonth > 0 ? Math.round((bonusesUsedMonth / realTopupMonth) * 100) : 0;
        const totalBonusOnHands = Math.round(parseFloat(logs.stats?.total_bonus_debt || 0));
        const ticketsToday = logs.stats?.tickets_issued_today || 0;
        const gamesToday = logs.stats?.games_played_today || 0;
        const playersToday = logs.stats?.active_players_today || 0;

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Принесли в кассу */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
              <div className="text-xs font-semibold text-slate-500">
                Принесли в кассу (месяц)
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold tracking-tight text-slate-900">
                  {realTopupMonth.toLocaleString("ru-RU")}{" "}
                  <span className="text-sm font-medium text-slate-400">₽</span>
                </div>
                <div className="text-xs font-medium text-slate-500 mt-1.5">
                  Сегодня:{" "}
                  <span className="text-emerald-600 font-semibold">
                    +{realTopupToday.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Забрали бонусами */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  Забрали бонусами (месяц)
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold whitespace-nowrap shrink-0",
                    cashbackPercent <= 25
                      ? "text-emerald-600"
                      : cashbackPercent <= 40
                        ? "text-amber-600"
                        : "text-rose-600"
                  )}
                  title="Доля выведенных бонусов от суммы пополнений за месяц"
                >
                  {cashbackPercent}% от кассы
                </span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold tracking-tight text-slate-900">
                  {bonusesUsedMonth.toLocaleString("ru-RU")}{" "}
                  <span className="text-sm font-medium text-slate-400">₽</span>
                </div>
                <div className="text-xs font-medium text-slate-500 mt-1.5">
                  Сегодня:{" "}
                  <span className="text-slate-900 font-semibold">
                    {bonusesUsedToday.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Бонусов на руках */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
              <div className="text-xs font-semibold text-slate-500">
                Бонусов на руках у игроков
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold tracking-tight text-slate-900">
                  {totalBonusOnHands.toLocaleString("ru-RU")}{" "}
                  <span className="text-sm font-medium text-slate-400">₽</span>
                </div>
                <div className="text-xs text-slate-400 mt-1.5">
                  Накоплено на балансах, ещё не выведено
                </div>
              </div>
            </div>

            {/* 4. Активность сегодня */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-semibold text-slate-500">
                  Активность сегодня
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 pt-1">
                <div>
                  <div className="text-xl font-bold text-slate-900 leading-none">
                    {ticketsToday}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">билетов</div>
                </div>
                <div className="border-l border-slate-100 pl-3">
                  <div className="text-xl font-bold text-slate-900 leading-none">
                    {gamesToday}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">игр</div>
                </div>
                <div className="border-l border-slate-100 pl-3">
                  <div className="text-xl font-bold text-slate-900 leading-none">
                    {playersToday}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">игроков</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EXTENDED LOGS EXPLORER */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Header & Sub-Tabs */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Журнал операций
            </h3>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Просмотр и фильтрация всех логов промо-системы
            </p>
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveSubTab("games")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg transition-all text-xs font-medium cursor-pointer",
                activeSubTab === "games"
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span>Игры и Действия</span>
            </button>
            <button
              onClick={() => setActiveSubTab("issuance")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg transition-all text-xs font-medium cursor-pointer",
                activeSubTab === "issuance"
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span>Начисления билетов</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="p-5 sm:p-6 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-600">
              Поиск игрока
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Имя или телефон..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl h-10 pl-9 pr-3 text-xs font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none"
              />
            </div>
          </div>

          {/* Date Filter Select */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-600">
              Период времени
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl h-10 pl-9 pr-8 text-xs font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none appearance-none cursor-pointer"
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
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">
                Тип операции
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  value={gameFilter}
                  onChange={(e) => setGameFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl h-10 pl-9 pr-8 text-xs font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="all">Все операции</option>
                  <option value="wheel">Колесо фортуны</option>
                  <option value="dice">Кости</option>
                  <option value="safe">Сейф</option>
                  <option value="cards">Карты</option>
                  <option value="defuse">Сапёр C4</option>
                  <option value="CASE_OPEN">Открытие кейсов</option>
                  <option value="CASE_REFUND">Возврат за кейсы</option>
                  <option value="WITHDRAW">Выводы на ПК</option>
                  <option value="rewards">Пополнения и награды</option>
                  <option value="other_games">Прочие действия</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Logs Table Area */}
        <div className="relative min-h-[300px]">
          {isFetching && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="text-xs font-medium text-slate-500">
                  Загрузка логов...
                </span>
              </div>
            </div>
          )}

          {currentLogs.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
              <History className="w-8 h-8 text-slate-300 mb-1" />
              Логи не найдены
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/70 text-xs font-semibold text-slate-500 bg-slate-50/80">
                    <th className="px-6 py-3.5">Игрок</th>
                    {activeSubTab === "games" ? (
                      <>
                        <th className="px-6 py-3.5">Тип действия</th>
                        <th className="px-6 py-3.5">Событие / Результат</th>
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
                            <span className="text-xs font-medium text-slate-700">
                              {getGameTypeRussian(log.game_type)}
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
                                      : log.prize_type === "withdraw" || log.game_type === "WITHDRAW"
                                        ? "text-rose-600"
                                        : log.prize_type === "bet"
                                          ? "text-slate-400 font-medium"
                                          : "text-emerald-600"
                                )}
                              >
                                {log.prize_type === "topup" && <Plus className="w-3.5 h-3.5" />}
                                {log.prize_type === "bar" && <ShoppingCart className="w-3.5 h-3.5" />}
                                {(log.prize_type === "withdraw" || log.game_type === "WITHDRAW") && <Clock className="w-3.5 h-3.5" />}
                                {log.prize_type === "quest" && <Target className="w-3.5 h-3.5" />}
                                {log.prize_type === "bet" && <RefreshCw className="w-3.5 h-3.5" />}
                                {![
                                  "topup",
                                  "bar",
                                  "withdraw",
                                  "quest",
                                  "bet",
                                ].includes(log.prize_type) && log.game_type !== "WITHDRAW" && <Trophy className="w-3.5 h-3.5" />}
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
                            <span className="text-xs font-medium text-slate-700">
                              {getTicketSourceRussian(log.source)}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 border-t border-slate-100 bg-white">
            {/* Logs Count Info */}
            <div className="text-xs font-medium text-slate-500">
              Показано {currentLogs.length} из {totalLogs} записей
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isFetching}
                className="h-9 px-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-all text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Назад</span>
              </button>

              <div className="text-xs font-semibold text-slate-900 px-2">
                {page} / {totalPages}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isFetching}
                className="h-9 px-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-all text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <span>Вперед</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
