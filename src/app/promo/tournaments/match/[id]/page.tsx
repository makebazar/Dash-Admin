"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Crown,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Flame,
  AlertTriangle,
  MessageSquare,
  Send,
  ArrowLeft,
  ChevronLeft,
  Server,
  Play,
  Pause,
  RefreshCw,
  Monitor,
  CheckCheck,
  WifiOff,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  sender_kind: string;
  sender_name: string;
  body: string;
  created_at: string;
}

const MAP_PREVIEWS: Record<string, { name: string; image: string; desc: string }> = {
  // 5v5 Premier & Classic
  de_mirage: {
    name: "Mirage",
    image: "/images/maps/de_mirage.png",
    desc: "Главный соревновательный выбор, открытые пленты и мид",
  },
  de_dust2: {
    name: "Dust II",
    image: "/images/maps/de_dust2.png",
    desc: "Золотая классика Counter-Strike, длинные дуэли",
  },
  de_inferno: {
    name: "Inferno",
    image: "/images/maps/de_inferno.png",
    desc: "Тактический контроль банана, ковров и апартаментов",
  },
  de_nuke: {
    name: "Nuke",
    image: "/images/maps/de_nuke.png",
    desc: "Двухуровневый атомный комплекс, улица и рампа",
  },
  de_ancient: {
    name: "Ancient",
    image: "/images/maps/de_ancient.png",
    desc: "Древние руины майя, джунгли и узкие коннекторы",
  },
  de_anubis: {
    name: "Anubis",
    image: "/images/maps/de_anubis.png",
    desc: "Песчаные каналы, мост и быстрые размены",
  },
  de_vertigo: {
    name: "Vertigo",
    image: "/images/maps/de_vertigo.png",
    desc: "Высотный небоскрёб на этапе строительства",
  },
  de_overpass: {
    name: "Overpass",
    image: "/images/maps/de_overpass.png",
    desc: "Берлинский парк, каналы и эстакада",
  },
  de_train: {
    name: "Train",
    image: "/images/maps/de_train.png",
    desc: "Железнодорожное депо, поезда и узкие переходы",
  },
  cs_office: {
    name: "Office",
    image: "/images/maps/cs_office.png",
    desc: "Зимний офисный комплекс, спасение заложников",
  },
  cs_italy: {
    name: "Italy",
    image: "/images/maps/cs_italy.png",
    desc: "Итальянские улочки и винные погреба",
  },

  // Wingman (Напарники 2х2)
  de_lake: {
    name: "Lake",
    image: "/images/maps/de_lake.png",
    desc: "Загородный дом у озера, ближний бой и крыша",
  },
  de_bank: {
    name: "Bank",
    image: "/images/maps/de_bank.png",
    desc: "Ограбление пригородного банка, штурм хранилища",
  },
  de_safehouse: {
    name: "Safehouse",
    image: "/images/maps/de_safehouse.png",
    desc: "Лесной коттедж с несколькими этажами",
  },
  de_boyard: {
    name: "Boyard",
    image: "/images/maps/de_boyard.png",
    desc: "Морской каменный форт и тесные галереи",
  },
  de_chalice: {
    name: "Chalice",
    image: "/images/maps/de_chalice.png",
    desc: "Старинный европейский замок со статуями",
  },
  de_shortnuke: {
    name: "Short Nuke",
    image: "/images/maps/de_nuke.png",
    desc: "Напарники: Спуск, рампа и плент B",
  },
  de_shortdust: {
    name: "Short Dust",
    image: "/images/maps/de_dust2.png",
    desc: "Напарники: Зигзаг, лонг и плент A",
  },

  // 1v1 Aim & Duels
  aim_redline: {
    name: "Aim Redline",
    image: "/images/maps/aim_redline.png",
    desc: "Симметричная арена для чистых дуэлей на винтовках",
  },
  aim_map: {
    name: "Aim Map",
    image: "/images/maps/aim_map.png",
    desc: "Легендарная дуэльная арена с симметричными ящиками",
  },
  awp_lego_2: {
    name: "AWP Lego 2",
    image: "/images/maps/awp_lego_2.png",
    desc: "Культовая снайперская дуэль из блоков LEGO",
  },
  aim_ak47: {
    name: "Aim AK47",
    image: "/images/maps/aim_ak47.png",
    desc: "Дуэльная карта для оттачивания стрельбы с автоматов",
  },
  aim_headshot: {
    name: "Aim Headshot",
    image: "/images/maps/aim_headshot.png",
    desc: "Арена с жесткими укрытиями только для хедшотов",
  },
  aim_dust2: {
    name: "Aim Dust2",
    image: "/images/maps/de_dust2.png",
    desc: "Компактная дуэльная адаптация мида и лонга Dust II",
  },
  aim_pistol_cs2: {
    name: "Aim Pistol",
    image: "/images/maps/aim_pistol_cs2.png",
    desc: "Динамичные пистолетные дуэли 1 на 1",
  },
  aim_aztec: {
    name: "Aim Aztec",
    image: "/images/maps/aim_aztec.png",
    desc: "Дуэльная арена в стиле древнего Ацтека",
  },
};

