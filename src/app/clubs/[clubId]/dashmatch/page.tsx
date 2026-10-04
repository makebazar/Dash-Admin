"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Gamepad2,
  Server,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Play,
  Square,
  Pause,
  FastForward,
  RotateCcw,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  Users,
  Layers,
  AlertCircle,
  CheckCircle2,
  Terminal,
  Bot,
  Trophy,
  Swords,
  Flame,
  ExternalLink,
  Shield,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface AgentStatus {
  is_online: boolean;
  lan_ip: string;
  base_port: number;
  max_instances: number;
  instances: Array<{
    id: string;
    match_id: string;
    port: number;
    map: string;
    state: string;
    pid: number;
  }>;
  last_heartbeat: string | null;
}

interface MatchRecord {
  id: string;
  map_name: string;
  match_format: string;
  team1_name: string;
  team2_name: string;
  status: string;
  port: number;
  server_ip: string;
  score1: number;
  score2: number;
  created_at: string;
  rcon_last_command?: string;
  rcon_last_response?: string;
  game_state?: string;
  config_data?: {
    knife_round?: boolean;
    practice_mode?: boolean;
    friendly_fire?: boolean;
    bot_test?: boolean;
    team1_players?: Record<string, string>;
    team2_players?: Record<string, string>;
  };
}

const MAP_OPTIONS = [
  { id: "de_dust2", name: "Dust II", desc: "Классика соревновательного CS" },
  { id: "de_mirage", name: "Mirage", desc: "Самая популярная соревновательная карта" },
  { id: "de_inferno", name: "Inferno", desc: "Тактические бананы и апартаменты" },
  { id: "de_nuke", name: "Nuke", desc: "Вертикальный геймплей и выходы на улицу" },
  { id: "de_ancient", name: "Ancient", desc: "Джунгли и древние руины" },
  { id: "de_anubis", name: "Anubis", desc: "Водные каналы и быстрые стычки" },
  { id: "de_vertigo", name: "Vertigo", desc: "Небоскреб с двумя этажами" },
];

const FORMAT_OPTIONS = [
  { id: "5v5", name: "5x5", desc: "Соревновательный" },
  { id: "2v2", name: "2x2", desc: "Напарники (Wingman)" },
  { id: "1v1", name: "1x1", desc: "Дуэль (Aim)" },
];

