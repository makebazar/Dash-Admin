"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Swords,
  Trophy,
  Gamepad2,
  Plus,
  Edit2,
  Loader2,
  Calendar,
  CheckCircle2,
  XCircle,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formatPrizeText = (prize: any) => {
  if (!prize) return '—';
  const parts: string[] = [];
  if (prize.reward > 0) parts.push(`${prize.reward} ₽`);
  if (prize.textPrize) parts.push(prize.textPrize);
  return parts.length > 0 ? parts.join(' + ') : '—';
};

const DashFragTournamentCard = ({ tournament, clubId, playerId }: { tournament: any; clubId: string; playerId: string }) => {
  const stats = tournament.stats;
  const isFinished = tournament.status !== 'active' || new Date() > new Date(tournament.end_date);
  const statusLabel = isFinished ? 'Завершен' : 'Активен';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {statusLabel}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {tournament.game === 'ALL' ? 'Мульти-дисциплина' : tournament.game}
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            {tournament.title}
          </h3>
          <div className="text-xs text-slate-500 font-medium mt-0.5">
            {new Date(tournament.start_date).toLocaleDateString()} — {new Date(tournament.end_date).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Rank */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Место</div>
          {tournament.rank ? (
            <div className="text-xl font-bold text-slate-900">#{tournament.rank} <span className="text-xs font-normal text-slate-400">/ {tournament.totalPlayers}</span></div>
          ) : (
            <div className="text-sm font-bold text-slate-400">—</div>
          )}
        </div>

        {/* TP */}
        <div className="bg-slate-900 text-white rounded-xl p-3.5 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Очки TP</div>
          <div className="text-xl font-bold leading-tight">{stats.points}</div>
        </div>

        {/* Prize */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
            {isFinished ? 'Выигрыш' : 'Текущий приз'}
          </div>
          <div className="text-sm font-bold text-slate-900 truncate" title={formatPrizeText(tournament.myPrize)}>
            {formatPrizeText(tournament.myPrize)}
          </div>
        </div>

        {/* Matches */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Сыграно</div>
          <div className="text-sm font-bold text-slate-900">{stats.matchesCount} ({stats.wins}W / {stats.losses}L)</div>
        </div>

        {/* Detail Link */}
        <a
          href={`/clubs/${clubId}/players/${playerId}/tournaments/${tournament.id}`}
          className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl p-3.5 flex flex-col justify-center items-center gap-0.5 transition-all group cursor-pointer no-underline"
        >
          <div className="text-xs font-bold uppercase tracking-wider">Подробнее</div>
          <div className="text-[10px] text-slate-400">Топ-15 матчей</div>
        </a>
      </div>
    </div>
  );
};

export default function EsportsPlayerProfilePage() {
  const { clubId, playerId } = useParams();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<"cs2" | "dota2" | "pubg" | "tournaments" | null>("cs2");
  const [resultFilter, setResultFilter] = useState<"all" | "win" | "loss">("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleDay = (day: string) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  // Modal States
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isAdjustSubmitting, setIsAdjustSubmitting] = useState(false);

  const [isIdsModalOpen, setIsIdsModalOpen] = useState(false);
  const [steamId, setSteamId] = useState("");
  const [dotaId, setDotaId] = useState("");
  const [pubgNickname, setPubgNickname] = useState("");
  const [isIdsSubmitting, setIsIdsSubmitting] = useState(false);

  const fetchProfileData = async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/players/${playerId}/esports`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setSteamId(json.player?.steamId || "");
        setDotaId(json.player?.dotaId || "");
        setPubgNickname(json.player?.pubgNickname || "");
      } else {
        console.error("Fetch profile failed status:", res.status);
      }
    } catch (err) {
      console.error("Fetch Profile Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (clubId && playerId) {
      fetchProfileData();
    }
  }, [clubId, playerId]);

  const handleAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustAmount || !adjustReason.trim()) return;

    setIsAdjustSubmitting(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/players/${playerId}/adjust-points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: adjustAmount,
          reason: adjustReason,
        }),
      });

      if (res.ok) {
        setIsAdjustModalOpen(false);
        setAdjustAmount("");
        setAdjustReason("");
        fetchProfileData();
      } else {
        const errJson = await res.json();
        alert(`Ошибка: ${errJson.error}`);
      }
    } catch (err: any) {
      alert(`Ошибка сервера: ${err.message}`);
    } finally {
      setIsAdjustSubmitting(false);
    }
  };

  const handleUpdateIds = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsIdsSubmitting(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/players/${playerId}/update-game-ids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steamId,
          dotaId,
          pubgNickname,
        }),
      });

      if (res.ok) {
        setIsIdsModalOpen(false);
        fetchProfileData();
      } else {
        const errJson = await res.json();
        alert(`Ошибка: ${errJson.error}`);
      }
    } catch (err: any) {
      alert(`Ошибка сервера: ${err.message}`);
    } finally {
      setIsIdsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC] text-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!data || !data.player) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#F8FAFC] text-slate-900 space-y-4">
        <p className="text-xl font-bold">Игрок не найден</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold uppercase text-xs shadow-lg shadow-indigo-500/20"
        >
          Вернуться назад
        </button>
      </div>
    );
  }

  const { player, stats, matchHistory, pointLogs } = data;

  const filteredMatchHistory = matchHistory?.filter((m: any) => {
    const game = m.game_name?.toLowerCase() || "";
    
    // Game Filter
    if (activeGame) {
      if (activeGame === "cs2" && !(game === "cs2" || game === "csgo" || m.game?.includes("CS"))) return false;
      if (activeGame === "dota2" && !(game === "dota2" || game === "dota 2")) return false;
      if (activeGame === "pubg" && game !== "pubg" && m.game !== "PUBG") return false;
    }

    // Result Filter
    if (resultFilter === "win" && !m.is_win) return false;
    if (resultFilter === "loss" && m.is_win) return false;
    
    // Period Filter
    if (periodFilter !== "all" && m.created_at) {
      const matchDate = new Date(m.created_at);
      const now = new Date();
      if (periodFilter === "today") {
        if (matchDate.toDateString() !== now.toDateString()) return false;
      } else if (periodFilter === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        if (matchDate < weekAgo) return false;
      } else if (periodFilter === "month") {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        if (matchDate < monthAgo) return false;
      }
    }

    return true;
  }) || [];

  const groupedMatches = filteredMatchHistory.reduce((acc: any, m: any) => {
    const dateStr = new Date(m.created_at).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long', year: 'numeric' });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(m);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-black uppercase tracking-wider transition-all shadow-sm max-w-fit"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            Назад к списку
          </button>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
            <span>ID: {player.id}</span>
            <span>•</span>
            <span>Регистрация: {new Date(player.createdAt).toLocaleDateString("ru-RU")}</span>
          </div>
        </div>

        {/* Hero Esports Card */}
        <div className="bg-white border border-slate-200 p-8 md:p-10 rounded-[2.5rem] shadow-sm space-y-8 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            {/* Player Main Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-slate-900">
                    {player.fullName || "Без имени"}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-6 text-slate-500 text-sm font-bold flex-wrap mt-2">
                <span>{player.phoneNumber}</span>
                {player.steamId && (
                  <span className="text-indigo-600 font-mono text-xs bg-indigo-50 px-3 py-1 rounded-xl">Steam: {player.steamId}</span>
                )}
                {player.pubgNickname && (
                  <span className="text-amber-600 font-mono text-xs bg-amber-50 px-3 py-1 rounded-xl">PUBG: {player.pubgNickname}</span>
                )}
              </div>
            </div>

            {/* DashFrag Points & Action Controls */}
            <div className="flex items-center gap-6 shrink-0 bg-slate-50 border border-slate-100 p-6 rounded-3xl">
              <div className="space-y-1 text-center sm:text-left">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Заработано в играх
                </div>
                <div className="text-4xl font-black text-indigo-600 italic tracking-tight">
                  {Math.round(player.totalEarnedInGames || 0)} ₽
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setIsAdjustModalOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase px-4 py-2.5 rounded-2xl transition-all shadow-md shadow-indigo-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Корректировка баланса
                </button>
                <button
                  onClick={() => setIsIdsModalOpen(true)}
                  className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 font-black text-xs uppercase px-4 py-2 rounded-2xl transition-all border border-slate-200"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                  Игровые ID
                </button>
              </div>
            </div>
          </div>

          {/* Discipline Stats Switcher */}
          <div className="pt-6 border-t border-slate-100 flex items-center gap-3">
            {[
              { id: "cs2", label: "CS2", color: "indigo" },
              { id: "dota2", label: "Dota 2", color: "red" },
              { id: "pubg", label: "PUBG", color: "amber" },
              { id: "tournaments", label: "Турниры", color: "purple" },
            ].map((game) => (
              <button
                key={game.id}
                onClick={() => setActiveGame(game.id as any)}
                className={cn(
                  "px-6 py-2.5 rounded-2xl font-black uppercase italic text-xs tracking-wider transition-all duration-200",
                  activeGame === game.id
                    ? "bg-slate-900 text-white shadow-md scale-105"
                    : "bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200"
                )}
              >
                {game.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards Section */}
        <AnimatePresence mode="wait">
          {activeGame === "cs2" && (
            <motion.div
              key="cs2-stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6"
            >
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mатчей CS2</div>
                <div className="text-3xl font-black text-slate-900 italic">{stats.cs2.matchesCount}</div>
                <div className="text-xs text-emerald-600 font-bold">{stats.cs2.winsCount} побед ({stats.cs2.winrate}%)</div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">K/D Ratio</div>
                <div className="text-3xl font-black text-indigo-600 italic">{stats.cs2.kdRatio}</div>
                <div className="text-xs text-slate-500 font-mono">{stats.cs2.kills} K / {stats.cs2.deaths} D</div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">% Headshots</div>
                <div className="text-3xl font-black text-amber-600 italic">{stats.cs2.headshotsPercent}%</div>
                <div className="text-xs text-slate-500 font-bold">Эйсы (1v5): {stats.cs2.acesCount}</div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Любимая карта</div>
                <div className="text-3xl font-black text-slate-900 italic">{stats.cs2.favoriteMap}</div>
                <div className="text-xs text-indigo-600 font-bold">Высокая точность</div>
              </div>
            </motion.div>
          )}

          {activeGame === "dota2" && (
            <motion.div
              key="dota-stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6"
            >
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Матчей Dota 2</div>
                <div className="text-3xl font-black text-slate-900 italic">{stats.dota2.matchesCount}</div>
                <div className="text-xs text-emerald-600 font-bold">{stats.dota2.winsCount} побед ({stats.dota2.winrate}%)</div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">KDA Ratio</div>
                <div className="text-3xl font-black text-red-600 italic">{stats.dota2.kdaRatio}</div>
                <div className="text-xs text-slate-500 font-mono">{stats.dota2.kills} / {stats.dota2.deaths} / {stats.dota2.assists}</div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Last Hits</div>
                <div className="text-3xl font-black text-slate-900 italic">{stats.dota2.avgLastHits}</div>
                <div className="text-xs text-slate-500 font-bold">Denies: {stats.dota2.avgDenies}</div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Роль</div>
                <div className="text-3xl font-black text-red-600 italic">Core / Carry</div>
                <div className="text-xs text-slate-500 font-bold">Клубный состав</div>
              </div>
            </motion.div>
          )}

          {activeGame === "pubg" && (
            <motion.div
              key="pubg-stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6"
            >
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Матчей PUBG</div>
                <div className="text-3xl font-black text-slate-900 italic">{stats.pubg.matchesCount}</div>
                <div className="text-xs text-amber-600 font-bold">Top-1 Побед: {stats.pubg.top1Wins} ({stats.pubg.winrate}%)</div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Всего Киллов</div>
                <div className="text-3xl font-black text-amber-600 italic">{stats.pubg.kills}</div>
                <div className="text-xs text-slate-500 font-mono">PUBG Tracking</div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Средний Урон</div>
                <div className="text-3xl font-black text-slate-900 italic">{stats.pubg.avgDamage}</div>
                <div className="text-xs text-slate-500 font-bold">ADR в клубе</div>
              </div>
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">PUBG Ник</div>
                <div className="text-3xl font-black text-amber-600 italic">{player.pubgNickname || "Не указан"}</div>
                <div className="text-xs text-slate-500 font-bold">В игре</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeGame === "tournaments" && (
          <motion.div
            key="tournaments-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">
              Турниры DashFrag
            </h2>
            {data?.dashfragTournaments?.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center text-slate-500 font-medium">
                Игрок пока не участвовал ни в одном турнире.
              </div>
            ) : (
              data?.dashfragTournaments?.map((t: any) => (
                <DashFragTournamentCard key={t.id} tournament={t} clubId={clubId as string} playerId={playerId as string} />
              ))
            )}
          </motion.div>
        )}

        {/* Logs Navigation & Tables */}
        {activeGame !== "tournaments" && (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-4">
            <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">
              История матчей
            </h2>
            <div className="flex items-center gap-3">
              <Select value={periodFilter} onValueChange={(val: any) => setPeriodFilter(val)}>
                <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider h-10 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 hover:bg-slate-100 transition-all">
                  <SelectValue placeholder="За всё время" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white">
                  <SelectItem value="all" className="font-bold text-xs uppercase text-slate-700 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer">За всё время</SelectItem>
                  <SelectItem value="today" className="font-bold text-xs uppercase text-slate-700 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer">За сегодня</SelectItem>
                  <SelectItem value="week" className="font-bold text-xs uppercase text-slate-700 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer">За неделю</SelectItem>
                  <SelectItem value="month" className="font-bold text-xs uppercase text-slate-700 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer">За месяц</SelectItem>
                </SelectContent>
              </Select>

              <Select value={resultFilter} onValueChange={(val: any) => setResultFilter(val)}>
                <SelectTrigger className="w-[170px] bg-slate-50 border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider h-10 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 hover:bg-slate-100 transition-all">
                  <SelectValue placeholder="Все результаты" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white">
                  <SelectItem value="all" className="font-bold text-xs uppercase text-slate-700 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer">Все результаты</SelectItem>
                  <SelectItem value="win" className="font-bold text-xs uppercase text-emerald-600 focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer">Победы</SelectItem>
                  <SelectItem value="loss" className="font-bold text-xs uppercase text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer">Поражения</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-black uppercase tracking-wider border-b border-slate-100">
                    <th className="pb-3">Дата</th>
                    <th className="pb-3">Игра</th>
                    <th className="pb-3">Карта / Режим</th>
                    <th className="pb-3">Результат</th>
                    <th className="pb-3">K / D / A</th>
                    <th className="pb-3 text-right">Начислено бонусов</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {Object.keys(groupedMatches).length > 0 ? (
                    Object.keys(groupedMatches).map((date) => (
                      <React.Fragment key={date}>
                        {/* Day Header */}
                        <tr 
                          onClick={() => toggleDay(date)}
                          className="bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              {date}
                              <span className="text-xs font-medium text-slate-400 ml-1">
                                {groupedMatches[date].length} {groupedMatches[date].length === 1 ? 'матч' : groupedMatches[date].length < 5 ? 'матча' : 'матчей'}
                              </span>
                            </div>
                          </td>
                          <td colSpan={2} className="py-3 border-b border-slate-200"></td>
                          <td className="py-3 border-b border-slate-200">
                            {(() => {
                              const wins = groupedMatches[date].filter((m: any) => m.is_win).length;
                              const losses = groupedMatches[date].length - wins;
                              return (
                                <span className="text-xs font-bold text-slate-500">
                                  {wins}W / {losses}L
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 border-b border-slate-200">
                            {(() => {
                              const kills = groupedMatches[date].reduce((sum: number, m: any) => sum + (m.kills || 0), 0);
                              const deaths = groupedMatches[date].reduce((sum: number, m: any) => sum + (m.deaths || 0), 0);
                              const assists = groupedMatches[date].reduce((sum: number, m: any) => sum + (m.assists || 0), 0);
                              const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
                              return (
                                <span className="text-xs font-mono font-bold text-slate-500">
                                  K/D: {kd}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 pr-4 text-right border-b border-slate-200 relative">
                            <div className="flex items-center justify-end gap-4">
                              <span className="font-black text-indigo-600 text-sm">
                                +{groupedMatches[date].reduce((sum: number, m: any) => sum + (m.earned_points || 0), 0)} ₽
                              </span>
                              {expandedDays[date] ? (
                                <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Matches for the Day */}
                        {expandedDays[date] && groupedMatches[date].map((m: any) => (
                          <tr
                            key={m.id}
                            onClick={() => router.push(`/clubs/${clubId}/dashfrag/matches/${m.id}`)}
                            className="hover:bg-slate-100/80 cursor-pointer transition-colors"
                          >
                            <td className="py-4 text-slate-500 px-4">
                              {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-4 font-black uppercase text-indigo-600">
                              <div>{m.game_name || "CS2"}</div>
                              {m.platformTag && (
                                <span className="inline-block bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-md mt-0.5">
                                  {m.platformTag}
                                </span>
                              )}
                            </td>
                            <td className="py-4">
                              <div className="font-bold text-slate-900">{m.map_name || "Dust2"}</div>
                              {m.score && m.score !== "—" && (
                                <div className="text-[10px] text-slate-400 font-mono">Счёт: {m.score}</div>
                              )}
                            </td>
                            <td className="py-4">
                              {m.is_win ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-black uppercase text-[10px] bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" /> Победа
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-700 font-black uppercase text-[10px] bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
                                  <XCircle className="w-3 h-3" /> Поражение
                                </span>
                              )}
                            </td>
                            <td className="py-4 font-mono font-bold text-slate-900">
                              {m.kills || 0} / {m.deaths || 0} / {m.assists || 0}
                            </td>
                            <td className="py-4 pr-4 text-right font-black text-indigo-600 text-sm">
                              +{m.earned_points || 0} ₽
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                        Матчи пока не зарегистрированы
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
        </div>
        )}
      </div>

      {/* Adjust Points Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl max-w-md w-full space-y-6 shadow-2xl">
            <h3 className="text-xl font-black uppercase italic text-slate-900">
              Корректировка бонусного баланса
            </h3>

            <form onSubmit={handleAdjustPoints} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  Сумма (+ или -)
                </label>
                <input
                  type="number"
                  placeholder="Например: 50 или -20"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  Причина / Комментарий
                </label>
                <textarea
                  rows={3}
                  placeholder="Укажите причину изменений"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase py-3 rounded-2xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isAdjustSubmitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                >
                  {isAdjustSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Game IDs Modal */}
      {isIdsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl max-w-md w-full space-y-6 shadow-2xl">
            <h3 className="text-xl font-black uppercase italic text-slate-900">
              Редактирование игровых ID
            </h3>

            <form onSubmit={handleUpdateIds} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  Steam ID 64 (CS2)
                </label>
                <input
                  type="text"
                  placeholder="76561198..."
                  value={steamId}
                  onChange={(e) => setSteamId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  Dota 2 ID
                </label>
                <input
                  type="text"
                  placeholder="Например: 123456789"
                  value={dotaId}
                  onChange={(e) => setDotaId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  PUBG Никнейм
                </label>
                <input
                  type="text"
                  placeholder="Игровой ник в PUBG"
                  value={pubgNickname}
                  onChange={(e) => setPubgNickname(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIdsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase py-3 rounded-2xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isIdsSubmitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                >
                  {isIdsSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
