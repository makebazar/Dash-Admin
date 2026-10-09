"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  RefreshCw,
  Square,
  Save,
  Loader2,
  Flag,
  Play,
  Pause,
  Clock,
  Swords,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Server,
  Wifi,
  WifiOff,
  Users,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Gamepad2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tournament, Competitor, Match, DashMatchAgentInfo, ActiveCs2MatchInfo } from "../types";
import { parseCs2StatusPlayers } from "@/lib/cs2/utils";

interface MatchControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  tournament: Tournament;
  competitors: Competitor[];
  clubId: string;
  onRefreshTournament: () => Promise<void>;
  dashmatchAgent?: DashMatchAgentInfo | null;
  activeCs2Matches?: ActiveCs2MatchInfo[];
}

const DEFAULT_MAP_OPTIONS = [
  // 5v5 Premier & Classic
  { id: "de_mirage", name: "Mirage" },
  { id: "de_dust2", name: "Dust II" },
  { id: "de_inferno", name: "Inferno" },
  { id: "de_nuke", name: "Nuke" },
  { id: "de_ancient", name: "Ancient" },
  { id: "de_anubis", name: "Anubis" },
  { id: "de_vertigo", name: "Vertigo" },
  { id: "de_overpass", name: "Overpass" },
  { id: "de_train", name: "Train" },
  { id: "cs_office", name: "Office" },
  { id: "cs_italy", name: "Italy" },

  // Wingman (Напарники 2х2)
  { id: "de_inferno", name: "Inferno (Напарники)" },
  { id: "de_vertigo", name: "Vertigo (Напарники)" },
  { id: "de_nuke", name: "Nuke (Напарники)" },
  { id: "de_overpass", name: "Overpass (Напарники)" },
  { id: "de_anubis", name: "Anubis (Напарники)" },
  { id: "de_dust2", name: "Dust II (Напарники)" },
  { id: "de_mirage", name: "Mirage (Напарники)" },

  // 1v1 Aim & Duels
  { id: "aim_redline", name: "Aim Redline (1v1)" },
  { id: "aim_map", name: "Aim Map (1v1)" },
  { id: "awp_lego_2", name: "AWP Lego 2 (1v1)" },
  { id: "aim_ak47", name: "Aim AK47 (1v1)" },
  { id: "aim_headshot", name: "Aim Headshot (1v1)" },
  { id: "aim_dust2", name: "Aim Dust2 (1v1)" },
  { id: "aim_pistol_cs2", name: "Aim Pistol (1v1)" },
  { id: "aim_aztec", name: "Aim Aztec (1v1)" },
];

