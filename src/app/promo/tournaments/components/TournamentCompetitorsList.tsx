"use client";

import React, { useState } from "react";
import {
  Users,
  Shield,
  Crown,
  ChevronDown,
  ChevronUp,
  Search,
  UserCheck,
  User,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Competitor {
  id: string;
  type: string;
  display_name: string;
  team_id?: string | null;
  promo_team_id?: number | null;
  player_id?: string | null;
  player_elo?: number | null;
  player_faceit_lvl?: number | null;
  player_faceit_link?: string | null;
  player_avatar_url?: string | null;
  player_name?: string | null;
  meta?: any;
  payment_status?: string;
  team_logo?: string | null;
  team_members?: Array<{
    id: string;
    fullName: string;
    nickname?: string;
    phoneNumber?: string;
    role?: string;
    elo?: number;
    faceitElo?: number;
    faceitLvl?: number;
    faceitLink?: string;
    avatarUrl?: string;
  }>;
}

interface TournamentCompetitorsListProps {
  tournament: any;
  competitors: Competitor[];
  currentPlayer: any;
  userTeams: any[];
  onSelectPlayer?: (pId: string, pName: string) => void;
}

export function TournamentCompetitorsList({
  tournament,
  competitors,
  currentPlayer,
  userTeams,
  onSelectPlayer,
}: TournamentCompetitorsListProps) {
  const [search, setSearch] = useState("");
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedTeams((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isUserCompetitor = (comp: Competitor) => {
    if (!currentPlayer) return false;
    if (comp.player_id && String(comp.player_id) === String(currentPlayer.id)) return true;
    if (comp.promo_team_id && userTeams.some((t) => String(t.id) === String(comp.promo_team_id))) return true;
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

  const filteredCompetitors = competitors.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (c.display_name.toLowerCase().includes(q)) return true;
    if (c.player_name && c.player_name.toLowerCase().includes(q)) return true;
    if (c.team_members?.some((m) => m.fullName.toLowerCase().includes(q))) return true;
    return false;
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "PAID":
        return (
          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Подтвержден
          </span>
        );
      case "RESERVE":
        return (
          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            В резерве
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Ожидает
          </span>
        );
    }
  };

  const calcAverageElo = (members?: any[]) => {
    if (!members || members.length === 0) return null;
    const total = members.reduce((sum, m) => sum + (m.faceitElo || m.elo || 1000), 0);
    return Math.round(total / members.length);
  };

  const getFaceitLevelBadge = (level?: number | null) => {
    if (!level) return null;
    let bg = "bg-gray-500 text-white";
    if (level === 1) bg = "bg-gray-300 text-black";
    else if (level <= 3) bg = "bg-emerald-500 text-white";
    else if (level <= 7) bg = "bg-amber-400 text-black";
    else if (level <= 9) bg = "bg-orange-500 text-white";
    else if (level >= 10) bg = "bg-red-600 text-white font-black shadow-sm shadow-red-500/50";

    return (
      <span
        className={cn(
          "inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-black shrink-0",
          bg
        )}
        title={`Faceit Level ${level}`}
      >
        {level}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Summary */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Поиск по названию или никнейму..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400">
          <Users className="w-4 h-4 text-orange-500" />
          <span>
            Всего участников: <span className="text-white font-bold">{competitors.length}</span>
            {tournament.config?.maxParticipants && (
              <span className="text-gray-600 font-normal"> / {tournament.config.maxParticipants}</span>
            )}
          </span>
        </div>
      </div>

      {filteredCompetitors.length === 0 ? (
        <div className="bg-[#0c0c0e]/80 border border-white/5 rounded-[2rem] p-12 text-center text-gray-500 text-xs font-bold uppercase tracking-widest">
          {search ? "Участники по вашему запросу не найдены" : "На этот турнир пока нет зарегистрированных участников"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCompetitors.map((comp) => {
            const isMyComp = isUserCompetitor(comp);
            const isExpanded = expandedTeams[comp.id] ?? true;
            const isTeam = comp.type === "TEAM" || (comp.team_members && comp.team_members.length > 1);
            const avgElo = calcAverageElo(comp.team_members);
            const playerElo = comp.player_elo || comp.meta?.elo || 1000;
            const faceitLvl = comp.player_faceit_lvl;

            return (
              <div
                key={comp.id}
                className={cn(
                  "bg-[#0c0c0e]/95 border rounded-[2rem] p-5 transition-all space-y-4 shadow-lg",
                  isMyComp
                    ? "border-orange-500/50 shadow-orange-500/5 bg-gradient-to-b from-orange-500/[0.03] to-transparent"
                    : "border-white/5 hover:border-white/15"
                )}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    onClick={() => {
                      if (!isTeam && comp.player_id && onSelectPlayer) {
                        onSelectPlayer(String(comp.player_id), comp.player_name || comp.display_name);
                      }
                    }}
                    className={cn(
                      "min-w-0 flex-1 flex items-center gap-3.5",
                      !isTeam && comp.player_id && onSelectPlayer ? "cursor-pointer group" : ""
                    )}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {isTeam ? (
                        comp.team_logo ? (
                          <img
                            src={comp.team_logo}
                            alt={comp.display_name}
                            className="w-11 h-11 rounded-2xl object-cover border border-white/10 bg-black/40"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center font-black text-sm uppercase">
                            {comp.display_name.slice(0, 2)}
                          </div>
                        )
                      ) : comp.player_avatar_url ? (
                        <img
                          src={comp.player_avatar_url}
                          alt={comp.display_name}
                          className="w-11 h-11 rounded-2xl object-cover border border-white/10 bg-black/40 group-hover:border-orange-500/50 transition-colors"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 text-gray-400 flex items-center justify-center font-black text-xs uppercase group-hover:text-orange-400 group-hover:border-orange-500/30 transition-colors">
                          <User className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black uppercase tracking-wide text-white truncate group-hover:text-orange-400 transition-colors">
                          {comp.display_name}
                        </h4>
                        {!isTeam && comp.player_id && onSelectPlayer && (
                          <span className="text-[9px] font-bold text-gray-500 group-hover:text-orange-400 transition-colors hidden sm:inline-block">
                            Профиль ↗
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider flex-wrap">
                        {isTeam ? (
                          <>
                            <span className="flex items-center gap-1.5">
                              <span>AVG ELO:</span>
                              <strong className="text-yellow-400 font-black">
                                {avgElo || 1000}
                              </strong>
                            </span>
                            {comp.team_members && (
                              <>
                                <span className="text-gray-700">•</span>
                                <span>{comp.team_members.length} игроков</span>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {faceitLvl && getFaceitLevelBadge(faceitLvl)}
                            <span>ELO:</span>
                            <strong className="text-yellow-400 font-black">
                              {playerElo}
                            </strong>
                            {comp.player_faceit_link && (
                              <a
                                href={comp.player_faceit_link}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[9px] font-extrabold text-orange-400 hover:text-orange-300 ml-1 inline-flex items-center gap-0.5"
                                title="Открыть Faceit профиль"
                              >
                                Faceit ↗
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {getStatusBadge(comp.payment_status)}
                  </div>
                </div>

                {/* Team Roster Members */}
                {isTeam && comp.team_members && comp.team_members.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => toggleExpand(comp.id)}
                      className="w-full flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors py-1 cursor-pointer"
                    >
                      <span>Состав команды</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="space-y-1.5">
                        {comp.team_members.map((member) => {
                          const isCaptain = member.role === "captain";
                          const isSub = member.role === "sub";
                          const isMe =
                            currentPlayer &&
                            ((member.id && String(member.id) === String(currentPlayer.id)) ||
                              (member.phoneNumber &&
                                (member.phoneNumber === currentPlayer.phoneNumber ||
                                  member.phoneNumber === currentPlayer.phone_number)));
                          const memberElo = member.faceitElo || member.elo || 1000;
                          const memberLvl = member.faceitLvl;

                          return (
                            <div
                              key={member.id || member.phoneNumber}
                              onClick={() => {
                                if (member.id && onSelectPlayer) {
                                  onSelectPlayer(String(member.id), member.fullName);
                                }
                              }}
                              className={cn(
                                "flex items-center justify-between p-2.5 rounded-xl text-xs transition-all border cursor-pointer group",
                                isMe
                                  ? "bg-orange-500/10 border-orange-500/20 text-orange-300"
                                  : "bg-white/[0.02] border-white/5 hover:bg-white/5 text-gray-300 hover:text-white hover:border-white/10"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {member.avatarUrl ? (
                                  <img
                                    src={member.avatarUrl}
                                    alt={member.fullName}
                                    className="w-5 h-5 rounded-full object-cover shrink-0 border border-white/10"
                                  />
                                ) : isCaptain ? (
                                  <Crown className="w-4 h-4 text-orange-500 shrink-0" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />
                                )}
                                <span className="font-bold truncate text-xs group-hover:text-orange-400 transition-colors">
                                  {member.fullName}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {isCaptain && (
                                  <span className="text-[8px] font-black uppercase text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                                    Капитан
                                  </span>
                                )}
                                {isSub && (
                                  <span className="text-[8px] font-black uppercase text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                    Запас
                                  </span>
                                )}
                                <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-lg border border-white/5">
                                  {memberLvl && getFaceitLevelBadge(memberLvl)}
                                  <span className="text-[10px] font-black text-yellow-400 font-mono">
                                    {memberElo} ELO
                                  </span>
                                </div>
                                <span className="text-[9px] text-gray-500 group-hover:text-orange-400 font-bold ml-0.5">
                                  ↗
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
