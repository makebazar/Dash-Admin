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
  Rocket as RocketIcon,
  CreditCard as CardIcon,
  Bird,
  Gamepad2,
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

/**
 * ПАНЕЛЬ УПРАВЛЕНИЯ АКЦИЯМИ (ДЛЯ ВЛАДЕЛЬЦА / УПРАВА)
 */

type Prize = {
  id?: number;
  name: string;
  type: "physical" | "virtual" | "bonus" | "attempt";
  value: number;
  probability: number;
  daily_limit: number;
  is_active: boolean;
  game_slug?: string;
  win_condition?: {
    dice_sums?: number[];
    dice_double?: number | "any";
  };
};

const GAMES = [
  { id: "wheel", label: "Колесо фортуны", icon: Disc },
  { id: "safe", label: "Сейф", icon: Lock },
  { id: "dice", label: "Кости", icon: Dice5 },
  { id: "mines", label: "Мины", icon: Bomb },
  { id: "rocket", label: "Ракета", icon: RocketIcon },
  { id: "cards", label: "Карты", icon: CardIcon },
  { id: "flappy", label: "Flappy", icon: Bird },
];

export default function PromotionsPage() {
  const { clubId } = useParams();
  const [activeTab, setActiveTab] = useState<
    "queue" | "players" | "history" | "games" | "general"
  >("queue");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [logs, setLogs] = useState<{
    issuance: any[];
    games: any[];
    stats: any;
  }>({
    issuance: [],
    games: [],
    stats: {},
  });
  const [issueForm, setIssueForm] = useState({
    phoneNumber: "",
    amount: "",
    ticketCount: "1",
    mode: "amount" as "amount" | "count",
  });
  const [settings, setSettings] = useState({
    ticket_price: 500,
    ticket_expiry_hours: 24,
    enabled_games: ["wheel", "safe", "dice"],
    game_configs: {} as Record<
      string,
      {
        tickets_per_play?: number;
        is_active?: boolean;
        card_count?: number;
        card_back_style?: string;
      }
    >,
    is_promo_active: true,
    domain: "",
    welcome_bonus_tickets: 0,
    accrual_rules: [] as any[],
    bar_accrual_rules: [] as any[],
    bar_accrual_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [clubId]);

  // Real-time updates via SSE
  useEffect(() => {
    if (!clubId) return;

    const eventSource = new EventSource(
      `/api/promo/admin/queue/stream?clubId=${clubId}`,
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "update") {
          fetchData(true);
        }
      } catch (e) {}
    };

    eventSource.addEventListener("update", () => {
      fetchData(true);
    });

    return () => {
      eventSource.close();
    };
  }, [clubId]);

  const fetchData = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      // Fetch Prizes
      const pRes = await fetch(`/api/promo/admin/prizes?clubId=${clubId}`);
      const pData = await pRes.json();
      setPrizes(pData.prizes || []);

      // Fetch Queue
      const qRes = await fetch(`/api/promo/admin/queue?clubId=${clubId}`);
      const qData = await qRes.json();
      setQueue(qData.queue || []);

      // Fetch Club Settings
      const cRes = await fetch(`/api/clubs/${clubId}`);
      const cData = await cRes.json();
      if (cData.club?.promo_settings) {
        setSettings((prev) => ({
          ...prev,
          ...cData.club.promo_settings,
          game_configs: {
            ...prev.game_configs,
            ...(cData.club.promo_settings.game_configs || {}),
          },
        }));
      }

      // Fetch Players
      const plRes = await fetch(`/api/promo/admin/players?clubId=${clubId}`);
      const plData = await plRes.json();
      setPlayers(plData.players || []);

      // Fetch Logs
      const lRes = await fetch(`/api/promo/admin/logs?clubId=${clubId}`);
      const lData = await lRes.json();
      setLogs({
        issuance: lData.issuanceLogs || [],
        games: lData.gameLogs || [],
        stats: lData.stats || {},
      });
    } catch (err) {
      console.error("Failed to fetch promo data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const [settingsRes, prizesRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/promo-settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings }),
        }),
        fetch(`/api/promo/admin/prizes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clubId, prizes }),
        }),
      ]);

      if (!settingsRes.ok || !prizesRes.ok) {
        throw new Error("Ошибка при сохранении данных");
      }

      alert("Все настройки успешно сохранены");
      await fetchData(); // Refresh data from server
    } catch (err) {
      console.error("Save Error:", err);
      alert("Не удалось сохранить настройки. Проверьте консоль.");
    } finally {
      setSaving(false);
    }
  };

  const handleClaim = async (itemId: string) => {
    try {
      const res = await fetch(`/api/promo/admin/queue/claim`, {
        method: "POST",
        body: JSON.stringify({ itemId }),
      });
      if (res.ok) {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, status: "claimed" } : item,
          ),
        );
      }
    } catch (err) {
      alert("Ошибка выдачи");
    }
  };

  const handleIssueTickets = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/promo/admin/issue-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId,
          phoneNumber: issueForm.phoneNumber,
          amount:
            issueForm.mode === "amount" ? parseFloat(issueForm.amount) : 0,
          ticketCount:
            issueForm.mode === "count" ? parseInt(issueForm.ticketCount) : 0,
          mode: issueForm.mode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Начислено билетов: ${data.ticketsIssued}`);
        setIssueForm((prev) => ({ ...prev, phoneNumber: "", amount: "" }));
        fetchData(); // Refresh player list
      } else {
        alert(data.error || "Ошибка начисления");
      }
    } catch (err) {
      alert("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">
              Акции и <span className="text-orange-500">Геймификация</span>
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Управляйте призами, шансами и очередью выдачи для ваших гостей.
            </p>
          </div>

          {/* Public Link Card */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center gap-4 max-w-md">
            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Ticket className="w-8 h-8 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Публичная ссылка для гостей
              </div>
              <div className="text-sm font-bold text-slate-800 truncate">
                {settings.domain ||
                  (typeof window !== "undefined"
                    ? window.location.origin
                    : "game.mydashadmin.ru")}
                /promo?clubId={clubId}
              </div>
            </div>
            <button
              onClick={() => {
                const base = settings.domain || window.location.origin;
                const link = base.startsWith("http") ? base : `https://${base}`;
                navigator.clipboard.writeText(`${link}/promo?clubId=${clubId}`);
                alert("Ссылка скопирована");
              }}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-black transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-sm flex flex-col items-center gap-2">
            <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center">
              <span className="text-[10px] font-black text-slate-400 uppercase text-center px-2">
                QR Код <br /> для печати
              </span>
            </div>
            <button className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:underline">
              Скачать PDF
            </button>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: "queue", label: "Очередь выдачи", icon: Gift },
          { id: "players", label: "Пользователи", icon: User },
          { id: "history", label: "История", icon: History },
          { id: "games", label: "Список игр", icon: Gamepad2 },
          { id: "general", label: "Общие настройки", icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id !== "games") setSelectedGameId(null);
            }}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
              activeTab === tab.id
                ? "bg-white text-black shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "queue" && (
          <motion.div
            key="queue"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Гость
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Выигрыш
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Время
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Статус
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                      Действие
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-400 font-bold uppercase italic tracking-widest text-sm"
                      >
                        Очередь пуста
                      </td>
                    </tr>
                  ) : (
                    queue.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">
                            {item.player_name}
                          </div>
                          <div className="text-xs font-medium text-slate-400">
                            {item.player_phone}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center",
                                item.prize_type === "physical"
                                  ? "bg-orange-100 text-orange-600"
                                  : item.prize_type === "withdraw"
                                    ? "bg-purple-100 text-purple-600"
                                    : "bg-blue-100 text-blue-600",
                              )}
                            >
                              {item.prize_type === "withdraw" ? (
                                <CardIcon className="w-4 h-4" />
                              ) : (
                                <Gift className="w-4 h-4" />
                              )}
                            </div>
                            <span className="font-bold text-slate-800">
                              {item.prize_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-500">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                              item.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : item.status === "claimed"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-500",
                            )}
                          >
                            {item.status === "pending" ? "Ожидает" : "Выдано"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.status === "pending" && (
                            <button
                              onClick={() => handleClaim(item.id)}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95"
                            >
                              ВЫДАТЬ
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Ticket className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Выдано сегодня
                  </div>
                </div>
                <div className="text-3xl font-black italic">
                  {logs.stats?.tickets_issued_today || 0}{" "}
                  <span className="text-sm not-italic font-bold text-slate-300">
                    шт.
                  </span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Gamepad2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Сыграно сегодня
                  </div>
                </div>
                <div className="text-3xl font-black italic">
                  {logs.stats?.games_played_today || 0}{" "}
                  <span className="text-sm not-italic font-bold text-slate-300">
                    игр
                  </span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Призовой фонд (день)
                  </div>
                </div>
                <div className="text-3xl font-black italic">
                  {logs.stats?.prize_money_today || 0}{" "}
                  <span className="text-sm not-italic font-bold text-slate-300">
                    ₽
                  </span>
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
                                {new Date(log.created_at).toLocaleTimeString()}
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
                                  <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                    <Trophy className="w-3 h-3" />
                                    {log.prize_name}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">Пусто</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-[10px] font-medium text-slate-400 text-right">
                                {new Date(log.created_at).toLocaleTimeString()}
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
                      "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      issueForm.mode === "amount"
                        ? "bg-white text-black shadow-sm"
                        : "text-slate-500",
                    )}
                  >
                    По сумме
                  </button>
                  <button
                    onClick={() =>
                      setIssueForm({ ...issueForm, mode: "count" })
                    }
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      issueForm.mode === "count"
                        ? "bg-white text-black shadow-sm"
                        : "text-slate-500",
                    )}
                  >
                    Билетами
                  </button>
                </div>
              </div>
              <form
                onSubmit={handleIssueTickets}
                className="flex flex-col md:flex-row gap-4 items-end"
              >
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                    Номер телефона
                  </label>
                  <input
                    type="text"
                    placeholder="79001234567"
                    value={issueForm.phoneNumber}
                    onChange={(e) =>
                      setIssueForm({
                        ...issueForm,
                        phoneNumber: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3 font-bold outline-none focus:border-orange-500"
                    required
                  />
                </div>
                {issueForm.mode === "amount" ? (
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                      Сумма пополнения (₽)
                    </label>
                    <input
                      type="number"
                      placeholder="500"
                      value={issueForm.amount}
                      onChange={(e) =>
                        setIssueForm({ ...issueForm, amount: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3 font-bold outline-none focus:border-orange-500"
                      required
                    />
                  </div>
                ) : (
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                      Количество билетов (шт)
                    </label>
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
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3 font-bold outline-none focus:border-orange-500"
                      required
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3.5 bg-orange-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Начислить"
                  )}
                </button>
              </form>
            </div>

            {/* Players Table */}
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Пользователь
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                      Билеты
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                      Баланс (₽)
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                      Опыт (XP)
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {players.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-400 font-bold uppercase italic tracking-widest text-sm"
                      >
                        Список пользователей пуст
                      </td>
                    </tr>
                  ) : (
                    players.map((player) => (
                      <tr
                        key={player.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">
                            {player.full_name}
                          </div>
                          <div className="text-xs font-medium text-slate-400">
                            {player.phone_number}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-black text-xs">
                            <Ticket className="w-3 h-3" />
                            {player.tickets_count}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-700">
                          {player.bonus_balance} ₽
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-bold text-xs">
                            <RefreshCw className="w-3 h-3" />
                            {player.total_xp}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() =>
                              setIssueForm((prev) => ({
                                ...prev,
                                phoneNumber: player.phone_number,
                                amount: "",
                              }))
                            }
                            className="text-orange-500 font-bold text-xs uppercase tracking-widest hover:underline"
                          >
                            Пополнить
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === "games" && !selectedGameId && (
          <motion.div
            key="games-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {GAMES.map((game) => {
              const isEnabled = settings.enabled_games.includes(game.id);
              return (
                <div
                  key={game.id}
                  className={cn(
                    "bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm transition-all hover:shadow-md cursor-pointer relative",
                    !isEnabled && "opacity-70 grayscale",
                  )}
                  onClick={() => setSelectedGameId(game.id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                      <game.icon className="w-6 h-6 text-slate-700" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newEnabled = isEnabled
                          ? settings.enabled_games.filter(
                              (id) => id !== game.id,
                            )
                          : [...settings.enabled_games, game.id];
                        setSettings({ ...settings, enabled_games: newEnabled });
                      }}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative p-1",
                        isEnabled ? "bg-orange-500" : "bg-slate-200",
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                          isEnabled ? "translate-x-6" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>
                  <h3 className="font-black text-lg uppercase italic mb-1">
                    {game.label}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <span>{isEnabled ? "Активна" : "Отключена"}</span>
                    <span>•</span>
                    <span className="text-orange-500">Настроить</span>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {activeTab === "games" && selectedGameId && (
          <motion.div
            key="game-detail"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <button
              onClick={() => setSelectedGameId(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-black font-bold text-sm uppercase tracking-widest transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Назад к списку
            </button>

            <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center">
                  {React.createElement(
                    GAMES.find((g) => g.id === selectedGameId)?.icon ||
                      Gamepad2,
                    { className: "w-10 h-10 text-slate-700" },
                  )}
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase italic text-slate-900">
                    {GAMES.find((g) => g.id === selectedGameId)?.label}
                  </h2>
                  <p className="text-slate-500 font-medium">
                    Индивидуальные настройки игры
                  </p>
                </div>
              </div>

              {selectedGameId === "dice" && (
                <div className="mb-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Probability Guide */}
                  <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-4 h-4 text-orange-500" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Математическая вероятность (2D6)
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {[
                        { sum: "7", chance: "16.7%", desc: "Самая частая" },
                        { sum: "6, 8", chance: "13.9%", desc: "Очень часто" },
                        { sum: "5, 9", chance: "11.1%", desc: "Часто" },
                        { sum: "4, 10", chance: "8.3%", desc: "Редко" },
                        { sum: "3, 11", chance: "5.6%", desc: "Очень редко" },
                        { sum: "2, 12", chance: "2.8%", desc: "Джекпот" },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] font-bold"
                        >
                          <span className="text-slate-600">
                            Сумма {item.sum}:
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 uppercase text-[9px]">
                              {item.desc}
                            </span>
                            <span className="text-orange-500 w-10 text-right">
                              {item.chance}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Distribution Strategy */}
                  <div className="bg-orange-50/50 border border-orange-100 p-6 rounded-3xl">
                    <div className="flex items-center gap-2 mb-4">
                      <Info className="w-4 h-4 text-orange-600" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                        Совет по распределению
                      </h4>
                    </div>
                    <div className="space-y-3 text-[11px] font-medium text-orange-800 leading-relaxed">
                      <p>
                        • <strong className="uppercase">Джекпот (12):</strong>{" "}
                        Ставьте самые ценные призы. Выпадает в среднем 1 раз на
                        36 игр.
                      </p>
                      <p>
                        • <strong className="uppercase">Баланс (7):</strong> На
                        эту сумму лучше не ставить ценных призов, так как она
                        выпадает чаще всего (каждый 6-й бросок).
                      </p>
                      <p>
                        • <strong className="uppercase">Дубли:</strong> Любой
                        дубль выпадает с шансом 16.7%. Это хороший повод для
                        выдачи бонусного билета.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-12">
                {selectedGameId !== "mines" && selectedGameId !== "rocket" && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                      Стоимость одной игры (билетов)
                    </label>
                    <input
                      type="number"
                      placeholder="1"
                      value={
                        settings.game_configs[selectedGameId]
                          ?.tickets_per_play || ""
                      }
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setSettings({
                          ...settings,
                          game_configs: {
                            ...settings.game_configs,
                            [selectedGameId]: {
                              ...settings.game_configs[selectedGameId],
                              tickets_per_play: isNaN(val) ? undefined : val,
                            },
                          },
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-xl outline-none focus:border-orange-500 max-w-xs"
                    />
                    <p className="text-[10px] text-slate-400 font-medium px-2 mt-2">
                      Сколько билетов спишется за одну попытку в этой игре. По
                      умолчанию: 1 билет.
                    </p>
                  </div>
                )}

                {selectedGameId === "flappy" && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Farming Settings */}
                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-6">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                            Базовая сумма бонусов
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={
                                settings.game_configs[selectedGameId]
                                  ?.base_bonus || 100
                              }
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setSettings((prev) => ({
                                  ...prev,
                                  game_configs: {
                                    ...prev.game_configs,
                                    [selectedGameId]: {
                                      ...(prev.game_configs[selectedGameId] ||
                                        {}),
                                      base_bonus: isNaN(val) ? 100 : val,
                                    },
                                  },
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 font-black text-lg outline-none focus:border-orange-500"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                              РУБ
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                            Прирост за каждую трубу
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={
                                settings.game_configs[selectedGameId]
                                  ?.multiplier_step || 0.1
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setSettings((prev) => ({
                                  ...prev,
                                  game_configs: {
                                    ...prev.game_configs,
                                    [selectedGameId]: {
                                      ...(prev.game_configs[selectedGameId] ||
                                        {}),
                                      multiplier_step: isNaN(val) ? 0.1 : val,
                                    },
                                  },
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 font-black text-lg outline-none focus:border-orange-500"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                              X МНОЖИТЕЛЬ
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Limits & Difficulty */}
                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-6">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                            Максимальный множитель (Cap)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={
                                settings.game_configs[selectedGameId]
                                  ?.max_multiplier || 10
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setSettings((prev) => ({
                                  ...prev,
                                  game_configs: {
                                    ...prev.game_configs,
                                    [selectedGameId]: {
                                      ...(prev.game_configs[selectedGameId] ||
                                        {}),
                                      max_multiplier: isNaN(val) ? 10 : val,
                                    },
                                  },
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 font-black text-lg outline-none focus:border-orange-500"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                              LIMIT
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                            Сложность (Препятствия)
                          </label>
                          <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                            {["easy", "medium", "hard"].map((level) => (
                              <button
                                key={level}
                                onClick={() => {
                                  setSettings((prev) => ({
                                    ...prev,
                                    game_configs: {
                                      ...prev.game_configs,
                                      [selectedGameId]: {
                                        ...(prev.game_configs[selectedGameId] ||
                                          {}),
                                        difficulty: level,
                                      },
                                    },
                                  }));
                                }}
                                className={cn(
                                  "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                  (settings.game_configs[selectedGameId]
                                    ?.difficulty || "medium") === level
                                    ? level === "easy"
                                      ? "bg-green-500 text-white"
                                      : level === "medium"
                                        ? "bg-orange-500 text-white"
                                        : "bg-red-500 text-white"
                                    : "text-slate-400",
                                )}
                              >
                                {level === "easy"
                                  ? "Лайт"
                                  : level === "medium"
                                    ? "Норм"
                                    : "Хард"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedGameId === "mines" && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Mining Settings */}
                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-6">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                            Базовый множитель (Global)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.1"
                              value={
                                settings.game_configs[selectedGameId]
                                  ?.base_bonus || 1
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setSettings({
                                  ...settings,
                                  game_configs: {
                                    ...settings.game_configs,
                                    [selectedGameId]: {
                                      ...settings.game_configs[selectedGameId],
                                      base_bonus: isNaN(val) ? 1 : val,
                                    },
                                  },
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 font-black text-lg outline-none focus:border-orange-500"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                              X
                            </div>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1 ml-2">
                            На сколько умножается итоговый выигрыш. По
                            умолчанию: 1.
                          </p>
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                            Минимум ячеек для вывода
                          </label>
                          <input
                            type="number"
                            value={
                              settings.game_configs[selectedGameId]
                                ?.min_cashout_reveals || 2
                            }
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setSettings({
                                ...settings,
                                game_configs: {
                                  ...settings.game_configs,
                                  [selectedGameId]: {
                                    ...settings.game_configs[selectedGameId],
                                    min_cashout_reveals: isNaN(val) ? 2 : val,
                                  },
                                },
                              });
                            }}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 font-black text-lg outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      {/* Limits */}
                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-6">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                            Максимальный множитель (Cap)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={
                                settings.game_configs[selectedGameId]
                                  ?.max_multiplier || 100
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setSettings({
                                  ...settings,
                                  game_configs: {
                                    ...settings.game_configs,
                                    [selectedGameId]: {
                                      ...settings.game_configs[selectedGameId],
                                      max_multiplier: isNaN(val) ? 100 : val,
                                    },
                                  },
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 font-black text-lg outline-none focus:border-orange-500"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                              LIMIT
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Multiplier Tables */}
                    <div className="bg-slate-50 border border-slate-100 p-8 rounded-[3rem] space-y-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-widest">
                            Настройка режимов (Кол-во мин)
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium italic">
                            Установите фиксированный прирост множителя за каждую
                            открытую ячейку.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const modes =
                              settings.game_configs[selectedGameId]?.modes ||
                              [];
                            setSettings({
                              ...settings,
                              game_configs: {
                                ...settings.game_configs,
                                [selectedGameId]: {
                                  ...settings.game_configs[selectedGameId],
                                  modes: [
                                    ...modes,
                                    {
                                      mines: 3,
                                      multiplier_step: 0.2,
                                    },
                                  ],
                                },
                              },
                            });
                          }}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Добавить количество мин
                        </button>
                      </div>

                      <div className="space-y-6">
                        {(
                          settings.game_configs[selectedGameId]?.modes || []
                        ).map((mode: any, idx: number) => {
                          const step = parseFloat(
                            mode.multiplier_step || "0.2",
                          );
                          const preview = [1, 2, 3, 4, 5].map((i) =>
                            (1 + i * step).toFixed(2),
                          );

                          return (
                            <div
                              key={idx}
                              className="bg-white border border-slate-100 p-8 rounded-[2rem] space-y-6"
                            >
                              <div className="flex items-center justify-between border-b border-slate-50 pb-6">
                                <div className="flex flex-col md:flex-row md:items-center gap-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white">
                                      <Bomb className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Кол-во мин
                                      </div>
                                      <input
                                        type="number"
                                        value={mode.mines}
                                        onChange={(e) => {
                                          const newModes = [
                                            ...settings.game_configs[
                                              selectedGameId
                                            ].modes,
                                          ];
                                          newModes[idx].mines =
                                            parseInt(e.target.value) || 0;
                                          setSettings({
                                            ...settings,
                                            game_configs: {
                                              ...settings.game_configs,
                                              [selectedGameId]: {
                                                ...settings.game_configs[
                                                  selectedGameId
                                                ],
                                                modes: newModes,
                                              },
                                            },
                                          });
                                        }}
                                        className="w-16 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 font-black text-center outline-none focus:border-orange-500"
                                      />
                                    </div>
                                  </div>

                                  <div className="h-10 w-[1px] bg-slate-100 hidden md:block" />

                                  <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                      Прирост за ячейку
                                    </div>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={mode.multiplier_step}
                                        onChange={(e) => {
                                          const newModes = [
                                            ...settings.game_configs[
                                              selectedGameId
                                            ].modes,
                                          ];
                                          newModes[idx].multiplier_step =
                                            parseFloat(e.target.value) || 0;
                                          setSettings({
                                            ...settings,
                                            game_configs: {
                                              ...settings.game_configs,
                                              [selectedGameId]: {
                                                ...settings.game_configs[
                                                  selectedGameId
                                                ],
                                                modes: newModes,
                                              },
                                            },
                                          });
                                        }}
                                        className="w-32 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1 font-black outline-none focus:border-orange-500"
                                      />
                                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">
                                        x
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => {
                                    const newModes = settings.game_configs[
                                      selectedGameId
                                    ].modes.filter(
                                      (_: any, i: number) => i !== idx,
                                    );
                                    setSettings({
                                      ...settings,
                                      game_configs: {
                                        ...settings.game_configs,
                                        [selectedGameId]: {
                                          ...settings.game_configs[
                                            selectedGameId
                                          ],
                                          modes: newModes,
                                        },
                                      },
                                    });
                                  }}
                                  className="text-slate-300 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors"
                                >
                                  Удалить
                                </button>
                              </div>

                              <div>
                                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-3">
                                  Предпросмотр шагов (Прирост)
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {preview.map((val, pIdx) => (
                                    <div
                                      key={pIdx}
                                      className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl flex flex-col items-center"
                                    >
                                      <span className="text-[8px] font-black text-slate-400 uppercase">
                                        {pIdx + 1} яч.
                                      </span>
                                      <span className="text-sm font-black text-slate-600">
                                        x{val}
                                      </span>
                                    </div>
                                  ))}
                                  <div className="bg-orange-50/50 border border-orange-100 px-4 py-2 rounded-xl flex flex-col items-center">
                                    <span className="text-[8px] font-black text-orange-400 uppercase">
                                      и т.д.
                                    </span>
                                    <span className="text-sm font-black text-orange-500">
                                      ...
                                    </span>
                                  </div>
                                </div>
                                <p className="text-[9px] text-slate-400 mt-4 italic">
                                  * Итоговый множитель = 1.0 + (кол-во ячеек *
                                  прирост). Не может превышать{" "}
                                  <b>LIMIT (CAP)</b>.
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {selectedGameId === "rocket" && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-6">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                            Базовый множитель (Global)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.1"
                              value={
                                settings.game_configs[selectedGameId]
                                  ?.base_bonus || 1
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setSettings({
                                  ...settings,
                                  game_configs: {
                                    ...settings.game_configs,
                                    [selectedGameId]: {
                                      ...settings.game_configs[selectedGameId],
                                      base_bonus: isNaN(val) ? 1 : val,
                                    },
                                  },
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 font-black text-lg outline-none focus:border-orange-500"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                              X
                            </div>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1 ml-2">
                            На сколько умножается итоговый выигрыш.
                          </p>
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                            House Edge (Комиссия)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={
                                settings.game_configs[selectedGameId]
                                  ?.house_edge || 0.95
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setSettings({
                                  ...settings,
                                  game_configs: {
                                    ...settings.game_configs,
                                    [selectedGameId]: {
                                      ...settings.game_configs[selectedGameId],
                                      house_edge: isNaN(val) ? 0.95 : val,
                                    },
                                  },
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 font-black text-lg outline-none focus:border-orange-500"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                              FACTOR
                            </div>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1 ml-2">
                            Вероятность долета. 0.95 = 5% шанс взрыва на старте.
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-6">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                            Максимальный множитель (Cap)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={
                                settings.game_configs[selectedGameId]
                                  ?.max_multiplier || 100
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setSettings({
                                  ...settings,
                                  game_configs: {
                                    ...settings.game_configs,
                                    [selectedGameId]: {
                                      ...settings.game_configs[selectedGameId],
                                      max_multiplier: isNaN(val) ? 100 : val,
                                    },
                                  },
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 font-black text-lg outline-none focus:border-orange-500"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                              LIMIT
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                            Скорость полета (Прирост)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={
                                settings.game_configs[selectedGameId]
                                  ?.growth_rate || 0.08
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setSettings({
                                  ...settings,
                                  game_configs: {
                                    ...settings.game_configs,
                                    [selectedGameId]: {
                                      ...settings.game_configs[selectedGameId],
                                      growth_rate: isNaN(val) ? 0.08 : val,
                                    },
                                  },
                                });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-3 font-black text-lg outline-none focus:border-orange-500"
                            />
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1 ml-2">
                            Как быстро растет множитель. Меньше - медленнее
                            полет.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedGameId === "cards" && (
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                        Количество карт на столе
                      </label>
                      <select
                        value={
                          settings.game_configs[selectedGameId]?.card_count || 3
                        }
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSettings({
                            ...settings,
                            game_configs: {
                              ...settings.game_configs,
                              [selectedGameId]: {
                                ...settings.game_configs[selectedGameId],
                                card_count: val,
                              },
                            },
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-xl outline-none focus:border-orange-500 max-w-xs appearance-none"
                      >
                        <option value={3}>3 карты</option>
                        <option value={4}>4 карты</option>
                        <option value={5}>5 карт</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block mb-2">
                        Стиль рубашки
                      </label>
                      <select
                        value={
                          settings.game_configs[selectedGameId]
                            ?.card_back_style || "default"
                        }
                        onChange={(e) => {
                          setSettings({
                            ...settings,
                            game_configs: {
                              ...settings.game_configs,
                              [selectedGameId]: {
                                ...settings.game_configs[selectedGameId],
                                card_back_style: e.target.value,
                              },
                            },
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-xl outline-none focus:border-orange-500 max-w-xs appearance-none"
                      >
                        <option value="default">
                          Голографическая (По умолчанию)
                        </option>
                        <option value="gold">Золотое тиснение</option>
                        <option value="neon">Неоновая</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedGameId !== "flappy" &&
                  selectedGameId !== "mines" &&
                  selectedGameId !== "rocket" && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-black uppercase italic text-slate-900">
                          Настройка призов и шансов
                        </h4>
                        <button
                          onClick={() =>
                            setPrizes([
                              ...prizes,
                              {
                                name: "Новый приз",
                                type: "physical",
                                value: 0,
                                probability: 5,
                                daily_limit: 0,
                                is_active: true,
                                game_slug: selectedGameId,
                              },
                            ])
                          }
                          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm hover:bg-orange-600 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          Добавить приз
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {prizes
                          .filter((p) => p.game_slug === selectedGameId)
                          .map((prize) => {
                            // Find global index to update state correctly
                            const globalIdx = prizes.findIndex(
                              (p) => p === prize,
                            );

                            return (
                              <div
                                key={prize.id || `temp-${globalIdx}`}
                                className="bg-slate-50 border border-slate-100 p-6 rounded-3xl relative group"
                              >
                                <button
                                  onClick={() =>
                                    setPrizes(
                                      prizes.filter((_, i) => i !== globalIdx),
                                    )
                                  }
                                  className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>

                                <div className="space-y-4">
                                  <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                                      Название
                                    </label>
                                    <input
                                      value={prize.name}
                                      onChange={(e) => {
                                        const newPrizes = [...prizes];
                                        newPrizes[globalIdx] = {
                                          ...newPrizes[globalIdx],
                                          name: e.target.value,
                                        };
                                        setPrizes(newPrizes);
                                      }}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm focus:border-orange-500 outline-none"
                                    />
                                  </div>

                                  {selectedGameId === "dice" && (
                                    <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-4">
                                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Условие выпадения (Dice)
                                      </div>

                                      {/* Sums Grid */}
                                      <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase block">
                                          Выберите суммы:
                                        </label>
                                        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1">
                                          {[
                                            2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
                                          ].map((num) => {
                                            // Check if this sum is taken by OTHER prizes
                                            const isTaken = prizes
                                              .filter(
                                                (p, i) =>
                                                  p.game_slug === "dice" &&
                                                  i !== globalIdx,
                                              )
                                              .some((p) =>
                                                p.win_condition?.dice_sums?.includes(
                                                  num,
                                                ),
                                              );

                                            const isChecked =
                                              prize.win_condition?.dice_sums?.includes(
                                                num,
                                              );

                                            return (
                                              <button
                                                key={num}
                                                type="button"
                                                disabled={isTaken}
                                                onClick={() => {
                                                  const currentSums =
                                                    prize.win_condition
                                                      ?.dice_sums || [];
                                                  const newSums = isChecked
                                                    ? currentSums.filter(
                                                        (s) => s !== num,
                                                      )
                                                    : [...currentSums, num];

                                                  const newPrizes = [...prizes];
                                                  newPrizes[globalIdx] = {
                                                    ...newPrizes[globalIdx],
                                                    win_condition: {
                                                      ...newPrizes[globalIdx]
                                                        .win_condition,
                                                      dice_sums:
                                                        newSums.length > 0
                                                          ? newSums
                                                          : undefined,
                                                    },
                                                  };
                                                  setPrizes(newPrizes);
                                                }}
                                                className={cn(
                                                  "h-8 rounded-lg text-[10px] font-black transition-all border",
                                                  isChecked
                                                    ? "bg-orange-500 border-orange-600 text-white"
                                                    : isTaken
                                                      ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                                      : "bg-white border-slate-200 text-slate-600 hover:border-orange-500",
                                                )}
                                              >
                                                {num}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Doubles Section */}
                                      <div className="space-y-2 pt-2 border-t border-slate-100">
                                        <div className="flex items-center justify-between">
                                          <label className="text-[9px] font-bold text-slate-500 uppercase">
                                            Дубли:
                                          </label>
                                          <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5, 6].map((d) => {
                                              // Check if this specific double is taken by OTHER prizes
                                              // Note: "any" also blocks specific ones, and specific ones block "any"
                                              const isTaken = prizes
                                                .filter(
                                                  (p, i) =>
                                                    p.game_slug === "dice" &&
                                                    i !== globalIdx,
                                                )
                                                .some(
                                                  (p) =>
                                                    p.win_condition
                                                      ?.dice_double === "any" ||
                                                    p.win_condition
                                                      ?.dice_double === d,
                                                );

                                              const isCurrentAny =
                                                prize.win_condition
                                                  ?.dice_double === "any";
                                              const isChecked =
                                                isCurrentAny ||
                                                prize.win_condition
                                                  ?.dice_double === d;

                                              return (
                                                <button
                                                  key={d}
                                                  type="button"
                                                  disabled={
                                                    isTaken || isCurrentAny
                                                  }
                                                  onClick={() => {
                                                    const newPrizes = [
                                                      ...prizes,
                                                    ];
                                                    const currentVal =
                                                      newPrizes[globalIdx]
                                                        .win_condition
                                                        ?.dice_double;

                                                    newPrizes[globalIdx] = {
                                                      ...newPrizes[globalIdx],
                                                      win_condition: {
                                                        ...newPrizes[globalIdx]
                                                          .win_condition,
                                                        dice_double:
                                                          currentVal === d
                                                            ? undefined
                                                            : d,
                                                      },
                                                    };
                                                    setPrizes(newPrizes);
                                                  }}
                                                  className={cn(
                                                    "w-7 h-7 rounded-lg text-[10px] font-black border flex items-center justify-center transition-all",
                                                    isChecked
                                                      ? "bg-blue-500 border-blue-600 text-white"
                                                      : isTaken
                                                        ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                                        : "bg-white border-slate-200 text-slate-600 hover:border-blue-500",
                                                  )}
                                                  title={`${d}-${d}`}
                                                >
                                                  {d}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          disabled={prizes
                                            .filter(
                                              (p, i) =>
                                                p.game_slug === "dice" &&
                                                i !== globalIdx,
                                            )
                                            .some(
                                              (p) =>
                                                p.win_condition?.dice_double !==
                                                undefined,
                                            )}
                                          onClick={() => {
                                            const newPrizes = [...prizes];
                                            const isAny =
                                              newPrizes[globalIdx].win_condition
                                                ?.dice_double === "any";

                                            newPrizes[globalIdx] = {
                                              ...newPrizes[globalIdx],
                                              win_condition: {
                                                ...newPrizes[globalIdx]
                                                  .win_condition,
                                                dice_double: isAny
                                                  ? undefined
                                                  : "any",
                                              },
                                            };
                                            setPrizes(newPrizes);
                                          }}
                                          className={cn(
                                            "w-full py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                                            prize.win_condition?.dice_double ===
                                              "any"
                                              ? "bg-blue-500 border-blue-600 text-white"
                                              : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100",
                                          )}
                                        >
                                          Любой дубль
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                                        Тип
                                      </label>
                                      <select
                                        value={prize.type}
                                        onChange={(e) => {
                                          const newPrizes = [...prizes];
                                          newPrizes[globalIdx] = {
                                            ...newPrizes[globalIdx],
                                            type: e.target.value as any,
                                          };
                                          setPrizes(newPrizes);
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm"
                                      >
                                        <option value="physical">Товар</option>
                                        <option value="virtual">
                                          Баланс (₽)
                                        </option>
                                        <option value="bonus">XP</option>
                                        <option value="attempt">Билет</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                                        Значение
                                      </label>
                                      <input
                                        type="number"
                                        value={prize.value}
                                        onChange={(e) => {
                                          const newPrizes = [...prizes];
                                          newPrizes[globalIdx] = {
                                            ...newPrizes[globalIdx],
                                            value:
                                              parseFloat(e.target.value) || 0,
                                          };
                                          setPrizes(newPrizes);
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    {selectedGameId !== "dice" && (
                                      <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                                          Шанс (%)
                                        </label>
                                        <input
                                          type="number"
                                          step="0.1"
                                          value={prize.probability}
                                          onChange={(e) => {
                                            const newPrizes = [...prizes];
                                            newPrizes[globalIdx] = {
                                              ...newPrizes[globalIdx],
                                              probability:
                                                parseFloat(e.target.value) || 0,
                                            };
                                            setPrizes(newPrizes);
                                          }}
                                          className="w-full bg-orange-100/50 border border-orange-200 text-orange-900 rounded-xl px-4 py-2 font-black text-sm focus:border-orange-500 outline-none"
                                        />
                                      </div>
                                    )}
                                    <div
                                      className={
                                        selectedGameId === "dice"
                                          ? "col-span-2"
                                          : ""
                                      }
                                    >
                                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                                        Лимит/день
                                      </label>
                                      <input
                                        type="number"
                                        value={prize.daily_limit}
                                        onChange={(e) => {
                                          const newPrizes = [...prizes];
                                          newPrizes[globalIdx] = {
                                            ...newPrizes[globalIdx],
                                            daily_limit:
                                              parseInt(e.target.value) || 0,
                                          };
                                          setPrizes(newPrizes);
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {selectedGameId !== "dice" && (
                        <div className="space-y-2">
                          <div
                            className={`border p-4 rounded-2xl flex items-center justify-between ${
                              selectedGameId === "cards"
                                ? prizes
                                    .filter(
                                      (p) => p.game_slug === selectedGameId,
                                    )
                                    .reduce(
                                      (acc, p) =>
                                        acc +
                                        (parseFloat(String(p.probability)) ||
                                          0),
                                      0,
                                    ) !== 100 ||
                                  prizes.filter(
                                    (p) => p.game_slug === selectedGameId,
                                  ).length !==
                                    (settings.game_configs["cards"]
                                      ?.card_count || 3)
                                  ? "bg-red-50 border-red-200"
                                  : "bg-green-50 border-green-200"
                                : prizes
                                      .filter(
                                        (p) => p.game_slug === selectedGameId,
                                      )
                                      .reduce(
                                        (acc, p) =>
                                          acc +
                                          (parseFloat(String(p.probability)) ||
                                            0),
                                        0,
                                      ) > 100
                                  ? "bg-red-50 border-red-200"
                                  : "bg-orange-50 border-orange-100"
                            }`}
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <Info
                                  className={`w-4 h-4 ${
                                    selectedGameId === "cards"
                                      ? prizes
                                          .filter(
                                            (p) =>
                                              p.game_slug === selectedGameId,
                                          )
                                          .reduce(
                                            (acc, p) =>
                                              acc +
                                              (parseFloat(
                                                String(p.probability),
                                              ) || 0),
                                            0,
                                          ) !== 100 ||
                                        prizes.filter(
                                          (p) => p.game_slug === selectedGameId,
                                        ).length !==
                                          (settings.game_configs["cards"]
                                            ?.card_count || 3)
                                        ? "text-red-500"
                                        : "text-green-500"
                                      : "text-orange-500"
                                  }`}
                                />
                                <span
                                  className={`text-xs font-bold ${
                                    selectedGameId === "cards"
                                      ? prizes
                                          .filter(
                                            (p) =>
                                              p.game_slug === selectedGameId,
                                          )
                                          .reduce(
                                            (acc, p) =>
                                              acc +
                                              (parseFloat(
                                                String(p.probability),
                                              ) || 0),
                                            0,
                                          ) !== 100 ||
                                        prizes.filter(
                                          (p) => p.game_slug === selectedGameId,
                                        ).length !==
                                          (settings.game_configs["cards"]
                                            ?.card_count || 3)
                                        ? "text-red-800"
                                        : "text-green-800"
                                      : "text-orange-800"
                                  }`}
                                >
                                  Суммарный шанс выпадения призов:
                                </span>
                              </div>
                              {selectedGameId === "cards" && (
                                <span
                                  className={`text-[10px] font-medium ${
                                    prizes
                                      .filter(
                                        (p) => p.game_slug === selectedGameId,
                                      )
                                      .reduce(
                                        (acc, p) =>
                                          acc +
                                          (parseFloat(String(p.probability)) ||
                                            0),
                                        0,
                                      ) !== 100 ||
                                    prizes.filter(
                                      (p) => p.game_slug === selectedGameId,
                                    ).length !==
                                      (settings.game_configs["cards"]
                                        ?.card_count || 3)
                                      ? "text-red-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  Для игры "Карты" сумма шансов должна быть
                                  ровно 100%, а количество призов должно
                                  совпадать с количеством карт (
                                  {settings.game_configs["cards"]?.card_count ||
                                    3}
                                  ).
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col items-end">
                              <span
                                className={cn(
                                  "text-lg font-black italic",
                                  selectedGameId === "cards"
                                    ? prizes
                                        .filter(
                                          (p) => p.game_slug === selectedGameId,
                                        )
                                        .reduce(
                                          (acc, p) =>
                                            acc +
                                            (parseFloat(
                                              String(p.probability),
                                            ) || 0),
                                          0,
                                        ) !== 100
                                      ? "text-red-600"
                                      : "text-green-600"
                                    : prizes
                                          .filter(
                                            (p) =>
                                              p.game_slug === selectedGameId,
                                          )
                                          .reduce(
                                            (acc, p) =>
                                              acc +
                                              (parseFloat(
                                                String(p.probability),
                                              ) || 0),
                                            0,
                                          ) > 100
                                      ? "text-red-600"
                                      : "text-orange-600",
                                )}
                              >
                                {prizes
                                  .filter((p) => p.game_slug === selectedGameId)
                                  .reduce(
                                    (acc, p) =>
                                      acc +
                                      (parseFloat(String(p.probability)) || 0),
                                    0,
                                  )
                                  .toFixed(1)}
                                %
                              </span>
                              {selectedGameId === "cards" && (
                                <span
                                  className={`text-[10px] font-black uppercase tracking-widest ${
                                    prizes.filter(
                                      (p) => p.game_slug === selectedGameId,
                                    ).length !==
                                    (settings.game_configs["cards"]
                                      ?.card_count || 3)
                                      ? "text-red-500"
                                      : "text-green-500"
                                  }`}
                                >
                                  Призов:{" "}
                                  {
                                    prizes.filter(
                                      (p) => p.game_slug === selectedGameId,
                                    ).length
                                  }{" "}
                                  /{" "}
                                  {settings.game_configs["cards"]?.card_count ||
                                    3}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>

              <div className="flex justify-end mt-12 gap-4">
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  СОХРАНИТЬ ВСЕ
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "general" && (
          <motion.div
            key="general-settings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl space-y-8"
          >
            <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-lg uppercase italic">
                    Статус системы
                  </h3>
                  <p className="text-slate-500 text-sm font-medium">
                    Активация игрового модуля для гостей
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSettings({
                      ...settings,
                      is_promo_active: !settings.is_promo_active,
                    })
                  }
                  className={cn(
                    "w-16 h-8 rounded-full transition-all relative p-1",
                    settings.is_promo_active ? "bg-orange-500" : "bg-slate-200",
                  )}
                >
                  <div
                    className={cn(
                      "w-6 h-6 bg-white rounded-full shadow-sm transition-all",
                      settings.is_promo_active
                        ? "translate-x-8"
                        : "translate-x-0",
                    )}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                    Цена билета по умолчанию (₽)
                  </label>
                  <input
                    type="number"
                    value={settings.ticket_price}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ticket_price: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-xl outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                    Бонус за регистрацию (билетов)
                  </label>
                  <input
                    type="number"
                    value={settings.welcome_bonus_tickets || 0}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        welcome_bonus_tickets: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black text-xl outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Правила начисления (Гибкие)
                  </label>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        accrual_rules: [
                          ...(settings.accrual_rules || []),
                          { type: "threshold", amount: 1000, tickets: 3 },
                        ],
                      })
                    }
                    className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:underline"
                  >
                    + Добавить правило
                  </button>
                </div>

                <div className="space-y-3">
                  {(settings.accrual_rules || []).map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100"
                    >
                      <select
                        value={rule.type}
                        onChange={(e) => {
                          const newRules = [...settings.accrual_rules];
                          newRules[idx].type = e.target.value;
                          setSettings({ ...settings, accrual_rules: newRules });
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                      >
                        <option value="threshold">Фикс за сумму</option>
                        <option value="step">За каждые X руб</option>
                      </select>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase">
                          Сумма:
                        </span>
                        <input
                          type="number"
                          value={rule.amount}
                          onChange={(e) => {
                            const newRules = [...settings.accrual_rules];
                            newRules[idx].amount = parseInt(e.target.value);
                            setSettings({
                              ...settings,
                              accrual_rules: newRules,
                            });
                          }}
                          className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold outline-none"
                        />
                        <span className="text-[10px] font-black text-slate-400 uppercase ml-2">
                          Билетов:
                        </span>
                        <input
                          type="number"
                          value={rule.tickets}
                          onChange={(e) => {
                            const newRules = [...settings.accrual_rules];
                            newRules[idx].tickets = parseInt(e.target.value);
                            setSettings({
                              ...settings,
                              accrual_rules: newRules,
                            });
                          }}
                          className="w-16 bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold outline-none"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const newRules = settings.accrual_rules.filter(
                            (_, i) => i !== idx,
                          );
                          setSettings({ ...settings, accrual_rules: newRules });
                        }}
                        className="text-slate-300 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!settings.accrual_rules ||
                    settings.accrual_rules.length === 0) && (
                    <p className="text-[10px] text-slate-400 font-medium italic px-2">
                      Настройте гибкие правила (например, при пополнении на
                      1000₽ выдавать 3 билета вместо 2). Если правил нет,
                      используется цена по умолчанию.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                      <Ticket className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                        Интеграция с баром
                      </h4>
                      <p className="text-xs font-bold text-slate-800">
                        Автоматически начислять билеты за покупки в баре
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        bar_accrual_enabled: !settings.bar_accrual_enabled,
                      })
                    }
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative p-1",
                      settings.bar_accrual_enabled
                        ? "bg-orange-500"
                        : "bg-slate-200",
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                        settings.bar_accrual_enabled
                          ? "translate-x-6"
                          : "translate-x-0",
                      )}
                    />
                  </button>
                </div>

                {settings.bar_accrual_enabled && (
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Правила начисления для бара
                      </label>
                      <button
                        onClick={() =>
                          setSettings({
                            ...settings,
                            bar_accrual_rules: [
                              ...(settings.bar_accrual_rules || []),
                              { type: "threshold", amount: 1000, tickets: 3 },
                            ],
                          })
                        }
                        className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:underline"
                      >
                        + Добавить правило бара
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(settings.bar_accrual_rules || []).map((rule, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"
                        >
                          <select
                            value={rule.type}
                            onChange={(e) => {
                              const newRules = [...settings.bar_accrual_rules];
                              newRules[idx].type = e.target.value;
                              setSettings({
                                ...settings,
                                bar_accrual_rules: newRules,
                              });
                            }}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                          >
                            <option value="threshold">Фикс за сумму</option>
                            <option value="step">За каждые X руб</option>
                          </select>
                          <div className="flex-1 flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase">
                              Сумма:
                            </span>
                            <input
                              type="number"
                              value={rule.amount}
                              onChange={(e) => {
                                const newRules = [
                                  ...settings.bar_accrual_rules,
                                ];
                                newRules[idx].amount = parseInt(e.target.value);
                                setSettings({
                                  ...settings,
                                  bar_accrual_rules: newRules,
                                });
                              }}
                              className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold outline-none"
                            />
                            <span className="text-[10px] font-black text-slate-400 uppercase ml-2">
                              Билетов:
                            </span>
                            <input
                              type="number"
                              value={rule.tickets}
                              onChange={(e) => {
                                const newRules = [
                                  ...settings.bar_accrual_rules,
                                ];
                                newRules[idx].tickets = parseInt(
                                  e.target.value,
                                );
                                setSettings({
                                  ...settings,
                                  bar_accrual_rules: newRules,
                                });
                              }}
                              className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold outline-none"
                            />
                          </div>
                          <button
                            onClick={() => {
                              const newRules =
                                settings.bar_accrual_rules.filter(
                                  (_, i) => i !== idx,
                                );
                              setSettings({
                                ...settings,
                                bar_accrual_rules: newRules,
                              });
                            }}
                            className="text-slate-300 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {(!settings.bar_accrual_rules ||
                        settings.bar_accrual_rules.length === 0) && (
                        <p className="text-[10px] text-slate-400 font-medium italic px-2">
                          Если специфичные правила для бара не заданы, будут
                          применяться общие правила начисления (или базовая цена
                          билета).
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                      <Plus className="w-5 h-5 text-blue-500" />
                    </div>
                    <h4 className="text-sm font-black uppercase italic">
                      Статичный QR для ресепшена
                    </h4>
                  </div>
                  <button
                    onClick={() => {
                      const base = settings.domain || window.location.origin;
                      const link = base.startsWith("http")
                        ? base
                        : `https://${base}`;
                      const url = `${link}/promo?clubId=${clubId}&action=checkin`;
                      window.open(
                        `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`,
                        "_blank",
                      );
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                  >
                    Скачать QR для печати
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  Разместите этот QR-код на кассе или ресепшене. Когда гость
                  сканирует его, он автоматически появляется в вашей системе
                  продаж (кассе) как активный покупатель.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                  Отдельный домен (для PWA)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="play.yourclub.ru"
                    value={settings.domain}
                    onChange={(e) =>
                      setSettings({ ...settings, domain: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-lg outline-none focus:border-orange-500"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    .RU / .COM
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                СОХРАНИТЬ ВСЕ
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Card */}
      <div className="bg-orange-50 border border-orange-100 p-6 rounded-[2rem] flex gap-4 items-start">
        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
          <Info className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h4 className="font-black text-sm text-orange-900 uppercase italic">
            Как работает начисление?
          </h4>
          <p className="text-xs text-orange-700 font-medium mt-1 leading-relaxed">
            Билеты начисляются автоматически при пополнении баланса гостя через
            панель "Промо" в рабочем кабинете сотрудника или вручную в этом
            разделе. Система делит сумму пополнения на стоимость билета (
            {settings.ticket_price}₽) и выдает целое число попыток.
          </p>
        </div>
      </div>
    </div>
  );
}