export function MatchControlModal({
  isOpen,
  onClose,
  match,
  tournament,
  competitors,
  clubId,
  onRefreshTournament,
  dashmatchAgent: initialAgent,
  activeCs2Matches: initialCs2Matches,
}: MatchControlModalProps) {
  // General score & schedule
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [matchScheduledAt, setMatchScheduledAt] = useState("");
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);

  // DashMatch server states
  const [agent, setAgent] = useState<DashMatchAgentInfo | null>(initialAgent || null);
  const [selectedMap, setSelectedMap] = useState("de_mirage");
  const [customWorkshopId, setCustomWorkshopId] = useState("");
  const [knifeRound, setKnifeRound] = useState(true);
  const [practiceMode, setPracticeMode] = useState(false);
  const [isLaunchingServer, setIsLaunchingServer] = useState(false);
  const [isStoppingServer, setIsStoppingServer] = useState(false);
  const [isSendingRcon, setIsSendingRcon] = useState(false);
  const [copiedConnect, setCopiedConnect] = useState(false);
  const [matchControlTab, setMatchControlTab] = useState<"quick" | "restore" | "players" | "manual">("quick");
  const [restoreRound, setRestoreRound] = useState("1");
  const [activeCs2Match, setActiveCs2Match] = useState<ActiveCs2MatchInfo | null>(null);

  // Fetch / Sync status of agent & match on open
  const fetchDashMatchStatus = useCallback(async () => {
    if (!clubId || tournament.discipline !== "cs2") return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.agent) {
          setAgent(data.agent);
        }
        if (data.matches && match) {
          const dmId = `dm-tourney-${match.id}`;
          const found = data.matches.find((m: any) => m.id === dmId || m.id === match.cs2_server_id);
          if (found) {
            setActiveCs2Match(found);
            if (found.score1 !== undefined) setScore1(found.score1);
            if (found.score2 !== undefined) setScore2(found.score2);
          }
        }
      }
    } catch (err) {
      console.error("Error polling DashMatch status:", err);
    }
  }, [clubId, tournament.discipline, match]);

  useEffect(() => {
    if (match) {
      setScore1(match.score1 || 0);
      setScore2(match.score2 || 0);
      if (match.scheduled_at) {
        const d = new Date(match.scheduled_at);
        const pad = (n: number) => n.toString().padStart(2, "0");
        const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate()
        )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setMatchScheduledAt(localIso);
      } else {
        setMatchScheduledAt("");
      }

      // Initial map choice from tournament config
      if (tournament.config?.mapPool && tournament.config.mapPool.length > 0) {
        setSelectedMap(tournament.config.mapPool[0]);
      }

      // Find match in initial active matches
      if (initialCs2Matches && initialCs2Matches.length > 0) {
        const dmId = `dm-tourney-${match.id}`;
        const found = initialCs2Matches.find((m) => m.id === dmId || m.id === match.cs2_server_id);
        if (found) setActiveCs2Match(found);
      }

      fetchDashMatchStatus();
    }
  }, [match, tournament, initialCs2Matches, fetchDashMatchStatus]);

  // Periodic polling while modal is open
  useEffect(() => {
    if (!isOpen || tournament.discipline !== "cs2") return;
    const interval = setInterval(() => {
      fetchDashMatchStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen, tournament.discipline, fetchDashMatchStatus]);

  if (!isOpen || !match) return null;

  const compA = competitors.find((c) => c.id === match.competitor_a_id);
  const compB = competitors.find((c) => c.id === match.competitor_b_id);
  const matchTitle = match.result?.matchNumber
    ? `Матч ${match.result.matchNumber}`
    : `Матч #${match.id}`;

  const isAgentOnline = agent?.is_online ?? false;
  const isServerActive = Boolean(
    activeCs2Match &&
    activeCs2Match.status !== "stopped" &&
    activeCs2Match.status !== "finished"
  );

  const serverIp = activeCs2Match?.server_ip || agent?.lan_ip || "127.0.0.1";
  const serverPort = activeCs2Match?.port || agent?.base_port || 27015;
  const connectCommand = `connect ${serverIp}:${serverPort}`;
  const steamConnectUrl = `steam://connect/${serverIp}:${serverPort}`;

  // Parsed players on server
  const livePlayers = parseCs2StatusPlayers(activeCs2Match?.rcon_last_response);

  // Handlers
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
        await onRefreshTournament();
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
        await fetchDashMatchStatus();
        await onRefreshTournament();
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
    if (!confirm("Остановить сервер CS2 на выделенном ПК и освободить ресурсы?")) {
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
        await onRefreshTournament();
        await fetchDashMatchStatus();
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
    setIsSendingRcon(true);
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
        setTimeout(fetchDashMatchStatus, 800);
      } else {
        alert("Ошибка отправки RCON-команды");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingRcon(false);
    }
  };

  const handleTechWin = async (winnerCompetitorId: string, loserName: string) => {
    if (!winnerCompetitorId) return;
    if (!confirm(`Присудить техническое поражение команде "${loserName}"? Победитель автоматически пройдет в следующий раунд сетки.`)) {
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
          reason: `Техническое поражение (${loserName})`,
        }),
      });
      if (res.ok) {
        onClose();
        await onRefreshTournament();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось сохранить тех. поражение");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    }
  };

  const handleFinishMatch = async () => {
    if (score1 === score2) {
      alert("Ничья невозможна в соревновательном формате!");
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
        onClose();
        await onRefreshTournament();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingScore(false);
    }
  };

  const mapPoolList = (tournament.config?.mapPool && tournament.config.mapPool.length > 0)
    ? tournament.config.mapPool
    : DEFAULT_MAP_OPTIONS.map((m) => m.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-950/70 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-2xl space-y-6 text-slate-900 max-h-[92vh] overflow-y-auto custom-scrollbar">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <h3 className="text-lg font-extrabold tracking-tight text-slate-900">
                Управление <span className="text-orange-600">{matchTitle}</span>
              </h3>
              {match.result?.isTechWin && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Тех. победа
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {compA?.display_name || "Команда 1"} vs {compB?.display_name || "Команда 2"} •{" "}
              {match.round === 0
                ? "Групповой этап"
                : match.round === 200
                ? "Гранд-Финал"
                : match.round >= 101
                ? `Нижняя сетка R${match.round - 100}`
                : `Раунд ${match.round}`}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* CS2 DEDICATED SERVER SECTION (DashMatch) */}
        {tournament.discipline === "cs2" ? (
          <div className="space-y-4">
            
            {/* Agent Status Pill */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center",
                  isAgentOnline ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                )}>
                  {isAgentOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>DashMatch Агент:</span>
                    <span className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full font-semibold",
                      isAgentOnline ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                    )}>
                      {isAgentOnline ? `В сети (LAN: ${agent?.lan_ip || "127.0.0.1"})` : "Не подключен на ПК клуба"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {isAgentOnline
                      ? `Порты: ${agent?.base_port || 27015}..${(agent?.base_port || 27015) + (agent?.max_instances || 4) - 1} • Свободно для матчей`
                      : "Запустите dashmatch.exe на выделенном ПК клуба для старта сервера по LAN"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fetchDashMatchStatus()}
                className="text-xs text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-200/50 transition-colors flex items-center gap-1 cursor-pointer"
                title="Обновить статус"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* SERVER ACTIVE STATE */}
            {isServerActive ? (
              <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-4 shadow-sm">
                {/* Live Match Top Row */}
                <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md flex items-center gap-1",
                      activeCs2Match?.game_state === "paused"
                        ? "bg-amber-500 text-white animate-pulse"
                        : activeCs2Match?.status === "live"
                        ? "bg-emerald-500 text-white"
                        : "bg-blue-500 text-white"
                    )}>
                      {activeCs2Match?.game_state === "paused" ? (
                        <>
                          <Pause className="w-3 h-3 fill-white" /> Пауза
                        </>
                      ) : activeCs2Match?.status === "live" ? (
                        "🔴 Live Матч"
                      ) : (
                        "Запуск / Разминка"
                      )}
                    </span>

                    <span className="font-bold text-sm text-slate-200">
                      {compA?.display_name || activeCs2Match?.team1_name}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono font-bold text-sm">
                      {activeCs2Match?.score1 || 0} : {activeCs2Match?.score2 || 0}
                    </span>
                    <span className="font-bold text-sm text-slate-200">
                      {compB?.display_name || activeCs2Match?.team2_name}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono">
                    {activeCs2Match?.map_name} • Port {activeCs2Match?.port || 27015}
                  </div>
                </div>

                {/* Connect Command for Players */}
                <div className="flex items-center justify-between bg-slate-800/90 rounded-xl p-3 text-xs font-mono gap-2 flex-wrap">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-400 select-none">Вход:</span>
                    <span className="text-emerald-400 font-bold truncate">{connectCommand}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(connectCommand);
                        setCopiedConnect(true);
                        setTimeout(() => setCopiedConnect(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 h-7 px-3 text-[11px] rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-sans font-medium transition-all cursor-pointer"
                    >
                      {copiedConnect ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedConnect ? "Скопировано" : "Копировать"}
                    </button>
                  </div>
                </div>

                {/* Subtabs for Match Controller */}
                <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setMatchControlTab("quick")}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1",
                      matchControlTab === "quick" ? "bg-orange-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                    )}
                  >
                    <Sliders className="w-3 h-3" />
                    Пульт MatchZy
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchControlTab("restore")}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1",
                      matchControlTab === "restore" ? "bg-orange-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                    )}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Откат раундов
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMatchControlTab("players");
                      handleSendRcon("status");
                    }}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1",
                      matchControlTab === "players" ? "bg-orange-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                    )}
                  >
                    <Users className="w-3 h-3" />
                    Игроки ({livePlayers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchControlTab("manual")}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1",
                      matchControlTab === "manual" ? "bg-orange-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                    )}
                  >
                    <Save className="w-3 h-3" />
                    Ручной счёт
                  </button>
                </div>

                {/* TAB 1: QUICK CONTROLS */}
                {matchControlTab === "quick" && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {activeCs2Match?.game_state === "paused" ? (
                        <button
                          type="button"
                          disabled={isSendingRcon}
                          onClick={() => handleSendRcon("css_forceunpause")}
                          className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          Снять паузу
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isSendingRcon}
                          onClick={() => handleSendRcon("css_forcepause")}
                          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          Пауза
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isSendingRcon}
                        onClick={() => handleSendRcon("css_tech")}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Тех. пауза
                      </button>

                      <button
                        type="button"
                        disabled={isSendingRcon}
                        onClick={() => handleSendRcon("css_roundknife")}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-orange-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        Ножевой
                      </button>

                      <button
                        type="button"
                        disabled={isSendingRcon}
                        onClick={() => handleSendRcon("css_forceready")}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Все готовы
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        disabled={isStoppingServer}
                        onClick={handleStopServer}
                        className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 fill-rose-300" />
                        Остановить сервер и освободить ПК
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/clubs/${clubId}/tournaments`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "sync_match_stats", matchId: match.id }),
                          });
                          await onRefreshTournament();
                          onClose();
                        }}
                        className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Синхронизировать финал
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: ROUND ROLLBACK */}
                {matchControlTab === "restore" && (
                  <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3">
                    <div className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
                      Откат на сохраненный раунд (MatchZy Backup):
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={restoreRound}
                        onChange={(e) => setRestoreRound(e.target.value)}
                        className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-center text-white"
                      />
                      <button
                        type="button"
                        disabled={isSendingRcon}
                        onClick={() => handleSendRcon(`css_bk ${restoreRound}`)}
                        className="flex-1 py-2 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        Откатить до раунда #{restoreRound}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      MatchZy автоматически сохраняет снимок каждого раунда. При откате игра встанет на тактическую паузу.
                    </p>
                  </div>
                )}

                {/* TAB 3: PLAYERS LIST */}
                {matchControlTab === "players" && (
                  <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                      <span>Игроки на сервере ({livePlayers.length}):</span>
                      <button
                        type="button"
                        onClick={() => handleSendRcon("status")}
                        className="text-[11px] text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Обновить список
                      </button>
                    </div>

                    {livePlayers.length === 0 ? (
                      <div className="text-xs text-slate-400 py-3 text-center">
                        Игроки еще подключаются к серверу...
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                        {livePlayers.map((p, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                              <span className="font-bold text-slate-200">{p.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{p.steamId}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{p.ping} ms</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: MANUAL SCORE OVERRIDE */}
                {matchControlTab === "manual" && (
                  <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                          {compA?.display_name || "Команда 1"}
                        </label>
                        <input
                          type="number"
                          value={score1}
                          onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-center font-bold text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                          {compB?.display_name || "Команда 2"}
                        </label>
                        <input
                          type="number"
                          value={score2}
                          onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-center font-bold text-sm text-white"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleFinishMatch}
                      disabled={isSubmittingScore}
                      className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      Сохранить и завершить матч вручную
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* SERVER NOT LAUNCHED: LAUNCH CONFIG CARD */
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-orange-600" />
                    <h4 className="text-sm font-bold text-slate-900">Запуск сервера CS2 на ПК клуба</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    On-Demand LAN
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Map Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Игровая карта матча:
                    </label>
                    <select
                      value={selectedMap}
                      onChange={(e) => setSelectedMap(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-orange-500 cursor-pointer"
                    >
                      {mapPoolList.map((mId) => {
                        const found = DEFAULT_MAP_OPTIONS.find((o) => o.id === mId);
                        return (
                          <option key={mId} value={mId}>
                            {found ? found.name : mId}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Workshop Map ID */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Или Steam Workshop ID (опционально):
                    </label>
                    <input
                      type="text"
                      placeholder="Например: 3070549948"
                      value={customWorkshopId}
                      onChange={(e) => setCustomWorkshopId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Options */}
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-700 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={knifeRound}
                      onChange={(e) => setKnifeRound(e.target.checked)}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span>Ножевой раунд (.knife)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={practiceMode}
                      onChange={(e) => setPracticeMode(e.target.checked)}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span>Режим тренировки / без вайтлиста</span>
                  </label>
                </div>

                {/* Launch Button */}
                <button
                  type="button"
                  onClick={handleLaunchServer}
                  disabled={isLaunchingServer || !isAgentOnline}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-md shadow-orange-500/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLaunchingServer ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Запуск сервера CS2 на ПК...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      Запустить сервер CS2 на ПК клуба
                    </>
                  )}
                </button>

                {!isAgentOnline && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Агент DashMatch на ПК клуба сейчас не на связи. Запустите <strong>dashmatch.exe</strong> на выделенном компьютере, и сервер запустится автоматически.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* MANUAL GAME ENTRY (FIFA/UFC/OTHER) */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200/80">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 block text-center truncate">
                  {compA?.display_name || "Команда 1"}
                </label>
                <input
                  type="number"
                  value={score1}
                  onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-center font-black text-xl text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 block text-center truncate">
                  {compB?.display_name || "Команда 2"}
                </label>
                <input
                  type="number"
                  value={score2}
                  onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-center font-black text-xl text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <button
              onClick={handleFinishMatch}
              disabled={isSubmittingScore}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-wider py-4 rounded-xl transition-all shadow-md shadow-orange-500/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmittingScore ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить Результат"}
            </button>
          </div>
        )}

        {/* SCHEDULE & TECHNICAL FORFEIT (ТП) */}
        <div className="space-y-3 pt-2">
          {/* Match Schedule */}
          <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
            <input
              type="datetime-local"
              value={matchScheduledAt}
              onChange={(e) => setMatchScheduledAt(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-orange-500"
            />
            <button
              type="button"
              onClick={handleUpdateMatchSchedule}
              disabled={isUpdatingSchedule}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {isUpdatingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Время</span>
            </button>
          </div>

          {/* Technical Forfeit Buttons */}
          {match.competitor_a_id && match.competitor_b_id && (
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-xs">
              <span className="font-bold text-rose-700 flex items-center gap-1">
                <Flag className="w-3.5 h-3.5 text-rose-500" />
                Тех. победа:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTechWin(match.competitor_a_id!, compB?.display_name || "Команда 2")}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  Победа {compA?.display_name || "Команда 1"}
                </button>
                <button
                  type="button"
                  onClick={() => handleTechWin(match.competitor_b_id!, compA?.display_name || "Команда 1")}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  Победа {compB?.display_name || "Команда 2"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="w-full text-center text-slate-400 hover:text-slate-800 text-xs font-bold uppercase tracking-wider py-2 transition-colors cursor-pointer"
        >
          Закрыть окно
        </button>

      </div>
    </div>
  );
}
