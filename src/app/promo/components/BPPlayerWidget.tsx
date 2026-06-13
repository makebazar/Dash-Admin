"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Gift, Lock, Star, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface BPPlayerWidgetProps {
  bp: {
    season: { name: string };
    settings: {
      price: number;
      bp_xp_per_rub?: number;
    };
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
  const { season, progress, currentLevel, nextTier, settings } = bp;
  const xpPerRub = settings?.bp_xp_per_rub ?? 1;

  const progressPercent = nextTier
    ? Math.min(100, (progress.xp / nextTier.xp_required) * 100)
    : 100;

  const hasBoost =
    progress.boostExpiresAt && new Date(progress.boostExpiresAt) > new Date();

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-xl font-black uppercase italic tracking-tight text-white">
            Боевой пропуск
          </h3>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">
            {season.name} • Накапливайте XP и открывайте крутые награды
          </p>
        </div>

        {hasBoost && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20 animate-pulse shrink-0 self-start sm:self-auto">
            <Zap className="w-3.5 h-3.5 fill-current text-blue-500" />
            <span className="text-[9px] font-black uppercase tracking-wider">
              x2 XP Активен
            </span>
          </div>
        )}
      </div>

      {/* Section Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Progress Card (7/12 width) */}
        <Link href="/promo/battlepass" className="lg:col-span-7 group block">
          <motion.div
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.995 }}
            className="h-full bg-zinc-950/80 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[220px] transition-colors hover:border-orange-500/20"
          >
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />

            <div className="space-y-6 relative z-10">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black italic uppercase leading-none text-white">
                  LEVEL {currentLevel}
                </span>
                {progress.hasPremium && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest border border-amber-500/20">
                    Premium
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-3">
                <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-wider text-gray-500 px-1">
                  <span>{progress.xp} XP</span>
                  <span>
                    {nextTier ? `${nextTier.xp_required} XP` : "MAX LEVEL"}
                  </span>
                </div>
                <div className="h-3.5 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                  />
                </div>
                {nextTier && (
                  <div className="text-center pt-0.5">
                    <span className="text-orange-500 font-black animate-pulse text-[10px] tracking-wider uppercase">
                      Осталось {nextTier.xp_required - progress.xp} XP до Lvl {nextTier.level_number}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* CTA Action Bar */}
            <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6 relative z-10">
              {!progress.hasPremium ? (
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">
                    Активировать Premium доступ — {settings?.price ?? 1000}₽
                  </span>
                </div>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Открыть меню Боевого пропуска
                </span>
              )}
              <div className="flex items-center gap-1 text-orange-500 font-black uppercase text-[10px] tracking-wider group-hover:translate-x-1 transition-transform">
                <span>Подробнее</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </motion.div>
        </Link>

        {/* Right Column: Next Reward Card & Info Box (5/12 width) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Next Reward Card */}
          {nextTier && (
            <Link href="/promo/battlepass" className="group block">
              <motion.div
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.995 }}
                className="bg-zinc-950/80 border border-white/5 rounded-[2rem] p-6 shadow-2xl flex items-center gap-4 transition-colors hover:border-orange-500/20"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
                    nextTier.is_premium
                      ? progress.hasPremium
                        ? "bg-amber-500 shadow-amber-500/20"
                        : "bg-zinc-900 border border-white/10 shadow-black/20"
                      : "bg-orange-500 shadow-orange-500/20",
                  )}
                >
                  {nextTier.is_premium ? (
                    progress.hasPremium ? (
                      <Gift className="w-5 h-5 text-white" />
                    ) : (
                      <Lock className="w-5 h-5 text-amber-500 animate-pulse" />
                    )
                  ) : (
                    <Gift className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5 leading-none">
                    <span>Следующая награда (ур. {nextTier.level_number})</span>
                    {nextTier.is_premium ? (
                      <span className="text-[7px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-black">
                        PREMIUM
                      </span>
                    ) : (
                      <span className="text-[7px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black">
                        FREE
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-sm truncate text-white mt-1 leading-snug">
                    {nextTier.reward_name}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-white transition-colors shrink-0" />
              </motion.div>
            </Link>
          )}

          {/* Info Card */}
          <div className="bg-zinc-950/80 border border-white/5 p-6 rounded-[2rem] text-[11px] text-gray-400 leading-relaxed shadow-2xl space-y-2">
            <span className="font-black text-white uppercase tracking-wider text-xs block leading-none">
              Как получать XP?
            </span>
            <p className="text-gray-400 leading-normal">
              Опыт начисляется за <span className="text-orange-400 font-bold">пополнение баланса</span> в клубе (1 ₽ = {xpPerRub} XP), а также за выполнение ежедневных квестов и победы в играх. Накапливайте XP и открывайте призы!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
