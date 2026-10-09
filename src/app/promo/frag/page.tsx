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
  X,
} from "lucide-react";
import { PromoHeader } from "../components/PromoHeader";
import { BottomNav } from "../components/BottomNav";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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
  events?: any;
}

const DEFAULT_CS2_TARIFFS = [
  { label: "Килл", value: 0.60 },
  { label: "Хедшот", value: 1.00 }, // 0.60 + 0.40
  { label: "С ножа", value: 5.00 }, // 0.60 + 4.40
  { label: "Зевс", value: 3.00 }, // 0.60 + 2.40
  { label: "Ассист", value: 0.20 },
  { label: "MVP", value: 1.00 },
  { label: "Победа", value: 10.00 },
];

const DEFAULT_DOTA_TARIFFS = [
  { label: "Килл героя", value: 0.80 },
  { label: "Ассист", value: 0.40 },
  { label: "Ластхит (10)", value: 0.10 },
  { label: "Денай (5)", value: 0.10 },
  { label: "Неворт (1k)", value: 0.10 },
  { label: "Победа", value: 10.00 },
];

const DEFAULT_PUBG_TARIFFS = [
  { label: "Килл", value: 2.00 },
  { label: "Топ-1 (Победа)", value: 15.00 },
  { label: "Топ-10", value: 6.00 },
];

