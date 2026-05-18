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
  ImagePlus,
  Camera,
  Trash2,
  Lock,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "../components/BottomNav";
import { PromoHeader } from "../components/PromoHeader";
import { cn } from "@/lib/utils";

const DAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export default function QuestsPage() {
  const [quests, setQuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
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
      const res = await fetch("/api/promo/player/quests/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId, photoUrl }),
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
          <div className="space-y-4">
            {quests.map((quest) => {
              const progress = quest.current_progress || 0;
              const target = quest.target_value || 1;
              const percent = Math.min(
                100,
                Math.max(0, (progress / target) * 100),
              );
              const isCompleted =
                quest.status === "completed" || quest.status === "claimed";
              const isPending = quest.status === "pending_verification";
              const isLocked = quest.is_level_locked;

              // Calculate time until next reset for recurring quests
              let nextResetText = null;
              if (
                isCompleted &&
                quest.reset_period !== "none" &&
                quest.period_start
              ) {
                const periodStart = new Date(quest.period_start);
                const now = new Date();
                let nextResetDate = new Date(periodStart);

                if (quest.reset_period === "daily") {
                  nextResetDate.setDate(nextResetDate.getDate() + 1);
                  nextResetDate.setHours(0, 0, 0, 0);
                } else if (
                  quest.reset_period === "hours" &&
                  quest.reset_hours
                ) {
                  nextResetDate.setHours(
                    nextResetDate.getHours() + quest.reset_hours,
                  );
                } else if (quest.reset_period === "weekly") {
                  nextResetDate.setDate(nextResetDate.getDate() + 7);
                } else if (quest.reset_period === "monthly") {
                  nextResetDate.setMonth(nextResetDate.getMonth() + 1);
                }

                const diff = nextResetDate.getTime() - now.getTime();
                if (diff > 0) {
                  const h = Math.floor(diff / (1000 * 60 * 60));
                  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                  nextResetText = `Доступно через ${h}ч ${m}м`;
                }
              }

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={quest.id}
                  className={`bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden ${isCompleted || isLocked ? "opacity-60" : ""}`}
                >
                  {(isLocked || nextResetText) && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10 flex items-center justify-center">
                      <div className="bg-zinc-900/90 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl">
                        {isLocked ? (
                          <>
                            <Lock className="w-5 h-5 text-orange-500" />
                            <span className="font-black uppercase italic tracking-tight text-sm">
                              Нужен {quest.min_level} уровень
                            </span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-5 h-5 text-orange-500" />
                            <span className="font-black uppercase italic tracking-tight text-sm">
                              {nextResetText}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row gap-6">
                      {quest.image_url && (
                        <div className="w-full sm:w-24 h-48 sm:h-24 rounded-[2rem] overflow-hidden border border-white/10 shrink-0">
                          <img
                            src={quest.image_url}
                            className="w-full h-full object-cover"
                            alt={quest.title}
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {isCompleted && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          )}
                          {isPending && (
                            <Clock className="w-5 h-5 text-yellow-500" />
                          )}
                          <h3 className="text-lg font-black uppercase italic tracking-tight">
                            {quest.title}
                          </h3>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">
                          {quest.description}
                        </p>

                        {quest.required_service_name && (
                          <div className="mb-4">
                            <div
                              className={cn(
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                quest.is_service_purchased
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                  : "bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse",
                              )}
                            >
                              <Zap className="w-3 h-3" />
                              {quest.is_service_purchased
                                ? `АКТИВИРОВАНО: ${quest.required_service_name}`
                                : `СНАЧАЛА КУПИ: ${quest.required_service_name}`}
                            </div>
                          </div>
                        )}

                        {(quest.available_days || quest.time_start) && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {quest.available_days && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-gray-400">
                                <Calendar className="w-3 h-3 text-orange-500" />
                                {quest.available_days.length === 7
                                  ? "Ежедневно"
                                  : quest.available_days
                                      .map((d: number) => DAYS_RU[d])
                                      .join(", ")}
                              </div>
                            )}
                            {quest.time_start && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-gray-400">
                                <Clock className="w-3 h-3 text-orange-500" />
                                {quest.time_start.slice(0, 5)} -{" "}
                                {quest.time_end?.slice(0, 5)}
                              </div>
                            )}
                          </div>
                        )}

                        {!isLocked &&
                          quest.trigger_type !== "manual_verification" && (
                            <div className="space-y-3">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                                <span className="flex items-center gap-2">
                                  {!isCompleted && !isPending && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                  )}
                                  {isCompleted
                                    ? "Завершено"
                                    : isPending
                                      ? "На проверке"
                                      : "Прогресс"}
                                </span>
                                <span className="text-white/80">
                                  {Math.floor(progress)} / {Math.floor(target)}{" "}
                                  {quest.quest_unit || "шт."}
                                </span>
                              </div>
                              <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-white/5">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500 ease-out",
                                    isCompleted
                                      ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                      : isPending
                                        ? "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                                        : "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]",
                                  )}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          )}

                        {isPending && (
                          <div className="space-y-3">
                            {quest.verification_photo_url && (
                              <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/10">
                                <img
                                  src={quest.verification_photo_url}
                                  className="w-full h-full object-cover"
                                  alt="Proof"
                                />
                              </div>
                            )}
                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-2xl text-[10px] font-bold text-yellow-500 uppercase tracking-widest text-center">
                              На проверке администратором
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row gap-2 w-full sm:w-auto">
                        {quest.reward_xp > 0 && (
                          <div className="flex-1 bg-orange-500/10 border border-orange-500/20 p-3 rounded-2xl flex flex-col items-center justify-center gap-1 min-w-17.5]">
                            <span className="text-base font-black text-orange-500 leading-none whitespace-nowrap">
                              +{Math.floor(quest.reward_xp)}
                            </span>
                            <span className="text-[7px] font-black text-orange-500/50 uppercase tracking-widest">
                              XP
                            </span>
                          </div>
                        )}
                        {quest.reward_tickets > 0 && (
                          <div className="flex-1 bg-white/5 border border-white/10 p-3 rounded-2xl flex flex-col items-center justify-center gap-1 min-w-17.5]">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="text-base font-black text-white leading-none">
                                +{Math.floor(quest.reward_tickets)}
                              </span>
                              <Ticket className="w-4 h-4 text-orange-500" />
                            </div>
                            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">
                              Билеты
                            </span>
                          </div>
                        )}
                        {quest.reward_bonus_balance > 0 && (
                          <div className="flex-1 bg-white/5 border border-white/10 p-3 rounded-2xl flex flex-col items-center justify-center gap-1 min-w-17.5]">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="text-base font-black text-yellow-500 leading-none">
                                +{Math.floor(quest.reward_bonus_balance)} ₽
                              </span>
                              <Coins className="w-4 h-4 text-yellow-500" />
                            </div>
                            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">
                              Бонусы
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Area for Manual Quests */}
                    {!isCompleted &&
                      !isPending &&
                      quest.trigger_type === "manual_verification" && (
                        <div className="border-t border-white/5 pt-6 space-y-4">
                          {quest.action_button_text && (
                            <a
                              href={quest.action_button_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full bg-white text-black py-4 rounded-2xl font-black uppercase italic tracking-tight hover:bg-orange-500 hover:text-white transition-all group"
                            >
                              {quest.action_button_text}
                              <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                            </a>
                          )}

                          {quest.requires_photo_verification && (
                            <div className="space-y-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">
                                Прикрепите скриншот для подтверждения
                              </p>
                              <div className="relative">
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(quest.id, file);
                                  }}
                                  disabled={uploading === quest.id}
                                />
                                <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center gap-3 bg-white/5 hover:bg-white/10 transition-colors">
                                  {uploading === quest.id ? (
                                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                                  ) : (
                                    <>
                                      <Camera className="w-8 h-8 text-gray-500" />
                                      <span className="text-xs font-bold text-gray-400">
                                        Нажмите, чтобы сделать фото или выбрать
                                        файл
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {!quest.requires_photo_verification && (
                            <button
                              onClick={() => handleVerify(quest.id)}
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black uppercase italic tracking-tight shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all"
                            >
                              Я ВЫПОЛНИЛ ЗАДАНИЕ
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
