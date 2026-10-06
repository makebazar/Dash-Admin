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
  ArrowLeftRight,
  History,
  UserPlus,
  UserMinus,
  Sliders,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Target,
  Edit2,
  Plus,
  Trash2,
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
    warmup_time?: number;
    team1_players?: Record<string, string>;
    team2_players?: Record<string, string>;
  };
}

import { parseCs2StatusPlayers } from "@/lib/cs2/utils";

interface LivePlayer {
  id?: string;
  name: string;
  steamId: string;
  ping?: string;
  isBot?: boolean;
}

function parseConnectedPlayers(rconText?: string): LivePlayer[] {
  return parseCs2StatusPlayers(rconText);
}

interface MapOption {
  id: string;
  name: string;
  desc: string;
  badge: string;
  isCustom?: boolean;
  customRecordId?: number;
}

interface CustomMapRecord {
  id: number;
  club_id: number;
  map_id: string;
  name: string;
  description: string;
  match_format: string;
  created_at: string;
}

const MAP_CATALOG: Record<string, MapOption[]> = {
  "5v5": [
    { id: "de_mirage", name: "Mirage", desc: "Главный соревновательный выбор, открытые пленты", badge: "Турнирная" },
    { id: "de_dust2", name: "Dust II", desc: "Золотая классика CS, сбалансированный темп", badge: "Классика" },
    { id: "de_inferno", name: "Inferno", desc: "Тактический контроль банана и апартаментов", badge: "Турнирная" },
    { id: "de_nuke", name: "Nuke", desc: "Двухуровневый комплекс, улица и рампа", badge: "Турнирная" },
    { id: "de_ancient", name: "Ancient", desc: "Древние руины майя и джунгли", badge: "Турнирная" },
    { id: "de_anubis", name: "Anubis", desc: "Водные каналы, арки и быстрый размен", badge: "Турнирная" },
    { id: "de_vertigo", name: "Vertigo", desc: "Высотный небоскрёб с двумя этажами", badge: "Турнирная" },
    { id: "cs_office", name: "Office", desc: "Зимний офис, освобождение заложников", badge: "Заложники" },
    { id: "cs_italy", name: "Italy", desc: "Итальянские улочки и винный погреб", badge: "Заложники" },
    { id: "workshop", name: "Разовый ID из Мастерской", desc: "Ввести произвольный ID из Steam", badge: "Workshop" },
  ],
  "2v2": [
    { id: "de_inferno", name: "Inferno (Плент B)", desc: "Напарники: Банан, церковь и плент B", badge: "Wingman" },
    { id: "de_nuke", name: "Nuke (Плент B)", desc: "Напарники: Спуск, рампа и плент B", badge: "Wingman" },
    { id: "de_vertigo", name: "Vertigo (Плент B)", desc: "Напарники: Рампа и открытый плент B", badge: "Wingman" },
    { id: "de_overpass", name: "Overpass (Плент B)", desc: "Напарники: Монстр, токсик, шорт и B", badge: "Wingman" },
    { id: "de_dust2", name: "Dust II (Шорт & A)", desc: "Напарники: Зигзаг, лонг и плент A", badge: "Wingman" },
    { id: "de_anubis", name: "Anubis (Плент B)", desc: "Напарники: Водный канал и плент B", badge: "Wingman" },
    { id: "workshop", name: "Разовый ID из Мастерской", desc: "Ввести произвольный ID из Steam", badge: "Workshop" },
  ],
  "1v1": [
    { id: "de_inferno", name: "Inferno (Арена Плент B)", desc: "Компактная дуэль 1x1 с барьерами: Банан и B", badge: "Wingman B" },
    { id: "de_nuke", name: "Nuke (Арена Плент B)", desc: "Компактная дуэль 1x1 с барьерами: Рампа и B", badge: "Wingman B" },
    { id: "de_vertigo", name: "Vertigo (Арена Плент B)", desc: "Компактная дуэль 1x1 с барьерами: Рампа и B", badge: "Wingman B" },
    { id: "de_overpass", name: "Overpass (Арена Плент B)", desc: "Компактная дуэль 1x1 с барьерами: Монстр и B", badge: "Wingman B" },
    { id: "3070549948", name: "Aim Map", desc: "Классическая дуэльная арена (Steam Workshop)", badge: "Workshop" },
    { id: "3810240726", name: "AWP Lego 2", desc: "Популярная дуэль на снайперках (Steam Workshop)", badge: "Workshop" },
    { id: "3070244462", name: "Aim Botz", desc: "Популярная разминочная арена (Steam Workshop)", badge: "Workshop" },
    { id: "de_dust2", name: "Dust II", desc: "Вся карта без ограничений", badge: "Вся карта" },
    { id: "de_mirage", name: "Mirage", desc: "Вся карта без ограничений", badge: "Вся карта" },
    { id: "workshop", name: "Разовый ID из Мастерской", desc: "Ввести произвольный ID из Steam", badge: "Workshop" },
  ],
};

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
  const [selectedFormat, setSelectedFormat] = useState("5v5");
  const [selectedMap, setSelectedMap] = useState("de_mirage");
  const [workshopId, setWorkshopId] = useState("");
  const [matchMode, setMatchMode] = useState<"comp" | "practice" | "bots">("comp");
  const [knifeRound, setKnifeRound] = useState(true);
  const [friendlyFire, setFriendlyFire] = useState(false);
  const [warmupSeconds, setWarmupSeconds] = useState(60);
  const [enableWhitelist, setEnableWhitelist] = useState(false);
  const [team1PlayersRaw, setTeam1PlayersRaw] = useState("");
  const [team2PlayersRaw, setTeam2PlayersRaw] = useState("");
  const [team1Name, setTeam1Name] = useState("Команда 1");
  const [team2Name, setTeam2Name] = useState("Команда 2");
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Connect command copied states
  const [copiedConnectId, setCopiedConnectId] = useState<string | null>(null);

  // In-match control state per match
  const [matchControlTab, setMatchControlTab] = useState<Record<string, "quick" | "restore" | "players" | "finish" | "console">>({});
  const [restoreRoundInput, setRestoreRoundInput] = useState<Record<string, string>>({});
  const [addPlayerSteamId, setAddPlayerSteamId] = useState<Record<string, string>>({});
  const [addPlayerTeam, setAddPlayerTeam] = useState<Record<string, "team1" | "team2" | "spec">>({});
  const [removePlayerSteamId, setRemovePlayerSteamId] = useState<Record<string, string>>({});

  // RCON state per match
  const [rconInputs, setRconInputs] = useState<Record<string, string>>({});
  const [rconLoading, setRconLoading] = useState<Record<string, boolean>>({});

  // Custom club maps from Steam Workshop
  const [customMaps, setCustomMaps] = useState<CustomMapRecord[]>([]);
  const [isAddMapOpen, setIsAddMapOpen] = useState(false);
  const [newMapName, setNewMapName] = useState("");
  const [newMapId, setNewMapId] = useState("");
  const [newMapDesc, setNewMapDesc] = useState("");
  const [newMapFormat, setNewMapFormat] = useState("all");
  const [isSavingCustomMap, setIsSavingCustomMap] = useState(false);
  const [customMapError, setCustomMapError] = useState<string | null>(null);

  const fetchCustomMaps = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/custom-maps`);
      if (res.ok) {
        const data = await res.json();
        setCustomMaps(data.maps || []);
      }
    } catch (err) {
      console.error("Error fetching custom maps:", err);
    }
  }, [clubId]);

  useEffect(() => {
    if (!clubId) return;
    fetchCustomMaps();
  }, [clubId, fetchCustomMaps]);

  const handleSaveCustomMap = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomMapError(null);
    const cleanId = newMapId.trim().replace(/[^0-9]/g, "");
    if (!newMapName.trim() || !cleanId) {
      setCustomMapError("Укажите название и числовой ID карты из Steam Workshop");
      return;
    }
    setIsSavingCustomMap(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/custom-maps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          map_id: cleanId,
          name: newMapName.trim(),
          description: newMapDesc.trim() || "Карта из Steam Workshop",
          match_format: newMapFormat,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchCustomMaps();
        setSelectedMap(data.map.map_id);
        setIsAddMapOpen(false);
        setNewMapName("");
        setNewMapId("");
        setNewMapDesc("");
      } else {
        setCustomMapError(data.error || "Не удалось сохранить карту");
      }
    } catch (err) {
      setCustomMapError("Ошибка сети при сохранении карты");
    } finally {
      setIsSavingCustomMap(false);
    }
  };

  const handleDeleteCustomMap = async (mapRecordId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить эту карту из каталога клуба?")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/custom-maps?id=${mapRecordId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchCustomMaps();
        setSelectedMap("de_mirage");
      }
    } catch (err) {
      console.error("Error deleting custom map:", err);
    }
  };

  const handleFormatSelect = (fmt: string) => {
    setSelectedFormat(fmt);
    const mapsForFormat = MAP_CATALOG[fmt] || MAP_CATALOG["5v5"];
    if (!mapsForFormat.some((m) => m.id === selectedMap)) {
      setSelectedMap(mapsForFormat[0].id);
    }
  };

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

  // Helper to parse SteamID list (supports raw 17-digit SteamID64 or steam community profile URLs)
  const parsePlayersList = (text: string): Record<string, string> => {
    const res: Record<string, string> = {};
    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Extract 17-digit SteamID64 (starts with 7656119) if present anywhere in the line
      const match = trimmed.match(/\b(7656119\d{10})\b/);
      if (match) {
        const steamId = match[1];
        const nameClean = trimmed.replace(match[0], "").replace(/https?:\/\/[^\s]+/g, "").trim();
        const name = nameClean || `Player_${steamId.slice(-4)}`;
        res[steamId] = name;
      } else {
        const parts = trimmed.split(/[\s,;:]+/);
        const steamId = parts[0];
        const name = parts.slice(1).join(" ") || `Player_${steamId.slice(-4)}`;
        if (steamId.length >= 10 && /^\d+$/.test(steamId)) {
          res[steamId] = name;
        }
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
          map_name: selectedMap === "workshop" ? workshopId : selectedMap,
          format: selectedFormat,
          team1_name: team1Name.trim() || "Команда 1",
          team2_name: team2Name.trim() || "Команда 2",
          knife_round: matchMode === "comp" ? knifeRound : false,
          practice_mode: matchMode === "practice",
          friendly_fire: friendlyFire,
          bot_test: matchMode === "bots",
          warmup_time: warmupSeconds,
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

                  {/* Format Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                      <span>Формат состава:</span>
                      <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                        Определяет доступный пул карт
                      </span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {FORMAT_OPTIONS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleFormatSelect(f.id)}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                            selectedFormat === f.id
                              ? "border-orange-500 bg-orange-500 text-white font-bold shadow-xs"
                              : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-slate-300 text-xs"
                          }`}
                        >
                          <div className="text-xs font-bold">{f.name}</div>
                          <div className="text-[10px] opacity-85 truncate">{f.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Map Selector */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Карта ({selectedFormat}):
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddMapOpen(!isAddMapOpen)}
                          className="text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Добавить карту</span>
                        </button>
                      </div>
                    </div>

                    {/* Add Custom Map Form */}
                    {isAddMapOpen && (
                      <div className="p-3 my-2 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-orange-900 dark:text-orange-200">
                            Сохранить карту из Steam Workshop в каталог клуба
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsAddMapOpen(false)}
                            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        {customMapError && (
                          <div className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                            {customMapError}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-zinc-400 block mb-1">
                              Название карты
                            </label>
                            <Input
                              value={newMapName}
                              onChange={(e) => setNewMapName(e.target.value)}
                              placeholder="Например: AWP India"
                              className="h-7 text-xs bg-white dark:bg-zinc-900"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-zinc-400 block mb-1">
                              Steam Workshop ID (цифры)
                            </label>
                            <Input
                              value={newMapId}
                              onChange={(e) => setNewMapId(e.target.value.replace(/[^0-9]/g, ""))}
                              placeholder="Например: 3070244462"
                              className="h-7 text-xs font-mono bg-white dark:bg-zinc-900"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-zinc-400 block mb-1">
                              Описание (опционально)
                            </label>
                            <Input
                              value={newMapDesc}
                              onChange={(e) => setNewMapDesc(e.target.value)}
                              placeholder="Дуэль на снайперках"
                              className="h-7 text-xs bg-white dark:bg-zinc-900"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-zinc-400 block mb-1">
                              Для какого формата
                            </label>
                            <select
                              value={newMapFormat}
                              onChange={(e) => setNewMapFormat(e.target.value)}
                              className="w-full h-7 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md px-2 outline-none"
                            >
                              <option value="all">Для всех форматов</option>
                              <option value="1v1">Только 1x1</option>
                              <option value="2v2">Только 2x2</option>
                              <option value="5v5">Только 5x5</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsAddMapOpen(false)}
                            className="h-7 text-xs"
                          >
                            Отмена
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveCustomMap}
                            disabled={isSavingCustomMap}
                            className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            {isSavingCustomMap ? "Сохранение..." : "Сохранить карту"}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {[
                        ...(MAP_CATALOG[selectedFormat] || MAP_CATALOG["5v5"]),
                        ...customMaps
                          .filter((cm) => cm.match_format === "all" || cm.match_format === selectedFormat)
                          .map((cm) => ({
                            id: cm.map_id,
                            name: cm.name,
                            desc: cm.description || `ID: ${cm.map_id}`,
                            badge: "Моя карта",
                            isCustom: true,
                            customRecordId: cm.id,
                          })),
                      ].map((m) => (
                        <div
                          key={m.isCustom ? `custom-${m.customRecordId}` : m.id}
                          onClick={() => setSelectedMap(m.id)}
                          className={`p-2 rounded-lg border text-left transition-all cursor-pointer relative group ${
                            selectedMap === m.id
                              ? "border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 text-orange-950 dark:text-orange-100 font-medium shadow-xs"
                              : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold truncate">{m.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                                  m.isCustom
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300"
                                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                                }`}
                              >
                                {m.badge}
                              </span>
                              {m.isCustom && m.customRecordId && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteCustomMap(m.customRecordId!, e)}
                                  title="Удалить из каталога"
                                  className="text-slate-400 hover:text-red-500 p-0.5 rounded cursor-pointer opacity-80 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">{m.desc}</div>
                        </div>
                      ))}
                    </div>

                    {selectedFormat === "1v1" && (
                      <div className="p-2 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300">
                        💡 <strong>Подсказка:</strong> Карты с бейджем <em>Workshop</em> скачиваются сервером CS2 автоматически напрямую из Steam при первом старте. Карты с бейджем <em>Wingman B</em> (Inferno B, Nuke B) имеют официальные барьеры Valve.
                      </div>
                    )}
                    
                    {selectedMap === "workshop" && (
                      <div className="p-3 mt-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50">
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                          ID Карты из Мастерской (Только цифры)
                        </label>
                        <input
                          type="text"
                          value={workshopId}
                          onChange={(e) => setWorkshopId(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="Например: 3070244462"
                          className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md text-sm outline-none focus:border-orange-500 font-mono"
                          required
                        />
                      </div>
                    )}
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

                    {/* Warmup Duration Setting */}
                    <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-orange-500" />
                          Длительность разминки:
                        </span>
                        <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                          {warmupSeconds === 0 ? "Без ограничения (.ready)" : `${warmupSeconds} сек`}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                        {[
                          { label: "30 сек", value: 30 },
                          { label: "60 сек", value: 60 },
                          { label: "2 мин", value: 120 },
                          { label: "До ready", value: 0 },
                        ].map((w) => (
                          <button
                            key={w.value}
                            type="button"
                            onClick={() => setWarmupSeconds(w.value)}
                            className={`py-1 px-1.5 rounded-lg border text-center transition-all cursor-pointer text-[11px] font-medium ${
                              warmupSeconds === w.value
                                ? "border-orange-500 bg-orange-500 text-white font-bold shadow-xs"
                                : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
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
                        <div className="pt-2 space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-slate-600 dark:text-zinc-300">SteamID64 Команды 1 (CT):</span>
                              <textarea
                                rows={3}
                                placeholder="76561198012345678 Player1&#10;76561198012345679 Player2"
                                value={team1PlayersRaw}
                                onChange={(e) => setTeam1PlayersRaw(e.target.value)}
                                className="w-full text-[10px] p-1.5 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-slate-600 dark:text-zinc-300">SteamID64 Команды 2 (T):</span>
                              <textarea
                                rows={3}
                                placeholder="76561198098765431 Player3&#10;76561198098765432 Player4"
                                value={team2PlayersRaw}
                                onChange={(e) => setTeam2PlayersRaw(e.target.value)}
                                className="w-full text-[10px] p-1.5 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono"
                              />
                            </div>
                          </div>
                          <div className="p-2 rounded bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-[10px] text-amber-900 dark:text-amber-200 leading-relaxed">
                            💡 <strong>Как получить SteamID64:</strong>
                            <ul className="list-disc list-inside mt-0.5 space-y-0.5 opacity-90">
                              <li><strong>Способ 1:</strong> В игре CS2 открыть консоль (<code className="font-mono">~</code>) и ввести <code className="font-mono">status</code> — напротив ника скопировать 17-значный номер <code className="font-mono">7656119...</code></li>
                              <li><strong>Способ 2:</strong> В Steam открыть свой профиль → ПКМ → <em>«Скопировать адрес страницы»</em> и вставить ссылку прямо в поле (ID определится автоматически).</li>
                            </ul>
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
                              className={`text-[11px] font-semibold flex items-center gap-1 ${
                                m.game_state === "paused"
                                  ? "bg-amber-500 text-white animate-pulse"
                                  : m.status === "live"
                                  ? "bg-emerald-500 text-white"
                                  : m.status === "starting"
                                  ? "bg-amber-500 text-white"
                                  : m.status === "warmup"
                                  ? "bg-blue-500 text-white"
                                  : m.status === "finished"
                                  ? "bg-purple-600 text-white"
                                  : m.status === "stopped"
                                  ? "bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                                  : "bg-slate-300 text-slate-800"
                              }`}
                            >
                              {m.game_state === "paused" ? (
                                <>
                                  <Pause className="w-3 h-3 fill-white" />
                                  Пауза
                                </>
                              ) : m.status === "live" ? (
                                "В игре"
                              ) : m.status === "starting" ? (
                                "Запуск сервера..."
                              ) : m.status === "warmup" ? (
                                "Разминка / Ножевой"
                              ) : m.status === "finished" ? (
                                "Завершен"
                              ) : m.status === "stopped" ? (
                                "Остановлен"
                              ) : (
                                m.status
                              )}
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

                            {m.status !== "stopped" && (
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

                        {/* In-Match Live Controls (MatchZy Controller) */}
                        {isLive && (() => {
                          const activeControlTab = matchControlTab[m.id] || "quick";
                          const completedRounds = (m.score1 || 0) + (m.score2 || 0);
                          const prevRound = Math.max(1, completedRounds);

                          return (
                            <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 space-y-3">
                              {/* Header & Subtabs */}
                              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/80 dark:border-zinc-800">
                                <div className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                                  <Sliders className="w-3.5 h-3.5 text-orange-500" />
                                  <span>Управление матчем MatchZy</span>
                                </div>

                                <div className="flex items-center gap-1 bg-white/80 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-slate-200/80 dark:border-zinc-700/60 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() => setMatchControlTab((prev) => ({ ...prev, [m.id]: "quick" }))}
                                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                                      activeControlTab === "quick"
                                        ? "bg-orange-500 text-white shadow-xs"
                                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                                    }`}
                                  >
                                    ⚡ Игра
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMatchControlTab((prev) => ({ ...prev, [m.id]: "restore" }))}
                                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                                      activeControlTab === "restore"
                                        ? "bg-orange-500 text-white shadow-xs"
                                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                                    }`}
                                  >
                                    ⏪ Откат раундов
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMatchControlTab((prev) => ({ ...prev, [m.id]: "players" }));
                                      if (m.rcon_last_command !== "status") {
                                        handleSendRcon(m.id, "status");
                                      }
                                    }}
                                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                                      activeControlTab === "players"
                                        ? "bg-orange-500 text-white shadow-xs"
                                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                                    }`}
                                  >
                                    👥 Игроки
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMatchControlTab((prev) => ({ ...prev, [m.id]: "finish" }))}
                                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                                      activeControlTab === "finish"
                                        ? "bg-orange-500 text-white shadow-xs"
                                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                                    }`}
                                  >
                                    🏆 Финал
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMatchControlTab((prev) => ({ ...prev, [m.id]: "console" }))}
                                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                                      activeControlTab === "console"
                                        ? "bg-orange-500 text-white shadow-xs"
                                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                                    }`}
                                  >
                                    💻 RCON
                                  </button>
                                </div>
                              </div>

                              {/* TAB 1: QUICK ACTIONS */}
                              {activeControlTab === "quick" && (
                                <div className="space-y-2.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {m.game_state === "paused" ? (
                                      <Button
                                        size="sm"
                                        disabled={isBusyRcon}
                                        onClick={() => handleSendRcon(m.id, "css_forceunpause")}
                                        className="h-7 px-2.5 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                                        title="Снять принудительную паузу MatchZy"
                                      >
                                        <Play className="w-3 h-3 fill-white" />
                                        Снять паузу
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isBusyRcon}
                                        onClick={() => handleSendRcon(m.id, "css_forcepause")}
                                        className="h-7 px-2.5 text-[11px] gap-1.5 bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 cursor-pointer"
                                        title="Поставить принудительную админскую паузу MatchZy"
                                      >
                                        <Pause className="w-3 h-3 text-amber-500" />
                                        Пауза
                                      </Button>
                                    )}

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "css_tech")}
                                      className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                      title="Техническая пауза MatchZy"
                                    >
                                      <Clock className="w-3 h-3 text-amber-500" />
                                      Тех. пауза
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "css_roundknife")}
                                      className="h-7 px-2 text-[11px] gap-1 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800 hover:bg-orange-100 cursor-pointer font-semibold"
                                      title="Включить / выключить ножевой раунд"
                                    >
                                      <Swords className="w-3 h-3 text-orange-600" />
                                      Ножевой раунд
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "css_forceready")}
                                      className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-blue-700 dark:text-blue-400 hover:bg-blue-50"
                                      title="Подтвердить готовность всех игроков"
                                    >
                                      <ShieldCheck className="w-3 h-3 text-blue-500" />
                                      Все готовы (.ready)
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "css_forceready; css_start; mp_warmup_end 1")}
                                      className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50"
                                      title="Пропустить разминку и начать матч"
                                    >
                                      <FastForward className="w-3 h-3 text-emerald-500" />
                                      Начать матч
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "mp_swapteams 1")}
                                      className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50"
                                      title="Поменять команды сторонами (CT ⇄ T)"
                                    >
                                      <ArrowLeftRight className="w-3 h-3 text-indigo-500" />
                                      Сменить стороны
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "css_prac")}
                                      className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50"
                                      title="Включить режим тренировки (Practice Mode)"
                                    >
                                      <Target className="w-3 h-3 text-cyan-500" />
                                      Тренировка
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "css_match")}
                                      className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-pink-700 dark:text-pink-400 hover:bg-pink-50"
                                      title="Выйти из тренировки в режим матча"
                                    >
                                      <Swords className="w-3 h-3 text-pink-500" />
                                      Режим матча
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => {
                                        const newName = window.prompt("Введите новое название для Команды 1 (CT):");
                                        if (newName && newName.trim()) {
                                          handleSendRcon(m.id, `css_team1 "${newName.trim()}"`);
                                        }
                                      }}
                                      className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                                      title="Переименовать Команду 1"
                                    >
                                      <Edit2 className="w-3 h-3 text-slate-500" />
                                      Имя Команды 1
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => {
                                        const newName = window.prompt("Введите новое название для Команды 2 (T):");
                                        if (newName && newName.trim()) {
                                          handleSendRcon(m.id, `css_team2 "${newName.trim()}"`);
                                        }
                                      }}
                                      className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                                      title="Переименовать Команду 2"
                                    >
                                      <Edit2 className="w-3 h-3 text-slate-500" />
                                      Имя Команды 2
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => {
                                        if (confirm("Перезапустить матч со счета 0:0?")) {
                                          handleSendRcon(m.id, "mp_restartgame 1; css_restart");
                                        }
                                      }}
                                      className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-rose-700 dark:text-rose-400 hover:bg-rose-50"
                                      title="Рестарт матча с 0:0"
                                    >
                                      <RotateCcw className="w-3 h-3 text-rose-500" />
                                      Рестарт
                                    </Button>
                                  </div>

                                  {/* Chat Commands Hint */}
                                  <div className="p-2 rounded-lg bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 text-[11px] text-orange-800 dark:text-orange-300">
                                    💡 <strong>Чат-команды игроков:</strong> Игрокам достаточно написать <code className="font-mono bg-white dark:bg-zinc-800 px-1 py-0.5 rounded text-orange-600 dark:text-orange-400 font-bold">.ready</code> в чате для авто-старта. После ножевого раунда капитан пишет <code className="font-mono bg-white dark:bg-zinc-800 px-1 py-0.5 rounded text-orange-600 dark:text-orange-400 font-bold">.stay</code> (остаться) или <code className="font-mono bg-white dark:bg-zinc-800 px-1 py-0.5 rounded text-orange-600 dark:text-orange-400 font-bold">.swap</code> (поменяться).
                                  </div>

                                  {/* Secondary Quick Toggles */}
                                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60 dark:border-zinc-800/80">
                                    <span className="text-[10px] text-slate-400 mr-1">Параметры:</span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "bot_quota 10; bot_add ct; bot_add t; bot_difficulty 1")}
                                      className="h-6 px-2 text-[10px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer"
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
                                      className="h-6 px-2 text-[10px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-slate-600 dark:text-zinc-400"
                                      title="Кикнуть всех ботов"
                                    >
                                      Кикнуть ботов
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "mp_friendlyfire 1")}
                                      className="h-6 px-2 text-[10px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-red-600 dark:text-red-400"
                                      title="Включить огонь по своим"
                                    >
                                      <Flame className="w-3 h-3 text-red-500" />
                                      FF Вкл
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "mp_friendlyfire 0")}
                                      className="h-6 px-2 text-[10px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer"
                                      title="Отключить огонь по своим"
                                    >
                                      FF Выкл
                                    </Button>
                                  </div>

                                  {/* Warmup Live Controls */}
                                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60 dark:border-zinc-800/80">
                                    <span className="text-[10px] text-slate-400 mr-1 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-orange-500" />
                                      Разминка:
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "mp_warmuptime 30; mp_warmup_pausetimer 0; mp_warmup_start")}
                                      className="h-6 px-2 text-[10px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-slate-700 dark:text-zinc-300"
                                      title="Установить таймер разминки на 30 секунд"
                                    >
                                      30 сек
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "mp_warmuptime 60; mp_warmup_pausetimer 0; mp_warmup_start")}
                                      className="h-6 px-2 text-[10px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-slate-700 dark:text-zinc-300"
                                      title="Установить таймер разминки на 60 секунд (1 мин)"
                                    >
                                      60 сек
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "mp_warmuptime 120; mp_warmup_pausetimer 0; mp_warmup_start")}
                                      className="h-6 px-2 text-[10px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-slate-700 dark:text-zinc-300"
                                      title="Установить таймер разминки на 120 секунд (2 мин)"
                                    >
                                      2 мин
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "mp_warmup_pausetimer 1")}
                                      className="h-6 px-2 text-[10px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-amber-600 dark:text-amber-400"
                                      title="Остановить таймер разминки (разминка без ограничения времени)"
                                    >
                                      Пауза
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "mp_warmup_end 1")}
                                      className="h-6 px-2 text-[10px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-emerald-600 dark:text-emerald-400 font-semibold"
                                      title="Завершить разминку прямо сейчас"
                                    >
                                      Завершить
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* TAB 2: ROUND RESTORE */}
                              {activeControlTab === "restore" && (
                                <div className="space-y-2.5">
                                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                                    MatchZy автоматически сохраняет бэкап в конце каждого раунда матча. Если у игрока завис ПК, вылетела игра или выключилось питание — восстановите точный раунд без потери счёта и экономики!
                                  </div>

                                  {/* Stop / Restore current round */}
                                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 space-y-1.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div>
                                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                          <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
                                          <span>Откатить текущий раунд на начало (.stop)</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          Мгновенный перезапуск идущего сейчас раунда с возвратом закупленного оружия и денег
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        disabled={isBusyRcon}
                                        onClick={() => handleSendRcon(m.id, "css_stop; mp_restartgame 1")}
                                        className="h-7 px-3 text-xs bg-orange-600 hover:bg-orange-700 text-white font-bold cursor-pointer shadow-xs gap-1"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        Откатить текущий раунд
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Specific round restore */}
                                  <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-200/60 dark:border-zinc-800/80">
                                    <Button
                                      size="sm"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, `css_restore ${prevRound}`)}
                                      className="h-7 px-3 text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold gap-1.5 cursor-pointer shadow-xs"
                                    >
                                      <History className="w-3.5 h-3.5" />
                                      Откатить на раунд #{prevRound} (-1 раунд)
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => handleSendRcon(m.id, "matchzy_listbackups")}
                                      className="h-7 px-2.5 text-xs bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 cursor-pointer gap-1"
                                      title="Запросить список всех файлов бэкапов в MatchZy"
                                    >
                                      <Layers className="w-3.5 h-3.5 text-orange-500" />
                                      Список бэкапов
                                    </Button>

                                    <span className="text-[11px] text-slate-500">
                                      Сыграно раундов: <strong className="text-slate-800 dark:text-zinc-200">{completedRounds}</strong>
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-zinc-800/80 flex-wrap">
                                    <span className="text-[11px] text-slate-600 dark:text-zinc-400">
                                      Восстановить раунд по номеру:
                                    </span>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={Math.max(1, completedRounds + 1)}
                                      placeholder={`1..${Math.max(1, completedRounds)}`}
                                      value={restoreRoundInput[m.id] || ""}
                                      onChange={(e) =>
                                        setRestoreRoundInput((prev) => ({ ...prev, [m.id]: e.target.value }))
                                      }
                                      className="w-20 h-7 text-xs font-mono bg-white dark:bg-zinc-800"
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon || !restoreRoundInput[m.id]}
                                      onClick={() => {
                                        const rnd = restoreRoundInput[m.id]?.trim();
                                        if (rnd) {
                                          handleSendRcon(m.id, `css_restore ${rnd}`);
                                        }
                                      }}
                                      className="h-7 px-3 text-xs bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                                    >
                                      Восстановить (css_restore)
                                    </Button>
                                  </div>

                                  {completedRounds > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                      <span className="text-[10px] text-slate-400">Быстрый откат:</span>
                                      {Array.from({ length: Math.min(completedRounds, 24) }, (_, i) => i + 1).map((r) => (
                                        <button
                                          key={r}
                                          type="button"
                                          disabled={isBusyRcon}
                                          onClick={() => handleSendRcon(m.id, `css_restore ${r}`)}
                                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-white dark:bg-zinc-800 hover:bg-orange-500 hover:text-white text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 transition-colors cursor-pointer"
                                        >
                                          Р#{r}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {/* Chat Command Hint */}
                                  <div className="p-2 rounded bg-slate-50 dark:bg-zinc-800/40 text-[10px] text-slate-500 dark:text-zinc-400 border border-slate-200/60 dark:border-zinc-700/60">
                                    💡 Игроки или админ могут также написать в чате игры <code className="font-mono font-bold text-orange-600 dark:text-orange-400">!stop</code> для текущего раунда или <code className="font-mono font-bold text-orange-600 dark:text-orange-400">!restore 2</code> для конкретного раунда.
                                  </div>
                                </div>
                              )}

                              {/* TAB 3: LIVE PLAYERS & WHITELIST */}
                              {activeControlTab === "players" && (() => {
                                const livePlayers = parseConnectedPlayers(m.rcon_last_response);
                                const t1 = m.config_data?.team1_players || {};
                                const t2 = m.config_data?.team2_players || {};
                                const t1Keys = Object.keys(t1);
                                const t2Keys = Object.keys(t2);
                                const hasRoster = t1Keys.length > 0 || t2Keys.length > 0;

                                return (
                                  <div className="space-y-3">
                                    {/* Top Header with live refresh */}
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-zinc-800 gap-2 flex-wrap">
                                      <div className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 text-orange-500" />
                                        <span>Подключенные игроки ({livePlayers.length})</span>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isBusyRcon}
                                        onClick={() => handleSendRcon(m.id, "status")}
                                        className="h-6 px-2.5 text-[10px] gap-1 bg-white dark:bg-zinc-800 cursor-pointer text-slate-700 dark:text-zinc-300 hover:bg-slate-50"
                                        title="Запросить актуальный список подключенных игроков с сервера"
                                      >
                                        <RefreshCw className={`w-3 h-3 ${isBusyRcon ? "animate-spin" : ""}`} />
                                        Обновить список (status)
                                      </Button>
                                    </div>

                                    {/* Section 1: Live Connected Players */}
                                    {livePlayers.length > 0 ? (
                                      <div className="space-y-1.5">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                          На сервере прямо сейчас:
                                        </div>
                                        <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                                          {livePlayers.map((p, idx) => (
                                            <div
                                              key={`${p.steamId}-${idx}`}
                                              className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-800/90 border border-slate-200/80 dark:border-zinc-700/60 text-xs gap-2"
                                            >
                                              <div className="flex items-center gap-2 truncate">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 font-bold text-[10px] shrink-0">
                                                  {p.isBot ? "🤖" : (p.name[0] || "U").toUpperCase()}
                                                </div>
                                                <div className="truncate">
                                                  <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1">
                                                    <span>{p.name}</span>
                                                    {p.isBot && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">Бот</Badge>}
                                                  </div>
                                                  <div className="text-[10px] font-mono text-slate-400 select-all">{p.steamId}</div>
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-1 shrink-0">
                                                {p.ping && (
                                                  <span className="text-[10px] font-mono text-slate-400 mr-1">{p.ping} ms</span>
                                                )}
                                                {!p.isBot && (
                                                  <>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      disabled={isBusyRcon}
                                                      onClick={() => handleSendRcon(m.id, `matchzy_addplayer ${p.steamId} team1 "${p.name}"`)}
                                                      className="h-6 px-1.5 text-[10px] text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 cursor-pointer"
                                                      title={`Пересадить в ${m.team1_name} (CT)`}
                                                    >
                                                      В CT
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      disabled={isBusyRcon}
                                                      onClick={() => handleSendRcon(m.id, `matchzy_addplayer ${p.steamId} team2 "${p.name}"`)}
                                                      className="h-6 px-1.5 text-[10px] text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 cursor-pointer"
                                                      title={`Пересадить в ${m.team2_name} (T)`}
                                                    >
                                                      В T
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      disabled={isBusyRcon}
                                                      onClick={() => handleSendRcon(m.id, `matchzy_addplayer ${p.steamId} spec "${p.name}"`)}
                                                      className="h-6 px-1.5 text-[10px] text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 cursor-pointer"
                                                      title="Пересадить в зрители (Spectator)"
                                                    >
                                                      Спек
                                                    </Button>
                                                  </>
                                                )}
                                                <Button
                                                  size="sm"
                                                  variant="destructive"
                                                  disabled={isBusyRcon}
                                                  onClick={() => {
                                                    if (confirm(`Кикнуть игрока ${p.name}?`)) {
                                                      if (p.isBot) {
                                                        handleSendRcon(m.id, `bot_kick ${p.name}`);
                                                      } else {
                                                        handleSendRcon(m.id, `kick "${p.name}"; matchzy_removeplayer ${p.steamId}`);
                                                      }
                                                    }
                                                  }}
                                                  className="h-6 px-2 text-[10px] cursor-pointer"
                                                  title="Кикнуть с сервера"
                                                >
                                                  Кик
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-dashed border-slate-200 dark:border-zinc-700 text-center space-y-1">
                                        <div className="text-xs text-slate-600 dark:text-zinc-400 flex items-center justify-center gap-1.5">
                                          <Users className="w-4 h-4 text-slate-400" />
                                          <span>Список активных игроков пуст или ещё не запрошен</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          Нажмите кнопку «Обновить список (status)», чтобы запросить игроков с сервера
                                        </div>
                                      </div>
                                    )}

                                    {/* Section 2: Configured Match Rosters */}
                                    <div className="space-y-1.5 pt-1 border-t border-slate-200/60 dark:border-zinc-800/80">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-bold text-slate-700 dark:text-zinc-300">
                                          Заявленные составы матча:
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                          {hasRoster ? `В вайтлисте: ${t1Keys.length + t2Keys.length} чел.` : "Свободный вход"}
                                        </span>
                                      </div>

                                      {!hasRoster ? (
                                        <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-zinc-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-700">
                                          Вайтлист не ограничен — к серверу может подключиться любой участник клуба по IP и порту.
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                          {/* Team 1 Roster */}
                                          <div className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-1">
                                            <div className="font-bold text-blue-900 dark:text-blue-200 text-[11px] flex items-center justify-between">
                                              <span>🔵 {m.team1_name} (CT)</span>
                                              <Badge variant="outline" className="text-[9px] h-4">{t1Keys.length}</Badge>
                                            </div>
                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                              {t1Keys.map((steam) => (
                                                <div key={steam} className="flex items-center justify-between text-[11px] bg-white dark:bg-zinc-800 p-1.5 rounded border border-blue-100 dark:border-blue-900/50 gap-1">
                                                  <span className="font-medium truncate">{t1[steam]}</span>
                                                  <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[9px] font-mono text-slate-400 select-all">{steam.slice(-6)}</span>
                                                    <button
                                                      type="button"
                                                      disabled={isBusyRcon}
                                                      onClick={() => handleSendRcon(m.id, `matchzy_removeplayer ${steam}`)}
                                                      className="text-rose-500 hover:text-rose-700 text-[10px] px-1 font-bold cursor-pointer"
                                                      title="Удалить игрока"
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>

                                          {/* Team 2 Roster */}
                                          <div className="p-2 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 space-y-1">
                                            <div className="font-bold text-red-900 dark:text-red-200 text-[11px] flex items-center justify-between">
                                              <span>🔴 {m.team2_name} (T)</span>
                                              <Badge variant="outline" className="text-[9px] h-4">{t2Keys.length}</Badge>
                                            </div>
                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                              {t2Keys.map((steam) => (
                                                <div key={steam} className="flex items-center justify-between text-[11px] bg-white dark:bg-zinc-800 p-1.5 rounded border border-red-100 dark:border-red-900/50 gap-1">
                                                  <span className="font-medium truncate">{t2[steam]}</span>
                                                  <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[9px] font-mono text-slate-400 select-all">{steam.slice(-6)}</span>
                                                    <button
                                                      type="button"
                                                      disabled={isBusyRcon}
                                                      onClick={() => handleSendRcon(m.id, `matchzy_removeplayer ${steam}`)}
                                                      className="text-rose-500 hover:text-rose-700 text-[10px] px-1 font-bold cursor-pointer"
                                                      title="Удалить игрока"
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Section 3: Add / Move Player Form */}
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/60 space-y-2">
                                      <div className="text-[11px] font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                                        <UserPlus className="w-3.5 h-3.5 text-emerald-500" />
                                        Добавить игрока по SteamID64:
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Input
                                          placeholder="SteamID64 (например, 76561198012345678)"
                                          value={addPlayerSteamId[m.id] || ""}
                                          onChange={(e) =>
                                            setAddPlayerSteamId((prev) => ({ ...prev, [m.id]: e.target.value }))
                                          }
                                          className="h-7 text-xs font-mono flex-1 min-w-[200px] bg-slate-50 dark:bg-zinc-900"
                                        />
                                        <select
                                          value={addPlayerTeam[m.id] || "team1"}
                                          onChange={(e) =>
                                            setAddPlayerTeam((prev) => ({ ...prev, [m.id]: e.target.value as any }))
                                          }
                                          className="h-7 text-xs rounded border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-2 text-slate-800 dark:text-zinc-200"
                                        >
                                          <option value="team1">{m.team1_name} (CT)</option>
                                          <option value="team2">{m.team2_name} (T)</option>
                                          <option value="spec">Наблюдатель (Spec)</option>
                                        </select>
                                        <Button
                                          size="sm"
                                          disabled={isBusyRcon || !addPlayerSteamId[m.id]}
                                          onClick={() => {
                                            const steam = (addPlayerSteamId[m.id] || "").trim();
                                            const team = addPlayerTeam[m.id] || "team1";
                                            if (steam) {
                                              handleSendRcon(m.id, `matchzy_addplayer ${steam} ${team} "Player_${steam.slice(-4)}"`);
                                              setAddPlayerSteamId((prev) => ({ ...prev, [m.id]: "" }));
                                            }
                                          }}
                                          className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                        >
                                          Добавить
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Section 4: Whitelist Toggle */}
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/60 flex-wrap gap-2">
                                      <div className="text-[11px]">
                                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                                          Вайтлист сервера:
                                        </span>
                                        <p className="text-[10px] text-slate-400">
                                          Включить проверку SteamID или открыть свободный вход
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                         <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={isBusyRcon}
                                          onClick={() => handleSendRcon(m.id, "matchzy_whitelist_enabled_default true")}
                                          className="h-7 px-2.5 text-xs text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                        >
                                          <Shield className="w-3 h-3 mr-1" />
                                          Включить вайтлист
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={isBusyRcon}
                                          onClick={() => handleSendRcon(m.id, "matchzy_whitelist_enabled_default false")}
                                          className="h-7 px-2.5 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer"
                                        >
                                          Свободный вход
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* TAB 4: FINISH / TECHNICAL VICTORY */}
                              {activeControlTab === "finish" && (
                                <div className="space-y-2.5">
                                  <div className="text-[11px] text-slate-500">
                                    Принудительно присудить победу команде или завершить встречу вничью:
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => {
                                        if (confirm(`Присудить техническую победу ${m.team1_name}?`)) {
                                          handleSendRcon(m.id, "css_endmatch 1");
                                        }
                                      }}
                                      className="h-8 text-xs font-semibold gap-1.5 border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                                    >
                                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                      ТП {m.team1_name}
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => {
                                        if (confirm(`Присудить техническую победу ${m.team2_name}?`)) {
                                          handleSendRcon(m.id, "css_endmatch 2");
                                        }
                                      }}
                                      className="h-8 text-xs font-semibold gap-1.5 border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                                    >
                                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                      ТП {m.team2_name}
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isBusyRcon}
                                      onClick={() => {
                                        if (confirm("Завершить встречу ничьей?")) {
                                          handleSendRcon(m.id, "css_endmatch 0");
                                        }
                                      }}
                                      className="h-8 text-xs font-semibold gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Swords className="w-3.5 h-3.5 text-slate-500" />
                                      Ничья (Draw)
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* TAB 5: RCON CONSOLE */}
                              {activeControlTab === "console" && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] text-slate-400">Шаблоны:</span>
                                    {["status", "get5_status", "css_roundknife", "css_forceready", "css_forcepause", "css_forceunpause", "css_tech", "css_restore 1", "matchzy_listbackups", "mp_warmup_end 1", "bot_kick"].map((cmd) => (
                                      <button
                                        key={cmd}
                                        type="button"
                                        disabled={isBusyRcon}
                                        onClick={() => handleSendRcon(m.id, cmd)}
                                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-white dark:bg-zinc-800 hover:bg-orange-500 hover:text-white text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 cursor-pointer transition-colors"
                                      >
                                        {cmd}
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Input
                                      placeholder="Любая команда CS2: status, changelevel de_inferno, mp_roundtime 2..."
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
                                </div>
                              )}

                              {/* Live RCON Output Area (always visible if response exists) */}
                              {m.rcon_last_response && (
                                <div className="p-2 rounded bg-slate-950 text-slate-200 font-mono text-[11px] max-h-36 overflow-y-auto whitespace-pre-wrap leading-tight border border-slate-800">
                                  <div className="text-[10px] text-slate-500 mb-0.5 flex items-center justify-between">
                                    <span>Ответ на `{m.rcon_last_command}`:</span>
                                    <span className="text-[9px] text-slate-600">обновлено</span>
                                  </div>
                                  {m.rcon_last_response}
                                </div>
                              )}
                            </div>
                          );
                        })()}

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
