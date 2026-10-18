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
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Match, Competitor, Tournament, DashMatchAgentInfo, ActiveCs2MatchInfo } from "../types";
import { formatDotaGameMode } from "@/lib/dota/utils";

function getMatchFormat(
  match: Match,
  maxRound?: number,
  tournament?: Tournament
): "BO1" | "BO3" | "BO5" {
  const cfg = tournament?.config || {};
  const normalize = (val?: string): "BO1" | "BO3" | "BO5" | null => {
    if (!val) return null;
    const upper = String(val).toUpperCase().trim();
    if (upper === "BO3" || upper === "BO5" || upper === "BO1") return upper as any;
    return null;
  };

  if (match.result?.format && normalize(match.result.format)) return normalize(match.result.format)!;
  if (match.result?.matchFormat && normalize(match.result.matchFormat)) return normalize(match.result.matchFormat)!;
  if (match.result?.series_format && normalize(match.result.series_format)) return normalize(match.result.series_format)!;

  const baseFormat = normalize(cfg.matchFormat) || normalize(cfg.match_format) || normalize(cfg.format) || "BO1";
  const semiFormat = normalize(cfg.semiFinalFormat) || normalize(cfg.semi_final_format) || normalize(cfg.semiFinal) || baseFormat;
  const grandFormat = normalize(cfg.grandFinalFormat) || normalize(cfg.grand_final_format) || normalize(cfg.grandFinal) || baseFormat;

  const stage = match.result?.stage;
  if ((stage === "final" || stage === "grand_final" || match.round === 200) && !match.result?.isThirdPlace) {
    return grandFormat;
  }
  if (stage === "semifinal" || stage === "wb_final" || stage === "lb_final" || stage === "bronze" || match.result?.isThirdPlace) {
    return semiFormat;
  }

  if (maxRound && maxRound > 0) {
    if (match.round === maxRound && !match.result?.isThirdPlace) return grandFormat;
    if (match.round === maxRound && match.result?.isThirdPlace) return semiFormat;
    if (match.round === maxRound - 1 && maxRound >= 2) return semiFormat;
  }

  return baseFormat;
}

function getMatchStatusDisplay(status?: string, result?: any, isBye?: boolean) {
  if (result?.isTechWin) {
    return {
      text: "Тех. победа (ТП)",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200/80 font-bold",
    };
  }
  if (isBye) {
    return {
      text: "Автопроход (BYE)",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200/80 font-bold",
    };
  }

  const s = (status || "").toLowerCase().trim();
  switch (s) {
    case "finished":
    case "completed":
      return {
        text: "Завершен",
        badgeClass: "bg-slate-100 text-slate-600 border-slate-200/80 font-semibold",
      };
    case "live":
    case "in_progress":
      return {
        text: "● LIVE",
        badgeClass: "bg-red-50 text-red-600 border-red-200 font-black animate-pulse",
      };
    case "starting":
      return {
        text: "Запуск...",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200 font-bold animate-pulse",
      };
    case "waiting_server":
    case "waiting_bot":
      return {
        text: "В очереди",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200 font-bold",
      };
    case "ready":
      return {
        text: "Готов",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200 font-bold",
      };
    case "scheduled":
    case "pending":
    case "draft":
    case "waiting":
    default:
      return {
        text: "Ожидание",
        badgeClass: "bg-slate-100/90 text-slate-500 border-slate-200/60 font-medium",
      };
  }
}

