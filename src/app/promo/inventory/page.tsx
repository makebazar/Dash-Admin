"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Zap,
  Coins,
  Gift,
  Clock,
  Ticket,
  Check,
  Loader2,
  ChevronRight,
  Info,
  X,
  ArrowRight,
  Coffee,
  Sparkles,
} from "lucide-react";
import { PromoHeader } from "../components/PromoHeader";
import { BottomNav } from "../components/BottomNav";
import { cn } from "@/lib/utils";

const getStepThreshold = (step: any, limitGroupId?: string | null): number => {
  if (limitGroupId && step.group_amounts && step.group_amounts[limitGroupId] !== undefined) {
    return parseFloat(step.group_amounts[limitGroupId]) || 0;
  }
  return parseFloat(step.amount) || 0;
};

const getActiveStepInfo = (
  monthlyTopups: number,
  settings: any,
  limitGroupId?: string | null,
  limitGroups?: any[]
) => {
  const rawSteps: any[] = settings?.withdraw_limit_steps || [];

  if (rawSteps.length > 0) {
    const sorted = [...rawSteps]
      .map((s) => ({
        threshold: getStepThreshold(s, limitGroupId),
        percent: parseFloat(s.percent) || 0,
      }))
      .sort((a, b) => a.threshold - b.threshold);

    let activeIdx = -1;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (monthlyTopups >= sorted[i].threshold) {
        activeIdx = i;
        break;
      }
    }

    const activeStep = activeIdx >= 0 ? sorted[activeIdx] : null;
    const nextStep = activeIdx < sorted.length - 1 ? sorted[activeIdx + 1] : null;

    return {
      percent: activeStep ? activeStep.percent : (sorted[0]?.percent || 0),
      nextTierAt: nextStep ? nextStep.threshold : null,
      nextPercent: nextStep ? nextStep.percent : null,
    };
  }

  let t1 = 1000, t2 = 3000, t3 = 5000;
  if (limitGroupId && Array.isArray(limitGroups)) {
    const group = limitGroups.find((g: any) => g.id === limitGroupId);
    if (group) {
      t1 = parseFloat(group.t1) || t1;
      t2 = parseFloat(group.t2) || t2;
      t3 = parseFloat(group.t3) || t3;
    }
  }

  const legacySteps = [
    { threshold: 0, percent: 30 },
    { threshold: t1, percent: 50 },
    { threshold: t2, percent: 70 },
    { threshold: t3, percent: 90 },
  ];

  let activeIdx = -1;
  for (let i = legacySteps.length - 1; i >= 0; i--) {
    if (monthlyTopups >= legacySteps[i].threshold) {
      activeIdx = i;
      break;
    }
  }

  const nextStep = activeIdx < legacySteps.length - 1 ? legacySteps[activeIdx + 1] : null;

  return {
    percent: activeIdx >= 0 ? legacySteps[activeIdx].percent : 30,
    nextTierAt: nextStep ? nextStep.threshold : null,
    nextPercent: nextStep ? nextStep.percent : null,
  };
};

