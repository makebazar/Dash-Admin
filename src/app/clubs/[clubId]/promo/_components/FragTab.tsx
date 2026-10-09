"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2,
  Zap,
  Shield,
  Save,
  Users,
  Trophy,
  Coins,
  History,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Loader2,
  Phone,
  User,
  Calendar,
  Sword,
  Plus,
  X,
  Clock,
  Award,
  AlertCircle,
  Edit2,
  Trash2,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FragTabProps {
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
  clubId: string;
}

interface Prize {
  place: number;
  reward: number;
  text_prize: string;
  description: string;
}

export function FragTab({ settings, saveSettings, clubId }: FragTabProps) {
  if (!settings) return null;

  const defaultTariffs = {
    cs2_kill: 0.60,
    cs2_hs: 0.40,
    cs2_knife: 4.40,
    cs2_zeus: 2.40,
    cs2_assist: 0.20,
    cs2_mvp: 1.00,
    cs2_win: 10.00,
    cs2_double_kill: 1.00,
    cs2_triple_kill: 2.00,
    cs2_quad_kill: 5.00,
    cs2_ace: 10.00,
    cs2_bomb_plant: 1.00,
    cs2_bomb_defuse: 2.00,
    cs2_clutch_kill: 0.50,
    cs2_flash_kill: 0.50,

    dota_kill: 0.80,
    dota_assist: 0.40,
    dota_lasthit_10: 0.10,
    dota_denies_5: 0.10,
    dota_networth_1000: 0.10,
    dota_win: 10.00,
    dota_streak_3: 1.50,
    dota_streak_5: 3.00,
    dota_streak_10: 10.00,
    dota_wards_5: 1.00,
    dota_ward_destroy: 0.50,

    pubg_kill: 2.00,
    pubg_win: 15.00,
    pubg_top10: 6.00,

    max_bonus_per_match: 100.00,
  };

  // Initialize state from settings or default values
  const fragConfig = settings.frag || {
    is_active: false,
    tariffs: defaultTariffs,
  };

  const [isActive, setIsActive] = useState<boolean>(fragConfig.is_active);
  const [tariffs, setTariffs] = useState<any>({ ...defaultTariffs, ...fragConfig.tariffs });
  const [clubIp, setClubIp] = useState<string>(settings.club_ip || fragConfig.club_ip || "");
  const [isDetectingIp, setIsDetectingIp] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleDetectIp = async () => {
    setIsDetectingIp(true);
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      if (data.ip) {
        setClubIp(data.ip);
      }
    } catch {
      alert("Не удалось автоматически определить IP. Пожалуйста, укажите вручную.");
    } finally {
      setIsDetectingIp(false);
    }
  };

  const searchParams = useSearchParams();

  // Sub-tab selection: "settings" | "stats" | "tournaments"
  const [subTab, setSubTab] = useState<"settings" | "stats" | "tournaments">("stats");

  // Sync subTab with URL parameter "?tab=..."
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "tournaments") {
      setSubTab("tournaments");
    } else if (tabParam === "settings") {
      setSubTab("settings");
    } else if (tabParam === "stats" || tabParam === "players") {
      setSubTab("stats");
    }
  }, [searchParams]);

  const handleSubTabChange = (tab: "settings" | "stats" | "tournaments") => {
    setSubTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  };
  
  // Stats states
  const [statsData, setStatsData] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
  const [statsGameFilter, setStatsGameFilter] = useState<"ALL" | "CS2" | "Dota2" | "PUBG">("ALL");
  const [statsSearchQuery, setStatsSearchQuery] = useState<string>("");
  const [statsSortBy, setStatsSortBy] = useState<"kd" | "earned">("kd");

  // Tournaments states
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState<boolean>(false);
  
  // Leaderboard modal states
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [tournamentLeaderboard, setTournamentLeaderboard] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState<boolean>(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState<boolean>(false);
  
  // Creation modal states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState("");
  const [newGame, setNewGame] = useState<"CS2" | "Dota2" | "ALL">("CS2");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newMinMatches, setNewMinMatches] = useState(5);
  const [newDescription, setNewDescription] = useState("");
  const [newPrizes, setNewPrizes] = useState<Prize[]>([
    { place: 1, reward: 5000, text_prize: "", description: "" },
    { place: 2, reward: 3000, text_prize: "", description: "" },
    { place: 3, reward: 1000, text_prize: "", description: "" },
  ]);
  const [isCreatingTournament, setIsCreatingTournament] = useState<boolean>(false);

  // Editing modal states
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingTournamentId, setEditingTournamentId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editGame, setEditGame] = useState<"CS2" | "Dota2" | "ALL">("CS2");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editMinMatches, setEditMinMatches] = useState(5);
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "completed">("active");
  const [editPrizes, setEditPrizes] = useState<Prize[]>([]);
  const [isUpdatingTournament, setIsUpdatingTournament] = useState<boolean>(false);
  const [isDeletingTournament, setIsDeletingTournament] = useState<boolean>(false);

  const [completingTournamentId, setCompletingTournamentId] = useState<number | null>(null);

  const initialMonth = searchParams.get("month") || "";
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  const formatMonthLabel = (mKey: string) => {
    if (!mKey || mKey === "all") return "За все время";
    const parts = mKey.split("-");
    if (parts.length !== 2) return mKey;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const date = new Date(Date.UTC(year, month - 1, 1));
    const monthName = date.toLocaleString("ru-RU", { month: "long", timeZone: "UTC" });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  };

  const fetchStats = async (overrideMonth?: string) => {
    setStatsLoading(true);
    try {
      const monthToFetch = overrideMonth !== undefined ? overrideMonth : selectedMonth;
      const url = `/api/promo/admin/frag?clubId=${clubId}${monthToFetch ? `&month=${monthToFetch}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStatsData(data);
        if (data.availableMonths) {
          setAvailableMonths(data.availableMonths);
        }
        if (data.selectedMonth) {
          setSelectedMonth(data.selectedMonth);
        }
      }
    } catch (e) {
      console.error("Error fetching Frag stats:", e);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchTournaments = async () => {
    setTournamentsLoading(true);
    try {
      const res = await fetch(`/api/promo/admin/frag/tournaments?clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        setTournaments(data.tournaments || []);
      }
    } catch (e) {
      console.error("Error fetching tournaments:", e);
    } finally {
      setTournamentsLoading(false);
    }
  };

  const fetchLeaderboard = async (tId: number) => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch(`/api/promo/admin/frag/tournaments/${tId}/leaderboard?clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        setTournamentLeaderboard(data.leaderboard || []);
        setSelectedTournament(data.tournament);
      }
    } catch (e) {
      console.error("Error fetching leaderboard:", e);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === "stats" && clubId) {
      const monthFromUrl = searchParams.get("month") || "";
      fetchStats(monthFromUrl || undefined);
    } else if (subTab === "tournaments" && clubId) {
      fetchTournaments();
    }
  }, [subTab, clubId]);

  const handleToggleActive = () => {
    setIsActive(!isActive);
  };

  const handleTariffChange = (key: string, val: string) => {
    const numericVal = parseFloat(val) || 0;
    setTariffs((prev: any) => ({
      ...prev,
      [key]: numericVal,
    }));
  };

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("saving");
    try {
      const updatedSettings = {
        ...settings,
        club_ip: clubIp,
        frag: {
          is_active: isActive,
          tariffs: tariffs,
          club_ip: clubIp,
        },
      };
      await saveSettings(updatedSettings);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 4000);
    } catch (e) {
      console.error(e);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateTimeLocal = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newStartDate || !newEndDate) return;
    setIsCreatingTournament(true);
    try {
      const res = await fetch(`/api/promo/admin/frag/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId,
          title: newTitle,
          game: newGame,
          start_date: newStartDate,
          end_date: newEndDate,
          min_matches: newMinMatches,
          prizes: newPrizes,
          description: newDescription,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchTournaments();
        // Reset form
        setNewTitle("");
        setNewGame("CS2");
        setNewStartDate("");
        setNewEndDate("");
        setNewMinMatches(5);
        setNewDescription("");
        setNewPrizes([
          { place: 1, reward: 5000, text_prize: "", description: "" },
          { place: 2, reward: 3000, text_prize: "", description: "" },
          { place: 3, reward: 1000, text_prize: "", description: "" },
        ]);
      }
    } catch (e) {
      console.error("Error creating tournament:", e);
    } finally {
      setIsCreatingTournament(false);
    }
  };

  const handleOpenEditModal = (t: any) => {
    setEditingTournamentId(t.id);
    setEditTitle(t.title);
    setEditGame(t.game);
    setEditStartDate(formatDateTimeLocal(t.start_date));
    setEditEndDate(formatDateTimeLocal(t.end_date));
    setEditMinMatches(t.min_matches);
    setEditDescription(t.description || "");
    setEditStatus(t.status || "active");
    
    const rawPrizes = typeof t.prizes === "string" ? JSON.parse(t.prizes) : (t.prizes || []);
    const normalizedPrizes: Prize[] = rawPrizes.map((p: any) => ({
      place: parseInt(p.place) || 1,
      reward: parseFloat(p.reward) || 0,
      text_prize: p.text_prize || "",
      description: p.description || "",
    }));
    setEditPrizes(normalizedPrizes);
    setShowEditModal(true);
  };

  const handleUpdateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTournamentId || !editTitle || !editStartDate || !editEndDate) return;
    setIsUpdatingTournament(true);
    try {
      const res = await fetch(`/api/promo/admin/frag/tournaments/${editingTournamentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId,
          title: editTitle,
          game: editGame,
          start_date: editStartDate,
          end_date: editEndDate,
          min_matches: editMinMatches,
          prizes: editPrizes,
          description: editDescription,
          status: editStatus,
        }),
      });

      if (res.ok) {
        setShowEditModal(false);
        fetchTournaments();
      }
    } catch (e) {
      console.error("Error updating tournament:", e);
    } finally {
      setIsUpdatingTournament(false);
    }
  };

  const handleDeleteTournament = async () => {
    if (!editingTournamentId) return;
    if (!confirm("Вы действительно хотите полностью удалить этот турнирный сезон? Это действие невозможно отменить!")) return;
    
    setIsDeletingTournament(true);
    try {
      const res = await fetch(`/api/promo/admin/frag/tournaments/${editingTournamentId}?clubId=${clubId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setShowEditModal(false);
        fetchTournaments();
      }
    } catch (e) {
      console.error("Error deleting tournament:", e);
    } finally {
      setIsDeletingTournament(false);
    }
  };

  const handleCompleteTournament = async (tId: number) => {
    if (!confirm("Вы уверены, что хотите завершить этот турнирный сезон и выдать призы победителям?")) return;
    setCompletingTournamentId(tId);
    try {
      const res = await fetch(`/api/promo/admin/frag/tournaments/${tId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId }),
      });

      if (res.ok) {
        fetchTournaments();
        if (selectedTournament && selectedTournament.id === tId) {
          fetchLeaderboard(tId);
        }
      } else {
        const errData = await res.json();
        alert(`Ошибка при завершении турнира: ${errData.error || "Неизвестная ошибка"}`);
      }
    } catch (e) {
      console.error("Error completing tournament:", e);
    } finally {
      setCompletingTournamentId(null);
    }
  };

  const toggleMatchExpand = (matchId: number) => {
    setExpandedMatchId(expandedMatchId === matchId ? null : matchId);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <motion.div
      key="frag"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Sub Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
        <button
          onClick={() => handleSubTabChange("stats")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all duration-300 font-black uppercase italic text-xs tracking-wider cursor-pointer",
            subTab === "stats"
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-105"
              : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200"
          )}
        >
          Лидерборд и Игроки
        </button>
        <button
          onClick={() => handleSubTabChange("tournaments")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all duration-300 font-black uppercase italic text-xs tracking-wider cursor-pointer",
            subTab === "tournaments"
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-105"
              : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200"
          )}
        >
          Рейтинговые Турниры
        </button>
        <button
          onClick={() => handleSubTabChange("settings")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all duration-300 font-black uppercase italic text-xs tracking-wider cursor-pointer",
            subTab === "settings"
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-105"
              : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200"
          )}
        >
          Настройки тарифов
        </button>
      </div>

      <AnimatePresence mode="wait">
        {subTab === "settings" && (
          <motion.div
            key="settings-pane"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Top Bar: Status + Action */}
            <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleToggleActive}
                  className={cn(
                    "w-12 h-6 rounded-full relative transition-colors duration-300 shrink-0 cursor-pointer",
                    isActive ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                      isActive ? "left-7" : "left-1"
                    )}
                  />
                </button>
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    {isActive ? "Модуль Frag активен" : "Модуль Frag отключен"}
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    Автоматическое начисление бонусов игрокам за игровые успехи на ПК
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {saveStatus === "success" && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                    ✓ Настройки сохранены
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                    ✕ Ошибка сохранения
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {isSaving ? "Сохранение..." : "Сохранить настройки"}
                </button>
              </div>
            </div>

            {/* Club IP & DashFrag Agent Settings Card */}
            <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-3xl shadow-xs space-y-5">
              <div>
                <h4 className="text-lg font-bold text-slate-900">Внешний IP-адрес клуба (DashFrag Agent)</h4>
                <p className="text-xs text-slate-400 font-medium">Для проверки присутствия игрока в сети клуба и безопасности зачисления бонусов</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Публичный IP-адрес провайдера (WAN IP)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={clubIp}
                      onChange={(e) => setClubIp(e.target.value)}
                      placeholder="Например: 185.220.101.45"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleDetectIp}
                      disabled={isDetectingIp}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer shrink-0 shadow-xs"
                    >
                      {isDetectingIp && <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />}
                      Определить мой текущий IP
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Все компьютеры клуба выходят в интернет через один общий внешний IP роутера.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-xs text-slate-600 space-y-2">
                  <div className="font-bold text-slate-900 text-sm">
                    Как узнать IP-адрес вашего клуба:
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                    <li>Откройте любой ПК в клубе или ПК администратора.</li>
                    <li>Перейдите на сайт <a href="https://2ip.ru" target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold underline">2ip.ru</a> или <a href="https://ipify.org" target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold underline">ipify.org</a>.</li>
                    <li>Скопируйте ваш внешне отображаемый IP-адрес (например, <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-mono">185.220.101.45</code>).</li>
                    <li>Вставьте скопированный IP в поле выше и нажмите <strong>«Сохранить настройки»</strong>.</li>
                    <li>Вы также можете просто нажать кнопку <strong>«Определить мой текущий IP»</strong> выше, если открыли админку прямо из клуба.</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Game Tariffs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* CS2 Tariffs */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs space-y-5">
                <div>
                  <h4 className="text-base font-bold text-slate-900 uppercase">Counter-Strike 2</h4>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Вознаграждение за действия в CS2</p>
                </div>

                <div className="space-y-4 divide-y divide-slate-100">
                  {[
                    { key: "cs2_kill", label: "Фраг (Убийство)", suffix: "₽" },
                    { key: "cs2_hs", label: "Бонус за Headshot", suffix: "₽" },
                    { key: "cs2_knife", label: "Бонус за нож (Knife)", suffix: "₽" },
                    { key: "cs2_zeus", label: "Бонус за Zeus", suffix: "₽" },
                    { key: "cs2_assist", label: "Ассист (Помощь)", suffix: "₽" },
                    { key: "cs2_mvp", label: "Звезда MVP раунда", suffix: "₽" },
                    { key: "cs2_double_kill", label: "Double Kill (2K)", suffix: "₽" },
                    { key: "cs2_triple_kill", label: "Triple Kill (3K)", suffix: "₽" },
                    { key: "cs2_quad_kill", label: "Quad Kill (4K)", suffix: "₽" },
                    { key: "cs2_ace", label: "Ace! (Эйс 5K)", suffix: "₽" },
                    { key: "cs2_bomb_plant", label: "Завод бомбы", suffix: "₽" },
                    { key: "cs2_bomb_defuse", label: "Разминирование бомбы", suffix: "₽" },
                    { key: "cs2_clutch_kill", label: "Клатч-фраг (<20 HP)", suffix: "₽" },
                    { key: "cs2_flash_kill", label: "Фраг по ослеплённому", suffix: "₽" },
                    { key: "cs2_win", label: "Победа в матче", suffix: "₽" },
                  ].map((item) => (
                    <div key={item.key} className="pt-3 first:pt-0 flex items-center justify-between gap-4">
                      <label className="text-xs font-medium text-slate-700">
                        {item.label}
                      </label>
                      <div className="relative w-28 shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tariffs[item.key] ?? 0}
                          onChange={(e) => handleTariffChange(item.key, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-slate-400 focus:bg-white text-right pr-6"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs pointer-events-none">
                          {item.suffix}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dota 2 Tariffs */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs space-y-5">
                <div>
                  <h4 className="text-base font-bold text-slate-900 uppercase">Dota 2</h4>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Вознаграждение за действия в Dota 2</p>
                </div>

                <div className="space-y-4 divide-y divide-slate-100">
                  {[
                    { key: "dota_kill", label: "Убийство героя", suffix: "₽" },
                    { key: "dota_assist", label: "Ассист в замесе", suffix: "₽" },
                    { key: "dota_lasthit_10", label: "Каждые 10 Last Hits", suffix: "₽" },
                    { key: "dota_denies_5", label: "Каждые 5 Denies", suffix: "₽" },
                    { key: "dota_networth_1000", label: "Каждые 1000 Gold Networth", suffix: "₽" },
                    { key: "dota_streak_3", label: "Killing Spree (3 стрик)", suffix: "₽" },
                    { key: "dota_streak_5", label: "Mega Kill (5 стрик)", suffix: "₽" },
                    { key: "dota_streak_10", label: "Beyond Godlike (10+ стрик)", suffix: "₽" },
                    { key: "dota_wards_5", label: "Каждые 5 поставленных вардов", suffix: "₽" },
                    { key: "dota_ward_destroy", label: "Снос вражеского варда", suffix: "₽" },
                    { key: "dota_win", label: "Победа в матче", suffix: "₽" },
                  ].map((item) => (
                    <div key={item.key} className="pt-3 first:pt-0 flex items-center justify-between gap-4">
                      <label className="text-xs font-medium text-slate-700">
                        {item.label}
                      </label>
                      <div className="relative w-28 shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tariffs[item.key] ?? 0}
                          onChange={(e) => handleTariffChange(item.key, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-slate-400 focus:bg-white text-right pr-6"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs pointer-events-none">
                          {item.suffix}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PUBG & Security Tariffs */}
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs space-y-5">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 uppercase">PUBG</h4>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Вознаграждение за действия в PUBG</p>
                  </div>

                  <div className="space-y-4 divide-y divide-slate-100">
                    {[
                      { key: "pubg_kill", label: "Убийство (Kill)", suffix: "₽" },
                      { key: "pubg_win", label: "Победа (Top 1 Win)", suffix: "₽" },
                      { key: "pubg_top10", label: "Попадание в Топ-10", suffix: "₽" },
                    ].map((item) => (
                      <div key={item.key} className="pt-3 first:pt-0 flex items-center justify-between gap-4">
                        <label className="text-xs font-medium text-slate-700">
                          {item.label}
                        </label>
                        <div className="relative w-28 shrink-0">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={tariffs[item.key] ?? 0}
                            onChange={(e) => handleTariffChange(item.key, e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-slate-400 focus:bg-white text-right pr-6"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs pointer-events-none">
                            {item.suffix}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security Limits Card */}
                <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 border border-amber-500/20 p-6 rounded-3xl space-y-5">
                  <div>
                    <h4 className="text-base font-bold text-amber-900 uppercase flex items-center gap-2">
                      🛡️ Лимиты и Безопасность
                    </h4>
                    <p className="text-xs text-amber-700 font-medium mt-0.5">Защита от фарма и гиперинфляции бонусов</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <label className="text-xs font-semibold text-amber-950">
                        Макс. бонус за 1 матч
                      </label>
                      <div className="relative w-28 shrink-0">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={tariffs["max_bonus_per_match"] ?? 100}
                          onChange={(e) => handleTariffChange("max_bonus_per_match", e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-950 outline-none focus:border-amber-500 text-right pr-6"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-amber-500 text-xs pointer-events-none">
                          ₽
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {subTab === "stats" && (
          <motion.div
            key="stats-pane"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Header Control Row (Month Selector) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
              <div>
                <h4 className="text-lg font-bold text-slate-900 uppercase">Рейтинг игроков и лидерборд</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Результаты и статистика сформированы за выбранный отчетный месяц
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Период:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    const newMonth = e.target.value;
                    setSelectedMonth(newMonth);
                    fetchStats(newMonth);
                    const params = new URLSearchParams(window.location.search);
                    params.set("month", newMonth);
                    window.history.replaceState(null, "", `?${params.toString()}`);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all cursor-pointer shadow-xs"
                >
                  <option value="all">За все время</option>
                  {availableMonths.map((mKey) => (
                    <option key={mKey} value={mKey}>
                      {formatMonthLabel(mKey)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {statsLoading ? (
              <div className="flex h-64 items-center justify-center bg-white border border-slate-200 rounded-3xl">
                <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
              </div>
            ) : !statsData ? (
              <div className="text-center py-12 text-slate-400 font-bold bg-white border border-slate-200 rounded-3xl">
                Не удалось загрузить данные
              </div>
            ) : (
              <>
                {/* MVP Hero Card */}
                {(() => {
                  const MIN_QUALIFIED_MATCHES = 20;

                  const filteredByGame = (statsData.playerStats || []).filter((p: any) => {
                    if (statsGameFilter !== "ALL" && p.game !== statsGameFilter) return false;
                    return true;
                  });

                  const playersWithKd = filteredByGame.map((p: any) => {
                    const deaths = parseInt(p.total_deaths) || 0;
                    const kills = parseInt(p.total_kills) || 0;
                    const kdVal = deaths > 0 ? kills / deaths : (kills > 0 ? kills : 0);
                    const wins = p.achievements?.wins || 0;
                    const winrateVal = p.matches_count > 0 ? Math.round((wins / p.matches_count) * 100) : 0;
                    return { ...p, kdVal, winrateVal };
                  });

                  const qualifiedPlayers = playersWithKd.filter((p: any) => p.matches_count >= MIN_QUALIFIED_MATCHES);
                  const candidatePool = qualifiedPlayers.length > 0 ? qualifiedPlayers : playersWithKd;

                  const mvpCandidate = [...candidatePool].sort((a: any, b: any) => {
                    if (b.kdVal !== a.kdVal) return b.kdVal - a.kdVal;
                    if (b.winrateVal !== a.winrateVal) return b.winrateVal - a.winrateVal;
                    return b.matches_count - a.matches_count;
                  })[0];

                  if (!mvpCandidate) return null;

                  const isQualified = mvpCandidate.matches_count >= MIN_QUALIFIED_MATCHES;

                  return (
                    <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider">
                          {isQualified ? (
                            <><span className="text-amber-400">👑</span> MVP КЛУБА ПО СКИЛЛУ (K/D)</>
                          ) : (
                            <><span className="text-slate-400">⏳</span> В ПРОЦЕССЕ КВАЛИФИКАЦИИ ({mvpCandidate.matches_count}/{MIN_QUALIFIED_MATCHES} КАДОК)</>
                          )}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                            {mvpCandidate.full_name || "Лучший игрок"}
                          </h3>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            {mvpCandidate.phone_number} • Дисциплина {mvpCandidate.game}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-3 rounded-2xl text-center min-w-[90px]">
                          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">K/D Ratio</div>
                          <div className="text-2xl font-bold text-white mt-0.5">{mvpCandidate.kdVal.toFixed(2)}</div>
                        </div>

                        <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-3 rounded-2xl text-center min-w-[90px]">
                          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Винрейт</div>
                          <div className="text-2xl font-bold text-white mt-0.5">{mvpCandidate.winrateVal}%</div>
                        </div>

                        <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-3 rounded-2xl text-center min-w-[90px]">
                          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Каток</div>
                          <div className="text-2xl font-bold text-white mt-0.5">{mvpCandidate.matches_count}</div>
                        </div>

                        <Link
                          href={`/clubs/${clubId}/players/${mvpCandidate.player_id}`}
                          className="bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs uppercase px-5 py-3 rounded-2xl transition-colors no-underline shrink-0"
                        >
                          Карточка MVP →
                        </Link>
                      </div>
                    </div>
                  );
                })()}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
                    <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Начислено бонусов</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {parseFloat(statsData.summary.total_earned || 0).toLocaleString("ru-RU")} ₽
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
                    <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Всего игроков</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {statsData.summary.total_players}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
                    <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Матчей CS2</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {statsData.summary.cs2_matches}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
                    <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Матчей Dota 2</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {statsData.summary.dota_matches}
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Game Filter Tabs */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { id: "ALL", label: "Все дисциплины" },
                        { id: "CS2", label: "CS2" },
                        { id: "Dota2", label: "Dota 2" },
                        { id: "PUBG", label: "PUBG" },
                      ].map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setStatsGameFilter(g.id as any)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer",
                            statsGameFilter === g.id
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>

                    {/* Sorting & Search */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs font-bold">
                        <button
                          onClick={() => setStatsSortBy("kd")}
                          className={cn(
                            "px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                            statsSortBy === "kd" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                          )}
                        >
                          По K/D (Скилл)
                        </button>
                        <button
                          onClick={() => setStatsSortBy("earned")}
                          className={cn(
                            "px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                            statsSortBy === "earned" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                          )}
                        >
                          По Заработку
                        </button>
                      </div>

                      <div className="w-full md:w-64">
                        <input
                          type="text"
                          placeholder="Поиск по имени или телефону..."
                          value={statsSearchQuery}
                          onChange={(e) => setStatsSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Leaderboard Table */}
                  {(() => {
                    const MIN_QUALIFIED_MATCHES = 20;

                    let playersList = (statsData.playerStats || []).map((p: any) => {
                      const deaths = parseInt(p.total_deaths) || 0;
                      const kills = parseInt(p.total_kills) || 0;
                      const kdVal = deaths > 0 ? kills / deaths : (kills > 0 ? kills : 0);
                      const wins = p.achievements?.wins || 0;
                      const winrateVal = p.matches_count > 0 ? Math.round((wins / p.matches_count) * 100) : 0;
                      const isQualified = p.matches_count >= MIN_QUALIFIED_MATCHES;
                      return { ...p, kdVal, winrateVal, isQualified };
                    });

                    // Sort players based on statsSortBy
                    if (statsSortBy === "kd") {
                      playersList.sort((a: any, b: any) => {
                        // Qualified players (>=20 matches) ALWAYS rank above non-qualified
                        if (a.isQualified !== b.isQualified) return a.isQualified ? -1 : 1;
                        if (b.kdVal !== a.kdVal) return b.kdVal - a.kdVal;
                        if (b.winrateVal !== a.winrateVal) return b.winrateVal - a.winrateVal;
                        return b.matches_count - a.matches_count;
                      });
                    } else {
                      playersList.sort((a: any, b: any) => parseFloat(b.total_earned || 0) - parseFloat(a.total_earned || 0));
                    }

                    const filteredPlayers = playersList.filter((p: any) => {
                      if (statsGameFilter !== "ALL" && p.game !== statsGameFilter) return false;
                      if (statsSearchQuery) {
                        const q = statsSearchQuery.toLowerCase();
                        const nameMatch = (p.full_name || "").toLowerCase().includes(q);
                        const phoneMatch = (p.phone_number || "").includes(q);
                        return nameMatch || phoneMatch;
                      }
                      return true;
                    });

                    return filteredPlayers.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        Игроки не найдены
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              <th className="pb-3 pl-2 w-12">#</th>
                              <th className="pb-3">Игрок</th>
                              <th className="pb-3 text-center">Игра</th>
                              <th className="pb-3 text-center">Матчи</th>
                              <th className="pb-3 text-center">K / D / A</th>
                              <th className="pb-3 text-right">Заработано</th>
                              <th className="pb-3 pr-2 text-right">Профиль</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {filteredPlayers.map((p: any, idx: number) => {
                              const kd = p.total_deaths > 0 ? (p.total_kills / p.total_deaths).toFixed(2) : p.total_kills;

                              return (
                                <tr key={`${p.player_id}-${p.game}`} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-4 pl-2 font-bold">
                                    <span className={cn(
                                      "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
                                      p.isQualified && idx === 0 ? "bg-slate-900 text-white" :
                                      p.isQualified && idx === 1 ? "bg-slate-200 text-slate-800" :
                                      p.isQualified && idx === 2 ? "bg-slate-100 text-slate-700" : "text-slate-400"
                                    )}>
                                      #{idx + 1}
                                    </span>
                                  </td>
                                  <td className="py-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Link
                                        href={`/clubs/${clubId}/players/${p.player_id}`}
                                        className="font-bold text-slate-900 hover:text-slate-600 transition-colors"
                                      >
                                        {p.full_name || "Не указано"}
                                      </Link>
                                      {idx === 0 && statsSortBy === "kd" && p.isQualified && (
                                        <span className="bg-amber-100 text-amber-800 font-bold text-[9px] px-2 py-0.5 rounded uppercase">
                                          👑 MVP
                                        </span>
                                      )}
                                      {!p.isQualified && statsSortBy === "kd" && (
                                        <span className="bg-slate-100 text-slate-500 font-medium text-[9px] px-1.5 py-0.5 rounded">
                                          {p.matches_count}/20 каток
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                      {p.phone_number}
                                    </div>
                                  </td>
                                  <td className="py-4 text-center">
                                    <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider">
                                      {p.game}
                                    </span>
                                  </td>
                                  <td className="py-4 text-center font-bold text-slate-900">
                                    {p.matches_count}
                                  </td>
                                  <td className="py-4 text-center">
                                    <div className="font-bold text-slate-900">
                                      {p.total_kills} / {p.total_deaths} / {p.total_assists}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                      K/D: {kd}
                                    </div>
                                  </td>
                                  <td className="py-4 text-right font-bold text-slate-900">
                                    +{parseFloat(p.total_earned).toFixed(2)} ₽
                                  </td>
                                  <td className="py-4 pr-2 text-right">
                                    <Link
                                      href={`/clubs/${clubId}/players/${p.player_id}`}
                                      className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg transition-colors no-underline"
                                    >
                                      Карточка <ChevronRight className="w-3 h-3" />
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </motion.div>
        )}

        {subTab === "tournaments" && (
          <motion.div
            key="tournaments-pane"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Header / Create button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
              <div>
                <h4 className="text-lg font-bold text-slate-900 uppercase">Рейтинговые Турниры</h4>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Создание турнирных сезонов с автоматическим расчетом рейтинга и выдачей наград
                </p>
              </div>
              <Link
                href={`/clubs/${clubId}/dashfrag/tournaments/new`}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 no-underline"
              >
                + Создать Сезон
              </Link>
            </div>

            {/* List of tournaments */}
            {tournamentsLoading ? (
              <div className="flex h-64 items-center justify-center bg-white border border-slate-200 rounded-3xl">
                <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
              </div>
            ) : tournaments.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-bold bg-white border border-slate-200 rounded-3xl uppercase tracking-wider text-xs">
                Турнирные сезоны не созданы
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tournaments.map((t) => {
                  const prizesList = typeof t.prizes === "string" ? JSON.parse(t.prizes) : (t.prizes || []);
                  const isActiveStatus = t.status === "active";
                  const isPastEndDate = new Date() > new Date(t.end_date);
                  
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "bg-white border rounded-3xl p-6 shadow-xs flex flex-col justify-between gap-6 transition-all hover:shadow-md",
                        isActiveStatus ? "border-slate-200" : "border-slate-100 opacity-80"
                      )}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            {t.game === "ALL" ? "CS2 + Dota2" : t.game}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase",
                            isActiveStatus ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}>
                            {isActiveStatus ? "Активен" : "Завершен"}
                          </span>
                        </div>

                        <div>
                          <h5 className="font-bold text-slate-900 text-base leading-tight uppercase">{t.title}</h5>
                          <div className="text-xs text-slate-400 font-medium mt-1">
                            {formatDate(t.start_date)} — {formatDate(t.end_date)}
                          </div>
                          {t.description && (
                            <p className="text-xs text-slate-500 mt-2 font-medium line-clamp-2 leading-relaxed">
                              {t.description}
                            </p>
                          )}
                        </div>

                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-xs font-medium text-slate-600 space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-400 tracking-wider pb-1 border-b border-slate-200/50">
                            <span>Призовой фонд</span>
                            <span>Мин. игр: {t.min_matches}</span>
                          </div>
                          {prizesList.slice(0, 3).map((p: any, idx: number) => {
                            const reward = parseFloat(p.reward) || 0;
                            const textPrize = p.text_prize || "";
                            
                            return (
                              <div key={idx} className="flex justify-between items-start gap-2">
                                <span className="font-bold text-slate-700 shrink-0">
                                  #{p.place} место:
                                </span>
                                <span className="font-bold text-slate-900 text-right">
                                  {reward > 0 && textPrize ? (
                                    <span>{reward} ₽ + {textPrize}</span>
                                  ) : reward > 0 ? (
                                    <span>{reward} ₽</span>
                                  ) : textPrize ? (
                                    <span>{textPrize}</span>
                                  ) : (
                                    <span>—</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                          {prizesList.length > 3 && (
                            <div className="text-[10px] font-bold text-slate-400 pt-0.5 text-center">
                              и еще {prizesList.length - 3} призовых мест
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => {
                            fetchLeaderboard(t.id);
                            setShowLeaderboardModal(true);
                          }}
                          className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Таблица участников
                        </button>
                        
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-700 transition-all cursor-pointer"
                        >
                          Редактировать
                        </button>

                        {isActiveStatus && (
                          <button
                            onClick={() => handleCompleteTournament(t.id)}
                            disabled={completingTournamentId === t.id}
                            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {completingTournamentId === t.id ? "Завершение..." : "Завершить и наградить"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>



      {/* Editing Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl w-full max-w-xl space-y-6 relative max-h-[90vh] overflow-y-auto scrollbar-thin"
          >
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-6 h-6" />
            </button>

            <div>
              <h4 className="text-xl font-black uppercase italic">Редактировать сезон</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Параметры и награды турнира
              </p>
            </div>

            <form onSubmit={handleUpdateTournament} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Название сезона</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Летний кубок CS2 - Июль"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Описание турнира (правила, спонсоры, информация)</label>
                <textarea
                  placeholder="Опишите турнир, спонсоров и особые условия участия..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Дисциплина</label>
                  <select
                    value={editGame}
                    onChange={(e) => setEditGame(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  >
                    <option value="CS2">CS2</option>
                    <option value="Dota2">Dota 2</option>
                    <option value="ALL">Все игры</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Статус сезона</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold"
                  >
                    <option value="active">Активен</option>
                    <option value="completed">Завершен (Архив)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Мин. матчей</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editMinMatches}
                    onChange={(e) => setEditMinMatches(parseInt(e.target.value) || 5)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Дата начала</label>
                  <input
                    type="datetime-local"
                    required
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Дата окончания</label>
                  <input
                    type="datetime-local"
                    required
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Prizes editor */}
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Награды по местам</label>
                <div className="space-y-4 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                  {editPrizes.map((p, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800">{p.place} место</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditPrizes(editPrizes.filter((_, i) => i !== idx).map((x, i) => ({ ...x, place: i + 1 })));
                          }}
                          className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <input
                            type="number"
                            placeholder="Сумма (₽)"
                            value={p.reward || ""}
                            onChange={(e) => {
                              const updated = [...editPrizes];
                              updated[idx].reward = parseFloat(e.target.value) || 0;
                              setEditPrizes(updated);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs outline-none focus:border-indigo-500 transition-all pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₽</span>
                        </div>
                        <input
                          type="text"
                          placeholder="Текстовый приз (Коврик, Мышь...)"
                          value={p.text_prize}
                          onChange={(e) => {
                            const updated = [...editPrizes];
                            updated[idx].text_prize = e.target.value;
                            setEditPrizes(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Детали / описание награды"
                        value={p.description}
                        onChange={(e) => {
                          const updated = [...editPrizes];
                          updated[idx].description = e.target.value;
                          setEditPrizes(updated);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextPlace = editPrizes.length + 1;
                    setEditPrizes([...editPrizes, { place: nextPlace, reward: 1000, text_prize: "", description: "" }]);
                  }}
                  className="text-indigo-500 hover:text-indigo-600 text-[10px] font-black uppercase flex items-center gap-1 ml-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Добавить призовое место
                </button>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleDeleteTournament}
                  disabled={isDeletingTournament}
                  className="flex-1 py-3.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isDeletingTournament ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Удалить Сезон"
                  )}
                </button>

                <button
                  type="submit"
                  disabled={isUpdatingTournament}
                  className="flex-1 py-3.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold uppercase text-xs tracking-wider disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isUpdatingTournament ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    "Сохранить"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboardModal && selectedTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl w-full max-w-4xl space-y-6 relative max-h-[90vh] overflow-y-auto scrollbar-thin"
          >
            <button
              onClick={() => {
                setShowLeaderboardModal(false);
                setSelectedTournament(null);
                setTournamentLeaderboard([]);
              }}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-6 h-6" />
            </button>

            <div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider",
                  selectedTournament.game === "CS2" ? "bg-orange-50 text-orange-600" : selectedTournament.game === "Dota2" ? "bg-red-50 text-red-600" : "bg-purple-50 text-purple-600"
                )}>
                  {selectedTournament.game === "ALL" ? "CS2 + Dota2" : selectedTournament.game}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase",
                  selectedTournament.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                )}>
                  {selectedTournament.status === "active" ? "Активен" : "Завершен"}
                </span>
              </div>
              <h4 className="text-xl font-black uppercase italic mt-2">{selectedTournament.title}</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Турнирная таблица рейтинга (по формуле TP)
              </p>
            </div>

            {leaderboardLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : tournamentLeaderboard.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs bg-slate-50 rounded-2xl border border-slate-100">
                Участники еще не сыграли квалификационных матчей
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-100 rounded-3xl">
                  <table className="w-full text-left border-collapse bg-white">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50">
                        <th className="py-4 pl-6 text-center w-12">Место</th>
                        <th className="py-4 pl-2">Игрок</th>
                        <th className="py-4 text-center">Игр всего</th>
                        <th className="py-4 text-center">Победы / Поражения</th>
                        <th className="py-4 text-center">Суммарный KDA</th>
                        <th className="py-4 text-center">Квалификация</th>
                        <th className="py-4 text-center">Очки (TP)</th>
                        <th className="py-4 pr-6 text-right">Награда</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600">
                      {tournamentLeaderboard.map((p) => {
                        const prizesList = typeof selectedTournament.prizes === "string" ? JSON.parse(selectedTournament.prizes) : (selectedTournament.prizes || []);
                        const playerPrize = p.qualified ? prizesList.find((pz: any) => parseInt(pz.place) === p.rank) : null;
                        
                        return (
                          <tr
                            key={p.player_id}
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors",
                              !p.qualified && "opacity-50 bg-slate-50/20"
                            )}
                          >
                            <td className="py-4 pl-6 text-center">
                              {p.rank === 1 ? (
                                <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-black mx-auto shadow-sm shadow-amber-500/10">1</span>
                              ) : p.rank === 2 ? (
                                <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-black mx-auto shadow-sm shadow-slate-500/10">2</span>
                              ) : p.rank === 3 ? (
                                <span className="w-7 h-7 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center font-black mx-auto shadow-sm shadow-amber-700/10">3</span>
                              ) : (
                                <span className="font-bold text-slate-400">{p.rank}</span>
                              )}
                            </td>
                            <td className="py-4 pl-2">
                              <div className="font-bold text-slate-900">{p.full_name || "Не указано"}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-300" /> {p.phone_number}
                              </div>
                            </td>
                            <td className="py-4 text-center font-bold text-slate-800">
                              {p.matches_count}
                            </td>
                            <td className="py-4 text-center font-bold text-slate-500">
                              <span className="text-emerald-600">{p.wins} W</span> / <span className="text-red-500">{p.losses} L</span>
                            </td>
                            <td className="py-4 text-center font-bold text-slate-500">
                              {p.total_kills} / {p.total_deaths} / {p.total_assists}
                            </td>
                            <td className="py-4 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase",
                                p.qualified ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                              )}>
                                {p.qualified ? "Да" : `Не пройден (игры: ${p.matches_count}/${selectedTournament.min_matches})`}
                              </span>
                            </td>
                            <td className="py-4 text-center">
                              <span className="font-black text-indigo-600 text-sm">{p.points} PTS</span>
                            </td>
                            <td className="py-4 pr-6 text-right font-black text-emerald-600">
                              {playerPrize ? (
                                <div>
                                  {parseFloat(playerPrize.reward) > 0 && (
                                    <div>+{playerPrize.reward} ₽</div>
                                  )}
                                  {playerPrize.text_prize && (
                                    <div className="text-[10px] text-slate-500">{playerPrize.text_prize}</div>
                                  )}
                                </div>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* If active & expired, display End button at bottom of modal too */}
                {selectedTournament.status === "active" && new Date() > new Date(selectedTournament.end_date) && (
                  <div className="flex justify-end pt-4 border-t border-slate-100">
                    <button
                      onClick={() => handleCompleteTournament(selectedTournament.id)}
                      disabled={completingTournamentId === selectedTournament.id}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-black uppercase italic tracking-wider shadow-lg shadow-emerald-600/10 disabled:opacity-50 transition-all"
                    >
                      {completingTournamentId === selectedTournament.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Award className="w-4 h-4" />
                      )}
                      Завершить сезон и выдать призы
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
