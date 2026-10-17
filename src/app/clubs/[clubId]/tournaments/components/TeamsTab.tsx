"use client";
import React, { useState, useMemo, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PromoTeam } from "../types";

interface TeamsTabProps {
  clubId: string;
  teams: PromoTeam[];
  onAddTeam: () => void;
  onEditTeam: (team: PromoTeam) => void;
  onDeleteTeam: (id: number) => void;
  isLoading?: boolean;
}

export function TeamsTab({
  clubId,
  teams,
  onAddTeam,
  onEditTeam,
  onDeleteTeam,
  isLoading = false,
}: TeamsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFormat, setActiveFormat] = useState<"all" | "5vs5" | "2vs2">("all");

  // Metrics
  const metrics = useMemo(() => {
    const total = teams.length;
    const teams5v5 = teams.filter((t) => t.format_type === "5vs5").length;
    const teams2v2 = teams.filter((t) => t.format_type === "2vs2").length;
    const totalPlayers = teams.reduce((sum, t) => sum + (t.members?.length || 0), 0);

    return { total, teams5v5, teams2v2, totalPlayers };
  }, [teams]);

  // Filtered teams
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (activeFormat === "5vs5" && t.format_type !== "5vs5") return false;
      if (activeFormat === "2vs2" && t.format_type !== "2vs2") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (t.name || "").toLowerCase().includes(q);
        const matchTag = (t.tag || "").toLowerCase().includes(q);
        const matchCap = (t.captain_phone || "").toLowerCase().includes(q);
        const matchCapName = (t.captain_name || "").toLowerCase().includes(q);
        const matchMembers = (t.members || []).some(
          (m) =>
            m.phone.toLowerCase().includes(q) ||
            (m.fullName || "").toLowerCase().includes(q) ||
            (m.nickname || "").toLowerCase().includes(q)
        );

        if (!matchName && !matchTag && !matchCap && !matchCapName && !matchMembers) {
          return false;
        }
      }

      return true;
    });
  }, [teams, activeFormat, searchQuery]);

  return (
    <div className="space-y-6">
      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Поиск по названию, тегу, капитану, составу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>

          {/* Format filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFormat("all")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer",
                activeFormat === "all"
                  ? "bg-slate-900 text-white font-semibold shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Все ({teams.length})
            </button>
            <button
              onClick={() => setActiveFormat("5vs5")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer",
                activeFormat === "5vs5"
                  ? "bg-slate-900 text-white font-semibold shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              5vs5 ({metrics.teams5v5})
            </button>
            <button
              onClick={() => setActiveFormat("2vs2")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer",
                activeFormat === "2vs2"
                  ? "bg-slate-900 text-white font-semibold shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              2vs2 ({metrics.teams2v2})
            </button>
          </div>
        </div>

        {/* Add button */}
        <Button
          onClick={onAddTeam}
          className="h-11 rounded-xl px-5 bg-black text-white hover:bg-slate-800 font-medium transition-all shadow-sm shrink-0 cursor-pointer self-start md:self-auto"
        >
          Создать команду
        </Button>
      </div>

      {/* 3. TEAMS TABLE */}
      {filteredTeams.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm min-w-[800px]">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6 sticky left-0 bg-slate-50/95 backdrop-blur-xs z-10">Команда</th>
                  <th className="py-3.5 px-4">Формат</th>
                  <th className="py-3.5 px-4">Капитан</th>
                  <th className="py-3.5 px-4">Состав игроков</th>
                  <th className="py-3.5 px-4">Код инвайта</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredTeams.map((t) => {
                  const initial = (t.name || "T")[0].toUpperCase();

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Name & Tag */}
                      <td className="py-3.5 px-4 sm:px-6 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 truncate">
                            {t.name}
                          </span>
                          {t.rename_requested && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold shrink-0"
                              title={`Запрошена смена названия${t.rename_reason ? `: ${t.rename_reason}` : ""}`}
                            >
                              запрос смены
                            </span>
                          )}
                        </div>
                        {t.tag && (
                          <div className="text-xs text-slate-500 font-mono">
                            [{t.tag}]
                          </div>
                        )}
                      </td>

                      {/* Format */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900">
                          {t.format_type || "5vs5"}
                        </span>
                      </td>

                      {/* Captain */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="font-mono text-slate-800">
                            {t.captain_phone}
                          </div>
                          {(t.captain_name || t.captain_nickname) && (
                            <div className="text-xs text-slate-500">
                              {t.captain_name || `@${t.captain_nickname}`}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Members / Roster */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-800">
                            {t.members?.length || 0} игроков
                          </div>
                          {t.members && t.members.length > 0 && (
                            <div className="text-[11px] text-slate-500 max-w-xs truncate font-mono">
                              {t.members.map((m) => m.nickname || m.fullName || m.phone).join(", ")}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Join code */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs text-slate-500">
                          {t.join_code || "—"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onEditTeam(t)}
                            className="p-2 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Редактировать команду"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTeam(t.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Удалить команду"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-slate-200 rounded-3xl p-10 sm:p-14 text-center space-y-4 shadow-xs">
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {searchQuery ? "Команды не найдены" : "В клубе пока нет зарегистрированных команд"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {searchQuery
                ? "Попробуйте изменить поисковый запрос или сбросить фильтры."
                : "Команды создаются игроками через промо-портал клуба или могут быть созданы администратором вручную для проведения командных турниров 5x5 и 2x2."}
            </p>
          </div>
          {!searchQuery && (
            <Button
              onClick={onAddTeam}
              className="h-11 rounded-xl px-6 bg-black text-white hover:bg-slate-800 font-medium transition-all shadow-sm cursor-pointer"
            >
              Создать первую команду
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