interface TournamentBracketProps {
  tournament?: Tournament;
  matches: Match[];
  competitors: Competitor[];
  clubId?: string;
  onOpenMatchModal?: (match: Match) => void;
  onStartTournament?: () => void;
  onPublishTournament?: () => void;
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
  clubId,
  onOpenMatchModal,
  onStartTournament,
  onPublishTournament,
  onOpenRebuildModal,
  onSimulateMatches,
  isSimulatingMatches = false,
  dashmatchAgent,
  activeCs2Matches = [],
}: TournamentBracketProps) {
  const router = useRouter();

  const handleMatchClick = (m: Match) => {
    const cId = clubId || tournament?.club_id;
    if (cId) {
      router.push(`/clubs/${cId}/tournaments/matches/${m.id}?tournamentId=${tournament?.id || ""}`);
    } else if (onOpenMatchModal) {
      onOpenMatchModal(m);
    }
  };
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
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            {tournament?.status === "DRAFT" ? (
              <Sparkles className="w-6 h-6 text-amber-500" />
            ) : (
              <Trophy className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">
              {tournament?.status === "DRAFT"
                ? "Турнир в статусе черновика"
                : "Регистрация участников открыта"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {tournament?.status === "DRAFT"
                ? "Черновик не виден игрокам в промо-панели и сетка еще не сформирована. Нажмите «Открыть регистрацию», чтобы игроки могли подавать заявки."
                : "Игроки регистрируются через промо-панель. Сетка сформируется автоматически при запуске турнира согласно посеву по ELO рейтингу."}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 text-xs font-medium text-slate-600 pt-2 flex-wrap">
            <span className="flex items-center gap-1.5 bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>Зарегистрировано: {mainComps.length}</span>
            </span>
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200">
              <span>Оплачено: {paidComps.length}</span>
            </span>
          </div>

          <div className="pt-3">
            {tournament?.status === "DRAFT" && onPublishTournament && (
              <Button
                onClick={onPublishTournament}
                className="h-11 rounded-xl px-7 bg-black hover:bg-slate-800 text-white font-medium text-xs sm:text-sm transition-all shadow-sm inline-flex items-center justify-center cursor-pointer"
              >
                <span>Открыть регистрацию для игроков</span>
              </Button>
            )}

            {tournament?.status === "REGISTRATION" && onStartTournament && (
              <Button
                onClick={onStartTournament}
                className="h-11 rounded-xl px-7 bg-black hover:bg-slate-800 text-white font-medium text-xs sm:text-sm transition-all shadow-sm inline-flex items-center justify-center cursor-pointer"
              >
                <span>Запустить турнир и сгенерировать сетку</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 2. Top Active Actions Toolbar */}
      {matches.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-900">
              Всего матчей: {matches.length}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-600 font-medium">
              Сыграно: {matches.filter((m) => m.status?.toLowerCase() === "finished").length}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-400">
              Кликните по матчу для внесения счёта
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onSimulateMatches && tournament?.status === "ACTIVE" && (
              <Button
                type="button"
                variant="outline"
                disabled={isSimulatingMatches}
                onClick={onSimulateMatches}
                className="h-9 px-3.5 rounded-xl text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5"
                title="Автоматически завершить случайные матчи текущего раунда со счетом 13:x (для быстрого теста)"
              >
                {isSimulatingMatches ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                    <span>Симуляция...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Автоплей раунда</span>
                  </>
                )}
              </Button>
            )}

            {onOpenRebuildModal && (
              <Button
                variant="outline"
                onClick={onOpenRebuildModal}
                className="h-9 px-3.5 rounded-xl text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Пересобрать сетку</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 3. Group Stage matches */}
      {Object.keys(groupsMap).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-semibold text-slate-900">
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
                        const statusLower = m.status?.toLowerCase();
                        const isFinished = statusLower === "finished" || statusLower === "completed";
                        const isBye =
                          m.result?.isBye ||
                          (!m.competitor_b_id &&
                            Boolean(m.competitor_a_id) &&
                            isFinished);

                        const runningCs2Match = activeCs2Matches?.find(
                          (cm) => cm.id === `dm-tourney-${m.id}` || cm.id === m.cs2_server_id
                        );
                        const isServerRunning = Boolean(runningCs2Match);

                        const runningDotaBot = dashmatchAgent?.dota_bots?.find(
                          (b) =>
                            b.active_match === String(m.id) ||
                            b.active_match === `dm-tourney-${m.id}` ||
                            b.active_match === `dm-${tournament?.id}-${m.id}`
                        );

                        const isDota = tournament?.discipline?.toLowerCase().includes("dota");
                        const isCs2 = tournament?.discipline?.toLowerCase().includes("cs");
                        const matchFormat = getMatchFormat(m, 0, tournament);
                        const statusInfo = getMatchStatusDisplay(m.status, m.result, isBye);

                        const isWinnerA =
                          Boolean(m.winner_competitor_id && m.winner_competitor_id === m.competitor_a_id) ||
                          (isFinished && m.score1 > m.score2);
                        const isWinnerB =
                          Boolean(m.winner_competitor_id && m.winner_competitor_id === m.competitor_b_id) ||
                          (isFinished && m.score2 > m.score1);

                        let disciplineContext = "";
                        if (isDota) {
                          disciplineContext = formatDotaGameMode(
                            m.result?.gameMode,
                            tournament?.type,
                            tournament?.config
                          );
                        } else if (isCs2) {
                          const mapName = m.result?.map || runningCs2Match?.map_name;
                          if (mapName) {
                            disciplineContext = `Карта: ${mapName.replace(/^de_/, "")}`;
                          }
                        }

                        return (
                          <div
                            key={m.id}
                            onClick={() => handleMatchClick(m)}
                            className={cn(
                              "bg-white border p-3.5 rounded-2xl space-y-2.5 shadow-xs relative transition-all cursor-pointer hover:border-orange-400 hover:shadow-md",
                              isFinished
                                ? "border-slate-200 bg-slate-50/40"
                                : statusLower === "live" || isServerRunning
                                ? "border-red-400 ring-2 ring-red-400/20 shadow-md shadow-red-500/10"
                                : "border-slate-200"
                            )}
                          >
                            <div className="flex justify-between items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-bold text-slate-700">
                                  {m.result?.matchNumber
                                    ? `Матч ${m.result.matchNumber}`
                                    : `Матч #${m.id}`}
                                </span>
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border",
                                    matchFormat === "BO3"
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : matchFormat === "BO5"
                                      ? "bg-amber-50 text-amber-700 border-amber-300"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                  )}
                                >
                                  {matchFormat}
                                </span>
                                {runningCs2Match && (
                                  <span className="bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                                    ● CS2 :{runningCs2Match.port}
                                  </span>
                                )}
                                {runningDotaBot && (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                                    ● Бот {runningDotaBot.bot_name || runningDotaBot.account_name || runningDotaBot.bot_id}
                                  </span>
                                )}
                              </div>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0",
                                  statusInfo.badgeClass
                                )}
                              >
                                {statusInfo.text}
                              </span>
                            </div>

                            {(disciplineContext || m.scheduled_at || m.result?.duration) && (
                              <div className="flex items-center justify-between gap-1 text-[8px] text-slate-400 font-medium px-0.5">
                                <span className="truncate text-slate-500 font-medium">
                                  {disciplineContext}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {m.result?.duration ? (
                                    <span className="text-slate-500 font-medium flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                                      {m.result.duration} мин
                                    </span>
                                  ) : m.scheduled_at ? (
                                    <span className="text-slate-500 font-medium flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                                      {new Date(m.scheduled_at).toLocaleTimeString("ru-RU", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <div
                                className={cn(
                                  "flex justify-between items-center p-2 rounded-xl text-xs transition-colors",
                                  isWinnerA
                                    ? "bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold shadow-xs"
                                    : isFinished
                                    ? "bg-slate-50/60 text-slate-400 border border-slate-100"
                                    : "bg-slate-50 text-slate-700 border border-slate-100 font-medium"
                                )}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                                  {isDota && (
                                    <span className="text-[8px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/70 border border-emerald-300/60 px-1 py-0.5 rounded shrink-0">
                                      RAD
                                    </span>
                                  )}
                                  <span className="truncate">
                                    {compA?.display_name || "Ожидает..."}
                                  </span>
                                  {compA?.player_elo && !isFinished && (
                                    <span className="text-[9px] font-mono text-slate-400 shrink-0">
                                      {compA.player_elo}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={cn(
                                    "font-mono font-black text-xs px-2 py-0.5 rounded-lg shrink-0",
                                    isWinnerA
                                      ? "bg-emerald-500 text-white shadow-xs"
                                      : "text-slate-700 bg-slate-100"
                                  )}
                                >
                                  {m.score1}
                                </span>
                              </div>

                              <div
                                className={cn(
                                  "flex justify-between items-center p-2 rounded-xl text-xs transition-colors",
                                  isWinnerB
                                    ? "bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold shadow-xs"
                                    : isFinished
                                    ? "bg-slate-50/60 text-slate-400 border border-slate-100"
                                    : "bg-slate-50 text-slate-700 border border-slate-100 font-medium"
                                )}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                                  {isDota && (
                                    <span className="text-[8px] font-black uppercase tracking-wider text-rose-700 bg-rose-100/70 border border-rose-300/60 px-1 py-0.5 rounded shrink-0">
                                      DIRE
                                    </span>
                                  )}
                                  <span className="truncate">
                                    {compB?.display_name || "Ожидает..."}
                                  </span>
                                  {compB?.player_elo && !isFinished && (
                                    <span className="text-[9px] font-mono text-slate-400 shrink-0">
                                      {compB.player_elo}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={cn(
                                    "font-mono font-black text-xs px-2 py-0.5 rounded-lg shrink-0",
                                    isWinnerB
                                      ? "bg-emerald-500 text-white shadow-xs"
                                      : "text-slate-700 bg-slate-100"
                                  )}
                                >
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
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Турнирная сетка плей-офф
            </h3>
            <span className="text-xs font-medium text-slate-500">
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
                      const isFinished = statusLower === "finished" || statusLower === "completed";
                      const isBye =
                        m.result?.isBye ||
                        (!m.competitor_b_id &&
                          Boolean(m.competitor_a_id) &&
                          isFinished);

                      const runningCs2Match = activeCs2Matches?.find(
                        (cm) => cm.id === `dm-tourney-${m.id}` || cm.id === m.cs2_server_id
                      );
                      const isServerRunning = Boolean(runningCs2Match);

                      const runningDotaBot = dashmatchAgent?.dota_bots?.find(
                        (b) =>
                          b.active_match === String(m.id) ||
                          b.active_match === `dm-tourney-${m.id}` ||
                          b.active_match === `dm-${tournament?.id}-${m.id}`
                      );

                      const isDota = tournament?.discipline?.toLowerCase().includes("dota");
                      const isCs2 = tournament?.discipline?.toLowerCase().includes("cs");
                      const maxPlayoffRound = sortedRounds.length > 0 ? Math.max(...sortedRounds) : 1;
                      const matchFormat = getMatchFormat(m, maxPlayoffRound, tournament);
                      const statusInfo = getMatchStatusDisplay(m.status, m.result, isBye);

                      const isWinnerA =
                        Boolean(m.winner_competitor_id && m.winner_competitor_id === m.competitor_a_id) ||
                        (isFinished && m.score1 > m.score2);
                      const isWinnerB =
                        Boolean(m.winner_competitor_id && m.winner_competitor_id === m.competitor_b_id) ||
                        (isFinished && m.score2 > m.score1);

                      let disciplineContext = "";
                      if (isDota) {
                        disciplineContext = formatDotaGameMode(
                          m.result?.gameMode,
                          tournament?.type,
                          tournament?.config
                        );
                      } else if (isCs2) {
                        const mapName = m.result?.map || runningCs2Match?.map_name;
                        if (mapName) {
                          disciplineContext = `Карта: ${mapName.replace(/^de_/, "")}`;
                        }
                      }

                      return (
                        <div
                          key={m.id}
                          onClick={() => handleMatchClick(m)}
                          className={cn(
                            "bg-white border p-3.5 rounded-3xl space-y-2.5 shadow-xs relative transition-all cursor-pointer hover:border-orange-400 hover:shadow-md",
                            isFinished
                              ? "border-slate-200 bg-slate-50/40"
                              : statusLower === "live" || isServerRunning
                              ? "border-red-400 ring-2 ring-red-400/20 shadow-md shadow-red-500/10"
                              : "border-slate-200"
                          )}
                        >
                          <div className="flex justify-between items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                            <div className="flex items-center gap-1.5 truncate pr-1">
                              <span className="font-bold text-slate-700">
                                {m.result?.matchNumber
                                  ? `Матч ${m.result.matchNumber}`
                                  : `Матч #${m.id}`}
                              </span>
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border",
                                  matchFormat === "BO3"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : matchFormat === "BO5"
                                    ? "bg-amber-50 text-amber-700 border-amber-300"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                )}
                              >
                                {matchFormat}
                              </span>
                              {(m.result?.isThirdPlace || m.result?.stage === "bronze") && (
                                <span className="bg-amber-500/10 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                                  🥉 3-е место
                                </span>
                              )}
                              {runningCs2Match && (
                                <span className="bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                                  ● CS2 :{runningCs2Match.port}
                                </span>
                              )}
                              {runningDotaBot && (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                                  ● Бот {runningDotaBot.bot_name || runningDotaBot.account_name || runningDotaBot.bot_id}
                                </span>
                              )}
                            </div>

                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0",
                                statusInfo.badgeClass
                              )}
                            >
                              {statusInfo.text}
                            </span>
                          </div>

                          {(disciplineContext || m.scheduled_at || m.result?.duration) && (
                            <div className="flex items-center justify-between gap-1 text-[8px] text-slate-400 font-medium px-0.5">
                              <span className="truncate text-slate-500 font-medium">
                                {disciplineContext}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {m.result?.duration ? (
                                  <span className="text-slate-500 font-medium flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                                    {m.result.duration} мин
                                  </span>
                                ) : m.scheduled_at ? (
                                  <span className="text-slate-500 font-medium flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                                    {new Date(m.scheduled_at).toLocaleTimeString("ru-RU", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <div
                              className={cn(
                                "flex justify-between items-center p-2 rounded-2xl text-xs transition-colors",
                                isWinnerA
                                  ? "bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold shadow-xs"
                                  : isFinished
                                  ? "bg-slate-50/60 text-slate-400 border border-slate-100"
                                  : "bg-slate-50 text-slate-700 border border-slate-100 font-medium"
                              )}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                                {isDota && (
                                  <span className="text-[8px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/70 border border-emerald-300/60 px-1 py-0.5 rounded shrink-0">
                                    RAD
                                  </span>
                                )}
                                <span className="truncate">
                                  {compA?.display_name || "Ожидает пару..."}
                                </span>
                                {compA?.player_elo && !isFinished && (
                                  <span className="text-[9px] font-mono text-slate-400 shrink-0">
                                    {compA.player_elo}
                                  </span>
                                )}
                              </div>
                              <span
                                className={cn(
                                  "font-mono font-black text-xs px-2 py-0.5 rounded-lg shrink-0",
                                  isWinnerA
                                    ? "bg-emerald-500 text-white shadow-xs"
                                    : "text-slate-700 bg-slate-100"
                                )}
                              >
                                {isBye ? "—" : m.score1}
                              </span>
                            </div>

                            <div
                              className={cn(
                                "flex justify-between items-center p-2 rounded-2xl text-xs transition-colors",
                                isWinnerB
                                  ? "bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold shadow-xs"
                                  : isFinished
                                  ? "bg-slate-50/60 text-slate-400 border border-slate-100"
                                  : "bg-slate-50 text-slate-700 border border-slate-100 font-medium"
                              )}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                                {isDota && (
                                  <span className="text-[8px] font-black uppercase tracking-wider text-rose-700 bg-rose-100/70 border border-rose-300/60 px-1 py-0.5 rounded shrink-0">
                                    DIRE
                                  </span>
                                )}
                                <span
                                  className={cn(
                                    "truncate",
                                    isBye && "text-blue-500 italic text-[11px]"
                                  )}
                                >
                                  {isBye
                                    ? "Автопроход (BYE)"
                                    : compB?.display_name || "Ожидает пару..."}
                                </span>
                                {compB?.player_elo && !isFinished && !isBye && (
                                  <span className="text-[9px] font-mono text-slate-400 shrink-0">
                                    {compB.player_elo}
                                  </span>
                                )}
                              </div>
                              <span
                                className={cn(
                                  "font-mono font-black text-xs px-2 py-0.5 rounded-lg shrink-0",
                                  isWinnerB
                                    ? "bg-emerald-500 text-white shadow-xs"
                                    : "text-slate-700 bg-slate-100"
                                )}
                              >
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
