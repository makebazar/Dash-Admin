"use client";

import React, { useState, useEffect } from "react";
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
  Trash2
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
    dota_kill: 0.80,
    dota_assist: 0.40,
    dota_lasthit_10: 0.10,
    dota_denies_5: 0.10,
    dota_networth_1000: 0.10,
    dota_win: 10.00,
    pubg_kill: 2.00,
    pubg_win: 15.00,
    pubg_top10: 6.00,
  };

  // Initialize state from settings or default values
  const fragConfig = settings.frag || {
    is_active: false,
    tariffs: defaultTariffs,
  };

  const [isActive, setIsActive] = useState<boolean>(fragConfig.is_active);
  const [tariffs, setTariffs] = useState<any>({ ...defaultTariffs, ...fragConfig.tariffs });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sub-tab selection: "settings" | "stats" | "tournaments"
  const [subTab, setSubTab] = useState<"settings" | "stats" | "tournaments">("settings");
  
  // Stats states
  const [statsData, setStatsData] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);

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
  const [editPrizes, setEditPrizes] = useState<Prize[]>([]);
  const [isUpdatingTournament, setIsUpdatingTournament] = useState<boolean>(false);
  const [isDeletingTournament, setIsDeletingTournament] = useState<boolean>(false);

  const [completingTournamentId, setCompletingTournamentId] = useState<number | null>(null);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/promo/admin/frag?clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        setStatsData(data);
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
      fetchStats();
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...settings,
        frag: {
          is_active: isActive,
          tariffs: tariffs,
        },
      };
      await saveSettings(updatedSettings);
    } catch (e) {
      console.error(e);
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
          onClick={() => setSubTab("settings")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all duration-300 font-black uppercase italic text-xs tracking-wider",
            subTab === "settings"
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-105"
              : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200"
          )}
        >
          <Gamepad2 className="w-4 h-4" />
          Настройки тарифов
        </button>
        <button
          onClick={() => setSubTab("stats")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all duration-300 font-black uppercase italic text-xs tracking-wider",
            subTab === "stats"
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-105"
              : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200"
          )}
        >
          <Users className="w-4 h-4" />
          Статистика игроков
        </button>
        <button
          onClick={() => setSubTab("tournaments")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all duration-300 font-black uppercase italic text-xs tracking-wider",
            subTab === "tournaments"
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-105"
              : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200"
          )}
        >
          <Trophy className="w-4 h-4" />
          Рейтинговые Турниры
        </button>
      </div>

      <AnimatePresence mode="wait">
        {subTab === "settings" && (
          <motion.div
            key="settings-pane"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* Left Column: General Control */}
            <div className="md:col-span-1 space-y-6">
              <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Gamepad2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase italic">
                      Модуль <span className="text-indigo-500">Frag</span>
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                      Начисление за игровые успехи
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Интеграция с локальным игровым агентом. Когда гость играет на ПК в CS2 или Dota 2, его успехи (убийства, хэдшоты, победы) автоматически вознаграждаются реальными бонусами на промо-баланс.
                </p>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group">
                  <div>
                    <div className="font-black italic uppercase text-xs tracking-tight">
                      Статус интеграции
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                      Включить или выключить Frag
                    </div>
                  </div>
                  <button
                    onClick={handleToggleActive}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-colors duration-300",
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
                </div>

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={cn(
                    "w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black uppercase italic text-xs tracking-widest transition-all",
                    "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10",
                    "disabled:opacity-50"
                  )}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Сохранить настройки
                </button>
              </div>
            </div>

            {/* Right Columns: Game Tariffs */}
            <div className="md:col-span-2 space-y-8">
              {/* CS2 Tariffs Card */}
              <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase italic">
                      Тарифы <span className="text-orange-500">Counter-Strike 2</span>
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                      Награда за внутриигровые действия
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: "cs2_kill", label: "Обычное убийство (Frag)", suffix: "₽" },
                    { key: "cs2_hs", label: "Убийство в голову (HS bonus)", suffix: "₽" },
                    { key: "cs2_knife", label: "Убийство ножом (Knife bonus)", suffix: "₽" },
                    { key: "cs2_zeus", label: "Убийство с Zeus/Taser (Zeus bonus)", suffix: "₽" },
                    { key: "cs2_assist", label: "Ассист / Помощь (Assist)", suffix: "₽" },
                    { key: "cs2_mvp", label: "Звезда MVP раунда (Round MVP)", suffix: "₽" },
                    { key: "cs2_win", label: "Победа в матче (Match Win)", suffix: "₽" },
                  ].map((item) => (
                    <div key={item.key} className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">
                        {item.label}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tariffs[item.key] ?? 0}
                          onChange={(e) => handleTariffChange(item.key, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-orange-500 focus:bg-white transition-all pr-10"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                          {item.suffix}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dota 2 Tariffs Card */}
              <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase italic">
                      Тарифы <span className="text-red-500">Dota 2</span>
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                      Награда за внутриигровые действия
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: "dota_kill", label: "Убийство героя (Hero Kill)", suffix: "₽" },
                    { key: "dota_assist", label: "Ассист в замесе (Hero Assist)", suffix: "₽" },
                    { key: "dota_lasthit_10", label: "Каждые 10 добитых крипов (Last Hits)", suffix: "₽" },
                    { key: "dota_denies_5", label: "Каждые 5 союзных крипов (Denies)", suffix: "₽" },
                    { key: "dota_networth_1000", label: "Каждые 1000 золота (Networth)", suffix: "₽" },
                    { key: "dota_win", label: "Победа в матче (Match Win)", suffix: "₽" },
                  ].map((item) => (
                    <div key={item.key} className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">
                        {item.label}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tariffs[item.key] ?? 0}
                          onChange={(e) => handleTariffChange(item.key, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-red-500 focus:bg-white transition-all pr-10"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                          {item.suffix}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* PUBG Tariffs Card */}
            <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
                    <Gamepad2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase italic">
                      Тарифы <span className="text-yellow-500">PUBG</span>
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                      Награда за внутриигровые действия
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: "pubg_kill", label: "Убийство (Kill)", suffix: "₽" },
                    { key: "pubg_win", label: "Победа (Top 1 Win)", suffix: "₽" },
                    { key: "pubg_top10", label: "Попадание в Топ-10 (Top 10)", suffix: "₽" },
                  ].map((item) => (
                    <div key={item.key} className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">
                        {item.label}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tariffs[item.key] ?? 0}
                          onChange={(e) => handleTariffChange(item.key, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-yellow-500 focus:bg-white transition-all pr-10"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                          {item.suffix}
                        </span>
                      </div>
                    </div>
                  ))}
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
            {statsLoading ? (
              <div className="flex h-64 items-center justify-center bg-white border border-slate-200 rounded-[2.5rem]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : !statsData ? (
              <div className="text-center py-12 text-slate-400 font-bold bg-white border border-slate-200 rounded-[2.5rem]">
                Не удалось загрузить данные
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center shrink-0">
                      <Coins className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Начислено бонусов</div>
                      <div className="text-2xl font-black italic uppercase text-slate-900 mt-1">
                        {parseFloat(statsData.summary.total_earned || 0).toLocaleString("ru-RU")} ₽
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Активных игроков</div>
                      <div className="text-2xl font-black italic uppercase text-slate-900 mt-1">
                        {statsData.summary.total_players}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shrink-0">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Всего матчей CS2</div>
                      <div className="text-2xl font-black italic uppercase text-slate-900 mt-1">
                        {statsData.summary.cs2_matches}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shrink-0">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Всего матчей Dota 2</div>
                      <div className="text-2xl font-black italic uppercase text-slate-900 mt-1">
                        {statsData.summary.dota_matches}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Leaderboard / Player Stats */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-[2.5rem] shadow-sm space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-lg font-black uppercase italic">Статистика по игрокам</h4>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                            Накопленные показатели участников
                          </p>
                        </div>
                      </div>

                      {statsData.playerStats.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs font-bold uppercase tracking-wider">
                          Статистика по игрокам отсутствует
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <th className="pb-3 pl-2">Игрок</th>
                                <th className="pb-3 text-center">Игра</th>
                                <th className="pb-3 text-center">Матчи</th>
                                <th className="pb-3 text-center">K / D / A</th>
                                <th className="pb-3 text-center">Достижения</th>
                                <th className="pb-3 pr-2 text-right">Награда</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600">
                              {statsData.playerStats.map((p: any, idx: number) => {
                                const isCs2 = p.game === "CS2";
                                const kd = p.total_deaths > 0 ? (p.total_kills / p.total_deaths).toFixed(2) : p.total_kills;

                                return (
                                  <tr key={`${p.player_id}-${p.game}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 pl-2">
                                      <div className="font-bold text-slate-900">{p.full_name || "Не указано"}</div>
                                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                        <Phone className="w-3 h-3 text-slate-300" /> {p.phone_number}
                                      </div>
                                    </td>
                                    <td className="py-4 text-center">
                                      <span className={cn(
                                        "px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider",
                                        isCs2 ? "bg-orange-50 text-orange-600" : "bg-red-50 text-red-600"
                                      )}>
                                        {p.game}
                                      </span>
                                    </td>
                                    <td className="py-4 text-center font-bold text-slate-800">
                                      {p.matches_count}
                                    </td>
                                    <td className="py-4 text-center">
                                      <div className="font-bold text-slate-800">
                                        {p.total_kills} / {p.total_deaths} / {p.total_assists}
                                      </div>
                                      <div className="text-[10px] text-slate-400 mt-0.5">
                                        K/D: {kd}
                                      </div>
                                    </td>
                                    <td className="py-4 text-center">
                                      {isCs2 ? (
                                        <div className="flex flex-wrap justify-center gap-1 max-w-[240px] mx-auto">
                                          <span className="bg-slate-50 border border-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                            🎯 HS: {p.achievements?.hs || 0}
                                          </span>
                                          {p.achievements?.mvp > 0 && (
                                            <span className="bg-amber-50 border border-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              ⭐️ MVP: {p.achievements.mvp}
                                            </span>
                                          )}
                                          {p.achievements?.wins > 0 && (
                                            <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              🏆 Win: {p.achievements.wins}
                                            </span>
                                          )}
                                          {p.achievements?.knife > 0 && (
                                            <span className="bg-orange-50 border border-orange-100 text-orange-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              🔪 Нож: {p.achievements.knife}
                                            </span>
                                          )}
                                          {p.achievements?.zeus > 0 && (
                                            <span className="bg-yellow-50 border border-yellow-100 text-yellow-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              ⚡ Zeus: {p.achievements.zeus}
                                            </span>
                                          )}
                                          {p.achievements?.doubleKills > 0 && (
                                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              🔥 Dbl: {p.achievements.doubleKills}
                                            </span>
                                          )}
                                          {p.achievements?.tripleKills > 0 && (
                                            <span className="bg-purple-50 border border-purple-100 text-purple-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              ⚡ Trpl: {p.achievements.tripleKills}
                                            </span>
                                          )}
                                          {p.achievements?.quadKills > 0 && (
                                            <span className="bg-red-50 border border-red-100 text-red-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              💀 Quad: {p.achievements.quadKills}
                                            </span>
                                          )}
                                          {p.achievements?.aces > 0 && (
                                            <span className="bg-rose-50 border border-rose-100 text-rose-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              👑 Ace: {p.achievements.aces}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap justify-center gap-1 max-w-[240px] mx-auto">
                                          <span className="bg-slate-50 border border-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                            🪙 LH: {p.achievements?.lastHits || 0}
                                          </span>
                                          {p.achievements?.denies > 0 && (
                                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              🛡️ Deny: {p.achievements.denies}
                                            </span>
                                          )}
                                          {p.achievements?.networthMilestones > 0 && (
                                            <span className="bg-amber-50 border border-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              💰 NW: +{p.achievements.networthMilestones}k
                                            </span>
                                          )}
                                          {p.achievements?.wins > 0 && (
                                            <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              🏆 Win: {p.achievements.wins}
                                            </span>
                                          )}
                                          {p.achievements?.spree > 0 && (
                                            <span className="bg-orange-50 border border-orange-100 text-orange-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              🔥 Spree: {p.achievements.spree}
                                            </span>
                                          )}
                                          {p.achievements?.mega > 0 && (
                                            <span className="bg-red-50 border border-red-100 text-red-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              ⚡ Mega: {p.achievements.mega}
                                            </span>
                                          )}
                                          {p.achievements?.godlike > 0 && (
                                            <span className="bg-rose-50 border border-rose-100 text-rose-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                              👑 God: {p.achievements.godlike}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-4 pr-2 text-right">
                                      <span className="font-black text-emerald-600">
                                        +{parseFloat(p.total_earned).toFixed(2)} ₽
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Matches */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-[2.5rem] shadow-sm space-y-6">
                      <div>
                        <h4 className="text-lg font-black uppercase italic">Последние матчи</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                          Хронологическая лента игр
                        </p>
                      </div>

                      {statsData.recentMatches.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs font-bold uppercase tracking-wider">
                          Игр еще не было сыграно
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                          {statsData.recentMatches.map((m: any) => {
                            const isCs2 = m.game === "CS2";
                            const date = new Date(m.played_at);
                            const dateStr = date.toLocaleString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            const isExpanded = expandedMatchId === m.id;

                            let parsedEvents: string[] = [];
                            if (m.events) {
                              try {
                                parsedEvents = typeof m.events === "string" ? JSON.parse(m.events) : m.events;
                              } catch (e) {
                                // ignore
                              }
                            }

                            return (
                              <div key={m.id} className="py-3 first:pt-0 last:pb-0">
                                <div
                                  className="flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50 p-2 rounded-2xl transition-colors"
                                  onClick={() => toggleMatchExpand(m.id)}
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider",
                                        isCs2 ? "bg-orange-50 text-orange-600" : m.game === "PUBG" ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"
                                      )}>
                                        {m.game}
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-400 truncate max-w-[90px]">
                                        {m.map}
                                      </span>
                                    </div>
                                    <div className="font-bold text-slate-900 text-xs truncate max-w-[150px]">
                                      {m.full_name || "Игрок"}
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                      <Sword className="w-3 h-3 text-slate-300" /> KDA: {m.kills}/{m.deaths}/{m.assists}
                                    </div>
                                    <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-slate-300" /> {dateStr}
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0 flex items-center gap-2">
                                    <div>
                                      <div className="font-black text-emerald-600">+{parseFloat(m.earned).toFixed(1)} ₽</div>
                                      <div className="text-[10px] font-black text-slate-400 mt-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                        {m.score || "0:0"}
                                      </div>
                                    </div>
                                    <div className="text-slate-300 mt-1 select-none">
                                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                  </div>
                                </div>

                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden bg-slate-50 border border-slate-100 p-4 rounded-3xl text-[11px] text-slate-600 space-y-3 mx-2"
                                    >
                                      <div className="grid grid-cols-2 gap-2 font-bold text-slate-700">
                                        <div>K/D/A: <span className="text-slate-900">{m.kills} / {m.deaths} / {m.assists}</span></div>
                                        <div>
                                          {isCs2 ? (
                                            <>Хедшоты: <span className="text-slate-900">{m.headshots}</span></>
                                          ) : m.game === "PUBG" ? (
                                            <>Результат: <span className="text-slate-900">{m.score}</span></>
                                          ) : (
                                            <>Крипы: <span className="text-slate-900">{m.last_hits}</span></>
                                          )}
                                        </div>
                                      </div>

                                      {parsedEvents && parsedEvents.length > 0 && (
                                        <div className="pt-2 border-t border-slate-200">
                                          <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">Хронология матча</div>
                                          <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-white/10 mt-1.5">
                                            {parsedEvents.map((evt, idx) => (
                                              <div key={idx} className="text-[10px] text-gray-400 py-1 border-b border-white/[0.02] last:border-0">
                                                {evt}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
              <div className="space-y-1">
                <h4 className="text-xl font-black uppercase italic">Рейтинговые Сезоны Frag</h4>
                <p className="text-xs text-slate-400 font-medium">
                  Запускайте рейтинговые кубки по CS2 и Dota 2 с автоматическим расчетом очков и выдачей призовых балансов.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/10 text-xs font-black uppercase italic tracking-wider transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                Создать Сезон
              </button>
            </div>

            {/* List of tournaments */}
            {tournamentsLoading ? (
              <div className="flex h-64 items-center justify-center bg-white border border-slate-200 rounded-[2.5rem]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : tournaments.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-bold bg-white border border-slate-200 rounded-[2.5rem] uppercase tracking-wider text-xs">
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
                        "bg-white border rounded-[2rem] p-6 shadow-sm flex flex-col justify-between gap-6 transition-all hover:shadow-md",
                        isActiveStatus ? "border-slate-200" : "border-slate-100 opacity-80"
                      )}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            "px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider",
                            t.game === "CS2" ? "bg-orange-50 text-orange-600" : t.game === "Dota2" ? "bg-red-50 text-red-600" : "bg-purple-50 text-purple-600"
                          )}>
                            {t.game === "ALL" ? "CS2 + Dota2" : t.game}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase",
                            isActiveStatus ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                          )}>
                            {isActiveStatus ? "Активен" : "Завершен"}
                          </span>
                        </div>

                        <div>
                          <h5 className="font-black text-slate-900 text-base leading-tight uppercase italic">{t.title}</h5>
                          <div className="text-[10px] text-slate-400 font-bold mt-1 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-300" />
                            <span>{formatDate(t.start_date)} — {formatDate(t.end_date)}</span>
                          </div>
                          {t.description && (
                            <p className="text-[11px] text-slate-500 mt-2 font-medium line-clamp-2 leading-relaxed">
                              {t.description}
                            </p>
                          )}
                        </div>

                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-[11px] font-medium text-slate-600 space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400 tracking-wider pb-1 border-b border-slate-200/50">
                            <span>Призы</span>
                            <span>Мин. игр: {t.min_matches}</span>
                          </div>
                          {prizesList.slice(0, 3).map((p: any, idx: number) => {
                            const reward = parseFloat(p.reward) || 0;
                            const textPrize = p.text_prize || "";
                            
                            return (
                              <div key={idx} className="flex justify-between items-start gap-2">
                                <span className="flex items-center gap-1 shrink-0">
                                  <Award className={cn(
                                    "w-3.5 h-3.5",
                                    p.place === 1 ? "text-amber-500" : p.place === 2 ? "text-slate-400" : "text-amber-700"
                                  )} />
                                  {p.place} место:
                                </span>
                                <span className="font-black text-slate-800 text-right">
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
                            <div className="text-[9px] font-black text-slate-400 pt-0.5 text-center">
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
                          className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          Таблица участников
                        </button>
                        
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider text-indigo-600 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Редактировать
                        </button>

                        {isActiveStatus && isPastEndDate && (
                          <button
                            onClick={() => handleCompleteTournament(t.id)}
                            disabled={completingTournamentId === t.id}
                            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 disabled:opacity-50"
                          >
                            {completingTournamentId === t.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Award className="w-3.5 h-3.5" />
                            )}
                            Завершить и наградить
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

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl w-full max-w-xl space-y-6 relative max-h-[90vh] overflow-y-auto scrollbar-thin"
          >
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-6 h-6" />
            </button>

            <div>
              <h4 className="text-xl font-black uppercase italic">Создать турнирный сезон</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Настройки периода соревнований
              </p>
            </div>

            <form onSubmit={handleCreateTournament} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Название сезона</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Летний кубок CS2 - Июль"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Описание турнира (правила, спонсоры, информация)</label>
                <textarea
                  placeholder="Опишите турнир, спонсоров и особые условия участия..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Дисциплина</label>
                  <select
                    value={newGame}
                    onChange={(e) => setNewGame(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  >
                    <option value="CS2">Counter-Strike 2</option>
                    <option value="Dota2">Dota 2</option>
                    <option value="ALL">Все игры (CS2 + Dota2)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Мин. матчей для зачета</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newMinMatches}
                    onChange={(e) => setNewMinMatches(parseInt(e.target.value) || 5)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Дата начала</label>
                  <input
                    type="datetime-local"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Дата окончания</label>
                  <input
                    type="datetime-local"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Prizes editor */}
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Награды по местам</label>
                <div className="space-y-4 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                  {newPrizes.map((p, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800">{p.place} место</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewPrizes(newPrizes.filter((_, i) => i !== idx).map((x, i) => ({ ...x, place: i + 1 })));
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
                              const updated = [...newPrizes];
                              updated[idx].reward = parseFloat(e.target.value) || 0;
                              setNewPrizes(updated);
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
                            const updated = [...newPrizes];
                            updated[idx].text_prize = e.target.value;
                            setNewPrizes(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Детали / описание награды"
                        value={p.description}
                        onChange={(e) => {
                          const updated = [...newPrizes];
                          updated[idx].description = e.target.value;
                          setNewPrizes(updated);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextPlace = newPrizes.length + 1;
                    setNewPrizes([...newPrizes, { place: nextPlace, reward: 1000, text_prize: "", description: "" }]);
                  }}
                  className="text-indigo-500 hover:text-indigo-600 text-[10px] font-black uppercase flex items-center gap-1 ml-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Добавить призовое место
                </button>
              </div>

              <button
                type="submit"
                disabled={isCreatingTournament}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 font-black uppercase italic text-xs tracking-widest shadow-lg shadow-indigo-600/10 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
              >
                {isCreatingTournament ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Запустить Сезон
              </button>
            </form>
          </motion.div>
        </div>
      )}

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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Дисциплина</label>
                  <select
                    value={editGame}
                    onChange={(e) => setEditGame(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  >
                    <option value="CS2">Counter-Strike 2</option>
                    <option value="Dota2">Dota 2</option>
                    <option value="ALL">Все игры (CS2 + Dota2)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block ml-2">Мин. матчей для зачета</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editMinMatches}
                    onChange={(e) => setEditMinMatches(parseInt(e.target.value) || 5)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
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
                  className="flex-1 py-4 rounded-2xl border border-red-200 hover:bg-red-50 text-red-500 font-black uppercase italic text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  {isDeletingTournament ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Удалить Сезон
                </button>

                <button
                  type="submit"
                  disabled={isUpdatingTournament}
                  className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 font-black uppercase italic text-xs tracking-widest shadow-lg shadow-indigo-600/10 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isUpdatingTournament ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Сохранить
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
