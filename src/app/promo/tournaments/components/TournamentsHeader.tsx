"use client";

import React from "react";

interface TournamentsHeaderProps {
  player: any;
}

export function TournamentsHeader({ player }: TournamentsHeaderProps) {
  const eloDisplay = player?.faceit_elo || player?.elo_cs2;

  return (
    <header className="border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tight">
              Tournament <span className="text-orange-500">Portal</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
              {player?.clubName || "Игровой клуб"}
            </p>
          </div>
        </div>

        {/* ELO & Balance Badges */}
        <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
          <div className="text-center">
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block">
              CS2 Rating
            </span>
            <span className="text-sm font-black text-orange-500 italic">
              {eloDisplay && eloDisplay !== 1000 ? `${eloDisplay} ELO` : "--"}
            </span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="text-center">
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block">
              Баланс
            </span>
            <span className="text-sm font-black text-yellow-500 italic">
              {player?.bonusBalance ? `${Math.floor(player.bonusBalance)} ₽` : "--"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
