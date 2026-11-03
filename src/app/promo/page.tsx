"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  Loader2,
  Gift,
  User,
  ArrowRight,
  Coins,
  Wallet,
  X,
  ChevronRight,
  ShoppingCart,
  Award,
  Flame,
  Info,
  Zap,
  Coffee,
  Clock,
  Plus,
  Swords,
  Trophy,
} from "lucide-react";
import { PrizesSidebar } from "./components/PrizesSidebar";
import { LandingView } from "./components/LandingView";
import { BottomNav } from "./components/BottomNav";
import { PromoHeader } from "./components/PromoHeader";
import { CaptainRenameModal } from "./tournaments/components/CaptainRenameModal";
import { cn } from "@/lib/utils";

/**
 * ГЛАВНОЕ ЛОББИ ИГРОВОЙ ЗОНЫ
 */

const GAMES = [
  {
    id: "wheel",
    title: "Колесо Фортуны",
    desc: "Крути колесо и забирай призы: игровое время, билеты и бонусы",
    href: "/promo/wheel",
    category: "tickets",
    cost: "1 билет",
    theme: {
      gradient: "from-amber-500/15 via-orange-500/5 to-transparent",
      border: "border-amber-500/25 hover:border-amber-500/50",
      glow: "bg-amber-500/20",
      accent: "text-amber-400",
      hoverTitle: "group-hover:text-amber-300",
      btn: "bg-amber-500/15 text-amber-400 group-hover:bg-amber-500 group-hover:text-black",
      badge: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    },
  },
  {
    id: "safe",
    title: "Взлом Сейфа",
    desc: "Угадай секретный код сейфа и забери клубный джекпот",
    href: "/promo/safe",
    category: "tickets",
    cost: "1 билет",
    theme: {
      gradient: "from-emerald-500/15 via-teal-500/5 to-transparent",
      border: "border-emerald-500/25 hover:border-emerald-500/50",
      glow: "bg-emerald-500/20",
      accent: "text-emerald-400",
      hoverTitle: "group-hover:text-emerald-300",
      btn: "bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black",
      badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    },
  },
  {
    id: "dice",
    title: "Бросок Удачи",
    desc: "Бросай кости и собирай победные числовые комбинации",
    href: "/promo/dice",
    category: "tickets",
    cost: "1 билет",
    theme: {
      gradient: "from-blue-500/15 via-indigo-500/5 to-transparent",
      border: "border-blue-500/25 hover:border-blue-500/50",
      glow: "bg-blue-500/20",
      accent: "text-blue-400",
      hoverTitle: "group-hover:text-blue-300",
      btn: "bg-blue-500/15 text-blue-400 group-hover:bg-blue-500 group-hover:text-white",
      badge: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    },
  },
  {
    id: "cards",
    title: "Карты",
    desc: "Выбери выигрышную карту и удвой свои шансы на победу",
    href: "/promo/cards",
    category: "tickets",
    cost: "1 билет",
    theme: {
      gradient: "from-purple-500/15 via-pink-500/5 to-transparent",
      border: "border-purple-500/25 hover:border-purple-500/50",
      glow: "bg-purple-500/20",
      accent: "text-purple-400",
      hoverTitle: "group-hover:text-purple-300",
      btn: "bg-purple-500/15 text-purple-400 group-hover:bg-purple-500 group-hover:text-white",
      badge: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    },
  },
  {
    id: "defuse",
    title: "Сапёр C4",
    desc: "Перережь правильный провод до взрыва таймера и забери дроп",
    href: "/promo/defuse",
    category: "tickets",
    cost: "1 билет",
    theme: {
      gradient: "from-red-500/15 via-rose-500/5 to-transparent",
      border: "border-red-500/25 hover:border-red-500/50",
      glow: "bg-red-500/20",
      accent: "text-red-400",
      hoverTitle: "group-hover:text-red-300",
      btn: "bg-red-500/15 text-red-400 group-hover:bg-red-500 group-hover:text-white",
      badge: "bg-red-500/10 border-red-500/30 text-red-400",
    },
  },
];

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

