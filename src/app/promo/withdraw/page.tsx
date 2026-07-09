"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Coins,
  Gamepad2,
  User,
  Wallet,
  ArrowRight,
  Loader2,
  History,
  Ticket,
  ShoppingCart,
  ChevronRight,
  Zap,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { PromoHeader } from "../components/PromoHeader";
import { BottomNav } from "../components/BottomNav";

/**
 * Resolves the effective amount threshold for a step, applying group override if available.
 */
const getStepThreshold = (step: any, limitGroupId?: string | null): number => {
  if (limitGroupId && step.group_amounts && step.group_amounts[limitGroupId] !== undefined) {
    return parseFloat(step.group_amounts[limitGroupId]) || 0;
  }
  return parseFloat(step.amount) || 0;
};

/**
 * Sorts steps by threshold ascending and finds the active step based on monthly topups.
 * Falls back to legacy t1/t2/t3 groups if no steps configured.
 */
const getActiveStepInfo = (
  monthlyTopups: number,
  settings: any,
  limitGroupId?: string | null,
  limitGroups?: any[]
): {
  percent: number;
  percentBp: number;
  steps: Array<{ threshold: number; percent: number; percentBp: number; isActive: boolean; isAchieved: boolean }>;
  nextTierAt: number | null;
  nextPercent: number | null;
} => {
  const rawSteps: any[] = settings?.withdraw_limit_steps || [];

  if (rawSteps.length > 0) {
    // Sort steps by threshold ascending
    const sorted = [...rawSteps]
      .map((s) => ({
        threshold: getStepThreshold(s, limitGroupId),
        percent: parseFloat(s.percent) || 0,
        percentBp: parseFloat(s.percent_bp) || parseFloat(s.percent) || 0,
      }))
      .sort((a, b) => a.threshold - b.threshold);

    // Find active step — the highest threshold that the player has crossed
    let activeIdx = -1;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (monthlyTopups >= sorted[i].threshold) {
        activeIdx = i;
        break;
      }
    }

    const activeStep = activeIdx >= 0 ? sorted[activeIdx] : null;
    const nextStep = activeIdx < sorted.length - 1 ? sorted[activeIdx + 1] : null;

    const stepsWithStatus = sorted.map((s, i) => ({
      ...s,
      isActive: i === activeIdx,
      isAchieved: i <= activeIdx,
    }));

    // If no step reached yet, use first step's percent as baseline or 0
    const basePercent = activeStep ? activeStep.percent : (sorted[0]?.percent || 0);
    const basePercentBp = activeStep ? activeStep.percentBp : (sorted[0]?.percentBp || 0);

    return {
      percent: activeStep ? activeStep.percent : 0,
      percentBp: activeStep ? activeStep.percentBp : 0,
      steps: stepsWithStatus,
      nextTierAt: nextStep ? nextStep.threshold : null,
      nextPercent: nextStep ? nextStep.percent : null,
    };
  }

  // Legacy fallback: t1/t2/t3 from group or defaults
  let t1 = 1000, t2 = 3000, t3 = 5000;
  const defaultPercent = parseFloat(settings?.withdraw_limit_percent) || 30;
  const defaultPercentBp = parseFloat(settings?.withdraw_limit_percent_bp) || 80;

  if (limitGroupId && Array.isArray(limitGroups)) {
    const group = limitGroups.find((g: any) => g.id === limitGroupId);
    if (group) {
      t1 = parseFloat(group.t1) || t1;
      t2 = parseFloat(group.t2) || t2;
      t3 = parseFloat(group.t3) || t3;
    }
  }

  const legacySteps = [
    { threshold: 0, percent: 30, percentBp: defaultPercentBp },
    { threshold: t1, percent: 50, percentBp: defaultPercentBp },
    { threshold: t2, percent: 70, percentBp: defaultPercentBp },
    { threshold: t3, percent: 90, percentBp: defaultPercentBp },
  ];

  let activeIdx = -1;
  for (let i = legacySteps.length - 1; i >= 0; i--) {
    if (monthlyTopups >= legacySteps[i].threshold) { activeIdx = i; break; }
  }

  const nextStep = activeIdx < legacySteps.length - 1 ? legacySteps[activeIdx + 1] : null;
  const stepsWithStatus = legacySteps.map((s, i) => ({
    ...s,
    isActive: i === activeIdx,
    isAchieved: i <= activeIdx,
  }));

  return {
    percent: activeIdx >= 0 ? legacySteps[activeIdx].percent : 30,
    percentBp: defaultPercentBp,
    steps: stepsWithStatus,
    nextTierAt: nextStep ? nextStep.threshold : null,
    nextPercent: nextStep ? nextStep.percent : null,
  };
};


