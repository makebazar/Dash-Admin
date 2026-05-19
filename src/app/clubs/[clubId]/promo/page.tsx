"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Ticket,
  Trophy,
  Settings,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  Clock,
  History,
  BarChart3,
  User,
  ExternalLink,
  ChevronRight,
  Gift,
  RefreshCw,
  Info,
  Disc,
  Lock,
  Dice5,
  Bomb,
  Coins,
  Rocket as RocketIcon,
  CreditCard as CardIcon,
  Bird,
  Gamepad2,
  ShoppingCart,
  Search,
  X,
  Target,
} from "lucide-react";

type QueueItem = {
  id: string;
  player_name: string;
  player_phone: string;
  prize_name: string;
  prize_type: string;
  status: "pending" | "claimed" | "canceled";
  created_at: string;
};
import { motion, AnimatePresence } from "framer-motion";
import { LevelsTab } from "./_components/LevelsTab";
import { QuestsTab } from "./_components/QuestsTab";
import { VerificationTab } from "./_components/VerificationTab";
import { BattlePassTab } from "./_components/BattlePassTab";
import { BPActivationButton } from "./_components/BPActivationButton";
import { GamesTab, type Prize, GAMES } from "./_components/GamesTab";

/**
 * ПАНЕЛЬ УПРАВЛЕНИЯ АКЦИЯМИ (ДЛЯ ВЛАДЕЛЬЦА / УПРАВА)
 */