export default function PromoInventoryPage() {
  const [player, setPlayer] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "available" | "claimed">("available");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [showBoostInfo, setShowBoostInfo] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [playerRes, invRes] = await Promise.all([
        fetch("/api/promo/player"),
        fetch("/api/promo/inventory"),
      ]);

      if (playerRes.ok) {
        const pData = await playerRes.json();
        setPlayer(pData.player || null);
      }

      if (invRes.ok) {
        const iData = await invRes.json();
        setInventory(iData.inventory || []);
      }
    } catch (err) {
      console.error("Failed to fetch inventory data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUseItem = async (item: any) => {
    try {
      setActivatingId(item.id);
      const res = await fetch("/api/promo/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId: item.id }),
      });

      if (res.ok) {
        if (item.reward_type === "withdraw_boost") {
          setActionSuccessMsg(`Буст +${item.reward_value}% успешно активирован!`);
        } else if (item.reward_type === "bonus_limitless" || item.reward_type === "bonus_standard") {
          setActionSuccessMsg(`Бонусы (${item.reward_value} 🪙) успешно зачислены!`);
        } else {
          setActionSuccessMsg("Предмет активирован!");
        }

        setTimeout(() => setActionSuccessMsg(null), 4000);
        await fetchData();
        window.dispatchEvent(new CustomEvent("promo-player-updated"));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Не удалось активировать предмет");
      }
    } catch (err) {
      console.error("Failed to activate item:", err);
      alert("Ошибка сети");
    } finally {
      setActivatingId(null);
    }
  };

  const availableItems = inventory.filter((i) => i.status === "acquired");
  const claimedItems = inventory.filter((i) => i.status === "claimed" || i.status === "activated");

  const filteredItems =
    filter === "available"
      ? availableItems
      : filter === "claimed"
      ? claimedItems
      : inventory;

  const getItemIcon = (type: string) => {
    switch (type) {
      case "withdraw_boost":
      case "xp_boost":
        return <Zap className="w-5 h-5 text-amber-400" />;
      case "bonus_limitless":
      case "bonus_standard":
        return <Coins className="w-5 h-5 text-yellow-400" />;
      case "bar_item":
      case "bar_category":
        return <Coffee className="w-5 h-5 text-rose-400" />;
      case "club_time":
      case "club_service":
        return <Clock className="w-5 h-5 text-blue-400" />;
      case "ticket":
        return <Ticket className="w-5 h-5 text-orange-400" />;
      default:
        return <Gift className="w-5 h-5 text-purple-400" />;
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case "withdraw_boost":
        return "Буст вывода";
      case "bonus_limitless":
        return "Безлимитные бонусы";
      case "bonus_standard":
        return "Стандартные бонусы";
      case "bar_item":
      case "bar_category":
        return "Товар бара";
      case "club_time":
        return "Игровое время";
      case "club_service":
        return "Услуга клуба";
      case "ticket":
        return "Билет";
      default:
        return "Приз";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
      <PromoHeader title="Инвентарь" />

      <main className="max-w-md lg:max-w-3xl mx-auto px-4 pt-3 pb-32">
        {/* SUCCESS NOTIFICATION TOAST */}
        <AnimatePresence>
          {actionSuccessMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-3 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{actionSuccessMsg}</span>
              </div>
              <button
                onClick={() => setActionSuccessMsg(null)}
                className="text-emerald-400/70 hover:text-emerald-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ACTIVE BOOST BANNER IF CURRENTLY RUNNING */}
        {player?.activeBoostPercent > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 p-3.5 flex items-center justify-between gap-3 shadow-lg group hover:border-amber-500/50 transition-all cursor-pointer"
            onClick={() => setShowBoostInfo(true)}
          >
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black uppercase italic tracking-tight text-white flex items-center gap-1.5">
                <span>Буст вывода +{player.activeBoostPercent}% активен</span>
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-[10px] text-gray-400 font-medium truncate mt-0.5">
                Применится автоматически при следующем пополнении счёта
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBoostInfo(true);
              }}
              className="shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 border border-amber-500/30 hover:text-black text-amber-400 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              Расчёт
            </button>
          </motion.div>
        )}

        {/* TABS FILTER */}
        <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/5 rounded-2xl mb-4">
          <button
            onClick={() => setFilter("available")}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5",
              filter === "available"
                ? "bg-amber-500 text-black shadow-md"
                : "text-gray-400 hover:text-white"
            )}
          >
            <span>Доступные</span>
            {availableItems.length > 0 && (
              <span
                className={cn(
                  "text-[10px] font-black px-1.5 py-0.2 rounded-full",
                  filter === "available" ? "bg-black/20 text-black" : "bg-amber-500/20 text-amber-400"
                )}
              >
                {availableItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilter("all")}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5",
              filter === "all"
                ? "bg-amber-500 text-black shadow-md"
                : "text-gray-400 hover:text-white"
            )}
          >
            <span>Все</span>
            <span
              className={cn(
                "text-[10px] font-black px-1.5 py-0.2 rounded-full",
                filter === "all" ? "bg-black/20 text-black" : "bg-white/10 text-gray-300"
              )}
            >
              {inventory.length}
            </span>
          </button>

          <button
            onClick={() => setFilter("claimed")}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5",
              filter === "claimed"
                ? "bg-amber-500 text-black shadow-md"
                : "text-gray-400 hover:text-white"
            )}
          >
            <span>История</span>
          </button>
        </div>

        {/* ITEMS LIST */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-gray-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase italic tracking-tight text-white">
                {filter === "available"
                  ? "Нет доступных призов"
                  : filter === "claimed"
                  ? "История пуста"
                  : "Инвентарь пуст"}
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Крутите Колесо Фортуны, открывайте кейсы и играйте в мини-игры, чтобы получать призы и бусты!
              </p>
            </div>
            <Link
              href="/promo"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-black text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition-colors cursor-pointer mt-2"
            >
              <span>В игровую зону</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredItems.map((item) => {
              const isAcquired = item.status === "acquired";
              const isActivated = item.status === "activated";
              const isClaimed = item.status === "claimed";
              const isBoost = item.reward_type === "withdraw_boost" || item.reward_type === "xp_boost";
              const boostVal = parseFloat(item.reward_value || 0);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border p-3.5 transition-all",
                    isBoost && isAcquired
                      ? "bg-gradient-to-r from-amber-500/10 via-[#111111] to-[#111111] border-amber-500/30"
                      : item.is_rare
                      ? "bg-[#111111] border-amber-500/30"
                      : "bg-[#111111] border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                          isBoost
                            ? "bg-amber-500/15 border-amber-500/30"
                            : "bg-white/5 border-white/10"
                        )}
                      >
                        {getItemIcon(item.reward_type)}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-black uppercase italic tracking-tight text-white flex items-center gap-1.5">
                          <span className="truncate">{item.name}</span>
                          {item.is_rare && (
                            <span className="text-[9px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                              Редкий
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            {getItemTypeLabel(item.reward_type)}
                          </span>

                          {isBoost && boostVal > 0 && (
                            <span className="text-[10px] text-amber-400 font-black">
                              +{boostVal}% к выводу
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                        isAcquired
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : isActivated
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      )}
                    >
                      {isAcquired && "Доступен"}
                      {isActivated && "На кассе"}
                      {isClaimed && "Использован"}
                    </span>
                  </div>

                  {/* ACTION SECTION */}
                  {isAcquired && (
                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-gray-400 leading-tight">
                        {isBoost
                          ? "Активирует буст для следующего пополнения"
                          : item.reward_type === "bonus_limitless" || item.reward_type === "bonus_standard"
                          ? "Моментальное зачисление на баланс"
                          : "Покажите код администратору на кассе"}
                      </div>

                      <button
                        onClick={() => handleUseItem(item)}
                        disabled={activatingId === item.id}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-1.5",
                          isBoost
                            ? "bg-amber-500 hover:bg-amber-400 text-black shadow-md"
                            : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                        )}
                      >
                        {activatingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isBoost ? (
                          <>
                            <Zap className="w-3 h-3 fill-current" />
                            <span>Активировать</span>
                          </>
                        ) : item.reward_type === "bonus_limitless" || item.reward_type === "bonus_standard" ? (
                          <span>Зачислить</span>
                        ) : (
                          <span>Получить</span>
                        )}
                      </button>
                    </div>
                  )}

                  {isActivated && (
                    <div className="mt-3 pt-2.5 border-t border-white/5 bg-amber-500/5 -mx-1 px-3 py-2 rounded-xl text-center space-y-1">
                      <p className="text-[10px] text-amber-300 font-medium">
                        Покажите этот экран администратору на кассе
                      </p>
                      <p className="text-[11px] text-gray-300 font-mono tracking-wider">
                        Код приза: <span className="text-white font-bold">{item.id.slice(0, 8).toUpperCase()}</span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* BOOST INFO MODAL (PERSONIFIED) */}
      <AnimatePresence>
        {showBoostInfo && player && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowBoostInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#121212] border border-amber-500/30 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl relative overflow-hidden text-left"
            >
              <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-4 relative z-10">
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase italic tracking-tight text-white">
                    Буст вывода +{player.activeBoostPercent}%
                  </h3>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                    Как это работает
                  </span>
                </div>

                <button
                  onClick={() => setShowBoostInfo(false)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {(() => {
                const monthlyTopups = Number(player.monthlyTopups || 0);
                const monthlyWithdrawn = Number(player.monthlyWithdrawn || 0);
                const extraLimit = parseFloat(player.extraWithdrawLimit || 0);
                const bonusBalance = Math.floor(player.bonusBalance || 0);
                const boostPercent = Number(player.activeBoostPercent || 0);

                const stepInfo = getActiveStepInfo(
                  monthlyTopups,
                  player.settings,
                  player.limitGroupId,
                  player.settings?.limit_groups
                );
                const basePercent = stepInfo.percent;
                const totalRate = basePercent + boostPercent;
                const allowedLimit = (monthlyTopups * (basePercent / 100)) + extraLimit;
                const remainingLimit = Math.max(0, Math.floor(allowedLimit - monthlyWithdrawn));

                const neededWithBoost =
                  bonusBalance > remainingLimit && totalRate > 0
                    ? Math.max(0, Math.ceil((bonusBalance - remainingLimit) / (totalRate / 100)))
                    : 0;
                const neededWithoutBoost =
                  bonusBalance > remainingLimit && basePercent > 0
                    ? Math.max(0, Math.ceil((bonusBalance - remainingLimit) / (basePercent / 100)))
                    : 0;

                return (
                  <div className="space-y-3 text-xs text-gray-300 leading-relaxed relative z-10">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 space-y-1">
                      <div className="font-bold text-amber-400 text-[11px] uppercase tracking-wider">
                        Разовое увеличение лимита
                      </div>
                      <p className="text-[11px] text-gray-300">
                        При следующем пополнении на кассе ваш лимит вывода навсегда увеличится на{" "}
                        <span className="font-black text-amber-400">+{boostPercent}%</span> от внесённой суммы (в виде несгораемого экстра-лимита).
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2.5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Ваши текущие условия
                      </div>

                      <div className="grid grid-cols-2 gap-2 pb-2 border-b border-white/5">
                        <div className="bg-black/30 rounded-xl p-2.5 border border-white/5">
                          <div className="text-[10px] text-gray-400">Бонусный баланс</div>
                          <div className="text-sm font-black text-white mt-0.5">{bonusBalance} 🪙</div>
                        </div>
                        <div className="bg-black/30 rounded-xl p-2.5 border border-white/5">
                          <div className="text-[10px] text-gray-400">Доступно к выводу</div>
                          <div className="text-sm font-black text-amber-400 mt-0.5">{remainingLimit} ₽</div>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Текущая ставка вывода:</span>
                          <span className="font-bold text-white">{basePercent}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Ставка с бустом при пополнении:</span>
                          <span className="font-black text-amber-400">
                            {basePercent}% + {boostPercent}% = {totalRate}%
                          </span>
                        </div>
                        {extraLimit > 0 && (
                          <div className="flex justify-between items-center pt-1 border-t border-white/5">
                            <span className="text-gray-400">Накопленный экстра-лимит:</span>
                            <span className="font-bold text-emerald-400">+{Math.floor(extraLimit)} ₽</span>
                          </div>
                        )}
                      </div>

                      {bonusBalance > remainingLimit && neededWithBoost > 0 && (
                        <div className="pt-2 border-t border-white/5 bg-amber-500/5 -mx-1 px-2.5 py-2 rounded-xl">
                          <p className="text-[10px] text-gray-300 leading-normal">
                            Чтобы вывести весь баланс (<span className="font-bold text-white">{bonusBalance} ₽</span>), с бустом достаточно пополнить баланс ПК на{" "}
                            <span className="font-black text-amber-400">~{neededWithBoost} ₽</span>
                            {neededWithoutBoost > neededWithBoost && (
                              <span className="text-gray-400"> (без буста потребовалось бы ~{neededWithoutBoost} ₽)</span>
                            )}.
                          </p>
                        </div>
                      )}

                      {bonusBalance > 0 && remainingLimit >= bonusBalance && (
                        <div className="pt-2 border-t border-white/5">
                          <p className="text-[10px] text-emerald-400 leading-normal">
                            Вам уже доступен к выводу весь ваш бонусный баланс! Пополнение с бустом пополнит несгораемый экстра-лимит на будущее.
                          </p>
                        </div>
                      )}
                    </div>

                    <p className="text-[10px] text-gray-500 leading-normal">
                      * Буст применится автоматически при пополнении, конвертируется в бессрочный экстра-лимит и сбросится до следующего выпадения в играх.
                    </p>
                  </div>
                );
              })()}

              <div className="mt-5 pt-3 border-t border-white/5 flex gap-2 relative z-10">
                <button
                  onClick={() => setShowBoostInfo(false)}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-black uppercase text-[11px] tracking-wider hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Понятно
                </button>
                <Link
                  href="/promo/withdraw"
                  onClick={() => setShowBoostInfo(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase text-[11px] tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Лимиты</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
