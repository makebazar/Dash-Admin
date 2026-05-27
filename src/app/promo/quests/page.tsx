"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Target,
  Coins,
  Ticket,
  Loader2,
  CheckCircle2,
  Clock,
  Calendar,
  ExternalLink,
  Trash2,
  Lock,
  Zap,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "../components/BottomNav";
import { PromoHeader } from "../components/PromoHeader";
import { cn } from "@/lib/utils";

// Helper to calculate time until next reset for recurring quests
function getResetTimeText(quest: any) {
  if (quest.reset_period && quest.reset_period !== "none" && quest.period_start) {
    const periodStart = new Date(quest.period_start);
    const now = new Date();
    let nextResetDate = new Date(periodStart);

    if (quest.reset_period === "daily") {
      nextResetDate.setDate(nextResetDate.getDate() + 1);
      nextResetDate.setHours(0, 0, 0, 0);
    } else if (quest.reset_period === "hours" && quest.reset_hours) {
      nextResetDate.setHours(nextResetDate.getHours() + quest.reset_hours);
    } else if (quest.reset_period === "weekly") {
      nextResetDate.setDate(nextResetDate.getDate() + 7);
    } else if (quest.reset_period === "monthly") {
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);
    }

    const diff = nextResetDate.getTime() - now.getTime();
    if (diff > 0) {
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `Сброс через ${h}ч ${m}м`;
    }
  }
  return null;
}