export default function PromotionsPage() {
  const { clubId } = useParams();
  const [activeTab, setActiveTab] = useState<
    | "queue"
    | "players"
    | "history"
    | "games"
    | "general"
    | "services"
    | "bar"
    | "levels"
    | "quests"
    | "verification"
    | "battlepass"
  >("queue");

  const [settings, setSettings] = useState<any>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<{
    issuance: any[];
    games: any[];
    stats: any;
  }>({ issuance: [], games: [], stats: {} });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Players Tab State
  const [players, setPlayers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueForm, setIssueForm] = useState({
    phone: "",
    amount: "",
    mode: "amount" as "amount" | "count",
    ticketCount: "1",
  });
  const [selectedGame, setSelectedGame] = useState<string>("wheel");

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [clubId]);

  const fetchData = async () => {
    try {
      const [settingsRes, prizesRes, queueRes, logsRes, playersRes] =
        await Promise.all([
          fetch(`/api/clubs/${clubId}`),
          fetch(`/api/promo/admin/prizes?clubId=${clubId}`),
          fetch(`/api/promo/admin/queue?clubId=${clubId}`),
          fetch(`/api/promo/admin/logs?clubId=${clubId}`),
          fetch(`/api/promo/admin/players?clubId=${clubId}`),
        ]);

      const settingsData = await settingsRes.json();
      const prizesData = await prizesRes.json();
      const queueData = await queueRes.json();
      const logsData = await logsRes.json();
      const playersData = await playersRes.json();

      setSettings(settingsData.club?.promo_settings || {});
      setPrizes(prizesData.prizes || []);
      setQueue(queueData.queue || []);
      setLogs({
        issuance: logsData?.issuanceLogs || [],
        games: logsData?.gameLogs || [],
        stats: logsData?.stats || {},
      });
      setPlayers(playersData.players || []);
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: any) => {
    setIsSaving(true);
    try {
      await fetch(`/api/clubs/${clubId}/promo-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
      });
      setSettings(newSettings);
    } catch (error) {
      console.error("Save Settings Error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClaim = async (id: string) => {
    try {
      await fetch(`/api/promo/admin/queue/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "claim" }),
      });
      fetchData();
    } catch (error) {
      console.error("Claim Prize Error:", error);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await fetch(`/api/promo/admin/queue/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancel" }),
      });
      fetchData();
    } catch (error) {
      console.error("Cancel Prize Error:", error);
    }
  };

  const handleIssueTickets = async () => {
    if (!issueForm.phone) return;
    setIsIssuing(true);
    try {
      const res = await fetch(`/api/promo/admin/issue-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: issueForm.phone,
          amount: issueForm.amount,
          mode: issueForm.mode,
          ticketCount: issueForm.ticketCount,
          clubId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIssueForm({
          phone: "",
          amount: "",
          mode: "amount",
          ticketCount: "1",
        });
        fetchData();
      }
    } catch (error) {
      console.error("Issue Tickets Error:", error);
    } finally {
      setIsIssuing(false);
    }
  };

  const resetPlayerTickets = async (playerId: string) => {
    if (!confirm("Вы уверены, что хотите обнулить все активные билеты игрока?"))
      return;
    try {
      await fetch(
        `/api/promo/admin/issue-tickets?clubId=${clubId}&playerId=${playerId}`,
        {
          method: "DELETE",
        },
      );
      fetchData();
    } catch (error) {
      console.error("Reset Tickets Error:", error);
    }
  };

  const resetPlayerPin = async (playerId: string) => {
    if (
      !confirm("Сбросить PIN-код игрока? Он сможет установить новый при входе.")
    )
      return;
    try {
      await fetch(`/api/promo/admin/players/reset-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, clubId }),
      });
      alert("PIN-код сброшен");
    } catch (error) {
      console.error("Reset PIN Error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter italic uppercase">
              Promo <span className="text-orange-500">Engine</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
              Управление маркетингом и лояльностью
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "queue", label: "Очередь", icon: Trophy, color: "orange" },
              { id: "players", label: "Игроки", icon: User, color: "blue" },
              {
                id: "history",
                label: "История",
                icon: History,
                color: "emerald",
              },
              { id: "games", label: "Игры", icon: Gamepad2, color: "indigo" },
              { id: "levels", label: "Уровни", icon: Target, color: "purple" },
              { id: "quests", label: "Квесты", icon: Plus, color: "pink" },
              {
                id: "battlepass",
                label: "Battle Pass",
                icon: Disc,
                color: "yellow",
              },
              {
                id: "verification",
                label: "Верификация",
                icon: CheckCircle2,
                color: "emerald",
              },
              {
                id: "general",
                label: "Настройки",
                icon: Settings,
                color: "slate",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-2.5 rounded-2xl transition-all duration-300 font-black uppercase italic text-xs tracking-wider",
                  activeTab === tab.id
                    ? `bg-${tab.color}-500 text-white shadow-lg shadow-${tab.color}-500/20 scale-105`
                    : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200",
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "queue" && (
            <motion.div
              key="queue"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black uppercase italic tracking-tight">
                        Очередь <span className="text-orange-500">выдачи</span>
                      </h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Призы, ожидающие подтверждения
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Live Stream
                    </span>
                  </div>
                </div>

                <div className="min-h-[400px]">
                  {queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-30">
                      <Trophy className="w-16 h-16 text-slate-300" />
                      <p className="text-xs font-black uppercase italic tracking-widest text-slate-400">
                        Очередь пуста
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {queue.map((item) => (
                        <div
                          key={item.id}
                          className="group p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                              <User className="w-6 h-6 text-slate-400" />
                            </div>
                            <div className="space-y-1">
                              <div className="font-black text-lg tracking-tight uppercase italic">
                                {item.player_name}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                  {item.player_phone}
                                </span>
                                <span className="text-[10px] font-medium text-slate-300">
                                  {new Date(item.created_at).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-8">
                            <div className="text-right space-y-1">
                              <div className="flex items-center justify-end gap-2">
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                                    item.prize_type === "physical"
                                      ? "bg-purple-100 text-purple-600"
                                      : "bg-emerald-100 text-emerald-600",
                                  )}
                                >
                                  {item.prize_type === "physical"
                                    ? "Товар"
                                    : "Бонус"}
                                </span>
                              </div>
                              <div className="font-black text-xl italic text-slate-900 tracking-tight">
                                {item.prize_name}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleClaim(item.id)}
                                className="h-12 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl flex items-center gap-2 font-black uppercase italic text-xs transition-all active:scale-95"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Выдать
                              </button>
                              <button
                                onClick={() => handleCancel(item.id)}
                                className="h-12 w-12 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "history" && (
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
          )}

          {activeTab === "players" && (
            <motion.div
              key="players"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Quick Issue Form */}
              <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black uppercase italic">
                    Быстрое <span className="text-orange-500">начисление</span>
                  </h3>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() =>
                        setIssueForm({ ...issueForm, mode: "amount" })
                      }
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                        issueForm.mode === "amount"
                          ? "bg-white text-orange-500 shadow-sm"
                          : "text-slate-400 hover:text-slate-600",
                      )}
                    >
                      По сумме
                    </button>
                    <button
                      onClick={() =>
                        setIssueForm({ ...issueForm, mode: "count" })
                      }
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                        issueForm.mode === "count"
                          ? "bg-white text-orange-500 shadow-sm"
                          : "text-slate-400 hover:text-slate-600",
                      )}
                    >
                      По количеству
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                      Номер телефона
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="79000000000"
                        value={issueForm.phone}
                        onChange={(e) =>
                          setIssueForm({ ...issueForm, phone: e.target.value })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {issueForm.mode === "amount" ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                        Сумма пополнения (₽)
                      </label>
                      <div className="relative">
                        <BarChart3 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="number"
                          placeholder="1000"
                          value={issueForm.amount}
                          onChange={(e) =>
                            setIssueForm({
                              ...issueForm,
                              amount: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                        Кол-во билетов
                      </label>
                      <div className="relative">
                        <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="number"
                          placeholder="1"
                          value={issueForm.ticketCount}
                          onChange={(e) =>
                            setIssueForm({
                              ...issueForm,
                              ticketCount: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2 flex items-end">
                    <button
                      onClick={handleIssueTickets}
                      disabled={isIssuing || !issueForm.phone}
                      className="w-full h-[52px] bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center gap-2 font-black uppercase italic tracking-wider transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]"
                    >
                      {isIssuing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-5 h-5" />
                          Начислить билеты
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Players List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                      База игроков
                    </h3>
                  </div>
                  <div className="relative w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                      type="text"
                      placeholder="Поиск по телефону или имени..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Игрок
                          </th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Уровень / XP
                          </th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Баланс 🪙
                          </th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                            Действия
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {players
                          .filter(
                            (p) =>
                              p.full_name
                                ?.toLowerCase()
                                .includes(searchQuery.toLowerCase()) ||
                              p.phone_number?.includes(searchQuery),
                          )
                          .map((player) => (
                            <tr
                              key={player.id}
                              className="hover:bg-slate-50/30"
                            >
                              <td className="px-8 py-4">
                                <div className="font-black italic uppercase text-slate-900">
                                  {player.full_name}
                                </div>
                                <div className="text-xs font-bold text-slate-400">
                                  {player.phone_number}
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center font-black text-white italic">
                                    {player.level || 1}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                                      {Math.round(player.total_xp || 0)} XP
                                    </div>
                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500"
                                        style={{ width: "40%" }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <div className="font-black text-emerald-600 italic text-lg">
                                  {Math.round(player.bonus_balance || 0)} ₽
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => resetPlayerPin(player.id)}
                                    title="Сбросить PIN"
                                    className="p-2 hover:bg-amber-50 text-amber-500 rounded-lg transition-colors"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      resetPlayerTickets(player.id)
                                    }
                                    title="Обнулить билеты"
                                    className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "games" && (
            <motion.div
              key="games"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <GamesTab
                clubId={clubId as string}
                settings={settings}
                saveSettings={saveSettings}
                prizes={prizes}
                setPrizes={setPrizes}
              />
            </motion.div>
          )}

          {activeTab === "general" && (
            <motion.div
              key="general"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Rules Setup */}
                <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                      <Settings className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black uppercase italic">
                      Базовые <span className="text-orange-500">правила</span>
                    </h3>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group">
                      <div>
                        <div className="font-black italic uppercase text-xs tracking-tight">
                          Начисление билетов активно
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                          Разрешить выдачу билетов игрокам
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          saveSettings({
                            ...settings,
                            accrual_enabled: !settings.accrual_enabled,
                          })
                        }
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-colors duration-300",
                          settings.accrual_enabled
                            ? "bg-orange-500"
                            : "bg-slate-300",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                            settings.accrual_enabled ? "left-7" : "left-1",
                          )}
                        />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                          Билет за каждые (₽)
                        </label>
                        <input
                          type="number"
                          value={settings.topup_amount_step || 100}
                          onChange={(e) =>
                            saveSettings({
                              ...settings,
                              topup_amount_step: parseInt(e.target.value),
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                          Кол-во билетов
                        </label>
                        <input
                          type="number"
                          value={settings.topup_tickets_step || 1}
                          onChange={(e) =>
                            saveSettings({
                              ...settings,
                              topup_tickets_step: parseInt(e.target.value),
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                        Срок жизни билетов (часов)
                      </label>
                      <input
                        type="number"
                        value={settings.ticket_expiry_hours || 24}
                        onChange={(e) =>
                          saveSettings({
                            ...settings,
                            ticket_expiry_hours: parseInt(e.target.value),
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                      <ExternalLink className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black uppercase italic">
                      Быстрые <span className="text-blue-500">ссылки</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <a
                      href={`https://game.mydashadmin.ru/?clubId=${clubId}`}
                      target="_blank"
                      className="flex items-center justify-between p-5 bg-blue-50 hover:bg-blue-100 rounded-[1.5rem] group transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500">
                          <History className="w-5 h-5" />
                        </div>
                        <div className="font-black italic uppercase text-xs tracking-tight text-blue-700">
                          Страница игрока
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "levels" && <LevelsTab clubId={clubId as string} />}
          {activeTab === "quests" && <QuestsTab clubId={clubId as string} />}
          {activeTab === "verification" && (
            <VerificationTab clubId={clubId as string} />
          )}
          {activeTab === "battlepass" && (
            <BattlePassTab clubId={clubId as string} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
