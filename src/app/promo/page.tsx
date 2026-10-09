"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Disc,
  Lock,
  Dice5,
  Ticket,
  CreditCard as CardIcon,
  Bird,
  Bomb,
  Rocket as RocketIcon,
  Gamepad2,
  Loader2,
  Gift,
  User,
  ArrowRight,
  Coins,
  Wallet,
  X,
  Clock,
  Zap,
  ChevronRight,
  ShoppingCart,
  Target,
  Award,
  Flame,
} from "lucide-react";
import { PrizesSidebar } from "./components/PrizesSidebar";
import { LandingView } from "./components/LandingView";
import { BottomNav } from "./components/BottomNav";
import { PromoHeader } from "./components/PromoHeader";
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
];

const getTierInfo = (monthlyTopups: number, limitGroupId?: string | null, limitGroups?: any[]) => {
  let t1 = 1000;
  let t2 = 3000;
  let t3 = 5000;

  if (limitGroupId && limitGroups && Array.isArray(limitGroups)) {
    const group = limitGroups.find((g: any) => g.id === limitGroupId);
    if (group) {
      t1 = parseFloat(group.t1) || 0;
      t2 = parseFloat(group.t2) || 0;
      t3 = parseFloat(group.t3) || 0;
    }
  }

  if (monthlyTopups > t3) return { percent: 90, nextTierAt: null, nextPercent: null };
  if (monthlyTopups > t2) return { percent: 70, nextTierAt: t3, nextPercent: 90 };
  if (monthlyTopups > t1) return { percent: 50, nextTierAt: t2, nextPercent: 70 };
  return { percent: 30, nextTierAt: t1, nextPercent: 50 };
};

