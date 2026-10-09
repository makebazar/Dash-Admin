"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface LeaderboardTabProps {
  leaderboardDiscipline: string;
  setLeaderboardDiscipline: (disp: string) => void;
  leaderboard: any[];
  onSelectPlayer: (playerId: string, playerName: string) => void;
}

export function LeaderboardTab({
  leaderboardDiscipline,
  setLeaderboardDiscipline,
  leaderboard,
  onSelectPlayer,
}: LeaderboardTabProps) {
  return (
    <div className="mt-8 space-y-6 animate-fadeIn">
      {/* Discipline selector */}
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 max-w-sm">
        {[
          { id: "cs2", label: "CS2", dot: "bg-orange-500" },
          { id: "fifa", label: "FIFA", dot: "bg-emerald-500" },
          { id: "ufc", label: "UFC", dot: "bg-red-500" },
        ].map((disp) => (
          <button
            key={disp.id}
            onClick={() => setLeaderboardDiscipline(disp.id)}
            className={cn(
              "flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5",
              leaderboardDiscipline === disp.id
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "text-gray-500 hover:text-white"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", disp.dot)} />
            {disp.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-6 sm:p-8 overflow-x-auto shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
              <th className="py-4 px-4">Место</th>
              <th className="py-4 px-4">Игрок</th>
              <th className="py-4 px-4">ELO Рейтинг</th>
              <th className="py-4 px-4 text-right">Игр сыграно</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {leaderboard.map((user: any, idx: number) => (
              <tr key={user.id || idx} className="hover:bg-white/5 transition-colors group">
                <td className="py-4 px-4 font-black italic text-orange-500">
                  #{idx + 1}
                </td>
                <td className="py-4 px-4 font-bold">
                  <button
                    onClick={() => onSelectPlayer(user.id, user.full_name)}
                    className="text-white hover:text-orange-400 transition-colors inline-flex items-center gap-1.5 text-left font-bold"
                  >
                    <span>{user.full_name}</span>
                    <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                  </button>
                </td>
                <td className="py-4 px-4 font-black italic text-yellow-500">
                  {user.elo || 1000} ELO
                </td>
                <td className="py-4 px-4 text-right font-medium text-gray-400">
                  {user.matches_played || 0}
                </td>
              </tr>
            ))}
            {leaderboard.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-gray-500 text-xs">
                  Рейтинги пустые для этой дисциплины. Сыграйте первый турнирный матч!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
