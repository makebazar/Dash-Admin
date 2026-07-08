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
  ExternalLink,
  Lock,
  Zap,
  Camera,
  X,
  Info,
  ChevronRight,
  Trophy,
  Eye,
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
  const [selectedQuest, setSelectedQuest] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "available" | "pending" | "locked" | "history">("all");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const router = useRouter();

  async function fetchQuests() {
    try {
      const res = await fetch("/api/promo/player/quests");
      if (res.status === 401) {
        router.push("/promo/login");
        return;
      }
      const data = await res.json();
      const loadedQuests = data.quests || [];
      setQuests(loadedQuests);
      
      // Update selectedQuest if it is open to keep data fresh
      if (selectedQuest) {
        const updated = loadedQuests.find((q: any) => q.id === selectedQuest.id);
        if (updated) {
          setSelectedQuest(updated);
        }
      }
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
    const quest = quests.find((q) => q.id === questId);
    if (quest?.requires_seat_number && !seatNumbers[questId]?.trim()) {
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
        await fetchQuests();
        setSelectedQuest(null);
        window.dispatchEvent(new CustomEvent("promo-player-updated"));
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

  // 1. Выполняются (Active - in progress: not locked, not pending, not completed/claimed, progress > 0, and not manual verification)
  const inProgressQuests = quests.filter(
    (q) => q.status !== "completed" && q.status !== "claimed" && q.status !== "pending_verification" && !q.is_level_locked && (q.current_progress || 0) > 0 && q.trigger_type !== "manual_verification"
  );

  // 2. Доступные (Available - ready to start: not locked, not pending, not completed/claimed, and progress === 0 OR manual verification)
  const availableQuests = quests.filter(
    (q) => q.status !== "completed" && q.status !== "claimed" && q.status !== "pending_verification" && !q.is_level_locked && ((q.current_progress || 0) === 0 || q.trigger_type === "manual_verification")
  );

  // 3. На проверке (Pending verification)
  const pendingQuests = quests.filter((q) => q.status === "pending_verification");

  // 4. Будут доступны (Locked by level)
  const lockedQuests = quests.filter(
    (q) => q.status !== "completed" && q.status !== "claimed" && q.status !== "pending_verification" && q.is_level_locked
  );

  // 5. История (Completed / Claimed history)
  const completedQuests = quests.filter((q) => q.status === "completed" || q.status === "claimed");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30 overflow-x-hidden">
      <PromoHeader title="Задания" />

      <main className="max-w-6xl mx-auto p-4 sm:p-6 pt-6 sm:pt-10 pb-32">
        {/* Banner header */}
        <div className="mb-8 relative rounded-[2rem] bg-gradient-to-br from-orange-600/10 via-zinc-900 to-zinc-950 border border-white/5 p-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[80px] -z-10 pointer-events-none" />
          <div className="max-w-lg space-y-2 relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight leading-none">
              Выполняй и <span className="text-orange-500">Зарабатывай</span>
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm font-medium leading-relaxed">
              Покупай в баре, пользуйся услугами или выполняй активности в клубе, чтобы получать бонусы на баланс, билеты и опыт.
            </p>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: "all", label: "Все задания", count: quests.length },
            { id: "active", label: "Выполняются", count: inProgressQuests.length },
            { id: "available", label: "Доступные", count: availableQuests.length },
            { id: "pending", label: "На проверке", count: pendingQuests.length },
            { id: "locked", label: "Будут доступны", count: lockedQuests.length },
            { id: "history", label: "История", count: completedQuests.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border shrink-0",
                activeTab === tab.id
                  ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              {tab.label}
              <span className={cn(
                "px-1.5 py-0.5 rounded-md text-[9px] font-black",
                activeTab === tab.id ? "bg-white text-orange-600" : "bg-white/10 text-gray-300"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {quests.length === 0 ? (
          <div className="text-center py-20 bg-white/2 border border-white/5 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mb-4 animate-pulse">
              <Target className="w-8 h-8" />
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-1">
              Нет доступных заданий
            </p>
            <p className="text-gray-500 text-xs max-w-xs leading-relaxed font-medium">
              Сейчас администрация клуба не добавила активных квестов. Загляните позже!
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* 1. ACTIVE QUESTS SECTION (Выполняются) */}
            {(activeTab === "all" || activeTab === "active") && inProgressQuests.length > 0 && (
              <section className="space-y-5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                      Выполняются ({inProgressQuests.length})
                    </h3>
                  </div>
                  <div className="h-px flex-1 bg-white/5 mx-4" />
                </div>

                {/* Grid on desktop, horizontal carousel on mobile */}
                <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inProgressQuests.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      onClick={() => setSelectedQuest(quest)}
                    />
                  ))}
                </div>

                <div className="flex sm:hidden gap-4 overflow-x-auto pb-6 -mx-4 px-4 snap-x no-scrollbar">
                  {inProgressQuests.map((quest) => (
                    <div key={quest.id} className="w-[85vw] shrink-0 snap-center">
                      <QuestCard
                        quest={quest}
                        onClick={() => setSelectedQuest(quest)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 2. AVAILABLE QUESTS SECTION (Доступные) */}
            {(activeTab === "all" || activeTab === "available") && availableQuests.length > 0 && (
              <section className="space-y-5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                      Доступные задания ({availableQuests.length})
                    </h3>
                  </div>
                  <div className="h-px flex-1 bg-white/5 mx-4" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {availableQuests.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      onClick={() => setSelectedQuest(quest)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 3. PENDING QUESTS SECTION (На проверке) */}
            {(activeTab === "all" || activeTab === "pending") && pendingQuests.length > 0 && (
              <section className="space-y-5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-yellow-500">
                      Ожидают подтверждения ({pendingQuests.length})
                    </h3>
                  </div>
                  <div className="h-px flex-1 bg-yellow-500/10 mx-4" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pendingQuests.map((quest) => (
                    <PendingQuestCard
                      key={quest.id}
                      quest={quest}
                      onImageClick={(url) => setFullscreenImage(url)}
                      onClick={() => setSelectedQuest(quest)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 4. LOCKED QUESTS SECTION (Будут доступны / Остальные) */}
            {(activeTab === "all" || activeTab === "locked") && lockedQuests.length > 0 && (
              <section className="space-y-5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">
                      Доступны на следующих уровнях ({lockedQuests.length})
                    </h3>
                  </div>
                  <div className="h-px flex-1 bg-white/5 mx-4" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {lockedQuests.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      onClick={() => setSelectedQuest(quest)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 5. COMPLETED QUESTS SECTION (История / Завершенные) */}
            {(activeTab === "all" || activeTab === "history") && completedQuests.length > 0 && (
              <section className="space-y-5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">
                      История выполненных ({completedQuests.length})
                    </h3>
                  </div>
                  <div className="h-px flex-1 bg-white/5 mx-4" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {completedQuests.map((quest) => (
                    <CompletedQuestCard
                      key={quest.id}
                      quest={quest}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Tab view empty states */}
            {activeTab === "active" && inProgressQuests.length === 0 && (
              <EmptyState message="Нет активных заданий в процессе выполнения" icon={<Target className="w-8 h-8 text-gray-500" />} />
            )}
            {activeTab === "available" && availableQuests.length === 0 && (
              <EmptyState message="Нет доступных для начала заданий" icon={<Target className="w-8 h-8 text-gray-500" />} />
            )}
            {activeTab === "pending" && pendingQuests.length === 0 && (
              <EmptyState message="Нет заданий, ожидающих проверки администратора" icon={<Clock className="w-8 h-8 text-gray-500" />} />
            )}
            {activeTab === "locked" && lockedQuests.length === 0 && (
              <EmptyState message="Нет заданий, закрытых уровнем" icon={<Lock className="w-8 h-8 text-gray-500" />} />
            )}
            {activeTab === "history" && completedQuests.length === 0 && (
              <EmptyState message="Вы еще не завершили ни одного задания" icon={<Trophy className="w-8 h-8 text-gray-500" />} />
            )}
          </div>
        )}
      </main>

      <BottomNav />

      {/* 5. QUEST DETAIL MODAL / DRAWER */}
      <AnimatePresence>
        {selectedQuest && (
          <QuestDetailModal
            quest={selectedQuest}
            seatNumber={seatNumbers[selectedQuest.id] || ""}
            onSeatNumberChange={(val) =>
              setSeatNumbers((prev) => ({ ...prev, [selectedQuest.id]: val }))
            }
            uploading={uploading === selectedQuest.id}
            onFileUpload={(file) => handleFileUpload(selectedQuest.id, file)}
            onVerify={() => handleVerify(selectedQuest.id)}
            onClose={() => setSelectedQuest(null)}
          />
        )}
      </AnimatePresence>

      {/* 6. FULLSCREEN IMAGE PREVIEW */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullscreenImage(null)}
            className="fixed inset-0 bg-black/95 z-[90] flex items-center justify-center p-4"
          >
            <button className="absolute top-6 right-6 p-3 bg-white/5 border border-white/10 rounded-full text-white hover:bg-white/10">
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={fullscreenImage}
              alt="Proof preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-white/10"
            />
          </motion.div>
        )}
      </AnimatePresence>

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

// ==========================================
// COMPONENT: QUEST CARD
// ==========================================
function QuestCard({ quest, onClick }: { quest: any; onClick: () => void }) {
  const isLocked = quest.is_level_locked;
  const progress = quest.current_progress || 0;
  const target = quest.target_value || 1;
  const percent = Math.min(100, Math.max(0, (progress / target) * 100));
  const resetText = getResetTimeText(quest);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!isLocked ? { y: -4, scale: 1.01 } : {}}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={cn(
        "relative rounded-[2.5rem] bg-zinc-950/80 border border-white/5 overflow-hidden flex flex-col justify-between cursor-pointer group select-none min-h-[300px]",
        isLocked ? "opacity-75 grayscale-[0.3]" : "hover:border-orange-500/30 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)] transition-all duration-300"
      )}
    >
      {/* Background card image or gradient header */}
      {quest.image_url ? (
        <div className="h-32 w-full relative overflow-hidden">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${quest.image_url})` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
        </div>
      ) : (
        <div className={cn(
          "h-24 w-full relative overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950",
          isLocked ? "from-zinc-950 to-zinc-950" : ""
        )}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl" />
        </div>
      )}

      {/* Level Lock Badge */}
      {isLocked && (
        <div className="absolute top-4 right-6 z-10">
          <div className="bg-zinc-900/90 border border-white/10 px-3 py-1.5 rounded-2xl flex items-center gap-1.5 shadow-2xl backdrop-blur-md">
            <Lock className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
              Ур. {quest.min_level}
            </span>
          </div>
        </div>
      )}

      {/* Content wrapper */}
      <div className="px-6 pb-6 pt-2 flex-1 flex flex-col justify-between relative -mt-8 z-10">
        <div className="space-y-3">
          {/* Reset time (daily/weekly etc) */}
          {resetText && (
            <div className="bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-lg inline-flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-orange-500 animate-pulse" />
              <span className="text-[8px] font-black text-orange-500 uppercase tracking-wider">
                {resetText}
              </span>
            </div>
          )}

          {/* Title and descriptions */}
          <div className="space-y-1">
            <h4 className="text-lg font-black uppercase italic tracking-tight leading-tight group-hover:text-orange-400 transition-colors">
              {quest.title}
            </h4>
            <p className="text-gray-400 text-xs leading-relaxed font-medium line-clamp-2">
              {quest.description}
            </p>
          </div>

          {/* Service Dependency Banner */}
          {quest.target_service_id && quest.required_service_name && (
            <div className={cn(
              "px-3 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 border",
              quest.is_service_purchased
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-orange-500/10 border-orange-500/20 text-orange-400"
            )}>
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {quest.is_service_purchased ? "Услуга куплена: " : "Требуется услуга: "}
                {quest.required_service_name}
              </span>
            </div>
          )}

          {/* Rewards Grid */}
          <div className="flex flex-wrap gap-2 pt-1">
            {quest.reward_xp > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-white/5 border border-white/10 rounded-xl">
                <Zap className="w-3 h-3 text-orange-500" />
                <span className="text-[10px] font-black">+{Math.floor(quest.reward_xp)} XP</span>
              </div>
            )}
            {quest.reward_tickets > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-white/5 border border-white/10 rounded-xl">
                <Ticket className="w-3 h-3 text-orange-500" />
                <span className="text-[10px] font-black">+{Math.floor(quest.reward_tickets)}</span>
              </div>
            )}
            {quest.reward_bonus_balance > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <Coins className="w-3 h-3 text-yellow-500" />
                <span className="text-[10px] font-black text-yellow-500">+{Math.floor(quest.reward_bonus_balance)}₽</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar or button CTA */}
        <div className="mt-6 pt-4 border-t border-white/5">
          {isLocked ? (
            <div className="bg-white/2 border border-white/5 p-3 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest text-center italic">
              Заблокировано
            </div>
          ) : (
            <div className="space-y-2.5">
              {quest.trigger_type !== "manual_verification" ? (
                <>
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">
                    <span>Прогресс</span>
                    <span className="text-white/80">
                      {Math.floor(progress)}/{Math.floor(target)} {quest.quest_unit || "шт."}
                    </span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 px-4 py-2.5 rounded-2xl group/btn transition-colors">
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                    {quest.requires_photo_verification ? "Требуется фотоотчет" : "Подтвердить выполнение"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-orange-500 group-hover/btn:translate-x-1 transition-transform" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// COMPONENT: PENDING QUEST CARD
// ==========================================
function PendingQuestCard({ quest, onImageClick, onClick }: { quest: any; onImageClick: (url: string) => void; onClick: () => void }) {
  const resetText = getResetTimeText(quest);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-yellow-500/5 border border-yellow-500/10 rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-4 cursor-pointer hover:bg-yellow-500/10 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
          <Clock className="w-6 h-6 text-yellow-500 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h4 className="text-base font-black uppercase italic tracking-tight truncate text-yellow-500/95">
            {quest.title}
          </h4>
          <p className="text-[10px] text-gray-400 font-medium leading-normal">
            Отправлено на проверку администратору. Мы начислим награду сразу после подтверждения.
          </p>

          {/* Submitted data info */}
          {quest.seat_number && (
            <div className="text-[10px] text-gray-400 font-bold bg-black/30 px-2.5 py-1 rounded-lg inline-block mt-2">
              Место: <span className="text-white">{quest.seat_number}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-yellow-500/10 mt-1">
        {/* Verification photo thumbnail */}
        {quest.verification_photo_url ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onImageClick(quest.verification_photo_url);
            }}
            className="flex items-center gap-1.5 group cursor-zoom-in"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0">
              <img
                src={quest.verification_photo_url}
                alt="Submitted proof"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
              />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white flex items-center gap-0.5">
              <Eye className="w-2.5 h-2.5" /> Посмотреть
            </span>
          </div>
        ) : (
          <div className="h-4" />
        )}

        <div className="flex items-center gap-2">
          {resetText && (
            <span className="text-[9px] font-black text-orange-500 uppercase tracking-wider bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg">
              {resetText}
            </span>
          )}
          <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl italic">
            На проверке
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// COMPONENT: COMPLETED QUEST CARD
// ==========================================
function CompletedQuestCard({ quest }: { quest: any }) {
  const resetText = getResetTimeText(quest);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-950/60 border border-white/5 rounded-3xl p-4 flex items-center justify-between gap-4 group hover:bg-white/2 transition-colors select-none"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5.5 h-5.5 text-emerald-500" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-black uppercase italic tracking-tight truncate text-gray-300 group-hover:text-emerald-400 transition-colors">
            {quest.title}
          </h4>
          {resetText ? (
            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-orange-500 animate-pulse" /> {resetText}
            </p>
          ) : (
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
              Задание завершено
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        {quest.reward_xp > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg flex items-center gap-0.5">
            <Zap className="w-2.5 h-2.5 text-orange-500" />
            <span className="text-[9px] font-black text-orange-500">
              +{Math.floor(quest.reward_xp)}
            </span>
          </div>
        )}
        {quest.reward_tickets > 0 && (
          <div className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg flex items-center gap-0.5">
            <Ticket className="w-2.5 h-2.5 text-gray-400" />
            <span className="text-[9px] font-black">
              +{Math.floor(quest.reward_tickets)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ==========================================
// COMPONENT: EMPTY STATE
// ==========================================
function EmptyState({ message, icon }: { message: string; icon: React.ReactNode }) {
  return (
    <div className="text-center py-14 bg-white/2 border border-white/5 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center p-6">
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mb-3">
        {icon}
      </div>
      <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
        {message}
      </p>
    </div>
  );
}

// ==========================================
// COMPONENT: QUEST DETAIL MODAL
// ==========================================
interface QuestDetailModalProps {
  quest: any;
  seatNumber: string;
  onSeatNumberChange: (val: string) => void;
  uploading: boolean;
  onFileUpload: (file: File) => void;
  onVerify: () => void;
  onClose: () => void;
}

function QuestDetailModal({
  quest,
  seatNumber,
  onSeatNumberChange,
  uploading,
  onFileUpload,
  onVerify,
  onClose,
}: QuestDetailModalProps) {
  const isLocked = quest.is_level_locked;
  const progress = quest.current_progress || 0;
  const target = quest.target_value || 1;
  const percent = Math.min(100, Math.max(0, (progress / target) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      {/* Backdrop closer */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />

      {/* Modal Card */}
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 200, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className="w-full sm:max-w-lg bg-zinc-950 border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh] sm:max-h-[85vh]"
      >
        {/* Header photo banner or gradient */}
        {quest.image_url ? (
          <div className="h-44 w-full relative overflow-hidden">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${quest.image_url})` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
          </div>
        ) : (
          <div className="h-32 w-full bg-gradient-to-br from-zinc-900 to-zinc-950 relative overflow-hidden flex items-end px-6">
            <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl" />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-white/10 border border-white/5 rounded-full text-white/70 hover:text-white transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal content */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 no-scrollbar">
          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2">
            {isLocked && (
              <span className="bg-orange-500/10 border border-orange-500/20 text-orange-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Уровень {quest.min_level}+
              </span>
            )}
            {quest.reset_period && quest.reset_period !== "none" && (
              <span className="bg-white/5 border border-white/10 text-gray-300 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> Повторяемый
              </span>
            )}
          </div>

          {/* Title & Description */}
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight leading-none">
              {quest.title}
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm font-medium leading-relaxed">
              {quest.description}
            </p>
          </div>

          {/* Service Dependency Banner */}
          {quest.target_service_id && quest.required_service_name && (
            <div className={cn(
              "px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-3 border",
              quest.is_service_purchased
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-orange-500/10 border-orange-500/20 text-orange-400"
            )}>
              <Info className="w-4 h-4 shrink-0" />
              <div>
                <div className="font-black text-[10px] uppercase tracking-wider mb-0.5">
                  {quest.is_service_purchased ? "Требование выполнено" : "Требуется покупка"}
                </div>
                <div className="opacity-90">{quest.required_service_name}</div>
              </div>
            </div>
          )}

          {/* Rewards Section */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Награды за выполнение
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {quest.reward_xp > 0 && (
                <div className="bg-orange-500/5 border border-orange-500/10 p-3.5 rounded-2xl flex flex-col justify-between h-20">
                  <Zap className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-black text-white">+{Math.floor(quest.reward_xp)} XP</span>
                </div>
              )}
              {quest.reward_tickets > 0 && (
                <div className="bg-white/2 border border-white/5 p-3.5 rounded-2xl flex flex-col justify-between h-20">
                  <Ticket className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-black text-white">+{Math.floor(quest.reward_tickets)} билетов</span>
                </div>
              )}
              {quest.reward_bonus_balance > 0 && (
                <div className="bg-yellow-500/5 border border-yellow-500/10 p-3.5 rounded-2xl flex flex-col justify-between h-20">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-black text-yellow-500">+{Math.floor(quest.reward_bonus_balance)}₽</span>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions / Progress */}
          <div className="pt-4 border-t border-white/5 space-y-4">
            {isLocked ? (
              <div className="bg-white/2 border border-white/5 p-4 rounded-2xl text-xs font-black text-gray-500 uppercase tracking-widest text-center italic">
                Необходимо прокачать уровень до {quest.min_level}
              </div>
            ) : (
              <>
                {/* Standard Progress quest */}
                {quest.trigger_type !== "manual_verification" && (
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">
                      <span>Прогресс задания</span>
                      <span className="text-white font-bold">
                        {Math.floor(progress)}/{Math.floor(target)} {quest.quest_unit || "шт."}
                      </span>
                    </div>
                    <div className="w-full bg-black/50 rounded-full h-3 overflow-hidden border border-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        className="h-full rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
                      />
                    </div>
                  </div>
                )}

                {/* Manual verification inputs */}
                {quest.trigger_type === "manual_verification" && (
                  <div className="space-y-4 pt-1">
                    {/* Seat number */}
                    {quest.requires_seat_number && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block px-1">
                          Номер вашего ПК / консоли / места
                        </label>
                        <input
                          type="text"
                          placeholder="Например: ПК 15, console 2"
                          value={seatNumber}
                          onChange={(e) => onSeatNumberChange(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all placeholder:text-gray-700"
                        />
                      </div>
                    )}

                    {/* External CTA link */}
                    {quest.action_button_text && (
                      <a
                        href={quest.action_button_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2.5 w-full bg-white text-black py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-orange-500 hover:text-white transition-all group"
                      >
                        {quest.action_button_text}
                        <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}

                    {/* Photo proof selection */}
                    {quest.requires_photo_verification ? (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block px-1">
                          Подтверждающая фотография
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) onFileUpload(file);
                            }}
                            disabled={uploading || (quest.requires_seat_number && !seatNumber.trim())}
                          />
                          <div className={cn(
                            "border border-dashed border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center gap-2.5 bg-white/3 hover:bg-white/5 transition-all",
                            (quest.requires_seat_number && !seatNumber.trim()) && "opacity-40 cursor-not-allowed"
                          )}>
                            {uploading ? (
                              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                            ) : (
                              <>
                                <Camera className="w-6 h-6 text-gray-500 group-hover:text-white transition-colors" />
                                <div className="text-center">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                                    Нажмите для выбора фото
                                  </span>
                                  <span className="text-[8px] font-medium text-gray-500 uppercase tracking-widest mt-0.5 block">
                                    PNG, JPG до 5MB
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={onVerify}
                        disabled={quest.requires_seat_number && !seatNumber.trim()}
                        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-orange-500 text-white py-4 rounded-2xl font-black uppercase italic tracking-wider text-sm shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
                      >
                        Я выполнил задание
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