export default function FragPage() {
  const router = useRouter();
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [agentOnline, setAgentOnline] = useState(false);
  const [history, setHistory] = useState<FragMatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [player, setPlayer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"CS2" | "Dota2" | "PUBG">("CS2");
  const [mounted, setMounted] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Tournament states
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);

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
        if (res.status === 401) {
          router.push("/promo/login");
          return;
        }
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
  }, [router]);

  // Fetch player details
  const loadPlayer = useCallback(async () => {
    try {
      const res = await fetch("/api/promo/player");
      if (res.status === 401) {
        router.push("/promo/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setPlayer(data.player);
      }
    } catch (e) {
      console.error(e);
    }
  }, [router]);

  // Fetch player tournaments
  const loadTournaments = useCallback(async () => {
    try {
      const res = await fetch("/api/promo/tournaments");
      if (res.ok) {
        const data = await res.json();
        setTournaments(data.tournaments || []);
      }
    } catch (e) {
      console.error("Failed to load player tournaments:", e);
    } finally {
      setTournamentsLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    pollAgent();
    loadPlayer();
    loadHistory();
    loadTournaments();

    const agentInterval = setInterval(pollAgent, 1000);
    const historyInterval = setInterval(loadHistory, 12000);
    const tournamentInterval = setInterval(loadTournaments, 30000);

    return () => {
      clearInterval(agentInterval);
      clearInterval(historyInterval);
      clearInterval(tournamentInterval);
    };
  }, [pollAgent, loadHistory, loadPlayer, loadTournaments]);

  // Auto-switch tab if game is running
  useEffect(() => {
    if (agentOnline && agentState?.ActiveGame && agentState.ActiveGame !== "None") {
      setActiveTab(agentState.ActiveGame === "Dota2" ? "Dota2" : agentState.ActiveGame === "PUBG" ? "PUBG" : "CS2");
    }
  }, [agentOnline, agentState?.ActiveGame]);

  if (!mounted) return null;

  const isPlaying = agentState?.ActiveGame !== "None" && agentState?.ActiveGame != null;
  const isPlayingCS2 = agentOnline && isPlaying && agentState?.ActiveGame === "CS2";
  const isPlayingDota = agentOnline && isPlaying && agentState?.ActiveGame === "Dota2";
  const isPlayingPubg = agentOnline && isPlaying && agentState?.ActiveGame === "PUBG";

  const fragSettings = player?.settings?.frag;
  const fragEnabled = fragSettings?.is_active !== false;
  const st = fragSettings?.tariffs;

  // Compile tariffs
  const cs2Tariffs = st ? [
    { label: "Килл", value: st.cs2_kill ?? 0.60 },
    { label: "Хедшот", value: (st.cs2_kill ?? 0.60) + (st.cs2_hs ?? 0.40) },
    { label: "С ножа", value: (st.cs2_kill ?? 0.60) + (st.cs2_knife ?? 4.40) },
    { label: "Зевс", value: (st.cs2_kill ?? 0.60) + (st.cs2_zeus ?? 2.40) },
    { label: "Ассист", value: st.cs2_assist ?? 0.20 },
    { label: "MVP", value: st.cs2_mvp ?? 1.00 },
    { label: "Победа", value: st.cs2_win ?? 10.00 },
  ] : DEFAULT_CS2_TARIFFS;

  const dotaTariffs = st ? [
    { label: "Килл героя", value: st.dota_kill ?? 0.80 },
    { label: "Ассист", value: st.dota_assist ?? 0.40 },
    { label: "Ластхит (10)", value: st.dota_lasthit_10 ?? 0.10 },
    { label: "Денай (5)", value: st.dota_denies_5 ?? 0.10 },
    { label: "Неворт (1k)", value: st.dota_networth_1000 ?? 0.10 },
    { label: "Победа", value: st.dota_win ?? 10.00 },
  ] : DEFAULT_DOTA_TARIFFS;

  const pubgTariffs = st ? [
    { label: "Килл", value: st.pubg_kill ?? 2.00 },
    { label: "Топ-1 (Победа)", value: st.pubg_win ?? 15.00 },
    { label: "Топ-10", value: st.pubg_top10 ?? 6.00 },
  ] : DEFAULT_PUBG_TARIFFS;

  const filteredHistory = history.filter(match => {
    if (activeTab === "CS2") return match.game === "CS2";
    if (activeTab === "Dota2") return match.game === "Dota2" || match.game === "Dota 2";
    if (activeTab === "PUBG") return match.game === "PUBG";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 pb-48 sm:pb-36 font-sans">
      <PromoHeader initialPlayer={player} title="FRAG зона" />
      <div className="max-w-xl lg:max-w-6xl mx-auto pt-4 space-y-6">

        {/* Banner header */}
        <div className="relative rounded-3xl sm:rounded-[2rem] bg-gradient-to-br from-amber-500/15 via-orange-500/5 to-transparent border border-amber-500/25 p-5 sm:p-6 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl opacity-40 pointer-events-none" />
          <div className="max-w-2xl space-y-2 relative z-10">
            <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white leading-snug">
              Киберспортивная зона FRAG
            </h2>
            <p className="text-gray-300 text-xs sm:text-sm font-medium leading-relaxed">
              Играй в соревновательных матчах на клубных ПК. Твои фраги, победы и ассисты автоматически конвертируются в реальный баланс на аккаунте.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">CS2 • Dota 2 • PUBG</span>
              <span className="text-gray-600 font-normal">•</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Авто-выплаты на баланс</span>
              <span className="text-gray-600 font-normal">•</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Клубные турниры</span>
            </div>
          </div>
        </div>

        {/* COMPACT ONLINE STATUS & ACTION */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold">
            <div className="flex items-center gap-2.5">
              <span className={cn(
                "w-2.5 h-2.5 rounded-full",
                agentOnline ? "bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" : "bg-amber-400 animate-pulse"
              )} />
              <span className="text-gray-300 font-medium">
                {agentOnline
                  ? isPlaying
                    ? `В игре: ${agentState?.ActiveGame}`
                    : "Агент активен, ожидание игры"
                  : "Агент на ПК отключен"
                }
              </span>
            </div>
            {!agentOnline && (
              <a href="dashfrag://launch" className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold text-xs uppercase tracking-wider">
                <Play className="w-3 h-3 fill-current" /> Запустить
              </a>
            )}
          </div>
          {!fragEnabled && (
            <div className="text-center text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 py-2 rounded-xl">
              ⚠️ Модуль FRAG временно отключен в клубе
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">

        {/* TOURNAMENTS SECTION - PREMIUM BANNER */}
        {tournaments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
                Рейтинговые Турниры
              </span>
            </div>

            {/* Displaying active or most recent tournament summary */}
            {(() => {
              const activeT = tournaments.find(t => t.status === "active") || tournaments[0];
              const daysLeft = (() => {
                const diffTime = new Date(activeT.end_date).getTime() - new Date().getTime();
                if (diffTime <= 0) return 0;
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              })();
              
              return (
                <div
                  onClick={() => router.push(`/promo/frag/tournaments`)}
                  className="relative overflow-hidden group cursor-pointer bg-gradient-to-br from-indigo-950/30 via-slate-900/60 to-purple-950/25 border border-indigo-500/20 hover:border-indigo-500/40 rounded-3xl p-5 sm:p-6 shadow-xl transition-all flex flex-col justify-between gap-5"
                >
                  {/* Decorative neon spots */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-colors" />
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/20 transition-colors" />

                  <div className="flex justify-between items-start gap-4 relative z-10">
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400">Активен</span>
                        <span className="text-gray-600 select-none">•</span>
                        <span>{daysLeft > 0 ? `Осталось: ${daysLeft} дн.` : "Сезон завершен"}</span>
                      </div>
                      <h4 className="text-base font-black uppercase italic leading-tight text-white mt-1.5 group-hover:text-indigo-300 transition-colors">
                        {activeT.title}
                      </h4>
                      {activeT.description && (
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2 max-w-[280px] font-medium">
                          {activeT.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-gray-400 uppercase tracking-wider text-[9px] font-bold">Ваше место</div>
                      <div className="text-xl font-black text-indigo-400 mt-0.5">
                        {activeT.myStats?.rank ? `#${activeT.myStats.rank}` : "—"}
                      </div>
                      <div className="text-xs font-bold text-gray-300">
                        {activeT.myStats?.points ?? 0} PTS
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5 relative z-10 text-xs">
                    <div className="text-gray-400 font-medium flex items-center gap-1">
                      {activeT.myStats?.qualified ? (
                        <span className="text-emerald-400 flex items-center gap-1">✓ Квалификация пройдена</span>
                      ) : (
                        <span className="text-amber-400">
                          Игры: {activeT.myStats?.matches_count ?? 0} из {activeT.min_matches} для зачета
                        </span>
                      )}
                    </div>
                    <span className="font-bold uppercase text-xs tracking-wider text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1 transition-colors">
                      Таблица <span className="translate-x-0 group-hover:translate-x-1 transition-transform">→</span>
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}


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

          {/* ACTIVE PUBG SESSION IN TAB */}
          {activeTab === "PUBG" && isPlayingPubg && agentState && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-yellow-500/5 border border-yellow-500/10 rounded-3xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-yellow-400 tracking-wider uppercase">Игровой матч PUBG</span>
                <span className="font-black text-white bg-white/10 px-2 py-0.5 rounded">
                  Место: #{agentState.MyTeamScore}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <div>
                  <div className="text-xl font-black">{agentState.Kills}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Киллы</div>
                </div>
                <div>
                  <div className="text-xl font-black">+{agentState.EarnedBonuses.toFixed(1)} ₽</div>
                  <div className="text-[9px] uppercase tracking-wider text-yellow-400 font-bold font-black">Награда</div>
                </div>
              </div>
              {agentState.ActivityFeed && agentState.ActivityFeed.length > 0 && (
                <div className="pt-3 border-t border-white/5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-yellow-400/80 mb-2">Лента событий матча</div>
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-white/10 mt-1.5">
                    {agentState.ActivityFeed.map((log, idx) => (
                      <div key={idx} className="text-[10px] text-gray-300 flex items-start gap-2 py-0.5 border-b border-white/[0.02] last:border-0">
                        <span className="text-yellow-500 select-none">•</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        
        {/* HOW IT WORKS / QUICK START */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-white/40 px-1">
            Как это работает
          </div>
          <div className="space-y-3.5">
            <div>
              <div className="text-sm font-black uppercase italic tracking-tight text-amber-400">
                1. Запусти агент FRAG на ПК
              </div>
              <p className="text-xs text-gray-300 font-medium mt-0.5 leading-relaxed">
                Открой приложение Dash FRAG на игровом компьютере и убедись, что индикатор выше показывает «Агент активен».
              </p>
            </div>

            <div className="pt-3 border-t border-white/5">
              <div className="text-sm font-black uppercase italic tracking-tight text-amber-400">
                2. Запусти игру и начни матч
              </div>
              <p className="text-xs text-gray-300 font-medium mt-0.5 leading-relaxed">
                Играй в соревновательных режимах CS2 (MM, Премьер, Faceit), рейтинге Dota 2 или в PUBG.
              </p>
            </div>

            <div className="pt-3 border-t border-white/5">
              <div className="text-sm font-black uppercase italic tracking-tight text-amber-400">
                3. Получай рубли за каждое действие
              </div>
              <p className="text-xs text-gray-300 font-medium mt-0.5 leading-relaxed">
                Фраги, хедшоты, серии убийств и победы моментально начисляют бонусы на твой клубный баланс в реальном времени.
              </p>
            </div>
          </div>
        </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-6">
            {/* GAME TAB SELECTOR */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(["CS2", "Dota2", "PUBG"] as const).map((game) => {
                const label = game === "Dota2" ? "Dota 2" : game;
                const isSelected = activeTab === game;
                return (
                  <button
                    key={game}
                    onClick={() => setActiveTab(game)}
                    className={cn(
                      "flex-1 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border text-center",
                      isSelected
                        ? "bg-white/10 text-white border-white/20 shadow-sm"
                        : "bg-transparent text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* TARIFFS LIST */}
            <div className="space-y-3">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/40 px-1">
                Тарифы за действия ({activeTab === "Dota2" ? "Dota 2" : activeTab})
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(activeTab === "CS2" ? cs2Tariffs : activeTab === "Dota2" ? dotaTariffs : pubgTariffs).map((t, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-2xl">
                    <span className="text-xs text-gray-300 font-medium truncate">{t.label}</span>
                    <span className="text-xs font-black text-amber-400 whitespace-nowrap shrink-0">
                      +{t.value % 1 === 0 ? t.value : t.value.toFixed(1)} ₽
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* RECENT MATCHES HISTORY */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
                  Последние матчи
                </span>
              </div>

              {historyLoading ? (
                <div className="text-center py-6 text-gray-500 text-xs font-medium">Загрузка матчей...</div>
              ) : filteredHistory.length === 0 ? (
                <div className="bg-white/2 border border-white/5 rounded-2xl p-6 text-center text-gray-500 text-xs font-medium">
                  Матчи в {activeTab === "Dota2" ? "Dota 2" : activeTab} ещё не сыграны
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredHistory.slice(0, 10).map((match) => {
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
                      <div
                        key={match.id}
                        className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-3.5 transition-all"
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => toggleMatchExpand(match.id)}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase text-white">{match.game}</span>
                              <span className="text-xs text-gray-400 truncate max-w-[120px]">{match.map}</span>
                              {match.score && (
                                <span className="text-[10px] bg-white/10 border border-white/15 text-white px-2 py-0.5 rounded-lg font-bold">
                                  {match.score}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              K/D/A: <strong className="text-white font-bold">{match.kills} / {match.deaths} / {match.assists}</strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-right shrink-0">
                            <div>
                              <div className="text-xs font-black text-amber-400">+{earned.toFixed(1)} ₽</div>
                              <div className="text-[10px] text-gray-500 mt-0.5">{timeStr}</div>
                            </div>
                            <span className="text-gray-500 text-xs transition-transform duration-200" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
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
                              className="overflow-hidden mt-3 pt-3 border-t border-white/5 space-y-3"
                            >
                              {/* Detailed metrics grid */}
                              <div className="grid grid-cols-4 gap-2 text-center bg-white/5 border border-white/10 p-2.5 rounded-xl text-xs">
                                <div>
                                  <div className="text-gray-400 uppercase tracking-wider text-[9px] font-bold">Киллы</div>
                                  <div className="font-bold text-white mt-0.5">{match.kills}</div>
                                </div>
                                <div>
                                  <div className="text-gray-400 uppercase tracking-wider text-[9px] font-bold">Смерти</div>
                                  <div className="font-bold text-white mt-0.5">{match.deaths}</div>
                                </div>
                                <div>
                                  <div className="text-gray-400 uppercase tracking-wider text-[9px] font-bold">Ассисты</div>
                                  <div className="font-bold text-white mt-0.5">{match.assists}</div>
                                </div>
                                <div>
                                  {match.game === "CS2" ? (
                                    <>
                                      <div className="text-gray-400 uppercase tracking-wider text-[9px] font-bold">Хедшоты</div>
                                      <div className="font-bold text-white mt-0.5">{match.headshots ?? 0}</div>
                                    </>
                                  ) : match.game === "PUBG" ? (
                                    <>
                                      <div className="text-gray-400 uppercase tracking-wider text-[9px] font-bold">Результат</div>
                                      <div className="font-bold text-white mt-0.5">{match.score ?? "-"}</div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-gray-400 uppercase tracking-wider text-[9px] font-bold">Крипы</div>
                                      <div className="font-bold text-white mt-0.5">{match.last_hits ?? 0}</div>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Events logs */}
                              {parsedEvents && parsedEvents.length > 0 && (
                                <div className="space-y-1 bg-white/5 border border-white/10 p-2.5 rounded-xl">
                                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">Хронология матча</div>
                                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1 no-scrollbar mt-1.5">
                                    {parsedEvents.map((evt, idx) => (
                                      <div key={idx} className="text-xs text-gray-300 py-1 border-b border-white/5 last:border-0">
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

      </div>

      {/* Tournament Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboardModal && selectedTournament && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121214] border border-white/5 rounded-[2rem] p-6 shadow-2xl w-full max-w-md relative max-h-[85vh] overflow-y-auto space-y-5"
            >
              <button
                onClick={() => {
                  setShowLeaderboardModal(false);
                  setSelectedTournament(null);
                }}
                className="absolute top-5 right-5 text-gray-500 hover:text-gray-400 p-1"
              >
                <X className="w-6 h-6" />
              </button>

              <div>
                <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-white/5 text-orange-400">
                  {selectedTournament.game === "ALL" ? "CS2 + Dota 2" : selectedTournament.game}
                </span>
                <h4 className="text-lg font-black uppercase italic mt-1.5 leading-snug">{selectedTournament.title}</h4>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5 font-bold">
                  Топ-10 игроков клуба
                </p>
              </div>

              {/* Prizes list */}
              <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl space-y-2">
                <div className="text-[8px] font-black uppercase text-gray-500 tracking-wider">Призовые места</div>
                {selectedTournament.prizes?.slice(0, 3).map((p: any) => (
                  <div key={p.place} className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1 font-bold text-gray-400">
                      🏆 {p.place} место:
                    </span>
                    <span className="font-black text-green-400">+{p.reward} ₽</span>
                  </div>
                ))}
              </div>

              {/* Leaderboard Table */}
              <div className="space-y-2">
                <div className="text-[8px] font-black uppercase text-gray-500 tracking-wider px-1">Таблица</div>
                <div className="divide-y divide-white/5 border border-white/5 rounded-2xl bg-white/[0.005] overflow-hidden">
                  {selectedTournament.leaderboard?.length === 0 ? (
                    <div className="text-center py-8 text-xs text-gray-600 font-bold uppercase">
                      Нет результатов
                    </div>
                  ) : (
                    selectedTournament.leaderboard.map((item: any) => {
                      const isCurrentUser = item.player_id === player?.id;
                      const maskedName = item.full_name
                        ? item.full_name.split(" ").map((n: string, i: number) => i === 0 ? n : `${n[0]}.`).join(" ")
                        : "Игрок";
                      
                      return (
                        <div
                          key={item.player_id}
                          className={cn(
                            "flex items-center justify-between px-4 py-3 text-xs",
                            isCurrentUser && "bg-indigo-500/10 border-y border-indigo-500/20"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px]",
                              item.rank === 1 ? "bg-amber-500/20 text-amber-400" :
                              item.rank === 2 ? "bg-slate-400/20 text-slate-300" :
                              item.rank === 3 ? "bg-amber-700/20 text-amber-600" : "text-gray-500"
                            )}>
                              {item.rank || "—"}
                            </span>
                            <span className={cn(
                              "font-bold",
                              isCurrentUser ? "text-indigo-400" : "text-gray-200"
                            )}>
                              {maskedName} {isCurrentUser && <span className="text-[9px] bg-indigo-500/20 px-1 py-0.5 rounded uppercase tracking-wider ml-1">Вы</span>}
                            </span>
                          </div>

                          <div className="text-right font-black">
                            <div className="text-white">{item.points} PTS</div>
                            <div className="text-[9px] text-gray-600">{item.wins}W / {item.losses}L</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
