"use client";

import React from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryTabProps {
  logs: {
    issuance: any[];
    games: any[];
    stats: any;
  };
}

export function HistoryTab({ logs }: HistoryTabProps) {
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
                  {logs.stats?.real_topup_month || 0}{" "}
                  <span className="text-xs not-italic font-bold text-slate-300">
                    ₽
                  </span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                  Сегодня:{" "}
                  <span className="text-amber-600">
                    +{logs.stats?.real_topup_today || 0} ₽
                  </span>
                </div>
              </div>
            </div>

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
                  {Math.round(logs.stats?.prize_money_month || 0)}{" "}
                  <span className="text-xs not-italic font-bold text-slate-300">
                    ₽
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">
                    СЕГОДНЯ:{" "}
                    <span className="text-emerald-600">
                      {Math.round(logs.stats?.prize_money_today || 0)} ₽
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-300 uppercase border-l border-slate-100 pl-2">
                    СГОРЕЛО:{" "}
                    <span className="text-slate-400">
                      -{logs.stats?.betting_losses_today || 0} ₽
                    </span>
                  </div>
                </div>
              </div>
            </div>

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
                  {logs.stats?.bonuses_used_month || 0}{" "}
                  <span className="text-xs not-italic font-bold text-slate-300">
                    ₽
                  </span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                  СЕГОДНЯ:{" "}
                  <span className="text-red-600">
                    {logs.stats?.bonuses_used_today || 0} ₽
                  </span>
                </div>
              </div>
            </div>

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
                  {logs.stats?.bonuses_used_month > 0
                    ? Math.round(
                        (logs.stats?.real_topup_month /
                          logs.stats?.bonuses_used_month) *
                          100,
                      )
                    : 0}
                  <span className="text-xs not-italic font-bold text-indigo-200 ml-1">
                    %
                  </span>
                </div>
                <div className="text-[10px] font-bold text-white/60 mt-1 uppercase">
                  Месячный КПД
                </div>
              </div>
              {/* Visual pattern background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-colors" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Issuance Logs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-4">
            <Plus className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
              Лог начислений
            </h3>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="max-h-125 overflow-y-auto">
              {logs.issuance.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold uppercase italic text-xs">
                  Логи отсутствуют
                </div>
              ) : (
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-50">
                    {logs.issuance.map((log) => (
                      <tr key={log.id} className="text-sm">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">
                            {log.player_name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {log.player_phone}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-600 uppercase">
                            {log.source === "admin_manual"
                              ? "Админ"
                              : "Авто"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-black text-orange-600">
                          +{log.batch_count || 1}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-medium text-slate-400 text-right">
                          {new Date(
                            log.created_at,
                          ).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Game History Logs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-4">
            <History className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
              Лог игр
            </h3>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="max-h-125 overflow-y-auto">
              {logs.games.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold uppercase italic text-xs">
                  Игр еще не было
                </div>
              ) : (
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-50">
                    {logs.games.map((log) => (
                      <tr key={log.id} className="text-sm">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">
                            {log.player_name}
                          </div>
                          <div className="text-[10px] text-slate-300">
                            {log.game_type}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {log.prize_name ? (
                            <div
                              className={cn(
                                "flex items-center gap-1.5 font-bold",
                                log.prize_type === "topup"
                                  ? "text-blue-500"
                                  : log.prize_type === "bar"
                                    ? "text-orange-500"
                                    : log.prize_type === "withdraw"
                                      ? "text-red-500"
                                      : log.prize_type === "bet"
                                        ? "text-slate-400 font-medium"
                                        : "text-emerald-600",
                              )}
                            >
                              {log.prize_type === "topup" && (
                                <Plus className="w-3 h-3" />
                              )}
                              {log.prize_type === "bar" && (
                                <ShoppingCart className="w-3 h-3" />
                              )}
                              {log.prize_type === "withdraw" && (
                                <Clock className="w-3 h-3" />
                              )}
                              {log.prize_type === "quest" && (
                                <Target className="w-3 h-3" />
                              )}
                              {log.prize_type === "bet" && (
                                <RefreshCw className="w-3 h-3" />
                              )}
                              {![
                                "topup",
                                "bar",
                                "withdraw",
                                "quest",
                                "bet",
                              ].includes(log.prize_type) && (
                                <Trophy className="w-3 h-3" />
                              )}
                              {log.prize_name}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-bold uppercase italic tracking-widest text-[10px]">
                              Проигрыш
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-medium text-slate-400 text-right">
                          {new Date(
                            log.created_at,
                          ).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
