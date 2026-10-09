"use client";

import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  Swords,
  ExternalLink,
  ChevronRight,
  Shield,
  Zap,
  Crown,
  Sparkles,
  Users,
  CheckCircle2,
  Layers,
  Clock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Match {
  id: string | number;
  round: number;
  order_in_round: number;
  competitor_a_id: string | null;
  competitor_b_id: string | null;
  status: string;
  score1: number;
  score2: number;
  winner_competitor_id: string | null;
  scheduled_at?: string | Date | null;
  result?: any;
}

interface Competitor {
  id: string;
  type: string;
  display_name: string;
  team_id?: string | null;
  promo_team_id?: number | null;
  player_id?: string | null;
  team_logo?: string | null;
  player_elo?: number;
  meta?: any;
  team_members?: Array<{
    id: string;
    fullName: string;
    phoneNumber?: string;
    role?: string;
    elo?: number;
  }>;
}

interface TournamentBracketProps {
  tournament: any;
  matches: Match[];
  competitors: Competitor[];
  currentPlayer: any;
  userTeams: any[];
  clubId?: string;
  onSelectPlayer?: (pId: string, pName: string) => void;
}

interface BracketGridProps {
  roundNumbers: number[];
  roundsMap: Record<number, Match[]>;
  getLabel: (r: number) => string;
  badgeTitle: string;
  renderMatchCard: (m: Match) => React.ReactNode;
  zoom: number;
}

