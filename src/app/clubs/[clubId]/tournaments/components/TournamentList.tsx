"use client";
import React from "react";
import { cn } from "@/lib/utils";
import { Tournament, formatTypeLabel } from "../types";

interface TournamentListProps {
  tournaments: Tournament[];
  onSelect: (tournament: Tournament) => void;
}

export function TournamentList({ tournaments, onSelect }: TournamentListProps) {
  if (tournaments.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 bg-white border border-slate-200/80 rounded-[2rem] text-sm shadow-xs">
        Турниров не найдено. Создайте свой первый турнир!
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-[2rem] shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="py-3.5 px-6">Турнир</th>
              <th className="py-3.5 px-4">Дисциплина / Формат</th>
              <th className="py-3.5 px-4">Взнос</th>
              <th className="py-3.5 px-4">Старт</th>
              <th className="py-3.5 px-4">Статус</th>
              <th className="py-3.5 px-6 text-right">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tournaments.map((t) => {
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
                    <div className="font-black text-sm text-slate-900 uppercase italic tracking-tight group-hover:text-orange-600 transition-colors">
                      {t.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      ID #{t.id}
                    </div>
                  </td>

                  {/* Discipline & Format */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase text-orange-600 font-mono">
                        {t.discipline?.toUpperCase() || "CS2"}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-700 font-bold">
                        {formatTypeLabel(t.type)}
                      </span>
                      {t.config?.matchFormat && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 font-mono font-bold uppercase">
                            {t.config.matchFormat}
                          </span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Fee */}
                  <td className="py-4 px-4 font-bold text-slate-900 font-mono">
                    {fee}
                  </td>

                  {/* Starts at */}
                  <td className="py-4 px-4 text-slate-500 font-medium whitespace-nowrap">
                    {startsText}
                  </td>

                  {/* Status */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span
                      className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                        t.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : t.status === "REGISTRATION"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : t.status === "COMPLETED"
                          ? "bg-slate-100 text-slate-600 border-slate-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}
                    >
                      {t.status === "ACTIVE"
                        ? "Идет игра"
                        : t.status === "REGISTRATION"
                        ? "Регистрация"
                        : t.status === "COMPLETED"
                        ? "Завершен"
                        : t.status}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <span className="text-xs font-bold text-slate-600 group-hover:text-orange-600 transition-colors">
                      Управление →
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
