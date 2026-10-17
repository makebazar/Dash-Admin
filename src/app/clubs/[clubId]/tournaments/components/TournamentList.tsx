"use client";
import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tournament, formatTypeLabel } from "../types";
import { ChevronRight, Search, Trophy, Calendar, Users, DollarSign } from "lucide-react";

interface TournamentListProps {
  tournaments: Tournament[];
  onSelect: (tournament: Tournament) => void;
}

export function TournamentList({ tournaments, onSelect }: TournamentListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesDiscipline = (t.discipline || "").toLowerCase().includes(q);
        const matchesId = String(t.id).includes(q);
        if (!matchesName && !matchesDiscipline && !matchesId) return false;
      }
      return true;
    });
  }, [tournaments, searchQuery, statusFilter]);

  const formatDisciplineLabel = (discipline?: string) => {
    if (!discipline) return "CS2";
    const d = discipline.toLowerCase();
    if (d === "dota2" || d === "dota") return "Dota 2";
    if (d === "cs2" || d === "cs:go" || d === "csgo") return "CS2";
    if (d === "fifa") return "FIFA";
    if (d === "ufc") return "UFC";
    return discipline.toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Идет игра
          </span>
        );
      case "REGISTRATION":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Регистрация
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Черновик
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Завершен
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-500">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Отменен
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {status}
          </span>
        );
    }
  };

  if (tournaments.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Турниров пока нет</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Создайте свой первый турнир, чтобы настроить сетку, взносы и регламент.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию или ID турнира..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "ALL", label: "Все" },
            { id: "ACTIVE", label: "Live" },
            { id: "REGISTRATION", label: "Регистрация" },
            { id: "COMPLETED", label: "Завершены" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer",
                statusFilter === item.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {filteredTournaments.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white border border-slate-200 rounded-2xl text-slate-400 text-sm shadow-xs">
          По вашему запросу турниров не найдено.
        </div>
      ) : (
        <>
          {/* Mobile Card List (md:hidden) */}
          <div className="md:hidden space-y-3">
            {filteredTournaments.map((t) => {
              const fee = Number(t.entry_fee) > 0 ? `${t.entry_fee} ₽` : "Бесплатно";
              const startsText = t.starts_at
                ? new Date(t.starts_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Не указано";

              return (
                <div
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 cursor-pointer hover:border-slate-300 transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-slate-900">
                          {formatDisciplineLabel(t.discipline)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          #{t.id}
                        </span>
                      </div>
                      <h4 className="font-semibold text-base text-slate-900 truncate">
                        {t.name}
                      </h4>
                    </div>
                    {getStatusBadge(t.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Формат:</span>
                      <span className="font-medium text-slate-700">
                        {formatTypeLabel(t.type)} {t.config?.matchFormat ? `• ${t.config.matchFormat.toUpperCase()}` : ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Взнос:</span>
                      <span className="font-medium text-slate-900">{fee}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 text-[11px] block">Старт:</span>
                      <span className="font-medium text-slate-700">{startsText}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 font-medium">
                    <span>Перейти к турниру</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500">
                    <th className="py-3.5 px-6">Турнир</th>
                    <th className="py-3.5 px-4">Дисциплина / Формат</th>
                    <th className="py-3.5 px-4">Взнос</th>
                    <th className="py-3.5 px-4">Старт</th>
                    <th className="py-3.5 px-4">Статус</th>
                    <th className="py-3.5 px-6 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTournaments.map((t) => {
                    const fee = Number(t.entry_fee) > 0 ? `${t.entry_fee} ₽` : "Бесплатно";
                    const startsText = t.starts_at
                      ? `${new Date(t.starts_at).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}, ${new Date(t.starts_at).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "—";

                    return (
                      <tr
                        key={t.id}
                        onClick={() => onSelect(t)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Tournament Title */}
                        <td className="py-4 px-6">
                          <div className="font-semibold text-sm text-slate-900 group-hover:text-black transition-colors">
                            {t.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            ID #{t.id}
                          </div>
                        </td>

                        {/* Discipline & Format */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-900">
                              {formatDisciplineLabel(t.discipline)}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 font-normal">
                              {formatTypeLabel(t.type)}
                            </span>
                            {t.config?.matchFormat && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500 font-mono text-[11px] font-medium uppercase">
                                  {t.config.matchFormat}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Fee */}
                        <td className="py-4 px-4 font-semibold text-slate-900 font-mono">
                          {fee}
                        </td>

                        {/* Starts at */}
                        <td className="py-4 px-4 text-slate-500 font-normal whitespace-nowrap">
                          {startsText}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {getStatusBadge(t.status)}
                        </td>

                        {/* Action */}
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-slate-900 transition-colors">
                            Управление <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

