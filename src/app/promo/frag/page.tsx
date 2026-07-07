"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2,
  Wifi,
  WifiOff,
  Crosshair,
  Sword,
  Skull,
  HandHelping,
  Star,
  Trophy,
  Zap,
  Clock,
  Flame,
  Play,
  Swords,
  CircleCheck,
  Check,
} from "lucide-react";
import { PromoHeader } from "../components/PromoHeader";
import { BottomNav } from "../components/BottomNav";
import { cn } from "@/lib/utils";

const AGENT_URL = "http://localhost:3033";

interface AgentState {
  ActiveGame: string;
  PlayerName: string;
  SteamId: string;
  Kills: number;
  Deaths: number;
  Assists: number;
  Headshots: number;
  RoundKills: number;
  Mvps: number;
  Score: number;
  LastHits: number;
  Denies: number;
  NetWorth: number;
  KillStreak: number;
  Gpm: number;
  MapName: string;
  MyTeamScore: number;
  OpponentTeamScore: number;
  ActiveWeapon: string;
  ActiveWeaponAmmo: number;
  ActiveWeaponReserve: number;
  EarnedBonuses: number;
  ActivityFeed: string[];
  PromoLoggedIn: boolean;
  PromoPlayerName: string;
  PromoBalance: number;
  PromoClubName: string;
  FragEnabledByClub: boolean;
  IsModeSupported?: boolean;
}

interface FragMatch {
  id: string;
  game: string;
  map: string;
  score: string;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  last_hits: number;
  earned: string;
  played_at: string;
}

const DEFAULT_CS2_TARIFFS = [
  { label: "Килл", value: 0.50 },
  { label: "Хедшот", value: 1.00 },
  { label: "С ножа", value: 5.00 },
  { label: "Зевс", value: 3.00 },
  { label: "Ассист", value: 0.25 },
  { label: "MVP", value: 1.00 },
  { label: "Победа", value: 10.00 },
];

const DEFAULT_DOTA_TARIFFS = [
  { label: "Килл героя", value: 0.50 },
  { label: "Ассист", value: 0.25 },
  { label: "Ластхит (10)", value: 0.05 },
  { label: "Денай (5)", value: 0.05 },
  { label: "Неворт (1k)", value: 0.10 },
  { label: "Победа", value: 10.00 },
];