function BracketGrid({
  roundNumbers,
  roundsMap,
  getLabel,
  badgeTitle,
  renderMatchCard,
  zoom,
}: BracketGridProps) {
  const gridCanvasRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Array<{ d: string }>>([]);

  const calculateLines = useCallback(() => {
    if (!gridCanvasRef.current) return;
    const container = gridCanvasRef.current;
    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const scaleFactor = zoom || 1;
    const newLines: Array<{ d: string }> = [];

    for (let rIdx = 0; rIdx < roundNumbers.length - 1; rIdx++) {
      const currentRound = roundNumbers[rIdx];
      const nextRound = roundNumbers[rIdx + 1];

      const currentMatches = roundsMap[currentRound] || [];
      const nextMatches = roundsMap[nextRound] || [];

      const numPairs = Math.ceil(currentMatches.length / 2);

      for (let k = 0; k < numPairs; k++) {
        const matchA = currentMatches[2 * k];
        const matchB = currentMatches[2 * k + 1];
        const matchNext = nextMatches[k];

        const cardAEl = matchA ? (container.querySelector(`[data-match-id="${matchA.id}"]`) as HTMLElement | null) : null;
        const cardBEl = matchB ? (container.querySelector(`[data-match-id="${matchB.id}"]`) as HTMLElement | null) : null;
        const cardNextEl = matchNext ? (container.querySelector(`[data-match-id="${matchNext.id}"]`) as HTMLElement | null) : null;

        if (!cardAEl && !cardBEl) continue;

        let x1 = 0;
        let y1 = 0;
        let x2 = 0;
        let y2 = 0;

        if (cardAEl) {
          const rectA = cardAEl.getBoundingClientRect();
          x1 = (rectA.right - containerRect.left) / scaleFactor;
          y1 = (rectA.top + rectA.height / 2 - containerRect.top) / scaleFactor;
        }

        if (cardBEl) {
          const rectB = cardBEl.getBoundingClientRect();
          x2 = (rectB.right - containerRect.left) / scaleFactor;
          y2 = (rectB.top + rectB.height / 2 - containerRect.top) / scaleFactor;
        } else if (cardAEl) {
          x2 = x1;
          y2 = y1;
        }

        let xNext = 0;
        let yNext = 0;

        if (cardNextEl) {
          const rectNext = cardNextEl.getBoundingClientRect();
          xNext = (rectNext.left - containerRect.left) / scaleFactor;
          yNext = (rectNext.top + rectNext.height / 2 - containerRect.top) / scaleFactor;
        } else {
          xNext = (cardAEl ? x1 : x2) + 56;
          yNext = cardAEl && cardBEl ? (y1 + y2) / 2 : (cardAEl ? y1 : y2);
        }

        const startX = cardAEl ? x1 : x2;
        const xMid = startX + (xNext - startX) / 2;

        // Path for Card A (upper) -> exact center of Card A to exact center of Next Card
        if (cardAEl) {
          const diffY = yNext - y1;
          const radius = Math.min(10, Math.abs(diffY) / 2, Math.abs(xMid - x1) / 2);

          if (Math.abs(diffY) < 2 || radius < 1) {
            newLines.push({
              d: `M ${x1} ${y1} H ${xNext}`,
            });
          } else if (diffY > 0) {
            newLines.push({
              d: `M ${x1} ${y1} H ${xMid - radius} Q ${xMid} ${y1} ${xMid} ${y1 + radius} V ${yNext - radius} Q ${xMid} ${yNext} ${xMid + radius} ${yNext} H ${xNext}`,
            });
          } else {
            newLines.push({
              d: `M ${x1} ${y1} H ${xMid - radius} Q ${xMid} ${y1} ${xMid} ${y1 - radius} V ${yNext + radius} Q ${xMid} ${yNext} ${xMid + radius} ${yNext} H ${xNext}`,
            });
          }
        }

        // Path for Card B (lower) -> exact center of Card B to exact center of Next Card
        if (cardBEl && cardBEl !== cardAEl) {
          const diffY = yNext - y2;
          const radius = Math.min(10, Math.abs(diffY) / 2, Math.abs(xMid - x2) / 2);

          if (Math.abs(diffY) < 2 || radius < 1) {
            newLines.push({
              d: `M ${x2} ${y2} H ${xNext}`,
            });
          } else if (diffY > 0) {
            newLines.push({
              d: `M ${x2} ${y2} H ${xMid - radius} Q ${xMid} ${y2} ${xMid} ${y2 + radius} V ${yNext - radius} Q ${xMid} ${yNext} ${xMid + radius} ${yNext} H ${xNext}`,
            });
          } else {
            newLines.push({
              d: `M ${x2} ${y2} H ${xMid - radius} Q ${xMid} ${y2} ${xMid} ${y2 - radius} V ${yNext + radius} Q ${xMid} ${yNext} ${xMid + radius} ${yNext} H ${xNext}`,
            });
          }
        }
      }
    }

    setLines(newLines);
  }, [roundNumbers, roundsMap, zoom]);

  useEffect(() => {
    calculateLines();
    const t1 = setTimeout(calculateLines, 50);
    const t2 = setTimeout(calculateLines, 150);
    const t3 = setTimeout(calculateLines, 400);

    const ro = new ResizeObserver(() => calculateLines());
    if (gridCanvasRef.current) {
      ro.observe(gridCanvasRef.current);
    }
    window.addEventListener("resize", calculateLines);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      ro.disconnect();
      window.removeEventListener("resize", calculateLines);
    };
  }, [calculateLines]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400">
        <span className="w-2 h-2 rounded-full bg-orange-500" />
        <span>{badgeTitle}</span>
      </div>

      <div ref={gridCanvasRef} className="relative min-w-max pb-6 pt-2">
        {/* Columns Grid */}
        <div className="flex items-stretch gap-14 min-w-max px-2 relative z-10">
          {roundNumbers.map((roundNum, rIdx) => {
            const rMatches = roundsMap[roundNum] || [];
            const title = getLabel(roundNum);
            const isLastCol = rIdx === roundNumbers.length - 1;

            return (
              <div key={roundNum} className="flex flex-col w-[285px] shrink-0">
                {/* Round Header - Clean typography without container */}
                <div className="text-center mb-5 shrink-0">
                  <div className="flex items-center justify-center gap-2">
                    {isLastCol && <Trophy className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
                    <span className="text-xs font-black uppercase italic tracking-wider text-gray-200">
                      {title}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500">
                      ({rMatches.length})
                    </span>
                  </div>
                </div>

                {/* Matches in Round */}
                <div className="flex flex-col justify-around flex-grow gap-8 relative">
                  {rMatches.map((m) => (
                    <div
                      key={m.id}
                      data-match-id={m.id}
                      className="my-auto w-full py-1"
                    >
                      {renderMatchCard(m)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* SVG Overlay with Pixel-Perfect Center-to-Center Lines */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          style={{ width: "100%", height: "100%" }}
        >
          {lines.map((l, i) => (
            <path
              key={i}
              d={l.d}
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

export function TournamentBracket({
  tournament,
  matches,
  competitors,
  currentPlayer,
  userTeams,
  clubId = "",
  onSelectPlayer,
}: TournamentBracketProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [doubleElimTab, setDoubleElimTab] = useState<"all" | "upper" | "lower" | "grand_final">("all");
  const [onlyMyPath, setOnlyMyPath] = useState(false);

  // Zoom and Pan states
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number }>({
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  // Filter playoff matches (round >= 1)
  const playoffMatches = useMemo(() => matches.filter((m) => m.round >= 1), [matches]);

  const competitorMap = useMemo(() => {
    const map = new Map<string, Competitor>();
    competitors.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [competitors]);

  const isDoubleElim = useMemo(() => {
    return (
      tournament?.config?.bracketType === "double_elimination" ||
      playoffMatches.some((m) => m.round >= 100)
    );
  }, [tournament, playoffMatches]);

  const isUserInCompetitor = (compId: string | null) => {
    if (!compId || !currentPlayer) return false;
    const comp = competitorMap.get(String(compId));
    if (!comp) return false;

    if (comp.player_id && String(comp.player_id) === String(currentPlayer.id)) {
      return true;
    }

    if (comp.promo_team_id && userTeams.some((t) => String(t.id) === String(comp.promo_team_id))) {
      return true;
    }

    if (
      comp.team_members &&
      comp.team_members.some(
        (m) =>
          (m.id && String(m.id) === String(currentPlayer.id)) ||
          (m.phoneNumber &&
            (m.phoneNumber === currentPlayer.phoneNumber ||
              m.phoneNumber === currentPlayer.phone_number))
      )
    ) {
      return true;
    }

    return false;
  };

  const isUserMatch = (m: Match) => {
    return isUserInCompetitor(m.competitor_a_id) || isUserInCompetitor(m.competitor_b_id);
  };

  const userHasMatches = useMemo(() => {
    return playoffMatches.some((m) => isUserMatch(m));
  }, [playoffMatches, currentPlayer, userTeams]);

  // Group matches by category
  const { upperMatches, lowerMatches, grandFinalMatches } = useMemo(() => {
    const upper: Match[] = [];
    const lower: Match[] = [];
    const grand: Match[] = [];

    playoffMatches.forEach((m) => {
      const b = m.result?.bracket;
      if (m.round === 200 || b === "grand_final") {
        grand.push(m);
      } else if (m.round >= 100 || b === "lower") {
        lower.push(m);
      } else {
        upper.push(m);
      }
    });

    return { upperMatches: upper, lowerMatches: lower, grandFinalMatches: grand };
  }, [playoffMatches]);

  // Group round builder helper
  const buildRoundsMap = (matchesList: Match[]) => {
    const map: Record<number, Match[]> = {};
    matchesList.forEach((m) => {
      if (!map[m.round]) map[m.round] = [];
      map[m.round].push(m);
    });
    Object.keys(map).forEach((r) => {
      map[Number(r)].sort((a, b) => a.order_in_round - b.order_in_round);
    });
    return map;
  };

  const upperRoundsMap = useMemo(() => buildRoundsMap(upperMatches), [upperMatches]);
  const lowerRoundsMap = useMemo(() => buildRoundsMap(lowerMatches), [lowerMatches]);

  const upperRoundNumbers = useMemo(() => Object.keys(upperRoundsMap).map(Number).sort((a, b) => a - b), [upperRoundsMap]);
  const lowerRoundNumbers = useMemo(() => Object.keys(lowerRoundsMap).map(Number).sort((a, b) => a - b), [lowerRoundsMap]);

  const maxUpperRound = upperRoundNumbers.length > 0 ? Math.max(...upperRoundNumbers) : 1;
  const maxLowerRound = lowerRoundNumbers.length > 0 ? Math.max(...lowerRoundNumbers) : 101;

  const getUpperRoundLabel = (roundNum: number) => {
    if (isDoubleElim) {
      if (roundNum === maxUpperRound) return "Финал верхней сетки";
      if (roundNum === maxUpperRound - 1) return "1/2 финала (Верхняя)";
      if (roundNum === maxUpperRound - 2) return "1/4 финала (Верхняя)";
      return `Верхняя сетка • R${roundNum}`;
    }
    if (roundNum === maxUpperRound) return "Финал";
    if (roundNum === maxUpperRound - 1) return "Полуфинал";
    if (roundNum === maxUpperRound - 2) return "1/4 финала";
    if (roundNum === maxUpperRound - 3) return "1/8 финала";
    if (roundNum === maxUpperRound - 4) return "1/16 финала";
    return `Раунд ${roundNum}`;
  };

  const getLowerRoundLabel = (roundNum: number) => {
    if (roundNum === maxLowerRound) return "Финал нижней сетки";
    const lbIdx = roundNum - 100;
    return `Нижняя сетка • Раунд ${lbIdx}`;
  };

  // Drag-to-Pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input") || target.closest("select")) {
      return;
    }
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.pageX - scrollContainerRef.current.offsetLeft,
      startY: e.pageY - scrollContainerRef.current.offsetTop,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const y = e.pageY - scrollContainerRef.current.offsetTop;
    const walkX = (x - dragStartRef.current.startX) * 1.25;
    const walkY = (y - dragStartRef.current.startY) * 1.25;
    scrollContainerRef.current.scrollLeft = dragStartRef.current.scrollLeft - walkX;
    scrollContainerRef.current.scrollTop = dragStartRef.current.scrollTop - walkY;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(1.3, Number((z + 0.1).toFixed(1))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(1))));
  const handleResetZoom = () => {
    setZoom(1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: 0, top: 0, behavior: "smooth" });
    }
  };

  const handleFocusMyMatch = () => {
    if (!scrollContainerRef.current) return;
    const myMatchEl = scrollContainerRef.current.querySelector('[data-my-match="true"]');
    if (myMatchEl) {
      myMatchEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    } else {
      setOnlyMyPath(false);
    }
  };

  // Render a single Match Card
  const renderMatchCard = (match: Match) => {
    const compA = match.competitor_a_id ? competitorMap.get(String(match.competitor_a_id)) : null;
    const compB = match.competitor_b_id ? competitorMap.get(String(match.competitor_b_id)) : null;
    const isMyMatch = isUserMatch(match);
    const statusLower = (match.status || "").toLowerCase();
    const isLive = statusLower === "live" || statusLower === "veto";
    const isFinished = statusLower === "finished";

    const isWinnerA = match.winner_competitor_id && String(match.winner_competitor_id) === String(match.competitor_a_id);
    const isWinnerB = match.winner_competitor_id && String(match.winner_competitor_id) === String(match.competitor_b_id);

    const isByeA = !match.competitor_a_id && isFinished;
    const isByeB = !match.competitor_b_id && isFinished && match.competitor_a_id;
    const isBye = match.result?.isBye || (!match.competitor_b_id && isFinished && Boolean(match.competitor_a_id));

    const isFaded = onlyMyPath && !isMyMatch;
    const matchLobbyHref = `/promo/tournaments/match/${match.id}${clubId ? `?clubId=${clubId}` : ""}`;

    const matchNumber = match.result?.matchNumber ?? (playoffMatches.findIndex((m) => m.id === match.id) + 1);

    const formatScheduleTime = (dtStr?: string | Date | null) => {
      if (!dtStr) return "";
      const d = new Date(dtStr);
      const today = new Date();
      const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      const timeStr = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      if (isToday) return `Сегодня, ${timeStr}`;
      return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}, ${timeStr}`;
    };

    return (
      <div
        key={match.id}
        data-my-match={isMyMatch ? "true" : "false"}
        className={cn(
          "relative group transition-all duration-300 w-full select-none",
          isFaded && "opacity-25 hover:opacity-100"
        )}
      >
        <div
          className={cn(
            "relative rounded-2xl border transition-all duration-300 overflow-hidden bg-[#111114] shadow-xl",
            isMyMatch
              ? "border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.25)] ring-1 ring-orange-500/50"
              : isLive
              ? "border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.2)] ring-1 ring-red-500/40"
              : "border-white/10 hover:border-white/25 hover:bg-[#141418]"
          )}
        >
          {/* Match Card Top Header - Pure Typography */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2 text-[11px] font-black uppercase tracking-wider">
            <div className="flex items-center gap-1.5 truncate pr-1">
              <span className="text-gray-400 font-black">
                Матч {matchNumber}
              </span>
              {(match.result?.isThirdPlace || match.result?.stage === "bronze") && (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                  🥉 За 3 место
                </span>
              )}
            </div>

            {isLive ? (
              <span className="flex items-center gap-1.5 text-red-400 font-black tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                LIVE
              </span>
            ) : match.result?.isTechWin ? (
              <span className="text-amber-400 font-black tracking-wider">
                ТП (Победа)
              </span>
            ) : isBye ? (
              <span className="text-blue-400 font-black tracking-wider">
                Автопроход (BYE)
              </span>
            ) : isFinished ? (
              <span className="text-emerald-400 font-black tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Завершен
              </span>
            ) : match.scheduled_at ? (
              <span className="text-orange-400 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                {formatScheduleTime(match.scheduled_at)}
              </span>
            ) : (
              <span className="text-gray-500 font-bold tracking-wider">
                Ожидание
              </span>
            )}
          </div>

          {/* Competitors List - Spacious and comfortable proportions */}
          <div className="px-3.5 pb-3.5 space-y-2">
            {/* Competitor A */}
            <div
              className={cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors border text-[13px]",
                isWinnerA
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold"
                  : isUserInCompetitor(match.competitor_a_id)
                  ? "bg-orange-500/10 border-orange-500/30 text-orange-200 font-bold"
                  : "bg-white/[0.02] border-white/5 text-gray-200"
              )}
            >
              <div className="min-w-0 flex items-center gap-2 flex-1 pr-2">
                <span className="truncate block font-bold leading-tight text-[13px]">
                  {compA?.display_name || (isByeA ? "—" : "Ожидает пару...")}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isWinnerA && <Crown className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />}
                <span
                  className={cn(
                    "text-sm font-black px-2.5 py-1 rounded-lg min-w-[28px] text-center",
                    isWinnerA
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-black/50 text-gray-300"
                  )}
                >
                  {isBye ? "—" : (match.score1 ?? 0)}
                </span>
              </div>
            </div>

            {/* Competitor B */}
            <div
              className={cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors border text-[13px]",
                isWinnerB
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold"
                  : isUserInCompetitor(match.competitor_b_id)
                  ? "bg-orange-500/10 border-orange-500/30 text-orange-200 font-bold"
                  : "bg-white/[0.02] border-white/5 text-gray-200"
              )}
            >
              <div className="min-w-0 flex items-center gap-2 flex-1 pr-2">
                <span
                  className={cn(
                    "truncate block font-bold leading-tight text-[13px]",
                    (isBye || isByeB) ? "text-blue-400/80 italic text-xs" : "text-gray-200"
                  )}
                >
                  {isBye || isByeB ? "BYE (Автопроход)" : compB?.display_name || "Ожидает пару..."}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isWinnerB && <Crown className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />}
                <span
                  className={cn(
                    "text-sm font-black px-2.5 py-1 rounded-lg min-w-[28px] text-center",
                    isWinnerB
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-black/50 text-gray-300"
                  )}
                >
                  {isBye || isByeB ? "—" : (match.score2 ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Action footer */}
          {(isMyMatch || isLive || isFinished) && (
            <div className="px-3.5 pb-3.5 pt-0.5">
              <Link
                href={matchLobbyHref}
                className={cn(
                  "w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                  isMyMatch
                    ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                )}
              >
                {isMyMatch ? (
                  <>
                    <span>Войти в лобби матча</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Смотреть лобби</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  };

  // If no playoff matches exist yet
  if (playoffMatches.length === 0) {
    return (
      <div className="bg-[#0c0c0e]/80 border border-white/5 rounded-[2.5rem] p-12 text-center space-y-6 shadow-2xl">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.1)]">
          <Swords className="w-10 h-10" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-xl font-black uppercase italic tracking-tight text-white">
            Турнирная сетка формируется
          </h3>
          <p className="text-xs text-gray-400 font-medium leading-relaxed">
            Сетка плей-офф формируется автоматически при старте турнира.
            Зарегистрированные участники будут распределены по турнирным парам.
          </p>
        </div>
        <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-2.5 rounded-full text-xs font-bold text-gray-300">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Зарегистрировано участников: {competitors.length}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Toolbar: Format Badge and Legend */}
      <div className="flex items-center justify-between flex-wrap gap-4 px-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span>
              {isDoubleElim ? "Сетка Double Elimination (с нижней сеткой)" : "Олимпийская сетка (Single Elimination)"}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-gray-400 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-red-400">LIVE МАТЧ</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-orange-400">Ваш матч</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-400">Победитель</span>
          </div>
        </div>
      </div>

      {/* Double Elimination Sub-Tabs Switcher */}
      {isDoubleElim && (
        <div className="flex gap-2 p-1.5 bg-[#0c0c0e] border border-white/5 rounded-2xl w-full sm:w-fit overflow-x-auto">
          {[
            { id: "all", label: "Вся сетка" },
            { id: "upper", label: "Верхняя сетка (Winners)" },
            { id: "lower", label: "Нижняя сетка (Losers)" },
            { id: "grand_final", label: "Гранд-Финал" },
          ].map((tab) => {
            const active = doubleElimTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setDoubleElimTab(tab.id as any)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0",
                  active
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : "text-gray-400 hover:text-white"
                )}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Bracket Interactive Container with Pan & Zoom */}
      <div
        ref={containerRef}
        className="bg-[#0c0c0e]/95 border border-white/5 rounded-[2.5rem] p-4 sm:p-6 lg:p-8 shadow-2xl space-y-8 relative overflow-hidden group/bracket"
      >
        {/* Floating Pan & Zoom Controls */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex items-center gap-1.5 bg-[#141418]/90 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl shadow-2xl">
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            title="Уменьшить масштаб"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetZoom}
            className="px-2.5 py-1 text-[10px] font-black text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all font-mono"
            title="Сбросить масштаб (100%)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            title="Увеличить масштаб"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {currentPlayer && userHasMatches && (
            <button
              onClick={() => setOnlyMyPath(!onlyMyPath)}
              className={cn(
                "ml-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                onlyMyPath
                  ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                  : "bg-white/5 text-gray-300 border-white/10 hover:text-white hover:bg-white/10"
              )}
              title="Показать только мой путь в сетке"
            >
              <span>Мой путь</span>
            </button>
          )}

          {userHasMatches && (
            <button
              onClick={handleFocusMyMatch}
              className="ml-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-orange-500/20"
              title="Перейти к моему матчу"
            >
              <span>Мой матч</span>
            </button>
          )}
        </div>

        {/* Scroll & Pan Viewport Container */}
        <div
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={cn(
            "overflow-x-auto overflow-y-auto custom-scrollbar pb-6 pt-2 select-none",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{
            touchAction: "pan-x pan-y",
          }}
        >
          {/* Zoom Canvas Wrapper */}
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: zoom < 1 ? `${100 / zoom}%` : "fit-content",
              minWidth: "100%",
            }}
            className="transition-transform duration-150 ease-out space-y-10"
          >
            {/* 1. UPPER BRACKET (Single Elimination or Double Elimination Upper) */}
            {(!isDoubleElim || doubleElimTab === "all" || doubleElimTab === "upper") && (
              <BracketGrid
                roundNumbers={upperRoundNumbers}
                roundsMap={upperRoundsMap}
                getLabel={getUpperRoundLabel}
                badgeTitle={isDoubleElim ? "Верхняя сетка (Winners Bracket)" : "Основная турнирная сетка"}
                renderMatchCard={renderMatchCard}
                zoom={zoom}
              />
            )}

            {/* 2. LOWER BRACKET (Double Elimination) */}
            {isDoubleElim && lowerRoundNumbers.length > 0 && (doubleElimTab === "all" || doubleElimTab === "lower") && (
              <div className="pt-8 border-t border-white/5">
                <BracketGrid
                  roundNumbers={lowerRoundNumbers}
                  roundsMap={lowerRoundsMap}
                  getLabel={getLowerRoundLabel}
                  badgeTitle="Нижняя сетка (Losers Bracket)"
                  renderMatchCard={renderMatchCard}
                  zoom={zoom}
                />
              </div>
            )}

            {/* 3. GRAND FINAL (Double Elimination) */}
            {isDoubleElim && grandFinalMatches.length > 0 && (doubleElimTab === "all" || doubleElimTab === "grand_final") && (
              <div className="pt-8 border-t border-white/5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-yellow-500">
                  <Trophy className="w-4 h-4" />
                  <span>Гранд-Финал (Grand Final)</span>
                </div>
                <div className="max-w-[300px]">
                  {grandFinalMatches.map((m) => renderMatchCard(m))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