export default function MatchLobby() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.id as string;
  const clubId = searchParams.get("clubId") || "";

  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [veto, setVeto] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Form states
  const [pcNumber, setPcNumber] = useState("");
  const [steamIdInput, setSteamIdInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);
  const [copiedConnect, setCopiedConnect] = useState(false);
  const [isRequestingPause, setIsRequestingPause] = useState(false);
  const [isRestartingServer, setIsRestartingServer] = useState(false);
  const [vetoCountdown, setVetoCountdown] = useState(45);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  const fetchLobbyData = async () => {
    try {
      const res = await fetch(`/api/promo/matches/${matchId}`);
      if (!res.ok) throw new Error("Match not found");
      const data = await res.json();
      setMatch(data.match);
      setCheckins(data.checkins || []);
      setVeto(data.veto);
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Error fetching lobby data:", err);
    }
  };

  const fetchPlayer = async () => {
    try {
      const res = await fetch("/api/promo/player");
      if (res.ok) {
        const data = await res.json();
        setPlayer(data.player);
        const steam = data.player?.steam_id || data.player?.steam_link || "";
        if (steam) {
          setSteamIdInput(steam);
        }
      }
    } catch (err) {
      console.error("Error fetching player:", err);
    }
  };

  // Real-time SSE listener + fallback polling
  useEffect(() => {
    fetchPlayer();
    fetchLobbyData().then(() => setLoading(false));

    const sseUrl = `/api/promo/matches/${matchId}/stream${clubId ? `?clubId=${clubId}` : ""}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener("update", () => {
      fetchLobbyData();
    });

    const pollInterval = setInterval(fetchLobbyData, 5000);

    return () => {
      eventSource.close();
      clearInterval(pollInterval);
    };
  }, [matchId, clubId]);

  // Veto countdown timer (synced with server updated_at timestamp)
  useEffect(() => {
    if (match?.status?.toLowerCase() === "veto" && veto?.current_turn_competitor_id) {
      const getRemaining = () => {
        if (!veto?.updated_at) return 45;
        const turnStartTime = new Date(veto.updated_at).getTime();
        const elapsed = Math.floor((Date.now() - turnStartTime) / 1000);
        return Math.max(0, 45 - elapsed);
      };

      setVetoCountdown(getRemaining());

      const timer = setInterval(() => {
        setVetoCountdown((prev) => {
          if (prev <= 1) {
            fetchLobbyData();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [match?.status, veto?.current_turn_competitor_id, veto?.updated_at]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Action Handlers
  const handleCheckin = async () => {
    if (!pcNumber.trim() || isSubmittingCheckin) return;
    setIsSubmittingCheckin(true);
    try {
      const res = await fetch(`/api/promo/matches/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkin",
          pcNumber: pcNumber.trim(),
          steamId: steamIdInput.trim(),
        }),
      });
      if (res.ok) {
        await fetchLobbyData();
        await fetchPlayer();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка подтверждения готовности");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingCheckin(false);
    }
  };

  const handleVetoBan = async (mapName: string) => {
    try {
      const res = await fetch(`/api/promo/matches/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "veto_ban", mapName }),
      });
      if (res.ok) {
        await fetchLobbyData();
      } else {
        const data = await res.json();
        alert(data.error || "Невозможно выбрать эту карту");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTacticalPause = async () => {
    if (isRequestingPause) return;
    setIsRequestingPause(true);
    try {
      const res = await fetch(`/api/promo/matches/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tactical_pause" }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Тактическая пауза запрошена на сервере!");
        await fetchLobbyData();
      } else {
        alert(data.error || "Не удалось запросить паузу");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRequestingPause(false);
    }
  };

  const handleRestartServer = async () => {
    if (isRestartingServer) return;
    setIsRestartingServer(true);
    try {
      const res = await fetch(`/api/promo/matches/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restart_server" }),
      });
      if (res.ok) {
        await fetchLobbyData();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось перезапустить сервер");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRestartingServer(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingMsg) return;
    setIsSendingMsg(true);
    try {
      const res = await fetch(`/api/promo/matches/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_message", message: chatInput.trim() }),
      });
      if (res.ok) {
        setChatInput("");
        await fetchLobbyData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingMsg(false);
    }
  };

  const handleCopyConnect = () => {
    if (!match?.connectCommand) return;
    navigator.clipboard.writeText(match.connectCommand);
    setCopiedConnect(true);
    setTimeout(() => setCopiedConnect(false), 2500);
  };

  // --- Hooks must come before any early return (Rules of Hooks) ---
  const compA = match?.competitorA;
  const compB = match?.competitorB;

  const isParticipant = useMemo(() => {
    if (!player || !match) return false;
    const pId = String(player.id || "");
    const pPhone = String(player.phone_number || "");

    const checkMatch = (targetId: any) => {
      if (!targetId) return false;
      const t = String(targetId);
      return (pId && t === pId) || (pPhone && t === pPhone);
    };

    if (checkMatch(compA?.playerId) || checkMatch(compA?.captainId) || checkMatch(compA?.id)) return true;
    if (checkMatch(compB?.playerId) || checkMatch(compB?.captainId) || checkMatch(compB?.id)) return true;

    if (compA?.roster?.some((p: any) => checkMatch(p.id) || checkMatch(p.player_id) || checkMatch(p.phone))) return true;
    if (compB?.roster?.some((p: any) => checkMatch(p.id) || checkMatch(p.player_id) || checkMatch(p.phone))) return true;

    if (checkins.some((c: any) => checkMatch(c.player_id))) return true;

    return false;
  }, [player, match, compA, compB, checkins]);

  const myCheckin = useMemo(() => {
    if (!player) return null;
    const pId = String(player.id || "");
    const pPhone = String(player.phone_number || "");
    return checkins.find((c) => String(c.player_id) === pId || (pPhone && String(c.player_id) === pPhone));
  }, [player, checkins]);
  // ----------------------------------------------------------------

  if (loading || !match) {
    return (
      <div className="min-h-screen bg-[#070709] flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Загрузка лобби...
        </p>
      </div>
    );
  }

  const isSolo = (compA?.roster?.length || 1) <= 1 && (compB?.roster?.length || 1) <= 1;

  const isCheckedIn = Boolean(myCheckin?.is_ready);

  const isMyTurnToBan = Boolean(
    isParticipant &&
    veto &&
    veto.current_turn_competitor_id &&
    ((veto.current_turn_competitor_id === compA?.id && (String(compA.playerId) === String(player?.id) || String(compA.captainId) === String(player?.id))) ||
     (veto.current_turn_competitor_id === compB?.id && (String(compB.playerId) === String(player?.id) || String(compB.captainId) === String(player?.id))))
  );

  const activeTurnName = veto?.current_turn_competitor_id === compA?.id
    ? compA?.name
    : (veto?.current_turn_competitor_id === compB?.id ? compB?.name : "Ожидание");

  const statusLower = match.status?.toLowerCase() || "scheduled";
  const isFinished = statusLower === "finished";
  const isVeto = statusLower === "veto";
  const isScheduled = statusLower === "scheduled" || statusLower === "pending";
  const isMatchStarted = ["in_progress", "live", "playing", "finished", "starting"].includes(statusLower);

  const serverStatus = match.serverStatus || "idle";
  const isServerReady = ["ready", "warmup", "knife", "live", "paused"].includes(serverStatus);

  const isWinnerA = isFinished && match.winnerId === compA?.id;
  const isWinnerB = isFinished && match.winnerId === compB?.id;

  const selectedMapKey = veto?.selected_map || match.selectedMap || "de_mirage";
  const selectedMapInfo = MAP_PREVIEWS[selectedMapKey] || {
    name: selectedMapKey.replace(/^(de_|cs_)/g, "").toUpperCase(),
    image: `/images/maps/${selectedMapKey}.png`,
    desc: "Соревновательная карта турнира",
  };

  const format = match.matchFormat || "bo1";
  const backUrl = `/promo/tournaments?clubId=${clubId}&tournamentId=${match.tournamentId}&tab=bracket`;

  // Total ready count
  const totalRosterCount = (compA?.roster?.length || 1) + (compB?.roster?.length || 1);
  const readyCount = checkins.filter((c) => c.is_ready).length;

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-orange-500/20 pb-10 font-sans">
      
      {/* 1. TOP NAVBAR */}
      <header className="border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push(backUrl)}
              className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors shrink-0"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-orange-500" />
              <span>Назад к турниру</span>
            </button>

            {match.tournamentName && (
              <>
                <div className="w-px h-4 bg-white/10 hidden sm:block shrink-0" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:inline truncate">
                  {match.tournamentName} • Раунд {match.round}
                </span>
              </>
            )}
          </div>

          {/* Right Section: Clean Status without containers */}
          <div className="shrink-0 flex items-center gap-2 text-xs font-black uppercase tracking-wider">
            {!isParticipant && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-orange-400 mr-1">
                <Radio className="w-3 h-3 text-orange-400 animate-pulse" />
                <span>Наблюдатель</span>
              </div>
            )}
            {isFinished ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Завершен ({match.score1 ?? 0}:{match.score2 ?? 0})</span>
              </div>
            ) : isServerReady ? (
              <div className="flex items-center gap-2 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                <span>LIVE {match.score1 ?? 0}:{match.score2 ?? 0}</span>
              </div>
            ) : serverStatus === "starting" ? (
              <div className="flex items-center gap-2 text-orange-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Запуск CS2...</span>
              </div>
            ) : isVeto ? (
              <div className="flex items-center gap-2 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Выбор карт ({vetoCountdown}с)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400">
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                <span>Готовность {readyCount}/{totalRosterCount}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. EDITORIAL HERO MATCH BANNER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="relative rounded-2xl bg-[#0e0e12] border border-white/5 p-5 sm:p-7 overflow-hidden shadow-2xl">
          {/* Subtle map backdrop */}
          {selectedMapInfo && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none filter blur-md transition-all duration-700"
              style={{ backgroundImage: `url(${selectedMapInfo.image})` }}
            />
          )}

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            {/* Team A */}
            <div className="flex flex-col items-start min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white truncate">
                  {compA?.name || "Команда 1"}
                </h2>
                {isWinnerA && <Crown className="w-5 h-5 text-yellow-400 fill-yellow-400 shrink-0" />}
              </div>
              {!isSolo && (
                <span className="text-xs text-gray-400 font-medium tracking-wide mt-0.5">
                  Состав: {compA?.roster?.length || 1} чел.
                </span>
              )}
            </div>

            {/* Middle Score & Match Meta */}
            <div className="text-center flex flex-col items-center justify-center">
              <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white flex items-center justify-center gap-3">
                <span className={cn(isWinnerA ? "text-emerald-400" : "")}>{match.score1 ?? 0}</span>
                <span className="text-orange-500 font-sans font-light">:</span>
                <span className={cn(isWinnerB ? "text-emerald-400" : "")}>{match.score2 ?? 0}</span>
              </div>

              <div className="mt-1 text-xs font-bold tracking-widest uppercase">
                {veto?.selected_map ? (
                  <span className="text-emerald-400">{format.toUpperCase()} • {selectedMapInfo.name}</span>
                ) : isVeto ? (
                  <span className="text-amber-400">{format.toUpperCase()} • ВЫБОР КАРТ ({vetoCountdown}С)</span>
                ) : (
                  <span className="text-gray-400">{format.toUpperCase()} • ПОДТВЕРЖДЕНИЕ ГОТОВНОСТИ</span>
                )}
              </div>
            </div>

            {/* Team B */}
            <div className="flex flex-col items-start md:items-end min-w-0">
              <div className="flex items-center gap-2">
                {isWinnerB && <Crown className="w-5 h-5 text-yellow-400 fill-yellow-400 shrink-0" />}
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white truncate">
                  {compB?.name || "Команда 2"}
                </h2>
              </div>
              {!isSolo && (
                <span className="text-xs text-gray-400 font-medium tracking-wide mt-0.5">
                  Состав: {compB?.roster?.length || 1} чел.
                </span>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* 3. MAIN ARENA (12 COLUMNS) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT: TEAM A ROSTER (3 Cols) */}
          <div className="lg:col-span-3">
            <div className="bg-[#0c0c10] border border-white/5 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-300 truncate max-w-[140px]">
                  {isSolo ? "Участник" : (compA?.name || "Команда А")}
                </h3>
                <span className="text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap shrink-0">
                  {isSolo ? "1v1" : `${compA?.roster?.length || 1} ИГР.`}
                </span>
              </div>

              <div className="space-y-2">
                {(compA?.roster || [{ id: compA?.playerId, full_name: compA?.name, nickname: compA?.name }]).map((p: any) => {
                  const checkin = checkins.find((c) => String(c.player_id) === String(p.id));
                  const isCap = compA?.captainId === p.id || compA?.playerId === p.id;
                  const playerName = p.nickname || p.full_name || p.name || compA?.name || "Игрок";
                  const profileUrl = p.id ? `/promo/player/${p.id}${clubId ? `?clubId=${clubId}` : ""}` : null;

                  return (
                    <div
                      key={p.id || playerName}
                      className={cn(
                        "py-2 px-3 rounded-lg transition-all flex items-center justify-between gap-3",
                        checkin?.is_ready
                          ? "bg-emerald-500/[0.04]"
                          : "bg-white/[0.02]"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {profileUrl ? (
                            <Link
                              href={profileUrl}
                              className="text-sm font-bold text-white hover:text-orange-400 transition-colors truncate block"
                              title="Перейти в профиль игрока"
                            >
                              {playerName}
                            </Link>
                          ) : (
                            <span className="text-sm font-bold text-white truncate">
                              {playerName}
                            </span>
                          )}
                          {isCap && !isSolo && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                              КЭП
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono mt-0.5">
                          <span>ПК {checkin?.pc_number ? `#${checkin.pc_number}` : "—"}</span>
                          {p.player_elo && (
                            <>
                              <span className="text-gray-600">•</span>
                              <span className="text-orange-400 font-bold">{p.player_elo} ELO</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {checkin?.is_ready ? (
                          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                            Готов
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                            Ожидание
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* MIDDLE: ACTION ARENA / THEATER (6 Cols) */}
          <div className="lg:col-span-6 space-y-4">

            {/* STAGE 1: CHECK-IN PHASE */}
            {isScheduled && (
              <div className="bg-[#0c0c10] border border-white/5 rounded-2xl p-6 space-y-5 shadow-2xl">
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                    Этап 1: Готовность к матчу
                  </div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-white">
                    {isParticipant ? "Подтверждение участия за ПК" : "Ожидание готовности участников"}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {isParticipant
                      ? "Укажите номер вашего игрового места в клубе для авторизации на сервере"
                      : "Игроки занимают места в клубе и подтверждают готовность"}
                  </p>
                </div>

                {/* Readiness summary */}
                <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-400">Готовность участников</span>
                    <span className="text-orange-400">{readyCount} из {totalRosterCount}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (readyCount / Math.max(1, totalRosterCount)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Form or Spectator Mode Notice */}
                {isParticipant ? (
                  !isCheckedIn ? (
                    <div className="bg-[#121217] border border-white/10 rounded-xl p-5 space-y-4">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 block mb-1.5">
                          Номер ПК в зале клуба *
                        </label>
                        <input
                          type="text"
                          placeholder="Например: 14 или VIP-2"
                          value={pcNumber}
                          onChange={(e) => setPcNumber(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-all"
                        />
                      </div>

                      {player?.steam_id || player?.steam_link ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                              Steam аккаунт
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Привязан
                            </span>
                          </div>
                          <div className="bg-black/50 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-300 truncate">
                            {player?.steam_id || player?.steam_link}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 block mb-1.5">
                            Steam ID / Ссылка на профиль *
                          </label>
                          <input
                            type="text"
                            placeholder="76561198000000000 или ссылка"
                            value={steamIdInput}
                            onChange={(e) => setSteamIdInput(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-all"
                          />
                        </div>
                      )}

                      <button
                        onClick={handleCheckin}
                        disabled={isSubmittingCheckin || !pcNumber.trim() || !(player?.steam_id || player?.steam_link || steamIdInput.trim())}
                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
                      >
                        {isSubmittingCheckin ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCheck className="w-4 h-4" />
                        )}
                        <span>Я готов к матчу</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#121217] border border-white/5 rounded-xl p-5 text-center space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Вы готовы (ПК #{myCheckin?.pc_number})
                      </div>
                      <p className="text-xs text-gray-400">
                        Ожидаем готовности остальных игроков...
                      </p>
                    </div>
                  )
                ) : (
                  <div className="bg-[#121217] border border-white/5 rounded-xl p-6 text-center space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-gray-300 text-xs font-bold uppercase tracking-wider">
                      <Radio className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                      Режим зрителя • Вы наблюдаете за лобби
                    </div>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                      Матч и стадия выбора карт начнутся автоматически, как только все заявленные участники займут ПК в клубе и подтвердят готовность.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 2: MAP VETO PHASE */}
            {isVeto && (
              <div className="bg-[#0c0c10] border border-white/5 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/5 pb-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                      Стадия выбора карт ({format.toUpperCase()})
                    </div>
                    <h2 className="text-base font-black uppercase tracking-tight text-white mt-0.5">
                      {isMyTurnToBan ? (
                        <span className="text-orange-400">Ваш ход: Забаньте карту</span>
                      ) : (
                        <span>Ход: <strong className="text-orange-400">{activeTurnName}</strong></span>
                      )}
                    </h2>
                  </div>

                  {/* Timer */}
                  <div className="text-sm font-black font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-xl">
                    {vetoCountdown}s
                  </div>
                </div>

                {/* Map Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(match.mapPool || []).map((map: string) => {
                    const isBanned = veto?.banned_maps?.includes(map);
                    const isSelected = veto?.selected_map?.split(",").includes(map);
                    const preview = MAP_PREVIEWS[map] || {
                      name: map.replace(/^(de_|cs_)/g, "").toUpperCase(),
                      image: `/images/maps/${map}.png`,
                      desc: "Карта турнирного пула",
                    };

                    return (
                      <div
                        key={map}
                        onClick={() => {
                          if (isMyTurnToBan && !isBanned && !isSelected) {
                            handleVetoBan(map);
                          }
                        }}
                        className={cn(
                          "relative rounded-xl border overflow-hidden aspect-[4/3] flex flex-col justify-end p-3 transition-all duration-300 group select-none",
                          isBanned
                            ? "border-red-500/20 grayscale opacity-25 pointer-events-none"
                            : isSelected
                            ? "border-emerald-500 ring-2 ring-emerald-500/40 shadow-xl shadow-emerald-500/20"
                            : isMyTurnToBan
                            ? "border-white/20 hover:border-orange-500 hover:scale-[1.02] cursor-pointer shadow-lg hover:shadow-orange-500/10"
                            : "border-white/5 opacity-80 pointer-events-none"
                        )}
                      >
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                          style={{ backgroundImage: `url(${preview.image})` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />

                        <div className="relative z-10 space-y-0.5">
                          {isBanned && (
                            <span className="text-[9px] font-black uppercase text-red-400 block">
                              Забанена
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-[9px] font-black uppercase text-emerald-400 block">
                              Выбрана
                            </span>
                          )}
                          <h4 className="text-sm font-black uppercase tracking-wider text-white">
                            {preview.name}
                          </h4>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STAGE 3 & 4: SERVER DEPLOYMENT, CONNECT & LIVE */}
            {isMatchStarted && (
              <div className="space-y-4">

                {/* SCENARIO A: AGENT OFFLINE */}
                {serverStatus === "agent_offline" && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 space-y-3.5">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-wider text-red-400">
                        Агент DashMatch не запущен на сервере клуба
                      </h3>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        Для автоматического старта сервера запустите приложение <code className="text-orange-400 font-mono font-bold">dashmatch.exe</code> на хосте клуба.
                      </p>
                    </div>

                    <button
                      onClick={fetchLobbyData}
                      className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border border-white/10 active:scale-95"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Проверить снова</span>
                    </button>
                  </div>
                )}

                {/* SCENARIO B: SERVER STARTING */}
                {serverStatus === "starting" && (
                  <div className="bg-[#0e0e12] border border-orange-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
                    <div className="w-10 h-10 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto" />
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                        Вето завершено • Выбрана карта {selectedMapInfo.name}
                      </div>
                      <h3 className="text-base font-black uppercase tracking-tight text-white">
                        Запуск игрового CS2 сервера...
                      </h3>
                      <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                        Выделение порта :{match.cs2ServerPort || 27015} и компиляция конфигов матча. Пожалуйста, ожидайте — адрес подключения появится здесь автоматически сразу после старта сервера.
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                      <span>Инициализация игрового сервера</span>
                    </div>
                  </div>
                )}

                {/* SCENARIO C: SERVER TIMEOUT */}
                {serverStatus === "start_failed" && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 space-y-3.5">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">
                        Превышено время ожидания сервера
                      </h3>
                      <p className="text-xs text-gray-300">
                        Сервер CS2 не сообщил о готовности. Возможно, порт был занят или агент переподключался.
                      </p>
                    </div>

                    <button
                      onClick={handleRestartServer}
                      disabled={isRestartingServer}
                      className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2 active:scale-95"
                    >
                      {isRestartingServer ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-white" />
                      )}
                      <span>Перезапустить CS2</span>
                    </button>
                  </div>
                )}

                {/* SCENARIO D: SERVER READY / LIVE */}
                {isServerReady && !isFinished && (
                  <div className="relative rounded-2xl bg-[#0e0e12] border border-emerald-500/30 p-5 space-y-4 shadow-2xl overflow-hidden">
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none filter blur-md"
                      style={{ backgroundImage: `url(${selectedMapInfo.image})` }}
                    />

                    <div className="relative z-10 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-white/5 pb-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span>Сервер CS2 запущен</span>
                          </div>
                          <div className="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">
                            {serverStatus === "warmup" ? "Разминка" : serverStatus === "knife" ? "Ножевой раунд" : "Матч идет"} • Карта {selectedMapInfo.name}
                          </div>
                        </div>

                        <button
                          onClick={handleTacticalPause}
                          disabled={isRequestingPause}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-white/5 flex items-center gap-1.5 active:scale-95"
                        >
                          <Pause className="w-3.5 h-3.5 text-orange-400" />
                          <span>Тактическая пауза</span>
                        </button>
                      </div>

                      {/* Connect bar */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <button
                          onClick={handleCopyConnect}
                          className="sm:col-span-8 py-3 px-3.5 bg-black/60 hover:bg-black/80 border border-white/10 hover:border-orange-500/40 rounded-xl text-xs font-mono font-bold text-gray-200 transition-all flex items-center justify-between gap-3 group"
                        >
                          <span className="truncate text-orange-400">
                            {match.connectCommand || `connect ${match.cs2ServerIp}:${match.cs2ServerPort}`}
                          </span>
                          {copiedConnect ? (
                            <span className="text-emerald-400 text-xs font-bold uppercase shrink-0">
                              Скопировано
                            </span>
                          ) : (
                            <span className="text-gray-400 group-hover:text-white text-xs font-bold uppercase shrink-0">
                              Копировать
                            </span>
                          )}
                        </button>

                        <a
                          href={`steam://connect/${match.cs2ServerIp || "127.0.0.1"}:${match.cs2ServerPort || 27015}`}
                          className="sm:col-span-4 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>Зайти в CS2</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* MATCH STATS SCOREBOARD */}
                <div className="bg-[#0c0c10] border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">
                      Статистика матча
                    </h3>
                    <span className="text-xs font-mono font-bold text-gray-400">
                      {match.score1 ?? 0} : {match.score2 ?? 0}
                    </span>
                  </div>

                  {isSolo ? (
                    /* SOLO 1v1 DUEL TABLE */
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/5 text-gray-500 uppercase text-[9px] font-black">
                            <th className="py-1.5">Участник</th>
                            <th className="py-1.5 text-center">K</th>
                            <th className="py-1.5 text-center">D</th>
                            <th className="py-1.5 text-center">A</th>
                            <th className="py-1.5 text-center">ADR</th>
                            <th className="py-1.5 text-center">HS%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {/* Player A */}
                          {(() => {
                            const p = match.matchStats?.team1?.players?.[0] || {
                              name: compA?.name || compA?.roster?.[0]?.nickname || "Игрок 1",
                              kills: 0,
                              deaths: 0,
                              assists: 0,
                              adr: "-",
                              hs_percent: 0,
                              mvps: 0,
                            };
                            return (
                              <tr key="player-a" className="hover:bg-white/[0.02]">
                                <td className="py-2.5 font-bold text-white flex items-center gap-2">
                                  <span className="text-orange-400 font-black">•</span>
                                  <span>{p.name}</span>
                                  {p.mvps > 0 && <span className="text-yellow-400 text-[10px]">★{p.mvps}</span>}
                                </td>
                                <td className="py-2.5 text-center font-mono font-bold text-emerald-400">{p.kills ?? 0}</td>
                                <td className="py-2.5 text-center font-mono text-gray-400">{p.deaths ?? 0}</td>
                                <td className="py-2.5 text-center font-mono text-gray-400">{p.assists ?? 0}</td>
                                <td className="py-2.5 text-center font-mono text-orange-400 font-bold">{p.adr ?? p.damage ?? "-"}</td>
                                <td className="py-2.5 text-center font-mono text-gray-400">{p.hs_percent ? `${p.hs_percent}%` : "-"}</td>
                              </tr>
                            );
                          })()}

                          {/* Player B */}
                          {(() => {
                            const p = match.matchStats?.team2?.players?.[0] || {
                              name: compB?.name || compB?.roster?.[0]?.nickname || "Игрок 2",
                              kills: 0,
                              deaths: 0,
                              assists: 0,
                              adr: "-",
                              hs_percent: 0,
                              mvps: 0,
                            };
                            return (
                              <tr key="player-b" className="hover:bg-white/[0.02]">
                                <td className="py-2.5 font-bold text-white flex items-center gap-2">
                                  <span className="text-blue-400 font-black">•</span>
                                  <span>{p.name}</span>
                                  {p.mvps > 0 && <span className="text-yellow-400 text-[10px]">★{p.mvps}</span>}
                                </td>
                                <td className="py-2.5 text-center font-mono font-bold text-emerald-400">{p.kills ?? 0}</td>
                                <td className="py-2.5 text-center font-mono text-gray-400">{p.deaths ?? 0}</td>
                                <td className="py-2.5 text-center font-mono text-gray-400">{p.assists ?? 0}</td>
                                <td className="py-2.5 text-center font-mono text-orange-400 font-bold">{p.adr ?? p.damage ?? "-"}</td>
                                <td className="py-2.5 text-center font-mono text-gray-400">{p.hs_percent ? `${p.hs_percent}%` : "-"}</td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* TEAM MATCH SCOREBOARD */
                    <div className="space-y-4">
                      {/* Team 1 Scoreboard */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                          {compA?.name || "Команда 1"}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-white/5 text-gray-500 uppercase text-[9px] font-black">
                                <th className="py-1">Игрок</th>
                                <th className="py-1 text-center">K</th>
                                <th className="py-1 text-center">D</th>
                                <th className="py-1 text-center">A</th>
                                <th className="py-1 text-center">ADR</th>
                                <th className="py-1 text-center">HS%</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {(match.matchStats?.team1?.players?.length
                                ? match.matchStats.team1.players
                                : (compA?.roster || [{ id: compA?.playerId, full_name: compA?.name, nickname: compA?.name }]).map((p: any) => ({
                                    name: p.nickname || p.full_name || p.name || compA?.name || "Игрок",
                                    steamid: p.steam_id || p.id,
                                    kills: 0,
                                    deaths: 0,
                                    assists: 0,
                                    adr: "-",
                                    hs_percent: 0,
                                    mvps: 0,
                                  }))
                              ).map((p: any) => (
                                <tr key={p.steamid || p.name} className="hover:bg-white/[0.02]">
                                  <td className="py-1.5 font-bold text-white flex items-center gap-1.5">
                                    <span>{p.name}</span>
                                    {p.mvps > 0 && (
                                      <span className="text-yellow-400 text-[10px]">★{p.mvps}</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 text-center font-mono font-bold text-emerald-400">{p.kills ?? 0}</td>
                                  <td className="py-1.5 text-center font-mono text-gray-400">{p.deaths ?? 0}</td>
                                  <td className="py-1.5 text-center font-mono text-gray-400">{p.assists ?? 0}</td>
                                  <td className="py-1.5 text-center font-mono text-orange-400 font-bold">{p.adr ?? p.damage ?? "-"}</td>
                                  <td className="py-1.5 text-center font-mono text-gray-400">{p.hs_percent ? `${p.hs_percent}%` : "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Team 2 Scoreboard */}
                      <div className="space-y-1.5 pt-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                          {compB?.name || "Команда 2"}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-white/5 text-gray-500 uppercase text-[9px] font-black">
                                <th className="py-1">Игрок</th>
                                <th className="py-1 text-center">K</th>
                                <th className="py-1 text-center">D</th>
                                <th className="py-1 text-center">A</th>
                                <th className="py-1 text-center">ADR</th>
                                <th className="py-1 text-center">HS%</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {(match.matchStats?.team2?.players?.length
                                ? match.matchStats.team2.players
                                : (compB?.roster || [{ id: compB?.playerId, full_name: compB?.name, nickname: compB?.name }]).map((p: any) => ({
                                    name: p.nickname || p.full_name || p.name || compB?.name || "Игрок",
                                    steamid: p.steam_id || p.id,
                                    kills: 0,
                                    deaths: 0,
                                    assists: 0,
                                    adr: "-",
                                    hs_percent: 0,
                                    mvps: 0,
                                  }))
                              ).map((p: any) => (
                                <tr key={p.steamid || p.name} className="hover:bg-white/[0.02]">
                                  <td className="py-1.5 font-bold text-white flex items-center gap-1.5">
                                    <span>{p.name}</span>
                                    {p.mvps > 0 && (
                                      <span className="text-yellow-400 text-[10px]">★{p.mvps}</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 text-center font-mono font-bold text-emerald-400">{p.kills ?? 0}</td>
                                  <td className="py-1.5 text-center font-mono text-gray-400">{p.deaths ?? 0}</td>
                                  <td className="py-1.5 text-center font-mono text-gray-400">{p.assists ?? 0}</td>
                                  <td className="py-1.5 text-center font-mono text-orange-400 font-bold">{p.adr ?? p.damage ?? "-"}</td>
                                  <td className="py-1.5 text-center font-mono text-gray-400">{p.hs_percent ? `${p.hs_percent}%` : "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* SCENARIO E: FINISHED VICTORY BANNER */}
                {isFinished && (
                  <div className="bg-[#0e0e12] border border-emerald-500/30 rounded-2xl p-6 text-center space-y-3 shadow-2xl">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 mx-auto flex items-center justify-center text-emerald-400">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                        Матч Завершен
                      </div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-white">
                        Победитель: {isWinnerA ? compA?.name : (isWinnerB ? compB?.name : "Ничья")}
                      </h3>
                      <p className="text-xs text-gray-400">
                        Итоговый счет серии: {match.score1 ?? 0} : {match.score2 ?? 0}
                      </p>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={() => router.push(backUrl)}
                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        Вернуться к сетке
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: TEAM B ROSTER (3 Cols) */}
          <div className="lg:col-span-3">
            <div className="bg-[#0c0c10] border border-white/5 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-300 truncate max-w-[140px]">
                  {isSolo ? "Участник" : (compB?.name || "Команда Б")}
                </h3>
                <span className="text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap shrink-0">
                  {isSolo ? "1v1" : `${compB?.roster?.length || 1} ИГР.`}
                </span>
              </div>

              <div className="space-y-2">
                {(compB?.roster || [{ id: compB?.playerId, full_name: compB?.name, nickname: compB?.name }]).map((p: any) => {
                  const checkin = checkins.find((c) => String(c.player_id) === String(p.id));
                  const isCap = compB?.captainId === p.id || compB?.playerId === p.id;
                  const playerName = p.nickname || p.full_name || p.name || compB?.name || "Игрок";
                  const profileUrl = p.id ? `/promo/player/${p.id}${clubId ? `?clubId=${clubId}` : ""}` : null;

                  return (
                    <div
                      key={p.id || playerName}
                      className={cn(
                        "py-2 px-3 rounded-lg transition-all flex items-center justify-between gap-3",
                        checkin?.is_ready
                          ? "bg-emerald-500/[0.04]"
                          : "bg-white/[0.02]"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {profileUrl ? (
                            <Link
                              href={profileUrl}
                              className="text-sm font-bold text-white hover:text-orange-400 transition-colors truncate block"
                              title="Перейти в профиль игрока"
                            >
                              {playerName}
                            </Link>
                          ) : (
                            <span className="text-sm font-bold text-white truncate">
                              {playerName}
                            </span>
                          )}
                          {isCap && !isSolo && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                              КЭП
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono mt-0.5">
                          <span>ПК {checkin?.pc_number ? `#${checkin.pc_number}` : "—"}</span>
                          {p.player_elo && (
                            <>
                              <span className="text-gray-600">•</span>
                              <span className="text-blue-400 font-bold">{p.player_elo} ELO</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {checkin?.is_ready ? (
                          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                            Готов
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                            Ожидание
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* FULL-WIDTH MATCH CHAT */}
        <div className="bg-[#0c0c10] border border-white/5 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Чат матча
            </h3>
            <span className="text-[10px] text-gray-500 font-medium">
              {isParticipant ? "Общий чат игроков лобби" : "Режим просмотра чата"}
            </span>
          </div>

          {/* Message Feed */}
          <div className="min-h-[40px] max-h-[160px] overflow-y-auto py-1 space-y-1.5 pr-1 text-xs">
            {messages.length === 0 ? (
              <div className="py-3 text-[11px] text-gray-500 uppercase tracking-wider text-center">
                Сообщений пока нет
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="flex items-baseline gap-2 py-0.5">
                  <span className="text-[10px] font-mono text-gray-500 shrink-0">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="font-bold text-orange-400 shrink-0 text-xs">
                    {m.sender_name}:
                  </span>
                  <span className="text-gray-200 break-words text-xs">
                    {m.body}
                  </span>
                </div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input */}
          {isParticipant ? (
            <form onSubmit={handleSendMessage} className="pt-1 flex gap-2">
              <input
                type="text"
                placeholder="Написать сообщение в чат матча..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-all"
              />
              <button
                type="submit"
                disabled={isSendingMsg || !chatInput.trim()}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Отправить</span>
              </button>
            </form>
          ) : (
            <div className="text-[11px] text-gray-500 text-center py-1">
              Отправка сообщений доступна участникам матча
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
