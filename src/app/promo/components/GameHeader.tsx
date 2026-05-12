"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Ticket, Coins, History, Gift } from "lucide-react";
import { motion, useSpring, useTransform } from "framer-motion";

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(value, { bounce: 0, duration: 800 });
  const display = useTransform(spring, (current) => Math.floor(current));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

interface GameHeaderProps {
  ticketsCount?: number;
  bonusBalance?: number;
  showHistory?: boolean;
  onHistoryClick?: () => void;
  showPrizes?: boolean;
  onPrizesClick?: () => void;
  accentColor?: string; // e.g. "text-green-500", "text-orange-500"
  hideBack?: boolean;
}

export const GameHeader = ({
  ticketsCount,
  bonusBalance,
  showHistory,
  onHistoryClick,
  showPrizes,
  onPrizesClick,
  accentColor = "text-green-500",
  hideBack = false,
}: GameHeaderProps) => {
  const router = useRouter();

  return (
    <div className="w-full flex items-center justify-between z-[150] p-4 absolute top-0 left-0 right-0 pointer-events-none">
      {!hideBack ? (
        <button
          onClick={() => router.back()}
          className="h-10 w-10 sm:w-auto px-0 sm:px-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 active:scale-90 transition-transform backdrop-blur-md text-white hover:bg-white/10 pointer-events-auto"
        >
          <ChevronLeft className="w-5 h-5 opacity-70" />
          <span className="text-xs font-bold tracking-widest uppercase opacity-80 hidden sm:block">
            Назад
          </span>
        </button>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-2 pointer-events-auto">
        {onHistoryClick && (
          <button
            onClick={onHistoryClick}
            className={`w-10 h-10 border rounded-xl flex items-center justify-center active:scale-90 transition-transform backdrop-blur-md ${showHistory ? "bg-white/20 border-white/30" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
          >
            <History className="w-4 h-4 text-white/70" />
          </button>
        )}

        {onPrizesClick && (
          <button
            onClick={onPrizesClick}
            className={`w-10 h-10 border rounded-xl flex items-center justify-center active:scale-90 transition-transform backdrop-blur-md ${showPrizes ? "bg-orange-500/20 border-orange-500/30" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
          >
            <Gift
              className={`w-4 h-4 ${showPrizes ? "text-orange-500" : "text-white/70"}`}
            />
          </button>
        )}

        {bonusBalance !== undefined && (
          <div className="bg-white/5 border border-white/10 px-3 sm:px-4 py-2 rounded-xl flex items-center gap-2 backdrop-blur-md">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-black text-xs sm:text-sm text-white min-w-[30px] text-right">
              <AnimatedNumber value={bonusBalance} />
            </span>
          </div>
        )}

        {ticketsCount !== undefined && (
          <div className="bg-white/5 border border-white/10 px-3 sm:px-4 py-2 rounded-xl flex items-center gap-2 backdrop-blur-md">
            <Ticket className={`w-4 h-4 ${accentColor}`} />
            <span className="font-black text-xs sm:text-sm text-white min-w-[20px] text-center">
              <AnimatedNumber value={ticketsCount} />
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
