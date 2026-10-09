"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Trophy,
  ChevronLeft,
  Server,
  Play,
  Pause,
  RefreshCw,
  Clock,
  Check,
  Copy,
  ExternalLink,
  Shield,
  Zap,
  Users,
  AlertTriangle,
  Send,
  Terminal,
  RotateCcw,
  Flag,
  Radio,
  Sliders,
  Sparkles,
  Wifi,
  WifiOff,
  CheckCheck,
  Monitor,
  Gamepad2,
  Calendar,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCs2StatusPlayers } from "@/lib/cs2/utils";

const MAP_PREVIEWS: Record<string, { name: string; image: string; desc: string }> = {
  // 5v5 Premier & Classic
  de_mirage: { name: "Mirage", image: "/images/maps/de_mirage.png", desc: "Главный соревновательный выбор, открытые пленты и мид" },
  de_dust2: { name: "Dust II", image: "/images/maps/de_dust2.png", desc: "Золотая классика Counter-Strike, длинные дуэли" },
  de_inferno: { name: "Inferno", image: "/images/maps/de_inferno.png", desc: "Тактический контроль банана, ковров и апартаментов" },
  de_nuke: { name: "Nuke", image: "/images/maps/de_nuke.png", desc: "Двухуровневый атомный комплекс, улица и рампа" },
  de_ancient: { name: "Ancient", image: "/images/maps/de_ancient.png", desc: "Древние руины майя, джунгли и узкие коннекторы" },
  de_anubis: { name: "Anubis", image: "/images/maps/de_anubis.png", desc: "Песчаные каналы, мост и быстрые размены" },
  de_vertigo: { name: "Vertigo", image: "/images/maps/de_vertigo.png", desc: "Высотный небоскрёб на этапе строительства" },
  de_overpass: { name: "Overpass", image: "/images/maps/de_overpass.png", desc: "Берлинский парк, каналы и эстакада" },
  de_train: { name: "Train", image: "/images/maps/de_train.png", desc: "Железнодорожное депо, поезда и узкие переходы" },
  cs_office: { name: "Office", image: "/images/maps/cs_office.png", desc: "Зимний офисный комплекс, спасение заложников" },
  cs_italy: { name: "Italy", image: "/images/maps/cs_italy.png", desc: "Итальянские улочки и винные погреба" },

  // Wingman (Напарники 2х2)
  de_lake: { name: "Lake", image: "/images/maps/de_lake.png", desc: "Напарники: Загородный дом у озера, ближний бой" },
  de_bank: { name: "Bank", image: "/images/maps/de_bank.png", desc: "Напарники: Ограбление пригородного банка" },
  de_safehouse: { name: "Safehouse", image: "/images/maps/de_safehouse.png", desc: "Напарники: Лесной коттедж с несколькими этажами" },
  de_boyard: { name: "Boyard", image: "/images/maps/de_boyard.png", desc: "Напарники: Морской каменный форт и тесные галереи" },
  de_chalice: { name: "Chalice", image: "/images/maps/de_chalice.png", desc: "Напарники: Старинный европейский замок со статуями" },
  de_shortnuke: { name: "Short Nuke", image: "/images/maps/de_nuke.png", desc: "Напарники: Спуск, рампа и плент B" },
  de_shortdust: { name: "Short Dust", image: "/images/maps/de_dust2.png", desc: "Напарники: Зигзаг, лонг и плент A" },

  // 1v1 Aim & Duels
  aim_redline: { name: "Aim Redline", image: "/images/maps/aim_redline.png", desc: "1v1: Симметричная арена для дуэлей на винтовках" },
  aim_map: { name: "Aim Map", image: "/images/maps/aim_map.png", desc: "1v1: Легендарная дуэльная арена с ящиками" },
  awp_lego_2: { name: "AWP Lego 2", image: "/images/maps/awp_lego_2.png", desc: "1v1: Культовая снайперская дуэль из блоков LEGO" },
  aim_ak47: { name: "Aim AK47", image: "/images/maps/aim_ak47.png", desc: "1v1: Дуэльная карта для стрельбы с автоматов" },
  aim_headshot: { name: "Aim Headshot", image: "/images/maps/aim_headshot.png", desc: "1v1: Жесткие укрытия только для хедшотов" },
  aim_dust2: { name: "Aim Dust2", image: "/images/maps/de_dust2.png", desc: "1v1: Компактная дуэльная адаптация мида Dust II" },
  aim_pistol_cs2: { name: "Aim Pistol", image: "/images/maps/aim_pistol_cs2.png", desc: "1v1: Динамичные пистолетные дуэли" },
  aim_aztec: { name: "Aim Aztec", image: "/images/maps/aim_aztec.png", desc: "1v1: Дуэльная арена в стиле Ацтека" },
};

