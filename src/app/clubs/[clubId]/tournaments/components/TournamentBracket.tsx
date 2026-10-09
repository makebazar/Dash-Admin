"use client";
import React from "react";
import {
  Clock,
  Play,
  RefreshCw,
  Zap,
  Loader2,
  Trophy,
  AlertCircle,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Match, Competitor, Tournament, DashMatchAgentInfo, ActiveCs2MatchInfo } from "../types";

interface TournamentBracketProps {
  tournament?: Tournament;
  matches: Match[];
  competitors: Competitor[];
  onOpenMatchModal: (match: Match) => void;
  onStartTournament?: () => void;
  onOpenRebuildModal?: () => void;
  onSimulateMatches?: () => void;
  isSimulatingMatches?: boolean;
  dashmatchAgent?: DashMatchAgentInfo | null;
  activeCs2Matches?: ActiveCs2MatchInfo[];
}

export function TournamentBracket({
  tournament,
  matches,
  competitors,
  onOpenMatchModal,
  onStartTournament,
  onOpenRebuildModal,
  onSimulateMatches,
  isSimulatingMatches = false,
  dashmatchAgent,
  activeCs2Matches = [],
}: TournamentBracketProps) {
  const groupStageMatches = matches.filter((m) => m.round === 0);
  const groupsMap: Record<string, Match[]> = {};
  groupStageMatches.forEach((m) => {
    const groupLabel = m.result?.group || "A";
    if (!groupsMap[groupLabel]) groupsMap[groupLabel] = [];
    groupsMap[groupLabel].push(m);
  });

  const playoffMatches = matches.filter((m) => m.round >= 1);
  const roundsMap: Record<number, Match[]> = {};
  playoffMatches.forEach((m) => {
    if (!roundsMap[m.round]) roundsMap[m.round] = [];
    roundsMap[m.round].push(m);
  });
  const sortedRounds = Object.keys(roundsMap)
    .map(Number)
    .sort((a, b) => a - b);

  const mainComps = competitors.filter((c) => c.payment_status !== "RESERVE");
  const paidComps = mainComps.filter((c) => c.payment_status === "PAID");
  const isDraftOrReg =
    tournament?.status === "REGISTRATION" || tournament?.status === "DRAFT";

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Pre-tournament Launch Box (when not started yet) */}
      {isDraftOrReg && matches.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
            <Trophy className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900">
              Сетка ожидает старта турнира
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Сетка формируется автоматически при запуске турнира. Участники распределяются согласно посеву по ELO рейтингу.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-600 pt-2">
            <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Зарегистрировано: {mainComps.length}</span>
            </span>
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200">
              <span>Оплачено: {paidComps.length}</span>
            </span>
          </div>

          {onStartTournament && (
            <div className="pt-3">
              <button
                onClick={onStartTournament}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/15 inline-flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <Play className="w-4 h-4" />
                <span>Запустить Турнир и сгенерировать сетку</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Top Active Actions Toolbar */}
      {matches.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[2rem] p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900">
              Всего матчей: {matches.length}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-bold">
              Сыграно: {matches.filter((m) => m.status?.toLowerCase() === "finished").length}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-400">
              Кликните по матчу для внесения счёта
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onSimulateMatches && tournament?.status === "ACTIVE" && (
              <button
                type="button"
                disabled={isSimulatingMatches}
                onClick={onSimulateMatches}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {isSimulatingMatches ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Симуляция...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Автоплей раунда</span>
                  </>
                )}
              </button>
            )}

            {onOpenRebuildModal && (
              <button
                type="button"
                onClick={onOpenRebuildModal}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-orange-500" />
                <span>Пересобрать сетку</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Group Stage matches */}
      {Object.keys(groupsMap).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black uppercase italic tracking-tight text-slate-900">
              Групповой этап (Round Robin)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.keys(groupsMap)
              .sort()
              .map((groupLabel) => {
                const groupMatches = groupsMap[groupLabel];
                return (
                  <div
                    key={groupLabel}
                    className="bg-white border border-slate-200 p-5 rounded-3xl space-y-4 shadow-xs"
                  >
                    <div className="font-black uppercase text-xs text-orange-500 tracking-wider">
                      Группа {groupLabel}
                    </div>
                    <div className="space-y-3">
                      {groupMatches.map((m) => {
                        const compA = competitors.find(
                          (c) => c.id === m.competitor_a_id
                        );
                        const compB = competitors.find(
                          (c) => c.id === m.competitor_b_id
                        );
                        const isServerRunning = activeCs2Matches?.some(
                          (cm) => cm.id === `dm-tourney-${m.id}` || cm.id === m.cs2_server_id
                        );

                        return (
                          <div
                            key={m.id}
                            onClick={() => onOpenMatchModal(m)}
                            className="flex flex-col gap-2 bg-white border border-slate-200 p-3.5 rounded-2xl text-xs cursor-pointer hover:border-orange-400 transition-all shadow-xs"
                          >
                            <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-slate-400">
                              <div className="flex items-center gap-1.5">
                                <span>
                                  {m.result?.matchNumber
                                    ? `Матч ${m.result.matchNumber}`
                                    : `Матч #${m.id}`}
                                </span>
                                {isServerRunning && (
                                  <span className="bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                                    ● CS2 Сервер
                                  </span>
                                )}
                              </div>
                              {m.scheduled_at && (
                                <span className="text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[8px] flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(m.scheduled_at).toLocaleTimeString(
                                    "ru-RU",
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 font-bold text-slate-700">
                              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <span className="truncate pr-1">
                                  {compA?.display_name || "Ожидает..."}
                                </span>
                                <span className="font-black text-orange-500 font-mono">
                                  {m.score1}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <span className="truncate pr-1">
                                  {compB?.display_name || "Ожидает..."}
                                </span>
                                <span className="font-black text-orange-500 font-mono">
                                  {m.score2}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 4. Playoff Bracket Columns */}
      {sortedRounds.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 space-y-6 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-base font-black uppercase italic tracking-tight text-slate-900">
              Турнирная сетка плей-офф
            </h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {tournament?.config?.bracketType === "double_elimination"
                ? "Double Elimination"
                : "Single Elimination"}
            </span>
          </div>

          <div className="overflow-x-auto py-2 flex gap-6 select-none custom-scrollbar">
            {sortedRounds.map((roundNum) => {
              const roundMatches = roundsMap[roundNum];
              const isDoubleElim = playoffMatches.some((m) => m.round >= 100);
              const wbRounds = sortedRounds.filter((r) => r < 100);
              const lbRounds = sortedRounds.filter((r) => r >= 101 && r < 200);
              const maxWb = wbRounds.length > 0 ? Math.max(...wbRounds) : 1;
              const maxLb = lbRounds.length > 0 ? Math.max(...lbRounds) : 101;

              let roundTitle = `Раунд ${roundNum}`;
              if (!isDoubleElim) {
                const maxR = Math.max(...sortedRounds);
                if (roundNum === maxR) roundTitle = "🏆 Финал";
                else if (roundNum === maxR - 1) roundTitle = "Полуфинал";
                else if (roundNum === maxR - 2) roundTitle = "1/4 финала";
                else if (roundNum === maxR - 3) roundTitle = "1/8 финала";
              } else {
                if (roundNum === 200) {
                  roundTitle = "🏆 Гранд-Финал";
                } else if (roundNum < 100) {
                  if (roundNum === maxWb) roundTitle = "Верхняя • Финал";
                  else if (roundNum === maxWb - 1)
                    roundTitle = "Верхняя • 1/2 финала";
                  else if (roundNum === maxWb - 2)
                    roundTitle = "Верхняя • 1/4 финала";
                  else roundTitle = `Верхняя • R${roundNum}`;
                } else {
                  if (roundNum === maxLb) roundTitle = "Нижняя • Финал";
                  else roundTitle = `Нижняя • R${roundNum - 100}`;
                }
              }

              return (
                <div
                  key={roundNum}
                  className="flex flex-col gap-4 min-w-[280px] w-[300px] shrink-0"
                >
                  <div className="text-center font-black uppercase text-xs tracking-wider text-slate-700 bg-slate-100 border border-slate-200 py-2.5 rounded-2xl shadow-xs">
                    {roundTitle}
                  </div>
                  <div className="flex flex-col justify-around flex-grow gap-4">
                    {roundMatches.map((m) => {
                      const compA = competitors.find(
                        (c) => c.id === m.competitor_a_id
                      );
                      const compB = competitors.find(
                        (c) => c.id === m.competitor_b_id
                      );
                      const statusLower = m.status?.toLowerCase();
                      const isBye =
                        m.result?.isBye ||
                        (!m.competitor_b_id &&
                          Boolean(m.competitor_a_id) &&
                          statusLower === "finished");

                      const isServerRunning = activeCs2Matches?.some(
                        (cm) => cm.id === `dm-tourney-${m.id}` || cm.id === m.cs2_server_id
                      );

                      return (
                        <div
                          key={m.id}
                          onClick={() => onOpenMatchModal(m)}
                          className={cn(
                            "bg-white border p-4 rounded-3xl space-y-3 shadow-xs relative transition-all cursor-pointer hover:border-orange-400 hover:shadow-md",
                            statusLower === "finished"
                              ? "border-slate-200 bg-slate-50/50"
                              : statusLower === "live" || isServerRunning
                              ? "border-red-400 ring-2 ring-red-400/20 shadow-md shadow-red-500/10"
                              : "border-slate-200"
                          )}
                        >
                          <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-slate-400">
                            <div className="flex items-center gap-1.5 truncate pr-1">
                              <span>
                                {m.result?.matchNumber
                                  ? `Матч ${m.result.matchNumber}`
                                  : `Матч #${m.id}`}
                              </span>
                              {isServerRunning && (
                                <span className="bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                                  ● CS2
                                </span>
                              )}
                              {m.scheduled_at && (
                                <span className="text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[8px] flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(m.scheduled_at).toLocaleTimeString(
                                    "ru-RU",
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "font-mono",
                                statusLower === "finished"
                                  ? isBye
                                    ? "text-blue-500 font-bold"
                                    : "text-slate-400 font-bold"
                                  : statusLower === "live"
                                  ? "text-red-500 font-black animate-pulse"
                                  : "text-blue-500 font-bold"
                              )}
                            >
                              {m.result?.isTechWin
                                ? "ТП"
                                : isBye
                                ? "Автопроход (BYE)"
                                : statusLower === "scheduled"
                                ? "ожидание"
                                : statusLower === "live"
                                ? "● LIVE"
                                : statusLower}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div
                              className={cn(
                                "flex justify-between items-center p-2.5 rounded-2xl text-xs font-bold transition-colors",
                                m.winner_competitor_id &&
                                  m.winner_competitor_id === m.competitor_a_id
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-black"
                                  : "bg-slate-50 text-slate-700 border border-slate-100"
                              )}
                            >
                              <span className="truncate flex-1 pr-2">
                                {compA?.display_name || "Ожидает пару..."}
                              </span>
                              <span className="font-black text-sm font-mono">
                                {isBye ? "—" : m.score1}
                              </span>
                            </div>

                            <div
                              className={cn(
                                "flex justify-between items-center p-2.5 rounded-2xl text-xs font-bold transition-colors",
                                m.winner_competitor_id &&
                                  m.winner_competitor_id === m.competitor_b_id
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-black"
                                  : "bg-slate-50 text-slate-700 border border-slate-100"
                              )}
                            >
                              <span
                                className={cn(
                                  "truncate flex-1 pr-2",
                                  isBye && "text-blue-500 italic text-[11px]"
                                )}
                              >
                                {isBye
                                  ? "Автопроход (BYE)"
                                  : compB?.display_name || "Ожидает пару..."}
                              </span>
                              <span className="font-black text-sm font-mono">
                                {isBye ? "—" : m.score2}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
