"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Ticket, Coins } from "lucide-react";

interface PromoHeaderProps {
  initialPlayer?: any;
  initialTickets?: number;
  title?: string;
}

export function PromoHeader({
  initialPlayer,
  initialTickets,
  title = "Игровая зона",
}: PromoHeaderProps) {
  const [player, setPlayer] = useState<any>(initialPlayer || null);
  const [tickets, setTickets] = useState<number>(initialTickets || 0);

  useEffect(() => {
    if (initialPlayer) {
      setPlayer(initialPlayer);
      setTickets(initialTickets || 0);
    } else {
      async function fetchPlayer() {
        try {
          const res = await fetch("/api/promo/player");
          if (res.ok) {
            const data = await res.json();
            setPlayer(data.player);
            setTickets(data.tickets);
          }
        } catch (err) {
          console.error(err);
        }
      }
      fetchPlayer();
    }
  }, [initialPlayer, initialTickets]);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex flex-col min-w-0">
          <div className="text-[9px] sm:text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none mb-1 truncate">
            {player?.clubName || "Клуб"}
          </div>
          <h1 className="text-base sm:text-lg font-black uppercase italic tracking-tight truncate">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <Link
            href="/promo/roadmap"
            className="flex items-center gap-1.5 sm:gap-2 bg-orange-500/10 border border-orange-500/20 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl hover:bg-orange-500/20 transition-colors"
          >
            <span className="text-[9px] sm:text-[10px] font-black text-orange-500 uppercase tracking-widest">
              LVL
            </span>
            <span className="text-xs sm:text-sm font-black text-white">
              {player?.level?.currentLevel || 1}
            </span>
          </Link>

          <Link
            href="/promo/accruals"
            className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center gap-1.5 sm:gap-3 hover:bg-white/10 transition-colors"
          >
            <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
            <span className="text-xs sm:text-sm font-black">{tickets}</span>
          </Link>

          <Link
            href="/promo/withdraw"
            className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center gap-1.5 sm:gap-3 hover:bg-white/10 transition-colors"
          >
            <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500" />
            <span className="text-xs sm:text-sm font-black">
              {Math.floor(player?.bonusBalance || 0)}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
