"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

// Event log strings look like "[19:19:16] ★ Звезда MVP раунда! +1,00 руб. (В конце матча)".
// Turn them into structured rows so the match card shows "what you earned for", not a raw log.
interface ParsedEvent { time: string; title: string; amount: number }
function parseMatchEvents(events: any): ParsedEvent[] {
  let list: any = events;
  if (typeof list === "string") { try { list = JSON.parse(list); } catch { list = []; } }
  if (!Array.isArray(list)) return [];
  return list.flatMap((raw: any) => {
    if (typeof raw !== "string") return [];
    const m = raw.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*?)\s*([+-]\s?\d+(?:[.,]\d+)?)\s*руб\.?/i);
    if (m) {
      const title = m[2].replace(/^[^\p{L}\p{N}]+/u, "").replace(/[!:\s]+$/u, "");
      return [{ time: m[1], title: title || "Событие", amount: parseFloat(m[3].replace(/\s/g, "").replace(",", ".")) || 0 }];
    }
    const t = raw.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/);
    const title = (t ? t[2] : raw).replace(/^[^\p{L}\p{N}]+/u, "").replace(/[!:\s]+$/u, "");
    return title ? [{ time: t ? t[1] : "", title, amount: 0 }] : [];
  });
}

function groupEvents(rows: ParsedEvent[]) {
  const map = new Map<string, { title: string; count: number; sum: number }>();
  for (const r of rows) {
    const g = map.get(r.title) || { title: r.title, count: 0, sum: 0 };
    g.count += 1; g.sum += r.amount;
    map.set(r.title, g);
  }
  return [...map.values()].sort((a, b) => b.sum - a.sum);
}

function matchResult(match: { game: string; score: string }, rows: ParsedEvent[]): "win" | "loss" | "draw" | null {
  if (rows.some((r) => /победа|топ-1\b/i.test(r.title))) return "win";
  const m = String(match.score || "").match(/^(\d+)\s*:\s*(\d+)$/);
  if (m && match.game !== "PUBG") return +m[1] > +m[2] ? "win" : +m[1] < +m[2] ? "loss" : "draw";
  return null;
}

interface ScoringItem {
  label: string;
  val: string;
  note?: string;
}

interface ScoringCategory {
  title: string;
  rows: ScoringItem[];
}

const DEFAULT_SCORING_BY_GAME: Record<string, ScoringCategory[]> = {
  CS2: [
    {
      title: "Командный результат",
      rows: [
        { label: "Победа в матче", val: "+15.0 PTS" },
        { label: "Поражение в матче", val: "-10.0 PTS" },
      ],
    },
    {
      title: "Личная статистика (Скилл)",
      rows: [
        { label: "Каждое убийство (Kill)", val: "+1.0 PTS" },
        { label: "Помощь в убийстве (Assist)", val: "+0.5 PTS" },
        { label: "Попадание в голову (Headshot)", val: "+0.5 PTS", note: "бонус за точность" },
        { label: "Каждая смерть (Death)", val: "-0.8 PTS", note: "штраф" },
      ],
    },
    {
      title: "Особые достижения",
      rows: [
        { label: "Звезда MVP", val: "+2.0 PTS" },
        { label: "Убийство с ножа", val: "+5.0 PTS" },
        { label: "Убийство с Zeus", val: "+3.0 PTS" },
        { label: "Double Kill / Triple / Quad", val: "+1.0 / +2.0 / +5.0 PTS" },
        { label: "Ace (5 убийств за раунд)", val: "+10.0 PTS" },
      ],
    },
  ],
  Dota2: [
    {
      title: "Командный результат",
      rows: [
        { label: "Победа в матче", val: "+15.0 PTS" },
        { label: "Поражение в матче", val: "-10.0 PTS" },
      ],
    },
    {
      title: "Личная статистика (Скилл)",
      rows: [
        { label: "Убийство героя (Kill)", val: "+1.5 PTS" },
        { label: "Ассист в замесе (Assist)", val: "+0.75 PTS" },
        { label: "Добитый крип (Last Hit)", val: "+0.05 PTS" },
        { label: "Каждые 5 Denies (денай крипа)", val: "+0.5 PTS" },
        { label: "Каждые 1000 Networth (золото)", val: "+0.2 PTS" },
        { label: "Смерть героя (Death)", val: "-1.0 PTS", note: "штраф" },
      ],
    },
    {
      title: "Особые достижения",
      rows: [
        { label: "Killing Spree (3 стрик)", val: "+2.0 PTS" },
        { label: "Mega Kill (5 стрик)", val: "+5.0 PTS" },
        { label: "Beyond Godlike (10+ стрик)", val: "+10.0 PTS" },
        { label: "Каждые 5 поставленных вардов", val: "+1.0 PTS" },
        { label: "Снос вражеского варда", val: "+0.5 PTS" },
      ],
    },
  ],
  PUBG: [
    {
      title: "Командный результат",
      rows: [
        { label: "Победа (Топ-1)", val: "+20.0 PTS" },
        { label: "Попадание в Топ-10", val: "+10.0 PTS" },
        { label: "Поражение в матче", val: "-10.0 PTS" },
      ],
    },
    {
      title: "Личная статистика",
      rows: [
        { label: "Каждое убийство (Kill)", val: "+2.0 PTS" },
      ],
    },
  ],
  ALL: [
    {
      title: "CS2 · Командный результат",
      rows: [
        { label: "Победа в матче", val: "+15.0 PTS" },
        { label: "Поражение в матче", val: "-10.0 PTS" },
      ],
    },
    {
      title: "CS2 · Личный скилл",
      rows: [
        { label: "Убийство / Хедшот", val: "+1.0 / +0.5 PTS" },
        { label: "Ассист / Смерть", val: "+0.5 / -0.8 PTS" },
        { label: "MVP / Стрики / Нож / Зевс", val: "+1.0 ... +10.0 PTS" },
      ],
    },
    {
      title: "Dota 2 · Командный результат",
      rows: [
        { label: "Победа в матче", val: "+15.0 PTS" },
        { label: "Поражение в матче", val: "-10.0 PTS" },
      ],
    },
    {
      title: "Dota 2 · Личный скилл",
      rows: [
        { label: "Убийство / Ассист", val: "+1.5 / +0.75 PTS" },
        { label: "Ластхиты / 5 Denies", val: "+0.05 / +0.5 PTS" },
        { label: "Смерть / Стрики / Варды", val: "-1.0 / +0.5 ... +10.0 PTS" },
      ],
    },
  ],
};