export default function PromoWithdraw() {
  const [player, setPlayer] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const fetchData = async () => {
    try {
      const ts = Date.now();
      const [playerRes, historyRes] = await Promise.all([
        fetch(`/api/promo/player?t=${ts}`, { cache: "no-store" }),
        fetch(`/api/promo/player/bonus/history?t=${ts}`, { cache: "no-store" }),
      ]);

      if (playerRes.status === 401) {
        router.push("/promo");
        return;
      }

      const playerData = await playerRes.json();
      const historyData = await historyRes.json();

      setPlayer(playerData.player);
      setHistory(historyData.history || []);
    } catch (err) {
      console.error("Failed to fetch withdraw data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // SSE for real-time updates
    const eventSource = new EventSource(`/api/promo/player/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "update" || event.type === "update") {
          fetchData();
        }
      } catch (e) {}
    };

    eventSource.addEventListener("update", () => {
      fetchData();
    });

    return () => {
      eventSource.close();
    };
  }, [router]);
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);

    if (isNaN(amount) || amount <= 0) {
      setError("Введите корректную сумму");
      return;
    }

    if (amount > (player?.bonusBalance || 0)) {
      setError("Недостаточно бонусов на балансе");
      return;
    }

    const isLimitEnabled = player?.settings?.withdraw_limit_enabled === true;
    if (isLimitEnabled) {
      const monthlyTopups = player?.monthlyTopups || 0;
      const monthlyWithdrawn = player?.monthlyWithdrawn || 0;
      const extraLimit = parseFloat(player?.extraWithdrawLimit || 0);

      const { percent: basePercent, percentBp } = getActiveStepInfo(
        monthlyTopups, player?.settings, player?.limitGroupId, player?.settings?.limit_groups
      );
      const finalPercent = player?.hasPremiumBp ? Math.min(100, percentBp) : basePercent;
      const allowedLimit = (monthlyTopups * (finalPercent / 100)) + extraLimit;
      const remainingLimit = Math.max(0, allowedLimit - monthlyWithdrawn);

      if (amount > remainingLimit) {
        setError(`Превышен лимит вывода. Доступно для вывода: ${Math.floor(remainingLimit)} ₽. Пополните баланс для увеличения лимита.`);
        return;
      }
    }

    setIsClaiming(true);
    setError("");

    try {
      const res = await fetch("/api/promo/player/bonus/claim", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();

      if (data.success) {
        setWithdrawAmount("");
        await fetchData(); // Refresh balance and history
      } else {
        setError(data.error || "Ошибка при отправке запроса");
      }
    } catch (err) {
      setError("Ошибка соединения");
    } finally {
      setIsClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-yellow-500/30 overflow-x-hidden">
      <PromoHeader title="Вывод бонусов" />

      <main className="max-w-md lg:max-w-6xl mx-auto p-6 pb-32">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-8">
                    {player?.settings?.withdraw_limit_enabled === true && (() => {
          const monthlyTopups = player?.monthlyTopups || 0;
          const monthlyWithdrawn = player?.monthlyWithdrawn || 0;
          const extraLimit = parseFloat(player?.extraWithdrawLimit || 0);
          const limitGroups = player?.settings?.limit_groups;
          const activeGroup = player?.limitGroupId && Array.isArray(limitGroups)
            ? limitGroups.find((g: any) => g.id === player.limitGroupId)
            : null;

          const { percent: basePercent, percentBp, steps, nextTierAt, nextPercent } = getActiveStepInfo(
            monthlyTopups, player?.settings, player?.limitGroupId, limitGroups
          );
          const limitPercent = player?.hasPremiumBp ? Math.min(100, percentBp) : basePercent;
          const allowedLimit = (monthlyTopups * (limitPercent / 100)) + extraLimit;
          const remainingLimit = Math.max(0, allowedLimit - monthlyWithdrawn);
          const progressPercent = allowedLimit > 0 ? (monthlyTopups / allowedLimit) * 100 : 0;

          // Month reset date: first of next month
          const now = new Date();
          const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          const daysLeft = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const monthName = now.toLocaleString("ru-RU", { month: "long" });

          return (
            <div className="space-y-4 mb-8">

              {/* Group badge */}
              {activeGroup && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">
                      ✨ Группа: {activeGroup.name}
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                      Применены особые пороги для вашей группы
                    </div>
                  </div>
                </div>
              )}

              {/* Boost banner */}
              {player?.activeBoostPercent > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-yellow-500 uppercase tracking-wider">
                      Активен буст вывода: +{player.activeBoostPercent}%
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                      Буст применится к следующему пополнению
                    </div>
                  </div>
                </div>
              )}

              {/* Main limit card */}
              <div className="bg-[#151515] border border-white/5 rounded-[2.5rem] p-6 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-0.5">
                      Лимит вывода · {monthName}
                    </div>
                    <div className="text-[9px] text-gray-600 font-bold uppercase tracking-wider">
                      Сбрасывается {resetDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} · осталось {daysLeft} дн.
                    </div>
                  </div>
                  {player?.hasPremiumBp ? (
                    <span className="text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-xl border border-indigo-500/20">
                      {limitPercent}%
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-xl border border-yellow-500/20">
                      {limitPercent}%
                    </span>
                  )}
                </div>

                {/* Progress bar: topups toward allowed limit */}
                <div className="mb-5">
                  <div className="relative h-3 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (monthlyTopups / (allowedLimit > 0 ? allowedLimit : 1)) * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full"
                    />
                    {/* Withdrawn overlay */}
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (monthlyWithdrawn / (allowedLimit > 0 ? allowedLimit : 1)) * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                      className="absolute top-0 left-0 h-full bg-rose-500/60 rounded-full"
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[8px] font-bold text-gray-600 uppercase tracking-wider">0 ₽</span>
                    <span className="text-[8px] font-bold text-gray-600 uppercase tracking-wider">{Math.floor(allowedLimit)} ₽</span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-white/[0.03] rounded-2xl p-3 text-center">
                    <div className="text-[8px] font-black uppercase tracking-wider text-gray-500 mb-1">Пополнено</div>
                    <div className="text-sm font-black text-white">{Math.floor(monthlyTopups)} ₽</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-2xl p-3 text-center">
                    <div className="text-[8px] font-black uppercase tracking-wider text-gray-500 mb-1">Выведено</div>
                    <div className="text-sm font-black text-rose-400">{Math.floor(monthlyWithdrawn)} ₽</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-2xl p-3 text-center">
                    <div className="text-[8px] font-black uppercase tracking-wider text-gray-500 mb-1">Остаток</div>
                    <div className="text-sm font-black text-emerald-400">{Math.floor(remainingLimit)} ₽</div>
                  </div>
                </div>

                {extraLimit > 0 && (
                  <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-2xl p-3 mb-4 flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-wider text-yellow-500">⚡ Экстра-лимит от бустов</span>
                    <span className="text-sm font-black text-yellow-500">+{Math.floor(extraLimit)} ₽</span>
                  </div>
                )}

                {/* ── TIER TABLE ── */}
                {steps.length > 0 && (
                  <div className="border-t border-white/5 pt-4">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3">
                      Ступени лимита · сбрасываются каждый месяц
                    </div>
                    <div className="space-y-2">
                      {steps.map((step, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={cn(
                            "relative flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all",
                            step.isActive
                              ? "bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_12px_rgba(234,179,8,0.1)]"
                              : step.isAchieved
                                ? "bg-emerald-500/5 border-emerald-500/15"
                                : "bg-white/[0.02] border-white/5"
                          )}
                        >
                          {/* Step icon */}
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-black",
                            step.isActive
                              ? "bg-yellow-500 text-black"
                              : step.isAchieved
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-white/5 text-gray-600"
                          )}>
                            {step.isAchieved && !step.isActive ? "✓" : idx + 1}
                          </div>

                          {/* Threshold */}
                          <div className="flex-1 min-w-0">
                            <div className={cn(
                              "text-xs font-black uppercase",
                              step.isActive ? "text-yellow-400" : step.isAchieved ? "text-emerald-400" : "text-gray-500"
                            )}>
                              {step.threshold === 0 ? "Без пополнений" : `От ${step.threshold.toLocaleString("ru-RU")} ₽`}
                            </div>
                            <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mt-0.5">
                              пополнений в месяц
                            </div>
                          </div>

                          {/* Percents */}
                          <div className="text-right shrink-0">
                            <div className={cn(
                              "text-sm font-black",
                              step.isActive ? "text-yellow-400" : step.isAchieved ? "text-emerald-400" : "text-gray-600"
                            )}>
                              {step.percent}%
                            </div>
                            {step.percentBp !== step.percent && (
                              <div className="text-[9px] font-bold text-indigo-400/70">BP: {step.percentBp}%</div>
                            )}
                          </div>

                          {/* Active badge */}
                          {step.isActive && (
                            <div className="absolute -top-1.5 -right-1 bg-yellow-500 text-black text-[7px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                              ТЕКУЩИЙ
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    {/* Monthly reset info box */}
                    <div className="mt-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span>🔄</span> Как работают ступени
                      </div>
                      <div className="text-[8px] font-bold text-gray-600 leading-relaxed uppercase tracking-wider">
                        Ступень определяется суммой пополнений за текущий месяц. Чем больше пополнений — тем выше процент вывода.
                        В начале каждого месяца счётчик пополнений обнуляется, и вы начинаете с первой ступени.
                      </div>
                      {nextTierAt && (
                        <div className="text-[9px] font-black text-yellow-500 uppercase tracking-wider">
                          🚀 До следующей ступени: пополни ещё на {Math.max(0, nextTierAt - Math.floor(monthlyTopups)).toLocaleString("ru-RU")} ₽ → {nextPercent}%
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* BP upsell */}
                <div className="mt-4">
                  {player?.hasPremiumBp ? (
                    <div className="bg-indigo-500/[0.03] border border-indigo-500/10 rounded-2xl p-3 flex items-center gap-2">
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">🌟 Premium BP активен — повышенный лимит!</span>
                    </div>
                  ) : (
                    player?.settings?.bp_enabled !== false && (
                      <Link
                        href="/promo"
                        className="bg-gradient-to-r from-indigo-950/20 to-purple-950/20 border border-indigo-500/15 hover:border-indigo-500/30 transition-all rounded-2xl p-3 flex items-center justify-between group"
                      >
                        <div className="space-y-0.5">
                          <div className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">
                            ⚡ Получить Premium BP → лимит до {player?.settings?.withdraw_limit_percent_bp ?? 80}%
                          </div>
                          <div className="text-[8px] text-gray-500 font-medium uppercase tracking-wider">
                            Активируй Battle Pass для повышенного вывода!
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </Link>
                    )
                  )}
                </div>

                {/* Bar breakdown */}
                {(player?.monthlyBarReal > 0 || player?.monthlyBarBonus > 0) && (
                  <div className="border-t border-white/5 pt-3 mt-3 space-y-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                    {player?.monthlyBarReal > 0 && (
                      <div className="flex justify-between">
                        <span>Покупки в баре (рубли):</span>
                        <span className="text-white">+{Math.floor(player.monthlyBarReal)} ₽</span>
                      </div>
                    )}
                    {player?.monthlyBarBonus > 0 && (
                      <div className="flex justify-between">
                        <span>Покупки в баре (бонусы):</span>
                        <span className="text-rose-400">-{Math.floor(player.monthlyBarBonus)} 🪙</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-8">
            {/* Balance Card */}
        <div className="bg-[#151515] border border-white/5 rounded-[2.5rem] p-8 mb-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Coins className="w-24 h-24 text-yellow-500" />
          </div>
          <div className="relative z-10 flex flex-col gap-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center">
              <Coins className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">
                Доступно для перевода
              </div>
              <div className="text-5xl font-black text-white tracking-tighter">
                {Math.floor(player?.bonusBalance || 0)}
              </div>
            </div>
          </div>
        </div>

            {/* Withdraw Form */}
        <form onSubmit={handleWithdraw} className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
              Сумма перевода
            </h3>
            <div className="h-px w-full bg-white/5" />
          </div>

          <div className="relative mb-4">
            <input
              type="number"
              inputMode="numeric"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-black border border-white/10 rounded-2xl py-5 px-6 text-2xl font-black tracking-wider text-white focus:border-yellow-500/50 outline-none transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const isLimitEnabled = player?.settings?.withdraw_limit_enabled === true;
                  let maxAllowed = Math.floor(player?.bonusBalance || 0);
                  if (isLimitEnabled) {
                    const monthlyTopups = player?.monthlyTopups || 0;
                    const monthlyWithdrawn = player?.monthlyWithdrawn || 0;
                    const extraLimit = parseFloat(player?.extraWithdrawLimit || 0);

                    const { percent: basePercent, percentBp } = getActiveStepInfo(
                      monthlyTopups, player?.settings, player?.limitGroupId, player?.settings?.limit_groups
                    );
                    
                    const limitPercent = player?.hasPremiumBp ? Math.min(100, percentBp) : basePercent;
                    const allowedLimit = (monthlyTopups * (limitPercent / 100)) + extraLimit;
                    const remainingLimit = Math.max(0, allowedLimit - monthlyWithdrawn);
                    maxAllowed = Math.min(maxAllowed, Math.floor(remainingLimit));
                  }
                  setWithdrawAmount(String(maxAllowed));
                }}
                className="bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-yellow-500 px-3 py-2 rounded-xl transition-colors"
              >
                Всё
              </button>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            {[50, 100, 300, 500].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setWithdrawAmount(String(amount))}
                className="flex-none bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-4 py-2 text-xs font-black transition-colors"
              >
                +{amount}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center mb-6">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              isClaiming || !withdrawAmount || parseFloat(withdrawAmount) <= 0
            }
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_10px_20px_rgba(234,179,8,0.2)]"
          >
            {isClaiming ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                ПЕРЕВЕСТИ <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* History */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
              История
            </h3>
            <div className="h-px w-full bg-white/5" />
          </div>

          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-8 border border-white/5 rounded-3xl bg-white/5">
                <History className="w-8 h-8 text-gray-600 mx-auto mb-3 opacity-30" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Истории пока нет
                </p>
              </div>
            ) : (
              history.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[#151515] border border-white/5 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-black uppercase tracking-tight">
                          Перевод
                        </div>
                        <span
                          className={cn(
                            "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                            item.status === "claimed"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : item.status === "canceled"
                                ? "bg-red-500/10 text-red-500 border-red-500/20"
                                : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                          )}
                        >
                          {item.statusLabel}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-0.5">
                        {new Date(item.date).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-black text-yellow-500">
                    -{item.amount}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