export default function PromoLobby() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [player, setPlayer] = React.useState<any>(null);
  const [tickets, setTickets] = React.useState(0);
  const [prizes, setPrizes] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [cart, setCart] = React.useState<any[]>([]);
  const [showPrizes, setShowPrizes] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [isAuth, setIsAuth] = React.useState(false);

  const activeTab = searchParams.get("tab") === "shop" ? "shop" : "games";

  // Sync clubId with URL without reloading
  React.useEffect(() => {
    const newUrl = new URL(window.location.href);

    // Sync ClubId from player if missing in URL
    if (!newUrl.searchParams.has("clubId") && player?.clubId) {
      newUrl.searchParams.set("clubId", String(player.clubId));
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [player?.clubId, activeTab]);
  const [publicClubInfo, setPublicClubInfo] = React.useState<{
    name: string;
    promo_settings?: any;
    settings?: any;
  } | null>(null);

  const urlClubId = searchParams.get("clubId");
  const action = searchParams.get("action");
  const [checkedIn, setCheckedIn] = React.useState(false);
  const [showIntentDialog, setShowIntentDialog] = React.useState(false);
  const [showOrderDialog, setShowOrderDialog] = React.useState(false);
  const [isCheckingIn, setIsCheckingIn] = React.useState(false);
  const [quests, setQuests] = React.useState<any[]>([]);
  const [showSeatDialog, setShowSeatDialog] = React.useState(false);
  const [tempSeatNumber, setTempSeatNumber] = React.useState("");
  const hasCheckedIn = React.useRef(false);

  const multiplier = publicClubInfo?.settings?.bonus_price_multiplier || 2;

  const handleCheckIn = async (intent: "topup" | "pos" | "bonus_order" | "visit", seatNumber?: string) => {
    if (!urlClubId || isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      const res = await fetch("/api/promo/player/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId: urlClubId,
          intent,
          seatNumber,
          cart: intent === "bonus_order" ? cart : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCheckedIn(true);
        setShowIntentDialog(false);
        setShowOrderDialog(false);
        if (intent === "bonus_order") {
          setCart([]);
        }
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
        // Refetch player info
        const updatedRes = await fetch("/api/promo/player");
        const updatedData = await updatedRes.json();
        if (updatedData.player) {
          setPlayer(updatedData.player);
        }
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

        // Fetch products, settings, and quests
        const [prizesRes, productsRes, clubRes, questsRes] = await Promise.all([
          fetch(`/api/promo/prizes?all=true`),
          fetch(`/api/promo/products?clubId=${currentClubId}`),
          fetch(`/api/promo/public-info?clubId=${currentClubId}`),
          fetch(`/api/promo/player/quests`),
        ]);

        const prizesData = await prizesRes.json();
        if (prizesData.success) {
          setPrizes(prizesData.prizes || []);
        }

        const productsData = await productsRes.json();
        console.log("[Client] Fetched Products:", {
          clubId: currentClubId,
          success: productsData.success,
          count: productsData.products?.length,
          products: productsData.products,
          debug: productsData._debug,
        });
        if (productsData.success) {
          setProducts(productsData.products || []);
        }

        const clubData = await clubRes.json();
        if (clubData.success) {
          setPublicClubInfo(clubData.club);
        }

        const questsData = await questsRes.json();
        if (questsRes.ok) {
          setQuests(questsData.quests || []);
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
  }, [urlClubId, action]);

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const cartTotal = cart.reduce(
    (acc, item) =>
      acc +
      (item.bonus_price || item.selling_price * multiplier) * item.quantity,
    0,
  );

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
      {/* Order Confirmation Dialog */}
      <AnimatePresence>
        {showOrderDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-[#151515] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black uppercase italic tracking-tight">
                  Ваш <span className="text-orange-500">Заказ</span>
                </h3>
                <p className="text-gray-400 text-xs font-medium">
                  Проверьте состав заказа перед отправкой администратору
                </p>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs truncate">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                        {item.quantity} шт.
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-yellow-500 font-black text-sm">
                      <Coins className="w-3 h-3" />
                      {(item.bonus_price ||
                        Math.floor(item.selling_price * multiplier)) *
                        item.quantity}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/5 space-y-6">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                    Итого к оплате
                  </span>
                  <div className="flex items-center gap-2 text-2xl font-black text-orange-500 italic">
                    <Coins className="w-6 h-6" />
                    {Math.floor(cartTotal)}
                  </div>
                </div>

                {(() => {
                  const isLimitEnabled = player?.settings?.withdraw_limit_enabled === true;
                  if (!isLimitEnabled) return null;

                  const monthlyTopups = player?.monthlyTopups || 0;
                  const monthlyWithdrawn = player?.monthlyWithdrawn || 0;
                  const extraLimit = parseFloat(player?.extraWithdrawLimit || 0);

                  const { percent: basePercent } = getTierInfo(monthlyTopups, player?.limitGroupId, player?.settings?.limit_groups);
                  let bpBoost = 15;
                  if (player?.settings?.withdraw_limit_percent_bp !== undefined && player?.settings?.withdraw_limit_percent !== undefined) {
                    bpBoost = Math.max(0, parseFloat(player.settings.withdraw_limit_percent_bp) - parseFloat(player.settings.withdraw_limit_percent));
                  }
                  
                  const finalPercent = player?.hasPremiumBp ? Math.min(100, basePercent + bpBoost) : basePercent;
                  const allowedLimit = (monthlyTopups * (finalPercent / 100)) + extraLimit;
                  const remainingLimit = Math.max(0, allowedLimit - monthlyWithdrawn);
                  const limitExceeded = cartTotal > remainingLimit;

                  if (limitExceeded) {
                    return (
                      <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center">
                        Превышен лимит вывода! Доступно: {Math.floor(remainingLimit)} ₽, заказ: {Math.floor(cartTotal)} ₽.
                      </p>
                    );
                  }
                  return null;
                })()}

                <div className="space-y-3">
                  <button
                    onClick={() => handleCheckIn("bonus_order")}
                    disabled={
                      isCheckingIn || 
                      cartTotal > (player?.bonusBalance || 0) ||
                      (() => {
                        const isLimitEnabled = player?.settings?.withdraw_limit_enabled === true;
                        if (!isLimitEnabled) return false;
                        
                        const monthlyTopups = player?.monthlyTopups || 0;
                        const monthlyWithdrawn = player?.monthlyWithdrawn || 0;
                        const extraLimit = parseFloat(player?.extraWithdrawLimit || 0);

                        const { percent: basePercent } = getTierInfo(monthlyTopups, player?.limitGroupId, player?.settings?.limit_groups);
                        let bpBoost = 15;
                        if (player?.settings?.withdraw_limit_percent_bp !== undefined && player?.settings?.withdraw_limit_percent !== undefined) {
                          bpBoost = Math.max(0, parseFloat(player.settings.withdraw_limit_percent_bp) - parseFloat(player.settings.withdraw_limit_percent));
                        }
                        
                        const finalPercent = player?.hasPremiumBp ? Math.min(100, basePercent + bpBoost) : basePercent;
                        const allowedLimit = (monthlyTopups * (finalPercent / 100)) + extraLimit;
                        const remainingLimit = Math.max(0, allowedLimit - monthlyWithdrawn);
                        return cartTotal > remainingLimit;
                      })()
                    }
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:grayscale text-white py-5 rounded-3xl font-black uppercase italic text-lg shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
                  >
                    {isCheckingIn ? (
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    ) : (
                      "Подтвердить"
                    )}
                  </button>
                  <button
                    onClick={() => setShowOrderDialog(false)}
                    className="w-full text-center text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors py-2"
                  >
                    Изменить заказ
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Intent Selection Dialog */}{" "}
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
                  onClick={() => {
                    const needsSeat = quests.some(
                      (q) =>
                        q.requires_seat_number &&
                        q.status !== "completed" &&
                        q.status !== "claimed"
                    );
                    if (needsSeat) {
                      setTempSeatNumber("");
                      setShowSeatDialog(true);
                      setShowIntentDialog(false);
                    } else {
                      handleCheckIn("visit");
                    }
                  }}
                  disabled={isCheckingIn}
                  className="group flex items-center gap-4 w-full bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/50 p-6 rounded-3xl transition-all active:scale-[0.98] text-left"
                >
                  <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-black uppercase italic text-lg leading-tight">
                      Отметиться
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                      Выполнить квест на посещение
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
                    <ShoppingCart className="w-6 h-6 text-white" />
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

                {cart.length > 0 && (
                  <button
                    onClick={() => handleCheckIn("bonus_order")}
                    disabled={
                      isCheckingIn || cartTotal > (player?.bonusBalance || 0)
                    }
                    className="group flex items-center gap-4 w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 p-6 rounded-3xl transition-all active:scale-[0.98] text-left disabled:opacity-50 disabled:grayscale"
                  >
                    <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                      <Gift className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-black uppercase italic text-lg leading-tight">
                        За бонусы
                      </div>
                      <div className="text-[10px] text-orange-400 font-bold uppercase tracking-widest mt-1">
                        Оплата баллами: {Math.floor(cartTotal)}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-orange-500" />
                  </button>
                )}
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

      {/* Seat Number Input Dialog */}
      <AnimatePresence>
        {showSeatDialog && (
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
              className="w-full max-w-sm bg-[#151515] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black uppercase italic tracking-tight">
                  Ваше <span className="text-orange-500">Место</span>
                </h3>
                <p className="text-gray-400 text-sm font-medium">
                  Для выполнения квеста укажите номер вашего ПК или игрового места.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block px-1">
                  Номер ПК / Места
                </label>
                <input
                  type="text"
                  placeholder="Например: ПК 15"
                  value={tempSeatNumber}
                  onChange={(e) => setTempSeatNumber(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all placeholder:text-gray-600"
                />
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => {
                    handleCheckIn("visit", tempSeatNumber);
                    setShowSeatDialog(false);
                  }}
                  disabled={isCheckingIn || !tempSeatNumber.trim()}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-4 rounded-3xl font-black uppercase italic text-base shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
                >
                  {isCheckingIn ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Подтвердить"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowSeatDialog(false);
                    setShowIntentDialog(true);
                  }}
                  className="w-full text-center text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors py-2"
                >
                  Назад
                </button>
              </div>
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
        playerLevel={player?.level?.currentLevel}
      />
      <main className="max-w-6xl mx-auto p-4 sm:p-6 pt-6 sm:pt-8 pb-48 sm:pb-36">
        {activeTab === "games" && (
          <>


            {/* Active Boost Banner */}
            {player?.activeBoostPercent > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 bg-gradient-to-br from-amber-500/15 via-yellow-500/5 to-transparent border border-amber-500/25 hover:border-amber-500/40 rounded-[2rem] p-5 sm:p-6 shadow-lg shadow-black/20 relative overflow-hidden group"
              >
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none" />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-base font-black uppercase italic tracking-tight text-amber-400">
                      Активен буст вывода: +{player.activeBoostPercent}%
                    </h4>
                    <p className="text-xs text-gray-300 font-medium leading-relaxed max-w-xl">
                      Следующее пополнение счета на кассе увеличит ваш лимит вывода на {player.activeBoostPercent}% от суммы
                    </p>
                  </div>
                  <Link
                    href="/promo/withdraw"
                    className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-400 group-hover:text-amber-300 shrink-0 transition-colors self-start sm:self-center"
                  >
                    <span>Подробнее</span>
                    <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </motion.div>
            )}

            {/* FRAG RATING SYSTEM INFO BANNER */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden group cursor-pointer bg-white/5 border border-white/10 hover:border-white/20 rounded-[2rem] p-5 sm:p-6 transition-all duration-300 mb-8"
              onClick={() => router.push("/promo/frag")}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="space-y-1.5">
                  <h3 className="text-base font-black uppercase italic leading-snug text-white group-hover:text-indigo-300 transition-colors">
                    Рейтинг FRAG
                  </h3>
                  <p className="text-xs text-gray-300 font-medium leading-relaxed max-w-xl">
                    Получай бонусы на баланс, просто играя в CS2, Dota 2 и PUBG на клубных ПК — забирай награды за каждый матч
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">CS2</span>
                    <span className="text-gray-600">•</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Dota 2</span>
                    <span className="text-gray-600">•</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">PUBG</span>
                    <span className="text-gray-600">•</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Бонусы за фраги и победы</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-indigo-400 group-hover:text-indigo-300 shrink-0 transition-colors self-start sm:self-center">
                  <span>Матчи и рейтинг</span>
                  <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>

            {/* Loyalty Programs Section */}
            {player && getActivePrograms(player.settings).length > 0 && (
              <div className="mb-12">
                <div className="mb-6">
                  <h3 className="text-xl font-black uppercase italic tracking-tight">
                    Программы лояльности
                  </h3>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                    Копи посещения, пакеты и получай ценные подарки в клубе
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {getActivePrograms(player.settings).map((program: any) => {
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

                    const triggerProducts = (program.trigger_product_ids || []).map((id: number) => {
                      const prod = products.find((p: any) => p.id === id);
                      return prod ? prod.name : null;
                    }).filter(Boolean);

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
                      if (program.rewards.xp > 0) {
                        rewardItems.push({
                          text: `+${program.rewards.xp} XP`,
                          className: "text-blue-400"
                        });
                      }
                      if (program.rewards.tickets > 0) {
                        rewardItems.push({
                          text: `+${program.rewards.tickets} билета`,
                          className: "text-orange-400"
                        });
                      }
                      if (program.rewards.bonus_balance > 0) {
                        rewardItems.push({
                          text: `+${program.rewards.bonus_balance} бонусов`,
                          className: "text-yellow-400"
                        });
                      }
                      if (program.rewards.free_package || program.rewards.free_package === "true") {
                        const freeQty = Math.max(1, Number(program.rewards.free_package_quantity || 1));
                        const freeQtySuffix = freeQty > 1 ? ` (x${freeQty})` : "";
                        rewardItems.push({
                          text: `Пакет: ${program.rewards.free_package_name || "Бесплатный пакет"}${freeQtySuffix}`,
                          className: "text-indigo-400"
                        });
                      }
                      const qty = Math.max(1, Number(program.rewards.bar_reward_quantity || 1));
                      const qtySuffix = qty > 1 ? ` (x${qty})` : "";
                      if (program.rewards.bar_reward_type === "product" && program.rewards.bar_product_id) {
                        const rewardProduct = products.find((p: any) => String(p.id) === String(program.rewards.bar_product_id));
                        rewardItems.push({
                          text: rewardProduct ? `Товар: ${rewardProduct.name}${qtySuffix}` : `Товар из бара${qtySuffix}`,
                          className: "text-emerald-400"
                        });
                      } else if (program.rewards.bar_reward_type === "category") {
                        rewardItems.push({
                          text: `Товар из бара${qtySuffix}`,
                          className: "text-emerald-400"
                        });
                      }
                    } else if (program.isLegacy) {
                      rewardItems.push({
                        text: program.title || "Бесплатный пакет",
                        className: "text-indigo-400"
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
                          watermarkColor: "text-orange-500",
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
                          watermarkColor: "text-amber-500",
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
                          watermarkColor: "text-indigo-500",
                          badge: "bg-indigo-500/10 border-indigo-500/20 text-indigo-300",
                        };

                    return (
                      <motion.div
                        key={program.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-6 flex flex-col justify-between min-h-0 sm:min-h-[18rem] relative overflow-hidden group border transition-all duration-300 bg-gradient-to-br shadow-lg shadow-black/20",
                          loyaltyTheme.gradient,
                          loyaltyTheme.border
                        )}
                      >
                        {/* Dynamic Background Glow */}
                        <div className={cn("absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-30 group-hover:opacity-70 transition-opacity pointer-events-none", loyaltyTheme.glow)} />

                        <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-15 transition-opacity pointer-events-none select-none duration-500">
                          {program.type === "visit_streak" ? (
                            <Flame className={cn("w-24 h-24", loyaltyTheme.watermarkColor)} />
                          ) : program.type === "visit_accumulation" ? (
                            <Award className={cn("w-24 h-24", loyaltyTheme.watermarkColor)} />
                          ) : (
                            <Gift className={cn("w-24 h-24", loyaltyTheme.watermarkColor)} />
                          )}
                        </div>

                        <div className="relative z-10">
                          <p className={cn("text-base font-black uppercase text-white tracking-tight leading-snug line-clamp-2 transition-colors", loyaltyTheme.hoverTitle)}>
                            {rewardName}
                          </p>

                          {/* Trigger condition details */}
                          <div className="mt-3 sm:mt-4 space-y-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 block">Условие:</span>
                            <p className="text-[11px] text-gray-200 font-bold uppercase tracking-wide leading-relaxed">
                              {triggerText}
                            </p>
                          </div>

                          {/* Rewards list display */}
                          {rewardItems.length > 0 && (
                            <div className="mt-3 sm:mt-4 space-y-1">
                              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 block">Награда:</span>
                              <div className="text-[11px] font-black uppercase tracking-wide flex flex-wrap items-center gap-x-2 gap-y-1">
                                {rewardItems.map((r, i) => (
                                  <React.Fragment key={i}>
                                    {i > 0 && <span className="text-gray-600 font-normal">•</span>}
                                    <span className={r.className}>{r.text}</span>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4 relative z-10">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-gray-300">
                              <span>Прогресс</span>
                              <span className="font-black text-white">
                                <span className={loyaltyTheme.accent}>{current}</span> / {target}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full bg-gradient-to-r transition-all duration-500", loyaltyTheme.progressBar)}
                                style={{ width: `${Math.min(100, (current / target) * 100)}%` }}
                              />
                            </div>
                          </div>

                          {isCompleted ? (
                            isPending ? (
                              <button
                                disabled
                                className="w-full py-2.5 bg-white/10 text-gray-400 rounded-xl font-black uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 border border-white/5"
                              >
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Ожидает выдачи в клубе
                              </button>
                            ) : (
                              <button
                                onClick={() => handleClaimLoyalty(program.isLegacy ? program.legacyType : program.id, program.isLegacy)}
                                disabled={claimingLoyalty !== null}
                                className={cn(
                                  "w-full py-2.5 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all hover:scale-[1.02] shadow-lg animate-pulse cursor-pointer bg-gradient-to-r",
                                  loyaltyTheme.progressBar,
                                  loyaltyTheme.shadow
                                )}
                              >
                                {claimingLoyalty === (program.isLegacy ? program.legacyType : program.id) ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                                ) : (
                                  "Забрать подарок"
                                )}
                              </button>
                            )
                          ) : (
                            <div className={cn("text-[9px] font-black uppercase tracking-wider text-center py-2 rounded-xl border flex items-center justify-center gap-1", loyaltyTheme.badge)}>
                              <span>
                                Осталось: {Math.max(0, target - current)}{" "}
                                {program.type === "visit_accumulation" ? "раз(а)" : program.type === "visit_streak" ? "дн." : "шт."}
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Pending Prizes — show player what awaits them at the cashier */}
                {(player.packageProgress?.pendingPrizes?.length ?? 0) > 0 && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-amber-400">
                      Ваши призы ждут в клубе
                    </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {player.packageProgress.pendingPrizes.map((prize: any) => (
                        <div
                          key={prize.id}
                          className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3"
                        >
                          <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                            {prize.prize_type === "bar_item" ? (
                              <ShoppingCart className="w-4 h-4 text-amber-500" />
                            ) : (
                              <Gift className="w-4 h-4 text-amber-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">
                              {prize.prize_name}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/70 mt-0.5">
                              {prize.prize_type === "bar_item"
                                ? "Подойди на кассу — кассир выдаст напиток"
                                : "Подойди на кассу для получения"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                    className="bg-white/5 border border-white/10 rounded-[2rem] p-6 mb-8 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                      <Ticket className="w-20 h-20 text-orange-500" />
                    </div>
                    <h4 className="text-base font-black uppercase italic tracking-tight text-white mb-2 relative z-10">
                      Билеты
                    </h4>
                    <p className="text-gray-400 text-xs leading-relaxed max-w-2xl font-medium relative z-10">
                      Используй билеты для участия в призовых играх. Каждый билет — это шанс выиграть реальные подарки: от напитков до игрового времени на баланс.
                    </p>
                  </motion.div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {ticketGames.map((game, index) => {
                      const config =
                        publicClubInfo?.settings?.game_configs?.[game.id];
                      const minLevel = config?.min_level || 0;
                      const playerLevel = player?.level?.currentLevel || 1;
                      const locked = playerLevel < minLevel;

                      return (
                        <GameCard
                          key={game.id}
                          game={game}
                          index={index}
                          locked={locked}
                          minLevel={minLevel}
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
              className="mb-16"
            >
              <Link
                href="/promo/accruals"
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all group"
              >
                <div className="space-y-1">
                  <h4 className="font-black uppercase italic tracking-tight text-white group-hover:text-amber-400 transition-colors">
                    Как получить билеты?
                  </h4>
                  <p className="text-xs text-gray-400 font-medium">
                    Смотри правила и историю своих начислений
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-white transition-colors" />
              </Link>
            </motion.div>

            {/* Stakes Category */}
            {(() => {
              const stakesGames = GAMES.filter(
                (g) =>
                  g.category === "stakes" &&
                  (publicClubInfo?.settings?.enabled_games || []).includes(g.id),
              );

              if (stakesGames.length === 0) return null;

              return (
                <section className="mb-16">
                  <div className="flex items-center gap-4 mb-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
                      Игры на ставки
                    </h3>
                    <div className="h-px w-full bg-white/5" />
                  </div>

                  {/* Stakes Info Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-[2rem] p-6 mb-8 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                      <Coins className="w-20 h-20 text-yellow-500" />
                    </div>
                    <h4 className="text-base font-black uppercase italic tracking-tight text-white mb-2 relative z-10">
                      Ставка
                    </h4>
                    <p className="text-gray-400 text-xs leading-relaxed max-w-2xl font-medium relative z-10">
                      Играй на свои бонусы! Умножай накопленный баланс в динамичных играх, но будь осторожен — здесь всё зависит от твоей стратегии и удачи.
                    </p>
                  </motion.div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stakesGames.map((game, index) => {
                      const config =
                        publicClubInfo?.settings?.game_configs?.[game.id];
                      const minLevel = config?.min_level || 0;
                      const playerLevel = player?.level?.currentLevel || 1;
                      const locked = playerLevel < minLevel;

                      return (
                        <GameCard
                          key={game.id}
                          game={game}
                          index={index}
                          locked={locked}
                          minLevel={minLevel}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })()}
          </>
        )}

        {activeTab === "shop" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Banner header */}
            <div className="relative rounded-3xl sm:rounded-[2rem] bg-gradient-to-br from-amber-500/15 via-orange-500/5 to-transparent border border-amber-500/25 p-5 sm:p-6 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl opacity-40 pointer-events-none" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white leading-snug">
                    Маркет бонусов
                  </h2>
                  <p className="text-gray-300 text-xs sm:text-sm font-medium leading-relaxed max-w-xl">
                    Обменивай накопленные баллы на напитки, снеки и фирменные товары из бара клуба.
                  </p>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setShowOrderDialog(true)}
                    className="bg-amber-400 hover:bg-amber-300 text-black font-black uppercase tracking-wider text-xs px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-amber-400/20 active:scale-[0.98] shrink-0 cursor-pointer"
                  >
                    Оформить заказ ({Math.floor(cartTotal)} 🪙)
                  </button>
                )}
              </div>
            </div>

            {player?.settings?.withdraw_limit_enabled === true && (() => {
              const monthlyTopups = player?.monthlyTopups || 0;
              const monthlyWithdrawn = player?.monthlyWithdrawn || 0;
              const extraLimit = parseFloat(player?.extraWithdrawLimit || 0);

              const { percent: basePercent } = getTierInfo(monthlyTopups, player?.limitGroupId, player?.settings?.limit_groups);
              let bpBoost = 15;
              if (player?.settings?.withdraw_limit_percent_bp !== undefined && player?.settings?.withdraw_limit_percent !== undefined) {
                bpBoost = Math.max(0, parseFloat(player.settings.withdraw_limit_percent_bp) - parseFloat(player.settings.withdraw_limit_percent));
              }
              const limitGroups = player?.settings?.limit_groups;
              const activeGroup = player?.limitGroupId && Array.isArray(limitGroups)
                ? limitGroups.find((g: any) => g.id === player.limitGroupId)
                : null;

              const limitPercent = player?.hasPremiumBp ? Math.min(100, basePercent + bpBoost) : basePercent;
              const allowedLimit = (monthlyTopups * (limitPercent / 100)) + extraLimit;
              const remainingLimit = Math.max(0, allowedLimit - monthlyWithdrawn);
              const progressPercent = allowedLimit > 0 ? (monthlyWithdrawn / allowedLimit) * 100 : 0;

              return (
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1 space-y-2 w-full">
                      <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-gray-400">
                        <span>Лимит на покупки ({new Date().toLocaleString("ru-RU", { month: "long" })})</span>
                        <div className="flex items-center gap-2">
                          {activeGroup && (
                            <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                              ✨ {activeGroup.name}
                            </span>
                          )}
                          {player?.hasPremiumBp ? (
                            <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                              🔥 BP {limitPercent}%
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-lg border border-amber-500/20">
                              {limitPercent}%
                            </span>
                          )}
                          <span className="text-amber-400 font-bold">{Math.floor(remainingLimit)} ₽ осталось из {Math.floor(allowedLimit)} ₽</span>
                        </div>
                      </div>
                      <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, progressPercent)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-xs font-medium text-gray-400 leading-relaxed md:max-w-xs shrink-0">
                      {remainingLimit <= 0 ? (
                        <>
                          Лимит исчерпан. <span className="text-amber-400 font-bold">Пополните счет</span> или купите в баре за рубли, чтобы увеличить лимит!
                        </>
                      ) : (
                        <>
                          Оплата бонусами расходует ваш ежемесячный лимит на покупки в клубе.
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            <AnimatePresence>
              {cart.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-8"
                >
                  <div className="bg-white/5 border border-white/10 p-5 rounded-3xl">
                    <h4 className="font-black text-xs text-amber-400 uppercase italic mb-1">
                      Как получить товар?
                    </h4>
                    <p className="text-xs text-gray-300 font-medium leading-relaxed">
                      Подойдите к администратору, покажите профиль и нажмите <span className="text-white font-bold">«За бонусы»</span> для подтверждения выдачи.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-10">
              {(
                Object.entries(
                  products.reduce(
                    (acc, product) => {
                      const cat = product.category_name || "Прочее";
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(product);
                      return acc;
                    },
                    {} as Record<string, any[]>,
                  ),
                ) as [string, any[]][]
              ).map(([category, catProducts]) => (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
                      {category}
                    </h3>
                    <div className="h-px w-full bg-white/5" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                    {catProducts.map((product) => {
                      const bonusPrice =
                        product.bonus_price ||
                        Math.floor(product.selling_price * multiplier);
                      const inCart =
                        cart.find((i) => i.id === product.id)?.quantity || 0;

                      return (
                        <div
                          key={product.id}
                          className="bg-white/5 border border-white/10 hover:border-white/20 rounded-3xl p-4 sm:p-5 flex flex-col justify-between group transition-all duration-300"
                        >
                          <div className="space-y-2">
                            <div className="font-bold text-sm sm:text-base text-white leading-tight line-clamp-2">
                              {product.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-yellow-400">
                              <Coins className="w-4 h-4" />
                              <span className="font-black text-base sm:text-lg">
                                {bonusPrice}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/5">
                            {inCart > 0 ? (
                              <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl w-full overflow-hidden h-10">
                                <button
                                  onClick={() => removeFromCart(product.id)}
                                  className="w-full h-full flex items-center justify-center hover:bg-white/10 transition-colors text-sm font-bold text-gray-300"
                                >
                                  -
                                </button>
                                <span className="w-full text-center font-black text-xs text-white">
                                  {inCart}
                                </span>
                                <button
                                  onClick={() => addToCart(product)}
                                  className="w-full h-full flex items-center justify-center hover:bg-white/10 transition-colors text-sm font-bold text-gray-300"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(product)}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 h-10 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-all cursor-pointer"
                              >
                                В корзину
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {products.length === 0 && (
              <div className="text-center py-20 bg-white/5 border border-white/10 border-dashed rounded-[2.5rem]">
                <p className="text-gray-500 font-medium italic">
                  Товары временно недоступны
                </p>
              </div>
            )}
          </motion.div>
        )}
      </main>
      <BottomNav cartCount={cart.reduce((acc, i) => acc + i.quantity, 0)} />
    </div>
  );
}

function GameCard({
  game,
  index,
  locked,
  minLevel,
}: {
  game: any;
  index: number;
  locked?: boolean;
  minLevel?: number;
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

  const content = (
    <div
      className={cn(
        "h-full relative p-5 sm:p-7 rounded-3xl sm:rounded-[2.5rem] border transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-0 sm:min-h-[16.5rem]",
        locked
          ? "border-white/5 bg-white/[0.02] opacity-60"
          : cn("bg-gradient-to-br group hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg shadow-black/20", theme.gradient, theme.border)
      )}
    >
      {/* Dynamic Background Glow */}
      {!locked && (
        <div className={cn("absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-30 group-hover:opacity-70 transition-opacity pointer-events-none", theme.glow)} />
      )}

      <div className="relative z-10">
        <div className="mb-1.5 sm:mb-2">
          <h3
            className={cn(
              "text-lg sm:text-xl font-black uppercase italic tracking-tight transition-colors",
              !locked ? cn("text-white", theme.hoverTitle) : "text-white/40"
            )}
          >
            {game.title}
          </h3>
        </div>

        <p
          className={cn(
            "text-xs leading-relaxed font-medium mb-3 sm:mb-6",
            locked ? "text-gray-600" : "text-gray-300"
          )}
        >
          {game.desc}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between pt-3 sm:pt-4 border-t border-white/5 relative z-10">
        <span
          className={cn(
            "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
            locked ? "text-white/20 bg-white/5 border-white/5" : theme.badge
          )}
        >
          {game.cost}
        </span>

        {locked ? (
          <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">
            Нужен уровень {minLevel}
          </span>
        ) : (
          <div className={cn("w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 shadow-md", theme.btn)}>
            <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-0.5 transition-transform" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      {locked ? content : <Link href={game.href}>{content}</Link>}
    </motion.div>
  );
}
