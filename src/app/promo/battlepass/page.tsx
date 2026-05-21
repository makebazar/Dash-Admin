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
        <Loader2 className="w-8 h-8 text-amber-500/80 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="w-12 h-12 text-gray-700" />
        <h1 className="text-lg font-black uppercase tracking-widest text-white/90">
          Сезон не найден
        </h1>
        <p className="text-gray-500 text-center text-xs font-semibold max-w-xs">
          В данный момент активных сезонов Боевого Пропуска нет.
        </p>
        <button
          onClick={() => router.back()}
          className="text-amber-500 font-black uppercase text-[10px] tracking-[0.2em] border-b border-amber-500/20 pb-1 hover:text-amber-400 hover:border-amber-400/40 transition-all"
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
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
      <PromoHeader title="Боевой пропуск" />

      <main className="max-w-4xl mx-auto p-6 pt-10 pb-32">
        {/* Season Header */}
        <div className="mb-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-500/70">
                Сезонный Прогресс
              </span>
              <h2 className="text-2xl font-black uppercase tracking-wider text-white/90">
                {season.name}
              </h2>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/5 rounded-full border border-amber-500/10">
                  <Star className="w-3.5 h-3.5 text-amber-500/90 fill-current" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Уровень {currentLevel}
                  </span>
                </div>
                {progress.hasPremium && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/25">
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-current animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">
                      PREMIUM
                    </span>
                  </div>
                )}
              </div>
            </div>

            {hasBoost && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/5 text-blue-400 rounded-2xl border border-blue-500/10">
                <Zap className="w-3.5 h-3.5 fill-current text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  x2 Опыт Активен
                </span>
              </div>
            )}
          </div>

          {/* Overall Progress Container */}
          <div className="bg-[#121212] border border-amber-500/10 rounded-[2rem] p-8 relative overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.4)]">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <TrendingUp className="w-24 h-24 text-amber-500" />
            </div>
            <div className="relative z-10 space-y-5">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-500">
                    Ваш прогресс
                  </span>
                  <div className="text-3xl font-black tracking-tight text-white/95">
                    {progress.xp}{" "}
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                      XP
                    </span>
                  </div>
                </div>
                {nextTier && (
                  <div className="text-right">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-500 block mb-1">
                      До Lvl {nextTier.level_number}
                    </span>
                    <span className="text-xs font-bold text-white/60">
                      {nextTier.xp_required - progress.xp} XP осталось
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="h-2 w-full bg-black/55 rounded-full overflow-hidden p-0 border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-500 rounded-full"
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Upgrade Banner */}
        {!progress.hasPremium && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 p-8 bg-gradient-to-br from-[#161616] to-[#0f0f0f] border border-amber-500/20 rounded-[2.5rem] shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/5 blur-3xl rounded-full" />
            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                <Lock className="w-7 h-7 text-amber-400" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-xl font-black uppercase tracking-wider text-white/95">
                  Разблокируй <span className="text-amber-500">Premium</span>
                </h3>
                <p className="text-gray-400 text-xs font-medium leading-relaxed max-w-md">
                  Получи доступ ко всем наградам сезона, эксклюзивным бустерам и
                  джекпоту в конце пути!
                </p>
                <div className="pt-2">
                  <span className="inline-block px-4 py-1.5 bg-amber-500/5 border border-amber-500/15 rounded-xl text-[9px] font-black uppercase tracking-widest text-amber-400/90">
                    Активация у администратора — {data.settings?.price || 1000}₽
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tiers List - Horizontal Swipeable Timeline */}
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
              Дорожная карта наград
            </h3>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest animate-pulse">
              Свайпайте вбок ➔
            </span>
          </div>

          {/* Horizontal scroll container with smooth snap */}
          <div className="relative overflow-visible">
            {/* Elegant connecting line background */}
            <div className="absolute left-10 right-10 top-[28px] h-[2px] bg-gradient-to-r from-amber-500/20 via-white/5 to-white/2 pointer-events-none z-0" />

            <div className="flex gap-4 overflow-x-auto pb-8 pt-2 scrollbar-thin scrollbar-thumb-amber-500/15 scrollbar-track-transparent snap-x snap-mandatory relative z-10 px-1">
              <AnimatePresence>
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
                      initial={{ opacity: 0, x: 25 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: Math.min(0.3, idx * 0.04), duration: 0.3 }}
                      className={cn(
                        "relative flex flex-col items-center justify-between w-[210px] shrink-0 p-5 rounded-[2rem] border transition-all duration-300 snap-start bg-[#121212] overflow-hidden",
                        isUnlocked
                          ? "border-white/5 shadow-[0_10px_25px_rgba(0,0,0,0.3)]"
                          : "opacity-60 border-white/2 bg-[#0e0e0e]",
                        isNext && "border-amber-500/20 bg-amber-500/2",
                        tier.is_premium && "border-amber-500/10",
                      )}
                    >
                      {/* Level Node Indicator (Top) */}
                      <div className="flex flex-col items-center gap-1 z-10">
                        <div
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center font-black border transition-all",
                            isUnlocked
                              ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                              : "bg-white/3 border-white/5 text-gray-500",
                          )}
                        >
                          <span className="text-[10px] font-extrabold leading-none">{tier.level_number}</span>
                        </div>
                        <div className="text-[8px] font-black uppercase tracking-wider text-gray-500">
                          {tier.xp_required} XP
                        </div>
                      </div>

                      {/* Reward Block (Center) */}
                      <div className="my-5 flex flex-col items-center text-center space-y-3 z-10">
                        <div
                          className={cn(
                            "w-16 h-16 rounded-[2rem] flex items-center justify-center shadow-md border transition-all bg-black/30",
                            isUnlocked
                              ? tier.is_premium
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                : "bg-white/5 border-white/15 text-white/90"
                              : "border-white/5 text-gray-700",
                          )}
                        >
                          {isUnlocked ? (
                            <Gift className="w-6 h-6" />
                          ) : (
                            <Lock className="w-6 h-6 text-gray-600" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <h4 className="font-black uppercase tracking-wider text-[11px] line-clamp-1 px-1 text-white/95">
                            {tier.reward_name}
                          </h4>
                          {tier.is_premium ? (
                            <span className="inline-block px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-[7px] font-black text-amber-400 uppercase tracking-widest">
                              Premium
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-[7px] font-black text-gray-400 uppercase tracking-widest">
                              Free
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status / Claim Indicator (Bottom) */}
                      <div className="w-full pt-4 border-t border-white/5 flex items-center justify-center z-10">
                        {tier.is_premium && !progress.hasPremium ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/5 border border-amber-500/15 rounded-xl text-[8px] font-black uppercase tracking-wider text-amber-400">
                            <Lock className="w-2.5 h-2.5 text-amber-500/80" />
                            Premium
                          </div>
                        ) : isUnlocked ? (
                          isClaimed ? (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-[8px] font-black uppercase tracking-wider text-emerald-400">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                              Получено
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[8px] font-black uppercase tracking-wider text-amber-400 animate-pulse">
                              Готово
                            </div>
                          )
                        ) : (
                          <span className="text-[8px] font-black uppercase tracking-wider text-gray-600">
                            Закрыто
                          </span>
                        )}
                      </div>

                      {/* Matte Lock Overlay for Premium Closed Tiers */}
                      {tier.is_premium && !progress.hasPremium && (
                        <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] flex flex-col items-center justify-center p-4 text-center z-20 pointer-events-none">
                          <div className="bg-[#161616] border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xl">
                            <Lock className="w-3 h-3 text-amber-500/80" />
                            <span className="text-[8px] font-black uppercase tracking-wider text-amber-400">
                              Premium
                            </span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
