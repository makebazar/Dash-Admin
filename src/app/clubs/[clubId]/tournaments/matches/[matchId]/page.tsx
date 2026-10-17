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
  Flame,
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
  ArrowLeftRight,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCs2StatusPlayers } from "@/lib/cs2/utils";
import { formatDotaGameMode } from "@/lib/dota/utils";

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

const formatDotaDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const [selectedMap, setSelectedMap] = useState("");
  const [customWorkshopId, setCustomWorkshopId] = useState("");
  const [knifeRound, setKnifeRound] = useState(true);
  const [practiceMode, setPracticeMode] = useState(false);
  const [isLaunchingServer, setIsLaunchingServer] = useState(false);
  const [isStoppingServer, setIsStoppingServer] = useState(false);
  const [isRestartingServer, setIsRestartingServer] = useState(false);
  const [isResettingLobby, setIsResettingLobby] = useState(false);

  // RCON & Live Controls
  const [isSendingRcon, setIsSendingRcon] = useState(false);
  const [rconCommandInput, setRconCommandInput] = useState("");
  const [rconLogs, setRconLogs] = useState<Array<{ text: string; time: string; type: "sent" | "resp" }>>([]);
  const [restoreRound, setRestoreRound] = useState("1");
  const [copiedConnect, setCopiedConnect] = useState(false);

  // Dota 2 state
  const [dotaLobby, setDotaLobby] = useState<any>(null);
  const [isLaunchingDotaGame, setIsLaunchingDotaGame] = useState(false);
  const [isFlippingDotaTeams, setIsFlippingDotaTeams] = useState(false);
  const [isResendingDotaInvites, setIsResendingDotaInvites] = useState(false);
  const [inviteCooldown, setInviteCooldown] = useState(0);
  const [copiedLobbyName, setCopiedLobbyName] = useState(false);
  const [copiedLobbyPassword, setCopiedLobbyPassword] = useState(false);

  useEffect(() => {
    if (inviteCooldown <= 0) return;
    const timer = setInterval(() => {
      setInviteCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [inviteCooldown]);

  // Active Control Tab
  const [activeTab, setActiveTab] = useState<"lobby" | "players" | "referee" | "schedule" | "rcon">("lobby");

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
        if (matchData.match.dotaLobby) {
          setDotaLobby(matchData.match.dotaLobby);
        }
        if (matchData.match.scheduledAt) {
          const d = new Date(matchData.match.scheduledAt);
          const pad = (n: number) => n.toString().padStart(2, "0");
          setMatchScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
        }
        const pool = matchData.match.mapPool || [];
        const fallbackMap = pool.length > 0 ? pool[0] : (matchData.match.tournament_type === "1vs1" ? "3070549948" : "de_dust2");
        setSelectedMap(matchData.match.selectedMap || fallbackMap);
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
          flipSides: isDotaFlipped,
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

  const handleRestartServer = async () => {
    if (!confirm("Перезапустить сервер CS2 на ПК клуба? Текущий процесс будет перезапущен, а выбранная карта и участники сохранятся.")) {
      return;
    }
    setIsRestartingServer(true);
    try {
      const finalMap = customWorkshopId.trim() ? customWorkshopId.trim() : (activeCs2Match?.map_name || match.selectedMap || selectedMap);
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restart_match_server",
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
        alert(data.error || "Не удалось перезапустить сервер CS2");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при перезапуске сервера");
    } finally {
      setIsRestartingServer(false);
    }
  };

  const handleLaunchDotaGame = async () => {
    setIsLaunchingDotaGame(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "launch_dota_match",
          matchId: match.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchMatchData();
        alert("Команда запуска игры в лобби Dota 2 отправлена боту!");
      } else {
        alert(data.error || "Не удалось запустить игру в лобби Dota 2");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    } finally {
      setIsLaunchingDotaGame(false);
    }
  };

  const handleFlipDotaTeams = async () => {
    setIsFlippingDotaTeams(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "flip_dota_teams",
          matchId: match.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchMatchData();
        if (data.radiantName && data.direName) {
          alert(`Стороны изменены: Radiant — ${data.radiantName}, Dire — ${data.direName}`);
        }
      } else {
        alert(data.error || "Не удалось поменять стороны");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при смене сторон");
    } finally {
      setIsFlippingDotaTeams(false);
    }
  };

  const handleResendDotaInvites = async (accountId?: string) => {
    if (inviteCooldown > 0 || isResendingDotaInvites) return;
    setIsResendingDotaInvites(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resend_dota_invites",
          matchId: match.id,
          accountId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteCooldown(15);
        alert(data.message || "Приглашения в лобби Dota 2 повторно отправлены игрокам!");
      } else {
        alert(data.error || "Не удалось отправить приглашения в лобби Dota 2");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при отправке приглашений");
    } finally {
      setIsResendingDotaInvites(false);
    }
  };

  const handleResetLobby = async () => {
    if (!confirm("Сбросить лобби матча? Игровой сервер будет остановлен, стадия вето очищена, а матч вернется в статус ожидания.")) {
      return;
    }
    const resetCheckin = confirm("Сбросить также готовность (чек-ин) игроков?");
    setIsResettingLobby(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_match_lobby",
          matchId: match.id,
          resetCheckin,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveCs2Match(null);
        await fetchMatchData();
        alert("Лобби матча успешно сброшено");
      } else {
        alert(data.error || "Не удалось сбросить лобби");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при сбросе лобби");
    } finally {
      setIsResettingLobby(false);
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

  const handleConnectServer = () => {
    const ip = activeCs2Match?.server_ip || agent?.lan_ip || "127.0.0.1";
    const port = activeCs2Match?.port || 27015;
    const cmd = match?.connectCommand || `connect ${ip}:${port}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(cmd).catch(() => {});
    }
    setCopiedConnect(true);
    setTimeout(() => setCopiedConnect(false), 2000);
    window.location.href = `steam://connect/${ip}:${port}`;
  };

  if (loading || !match) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center text-slate-900 space-y-3 font-sans">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">
          Загрузка матча...
        </p>
      </div>
    );
  }

  const compA = match.competitorA;
  const compB = match.competitorB;
  const isDota = match.tournamentDiscipline === "dota2" || match.discipline === "dota2";
  const dotaGameModeLabel = formatDotaGameMode(
    dotaLobby?.gameMode || match.defaultDotaGameMode,
    match.tournamentType || match.tournament_type || match.type || match.tournamentConfig?.type,
    match.tournamentConfig || match.tournament_config
  );
  const isDotaFlipped = Boolean(dotaLobby?.flipped || match.result?.dota_lobby?.flipped);
  const radiantTeamName = isDotaFlipped ? (compB?.name || "Команда 2") : (compA?.name || "Команда 1");
  const direTeamName = isDotaFlipped ? (compA?.name || "Команда 1") : (compB?.name || "Команда 2");
  const statusLower = match.status?.toLowerCase() || "scheduled";
  const isFinished = statusLower === "finished";
  const matchFormat = (match.matchFormat || match.match_format || "bo1").toLowerCase();
  const dotaGames = match.dotaGames || match.result?.dota_games || [];
  const winsNeeded = matchFormat === "bo5" ? 3 : matchFormat === "bo3" ? 2 : 1;
  const isMultiGame = matchFormat === "bo3" || matchFormat === "bo5" || dotaGames.length > 0;
  const isDotaLobbyReady = dotaLobby?.status === "lobby_ready" || dotaLobby?.status === "ready";
  const isDotaLobbyLive = dotaLobby?.status === "live";
  const isServerRunning = isDota
    ? Boolean(dotaLobby && dotaLobby.status !== "stopped" && dotaLobby.status !== "finished")
    : Boolean(activeCs2Match && activeCs2Match.status !== "stopped" && activeCs2Match.status !== "finished");
  const isLive = statusLower === "live" || statusLower === "in_progress" || Boolean(activeCs2Match) || isDotaLobbyLive;

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
    : "Матч тура";
  const readyPlayersCount = checkins.filter((c) => c.is_ready).length;
  const totalRosterCount = (compA?.roster?.length || 1) + (compB?.roster?.length || 1);

  const tabList = [
    {
      id: "lobby" as const,
      label: isDota ? "Лобби Dota 2" : "Игровой сервер",
      badge: isServerRunning ? "LIVE" : isDotaLobbyReady ? "Готово" : null,
    },
    {
      id: "players" as const,
      label: "Составы и ПК",
      badge: `${readyPlayersCount}/${totalRosterCount}`,
    },
    {
      id: "referee" as const,
      label: "Судейство",
      badge: isFinished ? "Завершен" : `${match.score1 ?? 0}:${match.score2 ?? 0}`,
    },
    {
      id: "schedule" as const,
      label: "Расписание и инфо",
      badge: null,
    },
    ...(!isDota ? [{
      id: "rcon" as const,
      label: "RCON Консоль",
      badge: null,
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 selection:bg-black/10 pb-16 font-sans">
      
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push(backUrl)}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Назад к турниру"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-semibold text-slate-700 hidden sm:inline">К сетке</span>
            </button>

            <div className="w-px h-4 bg-slate-200 hidden sm:block shrink-0" />

            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-500 truncate block">
                {match.tournamentName || "Турнир"} • {stageTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={playerLobbyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold transition-all shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Лобби игроков</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. MATCH HERO BANNER */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Team A */}
            <div className="space-y-1">
              <span className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold",
                isDota
                  ? (isDotaFlipped ? "text-rose-600" : "text-emerald-600")
                  : "text-sky-600"
              )}>
                <span className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  isDota
                    ? (isDotaFlipped ? "bg-rose-500" : "bg-emerald-500")
                    : "bg-sky-500"
                )} />
                <span>{isDota ? (isDotaFlipped ? "Силы Тьмы (Dire)" : "Силы Света (Radiant)") : "Спецназ (CT)"}</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900 truncate">
                {compA?.name || "Ожидает пару..."}
              </h2>
              <div className="text-xs text-slate-500 font-medium">
                Состав: {compA?.roster?.length || 1} чел.
              </div>
            </div>

            {/* Score & Stage */}
            <div className="text-center flex flex-col items-center justify-center space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-400">
                <span>{isDota ? (isDotaFlipped ? "DIRE" : "RADIANT") : "CT"}</span>
                <span className="text-slate-300">VS</span>
                <span>{isDota ? (isDotaFlipped ? "RADIANT" : "DIRE") : "T"}</span>
              </div>
              {isDota && isMultiGame && (
                <div className="text-xs font-semibold text-slate-500 font-mono">
                  Счёт серии • {matchFormat.toUpperCase()} (до {winsNeeded} {winsNeeded === 1 ? "победы" : "побед"})
                </div>
              )}
              <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-slate-900 flex items-center justify-center gap-3">
                <span className={cn(match.winnerId === compA?.id ? "text-emerald-600" : "text-slate-900")}>
                  {match.score1 ?? 0}
                </span>
                <span className="text-slate-300 font-sans font-light">:</span>
                <span className={cn(match.winnerId === compB?.id ? "text-emerald-600" : "text-slate-900")}>
                  {match.score2 ?? 0}
                </span>
              </div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 pt-1">
                <span>{matchFormat.toUpperCase()}</span>
                <span>•</span>
                <span className="font-semibold text-slate-700">{isDota ? dotaGameModeLabel : selectedMapInfo.name}</span>
                <span>•</span>
                <span className={cn(
                  "font-semibold inline-flex items-center gap-1.5",
                  isFinished ? "text-emerald-600" : (isServerRunning || isDotaLobbyLive) ? "text-rose-600" : "text-slate-500"
                )}>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    isFinished ? "bg-emerald-500" : (isServerRunning || isDotaLobbyLive) ? "bg-rose-500 animate-pulse" : "bg-slate-400"
                  )} />
                  {isFinished
                    ? "Завершен"
                    : (isServerRunning || isDotaLobbyLive)
                    ? isDota
                      ? `LIVE • Игра ${dotaGames.length + 1}`
                      : "LIVE CS2"
                    : isDota && dotaGames.length > 0
                    ? `Игра ${dotaGames.length + 1} ожидает`
                    : "Ожидание"}
                </span>
              </div>
            </div>

            {/* Team B */}
            <div className="space-y-1 text-left md:text-right">
              <span className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold",
                isDota
                  ? (isDotaFlipped ? "text-emerald-600" : "text-rose-600")
                  : "text-orange-600"
              )}>
                <span className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  isDota
                    ? (isDotaFlipped ? "bg-emerald-500" : "bg-rose-500")
                    : "bg-orange-500"
                )} />
                <span>{isDota ? (isDotaFlipped ? "Силы Света (Radiant)" : "Силы Тьмы (Dire)") : "Террористы (T)"}</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900 truncate">
                {compB?.name || "Ожидает пару..."}
              </h2>
              <div className="text-xs text-slate-500 font-medium">
                Состав: {compB?.roster?.length || 1} чел.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN ARENA WITH TABS */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* TABS NAVIGATION */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-xs flex items-center gap-1 overflow-x-auto">
          {tabList.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer flex items-center gap-2 whitespace-nowrap",
                  isActive
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded-md font-bold",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ======================================================== */}
        {/* TAB 1: LOBBY & SERVER OPERATIONS                         */}
        {/* ======================================================== */}
        {activeTab === "lobby" && (
          <div className="space-y-6">
            {/* TOP STATUS BAR: DASHMATCH AGENT + SERVER CONNECTION */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          
          {/* DashMatch Agent Card */}
          <div className="md:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                  {isDota ? "Бот матчей" : "Игровой агент"}
                </span>
                <h3 className="text-sm font-black text-slate-900 mt-0.5">
                  {isDota ? "DashMatch Dota 2 Бот" : "DashMatch CS2 Агент"}
                </h3>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  {agent?.is_online ? `В сети • LAN IP: ${agent.lan_ip || "127.0.0.1"}` : "Агент не отвечает на хосте"}
                </div>
              </div>

              <button
                onClick={fetchMatchData}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                Обновить
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  {isDota ? "Режим лобби" : "Порты"}
                </span>
                <span className="text-slate-800 font-semibold font-mono text-xs">
                  {isDota ? dotaGameModeLabel : `${agent?.base_port || 27015} .. ${(agent?.base_port || 27015) + (agent?.max_instances || 4) - 1}`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  {isDota ? "Статус бота" : "Свободно слотов"}
                </span>
                <span className={cn("font-semibold text-xs", agent?.is_online ? "text-emerald-600" : "text-slate-400")}>
                  {isDota ? (agent?.is_online ? "Готов к матчам" : "Оффлайн") : (agent?.max_instances ? `${agent.max_instances} матчей` : "Доступен")}
                </span>
              </div>
            </div>
          </div>

          {/* Live Server / Dota Lobby Quick Actions / Status */}
          <div className="md:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                  {isDota ? "Игровое лобби Dota 2" : "Игровой сервер CS2"}
                </span>
                <h3 className="text-sm font-black text-slate-900 mt-0.5">
                  {isDota ? (
                    isServerRunning ? (
                      <span className="text-emerald-600 inline-flex items-center gap-1.5 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        {isDotaLobbyLive ? "Идет матч (Live)" : "Лобби готово • Ожидание игроков"}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-semibold">Лобби Dota 2 не создано</span>
                    )
                  ) : isServerRunning ? (
                    <span className="text-emerald-600 inline-flex items-center gap-1.5 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      Сервер запущен (Порт :{serverPort})
                    </span>
                  ) : (
                    <span className="text-slate-400 font-semibold">Сервер CS2 не запущен</span>
                  )}
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isServerRunning && (
                  <button
                    onClick={handleRestartServer}
                    disabled={isRestartingServer || isStoppingServer}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
                  >
                    Перезапустить
                  </button>
                )}

                {isServerRunning && (
                  <button
                    onClick={handleStopServer}
                    disabled={isStoppingServer || isRestartingServer}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
                  >
                    Остановить
                  </button>
                )}
              </div>
            </div>

            {isDota ? (
              isServerRunning ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Имя лобби</span>
                      <span className="text-slate-900 font-bold font-mono">{dotaLobby?.gameName || `DashMatch #${match.id}`}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(dotaLobby?.gameName || `DashMatch #${match.id}`);
                        setCopiedLobbyName(true);
                        setTimeout(() => setCopiedLobbyName(false), 2000);
                      }}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      {copiedLobbyName ? "Скопировано" : "Копировать"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Пароль</span>
                      <span className="text-emerald-700 font-bold font-mono">{dotaLobby?.password || "—"}</span>
                    </div>
                    {dotaLobby?.password && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(dotaLobby.password);
                          setCopiedLobbyPassword(true);
                          setTimeout(() => setCopiedLobbyPassword(false), 2000);
                        }}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        {copiedLobbyPassword ? "Скопировано" : "Копировать"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 pt-3 border-t border-slate-100 leading-relaxed">
                  Лобби Dota 2 создается автоматически после подтверждения готовности всеми игроками, либо вы можете создать его вручную кнопкой ниже.
                </p>
              )
            ) : isServerRunning ? (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-mono font-bold text-slate-800">
                  connect {serverIp}:{serverPort}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyConnect}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all shadow-xs cursor-pointer"
                  >
                    {copiedConnect ? "Скопировано" : "Копировать"}
                  </button>
                  <button
                    onClick={handleConnectServer}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                  >
                    Войти в CS2
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 pt-3 border-t border-slate-100 leading-relaxed">
                Вы можете запустить выделенный сервер матча на ПК клуба вручную или дождаться автоматического запуска после вето игроков.
              </p>
            )}
          </div>

        </div>

            {/* MAIN OPERATIONAL DECK */}
            {isDota ? (
              <>
                {/* DOTA 2 SERIES GAMES TRACKER (BO3 / BO5) */}
                {isMultiGame && (
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Серия матча • {matchFormat.toUpperCase()}
                        </div>
                        <h3 className="text-base font-black uppercase tracking-tight text-slate-900 mt-0.5">
                          Счёт серии: {match.score1 ?? 0} : {match.score2 ?? 0}
                        </h3>
                      </div>
                      <div className="text-xs font-mono text-slate-500 font-semibold">
                        До {winsNeeded} {winsNeeded === 1 ? "победы" : "побед"}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {dotaGames.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {dotaGames.map((game: any, idx: number) => {
                            const gameWinnerComp = game.winner_competitor_id === compA?.id
                              ? compA
                              : game.winner_competitor_id === compB?.id
                              ? compB
                              : null;
                            const radiantComp = game.radiant_competitor_id === compB?.id ? compB : compA;
                            const direComp = game.dire_competitor_id === compA?.id ? compA : compB;

                            return (
                              <div
                                key={game.game_number || idx}
                                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 flex-wrap"
                              >
                                <div>
                                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                    <span className="font-mono text-slate-400">#{game.game_number || idx + 1}</span>
                                    <span className="text-emerald-700 font-semibold">{radiantComp?.name || "Команда 1"}</span>
                                    <span className="text-slate-300">vs</span>
                                    <span className="text-rose-700 font-semibold">{direComp?.name || "Команда 2"}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    Киллы: <strong className="text-slate-800">{game.radiant_score ?? 0} : {game.dire_score ?? 0}</strong> • Длительность: {formatDotaDuration(game.duration)}
                                  </div>
                                </div>

                                <span className={cn(
                                  "text-xs font-bold",
                                  gameWinnerComp ? "text-emerald-600" : "text-slate-600"
                                )}>
                                  Победа: {gameWinnerComp?.name || (game.radiant_win ? "Radiant" : "Dire")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic py-1">
                          Игры серии еще не завершены. После окончания каждой карты её статистика появится здесь.
                        </p>
                      )}

                      {/* Ongoing game indicator */}
                      {!isFinished && (
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                          <div className="text-xs">
                            <span className="text-slate-500">Текущая игра: </span>
                            <span className="text-slate-900 font-bold">Игра {dotaGames.length + 1}</span>
                            <span className="text-slate-400 text-[11px] font-mono ml-2">
                              ({radiantTeamName} за Radiant ⇄ {direTeamName} за Dire)
                            </span>
                          </div>

                          {!dotaLobby || dotaLobby.status === "stopped" ? (
                            <button
                              type="button"
                              disabled={isLaunchingServer || !agent?.is_online}
                              onClick={handleLaunchServer}
                              className="px-4 py-2 bg-slate-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                            >
                              {isLaunchingServer ? "Запуск..." : `Запустить Игру ${dotaGames.length + 1}`}
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-emerald-600">
                              Лобби активно
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* DOTA 2 LOBBY MANAGEMENT */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-5 shadow-xs">
                  <div className="border-b border-slate-100 pb-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Управление матчем
                    </div>
                    <h3 className="text-base font-black uppercase tracking-tight text-slate-900 mt-0.5">
                      Лобби Dota 2
                    </h3>
                  </div>

                  {dotaLobby && dotaLobby.status !== "stopped" ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className={cn(
                          "text-xs font-bold inline-flex items-center gap-1.5",
                          dotaLobby.status === "live"
                            ? "text-rose-600"
                            : isDotaLobbyReady
                            ? "text-emerald-600"
                            : "text-blue-600"
                        )}>
                          <span className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            dotaLobby.status === "live"
                              ? "bg-rose-500 animate-pulse"
                              : isDotaLobbyReady
                              ? "bg-emerald-500"
                              : "bg-blue-500"
                          )} />
                          {dotaLobby.status === "live" ? (
                            "Live Матч идет"
                          ) : isDotaLobbyReady ? (
                            "Лобби готово • Ожидание игроков"
                          ) : (
                            "Создание лобби ботом..."
                          )}
                        </span>

                        <div className="text-xs font-mono text-slate-500">
                          {dotaGameModeLabel} • {dotaLobby.serverRegion || "Stockholm"}
                        </div>
                      </div>

                      {/* Credentials */}
                      <div className="divide-y divide-slate-100 border-y border-slate-100 py-1 text-xs">
                        <div className="py-2.5 flex items-center justify-between">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Имя лобби</span>
                            <span className="text-slate-900 font-bold font-mono text-sm">
                              {dotaLobby.gameName || `DashMatch #${match.id}`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(dotaLobby.gameName || `DashMatch #${match.id}`);
                              setCopiedLobbyName(true);
                              setTimeout(() => setCopiedLobbyName(false), 2000);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            {copiedLobbyName ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                            <span>{copiedLobbyName ? "Скопировано" : "Копировать"}</span>
                          </button>
                        </div>

                        <div className="py-2.5 flex items-center justify-between">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Пароль</span>
                            <span className="text-slate-900 font-bold font-mono text-sm">
                              {dotaLobby.password || "—"}
                            </span>
                          </div>
                          {dotaLobby.password && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(dotaLobby.password);
                              setCopiedLobbyPassword(true);
                              setTimeout(() => setCopiedLobbyPassword(false), 2000);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            {copiedLobbyPassword ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                            <span>{copiedLobbyPassword ? "Скопировано" : "Копировать"}</span>
                          </button>
                        )}
                        </div>
                      </div>

                      {/* Sides Assignment with Flip & Resend Buttons */}
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-4 flex-wrap text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span className="text-emerald-700 font-bold">Силы Света (Radiant):</span>
                              <span className="font-semibold text-slate-900">{radiantTeamName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                              <span className="text-rose-700 font-bold">Силы Тьмы (Dire):</span>
                              <span className="font-semibold text-slate-900">{direTeamName}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isFlippingDotaTeams}
                            onClick={handleFlipDotaTeams}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <ArrowLeftRight className={cn("w-3.5 h-3.5", isFlippingDotaTeams && "animate-spin")} />
                            <span>{isFlippingDotaTeams ? "Смена..." : "Поменять стороны ⇄"}</span>
                          </button>
                        </div>

                        {/* Resend invite button with cooldown */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-[11px] text-slate-500">
                            Игроки не получили инвайт или возник кулдаун в Steam?
                          </span>
                          <button
                            type="button"
                            disabled={isResendingDotaInvites || inviteCooldown > 0}
                            onClick={() => handleResendDotaInvites()}
                            className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <Send className={cn("w-3.5 h-3.5", isResendingDotaInvites && "animate-pulse")} />
                            <span>
                              {isResendingDotaInvites
                                ? "Отправка..."
                                : inviteCooldown > 0
                                ? `Кулдаун (${inviteCooldown}с)`
                                : "Отправить инвайты повторно ↻"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        {isDotaLobbyReady && (
                          <button
                            type="button"
                            disabled={isLaunchingDotaGame}
                            onClick={handleLaunchDotaGame}
                            className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isLaunchingDotaGame ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Запуск игры в клиенте Dota 2...</span>
                              </>
                            ) : (
                              <span>Запустить игру в лобби Dota 2</span>
                            )}
                          </button>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            disabled={isRestartingServer || isStoppingServer}
                            onClick={handleRestartServer}
                            className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5", isRestartingServer && "animate-spin")} />
                            <span>Перезапустить</span>
                          </button>

                          <button
                            type="button"
                            disabled={isStoppingServer || isRestartingServer}
                            onClick={handleStopServer}
                            className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <Pause className="w-3.5 h-3.5" />
                            <span>Закрыть лобби</span>
                          </button>

                          <button
                            type="button"
                            disabled={isResettingLobby}
                            onClick={handleResetLobby}
                            className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <RotateCcw className={cn("w-3.5 h-3.5", isResettingLobby && "animate-spin")} />
                            <span>Сбросить</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* DOTA LOBBY NOT LAUNCHED */
                    <div className="space-y-4">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Бот DashMatch автоматически создаст лобби в Dota 2 с заданным регламентом, распределит команды по сторонам (Radiant / Dire) и разошлет приглашения игрокам по Steam ID.
                      </p>

                      {/* Sides Preview before launch */}
                      <div className="py-2.5 border-y border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-emerald-700 font-bold">Radiant:</span>
                            <span className="font-semibold text-slate-900">{radiantTeamName}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span className="text-rose-700 font-bold">Dire:</span>
                            <span className="font-semibold text-slate-900">{direTeamName}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isFlippingDotaTeams}
                          onClick={handleFlipDotaTeams}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <ArrowLeftRight className={cn("w-3.5 h-3.5", isFlippingDotaTeams && "animate-spin")} />
                          <span>Поменять стороны ⇄</span>
                        </button>
                      </div>

                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          onClick={handleLaunchServer}
                          disabled={isLaunchingServer || !agent?.is_online}
                          className="w-full py-3 bg-slate-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isLaunchingServer ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Создание лобби в Dota 2...</span>
                            </>
                          ) : (
                            <span>Создать лобби Dota 2 сейчас</span>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isResettingLobby}
                          onClick={handleResetLobby}
                          className="w-full py-2 hover:bg-slate-50 disabled:opacity-50 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className={cn("w-3.5 h-3.5", isResettingLobby && "animate-spin")} />
                          <span>Сбросить статус лобби</span>
                        </button>
                      </div>

                      {!agent?.is_online && (
                        <div className="pt-3 border-t border-slate-100 text-amber-700 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                          <span>
                            Агент DashMatch на ПК клуба сейчас не на связи. Запустите <strong>dashmatch.exe</strong> на выделенном компьютере для работы бота.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* SERVER LAUNCHER */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-5 shadow-xs">
                  <div className="border-b border-slate-100 pb-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Запуск матча
                    </div>
                    <h3 className="text-base font-black uppercase tracking-tight text-slate-900 mt-0.5">
                      Параметры сервера CS2
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Map Picker */}
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Игровая карта матча:
                      </label>
                      <select
                        value={selectedMap}
                        onChange={(e) => setSelectedMap(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400 transition-all shadow-xs cursor-pointer"
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
                          <option value="de_inferno">Inferno — Плент B (de_inferno)</option>
                          <option value="de_vertigo">Vertigo — Плент B (de_vertigo)</option>
                          <option value="de_nuke">Nuke — Плент B (de_nuke)</option>
                          <option value="de_overpass">Overpass — Плент B (de_overpass)</option>
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
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Или Steam Workshop ID карты (опционально):
                      </label>
                      <input
                        type="text"
                        placeholder="Например: 3070549948"
                        value={customWorkshopId}
                        onChange={(e) => setCustomWorkshopId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-all font-mono shadow-xs"
                      />
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all">
                        <input
                          type="checkbox"
                          checked={knifeRound}
                          onChange={(e) => setKnifeRound(e.target.checked)}
                          className="w-4 h-4 rounded text-slate-900 focus:ring-0 cursor-pointer accent-slate-900"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Ножевой раунд (.knife)</span>
                          <span className="text-[10px] text-slate-500">Выбор стороны за победителем</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all">
                        <input
                          type="checkbox"
                          checked={practiceMode}
                          onChange={(e) => setPracticeMode(e.target.checked)}
                          className="w-4 h-4 rounded text-slate-900 focus:ring-0 cursor-pointer accent-slate-900"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Режим тренировки</span>
                          <span className="text-[10px] text-slate-500">Без строгого вайтлиста игроков</span>
                        </div>
                      </label>
                    </div>

                    {/* Launch, Restart & Reset Buttons */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          onClick={handleLaunchServer}
                          disabled={isLaunchingServer || isRestartingServer || !agent?.is_online}
                          className="py-3 px-4 bg-slate-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isLaunchingServer ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Инициализация CS2...</span>
                            </>
                          ) : (
                            <span>Запустить сервер CS2</span>
                          )}
                        </button>

                        <button
                          onClick={handleRestartServer}
                          disabled={isRestartingServer || isLaunchingServer || !agent?.is_online}
                          className="py-3 px-4 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isRestartingServer ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Перезапуск...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4" />
                              <span>Перезапустить сервер</span>
                            </>
                          )}
                        </button>
                      </div>

                      <button
                        onClick={handleResetLobby}
                        disabled={isResettingLobby}
                        className="w-full py-2 hover:bg-slate-50 disabled:opacity-50 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isResettingLobby ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>Сбросить лобби и стадию вето</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

    {/* ======================================================== */}
    {/* TAB 2: PLAYERS & CHECKINS                                */}
    {/* ======================================================== */}
    {activeTab === "players" && (
      <div className="space-y-6">
        {/* Status summary bar */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">
              Готовность составов за ПК
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {readyPlayersCount} из {totalRosterCount} участников подтвердили готовность в клубе
            </p>
          </div>

          <button
            type="button"
            onClick={fetchMatchData}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Обновить статусы</span>
          </button>
        </div>

        {/* Two Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team A */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  isDota ? (isDotaFlipped ? "text-rose-600" : "text-emerald-600") : "text-sky-600"
                )}>
                  {isDota ? (isDotaFlipped ? "Силы Тьмы (Dire)" : "Силы Света (Radiant)") : "Спецназ (CT)"}
                </span>
                <h4 className="text-base font-black text-slate-900 truncate mt-0.5">
                  {compA?.name || "Команда 1"}
                </h4>
              </div>
              <span className="text-xs font-semibold text-slate-400 font-mono">
                {compA?.roster?.length || 1} участников
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {(compA?.roster || [{ id: compA?.playerId, full_name: compA?.name, nickname: compA?.name }]).map((p: any) => {
                const checkin = checkins.find((c) => String(c.player_id) === String(p.id));
                const pName = p.nickname || p.full_name || p.name || "Игрок";
                const ratingStr = isDota
                  ? (p.dota_mmr ? `${p.dota_mmr} MMR` : p.dota_rank_name || "Dota 2")
                  : (p.player_elo ? `${p.player_elo} ELO` : null);
                const hasSteam = Boolean(p.steam_id || p.steamId);

                return (
                  <div key={p.id || pName} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          {p.full_name || pName}
                        </span>
                        {p.nickname && p.full_name && p.nickname !== p.full_name && (
                          <span className="text-slate-500 text-xs font-medium">
                            (@{p.nickname})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono flex-wrap">
                        <span className="font-semibold text-slate-700">ПК #{checkin?.pc_number || "—"}</span>
                        {ratingStr && <span>• {ratingStr}</span>}
                        <span>•</span>
                        <span className={hasSteam ? "text-emerald-700 font-medium" : "text-slate-400"}>
                          {hasSteam ? "Steam подключен" : "Steam не привязан"}
                        </span>
                        {p.phone && <span>• {p.phone}</span>}
                      </div>
                    </div>

                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-semibold shrink-0",
                      checkin?.is_ready ? "text-emerald-600" : "text-slate-400"
                    )}>
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        checkin?.is_ready ? "bg-emerald-500" : "bg-slate-300"
                      )} />
                      {checkin?.is_ready ? "Готов" : "Ожидает"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team B */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  isDota ? (isDotaFlipped ? "text-emerald-600" : "text-rose-600") : "text-orange-600"
                )}>
                  {isDota ? (isDotaFlipped ? "Силы Света (Radiant)" : "Силы Тьмы (Dire)") : "Террористы (T)"}
                </span>
                <h4 className="text-base font-black text-slate-900 truncate mt-0.5">
                  {compB?.name || "Команда 2"}
                </h4>
              </div>
              <span className="text-xs font-semibold text-slate-400 font-mono">
                {compB?.roster?.length || 1} участников
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {(compB?.roster || [{ id: compB?.playerId, full_name: compB?.name, nickname: compB?.name }]).map((p: any) => {
                const checkin = checkins.find((c) => String(c.player_id) === String(p.id));
                const pName = p.nickname || p.full_name || p.name || "Игрок";
                const ratingStr = isDota
                  ? (p.dota_mmr ? `${p.dota_mmr} MMR` : p.dota_rank_name || "Dota 2")
                  : (p.player_elo ? `${p.player_elo} ELO` : null);
                const hasSteam = Boolean(p.steam_id || p.steamId);

                return (
                  <div key={p.id || pName} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          {p.full_name || pName}
                        </span>
                        {p.nickname && p.full_name && p.nickname !== p.full_name && (
                          <span className="text-slate-500 text-xs font-medium">
                            (@{p.nickname})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono flex-wrap">
                        <span className="font-semibold text-slate-700">ПК #{checkin?.pc_number || "—"}</span>
                        {ratingStr && <span>• {ratingStr}</span>}
                        <span>•</span>
                        <span className={hasSteam ? "text-emerald-700 font-medium" : "text-slate-400"}>
                          {hasSteam ? "Steam подключен" : "Steam не привязан"}
                        </span>
                        {p.phone && <span>• {p.phone}</span>}
                      </div>
                    </div>

                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-semibold shrink-0",
                      checkin?.is_ready ? "text-emerald-600" : "text-slate-400"
                    )}>
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        checkin?.is_ready ? "bg-emerald-500" : "bg-slate-300"
                      )} />
                      {checkin?.is_ready ? "Готов" : "Ожидает"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ======================================================== */}
    {/* TAB 3: REFEREE & MANUAL SCORE                            */}
    {/* ======================================================== */}
    {activeTab === "referee" && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* MANUAL SCORE & RESULT */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-6 space-y-5 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Судейская панель
            </div>
            <h3 className="text-base font-black uppercase tracking-tight text-slate-900 mt-0.5">
              Управление счетом матча
            </h3>
          </div>

          {/* Score Editor */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 text-center">
                <label className="text-xs font-bold uppercase text-slate-700 truncate block">
                  {compA?.name || "Команда 1"}
                </label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={score1}
                  onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                  className="w-full text-center bg-white border border-slate-200 rounded-xl py-2.5 text-2xl font-black font-mono text-slate-900 focus:outline-none focus:border-slate-400 shadow-xs"
                />
              </div>

              <div className="space-y-1.5 text-center">
                <label className="text-xs font-bold uppercase text-slate-700 truncate block">
                  {compB?.name || "Команда 2"}
                </label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={score2}
                  onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                  className="w-full text-center bg-white border border-slate-200 rounded-xl py-2.5 text-2xl font-black font-mono text-slate-900 focus:outline-none focus:border-slate-400 shadow-xs"
                />
              </div>
            </div>

            <button
              onClick={handleFinishMatch}
              disabled={isSubmittingScore}
              className="w-full py-3 bg-slate-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmittingScore ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : null}
              <span>Подтвердить счет и завершить</span>
            </button>
          </div>

          {/* Technical Victory Buttons */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Техническая победа (ТП):
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTechWin(compA?.id, compB?.name || "Команда 2")}
                disabled={!compA?.id}
                className="py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-xs truncate cursor-pointer disabled:opacity-40"
              >
                Победа {compA?.name || "Команда 1"}
              </button>

              <button
                onClick={() => handleTechWin(compB?.id, compA?.name || "Команда 1")}
                disabled={!compB?.id}
                className="py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-xs truncate cursor-pointer disabled:opacity-40"
              >
                Победа {compB?.name || "Команда 2"}
              </button>
            </div>
          </div>
        </div>

        {/* PROTOCOL & SERIES GAMES */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 space-y-5 shadow-xs">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Протокол матча
              </div>
              <h3 className="text-base font-black uppercase tracking-tight text-slate-900 mt-0.5">
                История игр серии • {matchFormat.toUpperCase()}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600">
              До {winsNeeded} {winsNeeded === 1 ? "победы" : "побед"}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {dotaGames.length > 0 ? (
              dotaGames.map((game: any, idx: number) => {
                const gameWinnerComp = game.winner_competitor_id === compA?.id
                  ? compA
                  : game.winner_competitor_id === compB?.id
                  ? compB
                  : null;
                const radiantComp = game.radiant_competitor_id === compB?.id ? compB : compA;
                const direComp = game.dire_competitor_id === compA?.id ? compA : compB;

                return (
                  <div
                    key={game.game_number || idx}
                    className="py-3.5 flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span className="font-mono text-slate-400">#{game.game_number || idx + 1}</span>
                        <span className="text-emerald-700 font-mono">Radiant ({radiantComp?.name || "Команда 1"})</span>
                        <span className="text-slate-400 font-light">vs</span>
                        <span className="text-rose-700 font-mono">Dire ({direComp?.name || "Команда 2"})</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Счёт киллов: <strong className="text-slate-800">{game.radiant_score ?? 0} : {game.dire_score ?? 0}</strong> • Длительность: {formatDotaDuration(game.duration)}
                      </div>
                    </div>

                    <span className="text-xs font-bold text-emerald-700 font-mono">
                      {gameWinnerComp?.name || (game.radiant_win ? "Radiant Win" : "Dire Win")}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">Игры серии еще не зарегистрированы</p>
                <p className="text-slate-400 max-w-md mx-auto">
                  Результаты сыгранных карт появятся здесь автоматически по завершению лобби, либо вы можете выставить итоговый счёт вручную в форме слева.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* ======================================================== */}
    {/* TAB 4: SCHEDULE & REGULATIONS                            */}
    {/* ======================================================== */}
    {activeTab === "schedule" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* SCHEDULE DATE/TIME PICKER */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-5 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Время начала
            </div>
            <h3 className="text-base font-black uppercase tracking-tight text-slate-900 mt-0.5">
              Расписание матча
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Запланированное время матча:
              </label>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={matchScheduledAt}
                  onChange={(e) => setMatchScheduledAt(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400 shadow-xs"
                />
                <button
                  onClick={handleUpdateMatchSchedule}
                  disabled={isUpdatingSchedule}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Сохранить</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
              Время отображается в турнирной сетке и расписании клуба. Игроки получат напоминание в личном кабинете.
            </p>
          </div>
        </div>

        {/* REGULATIONS & PUBLIC LINK */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-5 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Регламент
            </div>
            <h3 className="text-base font-black uppercase tracking-tight text-slate-900 mt-0.5">
              Параметры матча
            </h3>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Дисциплина</span>
              <span className="font-bold text-slate-900">{isDota ? "Dota 2" : "Counter-Strike 2"}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Формат матча</span>
              <span className="font-bold text-slate-900 uppercase">{matchFormat} (до {winsNeeded} {winsNeeded === 1 ? "победы" : "побед"})</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-500">Режим игры</span>
              <span className="font-bold text-slate-900">{isDota ? dotaGameModeLabel : selectedMapInfo.name}</span>
            </div>

            <div className="py-2.5 space-y-2">
              <span className="text-slate-500 block">Ссылка на страницу лобби игроков:</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}${playerLobbyUrl}` : playerLobbyUrl}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] font-mono text-slate-700 shadow-xs"
                />
                <a
                  href={playerLobbyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 font-semibold text-xs transition-all shadow-xs flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Открыть</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ======================================================== */}
    {/* TAB 5: CS2 RCON & MATCHZY CONSOLE                        */}
    {/* ======================================================== */}
    {activeTab === "rcon" && !isDota && (
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-5 shadow-xs">
        <div className="border-b border-slate-100 pb-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Управление сервером в реальном времени
          </div>
          <h3 className="text-base font-black uppercase tracking-tight text-slate-900 mt-0.5">
            MatchZy & RCON команды
          </h3>
        </div>

        {/* Quick RCON Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => handleSendRcon("css_forcepause")}
            disabled={isSendingRcon || !isServerRunning}
            className="p-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl text-xs font-semibold text-slate-800 transition-all flex flex-col items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Pause className="w-4 h-4 text-slate-600" />
            <span>Пауза (.forcepause)</span>
          </button>

          <button
            onClick={() => handleSendRcon("css_forceunpause")}
            disabled={isSendingRcon || !isServerRunning}
            className="p-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl text-xs font-semibold text-slate-800 transition-all flex flex-col items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Play className="w-4 h-4 text-slate-600" />
            <span>Снять паузу</span>
          </button>

          <button
            onClick={() => handleSendRcon("css_start")}
            disabled={isSendingRcon || !isServerRunning}
            className="p-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl text-xs font-semibold text-slate-800 transition-all flex flex-col items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Zap className="w-4 h-4 text-slate-600" />
            <span>Старт LIVE</span>
          </button>

          <button
            onClick={() => handleSendRcon("mp_restartgame 1")}
            disabled={isSendingRcon || !isServerRunning}
            className="p-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl text-xs font-semibold text-slate-800 transition-all flex flex-col items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-slate-600" />
            <span>Рестарт раунда</span>
          </button>
        </div>

        {/* Restore Round Selector */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
            <span>Откат раунда MatchZy Backup</span>
            <span className="text-[10px] text-slate-400 font-mono">css_restore</span>
          </div>
          <div className="flex gap-2">
            <select
              value={restoreRound}
              onChange={(e) => setRestoreRound(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400 shadow-xs cursor-pointer"
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
              className="px-4 py-2 bg-slate-900 hover:bg-black disabled:opacity-40 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer"
            >
              Откатить
            </button>
          </div>
        </div>

        {/* Live Interactive RCON Console */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Интерактивная RCON консоль:
          </label>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 font-mono text-xs text-slate-200 min-h-[120px] max-h-[180px] overflow-y-auto space-y-1">
            {rconLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-8">
                Введите команду для выполнения на игровом сервере CS2...
              </div>
            ) : (
              rconLogs.map((log, idx) => (
                <div key={idx} className={cn("text-xs leading-relaxed", log.type === "sent" ? "text-orange-400 font-bold" : "text-slate-300")}>
                  <span className="text-slate-600 mr-2">[{log.time}]</span>
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
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-all shadow-xs"
            />
            <button
              type="submit"
              disabled={isSendingRcon || !rconCommandInput.trim() || !isServerRunning}
              className="px-4 py-2 bg-slate-900 hover:bg-black disabled:opacity-40 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Отправить</span>
            </button>
          </form>
        </div>
      </div>
    )}

      </main>
    </div>
  );
}