export default function DashMatchPage() {
  const { clubId } = useParams();
  const [activeTab, setActiveTab] = useState<"matches" | "connection">("matches");

  // Agent & Matches data
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pairing code state
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairCodeExpires, setPairCodeExpires] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Match creation state
  const [selectedMap, setSelectedMap] = useState("de_mirage");
  const [selectedFormat, setSelectedFormat] = useState("5v5");
  const [matchMode, setMatchMode] = useState<"comp" | "practice" | "bots">("comp");
  const [knifeRound, setKnifeRound] = useState(true);
  const [friendlyFire, setFriendlyFire] = useState(false);
  const [enableWhitelist, setEnableWhitelist] = useState(false);
  const [team1PlayersRaw, setTeam1PlayersRaw] = useState("");
  const [team2PlayersRaw, setTeam2PlayersRaw] = useState("");
  const [team1Name, setTeam1Name] = useState("Команда 1");
  const [team2Name, setTeam2Name] = useState("Команда 2");
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Connect command copied states
  const [copiedConnectId, setCopiedConnectId] = useState<string | null>(null);

  // RCON state per match
  const [rconInputs, setRconInputs] = useState<Record<string, string>>({});
  const [rconLoading, setRconLoading] = useState<Record<string, boolean>>({});

  const fetchStatus = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/status`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data.agent || null);
        setMatches(data.matches || []);
      }
    } catch (err) {
      console.error("Error fetching CS2 status:", err);
    } finally {
      setIsLoading(false);
      if (showIndicator) setIsRefreshing(false);
    }
  }, [clubId]);

  useEffect(() => {
    if (!clubId) return;
    fetchStatus();
    // Poll every 3 seconds for live match updates and RCON responses
    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [clubId, fetchStatus]);

  // Generate 6-digit code
  const handleGeneratePairCode = async () => {
    setIsGeneratingCode(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/pair-code`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.code) {
        setPairCode(data.code);
        setPairCodeExpires(data.expires_at);
      } else {
        alert(data.error || "Не удалось сгенерировать код");
      }
    } catch (err) {
      alert("Ошибка запроса при генерации кода");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const copyToClipboard = (text: string, onDone: () => void) => {
    navigator.clipboard.writeText(text);
    onDone();
  };

  // Helper to parse SteamID list
  const parsePlayersList = (text: string): Record<string, string> => {
    const res: Record<string, string> = {};
    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[\s,;:]+/);
      const steamId = parts[0];
      const name = parts.slice(1).join(" ") || `Player_${steamId.slice(-4)}`;
      if (steamId.length >= 10) {
        res[steamId] = name;
      }
    }
    return res;
  };

  // Launch Match
  const handleLaunchMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLaunching(true);
    setLaunchMessage(null);

    try {
      const team1Players = enableWhitelist ? parsePlayersList(team1PlayersRaw) : {};
      const team2Players = enableWhitelist ? parsePlayersList(team2PlayersRaw) : {};

      const res = await fetch(`/api/clubs/${clubId}/cs2/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          map_name: selectedMap,
          format: selectedFormat,
          team1_name: team1Name.trim() || "Команда 1",
          team2_name: team2Name.trim() || "Команда 2",
          knife_round: matchMode === "comp" ? knifeRound : false,
          practice_mode: matchMode === "practice",
          friendly_fire: friendlyFire,
          bot_test: matchMode === "bots",
          team1_players: team1Players,
          team2_players: team2Players,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLaunchMessage({
          type: "success",
          text: `Сервер запущен! Команда подключения: ${data.connect_command}`,
        });

        // If bots test mode, auto-add bots after 6 seconds
        if (matchMode === "bots") {
          setTimeout(() => {
            handleSendRcon(data.match_id, "bot_quota 10; bot_add ct; bot_add t; bot_difficulty 1");
          }, 6000);
        }

        await fetchStatus(true);
      } else {
        setLaunchMessage({
          type: "error",
          text: data.error || "Не удалось отправить команду на запуск сервера",
        });
      }
    } catch (err) {
      setLaunchMessage({
        type: "error",
        text: "Сетевая ошибка при запуске матча",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  // Stop Match
  const handleStopMatch = async (matchId: string) => {
    if (!confirm("Остановить игровой сервер CS2 для этого матча?")) return;

    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/matches/${matchId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchStatus(true);
      }
    } catch (err) {
      console.error("Error stopping match:", err);
    }
  };

  // Send RCON Command
  const handleSendRcon = async (matchId: string, cmdToSend?: string) => {
    const cmd = (cmdToSend || rconInputs[matchId] || "").trim();
    if (!cmd) return;

    setRconLoading((prev) => ({ ...prev, [matchId]: true }));
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/rcon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, command: cmd }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Ошибка отправки RCON");
      } else {
        if (!cmdToSend) {
          setRconInputs((prev) => ({ ...prev, [matchId]: "" }));
        }
        await fetchStatus(true);
      }
    } catch (e) {
      alert("Сетевая ошибка при отправке RCON");
    } finally {
      setRconLoading((prev) => ({ ...prev, [matchId]: false }));
    }
  };

  const isAgentOnline = agent?.is_online ?? false;

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-zinc-950 p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  DashMatch
                </h1>
                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                  CS2 MatchZy Controller
                </Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Управление соревновательными серверами, матчами и турнирными слотами CS2 в клубе
              </p>
            </div>
          </div>
        </div>

        {/* Server Agent Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xs">
            {isAgentOnline ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div className="text-xs">
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Сервер в сети (LAN: {agent?.lan_ip || "127.0.0.1"})
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Активно серверов: {agent?.instances?.length || 0} / {agent?.max_instances || 4}
                  </div>
                </div>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-amber-500" />
                <div className="text-xs">
                  <div className="font-semibold text-amber-600 dark:text-amber-400">
                    Агент не подключен
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Запустите dashmatch.exe на сервере клуба
                  </div>
                </div>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchStatus(true)}
            disabled={isRefreshing}
            className="h-9 px-3 gap-1.5 text-xs text-slate-600 dark:text-zinc-300 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-2">
        <button
          onClick={() => setActiveTab("matches")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "matches"
              ? "border-orange-500 text-orange-600 dark:text-orange-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Play className="w-4 h-4" />
          Создание & Управление матчами
          {matches.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[11px] h-5 px-1.5">
              {matches.length}
            </Badge>
          )}
        </button>

        <button
          onClick={() => setActiveTab("connection")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "connection"
              ? "border-orange-500 text-orange-600 dark:text-orange-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Server className="w-4 h-4" />
          Связь с сервером клуба
          {!isAgentOnline && (
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          )}
        </button>
      </div>

      {/* TAB 1: MATCHES MANAGEMENT */}
      {activeTab === "matches" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Create Match Form */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-slate-200/80 dark:border-zinc-800 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Play className="w-4 h-4 text-orange-500" />
                  Создать и запустить матч
                </CardTitle>
                <CardDescription className="text-xs">
                  Автоматический запуск сервера CS2 с плагином MatchZy и выбранным сценарием
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLaunchMatch} className="space-y-4">
                  {/* Mode Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Сценарий игры:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setMatchMode("comp")}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          matchMode === "comp"
                            ? "border-orange-500 bg-orange-500 text-white font-bold shadow-xs"
                            : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                        }`}
                      >
                        <Trophy className="w-4 h-4" />
                        <span className="text-xs">Матч 5x5</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMatchMode("bots")}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          matchMode === "bots"
                            ? "border-orange-500 bg-orange-500 text-white font-bold shadow-xs"
                            : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                        }`}
                      >
                        <Bot className="w-4 h-4" />
                        <span className="text-xs">Тест с ботами</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMatchMode("practice")}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          matchMode === "practice"
                            ? "border-orange-500 bg-orange-500 text-white font-bold shadow-xs"
                            : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                        }`}
                      >
                        <Zap className="w-4 h-4" />
                        <span className="text-xs">Тренировка</span>
                      </button>
                    </div>
                  </div>

                  {/* Map Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Карта матча:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {MAP_OPTIONS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMap(m.id)}
                          className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            selectedMap === m.id
                              ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-950 dark:text-orange-100 font-medium"
                              : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                          }`}
                        >
                          <div className="text-xs font-bold">{m.name}</div>
                          <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Format Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Формат состава:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {FORMAT_OPTIONS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setSelectedFormat(f.id)}
                          className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                            selectedFormat === f.id
                              ? "border-orange-500 bg-orange-500 text-white font-bold"
                              : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-slate-300 text-xs"
                          }`}
                        >
                          <div className="text-xs font-bold">{f.id}</div>
                          <div className="text-[10px] opacity-80">{f.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Teams */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                        Команда 1 (CT)
                      </label>
                      <Input
                        value={team1Name}
                        onChange={(e) => setTeam1Name(e.target.value)}
                        placeholder="Team Spirit Local"
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                        Команда 2 (T)
                      </label>
                      <Input
                        value={team2Name}
                        onChange={(e) => setTeam2Name(e.target.value)}
                        placeholder="Cloud9 Local"
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                  </div>

                  {/* MatchZy Rule Toggles */}
                  <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800 space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                      Правила & MatchZy настройки
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={knifeRound && matchMode !== "practice"}
                          disabled={matchMode === "practice"}
                          onChange={(e) => setKnifeRound(e.target.checked)}
                          className="rounded text-orange-600 focus:ring-orange-500 h-3.5 w-3.5"
                        />
                        <span className="flex items-center gap-1 text-[11px]">
                          <Swords className="w-3.5 h-3.5 text-orange-500" />
                          Ножевой раунд
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={friendlyFire}
                          onChange={(e) => setFriendlyFire(e.target.checked)}
                          className="rounded text-orange-600 focus:ring-orange-500 h-3.5 w-3.5"
                        />
                        <span className="flex items-center gap-1 text-[11px]">
                          <Flame className="w-3.5 h-3.5 text-red-500" />
                          Огонь по своим
                        </span>
                      </label>
                    </div>

                    <div className="pt-1 border-t border-slate-200 dark:border-zinc-800">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enableWhitelist}
                          onChange={(e) => setEnableWhitelist(e.target.checked)}
                          className="rounded text-orange-600 focus:ring-orange-500 h-3.5 w-3.5"
                        />
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                          <Shield className="w-3.5 h-3.5 text-indigo-500" />
                          Вайтлист по SteamID64 (строгий вход)
                        </span>
                      </label>

                      {enableWhitelist && (
                        <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400">SteamID64 Команды 1:</span>
                            <textarea
                              rows={3}
                              placeholder="76561198012345678 Player1&#10;76561198012345679 Player2"
                              value={team1PlayersRaw}
                              onChange={(e) => setTeam1PlayersRaw(e.target.value)}
                              className="w-full text-[10px] p-1.5 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400">SteamID64 Команды 2:</span>
                            <textarea
                              rows={3}
                              placeholder="76561198098765431 Player3&#10;76561198098765432 Player4"
                              value={team2PlayersRaw}
                              onChange={(e) => setTeam2PlayersRaw(e.target.value)}
                              className="w-full text-[10px] p-1.5 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notification banner */}
                  {launchMessage && (
                    <div
                      className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                        launchMessage.type === "success"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                      }`}
                    >
                      {launchMessage.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <span>{launchMessage.text}</span>
                    </div>
                  )}

                  {!isAgentOnline && (
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>
                        Агент на ПК клуба сейчас не в сети. Команда будет выполнена, как только агент подключится.
                      </span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLaunching}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-10 gap-2 cursor-pointer transition-all shadow-xs"
                  >
                    {isLaunching ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-white" />
                    )}
                    {isLaunching ? "Запуск сервера..." : "Создать и запустить матч"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Active & Recent Matches */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-500" />
                Матчи клуба ({matches.length})
              </h2>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Авто-обновление каждые 3 сек
              </span>
            </div>

            {matches.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 dark:border-zinc-800 text-center py-12">
                <CardContent className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-900 text-slate-400 mx-auto flex items-center justify-center">
                    <Gamepad2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                      Матчей пока нет
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Создайте первый матч через форму слева, чтобы запустить выделенный сервер CS2
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {matches.map((m) => {
                  const connectCmd = `connect ${m.server_ip || agent?.lan_ip || "127.0.0.1"}:${m.port || 27015}`;
                  const steamConnectUrl = `steam://connect/${m.server_ip || agent?.lan_ip || "127.0.0.1"}:${m.port || 27015}`;
                  const isLive = m.status === "live" || m.status === "starting" || m.status === "warmup";
                  const isBusyRcon = Boolean(rconLoading[m.id]);

                  return (
                    <Card
                      key={m.id}
                      className={`border transition-all ${
                        isLive
                          ? "border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs"
                          : "border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                      }`}
                    >
                      <CardContent className="p-4 space-y-3.5">
                        {/* Top Match Header */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`text-[11px] font-semibold ${
                                m.status === "live"
                                  ? "bg-emerald-500 text-white"
                                  : m.status === "starting"
                                  ? "bg-amber-500 text-white"
                                  : m.status === "warmup"
                                  ? "bg-blue-500 text-white"
                                  : m.status === "stopped"
                                  ? "bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                                  : "bg-slate-300 text-slate-800"
                              }`}
                            >
                              {m.status === "live"
                                ? "В игре"
                                : m.status === "starting"
                                ? "Запуск сервера..."
                                : m.status === "warmup"
                                ? "Разминка / Ножевой"
                                : m.status === "stopped"
                                ? "Остановлен"
                                : m.status}
                            </Badge>

                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              {m.team1_name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 font-mono font-bold text-xs">
                              {m.score1} : {m.score2}
                            </span>
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              {m.team2_name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] text-slate-600 dark:text-zinc-400 font-mono">
                              {m.map_name} • {m.match_format} • Port {m.port || 27015}
                            </Badge>

                            {isLive && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleStopMatch(m.id)}
                                className="h-7 px-2 text-[11px] gap-1 cursor-pointer"
                              >
                                <Square className="w-3 h-3 fill-white" />
                                Стоп
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Connect Bar for Players */}
                        <div className="flex items-center justify-between bg-slate-900 text-slate-200 rounded-lg p-2.5 text-xs font-mono gap-2 flex-wrap">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-slate-400 select-none text-[11px]">Вход:</span>
                            <span className="text-emerald-400 font-semibold truncate">{connectCmd}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <a
                              href={steamConnectUrl}
                              className="inline-flex items-center gap-1 h-6 px-2 text-[10px] rounded bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold cursor-pointer transition-all"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Зайти в игру
                            </a>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                copyToClipboard(connectCmd, () => {
                                  setCopiedConnectId(m.id);
                                  setTimeout(() => setCopiedConnectId(null), 2000);
                                })
                              }
                              className="h-6 px-2 text-[10px] gap-1 shrink-0 bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                            >
                              {copiedConnectId === m.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  Скопировано
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  Копировать
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Live MatchZy Controls (Quick RCON Buttons) */}
                        {isLive && (
                          <div className="p-2.5 rounded-lg bg-slate-100/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-2">
                            <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Terminal className="w-3.5 h-3.5 text-orange-500" />
                                Управление матчем MatchZy (RCON):
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                Мгновенное выполнение
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusyRcon}
                                onClick={() => handleSendRcon(m.id, "matchzy_start")}
                                className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50"
                                title="Пропустить разминку и ожидание .ready, начать игру"
                              >
                                <FastForward className="w-3 h-3 text-emerald-500" />
                                Начать принудительно
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusyRcon}
                                onClick={() => handleSendRcon(m.id, "matchzy_forcepause")}
                                className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-amber-700 dark:text-amber-400"
                                title="Поставить админскую паузу"
                              >
                                <Pause className="w-3 h-3 text-amber-500" />
                                Пауза
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusyRcon}
                                onClick={() => handleSendRcon(m.id, "matchzy_forceunpause")}
                                className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer"
                                title="Снять паузу"
                              >
                                <Play className="w-3 h-3 text-blue-500" />
                                Снять паузу
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusyRcon}
                                onClick={() => handleSendRcon(m.id, "matchzy_restart")}
                                className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer"
                                title="Рестарт матча"
                              >
                                <RotateCcw className="w-3 h-3 text-slate-500" />
                                Рестарт
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusyRcon}
                                onClick={() => handleSendRcon(m.id, "bot_quota 10; bot_add ct; bot_add t")}
                                className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer"
                                title="Заполнить сервер ботами для теста"
                              >
                                <Bot className="w-3 h-3 text-purple-500" />
                                +Боты
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusyRcon}
                                onClick={() => handleSendRcon(m.id, "bot_kick")}
                                className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer"
                                title="Кикнуть всех ботов"
                              >
                                Кикнуть ботов
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusyRcon}
                                onClick={() => handleSendRcon(m.id, "matchzy_endmatch team1")}
                                className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer"
                                title="Присудить победу Команде 1"
                              >
                                <Trophy className="w-3 h-3 text-amber-500" />
                                ТП Команда 1
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusyRcon}
                                onClick={() => handleSendRcon(m.id, "matchzy_endmatch team2")}
                                className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer"
                                title="Присудить победу Команде 2"
                              >
                                <Trophy className="w-3 h-3 text-amber-500" />
                                ТП Команда 2
                              </Button>
                            </div>

                            {/* Custom RCON Input */}
                            <div className="flex items-center gap-2 pt-1">
                              <Input
                                placeholder="Любая команда CS2 RCON: status, mp_restartgame 1, changelevel de_dust2..."
                                value={rconInputs[m.id] || ""}
                                onChange={(e) =>
                                  setRconInputs((prev) => ({ ...prev, [m.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSendRcon(m.id);
                                  }
                                }}
                                className="h-7 text-xs font-mono bg-white dark:bg-zinc-800"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSendRcon(m.id)}
                                disabled={isBusyRcon || !rconInputs[m.id]}
                                className="h-7 px-3 text-xs bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shrink-0"
                              >
                                {isBusyRcon ? "..." : "Отправить"}
                              </Button>
                            </div>

                            {/* Last RCON Response */}
                            {m.rcon_last_response && (
                              <div className="mt-2 p-2 rounded bg-slate-950 text-slate-200 font-mono text-[11px] max-h-32 overflow-y-auto whitespace-pre-wrap leading-tight border border-slate-800">
                                <div className="text-[10px] text-slate-500 mb-0.5">
                                  Ответ на `{m.rcon_last_command}`:
                                </div>
                                {m.rcon_last_response}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 pt-1 border-t border-slate-100 dark:border-zinc-800">
                          <div>ID матча: {m.id}</div>
                          <div>Порт: {m.port || 27015}</div>
                          <div>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SERVER CONNECTION & 6-DIGIT CODE */}
      {activeTab === "connection" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: 6-Digit Pairing Code */}
          <Card className="border-slate-200/80 dark:border-zinc-800 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <KeyRound className="w-4 h-4 text-orange-500" />
                Привязка сервера клуба к DashAdmin
              </CardTitle>
              <CardDescription className="text-xs">
                Сгенерируйте временный 6-значный код и введите его в консоли DashMatch на серверном ПК
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pairCode ? (
                <div className="p-6 rounded-2xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 text-center space-y-3">
                  <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold uppercase tracking-wider">
                    Код привязки (действителен 30 мин):
                  </div>
                  <div className="text-4xl md:text-5xl font-black font-mono tracking-widest text-slate-900 dark:text-white">
                    {pairCode.slice(0, 3)} {pairCode.slice(3)}
                  </div>
                  <div className="flex justify-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(pairCode, () => {
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        })
                      }
                      className="gap-1.5 text-xs cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode ? "Скопировано!" : "Скопировать код"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGeneratePairCode}
                      disabled={isGeneratingCode}
                      className="text-xs cursor-pointer text-slate-500"
                    >
                      Сгенерировать новый
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 mx-auto flex items-center justify-center">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                      Код привязки не сгенерирован
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Нажмите кнопку ниже, чтобы получить одноразовый 6-значный пин-код
                    </p>
                  </div>
                  <Button
                    onClick={handleGeneratePairCode}
                    disabled={isGeneratingCode}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-9 gap-2 cursor-pointer transition-all shadow-xs"
                  >
                    {isGeneratingCode ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5" />
                    )}
                    Сгенерировать 6-значный код
                  </Button>
                </div>
              )}

              {/* Instructions */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800/60 space-y-2.5 text-xs">
                <div className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Как подключить сервер за 1 минуту:
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-zinc-400 leading-relaxed">
                  <li>Запустите файл <code className="font-mono bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">dashmatch.exe</code> на серверном ПК клуба.</li>
                  <li>В главном меню выберите пункт <code className="font-mono font-bold">[1]</code> и введите 6-значный код выше.</li>
                  <li>После привязки выберите пункт <code className="font-mono font-bold">[2]</code> для запуска фоновой службы. Статус сервера станет зеленым!</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Card: Server Info & Hardware Slots */}
          <Card className="border-slate-200/80 dark:border-zinc-800 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Server className="w-4 h-4 text-orange-500" />
                Сетевой статус и слоты инстансов
              </CardTitle>
              <CardDescription className="text-xs">
                Текущие параметры ПК, где запущен агент DashMatch
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] text-slate-400">Локальный IP клуба (LAN)</div>
                  <div className="text-base font-bold font-mono text-slate-800 dark:text-zinc-200 mt-0.5">
                    {agent?.lan_ip || "—"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] text-slate-400">Пул портов серверов</div>
                  <div className="text-base font-bold font-mono text-slate-800 dark:text-zinc-200 mt-0.5">
                    {agent?.base_port ? `${agent.base_port} - ${agent.base_port + (agent.max_instances || 4) - 1}` : "—"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] text-slate-400">Лимит одновременных серверов</div>
                  <div className="text-base font-bold text-slate-800 dark:text-zinc-200 mt-0.5">
                    до {agent?.max_instances || 4} матчей
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                  <div className="text-[11px] text-slate-400">Последний пинг агента</div>
                  <div className="text-base font-bold text-slate-800 dark:text-zinc-200 mt-0.5">
                    {agent?.last_heartbeat
                      ? new Date(agent.last_heartbeat).toLocaleTimeString()
                      : "Нет связи"}
                  </div>
                </div>
              </div>

              {/* Running Instances details */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Запущенные инстансы CS2 на ПК:
                </div>
                {agent?.instances && agent.instances.length > 0 ? (
                  <div className="space-y-2">
                    {agent.instances.map((inst) => (
                      <div
                        key={inst.id}
                        className="p-3 rounded-lg bg-slate-100/70 dark:bg-zinc-900 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="font-bold">{inst.id}</span>
                          <span className="text-slate-400">PID: {inst.pid}</span>
                        </div>
                        <div className="text-slate-600 dark:text-zinc-400">
                          Порт: {inst.port} • Карта: {inst.map}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 text-center">
                    Нет активных процессов CS2
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