export default function FragPage() {
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [agentOnline, setAgentOnline] = useState(false);
  const [history, setHistory] = useState<FragMatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [player, setPlayer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"CS2" | "Dota2">("CS2");
  const [mounted, setMounted] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const toggleMatchExpand = (matchId: string) => {
    setExpandedMatchId(expandedMatchId === matchId ? null : matchId);
  };

  // Poll local agent status
  const pollAgent = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_URL}/status`, { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        const data = await res.json();
        setAgentState(data);
        setAgentOnline(true);

        // Auto-login/sync cookies if agent is online but not logged in
        if (data && !data.PromoLoggedIn) {
          try {
            const cookiesRes = await fetch("/api/promo/auth/cookies");
            if (cookiesRes.ok) {
              const cookiesData = await cookiesRes.json();
              if (cookiesData.cookies) {
                await fetch(`${AGENT_URL}/promo/set-cookies`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ cookies: cookiesData.cookies }),
                });
              }
            }
          } catch (syncErr) {
            console.error("Failed to auto-sync cookies to agent:", syncErr);
          }
        }
      }
    } catch {
      setAgentOnline(false);
    }
  }, []);

  // Fetch match history from server and local agent
  const loadHistory = useCallback(async () => {
    try {
      // 1. Fetch from server
      let serverMatches: FragMatch[] = [];
      try {
        const res = await fetch("/api/promo/frag/history");
        if (res.ok) {
          const data = await res.json();
          serverMatches = data.matches || [];
        }
      } catch (e) {
        console.error("Failed to load history from server:", e);
      }

      // 2. Fetch from local agent if online
      let localMatches: any[] = [];
      try {
        const res = await fetch(`${AGENT_URL}/history`, { signal: AbortSignal.timeout(1200) });
        if (res.ok) {
          localMatches = await res.json();
        }
      } catch (e) {
        // local agent is offline or failed
      }

      // Normalize local matches to match server format (lowercase keys)
      const normalizedLocalMatches: FragMatch[] = localMatches.map((m: any, idx: number) => ({
        id: `local-${m.Timestamp}-${idx}`,
        game: m.Game || "CS2",
        map: m.Map || "Unknown",
        score: m.Score || "0:0",
        kills: m.Kills || 0,
        deaths: m.Deaths || 0,
        assists: m.Assists || 0,
        headshots: m.Headshots || 0,
        last_hits: m.LastHits || 0,
        earned: (m.EarnedBonuses || 0).toString(),
        events: m.Events || [],
        played_at: m.Timestamp ? new Date(m.Timestamp.replace(" ", "T")).toISOString() : new Date().toISOString(),
      }));

      // Merge and deduplicate by timestamp/played_at proximity (within 1 minute) and similar kills
      const merged = [...serverMatches];
      for (const lm of normalizedLocalMatches) {
        const exists = serverMatches.some(sm => {
          const sTime = new Date(sm.played_at).getTime();
          const lTime = new Date(lm.played_at).getTime();
          return Math.abs(sTime - lTime) < 60000 && sm.kills === lm.kills;
        });
        if (!exists) {
          merged.push(lm);
        }
      }

      // Sort merged matches by played_at descending
      merged.sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());

      setHistory(merged);
    } catch (e) {
      console.error("Failed to merge history:", e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Fetch player details
  const loadPlayer = useCallback(async () => {
    try {
      const res = await fetch("/api/promo/player");
      if (res.ok) {
        const data = await res.json();
        setPlayer(data.player);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    pollAgent();
    loadPlayer();
    loadHistory();

    const agentInterval = setInterval(pollAgent, 1000);
    const historyInterval = setInterval(loadHistory, 12000);

    return () => {
      clearInterval(agentInterval);
      clearInterval(historyInterval);
    };
  }, [pollAgent, loadHistory, loadPlayer]);

  // Auto-switch tab if game is running
  useEffect(() => {
    if (agentOnline && agentState?.ActiveGame && agentState.ActiveGame !== "None") {
      setActiveTab(agentState.ActiveGame === "Dota2" ? "Dota2" : "CS2");
    }
  }, [agentOnline, agentState?.ActiveGame]);

  if (!mounted) return null;

  const isPlaying = agentState?.ActiveGame !== "None" && agentState?.ActiveGame != null;
  const isPlayingCS2 = agentOnline && isPlaying && agentState?.ActiveGame === "CS2";
  const isPlayingDota = agentOnline && isPlaying && agentState?.ActiveGame === "Dota2";

  const fragSettings = player?.settings?.frag;
  const fragEnabled = fragSettings?.is_active !== false;
  const st = fragSettings?.tariffs;

  // Compile tariffs
  const cs2Tariffs = st ? [
    { label: "Килл", value: st.cs2_kill ?? 0.50 },
    { label: "Хедшот", value: (st.cs2_kill ?? 0.50) + (st.cs2_hs ?? 0.50) },
    { label: "С ножа", value: (st.cs2_kill ?? 0.50) + (st.cs2_knife ?? 4.50) },
    { label: "Зевс", value: (st.cs2_kill ?? 0.50) + (st.cs2_zeus ?? 2.50) },
    { label: "Ассист", value: st.cs2_assist ?? 0.25 },
    { label: "MVP", value: st.cs2_mvp ?? 1.00 },
    { label: "Победа", value: st.cs2_win ?? 10.00 },
  ] : DEFAULT_CS2_TARIFFS;

  const dotaTariffs = st ? [
    { label: "Килл героя", value: st.dota_kill ?? 0.50 },
    { label: "Ассист", value: st.dota_assist ?? 0.25 },
    { label: "Ластхит (10)", value: st.dota_lasthit_10 ?? 0.05 },
    { label: "Денай (5)", value: st.dota_denies_5 ?? 0.05 },
    { label: "Неворт (1k)", value: st.dota_networth_1000 ?? 0.10 },
    { label: "Победа", value: st.dota_win ?? 10.00 },
  ] : DEFAULT_DOTA_TARIFFS;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-28 font-sans">
      <PromoHeader initialPlayer={player} title="Игровая зона" />
      <div className="max-w-xl mx-auto px-4 pt-6 space-y-6">

        {/* TYPOGRAPHY HEADER */}
        <div className="text-center py-2">
          <h1 className="text-2xl font-black uppercase tracking-tight mb-2">
            Играй и получай <span className="text-orange-500">бонусы</span>
          </h1>
          <p className="text-gray-500 text-xs max-w-sm mx-auto leading-relaxed">
            Полноценный трекинг игровых матчей в клубе. Ваши достижения автоматически конвертируются в реальный баланс.
          </p>
        </div>

        {/* COMPACT ONLINE STATUS & ACTION */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border border-white/5 rounded-full text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-2 h-2 rounded-full",
                agentOnline ? "bg-green-500" : "bg-orange-500 animate-pulse"
              )} />
              <span className="text-gray-400">
                {agentOnline
                  ? isPlaying
                    ? `В игре: ${agentState?.ActiveGame}`
                    : "Агент активен, ожидание игры"
                  : "Агент отключен"
                }
              </span>
            </div>
            {!agentOnline && (
              <a href="dashfrag://launch" className="text-orange-500 hover:text-orange-400 flex items-center gap-1">
                <Play className="w-3 h-3 fill-current" /> Запустить
              </a>
            )}
          </div>
          {!fragEnabled && (
            <div className="text-center text-[10px] font-black uppercase text-red-400 tracking-wider">
              ⚠️ Модуль Frag отключен администратором клуба
            </div>
          )}
        </div>

        {/* GAME TAB SELECTOR */}
        <div className="bg-white/5 p-1 rounded-2xl flex items-center border border-white/5">
          <button
            onClick={() => setActiveTab("CS2")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === "CS2" ? "bg-[#1c1c1e] text-white shadow-lg" : "text-gray-500 hover:text-gray-300"
            )}
          >
            Counter-Strike 2
          </button>
          <button
            onClick={() => setActiveTab("Dota2")}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === "Dota2" ? "bg-[#1c1c1e] text-white shadow-lg" : "text-gray-500 hover:text-gray-300"
            )}
          >
            Dota 2
          </button>
        </div>

        {/* ACTIVE CS2 SESSION IN TAB */}
        <AnimatePresence mode="wait">
          {activeTab === "CS2" && isPlayingCS2 && agentState && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-orange-400 tracking-wider uppercase">{agentState.MapName}</span>
                <span className="font-black text-white bg-white/10 px-2 py-0.5 rounded">
                  {agentState.MyTeamScore} : {agentState.OpponentTeamScore}
                </span>
              </div>

              {agentState.IsModeSupported === false && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium p-3.5 rounded-2xl flex flex-col gap-1 text-left">
                  <span className="flex items-center gap-1.5 text-xs font-black uppercase text-red-500">
                    ⚠️ Режим игры не поддерживается
                  </span>
                  <span>Начисление бонусов отключено. Пожалуйста, играйте в соревновательном режиме (MM), Премьере или Faceit.</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-y-4 gap-x-2 text-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <div>
                  <div className="text-xl font-black">{agentState.Kills}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Киллы</div>
                </div>
                <div>
                  <div className="text-xl font-black">{agentState.Assists}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Ассисты</div>
                </div>
                <div>
                  <div className="text-xl font-black">{agentState.Deaths}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Смерти</div>
                </div>
                <div>
                  <div className="text-xl font-black">{agentState.Headshots}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Хедшоты</div>
                </div>
                <div>
                  <div className="text-xl font-black">{agentState.Mvps}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">MVP</div>
                </div>
                <div>
                  <div className="text-xl font-black">+{agentState.EarnedBonuses.toFixed(1)} ₽</div>
                  <div className="text-[9px] uppercase tracking-wider text-orange-400 font-bold font-black">Награда</div>
                </div>
              </div>
              {agentState.ActivityFeed && agentState.ActivityFeed.length > 0 && (
                <div className="pt-3 border-t border-white/5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-orange-400/80 mb-2">Лента событий матча</div>
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                    {agentState.ActivityFeed.map((log, idx) => (
                      <div key={idx} className="text-[10px] text-gray-300 flex items-start gap-2 py-0.5 border-b border-white/[0.02] last:border-0">
                        <span className="text-orange-500 select-none">•</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ACTIVE DOTA SESSION IN TAB */}
          {activeTab === "Dota2" && isPlayingDota && agentState && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-orange-400 tracking-wider uppercase">Игровой матч</span>
                <span className="font-black text-white bg-white/10 px-2 py-0.5 rounded">
                  {agentState.MyTeamScore} : {agentState.OpponentTeamScore}
                </span>
              </div>

              {agentState.IsModeSupported === false && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium p-3.5 rounded-2xl flex flex-col gap-1 text-left">
                  <span className="flex items-center gap-1.5 text-xs font-black uppercase text-red-500">
                    ⚠️ Режим игры не поддерживается
                  </span>
                  <span>Начисление бонусов отключено. Пожалуйста, играйте в официальных онлайн-матчах Dota 2 (Matchmaking, Turbo и т.д.).</span>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-4 gap-x-2 text-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <div>
                  <div className="text-xl font-black">{agentState.Kills}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Киллы</div>
                </div>
                <div>
                  <div className="text-xl font-black">{agentState.Assists}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Ассисты</div>
                </div>
                <div>
                  <div className="text-xl font-black">{agentState.Deaths}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Смерти</div>
                </div>
                <div>
                  <div className="text-xl font-black">{agentState.LastHits}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Ластхиты</div>
                </div>
                <div>
                  <div className="text-xl font-black">{agentState.Denies}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Денаи</div>
                </div>
                <div>
                  <div className="text-xl font-black">{(agentState.NetWorth / 1000).toFixed(1)}k</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Неворт</div>
                </div>
                <div>
                  <div className="text-xl font-black">{agentState.Gpm}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">GPM</div>
                </div>
                <div>
                  <div className="text-xl font-black">+{agentState.EarnedBonuses.toFixed(1)} ₽</div>
                  <div className="text-[9px] uppercase tracking-wider text-orange-400 font-bold font-black">Награда</div>
                </div>
              </div>
              {agentState.ActivityFeed && agentState.ActivityFeed.length > 0 && (
                <div className="pt-3 border-t border-white/5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-orange-400/80 mb-2">Лента событий матча</div>
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                    {agentState.ActivityFeed.map((log, idx) => (
                      <div key={idx} className="text-[10px] text-gray-300 flex items-start gap-2 py-0.5 border-b border-white/[0.02] last:border-0">
                        <span className="text-orange-500 select-none">•</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ULTRA-COMPACT TARIFFS LIST */}
        <div className="space-y-3">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 px-1">
            Тарифы начисления ({activeTab})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(activeTab === "CS2" ? cs2Tariffs : dotaTariffs).map((t, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-white/[0.015] border border-white/5 rounded-xl">
                <span className="text-xs text-gray-400">{t.label}</span>
                <span className="text-xs font-black text-green-400">+{t.value.toFixed(1)} ₽</span>
              </div>
            ))}
          </div>
        </div>

        {/* DYNAMIC HOW IT WORKS WITHOUT HEAVY BOXES */}
        <div className="space-y-3 pt-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 px-1">
            Быстрый старт
          </div>
          <div className="space-y-2">
            {[
              { label: "Шаг 1", text: "Агент автоматически запускается на игровом компьютере" },
              { label: "Шаг 2", text: "Играйте в соревновательных режимах (MM, Премьер, Faceit) в CS2 или в Dota 2" },
              { label: "Шаг 3", text: "Бонусы начисляются на баланс профиля в реальном времени" }
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-xs text-gray-400 px-1">
                <span className="text-[9px] font-black uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded text-orange-500">
                  {step.label}
                </span>
                <span>{step.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SECURITY INFO BANNER */}
        <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-4 space-y-2 text-xs text-gray-400">
          <div className="flex items-center gap-2 font-bold text-green-400 uppercase tracking-wider text-[10px]">
            <CircleCheck className="w-3.5 h-3.5 text-green-400" />
            <span>100% Безопасно для вашего аккаунта</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Агент использует официальный встроенный протокол разработчиков <span className="text-white font-medium">Valve Game State Integration (GSI)</span>. 
            Он работает в пассивном режиме чтения, не внедряется в память игры, не изменяет файлы и полностью разрешен античитами <span className="text-white font-medium">VAC</span> и <span className="text-white font-medium">Faceit Anti-Cheat</span>.
          </p>
        </div>

        {/* RECENT MATCHES HISTORY */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">
              Последние матчи
            </span>
          </div>

          {historyLoading ? (
            <div className="text-center py-6 text-gray-600 text-xs">Загрузка...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-6 text-gray-700 text-xs">Матчи ещё не сыграны</div>
          ) : (
            <div className="divide-y divide-white/5">
              {history.slice(0, 10).map((match) => {
                const date = new Date(match.played_at);
                const timeStr = date.toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const earned = parseFloat(match.earned);
                const isExpanded = expandedMatchId === match.id;

                let parsedEvents: string[] = [];
                if (match.events) {
                  try {
                    parsedEvents = typeof match.events === "string" ? JSON.parse(match.events) : match.events;
                  } catch (e) {
                    // ignore
                  }
                }

                return (
                  <div key={match.id} className="py-3">
                    <div
                      className="flex items-center justify-between cursor-pointer hover:bg-white/[0.01] px-1 py-1 rounded-lg transition-colors"
                      onClick={() => toggleMatchExpand(match.id)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase text-white">{match.game}</span>
                          <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{match.map}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          K/D/A: <strong className="text-gray-300">{match.kills} / {match.deaths} / {match.assists}</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right shrink-0">
                        <div>
                          <div className="text-xs font-black text-green-400">+{earned.toFixed(1)} ₽</div>
                          <div className="text-[9px] text-gray-600 mt-0.5">{timeStr}</div>
                        </div>
                        <span className="text-gray-600 text-xs transition-transform duration-200" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                          ▶
                        </span>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-3 px-2 pb-1 space-y-3"
                        >
                          {/* Detailed metrics grid */}
                          <div className="grid grid-cols-4 gap-2 text-center bg-white/[0.01] border border-white/5 p-2.5 rounded-xl text-[11px]">
                            <div>
                              <div className="text-gray-500 uppercase tracking-wider text-[8px]">Киллы</div>
                              <div className="font-bold text-white mt-0.5">{match.kills}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 uppercase tracking-wider text-[8px]">Смерти</div>
                              <div className="font-bold text-white mt-0.5">{match.deaths}</div>
                            </div>
                            <div>
                              <div className="text-gray-500 uppercase tracking-wider text-[8px]">Ассисты</div>
                              <div className="font-bold text-white mt-0.5">{match.assists}</div>
                            </div>
                            <div>
                              {match.game === "CS2" ? (
                                <>
                                  <div className="text-gray-500 uppercase tracking-wider text-[8px]">Хедшоты</div>
                                  <div className="font-bold text-white mt-0.5">{match.headshots ?? 0}</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-gray-500 uppercase tracking-wider text-[8px]">Крипы</div>
                                  <div className="font-bold text-white mt-0.5">{match.last_hits ?? 0}</div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Events logs */}
                          {parsedEvents && parsedEvents.length > 0 && (
                            <div className="space-y-1 bg-white/[0.005] border border-white/5 p-2.5 rounded-xl">
                              <div className="text-[8px] font-black uppercase tracking-widest text-gray-500">Хронология матча</div>
                              <div className="space-y-1 max-h-32 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 mt-1.5">
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
      <BottomNav />
    </div>
  );
}