export default function QuestsPage() {
  const [quests, setQuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [seatNumbers, setSeatNumbers] = useState<Record<string, string>>({});
  const router = useRouter();

  async function fetchQuests() {
    try {
      const res = await fetch("/api/promo/player/quests");
      if (res.status === 401) {
        router.push("/promo");
        return;
      }
      const data = await res.json();
      setQuests(data.quests || []);
    } catch (err) {
      console.error("Failed to fetch quests", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQuests();
  }, [router]);

  const handleFileUpload = async (questId: string, file: File) => {
    if (quests.find((q) => q.id === questId)?.requires_seat_number && !seatNumbers[questId]?.trim()) {
      alert("Пожалуйста, укажите номер места/ПК");
      return;
    }
    setUploading(questId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.url) {
        await handleVerify(questId, data.url);
      }
    } catch (e) {
      alert("Ошибка загрузки фото");
    } finally {
      setUploading(null);
    }
  };

  const handleVerify = async (questId: string, photoUrl?: string) => {
    try {
      const seatNumber = seatNumbers[questId] || "";
      const res = await fetch("/api/promo/player/quests/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId, photoUrl, seatNumber }),
      });
      if (res.ok) {
        fetchQuests();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Filter quests into three neat lists
  const activeQuests = quests.filter(
    (q) => q.status !== "completed" && q.status !== "claimed" && q.status !== "pending_verification"
  );
  const pendingQuests = quests.filter((q) => q.status === "pending_verification");
  const completedQuests = quests.filter((q) => q.status === "completed" || q.status === "claimed");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      <PromoHeader title="Задания" />

      <main className="max-w-4xl mx-auto p-6 pt-10 pb-32">
        <div className="mb-10">
          <h2 className="text-2xl font-black uppercase italic tracking-tight mb-2">
            Выполняй и <span className="text-orange-500">Зарабатывай</span>
          </h2>
          <p className="text-gray-400 text-sm font-medium">
            Покупай в баре или выполняй активности в клубе, чтобы получать
            бонусы и опыт.
          </p>
        </div>

        {quests.length === 0 ? (
          <div className="text-center py-20 bg-white/5 border border-white/10 border-dashed rounded-[2.5rem]">
            <p className="text-gray-500 font-medium italic">
              Сейчас нет доступных заданий.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* 1. ACTIVE QUESTS - Horizontal Scroll */}
            {activeQuests.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500">
                    Активные задания
                  </h3>
                  <div className="h-px flex-1 bg-white/5 mx-4" />
                </div>

                <div className="flex gap-4 overflow-x-auto pb-6 -mx-6 px-6 snap-x no-scrollbar">
                  {activeQuests.map((quest) => {
                    const progress = quest.current_progress || 0;
                    const target = quest.target_value || 1;
                    const percent = Math.min(100, Math.max(0, (progress / target) * 100));
                    const isLocked = quest.is_level_locked;
                    const resetText = getResetTimeText(quest);

                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={quest.id}
                        className={cn(
                          "flex-shrink-0 w-[85vw] sm:w-[320px] bg-white/5 border border-white/10 rounded-[2.5rem] p-6 snap-center relative overflow-hidden flex flex-col justify-between",
                          isLocked && "grayscale-[0.5] brightness-75"
                        )}
                      >
                        {isLocked && (
                          <div className="absolute top-4 right-4 z-20">
                            <div className="bg-zinc-900/90 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-2xl backdrop-blur-md">
                              <Lock className="w-3 h-3 text-orange-500" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-orange-500">
                                Ур. {quest.min_level}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="space-y-4">
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <h3 className="text-lg font-black uppercase italic tracking-tight leading-tight">
                                {quest.title}
                              </h3>
                              {resetText && (
                                <div className="bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-lg inline-flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 text-orange-500 animate-pulse" />
                                  <span className="text-[8px] font-black text-orange-500 uppercase tracking-wider">
                                    {resetText}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              {quest.reward_xp > 0 && (
                                <div className="bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg">
                                  <span className="text-[10px] font-black text-orange-500">
                                    +{Math.floor(quest.reward_xp)}XP
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <p className="text-gray-400 text-xs font-medium line-clamp-2">
                            {quest.description}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {quest.reward_tickets > 0 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg">
                                <Ticket className="w-3 h-3 text-orange-500" />
                                <span className="text-[10px] font-black">
                                  +{Math.floor(quest.reward_tickets)}
                                </span>
                              </div>
                            )}
                            {quest.reward_bonus_balance > 0 && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg">
                                <Coins className="w-3 h-3 text-yellow-500" />
                                <span className="text-[10px] font-black text-yellow-500">
                                  +{Math.floor(quest.reward_bonus_balance)}₽
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-8 space-y-3">
                          {isLocked ? (
                            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest text-center italic">
                              Заблокировано
                            </div>
                          ) : (
                            <>
                              {quest.trigger_type !== "manual_verification" && (
                                <>
                                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">
                                    <span>Прогресс</span>
                                    <span className="text-white/80">
                                      {Math.floor(progress)}/{Math.floor(target)}
                                    </span>
                                  </div>
                                  <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden border border-white/5">
                                    <div
                                      className="h-full rounded-full transition-all duration-500 ease-out bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </>
                              )}

                              {quest.trigger_type === "manual_verification" ? (
                                <div className="space-y-3 pt-2 border-t border-white/5">
                                  {quest.requires_seat_number && (
                                    <div className="space-y-1.5 mb-2">
                                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 block px-1">
                                        Номер вашего ПК/места
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="Например: ПК 15"
                                        value={seatNumbers[quest.id] || ""}
                                        onChange={(e) =>
                                          setSeatNumbers((prev) => ({
                                            ...prev,
                                            [quest.id]: e.target.value,
                                          }))
                                        }
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all placeholder:text-gray-600"
                                      />
                                    </div>
                                  )}

                                  {quest.action_button_text && (
                                    <a
                                      href={quest.action_button_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center gap-2 w-full bg-white text-black py-2.5 rounded-xl text-[10px] font-black uppercase italic tracking-tight hover:bg-orange-500 hover:text-white transition-all group"
                                    >
                                      {quest.action_button_text}
                                      <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                                    </a>
                                  )}

                                  {quest.requires_photo_verification ? (
                                    <div className="relative">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleFileUpload(quest.id, file);
                                        }}
                                        disabled={uploading === quest.id || (quest.requires_seat_number && !seatNumbers[quest.id]?.trim())}
                                      />
                                      <div className={cn(
                                        "border border-dashed border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors",
                                        (quest.requires_seat_number && !seatNumbers[quest.id]?.trim()) && "opacity-40 cursor-not-allowed"
                                      )}>
                                        {uploading === quest.id ? (
                                          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                                        ) : (
                                          <>
                                            <Camera className="w-5 h-5 text-gray-500" />
                                            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">
                                              Прикрепите фото
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleVerify(quest.id)}
                                      disabled={quest.requires_seat_number && !seatNumbers[quest.id]?.trim()}
                                      className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-orange-500 text-white py-3 rounded-xl font-black uppercase italic tracking-tight text-xs shadow-lg shadow-orange-500/20 transition-all"
                                    >
                                      Я выполнил
                                    </button>
                                  )}
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 2. PENDING VERIFICATION QUESTS - Vertical List */}
            {pendingQuests.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-yellow-500">
                    Ожидают подтверждения
                  </h3>
                  <div className="h-px flex-1 bg-yellow-500/10 mx-4" />
                </div>

                <div className="grid gap-3">
                  {pendingQuests.map((quest) => {
                    const resetText = getResetTimeText(quest);
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={quest.id}
                        className="bg-yellow-500/5 border border-yellow-500/10 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                            <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <h4 className="text-sm font-black uppercase italic tracking-tight truncate text-yellow-500/90">
                              {quest.title}
                            </h4>
                            <p className="text-[10px] text-gray-400 font-medium">
                              Отправлено на проверку администратору
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          {resetText && (
                            <span className="text-[9px] font-black text-orange-500 uppercase tracking-wider bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg">
                              {resetText}
                            </span>
                          )}
                          <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl italic">
                            На проверке
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 3. COMPLETED QUESTS - Vertical List */}
            {completedQuests.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500">
                    Выполнено
                  </h3>
                  <div className="h-px flex-1 bg-white/5 mx-4" />
                </div>

                <div className="grid gap-3">
                  {completedQuests.map((quest) => {
                    const resetText = getResetTimeText(quest);
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={quest.id}
                        className="bg-white/2 border border-white/5 rounded-3xl p-4 flex items-center justify-between gap-4 group hover:bg-white/5 transition-all"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-black uppercase italic tracking-tight truncate group-hover:text-emerald-400 transition-colors">
                              {quest.title}
                            </h4>
                            {resetText && (
                              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-0.5 animate-pulse">
                                {resetText}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {quest.reward_xp > 0 && (
                            <div className="bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5 text-orange-500" />
                              <span className="text-[9px] font-black text-orange-500">
                                +{Math.floor(quest.reward_xp)}
                              </span>
                            </div>
                          )}
                          {quest.reward_tickets > 0 && (
                            <div className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Ticket className="w-2.5 h-2.5 text-gray-500" />
                              <span className="text-[9px] font-black">
                                +{Math.floor(quest.reward_tickets)}
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
      <BottomNav />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
