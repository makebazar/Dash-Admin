"use client";

import React from "react";
import Link from "next/link";
import { Table, ExternalLink, Shield, Swords, ChevronRight, CheckCircle2, Clock } from "lucide-react";
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
  team_members?: Array<{
    id: string;
    fullName: string;
    phoneNumber?: string;
    role?: string;
    elo?: number;
  }>;
}

interface TournamentGroupStageProps {
  tournament: any;
  matches: Match[];
  competitors: Competitor[];
  currentPlayer: any;
  userTeams: any[];
  clubId?: string;
}

interface StandingRow {
  competitorId: string;
  name: string;
  logo?: string | null;
  played: number;
  won: number;
  lost: number;
  roundsWon: number;
  roundsLost: number;
  roundDiff: number;
  points: number;
  isCurrentUser: boolean;
}

export function TournamentGroupStage({
  tournament,
  matches,
  competitors,
  currentPlayer,
  userTeams,
  clubId = "",
}: TournamentGroupStageProps) {
  const groupMatches = matches.filter((m) => m.round === 0);

  const competitorMap = React.useMemo(() => {
    const map = new Map<string, Competitor>();
    competitors.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [competitors]);

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

  // Group matches by group label (A, B, C, D)
  const groupsMap = React.useMemo(() => {
    const map: Record<string, Match[]> = {};
    groupMatches.forEach((m) => {
      const g = m.result?.group || "A";
      if (!map[g]) map[g] = [];
      map[g].push(m);
    });
    return map;
  }, [groupMatches]);

  const groupLabels = Object.keys(groupsMap).sort();

  // Compute standings per group
  const groupStandings = React.useMemo(() => {
    const result: Record<string, StandingRow[]> = {};

    groupLabels.forEach((label) => {
      const gMatches = groupsMap[label] || [];
      const stats: Record<string, StandingRow> = {};

      // Initialize all competitors who appear in this group
      gMatches.forEach((m) => {
        [m.competitor_a_id, m.competitor_b_id].forEach((cId) => {
          if (cId && !stats[String(cId)]) {
            const comp = competitorMap.get(String(cId));
            stats[String(cId)] = {
              competitorId: String(cId),
              name: comp?.display_name || `Участник #${cId}`,
              logo: comp?.team_logo,
              played: 0,
              won: 0,
              lost: 0,
              roundsWon: 0,
              roundsLost: 0,
              roundDiff: 0,
              points: 0,
              isCurrentUser: isUserInCompetitor(cId),
            };
          }
        });

        // Compute results for finished matches
        if (m.status === "FINISHED" && m.competitor_a_id && m.competitor_b_id) {
          const rowA = stats[String(m.competitor_a_id)];
          const rowB = stats[String(m.competitor_b_id)];
          if (rowA && rowB) {
            rowA.played += 1;
            rowB.played += 1;
            rowA.roundsWon += m.score1 || 0;
            rowA.roundsLost += m.score2 || 0;
            rowB.roundsWon += m.score2 || 0;
            rowB.roundsLost += m.score1 || 0;

            if (m.winner_competitor_id === m.competitor_a_id || (m.score1 || 0) > (m.score2 || 0)) {
              rowA.won += 1;
              rowA.points += 3;
              rowB.lost += 1;
            } else if (m.winner_competitor_id === m.competitor_b_id || (m.score2 || 0) > (m.score1 || 0)) {
              rowB.won += 1;
              rowB.points += 3;
              rowA.lost += 1;
            }
          }
        }
      });

      // Calculate round diff and sort
      const rows = Object.values(stats).map((row) => ({
        ...row,
        roundDiff: row.roundsWon - row.roundsLost,
      }));

      rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.roundDiff !== a.roundDiff) return b.roundDiff - a.roundDiff;
        return b.roundsWon - a.roundsWon;
      });

      result[label] = rows;
    });

    return result;
  }, [groupLabels, groupsMap, competitorMap, currentPlayer, userTeams]);

  if (groupLabels.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
          <Table className="w-4 h-4 text-orange-500" />
          <span>Групповой этап (Round Robin)</span>
        </h3>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          Топ-2 каждой группы выходят в плей-офф
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {groupLabels.map((groupLabel) => {
          const standings = groupStandings[groupLabel] || [];
          const gMatches = groupsMap[groupLabel] || [];

          return (
            <div
              key={groupLabel}
              className="bg-[#0c0c0e]/95 border border-white/5 rounded-[2.5rem] p-6 lg:p-7 space-y-6 shadow-xl"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center font-black text-orange-500 text-sm">
                    {groupLabel}
                  </div>
                  <div>
                    <h4 className="text-base font-black uppercase italic tracking-tight text-white leading-none">
                      Группа {groupLabel}
                    </h4>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mt-1 block">
                      {standings.length} участников • {gMatches.length} матчей
                    </span>
                  </div>
                </div>
              </div>

              {/* Standings Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-white/5">
                      <th className="pb-2.5 pl-2">#</th>
                      <th className="pb-2.5">Команда / Игрок</th>
                      <th className="pb-2.5 text-center">И</th>
                      <th className="pb-2.5 text-center">В</th>
                      <th className="pb-2.5 text-center">П</th>
                      <th className="pb-2.5 text-center">+/-</th>
                      <th className="pb-2.5 text-right pr-2">Очки</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {standings.map((row, idx) => {
                      const isPlayoffSpot = idx < 2;

                      return (
                        <tr
                          key={row.competitorId}
                          className={cn(
                            "transition-colors",
                            row.isCurrentUser
                              ? "bg-orange-500/10 text-orange-200 font-bold"
                              : "hover:bg-white/[0.02]"
                          )}
                        >
                          <td className="py-2.5 pl-2 font-black">
                            <span
                              className={cn(
                                "w-5 h-5 rounded-lg flex items-center justify-center text-[10px]",
                                isPlayoffSpot
                                  ? "bg-emerald-500/20 text-emerald-400 font-bold"
                                  : "text-gray-400"
                              )}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-2.5 font-bold">
                            <div className="flex items-center gap-2 max-w-[150px] truncate">
                              <span className="truncate">{row.name}</span>
                              {row.isCurrentUser && (
                                <span className="text-[8px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-black shrink-0">
                                  ВЫ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 text-center font-semibold text-gray-400">{row.played}</td>
                          <td className="py-2.5 text-center font-bold text-emerald-400">{row.won}</td>
                          <td className="py-2.5 text-center font-bold text-red-400">{row.lost}</td>
                          <td className="py-2.5 text-center font-semibold text-gray-400">
                            {row.roundDiff > 0 ? `+${row.roundDiff}` : row.roundDiff}
                          </td>
                          <td className="py-2.5 text-right pr-2 font-black text-white text-sm">
                            {row.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Group Matches Mini List */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                  Матчи группы
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {gMatches.map((m) => {
                    const compA = m.competitor_a_id ? competitorMap.get(String(m.competitor_a_id)) : null;
                    const compB = m.competitor_b_id ? competitorMap.get(String(m.competitor_b_id)) : null;
                    const isMyMatch = isUserMatch(m);
                    const statusLower = (m.status || "").toLowerCase();
                    const isLive = statusLower === "live" || statusLower === "veto";
                    const matchLobbyHref = `/promo/tournaments/match/${m.id}${clubId ? `?clubId=${clubId}` : ""}`;

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs",
                          isMyMatch
                            ? "bg-orange-500/5 border-orange-500/30"
                            : "bg-white/[0.02] border-white/5"
                        )}
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-bold text-gray-300">
                              {compA?.display_name || "Ожидание"}
                            </span>
                            <span className="font-black text-white px-2 py-0.5 bg-black/40 rounded-lg">
                              {m.score1 ?? 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-bold text-gray-300">
                              {compB?.display_name || "Ожидание"}
                            </span>
                            <span className="font-black text-white px-2 py-0.5 bg-black/40 rounded-lg">
                              {m.score2 ?? 0}
                            </span>
                          </div>
                        </div>

                        {/* Match Status / CTA */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {isLive ? (
                            <Link
                              href={matchLobbyHref}
                              className="text-[9px] font-black uppercase bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-xl transition-colors shadow-md shadow-red-500/20 flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              LIVE
                            </Link>
                          ) : isMyMatch ? (
                            <Link
                              href={matchLobbyHref}
                              className="text-[9px] font-black uppercase bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                            >
                              Лобби ↗
                            </Link>
                          ) : m.status === "WAITING_SERVER" ? (
                            <span className="text-[9px] font-bold text-amber-400 uppercase flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 animate-pulse" />
                              В очереди
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-gray-400 uppercase">
                              {m.status === "FINISHED" ? "Завершен" : "Ожидание"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
