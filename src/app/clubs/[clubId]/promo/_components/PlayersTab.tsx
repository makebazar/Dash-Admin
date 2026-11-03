"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

import { setPlayerLimitGroupAction } from "../actions";

interface PlayersTabProps {
  clubId: string;
  players: any[];
  onRefresh: () => void;
  settings?: any;
}

export function PlayersTab({ clubId, players: initialPlayers, onRefresh, settings }: PlayersTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playerIdParam = searchParams.get("playerId");

  // Local state for pagination & search
  const [localPlayers, setLocalPlayers] = useState<any[]>(() => initialPlayers || []);
  const [totalPlayers, setTotalPlayers] = useState(() => initialPlayers?.length || 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

  // Detail view state
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerLogs, setPlayerLogs] = useState<{
    issuance: any[];
    games: any[];
    inventory: any[];
    loyalty: any;
    quests: any[];
  }>({
    issuance: [],
    games: [],
    inventory: [],
    loyalty: null,
    quests: [],
  });
  const [activeLogTab, setActiveLogTab] = useState<
    "games_tickets" | "games_bets" | "cases" | "transactions" | "tickets" | "inventory" | "quests"
  >("games_tickets");
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Pagination for logs panel on the player details page
  const [logPage, setLogPage] = useState(1);
  const [logPageSize] = useState(20);
  const [logTotal, setLogTotal] = useState(0);
  const [paginatedLogs, setPaginatedLogs] = useState<any[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("current");

  const getAvailableMonths = () => {
    const list: { value: string; label: string }[] = [];
    const now = new Date();
    const currentName = now.toLocaleString("ru-RU", { month: "long", year: "numeric" });
    const currentCapitalized = currentName.charAt(0).toUpperCase() + currentName.slice(1);
    list.push({
      value: "current",
      label: currentCapitalized,
    });
    for (let i = 1; i <= 11; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const name = d.toLocaleString("ru-RU", { month: "long", year: "numeric" });
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
      list.push({ value: val, label: capitalized });
    }
    list.push({ value: "all", label: "За всё время" });
    return list;
  };

  const getMonthDisplayName = (monthVal: string) => {
    if (monthVal === "all") return "За всё время";
    if (monthVal === "current") {
      const now = new Date();
      const name = now.toLocaleString("ru-RU", { month: "long", year: "numeric" });
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    const [y, m] = monthVal.split("-").map(Number);
    if (y && m) {
      const d = new Date(y, m - 1, 1);
      const name = d.toLocaleString("ru-RU", { month: "long", year: "numeric" });
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return monthVal;
  };

  const getShortMonthName = (monthVal: string) => {
    if (monthVal === "all") return "все";
    if (monthVal === "current") {
      const now = new Date();
      return now.toLocaleString("ru-RU", { month: "short" });
    }
    const [y, m] = monthVal.split("-").map(Number);
    if (y && m) {
      const d = new Date(y, m - 1, 1);
      return d.toLocaleString("ru-RU", { month: "short" });
    }
    return monthVal;
  };

  const selectPlayer = (player: any) => {
    setSelectedPlayer(player);
    const params = new URLSearchParams(window.location.search);
    if (player) {
      params.set("playerId", String(player.id));
    } else {
      params.delete("playerId");
    }
    router.replace(`?${params.toString()}`);
  };

  // Sync selectedPlayer with URL playerId parameter & selectedMonth
  useEffect(() => {
    if (playerIdParam) {
      const fetchSinglePlayer = async () => {
        try {
          const res = await fetch(`/api/promo/admin/players?clubId=${clubId}&playerId=${playerIdParam}&month=${selectedMonth}`);
          const data = await res.json();
          if (data.players && data.players.length > 0) {
            setSelectedPlayer(data.players[0]);
          }
        } catch (e) {
          console.error("Error fetching single player:", e);
        }
      };
      fetchSinglePlayer();
    } else {
      setSelectedPlayer(null);
    }
  }, [playerIdParam, clubId, selectedMonth]);

  // Reset log page when activeLogTab or selectedMonth changes
  useEffect(() => {
    setLogPage(1);
    setPaginatedLogs([]);
    setLogTotal(0);
  }, [activeLogTab, selectedMonth]);

  // Fetch paginated logs for the active tab on player details page
  useEffect(() => {
    if (!selectedPlayer) return;
    if (activeLogTab === "inventory" || activeLogTab === "quests") return;

    let active = true;
    const fetchTabLogs = async () => {
      setIsLogsLoading(true);
      try {
        const offset = (logPage - 1) * logPageSize;
        let url = `/api/promo/admin/logs?clubId=${clubId}&playerId=${selectedPlayer.id}&limit=${logPageSize}&offset=${offset}&month=${selectedMonth}`;
        
        if (activeLogTab === "tickets") {
          url += `&logType=issuance`;
        } else {
          url += `&logType=games`;
          if (activeLogTab === "games_tickets") {
            url += `&gameType=games_tickets`;
          } else if (activeLogTab === "games_bets") {
            url += `&gameType=games_bets`;
          } else if (activeLogTab === "cases") {
            url += `&gameType=cases`;
          } else if (activeLogTab === "transactions") {
            url += `&gameType=transactions`;
          }
        }

        const res = await fetch(url);
        const data = await res.json();
        if (active && data.success) {
          setPaginatedLogs(data.logs || []);
          setLogTotal(data.total || 0);
        }
      } catch (err) {
        console.error("Error fetching player tab logs:", err);
      } finally {
        if (active) setIsLogsLoading(false);
      }
    };

    fetchTabLogs();
    return () => {
      active = false;
    };
  }, [selectedPlayer?.id, activeLogTab, logPage, logPageSize, clubId, selectedMonth]);

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
        const updated = (data.players || []).find((p: any) => String(p.id) === String(selectedPlayer.id));
        if (updated) {
          setSelectedPlayer(updated);
        } else {
          const singleRes = await fetch(`/api/promo/admin/players?clubId=${clubId}&playerId=${selectedPlayer.id}`);
          const singleData = await singleRes.json();
          if (singleData.players && singleData.players.length > 0) {
            setSelectedPlayer(singleData.players[0]);
          }
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
        inventory: data.inventory || [],
        loyalty: data.loyalty || null,
        quests: data.quests || [],
      });
    } catch (e) {
      console.error("Fetch player logs error:", e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleRefundInventoryItem = async (inventoryId: string) => {
    if (!confirm("Вы уверены, что хотите вернуть средства за этот предмет и отменить его выдачу?")) {
      return;
    }
    try {
      const res = await fetch(`/api/promo/admin/players/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId, clubId }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Средства успешно возвращены игроку! Сумма возврата: ${data.refundedAmount} ₽`);
        if (selectedPlayer) {
          fetchPlayerLogs(selectedPlayer.id);
          fetchPlayers();
          onRefresh();
        }
      } else {
        alert("Ошибка при возврате средств: " + data.error);
      }
    } catch (e) {
      console.error("Refund error:", e);
      alert("Не удалось выполнить возврат средств.");
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
          phoneNumber: editingPlayer.phone_number,
          extraWithdrawLimit: editingPlayer.extra_withdraw_limit,
          limitGroupId: editingPlayer.limit_group_id,
          activeBoostPercent: editingPlayer.active_boost_percent,
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
      const res = await fetch(`/api/promo/admin/players/reset-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, clubId }),
      });
      if (res.ok) {
        alert("PIN-код сброшен");
      } else {
        const data = await res.json().catch(() => ({}));
        alert("Ошибка сброса: " + (data.error || "неизвестная ошибка"));
      }
    } catch (error) {
      console.error("Reset PIN Error:", error);
      alert("Ошибка сети");
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

  const getLogTypeRussian = (type: string) => {
    switch (type?.toLowerCase()) {
      case "mines": return "Мины";
      case "rocket": return "Ракета";
      case "dice": return "Кости";
      case "safe": return "Сейф";
      case "cards": return "Карты";
      case "defuse": return "Сапёр C4";
      case "flappy": return "Флаппи";
      case "topup": return "Пополнение";
      case "service_award": return "Услуга";
      case "bar_bonus_purchase": return "Покупка в баре";
      case "withdraw": return "Вывод";
      case "quest_reward": return "Квест";
      case "case_open": return "Открытие кейса";
      case "case_refund": return "Возврат за кейс";
      case "wheel": return "Колесо фортуны";
      default: return type || "Другое";
    }
  };

  // Helper to format log transaction details
  const getLogDetails = (log: any) => {
    const isWithdraw = log.game_type === "WITHDRAW" || log.prize_type === "withdraw";
    const isWin = !isWithdraw && (log.prize_type === "virtual" || (log.result_data && parseFloat(log.result_data.amount || "0") > 0));
    const isLoss = isWithdraw || log.prize_type === "bet" || (log.result_data && parseFloat(log.result_data.amount || "0") < 0);
    
    let sumText = "";
    let sumColor = "text-slate-400";
    
    const prizeVal = log.prize_value ? parseFloat(log.prize_value) : 0;
    if (isWithdraw) {
      const amt = Math.abs(parseFloat(log.result_data?.amount || prizeVal || "0"));
      sumText = `-${Math.round(amt)} ₽`;
      sumColor = "text-rose-600 font-semibold";
    } else if (prizeVal > 0) {
      if (log.prize_type === "virtual") {
        sumText = `+${Math.round(prizeVal)} ₽`;
        sumColor = "text-emerald-600 font-semibold";
      } else if (log.prize_type === "bonus") {
        sumText = `+${Math.round(prizeVal)} XP`;
        sumColor = "text-indigo-600 font-semibold";
      } else if (log.prize_type === "attempt") {
        sumText = `+${Math.round(prizeVal)} шт`;
        sumColor = "text-slate-900 font-semibold";
      } else {
        sumText = `+${Math.round(prizeVal)}`;
        sumColor = "text-slate-600 font-semibold";
      }
    } else if (log.game_type === "SERVICE_AWARD") {
      const tix = log.result_data?.tickets || 1;
      sumText = `+${tix} шт`;
      sumColor = "text-slate-900 font-semibold";
    } else if (log.game_type === "QUEST_REWARD") {
      const rewards = [];
      if (log.result_data?.reward_bonus_balance) rewards.push(`+${Math.round(log.result_data.reward_bonus_balance)} ₽`);
      if (log.result_data?.reward_tickets) rewards.push(`+${log.result_data.reward_tickets} шт`);
      if (log.result_data?.reward_xp) rewards.push(`+${log.result_data.reward_xp} XP`);
      
      sumText = rewards.join(" | ") || "Награда";
      sumColor = "text-emerald-600 font-semibold";
    } else if (log.result_data) {
      const amt = parseFloat(log.result_data.amount || "0");
      if (amt !== 0) {
        sumText = amt > 0 ? `+${Math.round(amt)} ₽` : `${Math.round(amt)} ₽`;
        sumColor = amt > 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold";
      } else if (log.result_data.bonus_cost) {
        sumText = `-${Math.round(log.result_data.bonus_cost)} ₽`;
        sumColor = "text-rose-600 font-semibold";
      } else if (log.game_type === "CASE_OPEN" && log.result_data.cost) {
        sumText = `-${Math.round(log.result_data.cost)} ₽`;
        sumColor = "text-rose-600 font-semibold";
      } else if (log.game_type === "CASE_REFUND" && log.result_data.amount) {
        sumText = `+${Math.round(log.result_data.amount)} ₽`;
        sumColor = "text-emerald-600 font-semibold";
      }
    }

    return { icon: "", isWin, isLoss, sumText, sumColor };
  };

  // Helper to translate ticket issuance source to Russian
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
        return "Вход в систему";
      case "game_payout":
        return "Выигрыш в игре";
      default:
        return src || "Система";
    }
  };

  // Helper to explain why tickets were awarded
  const getTicketReason = (log: any) => {
    const src = log.source;
    const gameType = log.history_game_type;
    let resData = log.history_result_data;
    if (typeof resData === "string") {
      try {
        resData = JSON.parse(resData);
      } catch (e) {
        resData = null;
      }
    }
    
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
        const ruleName = resData?.rule_name || resData?.service_name || resData?.tariff_name || resData?.title || resData?.name;
        return ruleName 
          ? `Услуга: ${ruleName}`
          : "Покупка игровой услуги";
      }
      case "admin_manual":
      case "admin_edit":
        return "Ручное начисление администратором";
      case "quest_reward": {
        const questTitle = resData?.quest_title || resData?.title;
        return questTitle 
          ? `Награда за квест: "${questTitle}"`
          : "Награда за выполнение квеста";
      }
      case "bp_reward":
        return "Награда за уровень в Battle Pass";
      case "registration_bonus":
      case "welcome_bonus":
        return "Приветственный бонус при регистрации";
      case "login_bonus":
        return "Ежедневный бонус за вход в систему";
      case "game_payout":
        return `Выигрыш в игре ${gameType || "Колесо"}`;
      default:
        return `Промо-активность`;
    }
  };

  // Helper to render edit modal in both views
  const renderEditModal = () => {
    if (!editingPlayer) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Редактирование игрока
              </h3>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                {editingPlayer.phone_number}
              </p>
            </div>
            <button
              onClick={() => setEditingPlayer(null)}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Имя игрока
                </label>
                <div className="relative">
                  <Edit2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={editingPlayer.full_name || ""}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        full_name: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl h-10 pl-9 pr-3 text-sm font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Номер телефона
                </label>
                <input
                  type="text"
                  value={editingPlayer.phone_number || ""}
                  onChange={(e) =>
                    setEditingPlayer({
                      ...editingPlayer,
                      phone_number: e.target.value,
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl h-10 px-3 text-sm font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Билеты (шт)
                </label>
                <div className="relative">
                  <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    value={editingPlayer.tickets_count || 0}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        tickets_count: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl h-10 pl-9 pr-3 text-sm font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Бонусный баланс (₽)
                </label>
                <input
                  type="number"
                  value={editingPlayer.bonus_balance}
                  onChange={(e) =>
                    setEditingPlayer({
                      ...editingPlayer,
                      bonus_balance: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl h-10 px-3 text-sm font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Экстра-лимит (₽)
                </label>
                <input
                  type="number"
                  value={editingPlayer.extra_withdraw_limit || 0}
                  onChange={(e) =>
                    setEditingPlayer({
                      ...editingPlayer,
                      extra_withdraw_limit: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl h-10 px-3 text-sm font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Буст вывода (%)
                </label>
                <input
                  type="number"
                  value={editingPlayer.active_boost_percent || 0}
                  onChange={(e) =>
                    setEditingPlayer({
                      ...editingPlayer,
                      active_boost_percent: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl h-10 px-3 text-sm font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleUpdatePlayer}
                disabled={isSaving}
                className="w-full h-10 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 font-medium text-xs sm:text-sm transition-all shadow-xs cursor-pointer active:scale-98"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Сохранить изменения</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────
  // DEDICATED FULL-PAGE PLAYER PROFILE RENDER
  // ────────────────────────────────────────────────────────
  if (selectedPlayer) {
    const renderLogPagination = () => {
      const totalPages = Math.ceil(logTotal / logPageSize);
      if (totalPages <= 1) return null;
      return (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
          <div className="text-xs text-slate-500 font-medium">
            Показано {paginatedLogs.length} из {logTotal}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLogPage((p) => Math.max(1, p - 1))}
              disabled={logPage === 1 || isLogsLoading}
              className="p-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-all outline-none cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <div className="text-xs font-semibold text-slate-700 px-2">
              {logPage} из {totalPages}
            </div>
            <button
              onClick={() => setLogPage((p) => Math.min(totalPages, p + 1))}
              disabled={logPage === totalPages || isLogsLoading}
              className="p-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-all outline-none cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      );
    };

    const renderGameLogsTable = (logs: any[], emptyMessage: string) => {
      if (logs.length === 0) {
        return (
          <div className="text-center py-12 text-slate-400 text-sm font-medium">
            {emptyMessage}
          </div>
        );
      }
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/60 text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">Событие / Игра</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Дата и время</th>
                <th className="px-4 py-3 text-right">Изменение баланса</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {logs.map((log) => {
                const details = getLogDetails(log);
                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {log.prize_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-slate-700">
                        {getLogTypeRussian(log.game_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString("ru-RU")}
                    </td>
                    <td className={cn("px-4 py-3 text-right font-semibold", details.sumColor)}>
                      {details.sumText || "0 ₽"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {/* Back Button & Top Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={() => selectPlayer(null)}
            className="inline-flex items-center gap-2 h-10 rounded-xl px-3.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium text-xs transition-all shadow-xs cursor-pointer max-w-fit"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Назад к списку игроков</span>
          </button>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Period / Month Selector */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500">Период:</span>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setLogPage(1);
                }}
                className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer text-slate-900"
              >
                {getAvailableMonths().map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {settings?.limit_groups && settings.limit_groups.length > 0 && (
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs font-medium text-slate-500">Группа лимитов:</span>
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
                  className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer text-slate-900"
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
          </div>
        </div>

        {/* Player Profile Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {selectedPlayer.full_name || "Имя не указано"}
              </h2>
              {selectedPlayer.limit_group_id && settings?.limit_groups && (
                (() => {
                  const group = settings.limit_groups.find((g: any) => g.id === selectedPlayer.limit_group_id);
                  if (!group) return null;
                  return (
                    <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium px-2.5 py-0.5 rounded-lg">
                      {group.name}
                    </span>
                  );
                })()
              )}
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {selectedPlayer.phone_number}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setEditingPlayer(selectedPlayer)}
              className="inline-flex items-center h-9 rounded-xl px-3 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium text-xs transition-all shadow-xs cursor-pointer"
            >
              <span>Редактировать</span>
            </button>
            <button
              onClick={() => resetPlayerPin(selectedPlayer.id)}
              className="inline-flex items-center h-9 rounded-xl px-3 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium text-xs transition-all shadow-xs cursor-pointer"
            >
              <span>Сбросить PIN</span>
            </button>
            <button
              onClick={() => resetPlayerTickets(selectedPlayer.id)}
              className="inline-flex items-center h-9 rounded-xl px-3 border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 font-medium text-xs transition-all shadow-xs cursor-pointer"
            >
              <span>Обнулить билеты</span>
            </button>
          </div>
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Bonus Balance */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Бонусный баланс</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600 tracking-tight flex items-baseline gap-1">
                <span>{Math.round(selectedPlayer.bonus_balance || 0)}</span>
                <span className="text-base font-normal text-emerald-600/80">₽</span>
              </div>
              <p className="text-xs text-slate-400">
                Доступно для вывода и открытия кейсов
              </p>
            </div>
          </div>

          {/* Active Tickets */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Активные билеты</span>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                {getMonthDisplayName(selectedMonth)}
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-baseline gap-1">
                <span>{selectedPlayer.tickets_count || 0}</span>
                <span className="text-base font-normal text-slate-400">шт</span>
              </div>
              <div className="space-y-1 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Всего получено:</span>
                  <span className="font-semibold text-slate-900">{selectedPlayer.total_tickets_received || 0} шт</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>{selectedMonth === "all" ? "Получено за период:" : `Получено (${getShortMonthName(selectedMonth)}):`}</span>
                  <span className="font-semibold text-slate-900">{selectedPlayer.monthly_tickets_received ?? 0} шт</span>
                </div>
              </div>
            </div>
          </div>

          {/* Money Topups & Withdraws */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Финансовый оборот</span>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                {getMonthDisplayName(selectedMonth)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-[11px] text-slate-500 mb-0.5">
                    {selectedMonth === "all" ? "Пополнил (всего)" : `Пополнил (${getShortMonthName(selectedMonth)})`}
                  </p>
                  <p className="text-slate-900 font-bold text-sm">+{Math.round(selectedPlayer.monthly_topups || 0)} ₽</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-[11px] text-slate-500 mb-0.5">
                    {selectedMonth === "all" ? "Списал (всего)" : `Списал (${getShortMonthName(selectedMonth)})`}
                  </p>
                  <p className="text-slate-900 font-bold text-sm">-{Math.round(selectedPlayer.monthly_withdrawn || 0)} ₽</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                <span>Лимит вывода:</span>
                {selectedPlayer.withdraw_limit_enabled ? (
                  <span className="font-semibold text-slate-900">
                    {Math.round(selectedPlayer.remaining_withdraw_limit)} из {Math.round(selectedPlayer.allowed_withdraw_limit)} ₽
                  </span>
                ) : (
                  <span className="text-slate-400">Без лимита</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Large Layout Activity logs table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 sm:p-6 space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between border-b border-slate-100 pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Логи и история активности
                </h3>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  {getMonthDisplayName(selectedMonth)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                История игр, транзакций, билетов, предметов и программы лояльности
              </p>
            </div>

            <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1 max-w-full">
              <button
                onClick={() => setActiveLogTab("games_tickets")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  activeLogTab === "games_tickets"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Игры за билеты
              </button>
              <button
                onClick={() => setActiveLogTab("cases")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  activeLogTab === "cases"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Кейсы
              </button>
              <button
                onClick={() => setActiveLogTab("transactions")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  activeLogTab === "transactions"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Транзакции
              </button>
              <button
                onClick={() => setActiveLogTab("tickets")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  activeLogTab === "tickets"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                История билетов
              </button>
              <button
                onClick={() => setActiveLogTab("inventory")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  activeLogTab === "inventory"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Инвентарь ({playerLogs.inventory.length})
              </button>
              <button
                onClick={() => setActiveLogTab("quests")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                  activeLogTab === "quests"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Лояльность
              </button>
            </div>
          </div>

          {activeLogTab === "inventory" || activeLogTab === "quests" ? (
            isLoadingLogs ? (
              <div className="py-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : activeLogTab === "inventory" ? (
              <div className="overflow-x-auto">
                {playerLogs.inventory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm font-medium">
                    Инвентарь игрока пуст
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/60 text-xs font-semibold text-slate-500">
                        <th className="px-4 py-3">Предмет</th>
                        <th className="px-4 py-3">Тип</th>
                        <th className="px-4 py-3">Статус</th>
                        <th className="px-4 py-3">Дата получения</th>
                        <th className="px-4 py-3 text-right">Действие</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {playerLogs.inventory.map((item) => {
                        const isRare = item.is_rare;
                        const canRefund = item.status === "pending" || item.status === "activated";
                        
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <span className={cn(
                                  "font-semibold",
                                  isRare ? "text-amber-700" : "text-slate-900"
                                )}>
                                  {item.name}
                                </span>
                                {item.description && (
                                  <p className="text-[11px] text-slate-400 font-normal">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium text-slate-700">
                                {item.reward_type === "club_service" ? "Услуга" : "Товар"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {item.status === "pending" && (
                                <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md text-[11px] font-medium">
                                  В инвентаре
                                </span>
                              )}
                              {item.status === "activated" && (
                                <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-[11px] font-medium">
                                  В очереди
                                </span>
                              )}
                              {item.status === "claimed" && (
                                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[11px] font-medium">
                                  Выдан
                                </span>
                              )}
                              {item.status === "refunded" && (
                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-md text-[11px] font-medium line-through">
                                  Возврат
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                              {new Date(item.created_at).toLocaleString("ru-RU")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {canRefund ? (
                                <button
                                  onClick={() => handleRefundInventoryItem(item.id)}
                                  className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-medium transition-all shadow-xs cursor-pointer active:scale-98"
                                >
                                  Вернуть средства
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    Программа лояльности
                  </h4>
                  {playerLogs.loyalty ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                        <p className="text-[11px] font-medium text-slate-500">Куплено пакетов</p>
                        <p className="text-slate-900 text-xl font-bold mt-1">
                          {playerLogs.loyalty.accumulated_packages || 0} шт
                        </p>
                        {playerLogs.loyalty.last_purchase_date && (
                          <p className="text-[11px] text-slate-400 font-mono mt-1">
                            Последний: {new Date(playerLogs.loyalty.last_purchase_date).toLocaleDateString("ru-RU")}
                          </p>
                        )}
                      </div>
                      
                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                        <p className="text-[11px] font-medium text-slate-500">Посещения клуба</p>
                        <p className="text-slate-900 text-xl font-bold mt-1">
                          {playerLogs.loyalty.accumulated_visits || 0} раз
                        </p>
                        {playerLogs.loyalty.last_visit_date && (
                          <p className="text-[11px] text-slate-400 font-mono mt-1">
                            Последнее: {new Date(playerLogs.loyalty.last_visit_date).toLocaleDateString("ru-RU")}
                          </p>
                        )}
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                        <p className="text-[11px] font-medium text-slate-500">Серия посещений</p>
                        <p className="text-amber-600 text-xl font-bold mt-1">
                          {playerLogs.loyalty.current_streak || 0} дн.
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium mt-1">
                          Активная серия
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium py-2">
                      Данные о лояльности отсутствуют
                    </p>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="relative">
              {isLogsLoading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              )}
              
              {activeLogTab === "games_tickets" && renderGameLogsTable(paginatedLogs, "Записи об играх за билеты отсутствуют")}
              {activeLogTab === "transactions" && renderGameLogsTable(paginatedLogs, "Записи о транзакциях отсутствуют")}
              
              {activeLogTab === "cases" && (
                <div className="overflow-x-auto">
                  {paginatedLogs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm font-medium">
                      Записи о кейсах отсутствуют
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-50/60 text-xs font-semibold text-slate-500">
                          <th className="px-4 py-3">Кейс</th>
                          <th className="px-4 py-3">Выпавший приз</th>
                          <th className="px-4 py-3">Тип</th>
                          <th className="px-4 py-3">Дата и время</th>
                          <th className="px-4 py-3 text-right">Изменение баланса</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                        {paginatedLogs.map((log) => {
                          const details = getLogDetails(log);
                          const isRefund = log.game_type === "CASE_REFUND";
                          const caseName = log.result_data?.case_name || "Кейс";
                          const wonItem = log.result_data?.won_item_name || log.result_data?.item_name || "-";
                          
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                {caseName}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-slate-900 font-medium">
                                  {wonItem}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-medium text-slate-700">
                                  {isRefund ? "Возврат" : "Открытие"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                                {new Date(log.created_at).toLocaleString("ru-RU")}
                              </td>
                              <td className={cn("px-4 py-3 text-right font-semibold", details.sumColor)}>
                                {details.sumText || "0 ₽"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeLogTab === "tickets" && (
                <div className="overflow-x-auto">
                  {paginatedLogs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm font-medium">
                      Записи о выдаче билетов отсутствуют
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-50/60 text-xs font-semibold text-slate-500">
                          <th className="px-4 py-3">Активность</th>
                          <th className="px-4 py-3">Источник</th>
                          <th className="px-4 py-3">Администратор</th>
                          <th className="px-4 py-3">Дата и время</th>
                          <th className="px-4 py-3 text-right">Билеты</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                        {paginatedLogs.map((log) => {
                          let resData = log.history_result_data;
                          if (typeof resData === "string") {
                            try {
                              resData = JSON.parse(resData);
                            } catch {
                              resData = null;
                            }
                          }
                          const serviceName = resData?.rule_name || resData?.service_name || resData?.tariff_name || resData?.title || resData?.name;
                          const isService = log.source === "service_award";

                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <div>
                                  <span className="font-semibold text-slate-900">
                                    {isService && serviceName ? serviceName : "Выдача билета"}
                                  </span>
                                  <p className="text-[11px] text-slate-400 font-normal">
                                    {getTicketReason(log)}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-medium text-slate-700">
                                  {isService && serviceName ? `Услуга: ${serviceName}` : getTicketSourceRussian(log.source)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {log.admin_name ? (
                                  <span className="font-medium text-slate-900">{log.admin_name}</span>
                                ) : (
                                  <span className="text-slate-400 font-normal">
                                    {log.source === "admin_manual" || log.source === "admin_edit" ? "Администратор" : "Система"}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                                {new Date(log.created_at).toLocaleString("ru-RU")}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900 font-bold">
                                +{log.batch_count || 1} шт
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              
              {renderLogPagination()}
            </div>
          )}
        </div>
        {renderEditModal()}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────
  // ORIGINAL PLAYERS LIST RENDER WITH PAGINATION
  // ────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Quick Issue Form */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Быстрое начисление
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Ручная выдача билетов гостю по номеру телефона
            </p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setIssueForm({ ...issueForm, mode: "amount" })}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                issueForm.mode === "amount"
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              По сумме
            </button>
            <button
              onClick={() => setIssueForm({ ...issueForm, mode: "count" })}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                issueForm.mode === "count"
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              По количеству
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
              Номер телефона
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="79000000000"
                value={issueForm.phone}
                onChange={(e) =>
                  setIssueForm({ ...issueForm, phone: e.target.value })
                }
                className="w-full bg-white border border-slate-200 rounded-xl h-10 pl-10 pr-3.5 text-sm font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none"
              />
            </div>
          </div>

          {issueForm.mode === "amount" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Сумма пополнения (₽)
              </label>
              <div className="relative">
                <BarChart3 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                  className="w-full bg-white border border-slate-200 rounded-xl h-10 pl-10 pr-3.5 text-sm font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Кол-во билетов
              </label>
              <div className="relative">
                <Ticket className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                  className="w-full bg-white border border-slate-200 rounded-xl h-10 pl-10 pr-3.5 text-sm font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none"
                />
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <button
              onClick={handleIssueTickets}
              disabled={isIssuing || !issueForm.phone}
              className="w-full h-10 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 font-medium text-xs sm:text-sm transition-all shadow-xs cursor-pointer active:scale-98"
            >
              {isIssuing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Начислить билеты</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Players List Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              База игроков
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Всего игроков: <span className="text-slate-900 font-semibold">{totalPlayers}</span>
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по телефону или имени..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl h-10 pl-10 pr-9 text-xs font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all shadow-xs"
            />
            {isLoadingPlayers && (
              <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden relative">
          {isLoadingPlayers && localPlayers.length === 0 && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10 py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/70">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500">
                    Игрок
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500">
                    Билеты 🎟️
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500">
                    Баланс 🪙
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500">
                    Лимит вывода
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500">
                    Пополнил (₽)
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500">
                    Списал (₽)
                  </th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 text-right">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm font-medium text-slate-400">
                      Игроки не найдены
                    </td>
                  </tr>
                ) : (
                  localPlayers.map((player) => (
                    <tr 
                      key={player.id} 
                      onClick={() => selectPlayer(player)}
                      className="hover:bg-slate-50/60 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-sm text-slate-900 group-hover:text-slate-950 transition-colors">
                          {player.full_name || "Не указано"}
                        </div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5">
                          {player.phone_number}
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <span>🎟️</span>
                          <span>{player.tickets_count || 0}</span>
                          <span className="text-xs font-normal text-slate-500">шт</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-emerald-600 text-sm flex items-center gap-1">
                          {Math.round(player.bonus_balance || 0)} <span className="text-xs font-normal text-emerald-600/80">₽</span>
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        {player.withdraw_limit_enabled ? (
                          <div className={cn(
                            "font-bold text-sm",
                            player.remaining_withdraw_limit > 0 ? "text-slate-900" : "text-slate-400"
                          )}>
                            {Math.round(player.remaining_withdraw_limit)} <span className="text-xs font-normal">₽</span>
                            <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                              из {Math.round(player.allowed_withdraw_limit)} ₽
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">
                            Без лимита
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 text-sm">
                          {Math.round(player.monthly_topups || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 text-sm">
                          {Math.round(player.monthly_withdrawn || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => selectPlayer(player)}
                            title="Посмотреть профиль и логи"
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingPlayer(player)}
                            title="Редактировать"
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => resetPlayerPin(player.id)}
                            title="Сбросить PIN"
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => resetPlayerTickets(player.id)}
                            title="Обнулить билеты"
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
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
    </div>
  );
}
