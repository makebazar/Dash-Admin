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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "../components/BottomNav";
import { PromoHeader } from "../components/PromoHeader";

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

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={quest.id}
                  className={`bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden ${isCompleted || isLocked ? "opacity-60" : ""}`}
                >
                  {isLocked && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10 flex items-center justify-center">
                      <div className="bg-zinc-900/90 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl">
                        <Lock className="w-5 h-5 text-orange-500" />
                        <span className="font-black uppercase italic tracking-tight text-sm">
                          Нужен {quest.min_level} уровень
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row gap-6">
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

                        {!isCompleted &&
                          !isPending &&
                          quest.trigger_type !== "manual_verification" && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                                <span>Прогресс</span>
                                <span>
                                  {Math.floor(progress)} / {Math.floor(target)}
                                </span>
                              </div>
                              <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${isCompleted ? "bg-emerald-500" : "bg-orange-500"}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          )}

                        {isPending && (
                          <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-2xl text-[10px] font-bold text-yellow-500 uppercase tracking-widest text-center">
                            На проверке администратором
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row sm:flex-col gap-3 justify-center min-w-30">
                        {quest.reward_xp > 0 && (
                          <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-xl flex items-center justify-center gap-2">
                            <span className="font-black text-orange-500">
                              +{Math.floor(quest.reward_xp)} XP
                            </span>
                          </div>
                        )}
                        {quest.reward_tickets > 0 && (
                          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl flex items-center justify-center gap-2">
                            <span className="font-black text-white">
                              +{Math.floor(quest.reward_tickets)}
                            </span>
                            <Ticket className="w-4 h-4 text-orange-500" />
                          </div>
                        )}
                        {quest.reward_bonus_balance > 0 && (
                          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl flex items-center justify-center gap-2">
                            <span className="font-black text-yellow-500">
                              +{Math.floor(quest.reward_bonus_balance)} ₽
                            </span>
                            <Coins className="w-4 h-4 text-yellow-500" />
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

                          {!quest.requires_photo_verification &&
                            quest.action_button_url && (
                              <button
                                onClick={() => handleVerify(quest.id)}
                                className="w-full bg-orange-500/10 border border-orange-500/20 text-orange-500 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all"
                              >
                                Я выполнил задание
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
