"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Lock,
  Unlock,
  Loader2,
  ChevronRight,
  Star,
} from "lucide-react";
import { motion } from "framer-motion";
import { BottomNav } from "../components/BottomNav";
import { PromoHeader } from "../components/PromoHeader";

export default function RoadmapPage() {
  const [player, setPlayer] = useState<any>(null);
  const [allLevels, setAllLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/promo/player");
        if (res.status === 401) {
          router.push("/promo");
          return;
        }
        const data = await res.json();
        setPlayer(data.player);
        setAllLevels(data.allLevels || []);
      } catch (err) {
        console.error("Failed to fetch player data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  const currentLevel = player?.level?.currentLevel || 1;
  const progressXp = player?.level?.progressXp || 0;
  const targetXp = player?.level?.targetXp || 1;
  const percent = Math.min(100, Math.max(0, (progressXp / targetXp) * 100));

  // Dynamic roadmap mapped from allLevels
  const roadmapLevels = allLevels.map((l) => ({
    level: l.level,
    title: `Уровень ${l.level}`,
    desc: `Достигните ${l.xp_required} XP, чтобы открыть новые призы в играх.`,
    unlocked: currentLevel >= l.level,
  }));

  // If there are no levels from the API, use a fallback
  if (roadmapLevels.length === 0) {
    roadmapLevels.push({
      level: 1,
      title: "Новичок",
      desc: "Начинайте играть и выигрывать!",
      unlocked: true,
    });
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      <PromoHeader title="Твой путь" />

      <main className="max-w-3xl mx-auto p-6 pt-10 pb-32 space-y-12">
        {/* Current Status */}
        <section className="bg-orange-500/10 border border-orange-500/20 rounded-[2.5rem] p-8 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-500 rounded-3xl shadow-xl shadow-orange-500/20 mb-6 transform -rotate-6">
              <span className="text-4xl font-black text-white">
                {currentLevel}
              </span>
            </div>
            <h2 className="text-3xl font-black uppercase italic tracking-tight mb-2">
              Уровень {currentLevel}
            </h2>
            <p className="text-orange-200/80 font-medium mb-8 max-w-md mx-auto">
              Покупай товары в баре и выполняй квесты, чтобы зарабатывать XP и
              открывать крутые призы!
            </p>

            <div className="max-w-md mx-auto space-y-2 text-left">
              <div className="flex justify-between text-xs font-black uppercase tracking-widest text-orange-400">
                <span>
                  {player?.level?.isMaxLevel
                    ? "Максимальный уровень"
                    : `Прогресс до ${currentLevel + 1} уровня`}
                </span>
                <span>
                  {player?.level?.isMaxLevel
                    ? `${Math.floor(player?.level?.totalXp || 0)} XP`
                    : `${Math.floor(progressXp)} / ${targetXp} XP`}
                </span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden p-0.5">
                <div
                  className="bg-orange-500 h-full rounded-full transition-all duration-1000 relative"
                  style={{
                    width: `${player?.level?.isMaxLevel ? 100 : percent}%`,
                  }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap Timeline */}
        <section className="space-y-6">
          <h3 className="text-xl font-black uppercase tracking-widest text-white/40 px-4">
            Дорожная карта призов
          </h3>

          <div className="relative border-l-2 border-white/10 ml-6 sm:ml-10 space-y-10 pb-10">
            {roadmapLevels.map((level, i) => (
              <motion.div
                key={level.level}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="relative pl-8 sm:pl-12"
              >
                {/* Node */}
                <div
                  className={`absolute -left-[17px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-4 border-[#0a0a0a] flex items-center justify-center ${level.unlocked ? "bg-orange-500" : "bg-white/10"}`}
                >
                  {level.unlocked ? (
                    <Star className="w-3 h-3 text-white" />
                  ) : (
                    <Lock className="w-3 h-3 text-gray-500" />
                  )}
                </div>

                <div
                  className={`bg-white/5 border border-white/10 rounded-3xl p-6 ${!level.unlocked ? "opacity-60 grayscale" : "hover:border-orange-500/30 transition-colors"}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span
                          className={`text-sm font-black uppercase tracking-widest ${level.unlocked ? "text-orange-500" : "text-gray-500"}`}
                        >
                          LVL {level.level}
                        </span>
                        <h4 className="text-lg font-black italic tracking-tight">
                          {level.title}
                        </h4>
                      </div>
                      <p className="text-gray-400 text-sm">{level.desc}</p>
                    </div>
                    {level.unlocked && (
                      <div className="hidden sm:flex w-10 h-10 bg-orange-500/10 rounded-xl items-center justify-center">
                        <Unlock className="w-5 h-5 text-orange-500" />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Future Fade */}
            <div className="absolute bottom-0 -left-0.5 w-1 h-32 bg-linear-to-b from-white/10 to-transparent" />
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
