"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Gift, Lock, Star, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BPPlayerWidgetProps {
  bp: {
    season: { name: string };
    progress: {
      xp: number;
      hasPremium: boolean;
      boostExpiresAt?: string;
    };
    currentLevel: number;
    nextTier: {
      level_number: number;
      xp_required: number;
      reward_name: string;
      is_premium: boolean;
    } | null;
  };
}

export function BPPlayerWidget({ bp }: BPPlayerWidgetProps) {
  const { season, progress, currentLevel, nextTier } = bp;

  const xpInCurrentLevel = nextTier ? progress.xp : progress.xp; // Logic could be more complex with base XP for level

  const progressPercent = nextTier
    ? Math.min(100, (progress.xp / nextTier.xp_required) * 100)
    : 100;

  const hasBoost =
    progress.boostExpiresAt && new Date(progress.boostExpiresAt) > new Date();

  return (
    <Link href="/promo/battlepass">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-linear-to-br from-[#1a1a1a] to-[#0f0f0f] border border-white/10 rounded-[2rem] p-6 shadow-2xl cursor-pointer"
      >
        {/* Background Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/10 blur-[100px] rounded-full" />

        <div className="relative z-10 space-y-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 italic">
                {season.name}
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black italic uppercase">
                  Level {currentLevel}
                </span>
                {progress.hasPremium && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-widest border border-amber-500/30">
                    Premium
                  </span>
                )}
              </div>
            </div>

            {hasBoost && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30 animate-pulse">
                <Zap className="w-3 h-3 fill-current" />
                <span className="text-[10px] font-black uppercase italic">
                  x2 XP Active
                </span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <span>{progress.xp} XP</span>
              <span>
                {nextTier ? `${nextTier.xp_required} XP` : "MAX LEVEL"}
              </span>
            </div>
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="h-full bg-linear-to-r from-orange-600 to-orange-400 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.4)]"
              />
            </div>
          </div>

          {/* Next Reward */}
          {nextTier && (
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg",
                  nextTier.is_premium
                    ? "bg-amber-500 shadow-amber-500/20"
                    : "bg-gray-700 shadow-black/20",
                )}
              >
                {nextTier.is_premium ? (
                  <Lock className="w-5 h-5 text-white" />
                ) : (
                  <Gift className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-[8px] font-black uppercase tracking-widest text-gray-500">
                  Next Reward (Lvl {nextTier.level_number})
                </div>
                <div className="font-bold text-sm truncate">
                  {nextTier.reward_name}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-white transition-colors" />
            </div>
          )}

          {!progress.hasPremium && (
            <p className="text-center text-[9px] text-gray-500 font-medium uppercase tracking-widest">
              Нажмите, чтобы посмотреть все награды сезона
            </p>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