export default function MatchControlPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const clubId = params.clubId as string;
  const matchId = params.matchId as string;
  const tournamentIdParam = searchParams.get("tournamentId") || searchParams.get("id") || "";

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [veto, setVeto] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [activeCs2Match, setActiveCs2Match] = useState<any>(null);

  // Manual score & schedule
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [matchScheduledAt, setMatchScheduledAt] = useState("");
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);

  // Launcher state
  const [selectedMap, setSelectedMap] = useState("de_mirage");
  const [customWorkshopId, setCustomWorkshopId] = useState("");
  const [knifeRound, setKnifeRound] = useState(true);
  const [practiceMode, setPracticeMode] = useState(false);
  const [isLaunchingServer, setIsLaunchingServer] = useState(false);
  const [isStoppingServer, setIsStoppingServer] = useState(false);

  // RCON & Live Controls
  const [isSendingRcon, setIsSendingRcon] = useState(false);
  const [rconCommandInput, setRconCommandInput] = useState("");
  const [rconLogs, setRconLogs] = useState<Array<{ text: string; time: string; type: "sent" | "resp" }>>([]);
  const [restoreRound, setRestoreRound] = useState("1");
  const [copiedConnect, setCopiedConnect] = useState(false);

  // Active Control Tab
  const [activeTab, setActiveTab] = useState<"server" | "rcon" | "players" | "schedule">("server");

  // Fetch match details & agent state
  const fetchMatchData = useCallback(async () => {
    try {
      // 1. Match details from public match endpoint
      const matchRes = await fetch(`/api/promo/matches/${matchId}`);
      if (!matchRes.ok) throw new Error("Match not found");
      const matchData = await matchRes.json();
      setMatch(matchData.match);
      setCheckins(matchData.checkins || []);
      setVeto(matchData.veto);

      if (matchData.match) {
        setScore1(matchData.match.score1 ?? 0);
        setScore2(matchData.match.score2 ?? 0);
        if (matchData.match.scheduledAt) {
          const d = new Date(matchData.match.scheduledAt);
          const pad = (n: number) => n.toString().padStart(2, "0");
          setMatchScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
        }
        if (matchData.match.selectedMap) {
          setSelectedMap(matchData.match.selectedMap);
        }
      }

      // 2. DashMatch agent & live CS2 instances from club API
      const statusRes = await fetch(`/api/clubs/${clubId}/cs2/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setAgent(statusData.agent || null);
        if (statusData.matches) {
          const dmId = `dm-tourney-${matchId}`;
          const found = statusData.matches.find((m: any) => m.id === dmId || m.id === matchData.match?.cs2ServerId);
          if (found) {
            setActiveCs2Match(found);
            if (found.score1 !== undefined) setScore1(found.score1);
            if (found.score2 !== undefined) setScore2(found.score2);
          } else {
            setActiveCs2Match(null);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching match data:", err);
    }
  }, [clubId, matchId]);

  useEffect(() => {
    fetchMatchData().then(() => setLoading(false));

    const interval = setInterval(fetchMatchData, 4000);
    return () => clearInterval(interval);
  }, [fetchMatchData]);

  // Actions
  const handleUpdateMatchSchedule = async () => {
    setIsUpdatingSchedule(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_match_schedule",
          matchId: match.id,
          scheduledAt: matchScheduledAt ? new Date(matchScheduledAt).toISOString() : null,
        }),
      });
      if (res.ok) {
        await fetchMatchData();
        alert("Время матча успешно сохранено!");
      } else {
        alert("Не удалось обновить время матча");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  const handleLaunchServer = async () => {
    setIsLaunchingServer(true);
    try {
      const finalMap = customWorkshopId.trim() ? customWorkshopId.trim() : selectedMap;
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "launch_match_server",
          matchId: match.id,
          selectedMap: finalMap,
          knifeRound,
          practiceMode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchMatchData();
      } else {
        alert(data.error || "Не удалось запустить сервер CS2");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при запуске сервера");
    } finally {
      setIsLaunchingServer(false);
    }
  };

  const handleStopServer = async () => {
    if (!confirm("Остановить игровой сервер CS2 и освободить порт?")) {
      return;
    }
    setIsStoppingServer(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stop_match_server",
          matchId: match.id,
        }),
      });
      if (res.ok) {
        setActiveCs2Match(null);
        await fetchMatchData();
      } else {
        alert("Не удалось остановить сервер");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStoppingServer(false);
    }
  };

  const handleSendRcon = async (command: string) => {
    if (!command.trim() || isSendingRcon) return;
    setIsSendingRcon(true);

    const now = new Date().toLocaleTimeString();
    setRconLogs((prev) => [...prev, { text: `> ${command}`, time: now, type: "sent" }]);

    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_rcon_command",
          matchId: match.id,
          command,
        }),
      });
      if (res.ok) {
        setRconLogs((prev) => [...prev, { text: `[Успешно отправлено агенту DashMatch]`, time: new Date().toLocaleTimeString(), type: "resp" }]);
        setTimeout(fetchMatchData, 800);
      } else {
        setRconLogs((prev) => [...prev, { text: `[Ошибка выполнения команды]`, time: new Date().toLocaleTimeString(), type: "resp" }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingRcon(false);
      setRconCommandInput("");
    }
  };

  const handleTechWin = async (winnerCompetitorId: string, loserName: string) => {
    if (!winnerCompetitorId) return;
    if (!confirm(`Присудить техническую победу команде? Победитель автоматически пройдет в следующий раунд сетки.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tech_win",
          matchId: match.id,
          winnerCompetitorId,
          reason: `Техническая победа (${loserName})`,
        }),
      });
      if (res.ok) {
        await fetchMatchData();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось сохранить тех. победу");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    }
  };

  const handleFinishMatch = async () => {
    if (score1 === score2) {
      alert("Ничья невозможна в соревновательном формате плей-офф!");
      return;
    }
    setIsSubmittingScore(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finish_match",
          matchId: match.id,
          score1,
          score2,
        }),
      });
      if (res.ok) {
        await fetchMatchData();
        alert("Результат матча сохранен и сетка обновлена!");
      } else {
        alert("Не удалось сохранить результат");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    } finally {
      setIsSubmittingScore(false);
    }
  };

  const handleCopyConnect = () => {
    const cmd = match?.connectCommand || `connect ${activeCs2Match?.server_ip || agent?.lan_ip || "127.0.0.1"}:${activeCs2Match?.port || 27015}`;
    navigator.clipboard.writeText(cmd);
    setCopiedConnect(true);
    setTimeout(() => setCopiedConnect(false), 2000);
  };

  if (loading || !match) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white space-y-4">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Загрузка матча...
        </p>
      </div>
    );
  }

  const compA = match.competitorA;
  const compB = match.competitorB;
  const statusLower = match.status?.toLowerCase() || "scheduled";
  const isFinished = statusLower === "finished";
  const isLive = statusLower === "live" || statusLower === "in_progress" || Boolean(activeCs2Match);
  const isServerRunning = Boolean(activeCs2Match && activeCs2Match.status !== "stopped" && activeCs2Match.status !== "finished");

  const serverIp = activeCs2Match?.server_ip || agent?.lan_ip || "127.0.0.1";
  const serverPort = activeCs2Match?.port || agent?.base_port || 27015;
  const livePlayers = parseCs2StatusPlayers(activeCs2Match?.rcon_last_response);

  const selectedMapKey = veto?.selected_map || match.selectedMap || selectedMap || "de_mirage";
  const selectedMapInfo = MAP_PREVIEWS[selectedMapKey] || {
    name: selectedMapKey.replace(/^(de_|cs_)/g, "").toUpperCase(),
    image: `/images/maps/${selectedMapKey}.png`,
    desc: "Соревновательная карта",
  };

  const backUrl = `/clubs/${clubId}/tournaments?id=${match.tournamentId || tournamentIdParam}&tab=bracket`;
  const playerLobbyUrl = `/promo/tournaments/match/${match.id}?clubId=${clubId}`;

  // Stage indicator
  const isThirdPlace = match.result?.isThirdPlace || match.result?.stage === "bronze";
  const isFinal = match.result?.stage === "final" || match.result?.stage === "grand_final" || match.round === 200;
  const stageTitle = isThirdPlace
    ? "🥉 Матч за 3-е место (Бронзовый финал)"
    : isFinal
    ? "🏆 Гранд-Финал турнира"
    : match.result?.stage === "semifinal"
    ? "1/2 Финала (Полуфинал)"
    : `Раунд ${match.round}`;

  return (
    <div className="min-h-screen bg-[#09090c] text-white selection:bg-orange-500/20 pb-16 font-sans">
      
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <header className="border-b border-white/5 bg-[#0e0e12]/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push(backUrl)}
              className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-orange-500" />
              <span>Назад к сетке турнира</span>
            </button>

            <div className="w-px h-4 bg-white/10 hidden sm:block shrink-0" />

            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:inline truncate">
              {match.tournamentName || "Турнир"} • {stageTitle}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={playerLobbyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-bold uppercase tracking-wider transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Лобби игроков</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. MATCH HERO BANNER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        <div className="relative rounded-3xl bg-[#111116] border border-white/5 p-6 sm:p-8 overflow-hidden shadow-2xl">
          {/* Subtle map backdrop */}
          {selectedMapInfo && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none filter blur-md transition-all duration-700"
              style={{ backgroundImage: `url(${selectedMapInfo.image})` }}
            />
          )}

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Team A */}
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                Команда 1
              </div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white truncate">
                {compA?.name || "Ожидает пару..."}
              </h2>
              <div className="text-xs text-gray-400 font-medium">
                Состав: {compA?.roster?.length || 1} чел.
              </div>
            </div>

            {/* Score & Stage */}
            <div className="text-center flex flex-col items-center justify-center space-y-1">
              <div className="text-4xl sm:text-6xl font-black font-mono tracking-tight text-white flex items-center justify-center gap-3">
                <span className={cn(match.winnerId === compA?.id ? "text-emerald-400" : "")}>{match.score1 ?? 0}</span>
                <span className="text-orange-500 font-sans font-light">:</span>
                <span className={cn(match.winnerId === compB?.id ? "text-emerald-400" : "")}>{match.score2 ?? 0}</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-[11px] font-bold uppercase tracking-wider text-gray-300">
                <span>{match.matchFormat?.toUpperCase() || "BO1"}</span>
                <span>•</span>
                <span className="text-orange-400">{selectedMapInfo.name}</span>
                <span>•</span>
                <span className={cn(isFinished ? "text-emerald-400" : isServerRunning ? "text-red-400 animate-pulse" : "text-gray-400")}>
                  {isFinished ? "Завершен" : isServerRunning ? "● LIVE CS2" : "Ожидание"}
                </span>
              </div>
            </div>

            {/* Team B */}
            <div className="space-y-1 text-left md:text-right">
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                Команда 2
              </div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white truncate">
                {compB?.name || "Ожидает пару..."}
              </h2>
              <div className="text-xs text-gray-400 font-medium">
                Состав: {compB?.roster?.length || 1} чел.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN ARENA: 12 COLUMNS */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* TOP STATUS BAR: DASHMATCH AGENT + SERVER CONNECTION */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          
          {/* DashMatch Agent Card */}
          <div className="md:col-span-5 bg-[#111116] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                  agent?.is_online
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                )}>
                  {agent?.is_online ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    DashMatch CS2 Агент
                  </h3>
                  <div className="text-[11px] text-gray-400 font-mono">
                    {agent?.is_online ? `В сети • LAN IP: ${agent.lan_ip || "127.0.0.1"}` : "Агент не отвечает на хосте"}
                  </div>
                </div>
              </div>

              <button
                onClick={fetchMatchData}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer"
                title="Обновить статус"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-black/40 p-3 rounded-2xl border border-white/5">
              <div>
                <span className="text-gray-500 block text-[9px] uppercase font-bold font-sans">Порты выделения</span>
                <span className="text-gray-200 font-bold">{agent?.base_port || 27015} .. {(agent?.base_port || 27015) + (agent?.max_instances || 4) - 1}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase font-bold font-sans">Свободно слотов</span>
                <span className="text-emerald-400 font-bold">{agent?.max_instances ? `${agent.max_instances} матчей` : "Доступен"}</span>
              </div>
            </div>
          </div>

          {/* Live Server Quick Actions / Status */}
          <div className="md:col-span-7 bg-[#111116] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 block">
                  Игровой сервер CS2
                </span>
                <h3 className="text-base font-black uppercase tracking-tight text-white">
                  {isServerRunning ? (
                    <span className="text-emerald-400 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      Сервер запущен (Порт :{serverPort})
                    </span>
                  ) : (
                    <span className="text-gray-400">Сервер CS2 не запущен</span>
                  )}
                </h3>
              </div>

              {isServerRunning && (
                <button
                  onClick={handleStopServer}
                  disabled={isStoppingServer}
                  className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Остановить</span>
                </button>
              )}
            </div>

            {isServerRunning ? (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <button
                  onClick={handleCopyConnect}
                  className="sm:col-span-8 py-2.5 px-3.5 bg-black/60 hover:bg-black/80 border border-white/10 hover:border-orange-500/40 rounded-xl text-xs font-mono font-bold text-gray-200 transition-all flex items-center justify-between gap-2 group cursor-pointer"
                >
                  <span className="truncate text-orange-400 font-mono">
                    connect {serverIp}:{serverPort}
                  </span>
                  {copiedConnect ? (
                    <span className="text-emerald-400 text-xs font-bold uppercase shrink-0">Скопировано</span>
                  ) : (
                    <span className="text-gray-400 group-hover:text-white text-xs font-bold uppercase shrink-0">Копировать</span>
                  )}
                </button>

                <a
                  href={`steam://connect/${serverIp}:${serverPort}`}
                  className="sm:col-span-4 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Войти в CS2</span>
                </a>
              </div>
            ) : (
              <div className="text-xs text-gray-400 bg-black/30 p-3 rounded-2xl border border-white/5">
                Вы можете запустить выделенный сервер матча на ПК клуба вручную или дождаться автоматического запуска после вето игроков.
              </div>
            )}
          </div>

        </div>

        {/* 4. MAIN ACTION PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT 7 COLS: SERVER LAUNCHER & RCON DECK */}
          <div className="lg:col-span-7 space-y-6">

            {/* SERVER LAUNCHER */}
            <div className="bg-[#111116] border border-white/5 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="border-b border-white/5 pb-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                    Запуск матча
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white mt-0.5">
                    Параметры сервера CS2
                  </h3>
                </div>
                <Gamepad2 className="w-5 h-5 text-orange-500" />
              </div>

              <div className="space-y-4">
                {/* Map Picker */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
                    Игровая карта матча:
                  </label>
                  <select
                    value={selectedMap}
                    onChange={(e) => setSelectedMap(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-orange-500 transition-all cursor-pointer"
                  >
                    <optgroup label="Соревновательные 5v5">
                      <option value="de_mirage">Mirage (de_mirage)</option>
                      <option value="de_dust2">Dust II (de_dust2)</option>
                      <option value="de_inferno">Inferno (de_inferno)</option>
                      <option value="de_nuke">Nuke (de_nuke)</option>
                      <option value="de_ancient">Ancient (de_ancient)</option>
                      <option value="de_anubis">Anubis (de_anubis)</option>
                      <option value="de_vertigo">Vertigo (de_vertigo)</option>
                      <option value="de_overpass">Overpass (de_overpass)</option>
                      <option value="de_train">Train (de_train)</option>
                    </optgroup>
                    <optgroup label="Напарники 2v2 (Wingman)">
                      <option value="de_lake">Lake (de_lake)</option>
                      <option value="de_bank">Bank (de_bank)</option>
                      <option value="de_safehouse">Safehouse (de_safehouse)</option>
                      <option value="de_boyard">Boyard (de_boyard)</option>
                      <option value="de_chalice">Chalice (de_chalice)</option>
                      <option value="de_shortnuke">Short Nuke (de_shortnuke)</option>
                      <option value="de_shortdust">Short Dust (de_shortdust)</option>
                    </optgroup>
                    <optgroup label="Дуэли 1v1 (Aim & Duels)">
                      <option value="aim_redline">Aim Redline (aim_redline)</option>
                      <option value="aim_map">Aim Map (aim_map)</option>
                      <option value="awp_lego_2">AWP Lego 2 (awp_lego_2)</option>
                      <option value="aim_ak47">Aim AK47 (aim_ak47)</option>
                      <option value="aim_headshot">Aim Headshot (aim_headshot)</option>
                      <option value="aim_dust2">Aim Dust2 (aim_dust2)</option>
                      <option value="aim_pistol_cs2">Aim Pistol (aim_pistol_cs2)</option>
                      <option value="aim_aztec">Aim Aztec (aim_aztec)</option>
                    </optgroup>
                  </select>
                </div>

                {/* Steam Workshop custom ID */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
                    Или Steam Workshop ID карты (опционально):
                  </label>
                  <input
                    type="text"
                    placeholder="Например: 3070549948"
                    value={customWorkshopId}
                    onChange={(e) => setCustomWorkshopId(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-all font-mono"
                  />
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2.5 bg-black/40 p-3 rounded-2xl border border-white/5 cursor-pointer hover:border-white/10 transition-all">
                    <input
                      type="checkbox"
                      checked={knifeRound}
                      onChange={(e) => setKnifeRound(e.target.checked)}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-200 block">Ножевой раунд (.knife)</span>
                      <span className="text-[10px] text-gray-500">Выбор стороны за победителем</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 bg-black/40 p-3 rounded-2xl border border-white/5 cursor-pointer hover:border-white/10 transition-all">
                    <input
                      type="checkbox"
                      checked={practiceMode}
                      onChange={(e) => setPracticeMode(e.target.checked)}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-200 block">Режим тренировки</span>
                      <span className="text-[10px] text-gray-500">Без строгого вайтлиста игроков</span>
                    </div>
                  </label>
                </div>

                {/* Launch Button */}
                <button
                  onClick={handleLaunchServer}
                  disabled={isLaunchingServer || !agent?.is_online}
                  className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-orange-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLaunchingServer ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Инициализация CS2 на ПК клуба...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Запустить сервер CS2 на ПК клуба</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* MATCHZY & RCON QUICK CONTROL DECK */}
            <div className="bg-[#111116] border border-white/5 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="border-b border-white/5 pb-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                    Управление сервером в реальном времени
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white mt-0.5">
                    MatchZy & RCON команды
                  </h3>
                </div>
                <Sliders className="w-5 h-5 text-orange-500" />
              </div>

              {/* Quick RCON Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  onClick={() => handleSendRcon("css_pause")}
                  disabled={isSendingRcon || !isServerRunning}
                  className="p-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-2xl border border-white/5 text-xs font-bold text-gray-300 hover:text-white transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Pause className="w-4 h-4 text-orange-400" />
                  <span>Пауза (.pause)</span>
                </button>

                <button
                  onClick={() => handleSendRcon("css_unpause")}
                  disabled={isSendingRcon || !isServerRunning}
                  className="p-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-2xl border border-white/5 text-xs font-bold text-gray-300 hover:text-white transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                  <span>Снять паузу</span>
                </button>

                <button
                  onClick={() => handleSendRcon("css_start")}
                  disabled={isSendingRcon || !isServerRunning}
                  className="p-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-2xl border border-white/5 text-xs font-bold text-gray-300 hover:text-white transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span>Старт LIVE</span>
                </button>

                <button
                  onClick={() => handleSendRcon("mp_restartgame 1")}
                  disabled={isSendingRcon || !isServerRunning}
                  className="p-3 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-2xl border border-white/5 text-xs font-bold text-gray-300 hover:text-white transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-blue-400" />
                  <span>Рестарт раунда</span>
                </button>
              </div>

              {/* Restore Round Selector */}
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-300 flex items-center justify-between">
                  <span>Откат раунда MatchZy Backup</span>
                  <span className="text-[10px] text-gray-500">css_restore</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={restoreRound}
                    onChange={(e) => setRestoreRound(e.target.value)}
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((r) => (
                      <option key={r} value={r}>
                        Раунд {r}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSendRcon(`css_restore ${restoreRound}`)}
                    disabled={isSendingRcon || !isServerRunning}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Откатить
                  </button>
                </div>
              </div>

              {/* Live Interactive RCON Console */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                  Интерактивная RCON консоль:
                </label>
                <div className="bg-black/80 border border-white/10 rounded-2xl p-3 font-mono text-xs text-gray-300 min-h-[120px] max-h-[180px] overflow-y-auto space-y-1">
                  {rconLogs.length === 0 ? (
                    <div className="text-gray-600 text-center py-8">
                      Введите команду для выполнения на игровом сервере CS2...
                    </div>
                  ) : (
                    rconLogs.map((log, idx) => (
                      <div key={idx} className={cn("text-xs leading-relaxed", log.type === "sent" ? "text-orange-400 font-bold" : "text-gray-400")}>
                        <span className="text-gray-600 mr-2">[{log.time}]</span>
                        {log.text}
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendRcon(rconCommandInput);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Например: status, changelevel de_dust2, mp_warmuptime 30..."
                    value={rconCommandInput}
                    onChange={(e) => setRconCommandInput(e.target.value)}
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isSendingRcon || !rconCommandInput.trim() || !isServerRunning}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Отправить</span>
                  </button>
                </form>
              </div>
            </div>

          </div>

          {/* RIGHT 5 COLS: ROSTER CHECK-INS & MANUAL MATCH RESULTS */}
          <div className="lg:col-span-5 space-y-6">

            {/* MANUAL SCORE & RESULT */}
            <div className="bg-[#111116] border border-white/5 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="border-b border-white/5 pb-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                  Судейская панель
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-white mt-0.5">
                  Результат матча
                </h3>
              </div>

              {/* Score Editor */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2 text-center">
                    <label className="text-xs font-black uppercase text-orange-400 truncate block">
                      {compA?.name || "Команда 1"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={score1}
                      onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                      className="w-full text-center bg-black/60 border border-white/10 rounded-xl py-2.5 text-2xl font-black font-mono text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2 text-center">
                    <label className="text-xs font-black uppercase text-blue-400 truncate block">
                      {compB?.name || "Команда 2"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={score2}
                      onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                      className="w-full text-center bg-black/60 border border-white/10 rounded-xl py-2.5 text-2xl font-black font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleFinishMatch}
                  disabled={isSubmittingScore}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmittingScore ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                  <span>Подтвердить счет и продвинуть сетку</span>
                </button>
              </div>

              {/* Technical Victory Buttons */}
              <div className="pt-2 border-t border-white/5 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Техническая победа (ТП):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTechWin(compA?.id, compB?.name || "Команда 2")}
                    disabled={!compA?.id}
                    className="p-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all truncate cursor-pointer"
                  >
                    Победа {compA?.name || "Команда 1"}
                  </button>

                  <button
                    onClick={() => handleTechWin(compB?.id, compA?.name || "Команда 1")}
                    disabled={!compB?.id}
                    className="p-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all truncate cursor-pointer"
                  >
                    Победа {compB?.name || "Команда 2"}
                  </button>
                </div>
              </div>
            </div>

            {/* SCHEDULE DATE/TIME PICKER */}
            <div className="bg-[#111116] border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="border-b border-white/5 pb-2.5 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Расписание матча
                </h3>
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>

              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={matchScheduledAt}
                  onChange={(e) => setMatchScheduledAt(e.target.value)}
                  className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={handleUpdateMatchSchedule}
                  disabled={isUpdatingSchedule}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Сохранить</span>
                </button>
              </div>
            </div>

            {/* PLAYERS & CHECKINS STATUS */}
            <div className="bg-[#111116] border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="border-b border-white/5 pb-2.5 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Участники и готовность за ПК
                </h3>
                <span className="text-[10px] font-bold text-orange-400 uppercase">
                  {checkins.filter((c) => c.is_ready).length} готовы
                </span>
              </div>

              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                {/* Team 1 Roster */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                    {compA?.name || "Команда 1"}
                  </div>
                  {(compA?.roster || [{ id: compA?.playerId, full_name: compA?.name, nickname: compA?.name }]).map((p: any) => {
                    const checkin = checkins.find((c) => String(c.player_id) === String(p.id));
                    const pName = p.nickname || p.full_name || p.name || "Игрок";
                    return (
                      <div key={p.id || pName} className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-white block truncate">{pName}</span>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                            <span>ПК {checkin?.pc_number ? `#${checkin.pc_number}` : "—"}</span>
                            {p.player_elo && <span>• {p.player_elo} ELO</span>}
                          </div>
                        </div>
                        <span className={cn("text-[10px] font-bold uppercase", checkin?.is_ready ? "text-emerald-400" : "text-gray-500")}>
                          {checkin?.is_ready ? "Готов" : "Ожидает"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Team 2 Roster */}
                <div className="space-y-1.5 pt-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                    {compB?.name || "Команда 2"}
                  </div>
                  {(compB?.roster || [{ id: compB?.playerId, full_name: compB?.name, nickname: compB?.name }]).map((p: any) => {
                    const checkin = checkins.find((c) => String(c.player_id) === String(p.id));
                    const pName = p.nickname || p.full_name || p.name || "Игрок";
                    return (
                      <div key={p.id || pName} className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-white block truncate">{pName}</span>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                            <span>ПК {checkin?.pc_number ? `#${checkin.pc_number}` : "—"}</span>
                            {p.player_elo && <span>• {p.player_elo} ELO</span>}
                          </div>
                        </div>
                        <span className={cn("text-[10px] font-bold uppercase", checkin?.is_ready ? "text-emerald-400" : "text-gray-500")}>
                          {checkin?.is_ready ? "Готов" : "Ожидает"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
