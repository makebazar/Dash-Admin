"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Ticket, Coins, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PromoHeaderProps {
  initialPlayer?: any;
  initialTickets?: number;
  title?: string;
  onPrizesClick?: () => void;
  showPrizes?: boolean;
}

export function PromoHeader({
  initialPlayer,
  initialTickets,
  title = "Игровая зона",
  onPrizesClick,
  showPrizes,
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
    <>
      <header className="fixed top-0 left-0 right-0 z-40 w-full bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-3">
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
              className={cn(
                "bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center gap-1.5 sm:gap-3 hover:bg-white/10 transition-all relative",
                player?.activeBoostPercent > 0 && "border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
              )}
            >
              <motion.div
                animate={player?.activeBoostPercent > 0 ? {
                  rotate: [0, -10, 10, -10, 10, -5, 5, 0],
                } : {}}
                transition={player?.activeBoostPercent > 0 ? {
                  repeat: Infinity,
                  repeatType: "reverse",
                  duration: 0.8,
                  repeatDelay: 2.5
                } : {}}
                className="flex items-center justify-center"
              >
                <Coins className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500", player?.activeBoostPercent > 0 && "text-yellow-400")} />
              </motion.div>
              <span className={cn("text-xs sm:text-sm font-black", player?.activeBoostPercent > 0 && "text-yellow-400")}>
                {Math.floor(player?.bonusBalance || 0)}
              </span>
              {player?.activeBoostPercent > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-black font-black text-[7px] px-1 rounded-full border border-black animate-pulse leading-tight">
                  +{player.activeBoostPercent}%
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      {/* Spacer to prevent content overlap */}
      <div className="h-[60px] sm:h-[68px] shrink-0" />
    </>
  );
}