export default function PromoLobby() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [player, setPlayer] = React.useState<any>(null);
  const [tickets, setTickets] = React.useState(0);
  const [prizes, setPrizes] = React.useState<any[]>([]);
  const [inventory, setInventory] = React.useState<any[]>([]);
  const [showPrizes, setShowPrizes] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [isAuth, setIsAuth] = React.useState(false);
  const [activeLoyaltySlide, setActiveLoyaltySlide] = React.useState(0);
  const loyaltyScrollRef = React.useRef<HTMLDivElement>(null);

  const handleLoyaltyScroll = () => {
    if (!loyaltyScrollRef.current) return;
    const el = loyaltyScrollRef.current;
    const scrollLeft = el.scrollLeft;
    const card = el.firstElementChild as HTMLElement | null;
    const cardWidth = card ? card.offsetWidth : 300;
    const gap = 12;
    const slideIndex = Math.round(scrollLeft / (cardWidth + gap));
    setActiveLoyaltySlide(Math.max(0, slideIndex));
  };

  const scrollToSlide = (idx: number) => {
    if (!loyaltyScrollRef.current) return;
    const el = loyaltyScrollRef.current;
    const card = el.firstElementChild as HTMLElement | null;
    const cardWidth = card ? card.offsetWidth : 300;
    const gap = 12;
    el.scrollTo({ left: idx * (cardWidth + gap), behavior: "smooth" });
    setActiveLoyaltySlide(idx);
  };

  // Sync clubId with URL without reloading
  React.useEffect(() => {
    const newUrl = new URL(window.location.href);

    // Sync ClubId from player if missing in URL
    if (!newUrl.searchParams.has("clubId") && player?.clubId) {
      newUrl.searchParams.set("clubId", String(player.clubId));
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [player?.clubId]);
  const [publicClubInfo, setPublicClubInfo] = React.useState<{
    name: string;
    promo_settings?: any;
    settings?: any;
  } | null>(null);

  const urlClubId = searchParams.get("clubId");
  const action = searchParams.get("action");
  const [checkedIn, setCheckedIn] = React.useState(false);
  const [showIntentDialog, setShowIntentDialog] = React.useState(false);
  const [isCheckingIn, setIsCheckingIn] = React.useState(false);
  const hasCheckedIn = React.useRef(false);

  const handleCheckIn = async (intent: "topup" | "pos" | "visit") => {
    if (!urlClubId || isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      const res = await fetch("/api/promo/player/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId: urlClubId,
          intent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCheckedIn(true);
        setShowIntentDialog(false);
        // Remove action from URL to avoid re-triggering on refresh
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("action");
        window.history.replaceState({}, "", newUrl.toString());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const [claimingLoyalty, setClaimingLoyalty] = React.useState<string | null>(null);
  const [showBoostInfo, setShowBoostInfo] = React.useState(false);

  const getActivePrograms = (settings: any) => {
    if (!settings) return [];
    if (Array.isArray(settings.loyalty_programs) && settings.loyalty_programs.length > 0) {
      return settings.loyalty_programs.filter((p: any) => p.enabled);
    }

    // Legacy fallback
    const programs: any[] = [];
    if (settings.packages_promo_enabled) {
      programs.push({
        id: "legacy_packages",
        enabled: true,
        type: "package_accumulation",
        title: settings.packages_accumulation_reward_name || "Бесплатный пакет",
        target: parseInt(settings.packages_accumulation_target || "5"),
        isLegacy: true,
        legacyField: "accumulated_packages",
        legacyType: "packages"
      });
    }
    if (settings.packages_visits_enabled) {
      programs.push({
        id: "legacy_visits",
        enabled: true,
        type: "visit_accumulation",
        title: settings.packages_visits_reward_name || "Подарок за посещения",
        target: parseInt(settings.packages_visits_target || "10"),
        isLegacy: true,
        legacyField: "accumulated_visits",
        legacyType: "visits"
      });
    }
    if (settings.packages_streak_enabled) {
      programs.push({
        id: "legacy_streak",
        enabled: true,
        type: "visit_streak",
        title: settings.packages_streak_reward_name || "Приз за стрик",
        target: parseInt(settings.packages_streak_target || "2"),
        isLegacy: true,
        legacyField: "current_streak",
        legacyType: "streak"
      });
    }
    return programs;
  };

  const handleClaimLoyalty = async (typeOrId: string, isLegacy: boolean) => {
    setClaimingLoyalty(typeOrId);
    try {
      const payload = isLegacy ? { type: typeOrId } : { programId: typeOrId };
      const res = await fetch("/api/promo/player/loyalty/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        // Refetch player info and tickets
        const updatedRes = await fetch("/api/promo/player");
        const updatedData = await updatedRes.json();
        if (updatedData.player) {
          setPlayer(updatedData.player);
        }
        if (typeof updatedData.tickets === "number") {
          setTickets(updatedData.tickets);
        }
        window.dispatchEvent(new CustomEvent("promo-player-updated"));
      } else {
        alert(data.error || "Ошибка отправки запроса");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    } finally {
      setClaimingLoyalty(null);
    }
  };

  React.useEffect(() => {
    async function fetchData() {
      try {
        // 1. Initial Player Info check
        const res = await fetch("/api/promo/player");

        if (res.status === 401) {
          setIsAuth(false);
          // If not auth, try to get public club info for landing
          if (urlClubId) {
            const clubRes = await fetch(
              `/api/promo/public-info?clubId=${urlClubId}`,
            );
            const clubData = await clubRes.json();
            if (clubData.success) {
              setPublicClubInfo(clubData.club);
            }
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (!data.player) {
          setIsAuth(false);
          setLoading(false);
          return;
        }

        setPlayer(data.player);
        setTickets(data.tickets);
        setIsAuth(true);

        const currentClubId = urlClubId || data.player.clubId;

        // Fetch prizes, settings, and inventory
        const [prizesRes, clubRes, invRes] = await Promise.all([
          fetch(`/api/promo/prizes?all=true`),
          fetch(`/api/promo/public-info?clubId=${currentClubId}`),
          fetch(`/api/promo/inventory`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);

        const prizesData = await prizesRes.json();
        if (prizesData.success) {
          setPrizes(prizesData.prizes || []);
        }

        const clubData = await clubRes.json();
        if (clubData.success) {
          setPublicClubInfo(clubData.club);
        }

        if (invRes?.inventory) {
          setInventory(invRes.inventory);
        }

        // Handle Check-in action from Static QR
        if (action === "checkin" && urlClubId && !hasCheckedIn.current) {
          hasCheckedIn.current = true;
          setShowIntentDialog(true);
        }
      } catch (err) {
        console.error("Failed to fetch player data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    const handlePlayerUpdate = () => {
      fetch("/api/promo/inventory")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.inventory) setInventory(data.inventory);
        })
        .catch(() => {});
    };
    window.addEventListener("promo-player-updated", handlePlayerUpdate);
    return () => window.removeEventListener("promo-player-updated", handlePlayerUpdate);
  }, [urlClubId, action]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  // If not authenticated, show Landing Page
  if (!isAuth) {
    return (
      <LandingView
        clubId={urlClubId}
        clubName={publicClubInfo?.name || null}
        action={action}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Intent Selection Dialog */}
      <AnimatePresence>
        {showIntentDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-[#151515] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-8"
            >
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black uppercase italic tracking-tight">
                  Вы <span className="text-orange-500">у кассы</span>
                </h3>
                <p className="text-gray-400 text-sm font-medium">
                  Выберите, что вы хотите сделать, чтобы админ увидел ваш
                  профиль в нужном разделе.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => handleCheckIn("visit")}
                  disabled={isCheckingIn}
                  className="group flex items-center gap-4 w-full bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/50 p-6 rounded-3xl transition-all active:scale-[0.98] text-left"
                >
                  <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-black uppercase italic text-lg leading-tight">
                      Отметиться
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                      Отметить посещение в клубе
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-orange-500 transition-colors" />
                </button>

                <button
                  onClick={() => handleCheckIn("topup")}
                  disabled={isCheckingIn}
                  className="group flex items-center gap-4 w-full bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/50 p-6 rounded-3xl transition-all active:scale-[0.98] text-left"
                >
                  <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-black uppercase italic text-lg leading-tight">
                      Пополнить
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                      Баланс аккаунта
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-orange-500 transition-colors" />
                </button>

                <button
                  onClick={() => handleCheckIn("pos")}
                  disabled={isCheckingIn}
                  className="group flex items-center gap-4 w-full bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/50 p-6 rounded-3xl transition-all active:scale-[0.98] text-left"
                >
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                    <Coins className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-black uppercase italic text-lg leading-tight">
                      Купить в баре
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                      Еда, напитки, девайсы
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-emerald-500 transition-colors" />
                </button>
              </div>

              <button
                onClick={() => setShowIntentDialog(false)}
                className="w-full text-center text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Отмена
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Check-in Notification */}
      <AnimatePresence>
        {checkedIn && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-0 left-0 right-0 z-50 p-4 pointer-events-none"
          >
            <div className="max-w-md mx-auto bg-emerald-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-black uppercase text-xs">Вы у кассы!</div>
                <div className="text-[10px] opacity-90 font-medium">
                  Админ видит ваш профиль. Приятных покупок!
                </div>
              </div>
              <button
                onClick={() => setCheckedIn(false)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <PromoHeader
        initialPlayer={player}
        initialTickets={tickets}
        onPrizesClick={() => setShowPrizes(true)}
        showPrizes={showPrizes}
      />
      <PrizesSidebar
        isOpen={showPrizes}
        onClose={() => setShowPrizes(false)}
        prizes={prizes}
      />
      <main className="max-w-6xl mx-auto p-3.5 sm:p-6 pt-3 sm:pt-4 pb-32 sm:pb-24">
            {/* Quick Status / Navigation Banners */}
            {/* Quick Status / Navigation Banners */}
            {(() => {
              const availableItems = inventory.filter((i: any) => i.status === "acquired");
              const hasActiveBoost = Boolean(player?.activeBoostPercent > 0);

              const TOTAL_SLOTS = 8;
              const slots: Array<{
                type: "active_boost" | "item" | "overflow" | "empty";
                data?: any;
                overflowCount?: number;
              }> = [];

              if (hasActiveBoost) {
                slots.push({
                  type: "active_boost",
                  data: { percent: player.activeBoostPercent },
                });
              }

              const maxItemSlots = TOTAL_SLOTS - slots.length;
              const showOverflow = availableItems.length > maxItemSlots;
              const itemsToTake = showOverflow
                ? maxItemSlots - 1
                : Math.min(availableItems.length, maxItemSlots);

              for (let idx = 0; idx < itemsToTake; idx++) {
                slots.push({
                  type: "item",
                  data: availableItems[idx],
                });
              }

              if (showOverflow) {
                slots.push({
                  type: "overflow",
                  overflowCount: availableItems.length - itemsToTake,
                });
              }

              while (slots.length < TOTAL_SLOTS) {
                slots.push({ type: "empty" });
              }

              return (
                <div className="space-y-2.5 sm:space-y-3 mb-4 sm:mb-6">
                  {/* MINI INVENTORY BANNER WITH SLOTS */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div
                      onClick={() => router.push("/promo/inventory")}
                      className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-white/5 border border-amber-500/25 hover:border-amber-500/50 rounded-2xl p-3 sm:p-3.5 shadow-md shadow-black/20 relative overflow-hidden group flex flex-col justify-between gap-2.5 transition-all cursor-pointer"
                    >
                      <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-500/15 rounded-full blur-2xl opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none" />

                      {/* Header */}
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-black uppercase italic tracking-tight text-white group-hover:text-amber-400 transition-colors">
                            Инвентарь
                          </h4>
                          {availableItems.length > 0 && (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-white/10 text-gray-300 border border-white/10 px-1.5 py-0.2 rounded-full">
                              +{availableItems.length}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400 group-hover:text-amber-400 transition-colors">
                          <span className="text-[10px] uppercase tracking-wider hidden sm:inline">Открыть</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>

                      {/* Slots Row (8 slots evenly distributed across width) */}
                      <div className="grid grid-cols-8 gap-1.5 sm:gap-2 relative z-10 pt-1 pb-1">
                        {slots.map((slot, idx) => {
                          if (slot.type === "active_boost") {
                            return (
                              <div
                                key={`active-boost-${idx}`}
                                className="relative aspect-square w-full max-w-[40px] mx-auto rounded-xl bg-gradient-to-b from-amber-500/25 to-amber-950/40 border border-amber-500/60 flex items-center justify-center text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                                title={`Активный буст вывода: +${player.activeBoostPercent}%`}
                              >
                                <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                <span className="absolute -bottom-1 -right-1 text-[7px] font-black bg-amber-500 text-black px-0.5 sm:px-1 rounded-sm leading-tight shadow z-20">
                                  +{player.activeBoostPercent}%
                                </span>
                              </div>
                            );
                          }

                          if (slot.type === "item") {
                            const item = slot.data;
                            const isBoost =
                              item.reward_type === "withdraw_boost" || item.reward_type === "xp_boost";
                            const isBonus =
                              item.reward_type === "bonus_limitless" ||
                              item.reward_type === "bonus_standard";
                            const isBar =
                              item.reward_type === "bar_item" || item.reward_type === "bar_category";
                            const isTime =
                              item.reward_type === "club_time" || item.reward_type === "club_service";
                            const isTicket = item.reward_type === "ticket";
                            const itemVal = parseFloat(item.reward_value || 0);

                            return (
                              <div
                                key={`item-${item.id || idx}`}
                                className={cn(
                                  "relative aspect-square w-full max-w-[40px] mx-auto rounded-xl border flex items-center justify-center transition-transform group-hover:scale-105",
                                  isBoost
                                    ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                                    : isBonus
                                    ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-400"
                                    : isBar
                                    ? "bg-rose-500/15 border-rose-500/40 text-rose-400"
                                    : isTime
                                    ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                                    : isTicket
                                    ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                                    : "bg-purple-500/15 border-purple-500/40 text-purple-400"
                                )}
                                title={item.name}
                              >
                                {isBoost ? (
                                  <Zap className="w-3.5 h-3.5" />
                                ) : isBonus ? (
                                  <Coins className="w-3.5 h-3.5" />
                                ) : isBar ? (
                                  <Coffee className="w-3.5 h-3.5" />
                                ) : isTime ? (
                                  <Clock className="w-3.5 h-3.5" />
                                ) : isTicket ? (
                                  <Ticket className="w-3.5 h-3.5" />
                                ) : (
                                  <Gift className="w-3.5 h-3.5" />
                                )}

                                {isBoost && itemVal > 0 && (
                                  <span className="absolute -bottom-1 -right-1 text-[7px] font-black bg-amber-500 text-black px-0.5 sm:px-1 rounded-sm leading-tight shadow z-20">
                                    +{itemVal}%
                                  </span>
                                )}
                                {isBonus && itemVal > 0 && (
                                  <span className="absolute -bottom-1 -right-1 text-[7px] font-black bg-yellow-500 text-black px-0.5 sm:px-1 rounded-sm leading-tight shadow z-20">
                                    {Math.round(itemVal)}
                                  </span>
                                )}
                              </div>
                            );
                          }

                          if (slot.type === "overflow") {
                            return (
                              <div
                                key="overflow"
                                className="aspect-square w-full max-w-[40px] mx-auto rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[9px] font-black text-gray-400"
                                title={`Ещё ${slot.overflowCount} наград в инвентаре`}
                              >
                                +{slot.overflowCount}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={`empty-${idx}`}
                              className="aspect-square w-full max-w-[40px] mx-auto rounded-xl bg-black/40 border border-dashed border-white/10 flex items-center justify-center text-white/15"
                            >
                              <Plus className="w-3 h-3" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>

                  {/* TWO CARDS ON ONE LINE: FRAG RATING + TOURNAMENTS */}
                  {(() => {
                    const isFragActive = Boolean(player?.settings?.frag?.is_active ?? publicClubInfo?.settings?.frag?.is_active);
                    const isTournamentsActive = publicClubInfo?.settings?.tournaments_enabled !== false;

                    if (!isFragActive && !isTournamentsActive) return null;

                    return (
                      <div className={cn("grid gap-2.5 sm:gap-3", isFragActive && isTournamentsActive ? "grid-cols-2" : "grid-cols-1")}>
                        {/* FRAG RATING */}
                        {isFragActive && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <div
                              onClick={() => router.push("/promo/frag")}
                              className="h-full relative overflow-hidden group cursor-pointer bg-white/5 border border-white/10 hover:border-indigo-500/40 rounded-2xl p-3 sm:p-3.5 transition-all duration-300 flex flex-col justify-between gap-2 shadow-md shadow-black/20"
                            >
                              <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                              <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400">
                                    <Swords className="w-3.5 h-3.5" />
                                  </div>
                                  <h3 className="text-xs sm:text-sm font-black uppercase italic leading-none text-white group-hover:text-indigo-300 transition-colors truncate">
                                    Рейтинг FRAG
                                  </h3>
                                </div>

                                <ArrowRight className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                              </div>

                              <div className="relative z-10">
                                <p className="text-[10px] sm:text-xs text-gray-400 group-hover:text-gray-300 font-medium leading-tight line-clamp-2 transition-colors">
                                  Бонусы за фраги и победы в играх
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* TOURNAMENTS */}
                        {isTournamentsActive && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <div
                              onClick={() => router.push("/promo/tournaments")}
                              className="h-full relative overflow-hidden group cursor-pointer bg-white/5 border border-white/10 hover:border-amber-500/40 rounded-2xl p-3 sm:p-3.5 transition-all duration-300 flex flex-col justify-between gap-2 shadow-md shadow-black/20"
                            >
                              <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                              <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                                    <Trophy className="w-3.5 h-3.5" />
                                  </div>
                                  <h3 className="text-xs sm:text-sm font-black uppercase italic leading-none text-white group-hover:text-amber-300 transition-colors truncate">
                                    Турниры
                                  </h3>
                                </div>

                                <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                              </div>

                              <div className="relative z-10">
                                <p className="text-[10px] sm:text-xs text-gray-400 group-hover:text-gray-300 font-medium leading-tight line-clamp-2 transition-colors">
                                  Сетки, команды и призовые клубов
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Loyalty Programs Section */}
            {player && getActivePrograms(player.settings).length > 0 && (() => {
              const activePrograms = getActivePrograms(player.settings);
              return (
                <div className="mb-6 sm:mb-8">
                  <div className="mb-2.5 sm:mb-3">
                    <h3 className="text-base sm:text-lg font-black uppercase italic tracking-tight text-white">
                      Программы лояльности
                    </h3>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                      Копи посещения, пакеты и забирай подарки
                    </p>
                  </div>

                  {/* Loyalty Programs Slider on Mobile, Grid on Desktop */}
                  <div
                    ref={loyaltyScrollRef}
                    onScroll={handleLoyaltyScroll}
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    className="flex overflow-x-auto gap-3 md:gap-4 pb-2 snap-x snap-mandatory no-scrollbar md:grid md:grid-cols-3 [&::-webkit-scrollbar]:hidden"
                  >
                    {activePrograms.map((program: any) => {
                      const current = program.isLegacy
                        ? (player.packageProgress?.[program.legacyField] || 0)
                        : (player.packageProgress?.programProgress?.[program.id]?.current_count || 0);
                      const target = program.target || 5;
                      const isCompleted = current >= target;
                      const isPending = player.packageProgress?.pendingClaims?.includes(
                        program.isLegacy ? program.legacyType : program.id
                      );

                      const triggerServices = (program.trigger_service_ids || []).map((id: string) => {
                        const tariff = (player?.tariffs || []).find((t: any) => String(t.id) === String(id));
                        if (tariff) return tariff.name;
                        const rule = player?.settings?.service_rules?.find((r: any) => String(r.id) === String(id));
                        return rule ? rule.name : null;
                      }).filter(Boolean);

                      const triggerProducts: string[] = [];

                      const zoneObj = program.target_zone_id
                        ? (player?.zones || []).find((z: any) => String(z.id) === String(program.target_zone_id))
                        : null;
                      const zoneSuffix = zoneObj ? ` • ${zoneObj.title}` : "";

                      let triggerText = "";
                      const items = [...triggerServices, ...triggerProducts];
                      if (program.type === "package_accumulation") {
                        if (items.length > 0) {
                          triggerText = `Покупка: ${items.join(", ")}${zoneSuffix}`;
                        } else {
                          triggerText = `Покупка любого пакета${zoneSuffix}`;
                        }
                      } else if (program.type === "visit_accumulation") {
                        if (items.length > 0) {
                          triggerText = `Визит с пакетом: ${items.join(", ")}${zoneSuffix}`;
                        } else {
                          triggerText = `Посещение клуба (≥ 30 мин)${zoneSuffix}`;
                        }
                      } else if (program.type === "visit_streak") {
                        if (items.length > 0) {
                          triggerText = `Серия дней с покупкой: ${items.join(", ")}${zoneSuffix}`;
                        } else {
                          triggerText = `Серия дней подряд${zoneSuffix}`;
                        }
                      }

                      const rewardItems: { text: string; className: string }[] = [];
                      if (program.rewards) {
                        if (program.rewards.tickets > 0) {
                          rewardItems.push({
                            text: `+${program.rewards.tickets} билета`,
                            className: "text-orange-400 font-bold"
                          });
                        }
                        if (program.rewards.bonus_balance > 0) {
                          rewardItems.push({
                            text: `+${program.rewards.bonus_balance} бонусов`,
                            className: "text-yellow-400 font-bold"
                          });
                        }
                        if (program.rewards.free_package || program.rewards.free_package === "true") {
                          const freeQty = Math.max(1, Number(program.rewards.free_package_quantity || 1));
                          const freeQtySuffix = freeQty > 1 ? ` (x${freeQty})` : "";
                          const rawPkgName = (program.rewards.free_package_name || "Бесплатный пакет").trim();
                          // Avoid "Пакет: Пакет ночь" — strip duplicate "пакет" prefix or show clean name
                          const cleanPkgName = /^пакет\s+/i.test(rawPkgName)
                            ? rawPkgName
                            : `Пакет «${rawPkgName}»`;
                          rewardItems.push({
                            text: `${cleanPkgName}${freeQtySuffix}`,
                            className: "text-indigo-300 font-bold"
                          });
                        }
                        const qty = Math.max(1, Number(program.rewards.bar_reward_quantity || 1));
                        const qtySuffix = qty > 1 ? ` (x${qty})` : "";
                        if (program.rewards.bar_reward_type && program.rewards.bar_reward_type !== "none") {
                          rewardItems.push({
                            text: `Товар из бара${qtySuffix}`,
                            className: "text-emerald-400 font-bold"
                          });
                        }
                      } else if (program.isLegacy) {
                        rewardItems.push({
                          text: program.title || "Бесплатный пакет",
                          className: "text-indigo-300 font-bold"
                        });
                      }

                      let rewardName = program.title || "";
                      if (!rewardName) {
                        if (program.type === "package_accumulation") rewardName = program.rewards?.free_package_name || "Бесплатный пакет";
                        else if (program.type === "visit_accumulation") rewardName = "Подарок за посещения";
                        else rewardName = "Приз за серию дней";
                      }

                      const loyaltyTheme = program.type === "visit_streak"
                        ? {
                            gradient: "from-orange-500/15 via-rose-500/5 to-transparent",
                            border: "border-orange-500/25 hover:border-orange-500/50",
                            glow: "bg-orange-500/20",
                            accent: "text-orange-400",
                            hoverTitle: "group-hover:text-orange-300",
                            progressBar: "from-orange-500 to-rose-500",
                            shadow: "shadow-orange-500/20",
                            badge: "bg-orange-500/10 border-orange-500/20 text-orange-300",
                          }
                        : program.type === "visit_accumulation"
                        ? {
                            gradient: "from-amber-500/15 via-yellow-500/5 to-transparent",
                            border: "border-amber-500/25 hover:border-amber-500/50",
                            glow: "bg-amber-500/20",
                            accent: "text-amber-400",
                            hoverTitle: "group-hover:text-amber-300",
                            progressBar: "from-amber-500 to-yellow-400",
                            shadow: "shadow-amber-500/20",
                            badge: "bg-amber-500/10 border-amber-500/20 text-amber-300",
                          }
                        : {
                            gradient: "from-indigo-500/15 via-purple-500/5 to-transparent",
                            border: "border-indigo-500/25 hover:border-indigo-500/50",
                            glow: "bg-indigo-500/20",
                            accent: "text-indigo-400",
                            hoverTitle: "group-hover:text-indigo-300",
                            progressBar: "from-indigo-500 to-purple-500",
                            shadow: "shadow-indigo-500/20",
                            badge: "bg-indigo-500/10 border-indigo-500/20 text-indigo-300",
                          };

                      return (
                        <motion.div
                          key={program.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "w-[82vw] max-w-[300px] md:w-full md:max-w-none shrink-0 md:shrink snap-start rounded-2xl md:rounded-3xl p-3.5 sm:p-4 md:p-5 flex flex-col justify-start min-h-[135px] md:min-h-[165px] relative overflow-hidden group border transition-all duration-300 bg-gradient-to-br shadow-md shadow-black/20 hover:shadow-xl",
                            loyaltyTheme.gradient,
                            loyaltyTheme.border
                          )}
                        >
                          {/* Dynamic Background Glow */}
                          <div className={cn("absolute -top-10 -right-10 w-28 md:w-36 h-28 md:h-36 rounded-full blur-2xl opacity-25 group-hover:opacity-50 transition-opacity pointer-events-none", loyaltyTheme.glow)} />

                          {/* Top: Title & Trigger Description */}
                          <div className="relative z-10 min-w-0">
                            <p className={cn("text-xs sm:text-sm md:text-base font-black uppercase text-white tracking-tight leading-snug truncate transition-colors", loyaltyTheme.hoverTitle)}>
                              {rewardName}
                            </p>
                            <p className="text-[10px] md:text-xs text-gray-400 font-medium truncate mt-0.5 md:mt-1">
                              {triggerText}
                            </p>
                          </div>

                          {/* Fixed Progress Bar Level */}
                          <div className="w-full h-1.5 md:h-2 bg-white/10 rounded-full overflow-hidden mt-3 md:mt-3.5 mb-2.5 md:mb-3 relative z-10">
                            <div
                              className={cn("h-full bg-gradient-to-r transition-all duration-500", loyaltyTheme.progressBar)}
                              style={{ width: `${Math.min(100, (current / target) * 100)}%` }}
                            />
                          </div>

                          {/* Bottom info / actions expanding naturally downwards */}
                          <div className="relative z-10 flex-1 flex flex-col justify-between">

                            {isCompleted ? (
                              isPending ? (
                                <button
                                  disabled
                                  className="w-full py-1.5 md:py-2 bg-white/10 text-gray-400 rounded-xl font-black uppercase tracking-wider text-[9px] md:text-[11px] flex items-center justify-center gap-1.5 border border-white/5"
                                >
                                  <Loader2 className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin" />
                                  Ожидает выдачи в клубе
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleClaimLoyalty(program.isLegacy ? program.legacyType : program.id, program.isLegacy)}
                                  disabled={claimingLoyalty !== null}
                                  className={cn(
                                    "w-full py-1.5 md:py-2 text-white rounded-xl font-black uppercase tracking-widest text-[9px] md:text-[11px] transition-all hover:scale-[1.01] shadow-md animate-pulse cursor-pointer bg-gradient-to-r",
                                    loyaltyTheme.progressBar,
                                    loyaltyTheme.shadow
                                  )}
                                >
                                  {claimingLoyalty === (program.isLegacy ? program.legacyType : program.id) ? (
                                    <Loader2 className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin mx-auto" />
                                  ) : (
                                    "Забрать подарок"
                                  )}
                                </button>
                              )
                            ) : (
                              <div className="space-y-1.5 md:space-y-2">
                                <div className={cn("text-[10px] md:text-xs font-black uppercase tracking-wider", loyaltyTheme.accent)}>
                                  Осталось {Math.max(0, target - current)}{" "}
                                  {program.type === "visit_accumulation" ? "раз" : program.type === "visit_streak" ? "дней" : "шт"}
                                </div>
                                {rewardItems.length > 0 && (
                                  <div className="text-[10px] md:text-xs text-gray-400 font-medium leading-relaxed">
                                    <span className="text-gray-500 uppercase text-[9px] md:text-[10px] font-bold tracking-wider mr-1.5">
                                      Награда:
                                    </span>
                                    {rewardItems.map((r, rIdx) => (
                                      <span key={rIdx}>
                                        <span className={r.className}>{r.text}</span>
                                        {rIdx < rewardItems.length - 1 && (
                                          <span className="text-gray-600 mx-1.5">•</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Interactive Slide Indicator (dashes) */}
                  {activePrograms.length > 1 && (
                    <div className="flex justify-center items-center gap-1.5 mt-2.5 md:hidden">
                      {activePrograms.map((_: any, idx: number) => {
                        const isSelected = activeLoyaltySlide === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => scrollToSlide(idx)}
                            aria-label={`Слайд ${idx + 1}`}
                            className={cn(
                              "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                              isSelected
                                ? "w-6 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                                : "w-2 bg-white/20 hover:bg-white/40"
                            )}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Pending Prizes — show player what awaits them at the cashier */}
                  {(player.packageProgress?.pendingPrizes?.length ?? 0) > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-amber-400" />
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                          Ваши призы ждут в клубе
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {player.packageProgress.pendingPrizes.map((prize: any) => (
                          <div
                            key={prize.id}
                            className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2"
                          >
                            <div className="w-7 h-7 bg-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                              {prize.prize_type === "bar_item" ? (
                                <ShoppingCart className="w-3.5 h-3.5 text-amber-500" />
                              ) : (
                                <Gift className="w-3.5 h-3.5 text-amber-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {prize.prize_name}
                              </div>
                              <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400/70">
                                {prize.prize_type === "bar_item"
                                  ? "Подойди на кассу — выдадут напиток"
                                  : "Подойди на кассу для получения"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Tickets Category */}
            {(() => {
              const ticketGames = GAMES.filter(
                (g) =>
                  g.category === "tickets" &&
                  (publicClubInfo?.settings?.enabled_games || []).includes(g.id),
              );

              if (ticketGames.length === 0) return null;

              return (
                <section className="mb-16">
                  <div className="flex items-center gap-4 mb-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
                      Игры за билеты
                    </h3>
                    <div className="h-px w-full bg-white/5" />
                  </div>

                  {/* Tickets Info Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-3.5 sm:p-4 mb-4 relative overflow-hidden group shadow-md shadow-black/20"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                      <Ticket className="w-14 h-14 text-orange-500" />
                    </div>
                    <h4 className="text-xs sm:text-sm font-black uppercase italic tracking-tight text-white mb-1 relative z-10">
                      Билеты
                    </h4>
                    <p className="text-gray-400 text-[11px] sm:text-xs leading-relaxed max-w-2xl font-medium relative z-10">
                      Используй билеты для участия в призовых играх. Каждый билет — это шанс выиграть реальные подарки: от напитков до игрового времени на баланс.
                    </p>
                  </motion.div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {ticketGames.map((game, index) => {
                      const costNum = Number(publicClubInfo?.settings?.game_configs?.[game.id]?.tickets_per_play) || 1;
                      const costLabel = `${costNum} ${costNum === 1 ? "билет" : costNum < 5 ? "билета" : "билетов"}`;
                      return (
                        <GameCard
                          key={game.id}
                          game={{ ...game, cost: costLabel }}
                          index={index}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            {/* Accruals Quick Link */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 sm:mb-10"
            >
              <Link
                href="/promo/accruals"
                className="flex items-center justify-between bg-white/5 border border-white/10 hover:border-amber-500/30 rounded-2xl p-3 sm:p-3.5 transition-all group shadow-md shadow-black/20"
              >
                <div className="space-y-0.5 min-w-0">
                  <h4 className="text-xs sm:text-sm font-black uppercase italic tracking-tight text-white group-hover:text-amber-400 transition-colors truncate">
                    Как получить билеты?
                  </h4>
                  <p className="text-[11px] sm:text-xs text-gray-400 font-medium truncate">
                    Смотри правила и историю своих начислений
                  </p>
                </div>
                <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-white/5 border border-white/10 text-gray-400 group-hover:text-white shrink-0 ml-3 transition-all">
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </motion.div>
      </main>
      <BottomNav />

      {/* CAPTAIN RENAME MODAL: POPUP WHEN CLUB REQUESTS NAME CHANGE */}
      {player?.renameRequest && (
        <CaptainRenameModal
          isOpen={!!player.renameRequest}
          team={{
            id: player.renameRequest.teamId,
            name: player.renameRequest.currentName,
            tag: player.renameRequest.currentTag,
            reason: player.renameRequest.reason,
          }}
          onSuccess={async () => {
            const res = await fetch("/api/promo/player");
            if (res.ok) {
              const data = await res.json();
              setPlayer(data.player);
            }
          }}
        />
      )}

      {/* BOOST INFO MODAL */}
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
                            Вам уже доступен к выводу весь ваш бонусный баланс! Пополнение с бустом пополнит несгораемый экстра-лимит на будущие выигрыши.
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
    </div>
  );
}

function GameCard({
  game,
  index,
}: {
  game: any;
  index: number;
}) {
  const theme = game.theme || {
    gradient: "from-amber-500/15 via-orange-500/5 to-transparent",
    border: "border-amber-500/25 hover:border-amber-500/50",
    glow: "bg-amber-500/20",
    accent: "text-amber-400",
    hoverTitle: "group-hover:text-amber-300",
    btn: "bg-amber-500/15 text-amber-400 group-hover:bg-amber-500 group-hover:text-black",
    badge: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Link href={game.href}>
        <div
          className={cn(
            "h-full relative p-5 sm:p-7 rounded-3xl sm:rounded-[2.5rem] border transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-0 sm:min-h-[16.5rem]",
            "bg-gradient-to-br group hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg shadow-black/20",
            theme.gradient,
            theme.border
          )}
        >
          {/* Dynamic Background Glow */}
          <div className={cn("absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-30 group-hover:opacity-70 transition-opacity pointer-events-none", theme.glow)} />

          <div className="relative z-10">
            <div className="mb-1.5 sm:mb-2">
              <h3
                className={cn(
                  "text-lg sm:text-xl font-black uppercase italic tracking-tight transition-colors text-white",
                  theme.hoverTitle
                )}
              >
                {game.title}
              </h3>
            </div>

            <p className="text-xs leading-relaxed font-medium mb-3 sm:mb-6 text-gray-300">
              {game.desc}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 sm:pt-4 border-t border-white/5 relative z-10">
            <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border", theme.badge)}>
              {game.cost}
            </span>

            <div className={cn("w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 shadow-md", theme.btn)}>
              <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