export default function FragPage() {
  const router = useRouter();
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [agentOnline, setAgentOnline] = useState(false);
  const [history, setHistory] = useState<FragMatch[]>([]);
  const [serverTotals, setServerTotals] = useState<Record<string, { matches: number; earned: number }> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [player, setPlayer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"CS2" | "Dota2" | "PUBG">("CS2");
  const [mounted, setMounted] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Tournament states
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [mainTab, setMainTab] = useState<"play" | "earn" | "history" | "tours" | "leaders" | "rules">("play");
  const [historyGame, setHistoryGame] = useState<"ALL" | "CS2" | "Dota2" | "PUBG">("ALL");
  const [tourTab, setTourTab] = useState<"active" | "history">("active");
  const [openTourId, setOpenTourId] = useState<number | null>(null);
  const [tourSub, setTourSub] = useState<"overview" | "matches" | "board" | "prizes" | "rules">("overview");
  const [expandedTourMatchId, setExpandedTourMatchId] = useState<string | number | null>(null);

  // General FRAG all-time club leaderboard states
  const [generalLeaders, setGeneralLeaders] = useState<any[]>([]);
  const [generalLeadersLoading, setGeneralLeadersLoading] = useState(false);
  const [leadersGame, setLeadersGame] = useState<"ALL" | "CS2" | "Dota2" | "PUBG">("ALL");
  const [leadersSort, setLeadersSort] = useState<"earned" | "kills" | "matches">("earned");
  const [myGeneralStats, setMyGeneralStats] = useState<any>(null);
  const urlInitialized = useRef(false);

  const switchMainTab = (key: "play" | "earn" | "history" | "tours" | "leaders" | "rules") => {
    if (key === mainTab) return;
    setMainTab(key);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (key !== "play") params.set("tab", key);
      else params.delete("tab");
      params.delete("tour");
      params.delete("sub");
      params.delete("ttab");
      params.delete("sort");
      params.delete("rtour");
      if (key === "history") {
        if (historyGame !== "ALL") params.set("game", historyGame);
        else params.delete("game");
      } else if (key === "earn") {
        params.set("game", activeTab);
      } else if (key === "leaders") {
        if (leadersGame !== "ALL") params.set("game", leadersGame);
        else params.delete("game");
        if (leadersSort !== "earned") params.set("sort", leadersSort);
        else params.delete("sort");
      } else {
        params.delete("game");
      }
      const qs = params.toString();
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.pushState(null, "", newUrl);
    }
  };

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

        // Keep agent session synchronized with browser session
        try {
          const cookiesRes = await fetch("/api/promo/auth/cookies");
          if (cookiesRes.status === 401 && data?.PromoLoggedIn) {
            await fetch(`${AGENT_URL}/promo/logout`, { method: "POST", mode: "no-cors" });
          } else if (cookiesRes.ok) {
            const cookiesData = await cookiesRes.json();
            const playerMismatch =
              cookiesData.playerId &&
              data?.PromoPlayerId &&
              String(cookiesData.playerId) !== String(data.PromoPlayerId);
            if (cookiesData.cookies && (!data?.PromoLoggedIn || playerMismatch)) {
              await fetch(`${AGENT_URL}/promo/set-cookies`, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify({ cookies: cookiesData.cookies }),
              });
            }
          }
        } catch (syncErr) {
          console.error("Failed to auto-sync cookies to agent:", syncErr);
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
          setServerTotals(data.totals || null);
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

  // Fetch general FRAG all-time club leaderboard
  const loadGeneralLeaders = useCallback(async (g = leadersGame, s = leadersSort) => {
    setGeneralLeadersLoading(true);
    try {
      const res = await fetch(`/api/promo/frag/leaderboard?game=${g}&sort=${s}`);
      if (res.ok) {
        const data = await res.json();
        setGeneralLeaders(data.leaders || []);
        setMyGeneralStats(data.myStats || null);
      }
    } catch (e) {
      console.error("Failed to load general leaders:", e);
    } finally {
      setGeneralLeadersLoading(false);
    }
  }, [leadersGame, leadersSort]);

  // 1. Restore tabs and filter state from URL query parameters on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    const tab = params.get("tab");
    const validTabs = ["play", "earn", "history", "tours", "leaders", "rules"] as const;
    if (tab && (validTabs as readonly string[]).includes(tab)) {
      setMainTab(tab as any);
    }

    const tour = params.get("tour");
    if (tour && !isNaN(Number(tour))) {
      setOpenTourId(Number(tour));
    }

    const sub = params.get("sub");
    const validSubs = ["overview", "matches", "board", "prizes", "rules"] as const;
    if (sub && (validSubs as readonly string[]).includes(sub)) {
      setTourSub(sub as any);
    }

    const ttab = params.get("ttab");
    if (ttab === "active" || ttab === "history") {
      setTourTab(ttab);
    }

    const game = params.get("game");
    if (game === "CS2" || game === "Dota2" || game === "PUBG") {
      setActiveTab(game);
      setHistoryGame(game);
      setLeadersGame(game);
    } else if (game === "ALL") {
      setHistoryGame("ALL");
      setLeadersGame("ALL");
    }

    const sort = params.get("sort");
    if (sort === "earned" || sort === "kills" || sort === "matches") {
      setLeadersSort(sort);
    }

    urlInitialized.current = true;
  }, []);

  // 2. Synchronize browser Back / Forward buttons with state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      const validTabs = ["play", "earn", "history", "tours", "leaders", "rules"] as const;
      setMainTab(tab && (validTabs as readonly string[]).includes(tab) ? (tab as any) : "play");

      const tour = params.get("tour");
      setOpenTourId(tour && !isNaN(Number(tour)) ? Number(tour) : null);

      const sub = params.get("sub");
      const validSubs = ["overview", "matches", "board", "prizes", "rules"] as const;
      setTourSub(sub && (validSubs as readonly string[]).includes(sub) ? (sub as any) : "overview");

      const ttab = params.get("ttab");
      if (ttab === "active" || ttab === "history") setTourTab(ttab);

      const game = params.get("game");
      if (game === "CS2" || game === "Dota2" || game === "PUBG") {
        setActiveTab(game);
        setHistoryGame(game);
        setLeadersGame(game);
      } else if (!game || game === "ALL") {
        setHistoryGame("ALL");
        setLeadersGame("ALL");
      }

      const sort = params.get("sort");
      if (sort === "earned" || sort === "kills" || sort === "matches") {
        setLeadersSort(sort);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // 3. Keep URL query parameters in sync with current state
  useEffect(() => {
    if (!mounted || !urlInitialized.current || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    if (mainTab !== "play") {
      params.set("tab", mainTab);
    } else {
      params.delete("tab");
    }

    if (mainTab === "tours") {
      if (openTourId) {
        params.set("tour", String(openTourId));
        if (tourSub !== "overview") params.set("sub", tourSub);
        else params.delete("sub");
        params.delete("ttab");
      } else {
        params.delete("tour");
        params.delete("sub");
        if (tourTab !== "active") params.set("ttab", tourTab);
        else params.delete("ttab");
      }
    } else {
      params.delete("tour");
      params.delete("sub");
      params.delete("ttab");
    }

    if (mainTab === "history") {
      if (historyGame !== "ALL") params.set("game", historyGame);
      else params.delete("game");
    } else if (mainTab === "earn") {
      params.set("game", activeTab);
    } else if (mainTab === "leaders") {
      if (leadersGame !== "ALL") params.set("game", leadersGame);
      else params.delete("game");
      if (leadersSort !== "earned") params.set("sort", leadersSort);
      else params.delete("sort");
    } else {
      params.delete("game");
      params.delete("sort");
    }

    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    const currentUrl = window.location.pathname + window.location.search;
    if (currentUrl !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [mounted, mainTab, openTourId, tourSub, tourTab, historyGame, activeTab, leadersGame, leadersSort]);

  useEffect(() => {
    setMounted(true);
    pollAgent();
    loadPlayer();
    loadHistory();
    loadTournaments();
    loadGeneralLeaders();

    const agentInterval = setInterval(pollAgent, 1000);
    const historyInterval = setInterval(loadHistory, 12000);
    const tournamentInterval = setInterval(loadTournaments, 30000);

    return () => {
      clearInterval(agentInterval);
      clearInterval(historyInterval);
      clearInterval(tournamentInterval);
    };
  }, [pollAgent, loadHistory, loadPlayer, loadTournaments, loadGeneralLeaders]);

  useEffect(() => {
    if (mainTab === "leaders") {
      loadGeneralLeaders();
    }
  }, [mainTab, loadGeneralLeaders]);

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

  // Compile tariffs (same keys as the club admin settings: /clubs/[id]/dashfrag?tab=settings)
  // With settings: show every tariff the club set above 0. Without: defaults.
  // Defaults mirror FragTab.tsx (admin) so keys the club never saved still show what admin shows
  const ADMIN_DEFAULTS: Record<string, number> = {
    cs2_kill: 0.6, cs2_hs: 0.4, cs2_knife: 4.4, cs2_zeus: 2.4, cs2_assist: 0.2, cs2_mvp: 1, cs2_win: 10,
    cs2_double_kill: 1, cs2_triple_kill: 2, cs2_quad_kill: 5, cs2_ace: 10,
    cs2_bomb_plant: 1, cs2_bomb_defuse: 2, cs2_clutch_kill: 0.5, cs2_flash_kill: 0.5,
    dota_kill: 0.8, dota_assist: 0.4, dota_lasthit_10: 0.1, dota_denies_5: 0.1, dota_networth_1000: 0.1, dota_win: 10,
    dota_streak_3: 1.5, dota_streak_5: 3, dota_streak_10: 10, dota_wards_5: 1, dota_ward_destroy: 0.5,
    pubg_kill: 2, pubg_win: 15, pubg_top10: 6,
  };
  const tv = (k: string, _d?: number) => Number(st?.[k] ?? ADMIN_DEFAULTS[k] ?? 0);
  const list = (rows: { label: string; value: number }[]) => rows.filter((r) => r.value > 0);

  const cs2Tariffs = list([
    { label: "Килл", value: tv("cs2_kill", 0.6) },
    { label: "Килл в голову", value: tv("cs2_kill", 0.6) + tv("cs2_hs", 0.4) },
    { label: "Килл ножом", value: tv("cs2_kill", 0.6) + tv("cs2_knife", 4.4) },
    { label: "Килл с Zeus", value: tv("cs2_kill", 0.6) + tv("cs2_zeus", 2.4) },
    { label: "Ассист", value: tv("cs2_assist", 0.2) },
    { label: "MVP раунда", value: tv("cs2_mvp", 1) },
    { label: "Double Kill (2 убийства за раунд)", value: tv("cs2_double_kill", 0) },
    { label: "Triple Kill (3 убийства)", value: tv("cs2_triple_kill", 0) },
    { label: "Quad Kill (4 убийства)", value: tv("cs2_quad_kill", 0) },
    { label: "Ace (5 убийств)", value: tv("cs2_ace", 0) },
    { label: "Установка бомбы", value: tv("cs2_bomb_plant", 0) },
    { label: "Разминирование бомбы", value: tv("cs2_bomb_defuse", 0) },
    { label: "Клатч-килл (меньше 20 HP)", value: tv("cs2_clutch_kill", 0) },
    { label: "Килл ослеплённого", value: tv("cs2_flash_kill", 0) },
    { label: "Победа в матче", value: tv("cs2_win", 10) },
  ]);

  const dotaTariffs = list([
    { label: "Убийство героя", value: tv("dota_kill", 0.8) },
    { label: "Ассист", value: tv("dota_assist", 0.4) },
    { label: "Каждые 10 ластхитов", value: tv("dota_lasthit_10", 0.1) },
    { label: "Каждые 5 деней", value: tv("dota_denies_5", 0.1) },
    { label: "Каждые 1000 золота networth", value: tv("dota_networth_1000", 0.1) },
    { label: "Killing Spree (3 подряд)", value: tv("dota_streak_3", 0) },
    { label: "Mega Kill (5 подряд)", value: tv("dota_streak_5", 0) },
    { label: "Beyond Godlike (10+ подряд)", value: tv("dota_streak_10", 0) },
    { label: "Каждые 5 поставленных вардов", value: tv("dota_wards_5", 0) },
    { label: "Уничтожение вражеского варда", value: tv("dota_ward_destroy", 0) },
    { label: "Победа в матче", value: tv("dota_win", 10) },
  ]);

  const pubgTariffs = list([
    { label: "Убийство", value: tv("pubg_kill", 2) },
    { label: "Победа (Топ-1)", value: tv("pubg_win", 15) },
    { label: "Попадание в Топ-10", value: tv("pubg_top10", 6) },
  ]);
  const filteredHistory = history.filter(match => {
    if (activeTab === "CS2") return match.game === "CS2";
    if (activeTab === "Dota2") return match.game === "Dota2" || match.game === "Dota 2";
    if (activeTab === "PUBG") return match.game === "PUBG";
    return true;
  });

  const historyList = history.filter((match) => {
    if (historyGame === "ALL") return true;
    if (historyGame === "CS2") return match.game === "CS2";
    if (historyGame === "Dota2") return match.game === "Dota2" || match.game === "Dota 2";
    if (historyGame === "PUBG") return match.game === "PUBG";
    return true;
  });

  const gameLabel = activeTab === "Dota2" ? "Dota 2" : activeTab;
  const tariffs = activeTab === "CS2" ? cs2Tariffs : activeTab === "Dota2" ? dotaTariffs : pubgTariffs;
  const isLive = agentState && (activeTab === "CS2" ? isPlayingCS2 : activeTab === "Dota2" ? isPlayingDota : isPlayingPubg);
  const liveGame = isPlayingCS2 ? "CS2" : isPlayingDota ? "Dota2" : isPlayingPubg ? "PUBG" : null;

  const liveStats: [string, string | number][] = !agentState ? [] :
    agentState.ActiveGame === "CS2" ? [
      ["Киллы", agentState.Kills], ["Ассисты", agentState.Assists], ["Смерти", agentState.Deaths],
      ["Хедшоты", agentState.Headshots], ["MVP", agentState.Mvps],
    ] : agentState.ActiveGame === "Dota2" ? [
      ["Киллы", agentState.Kills], ["Ассисты", agentState.Assists], ["Смерти", agentState.Deaths],
      ["Ластхиты", agentState.LastHits], ["Денаи", agentState.Denies],
      ["Неворт", `${(agentState.NetWorth / 1000).toFixed(1)}k`], ["GPM", agentState.Gpm],
    ] : [["Киллы", agentState.Kills]];
  const liveScore = !agentState ? "" :
    agentState.ActiveGame === "CS2" ? `${agentState.MapName} · ${agentState.MyTeamScore}:${agentState.OpponentTeamScore}` :
    agentState.ActiveGame === "Dota2" ? `${agentState.MyTeamScore}:${agentState.OpponentTeamScore}` :
    `Место #${agentState.MyTeamScore}`;

  // Earnings summary for selected game
  const todayStr = new Date().toDateString();
  // Server totals cover all matches; add matches that exist only on the local agent (not synced yet)
  const localOnly = filteredHistory.filter((m) => String(m.id).startsWith("local-"));
  const st0 = serverTotals?.[activeTab];
  const totalEarned = serverTotals
    ? (st0?.earned ?? 0) + localOnly.reduce((s, m) => s + (parseFloat(m.earned) || 0), 0)
    : filteredHistory.reduce((s, m) => s + (parseFloat(m.earned) || 0), 0);
  const totalMatches = serverTotals ? (st0?.matches ?? 0) + localOnly.length : filteredHistory.length;
  const todayEarned = filteredHistory
    .filter((m) => new Date(m.played_at).toDateString() === todayStr)
    .reduce((s, m) => s + (parseFloat(m.earned) || 0), 0);

  // Tournaments
  const isTActive = (t: any) => String(t.status).toLowerCase() === "active" && new Date(t.end_date).getTime() > Date.now();
  const activeTours = tournaments.filter(isTActive);
  const pastTours = tournaments.filter((t) => !isTActive(t));
  const tourList = tourTab === "active" ? activeTours : pastTours;
  const openTour = tournaments.find((t) => t.id === openTourId) || null;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const gameName = (g: string) => (g === "ALL" ? "CS2 и Dota 2" : g === "Dota2" ? "Dota 2" : g);
  const maskName = (n?: string) =>
    n ? n.split(" ").filter(Boolean).map((p: string, i: number) => (i === 0 ? p : `${p[0]}.`)).join(" ") : "Игрок";
  const valueTone = (v: string) => (/^[−-]/.test(v) ? "text-rose-400" : "text-emerald-400");

  const renderBoard = (t: any) => {
    const rows: any[] = t.leaderboard || [];
    const myRank = t.myStats?.rank;
    return (
      <div className={cn(boxCls, "p-0 overflow-hidden")}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/10">
              <th className="py-2.5 pl-4 text-left font-bold w-24">Место</th>
              <th className="py-2.5 text-left font-bold">Игрок</th>
              <th className="py-2.5 text-right font-bold">Очки</th>
              <th className="py-2.5 text-right font-bold hidden sm:table-cell">Победы</th>
              <th className="py-2.5 text-right font-bold hidden sm:table-cell">Поражения</th>
              <th className="py-2.5 pr-4 text-right font-bold hidden md:table-cell">Игр</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-gray-500">Результатов пока нет</td></tr>
            )}
            {rows.map((item) => {
              const me = item.player_id === player?.id;
              const displayName = item.nickname || item.full_name || "Игрок";
              const maskedName = item.nickname || maskName(item.full_name);
              return (
                <tr
                  key={item.player_id}
                  onClick={() => router.push(`/promo/player/${item.player_id}`)}
                  className={cn(
                    "cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors",
                    me && "bg-indigo-500/10 border-y border-indigo-500/25"
                  )}
                >
                  <td className="py-3 pl-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "font-black text-sm min-w-5",
                          item.rank === 1
                            ? "text-amber-400"
                            : item.rank === 2
                            ? "text-slate-300"
                            : item.rank === 3
                            ? "text-amber-600"
                            : "text-gray-400"
                        )}
                      >
                        {item.rank ? `#${item.rank}` : "—"}
                      </span>
                      {item.rank_change !== null && item.rank_change !== undefined ? (
                        item.rank_change > 0 ? (
                          <span className="text-[11px] font-bold text-emerald-400">▲ +{item.rank_change}</span>
                        ) : item.rank_change < 0 ? (
                          <span className="text-[11px] font-bold text-rose-400">▼ {Math.abs(item.rank_change)}</span>
                        ) : (
                          <span className="text-[11px] font-bold text-gray-600">—</span>
                        )
                      ) : item.qualified ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">NEW</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.avatar_url ? (
                        <img
                          src={item.avatar_url}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/10"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0 text-gray-300 uppercase">
                          {(displayName || "?")[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className={cn("font-bold text-[13px] truncate", me ? "text-indigo-300" : "text-white")}>
                          {me ? `${displayName} (вы)` : maskedName}
                        </div>
                        <div className="text-[10px] text-gray-500 sm:hidden">
                          {item.wins} побед · {item.losses} пораж.
                        </div>
                        {!item.qualified && (
                          <div className="text-[10px] text-orange-400/80">
                            Не в рейтинге: {item.matches_count}/{t.min_matches} игр
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right font-black text-[13px] whitespace-nowrap">{item.points}</td>
                  <td className="py-3 text-right text-gray-300 hidden sm:table-cell">{item.wins}</td>
                  <td className="py-3 text-right text-gray-300 hidden sm:table-cell">{item.losses}</td>
                  <td className="py-3 pr-4 text-right text-gray-400 hidden md:table-cell">{item.matches_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-2.5 text-[11px] text-gray-500 border-t border-white/10 flex flex-wrap justify-between items-center gap-2">
          <span>Всего участников: {rows.length}. Нажмите на игрока, чтобы открыть его профиль.</span>
          {t.myStats && (
            <span className="text-indigo-300 font-bold">
              Вы: {myRank ? `место #${myRank}` : "вне рейтинга"} · {t.myStats.points} очков
              {t.myStats.rank_change > 0 && <span className="text-emerald-400 ml-1">▲ +{t.myStats.rank_change}</span>}
              {t.myStats.rank_change < 0 && <span className="text-rose-400 ml-1">▼ {Math.abs(t.myStats.rank_change)}</span>}
            </span>
          )}
        </div>
      </div>
    );
  };

  const scoreRegex = /^[•\-]?\s*(.+?):\s*([+-]\s*\d+(?:[.,]\d+)?\s*(?:очка|очков|очко|pts|баллов|балла|балл)?)(.*)$/i;

  const renderTournamentRulesReader = (descText?: string, game?: string) => {
    const rawLines = (descText || "").split("\n").map((l) => l.trimEnd());
    const writtenLines: string[] = [];
    const parsedGroups: ScoringCategory[] = [];
    let currentGroup: ScoringCategory | null = null;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) {
        if (writtenLines.length > 0 && writtenLines[writtenLines.length - 1] !== "") {
          writtenLines.push("");
        }
        continue;
      }

      // Omit redundant formulas header line when rendering separate structured blocks
      if (/^([0-9]\uFE0F?\u20E3|\d+[\.\)])\s*ФОРМУЛА/i.test(line)) {
        continue;
      }
      if (/^Очки за каждый сыгранный матч складываются/i.test(line)) {
        continue;
      }

      // Check if subheader for scoring items
      const nextLine = rawLines[i + 1] ? rawLines[i + 1].trim() : "";
      const isSubHeader = /^([А-Яа-яA-Za-z\s\(\)]+):$/.test(line) && !line.startsWith("•") && !line.startsWith("-");
      const nextIsScore = scoreRegex.test(nextLine);

      if (isSubHeader && nextIsScore) {
        currentGroup = { title: line.replace(/:$/, "").trim(), rows: [] };
        parsedGroups.push(currentGroup);
        continue;
      }

      const scoreMatch = line.match(scoreRegex);
      if (scoreMatch) {
        if (!currentGroup) {
          currentGroup = { title: "Начисление очков", rows: [] };
          parsedGroups.push(currentGroup);
        }
        currentGroup.rows.push({
          label: scoreMatch[1].trim(),
          val: scoreMatch[2].trim(),
          note: scoreMatch[3].trim(),
        });
        continue;
      }

      // Everything else is written text from organizers
      writtenLines.push(line);
    }

    const effectiveScoring = parsedGroups.length > 0
      ? parsedGroups
      : (DEFAULT_SCORING_BY_GAME[game || "CS2"] || DEFAULT_SCORING_BY_GAME.CS2);

    const hasWrittenText = writtenLines.some((l) => l.trim().length > 0);

    return (
      <div className="space-y-4">
        {/* ============ 1. КАК И ЧТО НАЧИСЛЯЕТСЯ (АККУРАТНО И СТРУКТУРИРОВАННО) ============ */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/10 pb-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                Как и что начисляется
              </div>
              <h3 className="text-sm sm:text-base font-black uppercase text-white mt-0.5">
                Формула начисления очков (PTS)
              </h3>
            </div>
            <div className="text-[11px] text-gray-400">
              В зачёт идут лучшие 15 матчей · Мин. балл: 0 PTS
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {effectiveScoring.map((group, gIdx) => (
              <div
                key={gIdx}
                className="bg-black/40 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-400/90 border-b border-white/10 pb-2 mb-2">
                    {group.title}
                  </div>
                  <div className="divide-y divide-white/5">
                    {group.rows.map((row, rIdx) => {
                      const isNegative = row.val.includes("-");
                      const valCls = isNegative
                        ? "text-rose-400"
                        : "text-emerald-400";

                      return (
                        <div key={rIdx} className="flex items-center justify-between gap-2 py-2 text-xs">
                          <div className="min-w-0 pr-1">
                            <span className="text-gray-200 font-medium leading-tight block">
                              {row.label}
                            </span>
                            {row.note && (
                              <span className="text-[10px] text-gray-400 leading-tight block mt-0.5">
                                {row.note}
                              </span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "font-mono font-black text-xs sm:text-sm whitespace-nowrap shrink-0",
                              valCls
                            )}
                          >
                            {row.val}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-[11px] text-gray-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span>
              💡 <b className="text-gray-300">Защита от неудачных игр:</b> Очки считаются за каждый матч отдельно. Неудачный матч не снижает ваш рекорд.
            </span>
            <span className="text-amber-400/90 font-bold whitespace-nowrap">
              Best of 15
            </span>
          </div>
        </div>

        {/* ============ 2. РЕГЛАМЕНТ И ПРАВИЛА ОРГАНИЗАТОРОВ (ПРОСТО ТЕКСТ) ============ */}
        {hasWrittenText && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="border-b border-white/10 pb-2.5">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                Регламент турнира
              </div>
              <h4 className="text-xs sm:text-sm font-black uppercase text-white tracking-wide mt-0.5">
                Условия и правила организаторов
              </h4>
            </div>

            <div className="space-y-2 text-xs sm:text-sm text-gray-300 leading-relaxed">
              {writtenLines.map((rawLine, idx) => {
                const line = rawLine.trim();
                if (!line) return <div key={idx} className="h-1" />;

                // Emoji or big title
                if (line.startsWith("🏆")) {
                  return (
                    <div key={idx} className="text-sm font-black uppercase text-amber-400 tracking-wide pt-1">
                      {line}
                    </div>
                  );
                }

                // Section headers: "1. ЛИМИТ...", "3. КВАЛИФИКАЦИЯ"
                if (/^([0-9]\uFE0F?\u20E3|\d+[\.\)])\s+[А-ЯA-Z]/u.test(line)) {
                  return (
                    <div key={idx} className="text-xs sm:text-sm font-black uppercase text-white tracking-wide pt-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" />
                      {line}
                    </div>
                  );
                }

                // Important note callout
                if (line.startsWith("*")) {
                  return (
                    <div key={idx} className="bg-amber-500/10 border border-amber-500/20 text-amber-300/95 rounded-xl p-3 text-xs leading-relaxed my-1">
                      {line}
                    </div>
                  );
                }

                // Bullet item
                if (line.startsWith("•") || line.startsWith("-")) {
                  return (
                    <div key={idx} className="flex items-start gap-2.5 py-0.5 text-gray-300">
                      <span className="text-amber-400 font-bold shrink-0 mt-0.5">•</span>
                      <span className="min-w-0">{line.replace(/^[•\-]\s*/, "")}</span>
                    </div>
                  );
                }

                // Regular prose paragraph
                return (
                  <p key={idx} className="text-gray-300 leading-relaxed">
                    {line}
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const titleCls = "text-[10px] font-black uppercase tracking-[0.2em] text-white/40";
  const boxCls = "bg-white/5 border border-white/10 rounded-2xl p-4";
  const trayCls = "inline-flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 max-w-full overflow-x-auto no-scrollbar shrink-0";
  const tabBtn = (active: boolean) => cn(
    "py-2 px-3 sm:px-3.5 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-all cursor-pointer text-center select-none",
    active ? "bg-white text-black shadow" : "text-gray-400 hover:text-white"
  );

  const GameTabs = () => (
    <div className={trayCls}>
      {(["CS2", "Dota2", "PUBG"] as const).map((game) => (
        <button key={game} onClick={() => setActiveTab(game)} className={tabBtn(activeTab === game)}>
          {game === "Dota2" ? "Dota 2" : game}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 pb-48 sm:pb-36 font-sans">
      <PromoHeader initialPlayer={player} title="FRAG зона" />
      <div className="max-w-xl lg:max-w-5xl mx-auto pt-4 space-y-5">

        {/* Main tabs: underline nav, no flex squishing, smooth swipe on mobile */}
        <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar -mx-1">
          {([["play", "Играть"], ["earn", "Заработок"], ["history", "История"], ["tours", "Турниры"], ["leaders", "Лидеры"], ["rules", "Правила"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => switchMainTab(key)}
              className={cn(
                "px-3.5 py-3 text-xs sm:text-sm font-black uppercase tracking-wide whitespace-nowrap shrink-0 cursor-pointer border-b-[3px] -mb-px transition-colors",
                mainTab === key ? "text-amber-400 border-amber-400" : "text-gray-500 border-transparent hover:text-gray-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {/* ============ PLAY ============ */}
        {mainTab === "play" && (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
            <div className={cn(boxCls, "flex items-center justify-between text-xs font-bold")}>
              <div className="flex items-center gap-2.5">
                <span className={cn("w-2 h-2 rounded-full animate-pulse", agentOnline ? "bg-emerald-400" : "bg-amber-400")} />
                <span className="text-gray-300">
                  {agentOnline ? (isPlaying ? `В игре: ${agentState?.ActiveGame}` : "Агент активен, ждём игру") : "Агент на ПК выключен"}
                </span>
              </div>
              {!agentOnline && (
                <a href="dashfrag://launch" className="text-amber-400 hover:text-amber-300 uppercase tracking-wider">Запустить</a>
              )}
            </div>
            {!fragEnabled && (
              <div className="text-center text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 py-2 rounded-xl">
                Модуль FRAG сейчас отключен в клубе
              </div>
            )}
            </div>

            {liveGame && agentState ? (
              <div className="rounded-2xl p-4 bg-orange-500/5 border border-orange-500/20 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black uppercase text-orange-400">Сейчас в игре · {gameName(liveGame)}</span>
                  <span className="font-black bg-white/10 px-2 py-0.5 rounded">{liveScore}</span>
                </div>
                {agentState.IsModeSupported === false && (
                  <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
                    Режим не поддерживается, бонусы не начисляются. Играйте в соревновательном режиме.
                  </div>
                )}
                <div className="text-center">
                  <div className="text-3xl font-black text-orange-400">+{agentState.EarnedBonuses.toFixed(1)} ₽</div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">Награда за этот матч</div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {liveStats.map(([label, value]) => (
                    <div key={label}>
                      <div className="text-lg font-black">{value}</div>
                      <div className="text-[9px] uppercase tracking-wider text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
                {agentState.ActivityFeed?.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-1 border-t border-white/5 pt-2">
                    {agentState.ActivityFeed.map((log, idx) => (
                      <div key={idx} className="text-[11px] text-gray-300">{log}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className={cn(boxCls, "space-y-3")}>
                <div className={titleCls}>Как начать</div>
                {[
                  ["1", "Запустите Dash FRAG", "Откройте приложение на игровом ПК. Статус выше станет «Агент активен»."],
                  ["2", "Начните матч", "CS2 (MM, Премьер, Faceit), Dota 2 (рейтинг) или PUBG."],
                  ["3", "Получайте рубли", "Награда падает на баланс за каждое действие в матче."],
                ].map(([n, t, d]) => (
                  <div key={n} className="flex gap-3">
                    <div className="text-amber-400 font-black text-sm w-4">{n}</div>
                    <div>
                      <div className="text-sm font-bold">{t}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ EARNINGS ============ */}
        {mainTab === "earn" && (
          <div className="space-y-5">
            <GameTabs />

            <div className="grid grid-cols-3 gap-2">
              {([["Заработано всего", `${totalEarned.toFixed(1)} ₽`], ["Сегодня", `${todayEarned.toFixed(1)} ₽`], ["Матчей", totalMatches]] as const).map(([l, v]) => (
                <div key={l} className={cn(boxCls, "text-center p-3")}>
                  <div className="text-base font-black text-amber-400">{v}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-500 mt-0.5">{l}</div>
                </div>
              ))}
            </div>

            <div className={cn(boxCls, "space-y-4")}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/10 pb-3">
                <div>
                  <div className={titleCls}>Тарифная сетка вознаграждений</div>
                  <div className="text-base font-black text-white mt-0.5">Сколько платят за действия · {gameLabel}</div>
                </div>
                <div className="text-xs text-gray-400">Бонусы начисляются на баланс клуба</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                {tariffs.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-xs sm:text-sm py-2 border-b border-white/5 last:border-0">
                    <span className="text-gray-300">{t.label}</span>
                    <span className="font-black text-amber-400 shrink-0 ml-3">+{t.value % 1 === 0 ? t.value : t.value.toFixed(1)} ₽</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={cn(boxCls, "flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20")}>
              <div>
                <div className="text-xs font-black uppercase text-amber-400">История матчей и начислений</div>
                <div className="text-xs text-gray-400 mt-0.5">Полный список всех сыгранных игр, K/D статистика и хронология каждого раунда</div>
              </div>
              <button
                onClick={() => switchMainTab("history")}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shrink-0 transition-colors"
              >
                Открыть историю →
              </button>
            </div>
          </div>
        )}

        {/* ============ MATCH HISTORY ============ */}
        {mainTab === "history" && (
          <div className="space-y-4">
            {/* Game filter tray */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className={trayCls}>
                {(
                  [
                    ["ALL", "Все игры"],
                    ["CS2", "CS2"],
                    ["Dota2", "Dota 2"],
                    ["PUBG", "PUBG"],
                  ] as const
                ).map(([g, label]) => (
                  <button
                    key={g}
                    onClick={() => setHistoryGame(g)}
                    className={cn(tabBtn(historyGame === g), "py-1.5 px-3 text-[11px]")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-400">
                Всего матчей: <b className="text-white">{historyList.length}</b>
              </div>
            </div>

            {/* Quick stats for current filter */}
            <div className="grid grid-cols-3 gap-2">
              <div className={cn(boxCls, "text-center p-3")}>
                <div className="text-base font-black text-amber-400">
                  +{historyList.reduce((acc, m) => acc + (parseFloat(m.earned) || 0), 0).toFixed(1)} ₽
                </div>
                <div className="text-[9px] uppercase tracking-wider text-gray-500 mt-0.5">Заработано</div>
              </div>
              <div className={cn(boxCls, "text-center p-3")}>
                <div className="text-base font-black text-white">{historyList.length}</div>
                <div className="text-[9px] uppercase tracking-wider text-gray-500 mt-0.5">Игр сыграно</div>
              </div>
              <div className={cn(boxCls, "text-center p-3")}>
                <div className="text-base font-black text-emerald-400">
                  {historyList.filter((m) => matchResult(m, parseMatchEvents(m.events)) === "win").length}
                  <span className="text-xs text-gray-500 font-normal"> / </span>
                  <span className="text-rose-400 font-black">
                    {historyList.filter((m) => matchResult(m, parseMatchEvents(m.events)) === "loss").length}
                  </span>
                </div>
                <div className="text-[9px] uppercase tracking-wider text-gray-500 mt-0.5">Победы / Поражения</div>
              </div>
            </div>

            {/* Match Cards List */}
            {historyLoading ? (
              <div className="text-center py-10 text-gray-500 text-xs font-bold">Загрузка истории матчей...</div>
            ) : historyList.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 text-center text-gray-500 text-xs">
                В этой категории сыгранных матчей пока нет
              </div>
            ) : (
              <div className="space-y-2.5">
                {historyList.slice(0, showAllMatches ? 50 : 10).map((match) => {
                  const timeStr = new Date(match.played_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
                  const isExpanded = expandedMatchId === String(match.id);
                  const rows = parseMatchEvents(match.events);
                  const groups = groupEvents(rows.filter((r) => r.amount !== 0));
                  const result = matchResult(match, rows);
                  const resultLabel = result === "win" ? "Победа" : result === "loss" ? "Поражение" : result === "draw" ? "Ничья" : "";
                  const kd = match.deaths > 0 ? (match.kills / match.deaths).toFixed(2) : String(match.kills);
                  const cells: [string, string | number][] =
                    match.game === "CS2" ? [["Киллы", match.kills], ["Смерти", match.deaths], ["Ассисты", match.assists], ["Хедшоты", match.headshots ?? 0]] :
                    match.game === "PUBG" ? [["Киллы", match.kills], ["Результат", match.score ?? "-"]] :
                    [["Киллы", match.kills], ["Смерти", match.deaths], ["Ассисты", match.assists], ["Ластхиты", match.last_hits ?? 0]];
                  return (
                    <div key={match.id} className={cn(boxCls, "p-3.5")}>
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleMatchExpand(String(match.id))}>
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-white/10 text-gray-300">
                              {gameName(match.game)}
                            </span>
                            <span className="text-xs font-bold truncate">
                              {match.map}{match.score && match.game !== "PUBG" ? ` · ${match.score}` : ""}
                            </span>
                            {resultLabel && (
                              <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded", result === "win" ? "bg-emerald-500/15 text-emerald-400" : result === "loss" ? "bg-rose-500/15 text-rose-400" : "bg-white/10 text-gray-300")}>
                                {resultLabel}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-1">
                            {match.kills} киллов / {match.deaths} смертей / {match.assists} ассистов · {timeStr}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs sm:text-sm font-black text-amber-400">+{parseFloat(match.earned).toFixed(1)} ₽</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{isExpanded ? "Свернуть ▲" : "Детали ▼"}</div>
                        </div>
                      </div>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mt-3 pt-3 border-t border-white/5 space-y-3 text-xs text-gray-300"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-[11px] text-gray-400">{timeStr}</div>
                              {resultLabel && (
                                <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-lg", result === "win" ? "bg-emerald-500/15 text-emerald-400" : result === "loss" ? "bg-rose-500/15 text-rose-400" : "bg-white/10 text-gray-300")}>
                                  {resultLabel}{match.score && match.game !== "PUBG" ? ` ${match.score}` : ""}
                                </span>
                              )}
                            </div>

                            <div className={cn("grid gap-2 text-center", cells.length === 2 ? "grid-cols-2" : "grid-cols-4")}>
                              {cells.map(([l, v]) => (
                                <div key={l} className="bg-white/5 rounded-xl py-2">
                                  <div className="text-base font-black text-white">{v}</div>
                                  <div className="text-[9px] uppercase tracking-wider text-gray-500">{l}</div>
                                </div>
                              ))}
                            </div>
                            {match.game !== "PUBG" && (
                              <div className="text-[11px] text-gray-400 text-center">Соотношение убийств к смертям (K/D): <b className="text-white">{kd}</b></div>
                            )}

                            {groups.length > 0 ? (
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1.5">За что начислено</div>
                                <div className="divide-y divide-white/5">
                                  {groups.map((g) => (
                                    <div key={g.title} className="flex items-center justify-between py-1.5 text-xs">
                                      <span className="text-gray-300">{g.title}{g.count > 1 && <span className="text-gray-500"> × {g.count}</span>}</span>
                                      <span className={cn("font-black", g.sum < 0 ? "text-rose-400" : "text-amber-400")}>{g.sum > 0 ? "+" : ""}{g.sum.toFixed(2).replace(/\.?0+$/, "")} ₽</span>
                                    </div>
                                  ))}
                                  <div className="flex items-center justify-between pt-2 text-sm font-black">
                                    <span>Итого за матч</span>
                                    <span className="text-amber-400">+{parseFloat(match.earned).toFixed(1)} ₽</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-gray-500">Подробная разбивка по начислениям для этого матча недоступна.</div>
                            )}

                            {rows.length > 0 && (
                              <details className="group">
                                <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-white list-none">
                                  Хронология матча ({rows.length})
                                </summary>
                                <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                                  {rows.map((r, i) => (
                                    <div key={i} className="flex justify-between gap-3 text-[11px] text-gray-400">
                                      <span>{r.time && <span className="text-gray-600 mr-2">{r.time}</span>}{r.title}</span>
                                      {r.amount !== 0 && <span className="shrink-0">{r.amount > 0 ? "+" : ""}{r.amount.toFixed(2).replace(/\.?0+$/, "")} ₽</span>}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                {historyList.length > 10 && (
                  <button
                    onClick={() => setShowAllMatches(!showAllMatches)}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-300 transition-colors cursor-pointer"
                  >
                    {showAllMatches ? "Свернуть до 10 матчей" : `Показать ещё (всего ${historyList.length})`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============ TOURNAMENTS ============ */}
        {mainTab === "tours" && (
          <div className="space-y-4">
            {!openTour ? (
              <>
                <div className={cn(trayCls, "max-w-md")}>
                  <button onClick={() => setTourTab("active")} className={tabBtn(tourTab === "active")}>Активные ({activeTours.length})</button>
                  <button onClick={() => setTourTab("history")} className={tabBtn(tourTab === "history")}>История ({pastTours.length})</button>
                </div>
                {tournamentsLoading ? (
                  <div className="text-center py-8 text-gray-500 text-xs">Загрузка...</div>
                ) : tourList.length === 0 ? (
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center text-gray-500 text-xs">
                    {tourTab === "active" ? "Сейчас активных турниров нет" : "Завершённых турниров пока нет"}
                  </div>
                ) : (
                  <div className={cn(boxCls, "p-0 overflow-hidden")}>
                    {tourList.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setOpenTourId(t.id);
                          setTourSub("overview");
                          if (typeof window !== "undefined") {
                            const params = new URLSearchParams(window.location.search);
                            params.set("tab", "tours");
                            params.set("tour", String(t.id));
                            params.delete("sub");
                            params.delete("ttab");
                            const qs = params.toString();
                            window.history.pushState(null, "", `${window.location.pathname}?${qs}`);
                          }
                        }}
                        className="w-full text-left flex items-center justify-between gap-4 px-4 py-4 border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-black uppercase leading-tight">{t.title}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {fmtDate(t.start_date)} — {fmtDate(t.end_date)} · {gameName(t.game)} · участников: {t.fullLeaderboardCount ?? 0}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] uppercase text-gray-500">Ваше место</div>
                          <div className="text-lg font-black text-indigo-400 leading-tight">
                            {t.myStats?.rank ? `#${t.myStats.rank}` : "—"}
                            {t.myStats?.rank_change > 0 && <span className="text-xs text-emerald-400 font-bold ml-1">▲ +{t.myStats.rank_change}</span>}
                            {t.myStats?.rank_change < 0 && <span className="text-xs text-rose-400 font-bold ml-1">▼ {Math.abs(t.myStats.rank_change)}</span>}
                          </div>
                          <div className="text-[11px] text-gray-500">Открыть →</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (() => {
              const t = openTour;
              const active = isTActive(t);
              const played = t.myStats?.matches_count ?? 0;
              const need = t.min_matches || 0;
              const pct = need ? Math.min(100, Math.round((played / need) * 100)) : 100;
              const factRows: [string, string][] = [
                ["Игра", gameName(t.game)],
                ["Даты проведения", `${fmtDate(t.start_date)} — ${fmtDate(t.end_date)}`],
                ["Статус", active ? "Идёт" : "Завершён"],
                ["Участников", String(t.fullLeaderboardCount ?? 0)],
                ["Игр для попадания в рейтинг", String(need)],
                ["Призовых мест", String(t.prizes?.length ?? 0)],
              ];
              const myRows: [string, React.ReactNode][] = [
                [
                  "Место",
                  <div className="flex items-center gap-1.5 font-black" key="rank">
                    <span>{t.myStats?.rank ? `#${t.myStats.rank}` : "вне рейтинга"}</span>
                    {t.myStats?.rank_change > 0 && <span className="text-xs text-emerald-400 font-bold">▲ +{t.myStats.rank_change}</span>}
                    {t.myStats?.rank_change < 0 && <span className="text-xs text-rose-400 font-bold">▼ {Math.abs(t.myStats.rank_change)}</span>}
                  </div>,
                ],
                ["Очки в зачёте", `${t.myStats?.points ?? 0} PTS`],
                ["Победы / поражения", `${t.myStats?.wins ?? 0} / ${t.myStats?.losses ?? 0}`],
                ["Сыграно игр", `${played} (в зачёте ${t.myMatches?.filter((m: any) => m.isCounted).length ?? 0} из 15)`],
              ];
              const subTabs = [
                ["overview", "Обзор"],
                ["matches", `Сыгранные игры (${t.myMatches?.length ?? 0})`],
                ["board", `Таблица (${t.leaderboard?.length ?? 0})`],
                ["prizes", "Призы"],
                ["rules", "Правила"],
              ] as const;
              return (
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setOpenTourId(null);
                      if (typeof window !== "undefined") {
                        const params = new URLSearchParams(window.location.search);
                        params.set("tab", "tours");
                        params.delete("tour");
                        params.delete("sub");
                        const qs = params.toString();
                        window.history.pushState(null, "", `${window.location.pathname}?${qs}`);
                      }
                    }}
                    className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white cursor-pointer"
                  >
                    ← Все турниры
                  </button>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-black uppercase leading-tight">{t.title}</h2>
                    <span className={cn("text-[10px] font-black uppercase px-2.5 py-1 rounded-lg", active ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-gray-400")}>
                      {active ? "Идёт" : "Завершён"}
                    </span>
                  </div>

                  <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar">
                    {subTabs.map(([k, l]) => (
                      <button
                        key={k}
                        onClick={() => setTourSub(k)}
                        className={cn(
                          "px-4 py-2.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 -mb-px cursor-pointer",
                          tourSub === k ? "text-white border-white" : "text-gray-500 border-transparent hover:text-gray-300"
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>

                  {tourSub === "overview" && (
                    <div className={cn(boxCls, "p-0 lg:grid lg:grid-cols-2 lg:divide-x divide-white/10")}>
                      <div className="p-4 space-y-3">
                        <div className={titleCls}>Моё участие</div>
                        <div className="divide-y divide-white/5">
                          {myRows.map(([l, v]) => (
                            <div key={l} className="flex justify-between items-center py-2 text-sm"><span className="text-gray-400">{l}</span><span className="font-black">{v}</span></div>
                          ))}
                        </div>
                        <div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-indigo-400" style={{ width: `${pct}%` }} /></div>
                          <div className="text-xs text-gray-400 mt-1.5">
                            {t.myStats?.qualified ? "Вы в рейтинге." : `Сыграйте ещё ${Math.max(0, need - played)} игр, чтобы попасть в рейтинг.`}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 space-y-3 border-t border-white/10 lg:border-t-0">
                        <div className={titleCls}>О турнире</div>
                        <div className="divide-y divide-white/5">
                          {factRows.map(([l, v]) => (
                            <div key={l} className="flex justify-between gap-4 py-2 text-sm"><span className="text-gray-400">{l}</span><span className="font-bold text-right">{v}</span></div>
                          ))}
                        </div>
                        {t.description && (
                          <div className="text-xs text-gray-400 leading-relaxed pt-2 border-t border-white/5 space-y-1.5">
                            <p className="line-clamp-4 whitespace-pre-line">{t.description}</p>
                            <button
                              onClick={() => setTourSub("rules")}
                              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 block cursor-pointer"
                            >
                              Читать полный регламент турнира →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {tourSub === "matches" && (
                    <div className="space-y-4">
                      {/* Summary banner */}
                      <div className={cn(boxCls, "space-y-3")}>
                        <div>
                          <div className="text-xs font-black uppercase tracking-wider text-white">
                            Матчи в зачёт турнира
                          </div>
                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                            В зачёт идут до 15 ваших лучших матчей за период турнира. Более успешные игры автоматически вытесняют худшие.
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-white/5">
                          <div className="bg-white/5 rounded-xl py-2 px-1">
                            <div className="text-base font-black text-white">{t.myMatches?.length ?? 0}</div>
                            <div className="text-[9px] uppercase tracking-wider text-gray-500">Сыграно</div>
                          </div>
                          <div className="bg-white/5 rounded-xl py-2 px-1">
                            <div className="text-base font-black text-emerald-400">
                              {t.myMatches?.filter((m: any) => m.isCounted).length ?? 0} / 15
                            </div>
                            <div className="text-[9px] uppercase tracking-wider text-gray-500">В зачёте</div>
                          </div>
                          <div className="bg-white/5 rounded-xl py-2 px-1">
                            <div className="text-base font-black text-indigo-400">{t.myStats?.points ?? 0}</div>
                            <div className="text-[9px] uppercase tracking-wider text-gray-500">Очков PTS</div>
                          </div>
                        </div>
                      </div>

                      {/* Matches list */}
                      {!t.myMatches || t.myMatches.length === 0 ? (
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 text-center text-gray-500 text-xs">
                          В период этого турнира вы пока не сыграли ни одного матча. Запустите соревновательную игру на ПК клуба, чтобы заработать очки!
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {t.myMatches.map((m: any) => {
                            const isExpanded = expandedTourMatchId === m.id;
                            const timeStr = new Date(m.played_at).toLocaleString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            const kd = m.deaths > 0 ? (m.kills / m.deaths).toFixed(2) : String(m.kills);
                            const cells: [string, string | number][] =
                              m.game === "CS2"
                                ? [
                                    ["Киллы", m.kills],
                                    ["Смерти", m.deaths],
                                    ["Ассисты", m.assists],
                                    ["Хедшоты", m.headshots ?? 0],
                                  ]
                                : m.game === "PUBG"
                                ? [
                                    ["Киллы", m.kills],
                                    ["Результат", m.score ?? "-"],
                                  ]
                                : [
                                    ["Киллы", m.kills],
                                    ["Смерти", m.deaths],
                                    ["Ассисты", m.assists],
                                    ["Ластхиты", m.last_hits ?? 0],
                                  ];

                            const b = m.breakdown || {};

                            return (
                              <div
                                key={m.id}
                                className={cn(
                                  boxCls,
                                  "p-3.5 transition-colors",
                                  m.isCounted ? "border-emerald-500/20" : "opacity-80"
                                )}
                              >
                                <div
                                  className="flex items-center justify-between cursor-pointer gap-2"
                                  onClick={() => setExpandedTourMatchId(isExpanded ? null : m.id)}
                                >
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold truncate">
                                        {m.map || gameName(m.game)}
                                        {m.score && m.game !== "PUBG" ? ` · ${m.score}` : ""}
                                      </span>
                                      {m.isCounted ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                          В зачёте (Топ-15)
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 whitespace-nowrap">
                                          Вне зачёта
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-gray-400">
                                      {m.kills} / {m.deaths} / {m.assists} · {timeStr}
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <div
                                      className={cn(
                                        "text-base font-black leading-tight",
                                        m.points > 0 ? "text-emerald-400" : "text-gray-400"
                                      )}
                                    >
                                      +{m.points} PTS
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                      {m.isWin ? "Победа" : "Поражение"} · {isExpanded ? "Скрыть ▲" : "Детали ▼"}
                                    </div>
                                  </div>
                                </div>

                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden mt-3 pt-3 border-t border-white/5 space-y-3 text-xs text-gray-300"
                                    >
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-gray-400">{timeStr}</span>
                                        <span
                                          className={cn(
                                            "text-[10px] font-black uppercase px-2 py-0.5 rounded-lg",
                                            m.isWin
                                              ? "bg-emerald-500/15 text-emerald-400"
                                              : "bg-rose-500/15 text-rose-400"
                                          )}
                                        >
                                          {m.isWin ? "Победа" : "Поражение"}
                                          {m.score && m.game !== "PUBG" ? ` ${m.score}` : ""}
                                        </span>
                                      </div>

                                      <div
                                        className={cn(
                                          "grid gap-2 text-center",
                                          cells.length === 2 ? "grid-cols-2" : "grid-cols-4"
                                        )}
                                      >
                                        {cells.map(([l, v]) => (
                                          <div key={l} className="bg-white/5 rounded-xl py-2">
                                            <div className="text-base font-black text-white">{v}</div>
                                            <div className="text-[9px] uppercase tracking-wider text-gray-500">{l}</div>
                                          </div>
                                        ))}
                                      </div>

                                      {m.game !== "PUBG" && (
                                        <div className="text-[11px] text-gray-400 text-center">
                                          Соотношение K/D: <b className="text-white">{kd}</b>
                                        </div>
                                      )}

                                      <div>
                                        <div className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1.5">
                                          Начисление очков турнира
                                        </div>
                                        <div className="divide-y divide-white/5">
                                          <div className="flex items-center justify-between py-1 text-xs">
                                            <span className="text-gray-300">
                                              {m.isWin ? "Победа в матче" : "Поражение в матче"}
                                            </span>
                                            <span
                                              className={cn(
                                                "font-black",
                                                (b.win ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                                              )}
                                            >
                                              {(b.win ?? 0) > 0 ? `+${b.win}` : b.win ?? 0} PTS
                                            </span>
                                          </div>
                                          {b.kills !== 0 && b.kills !== undefined && (
                                            <div className="flex items-center justify-between py-1 text-xs">
                                              <span className="text-gray-300">Убийства ({m.kills})</span>
                                              <span className="font-black text-emerald-400">+{b.kills} PTS</span>
                                            </div>
                                          )}
                                          {b.assists !== 0 && b.assists !== undefined && (
                                            <div className="flex items-center justify-between py-1 text-xs">
                                              <span className="text-gray-300">Ассисты ({m.assists})</span>
                                              <span className="font-black text-emerald-400">+{b.assists} PTS</span>
                                            </div>
                                          )}
                                          {b.deaths !== 0 && b.deaths !== undefined && (
                                            <div className="flex items-center justify-between py-1 text-xs">
                                              <span className="text-gray-300">Смерти ({m.deaths})</span>
                                              <span className="font-black text-rose-400">{b.deaths} PTS</span>
                                            </div>
                                          )}
                                          {b.headshots > 0 && (
                                            <div className="flex items-center justify-between py-1 text-xs">
                                              <span className="text-gray-300">Хедшоты ({m.headshots})</span>
                                              <span className="font-black text-emerald-400">+{b.headshots} PTS</span>
                                            </div>
                                          )}
                                          {b.specials > 0 && (
                                            <div className="flex items-center justify-between py-1 text-xs">
                                              <span className="text-gray-300">Достижения (MVP, нож, серии)</span>
                                              <span className="font-black text-emerald-400">+{b.specials} PTS</span>
                                            </div>
                                          )}
                                          <div className="flex items-center justify-between pt-2 text-sm font-black border-t border-white/10">
                                            <span>Итого за матч</span>
                                            <span className={cn(m.points > 0 ? "text-emerald-400" : "text-gray-400")}>
                                              +{m.points} PTS
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {!m.isCounted && (
                                        <div className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
                                          Матч остался вне зачёта, так как в топ-15 вошли матчи с более высоким количеством очков.
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
                  )}

                  {tourSub === "prizes" && (
                    <div className={cn(boxCls, "p-0 overflow-hidden")}>
                      {!t.prizes?.length ? (
                        <div className="p-6 text-center text-xs text-gray-500">Призы не указаны</div>
                      ) : t.prizes.map((p: any) => {
                        const money = parseFloat(p.reward) || 0;
                        return (
                          <div key={p.place} className="flex items-start gap-4 px-4 py-4 border-b border-white/5 last:border-0">
                            <div className={cn(
                              "w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-black text-lg",
                              p.place === 1 ? "bg-amber-400/15 text-amber-400" : p.place === 2 ? "bg-slate-300/15 text-slate-300" : p.place === 3 ? "bg-amber-700/20 text-amber-600" : "bg-white/10 text-gray-300"
                            )}>{p.place}</div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="text-[10px] uppercase tracking-wider text-gray-500">{p.place} место</div>
                              {money > 0 && <div className="text-lg font-black text-amber-400 leading-tight">{money.toLocaleString("ru-RU")} ₽ на баланс</div>}
                              {p.text_prize && <div className="text-sm font-bold text-white">{money > 0 ? "+ " : ""}{p.text_prize}</div>}
                              {!money && !p.text_prize && <div className="text-sm text-gray-500">—</div>}
                              {p.description && <div className="text-xs text-gray-400">{p.description}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {tourSub === "rules" && (
                    <div className="space-y-4">
                      <div className={cn(boxCls, "space-y-4")}>
                        <div className="border-b border-white/10 pb-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                            Регламент турнира
                          </div>
                          <h2 className="text-base font-black uppercase text-white mt-0.5">
                            {t.title}
                          </h2>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {fmtDate(t.start_date)} — {fmtDate(t.end_date)} · {gameName(t.game)}
                          </div>
                        </div>

                        {renderTournamentRulesReader(t.description, t.game)}
                      </div>
                    </div>
                  )}

                  {tourSub === "board" && renderBoard(t)}
                </div>
              );
            })()}
          </div>
        )}

        {/* ============ LEADERS (GENERAL CLUB RANKING) ============ */}
        {mainTab === "leaders" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black uppercase tracking-tight text-white leading-snug">
                  Общий рейтинг клуба FRAG
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Все игроки клуба, когда-либо игравшие в соревновательные игры через Dash FRAG.
                </p>
              </div>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {/* Game filter */}
              <div className={trayCls}>
                {(
                  [
                    ["ALL", "Все игры"],
                    ["CS2", "CS2"],
                    ["Dota2", "Dota 2"],
                    ["PUBG", "PUBG"],
                  ] as const
                ).map(([g, label]) => (
                  <button
                    key={g}
                    onClick={() => {
                      setLeadersGame(g);
                      loadGeneralLeaders(g, leadersSort);
                    }}
                    className={cn(tabBtn(leadersGame === g), "px-3 py-1.5 text-[11px] whitespace-nowrap shrink-0")}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Sort filter */}
              <div className={trayCls}>
                {(
                  [
                    ["earned", "По заработку"],
                    ["kills", "По фрагам"],
                    ["matches", "По матчам"],
                  ] as const
                ).map(([s, label]) => (
                  <button
                    key={s}
                    onClick={() => {
                      setLeadersSort(s);
                      loadGeneralLeaders(leadersGame, s);
                    }}
                    className={cn(tabBtn(leadersSort === s), "px-3 py-1.5 text-[11px] whitespace-nowrap shrink-0")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Leaderboard Table */}
            {generalLeadersLoading ? (
              <div className="text-center py-12 text-gray-500 text-xs font-bold">
                Загрузка общего рейтинга...
              </div>
            ) : generalLeaders.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 text-center text-gray-500 text-xs">
                В этой категории пока нет сыгранных матчей
              </div>
            ) : (
              <div className={cn(boxCls, "p-0 overflow-hidden")}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/10">
                      <th className="py-3 pl-4 text-left w-12 font-bold">#</th>
                      <th className="py-3 text-left font-bold">Игрок</th>
                      <th className="py-3 text-right font-bold">
                        {leadersSort === "kills" ? "Фраги" : leadersSort === "matches" ? "Матчи" : "Заработано"}
                      </th>
                      <th className="py-3 text-right font-bold hidden sm:table-cell">
                        {leadersSort === "kills" ? "Заработано" : "Фраги"}
                      </th>
                      <th className="py-3 text-right font-bold hidden sm:table-cell">K/D</th>
                      <th className="py-3 pr-4 text-right font-bold hidden md:table-cell">Матчи</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generalLeaders.map((item) => {
                      const me = item.player_id === player?.id;
                      const displayName = item.nickname || item.full_name || "Игрок";
                      const maskedName = item.nickname || maskName(item.full_name);
                      return (
                        <tr
                          key={item.player_id}
                          onClick={() => router.push(`/promo/player/${item.player_id}`)}
                          className={cn(
                            "cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors",
                            me && "bg-amber-500/10 border-y border-amber-500/25"
                          )}
                        >
                          <td className="py-3 pl-4">
                            <span
                              className={cn(
                                "w-6 h-6 rounded-full inline-flex items-center justify-center font-black text-xs",
                                item.rank === 1
                                  ? "bg-amber-400/20 text-amber-400"
                                  : item.rank === 2
                                  ? "bg-slate-300/20 text-slate-300"
                                  : item.rank === 3
                                  ? "bg-amber-700/20 text-amber-600"
                                  : "text-gray-400 bg-white/5"
                              )}
                            >
                              {item.rank}
                            </span>
                          </td>
                          <td className="py-3 pr-2">
                            <div className="flex items-center gap-2.5">
                              {item.avatar_url ? (
                                <img
                                  src={item.avatar_url}
                                  alt=""
                                  className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/10"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-white/10 text-gray-300 flex items-center justify-center font-black text-[10px] shrink-0">
                                  {displayName[0]?.toUpperCase() || "P"}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className={cn("font-bold text-[13px] truncate", me ? "text-amber-300" : "text-white")}>
                                  {me ? `${item.full_name} (вы)` : maskedName}
                                </div>
                                <div className="text-[10px] text-gray-500 sm:hidden">
                                  {item.total_kills} фрагов · {item.matches_count} игр · K/D {item.kd}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-right font-black text-amber-400 text-[13px] whitespace-nowrap">
                            {leadersSort === "kills"
                              ? `${item.total_kills}`
                              : leadersSort === "matches"
                              ? `${item.matches_count}`
                              : `+${item.total_earned.toFixed(1)} ₽`}
                          </td>
                          <td className="py-3 text-right text-gray-200 font-bold hidden sm:table-cell">
                            {leadersSort === "kills"
                              ? `+${item.total_earned.toFixed(1)} ₽`
                              : `${item.total_kills}`}
                          </td>
                          <td className="py-3 text-right text-gray-400 hidden sm:table-cell">
                            {item.kd}
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-400 hidden md:table-cell">
                            {item.matches_count}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Footer with summary note */}
                <div className="px-4 py-3 text-[11px] text-gray-400 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 bg-white/[0.01]">
                  <span>Показаны лучшие игроки клуба ({generalLeaders.length}). Нажмите на игрока для перехода в его профиль.</span>
                  {myGeneralStats && (
                    <span className="text-amber-400 font-bold">
                      Ваш результат: #{myGeneralStats.rank} место · +{myGeneralStats.total_earned.toFixed(1)} ₽ · {myGeneralStats.total_kills} фрагов
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ RULES ============ */}
        {mainTab === "rules" && (
          <div className="space-y-5">
            {/* 1. Header info banner */}
            <div className={cn(boxCls, "space-y-3")}>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                  Регламент сервиса FRAG
                </div>
                <h2 className="text-base sm:text-lg font-black uppercase text-white mt-0.5">
                  Общие правила клуба и начисления наград
                </h2>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Сервис Dash FRAG автоматически отслеживает ваши соревновательные игры за компьютерами клуба, начисляет вознаграждения на клубный баланс и формирует рейтинги.
                </p>
              </div>

              {/* 3 Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3.5 space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Шаг 1 · Запуск
                  </div>
                  <div className="text-xs font-bold text-white">Садитесь за ПК клуба</div>
                  <div className="text-[11px] text-gray-400 leading-normal">
                    Запустите CS2, Dota 2 или PUBG под своим или гостевым аккаунтом.
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3.5 space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Шаг 2 · Игра
                  </div>
                  <div className="text-xs font-bold text-white">Соревновательный матч</div>
                  <div className="text-[11px] text-gray-400 leading-normal">
                    Играйте рейтинговые матчи. Локальный агент автоматически фиксирует каждое событие.
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3.5 space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Шаг 3 · Выплата
                  </div>
                  <div className="text-xs font-bold text-white">Баланс сразу на счёт</div>
                  <div className="text-[11px] text-gray-400 leading-normal">
                    После окончания матча рубли зачисляются на ваш клубный баланс.
                  </div>
                </div>
              </div>
            </div>

            {/* 2. System match eligibility rules */}
            <div className={cn(boxCls, "space-y-3.5")}>
              <div>
                <div className={titleCls}>Требования к матчам</div>
                <h3 className="text-sm font-black uppercase text-white mt-0.5">
                  Какие матчи и режимы засчитываются системой
                </h3>
              </div>

              <div className="divide-y divide-white/5 text-xs sm:text-sm">
                <div className="py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <span className="w-20 shrink-0 font-black text-white uppercase text-xs sm:text-sm">
                    CS2
                  </span>
                  <div className="space-y-1 text-gray-300">
                    <div>
                      <b className="text-white">Засчитываются:</b> Премьер-режим (Premier), Соревновательный режим (MM 5v5), Faceit.
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Карты официального соревновательного пула (Mirage, Dust II, Inferno, Nuke, Anubis, Ancient, Vertigo, Overpass, Train, Cache).
                    </div>
                    <div className="text-[11px] text-rose-400/90">
                      Не засчитываются: тренировки с ботами, локальные сервера с sv_cheats 1, Deathmatch, разминочные лобби.
                    </div>
                  </div>
                </div>

                <div className="py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <span className="w-20 shrink-0 font-black text-white uppercase text-xs sm:text-sm">
                    Dota 2
                  </span>
                  <div className="space-y-1 text-gray-300">
                    <div>
                      <b className="text-white">Засчитываются:</b> Рейтинговые онлайн-матчи (Matchmaking, Ranked All Pick, Ranked Captains Mode) и Turbo.
                    </div>
                    <div className="text-[11px] text-rose-400/90">
                      Не засчитываются: пользовательские кастомки (Custom Games), лобби с читами, матчи против ботов.
                    </div>
                  </div>
                </div>

                <div className="py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <span className="w-20 shrink-0 font-black text-white uppercase text-xs sm:text-sm">
                    PUBG
                  </span>
                  <div className="space-y-1 text-gray-300">
                    <div>
                      <b className="text-white">Засчитываются:</b> Обычные и рейтинговые онлайн-матчи Battlegrounds против реальных игроков.
                    </div>
                    <div className="text-[11px] text-rose-400/90">
                      Не засчитываются: полигон тренировок, закрытые кастомки.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Earnings & Club Balance */}
            <div className={cn(boxCls, "space-y-3")}>
              <div>
                <div className={titleCls}>Начисление баланса</div>
                <h3 className="text-sm font-black uppercase text-white mt-0.5">
                  Как работает начисление рублей на баланс
                </h3>
              </div>
              <div className="space-y-2 text-xs sm:text-sm text-gray-300 leading-relaxed">
                <p>
                  За каждое результативное действие в игре (убийство, хедшот, ассист, победа, стрик-серии, нож, Zeus) система начисляет рубли на ваш клубный баланс.
                </p>
                <p>
                  Все текущие тарифы за действия устанавливаются клубом индивидуально. Актуальные расценки для каждой игры можно посмотреть во вкладке <b className="text-white">«Заработок»</b>.
                </p>
                <p className="text-[11px] text-gray-400">
                  Начисленный баланс можно использовать для оплаты игрового времени, продления сессий и заказа позиций в баре клуба.
                </p>
              </div>
            </div>

            {/* 4. Tournaments & PTS rating */}
            <div className={cn(boxCls, "space-y-3")}>
              <div>
                <div className={titleCls}>Турнирная система клуба</div>
                <h3 className="text-sm font-black uppercase text-white mt-0.5">
                  Турниры, рейтинг PTS и призовые фонды
                </h3>
              </div>
              <div className="space-y-2 text-xs sm:text-sm text-gray-300 leading-relaxed">
                <p>
                  В клубе регулярно проходят турнирные сезоны и ладдеры с призовыми фондами (наличные, пополнение баланса, геймерские девайсы).
                </p>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="font-bold text-white">Принципы турнирного подсчёта:</div>
                  <div className="text-gray-300">• <b className="text-white">Best of 15:</b> в зачёт турнирной таблицы берутся только 15 ваших лучших матчей. Неудачные игры не ухудшают вашу позицию.</div>
                  <div className="text-gray-300">• <b className="text-white">Защита от минуса:</b> минимальный балл за отдельный матч равен 0 PTS (вы не можете уйти в минус за игру).</div>
                  <div className="text-gray-300">• <b className="text-white">Личный регламент турнира:</b> каждый турнир имеет свои даты, правила организаторов и призовой фонд. Их можно посмотреть во вкладке <b className="text-white">«Турниры»</b>.</div>
                </div>
              </div>
            </div>

            {/* 5. Fair Play & Security */}
            <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-4 sm:p-5 space-y-2.5">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">
                Честная игра (Fair Play)
              </div>
              <h3 className="text-sm font-black uppercase text-white">
                Правила безопасности и запрет мошенничества
              </h3>
              <div className="space-y-1.5 text-xs text-gray-300 leading-relaxed">
                <p>
                  • Категорически запрещено использование читов, скриптов, макросов, скинченджеров и любого стороннего ПО, вмешивающегося в клиент игры.
                </p>
                <p>
                  • Запрещены договорные матчи, намеренная игра против ботов или фарм статистики на пустых серверах. Система автоматически валидирует соответствие матчей официальным протоколам.
                </p>
                <p>
                  • При обнаружении нечестной игры или абуза результат игрока аннулируется, заработанный баланс списывается, а аккаунт блокируется во всей сети клубов.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}
