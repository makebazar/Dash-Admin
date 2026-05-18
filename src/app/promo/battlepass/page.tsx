"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Gift,
  Star,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PromoHeader } from "../components/PromoHeader";
import { BottomNav } from "../components/BottomNav";

export default function BattlePassPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchBP() {
      try {
        const res = await fetch("/api/promo/player");
        if (res.status === 401) {
          router.push("/promo");
          return;
        }
        const json = await res.json();
        if (json.player?.bp) {
          setData(json.player.bp);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchBP();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="w-16 h-16 text-gray-700" />
        <h1 className="text-xl font-black uppercase italic tracking-tight">
          Сезон не найден
        </h1>
        <p className="text-gray-500 text-center text-sm font-medium">
          В данный момент активных сезонов Боевого Пропуска нет.
        </p>
        <button
          onClick={() => router.back()}
          className="text-orange-500 font-black uppercase text-[10px] tracking-[0.2em] border-b border-orange-500/30 pb-1"
        >
          Назад
        </button>
      </div>
    );
  }

  const { season, progress, currentLevel, allTiers, nextTier } = data;
  const claimedRewards = progress.claimedRewards || [];
  const progressPercent = nextTier
    ? Math.min(100, (progress.xp / nextTier.xp_required) * 100)
    : 100;

  const hasBoost =
    progress.boostExpiresAt && new Date(progress.boostExpiresAt) > new Date();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      <PromoHeader title="Боевой пропуск" />

      <main className="max-w-4xl mx-auto p-6 pt-10 pb-32">
        {/* Season Header */}
        <div className="mb-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase italic tracking-tight">
                {season.name}
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/10 rounded-full border border-orange-500/20">
                  <Star className="w-3 h-3 text-orange-500 fill-current" />
                  <span className="text-xs font-black uppercase italic">
                    Уровень {currentLevel}
                  </span>
                </div>
                {progress.hasPremium && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/20">
                    <Zap className="w-3 h-3 text-amber-500 fill-current" />
                    <span className="text-xs font-black uppercase italic text-amber-500">
                      PREMIUM
                    </span>
                  </div>
                )}
              </div>
            </div>

            {hasBoost && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 animate-pulse">
                <Zap className="w-4 h-4 fill-current" />
                <span className="text-xs font-black uppercase italic">
                  x2 Опыт Активен
                </span>
              </div>
            )}
          </div>

          {/* Overall Progress */}
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <TrendingUp className="w-24 h-24 text-orange-500" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                    Ваш прогресс
                  </span>
                  <div className="text-3xl font-black italic tracking-tighter">
                    {progress.xp}{" "}
                    <span className="text-sm not-italic font-bold text-gray-500 uppercase tracking-widest ml-1">
                      XP
                    </span>
                  </div>
                </div>
                {nextTier && (
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block mb-1">
                      До Lvl {nextTier.level_number}
                    </span>
                    <span className="text-sm font-bold text-white/60">
                      {nextTier.xp_required - progress.xp} XP осталось
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden p-1 border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    className="h-full bg-linear-to-r from-orange-600 to-orange-400 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Upgrade Banner */}
        {!progress.hasPremium && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-12 p-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-[2.5rem] shadow-xl shadow-orange-600/20 relative overflow-hidden group"
          >
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 blur-3xl rounded-full" />
            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8 text-center sm:text-left">
              <div className="w-20 h-20 bg-white/20 rounded-[2rem] flex items-center justify-center shrink-0 shadow-2xl backdrop-blur-md">
                <Lock className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-2xl font-black uppercase italic tracking-tight">
                  Разблокируй <span className="text-black/30">Premium</span>
                </h3>
                <p className="text-white/90 text-sm font-medium leading-relaxed max-w-md">
                  Получи доступ ко всем наградам сезона, эксклюзивным бустерам и
                  джекпоту в конце пути!
                </p>
                <div className="pt-2">
                  <span className="inline-block px-4 py-1.5 bg-black/20 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    Активация у администратора — {data.settings?.price || 1000}₽
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tiers List */}
        <div className="space-y-6">
          <div className="flex items-center gap-4 mb-8">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
              Дорожная карта наград
            </h3>
            <div className="h-px w-full bg-white/5" />
          </div>

          <div className="space-y-4">
            {allTiers.map((tier: any, idx: number) => {
              const isUnlocked = progress.xp >= tier.xp_required;
              const isClaimed = claimedRewards.some(
                (r: any) =>
                  r.level === tier.level_number &&
                  r.is_premium === tier.is_premium,
              );
              const isNext = nextTier?.level_number === tier.level_number;

              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "relative flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded-[2rem] border transition-all overflow-hidden",
                    isUnlocked
                      ? "bg-white/5 border-white/10"
                      : "bg-white/2 border-white/5 opacity-50",
                    isNext && "border-orange-500/30 bg-orange-500/2",
                    tier.is_premium && "border-amber-500/10",
                  )}
                >
                  {/* Tier Number & XP */}
                  <div className="flex items-center gap-4 sm:flex-col sm:gap-1 sm:w-20 shrink-0">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black transition-all",
                        isUnlocked
                          ? "bg-white text-black"
                          : "bg-white/5 text-gray-500",
                      )}
                    >
                      <span className="text-[8px] uppercase tracking-tighter opacity-50">
                        Lvl
                      </span>
                      {tier.level_number}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      {tier.xp_required} XP
                    </div>
                  </div>

                  {/* Reward Detail */}
                  <div className="flex-1 flex items-center gap-6">
                    <div
                      className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
                        isUnlocked
                          ? tier.is_premium
                            ? "bg-amber-500 shadow-amber-500/20"
                            : "bg-orange-500 shadow-orange-500/20"
                          : "bg-white/5 shadow-none text-gray-700",
                      )}
                    >
                      {isUnlocked ? (
                        <Gift className="w-7 h-7 text-white" />
                      ) : (
                        <Lock className="w-7 h-7" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black uppercase italic tracking-tight truncate">
                          {tier.reward_name}
                        </h4>
                        {tier.is_premium && (
                          <div className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-[8px] font-black text-amber-500 uppercase tracking-widest">
                            Premium
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-medium">
                        {isUnlocked
                          ? isClaimed
                            ? "Награда получена"
                            : "Разблокировано"
                          : `Разблокируется на ${tier.xp_required} XP`}
                      </p>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="hidden sm:block">
                    {tier.is_premium && !progress.hasPremium ? (
                      <Lock className="w-6 h-6 text-white/10" />
                    ) : isUnlocked ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center text-[10px] font-black text-white/10">
                        {tier.level_number}
                      </div>
                    )}
                  </div>

                  {/* Visual Background Polish */}
                  {isUnlocked && (
                    <div className="absolute -bottom-6 -right-6 p-8 opacity-[0.03]">
                      <Gift className="w-20 h-20 text-white" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
