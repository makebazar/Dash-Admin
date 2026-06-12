"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  BarChart3,
  Ticket,
  Plus,
  Loader2,
  Search,
  RefreshCw,
  Trash2,
  Edit2,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CreditCard,
  History,
  ShieldAlert,
  Sparkles,
  ArrowLeft,
  Clock,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { BPActivationButton } from "./BPActivationButton";
import { setPlayerLimitGroupAction } from "../actions";

interface PlayersTabProps {
  clubId: string;
  players: any[];
  onRefresh: () => void;
  settings?: any;
}

export function PlayersTab({ clubId, players: initialPlayers, onRefresh, settings }: PlayersTabProps) {
  // Local state for pagination & search
  const [localPlayers, setLocalPlayers] = useState<any[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

  // Detail view state
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerLogs, setPlayerLogs] = useState<{ issuance: any[]; games: any[] }>({
    issuance: [],
    games: [],
  });
  const [activeLogTab, setActiveLogTab] = useState<"games" | "tickets">("games");
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Common UI states
  const [isIssuing, setIsIssuing] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [issueForm, setIssueForm] = useState({
    phone: "",
    amount: "",
    mode: "amount" as "amount" | "count",
    ticketCount: "1",
  });

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // reset to page 1 on new search
    }, 450);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch players with server-side pagination & search
  const fetchPlayers = async () => {
    setIsLoadingPlayers(true);
    try {
      const offset = (currentPage - 1) * 20;
      const res = await fetch(
        `/api/promo/admin/players?clubId=${clubId}&limit=20&offset=${offset}&search=${encodeURIComponent(
          debouncedSearch
        )}`
      );
      const data = await res.json();
      setLocalPlayers(data.players || []);
      setTotalPlayers(data.total || 0);
      
      // Keep selected player data updated if it's currently open
      if (selectedPlayer) {
        const updated = (data.players || []).find((p: any) => p.id === selectedPlayer.id);
        if (updated) {
          setSelectedPlayer(updated);
        }
      }
    } catch (error) {
      console.error("Fetch Players Error:", error);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [clubId, currentPage, debouncedSearch]);

  // Fetch logs for the selected player
  const fetchPlayerLogs = async (playerId: string) => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/api/promo/admin/logs?clubId=${clubId}&playerId=${playerId}`);
      const data = await res.json();
      setPlayerLogs({
        issuance: data.issuanceLogs || [],
        games: data.gameLogs || [],
      });
    } catch (e) {
      console.error("Fetch player logs error:", e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (selectedPlayer) {
      fetchPlayerLogs(selectedPlayer.id);
    }
  }, [selectedPlayer?.id, clubId]);

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
        fetchPlayers();
        onRefresh();
      }
    } catch (error) {
      console.error("Issue Tickets Error:", error);
    } finally {
      setIsIssuing(false);
    }
  };

  const handleUpdatePlayer = async () => {
    if (!editingPlayer) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/promo/admin/players?clubId=${clubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: editingPlayer.id,
          clubId,
          fullName: editingPlayer.full_name,
          totalXp: editingPlayer.total_xp,
          bonusBalance: editingPlayer.bonus_balance,
          ticketsCount: editingPlayer.tickets_count,
        }),
      });
      if (res.ok) {
        setEditingPlayer(null);
        fetchPlayers();
        onRefresh();
      }
    } catch (error) {
      console.error("Update Player Error:", error);
    } finally {
      setIsSaving(false);
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
        }
      );
      fetchPlayers();
      onRefresh();
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

  const totalPages = Math.ceil(totalPlayers / 20) || 1;

  // Pagination helper to build page arrays with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 1;
    
    pages.push(1);
    
    if (currentPage > 2 + delta) {
      pages.push("...");
    }
    
    const start = Math.max(2, currentPage - delta);
    const end = Math.min(totalPages - 1, currentPage + delta);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (currentPage < totalPages - 1 - delta) {
      pages.push("...");
    }
    
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };

  // Helper to format log transaction details
  const getLogDetails = (log: any) => {
    const icon = (() => {
      switch (log.game_type) {
        case "mines": return "💣";
        case "rocket": return "🚀";
        case "dice": return "🎲";
        case "safe": return "🔒";
        case "cards": return "🃏";
        case "flappy": return "🐦";
        case "WITHDRAW": return "💸";
        case "BAR_BONUS_PURCHASE": return "🛒";
        case "QUEST_REWARD": return "🎁";
        case "TOPUP": return "💳";
        case "SERVICE_AWARD": return "⚡";
        default: return "💰";
      }
    })();

    const isWin = log.prize_type === "virtual" || (log.result_data && parseFloat(log.result_data.amount || "0") > 0);
    const isLoss = log.prize_type === "bet" || (log.result_data && parseFloat(log.result_data.amount || "0") < 0);
    
    let sumText = "";
    let sumColor = "text-slate-400";
    
    if (log.result_data) {
      const amt = parseFloat(log.result_data.amount || "0");
      if (amt !== 0) {
        sumText = amt > 0 ? `+${Math.round(amt)} ₽` : `${Math.round(amt)} ₽`;
        sumColor = amt > 0 ? "text-emerald-500 font-extrabold" : "text-rose-500 font-bold";
      } else if (log.result_data.bonus_cost) {
        sumText = `-${Math.round(log.result_data.bonus_cost)} 🪙`;
        sumColor = "text-amber-500 font-extrabold";
      }
    }

    return { icon, isWin, isLoss, sumText, sumColor };
  };

  // Helper to explain why tickets were awarded
  const getTicketReason = (log: any) => {
    const src = log.source;
    const gameType = log.history_game_type;
    const resData = log.history_result_data;
    
    switch (src) {
      case "topup": {
        const amt = resData?.amount;
        return amt 
          ? `Авто-начисление за пополнение на ${Math.round(amt)} ₽`
          : "Авто-начисление за пополнение баланса";
      }
      case "pos_sale": {
        const amt = resData?.items_total || resData?.amount;
        return amt 
          ? `Покупка в баре на сумму ${Math.round(amt)} ₽`
          : "Покупка товаров в баре";
      }
      case "service_award": {
        const ruleName = resData?.rule_name;
        return ruleName 
          ? `За покупку услуг: ${ruleName}`
          : "Покупка игровых услуг";
      }
      case "admin_edit":
        return "Начислено администратором вручную";
      case "quest_reward": {
        const questTitle = resData?.quest_title;
        return questTitle 
          ? `Награда за квест: "${questTitle}"`
          : "Награда за выполнение квеста";
      }
      case "bp_reward":
        return "Награда за уровень в Battle Pass";
      case "registration_bonus":
        return "Приветственный бонус при регистрации";
      case "login_bonus":
        return "Ежедневный бонус за вход в систему";
      case "game_payout":
        return `Выигрыш в игре ${gameType || "Wheel"}`;
      default:
        return `Промо-активность (${src})`;
    }
  };

  // Helper to render edit modal in both views
  const renderEditModal = () => {
    if (!editingPlayer) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
        >
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black uppercase italic text-slate-900">
                Редактировать <span className="text-blue-500">игрока</span>
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {editingPlayer.phone_number}
              </p>
            </div>
            <button
              onClick={() => setEditingPlayer(null)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                Имя игрока
              </label>
              <div className="relative">
                <Edit2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={editingPlayer.full_name || ""}
                  onChange={(e) =>
                    setEditingPlayer({
                      ...editingPlayer,
                      full_name: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-11 pr-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Опыт (XP)
                </label>
                <input
                  type="number"
                  value={editingPlayer.total_xp}
                  onChange={(e) =>
                    setEditingPlayer({
                      ...editingPlayer,
                      total_xp: parseFloat(e.target.value),
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Билеты (шт)
                </label>
                <div className="relative">
                  <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    value={editingPlayer.tickets_count || 0}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        tickets_count: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-11 pr-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                Бонусный баланс (₽)
              </label>
              <input
                type="number"
                value={editingPlayer.bonus_balance}
                onChange={(e) =>
                  setEditingPlayer({
                    ...editingPlayer,
                    bonus_balance: parseFloat(e.target.value),
                  })
                }
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all outline-none"
              />
            </div>

            <div className="pt-4">
              <button
                onClick={handleUpdatePlayer}
                disabled={isSaving}
                className="w-full h-15 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center gap-3 font-black uppercase italic tracking-wider transition-all shadow-xl active:scale-[0.98]"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Сохранить изменения
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────
  // DEDICATED FULL-PAGE PLAYER PROFILE RENDER
  // ────────────────────────────────────────────────────────
  if (selectedPlayer) {
    return (
      <motion.div
        key="player-detail-page"
        initial={{ opacity: 0, x: 25 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -25 }}
        className="space-y-8"
      >
        {/* Back Button & Main Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={() => setSelectedPlayer(null)}
            className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-black uppercase italic tracking-wider transition-all shadow-sm max-w-fit"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            Назад к списку игроков
          </button>
          
          <div className="flex items-center gap-3">
            {settings?.limit_groups && settings.limit_groups.length > 0 && (
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Группа:</span>
                <select
                  value={selectedPlayer.limit_group_id || "default"}
                  disabled={isSavingGroup}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setIsSavingGroup(true);
                    try {
                      const res = await setPlayerLimitGroupAction(
                        clubId,
                        selectedPlayer.id,
                        val === "default" ? null : val
                      );
                      if (res.success) {
                        setSelectedPlayer({
                          ...selectedPlayer,
                          limit_group_id: val === "default" ? null : val
                        });
                        onRefresh();
                      } else {
                        alert("Ошибка: " + res.error);
                      }
                    } catch (err: any) {
                      alert("Ошибка: " + err.message);
                    } finally {
                      setIsSavingGroup(false);
                    }
                  }}
                  className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer text-slate-800"
                >
                  <option value="default">Стандартная</option>
                  {settings.limit_groups.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <BPActivationButton
              clubId={clubId}
              playerId={selectedPlayer.id}
              hasPremium={selectedPlayer.bp_is_premium}
            />
          </div>
        </div>

        {/* Player Profile Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white p-8 md:p-10 rounded-[2.5rem] shadow-lg border border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight">
                  {selectedPlayer.full_name || "Имя не указано"}
                </h2>
                {selectedPlayer.bp_is_premium && (
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-lg shadow-yellow-500/20">
                    <Sparkles className="w-3 h-3" />
                    Battle Pass Premium
                  </div>
                )}
                {selectedPlayer.limit_group_id && settings?.limit_groups && (
                  (() => {
                    const group = settings.limit_groups.find((g: any) => g.id === selectedPlayer.limit_group_id);
                    if (!group) return null;
                    return (
                      <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-lg shadow-teal-500/20">
                        <Sparkles className="w-3 h-3" />
                        {group.name}
                      </div>
                    );
                  })()
                )}
              </div>
              <div className="flex items-center gap-4 text-slate-400 font-bold text-sm">
                <span>{selectedPlayer.phone_number}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                <span className="uppercase tracking-wider text-xs">ID: {selectedPlayer.id}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center font-black text-white italic text-3xl shadow-xl shadow-blue-500/20">
                {selectedPlayer.level || 1}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Текущий Уровень</p>
                <p className="text-sm font-extrabold text-slate-200">
                  {Math.round(selectedPlayer.total_xp || 0)} / {selectedPlayer.next_level_xp} XP
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Level Progress */}
          <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Прогресс уровня</span>
              <span className="text-xs font-black text-blue-500 bg-blue-50 px-2.5 py-1 rounded-lg">XP</span>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-black text-slate-900 italic">
                {Math.round(selectedPlayer.total_xp || 0)} <span className="text-xs text-slate-400 font-extrabold not-italic">XP</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (((selectedPlayer.total_xp || 0) -
                        (selectedPlayer.current_level_xp || 0)) /
                        ((selectedPlayer.next_level_xp || 1) -
                          (selectedPlayer.current_level_xp || 0))) *
                        100,
                    )}%`,
                  }}
                />
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                Осталось {Math.max(0, Math.round((selectedPlayer.next_level_xp || 0) - (selectedPlayer.total_xp || 0)))} XP до { (selectedPlayer.level || 1) + 1 } уровня
              </p>
            </div>
          </div>

          {/* Bonus Balance */}
          <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Бонусный Баланс</span>
              <Coins className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <div className="text-4xl font-black text-emerald-600 italic tracking-tighter">
                {Math.round(selectedPlayer.bonus_balance || 0)} <span className="text-lg font-bold not-italic">₽</span>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                Доступно для списания на маркет/игры
              </p>
              
              <div className="space-y-1 text-[9px] font-black uppercase text-slate-400 tracking-wide mt-2 pt-2 border-t border-slate-100/70">
                <p className="flex items-center justify-between">
                  <span>Бар за бонусы (розн):</span>
                  <span className="text-slate-700 font-extrabold">{Math.round(selectedPlayer.bar_retail_total || 0)} ₽</span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Себестоимость (закуп):</span>
                  <span className="text-slate-500 font-extrabold">{Math.round(selectedPlayer.bar_cost_total || 0)} ₽</span>
                </p>
              </div>
            </div>
          </div>

          {/* Active Tickets */}
          <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Активные Билеты</span>
              <Ticket className="w-4 h-4 text-amber-500" />
            </div>
            <div className="space-y-1">
              <div className="text-4xl font-black text-amber-600 italic tracking-tighter">
                {selectedPlayer.tickets_count || 0} <span className="text-lg font-bold not-italic">шт</span>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                Билеты для участия в активностях
              </p>

              <div className="flex items-center justify-between text-[9px] font-black uppercase text-slate-400 tracking-wide mt-2 pt-2 border-t border-slate-100/70">
                <span>Всего получено:</span>
                <span className="text-amber-600 font-extrabold">{selectedPlayer.total_tickets_received || 0} шт</span>
              </div>
            </div>
          </div>

          {/* Money Topups & Withdraws */}
          <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Финансовый Оборот</span>
              <CreditCard className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm font-extrabold">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2 text-center">
                  <p className="text-[8px] font-black uppercase text-emerald-600 tracking-wider mb-0.5">Пополнил</p>
                  <p className="text-emerald-700 text-base font-black">+{Math.round(selectedPlayer.total_deposited || 0)} ₽</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-2 text-center">
                  <p className="text-[8px] font-black uppercase text-rose-500 tracking-wider mb-0.5">Списал</p>
                  <p className="text-rose-700 text-base font-black">-{Math.round(selectedPlayer.total_withdrawn || 0)} ₽</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Administration Controls */}
        <div className="bg-slate-100/80 border border-slate-200/60 rounded-[2rem] p-6 md:p-8 space-y-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 animate-pulse mt-0.5" />
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-800">
                Панель управления администратора
              </h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">
                Выполняйте административные действия и изменяйте балансы игрока напрямую
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setEditingPlayer(selectedPlayer)}
              className="px-6 py-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-blue-500/10 active:scale-[0.98]"
            >
              <Edit2 className="w-4 h-4" />
              Редактировать параметры игрока
            </button>
            <button
              onClick={() => resetPlayerPin(selectedPlayer.id)}
              className="px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-amber-500/10 active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              Сбросить PIN-код
            </button>
            <button
              onClick={() => resetPlayerTickets(selectedPlayer.id)}
              className="px-6 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-rose-500/10 active:scale-[0.98]"
            >
              <Trash2 className="w-4 h-4" />
              Обнулить все билеты
            </button>
          </div>
        </div>

        {/* Large Layout Activity logs table */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 gap-4">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="text-base font-black uppercase tracking-widest text-slate-800">
                  Полные логи и аудит активности
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Вся история игр, начислений билетов и транзакций игрока</p>
              </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl max-w-fit">
              <button
                onClick={() => setActiveLogTab("games")}
                className={cn(
                  "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  activeLogTab === "games"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                Игры и Выплаты
              </button>
              <button
                onClick={() => setActiveLogTab("tickets")}
                className={cn(
                  "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  activeLogTab === "tickets"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                История билетов
              </button>
            </div>
          </div>

          {isLoadingLogs ? (
            <div className="py-24 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            </div>
          ) : activeLogTab === "games" ? (
            <div className="overflow-x-auto">
              {playerLogs.games.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm font-bold uppercase tracking-wider">
                  Записи об играх и выплатах отсутствуют
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="pb-4">Событие / Игра</th>
                      <th className="pb-4">Тип</th>
                      <th className="pb-4">Дата и время</th>
                      <th className="pb-4 text-right">Изменение баланса</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-700">
                    {playerLogs.games.map((log) => {
                      const details = getLogDetails(log);
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/40">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-lg w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200/50">{details.icon}</span>
                              <span className="font-extrabold uppercase text-slate-900 tracking-tight">{log.prize_name}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className="uppercase text-[10px] font-extrabold tracking-widest text-slate-400">
                              {log.game_type}
                            </span>
                          </td>
                          <td className="py-4 text-slate-400 font-medium">
                            {new Date(log.created_at).toLocaleString("ru-RU")}
                          </td>
                          <td className={cn("py-4 text-right text-sm", details.sumColor)}>
                            {details.sumText || "0 ₽"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {playerLogs.issuance.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm font-bold uppercase tracking-wider">
                  Записи о выдаче билетов отсутствуют
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="pb-4">Активность</th>
                      <th className="pb-4">Источник</th>
                      <th className="pb-4">Дата и время</th>
                      <th className="pb-4 text-right">Количество билетов</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-700">
                    {playerLogs.issuance.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/40">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 border border-amber-100"><Ticket className="w-4 h-4" /></span>
                            <div className="space-y-0.5">
                              <span className="font-extrabold uppercase text-slate-900 tracking-tight">Выдача билета</span>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                {getTicketReason(log)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider">
                            {log.source}
                          </span>
                        </td>
                        <td className="py-4 text-slate-400 font-medium">
                          {new Date(log.created_at).toLocaleString("ru-RU")}
                        </td>
                        <td className="py-4 text-right text-slate-900 font-black text-sm">
                          +{log.batch_count || 1} шт
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
        {renderEditModal()}
      </motion.div>
    );
  }

  // ────────────────────────────────────────────────────────
  // ORIGINAL PLAYERS LIST RENDER WITH PAGINATION
  // ────────────────────────────────────────────────────────
  return (
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
              onClick={() => setIssueForm({ ...issueForm, mode: "amount" })}
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
              onClick={() => setIssueForm({ ...issueForm, mode: "count" })}
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
              className="w-full h-13 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center gap-2 font-black uppercase italic tracking-wider transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]"
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

      {/* Players List Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-blue-500 animate-pulse" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                База игроков
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                Всего игроков: <span className="text-blue-500 font-extrabold">{totalPlayers}</span>
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              type="text"
              placeholder="Поиск по телефону или имени..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 outline-none transition-all shadow-sm"
            />
            {isLoadingPlayers && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden relative">
          {isLoadingPlayers && localPlayers.length === 0 && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10 py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Игрок
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Уровень / XP
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Баланс 🪙
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Пополнил (₽)
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Списал (₽)
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {localPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-sm font-bold text-slate-400">
                      Игроки не найдены
                    </td>
                  </tr>
                ) : (
                  localPlayers.map((player) => (
                    <tr 
                      key={player.id} 
                      onClick={() => setSelectedPlayer(player)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-8 py-5">
                        <div className="font-black italic uppercase text-slate-900 group-hover:text-blue-500 transition-colors">
                          {player.full_name || "Не указано"}
                        </div>
                        <div className="text-xs font-bold text-slate-400 mt-0.5">
                          {player.phone_number}
                        </div>
                      </td>
                      <td className="px-8 py-5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-black text-white italic shrink-0 shadow-md shadow-blue-500/10">
                            {player.level || 1}
                          </div>
                          <div className="space-y-1">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                              {Math.round(player.total_xp || 0)} /{" "}
                              {player.next_level_xp} XP
                            </div>
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (((player.total_xp || 0) -
                                      (player.current_level_xp || 0)) /
                                      ((player.next_level_xp || 1) -
                                        (player.current_level_xp || 0))) *
                                      100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="font-black text-emerald-600 italic text-lg flex items-center gap-1">
                          {Math.round(player.bonus_balance || 0)} <span className="text-sm font-bold text-emerald-500/80">₽</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="font-black text-amber-600 italic text-base">
                          {Math.round(player.total_deposited || 0)}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="font-black text-red-500 italic text-base">
                          {Math.round(player.total_withdrawn || 0)}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <BPActivationButton
                            clubId={clubId}
                            playerId={player.id}
                            hasPremium={player.bp_is_premium}
                          />
                          <button
                            onClick={() => setSelectedPlayer(player)}
                            title="Посмотреть профиль и логи"
                            className="p-2 hover:bg-slate-100 text-slate-500 rounded-xl transition-colors"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingPlayer(player)}
                            title="Редактировать"
                            className="p-2 hover:bg-blue-50 text-blue-500 rounded-xl transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => resetPlayerPin(player.id)}
                            title="Сбросить PIN"
                            className="p-2 hover:bg-amber-50 text-amber-500 rounded-xl transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => resetPlayerTickets(player.id)}
                            title="Обнулить билеты"
                            className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Elegant Pagination Footer */}
          {totalPages > 1 && (
            <div className="bg-slate-50/50 border-t border-slate-100 px-8 py-5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Страница <span className="text-slate-700 font-extrabold">{currentPage}</span> из <span className="text-slate-700 font-extrabold">{totalPages}</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 rounded-xl bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500 transition-all outline-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {getPageNumbers().map((pageNum, idx) => (
                  <button
                    key={idx}
                    disabled={pageNum === "..."}
                    onClick={() => typeof pageNum === "number" && setCurrentPage(pageNum)}
                    className={cn(
                      "min-w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all outline-none border",
                      pageNum === currentPage
                        ? "bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/10 scale-105"
                        : pageNum === "..."
                        ? "border-transparent bg-transparent text-slate-400 cursor-default"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    )}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-200 rounded-xl bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500 transition-all outline-none"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {renderEditModal()}
    </motion.div>
  );
}
