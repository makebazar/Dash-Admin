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
import { BPPlayerWidget } from "./components/BPPlayerWidget";
import { cn } from "@/lib/utils";

/**
 * ГЛАВНОЕ ЛОББИ ИГРОВОЙ ЗОНЫ
 */

const GAMES = [
  {
    id: "wheel",
    title: "Колесо Фортуны",
    desc: "Крути легендарное колесо и выигрывай ценные призы: от игрового времени до реальных бонусов.",
    href: "/promo/wheel",
    color: "from-orange-500/20 to-red-500/20",
    borderColor: "border-orange-500/30",
    category: "tickets",
    cost: "1 билет",
  },
  {
    id: "safe",
    title: "Взлом Сейфа",
    desc: "Проверь свою интуицию! Угадай секретный код и сорви куш, который спрятан за стальной дверью.",
    href: "/promo/safe",
    color: "from-green-500/20 to-emerald-500/20",
    borderColor: "border-green-500/30",
    category: "tickets",
    cost: "1 билет",
  },
  {
    id: "dice",
    title: "Бросок Удачи",
    desc: "Классика азарта. Бросай кости и надейся на удачную комбинацию, которая принесет тебе победу.",
    href: "/promo/dice",
    color: "from-blue-500/20 to-indigo-500/20",
    borderColor: "border-blue-500/30",
    category: "tickets",
    cost: "1 билет",
  },
  {
    id: "cards",
    title: "Карты",
    desc: "Три карты, один шанс. Найди ту самую выигрышную комбинацию и удвой свои возможности.",
    href: "/promo/cards",
    color: "from-purple-500/20 to-pink-500/20",
    borderColor: "border-purple-500/30",
    category: "tickets",
    cost: "1 билет",
  },
  {
    id: "flappy",
    title: "Flappy Dash",
    desc: "Аркадное испытание для самых ловких. Продержись как можно дольше и заработай максимум бонусов.",
    href: "/promo/flappy",
    color: "from-green-500/20 to-emerald-500/20",
    borderColor: "border-green-500/30",
    category: "stakes",
    cost: "Ставка",
  },
  {
    id: "mines",
    title: "Mines",
    desc: "Стратегия и риск. Ищи спрятанные сокровища на поле, но будь осторожен — одно неверное движение и всё исчезнет.",
    href: "/promo/mines",
    color: "from-orange-500/20 to-yellow-500/20",
    borderColor: "border-orange-500/30",
    category: "stakes",
    cost: "Ставка",
  },
  {
    id: "rocket",
    title: "Rocket",
    desc: "Следи за графиком взлета и успей забрать выигрыш до того, как ракета улетит в стратосферу.",
    href: "/promo/rocket",
    color: "from-blue-500/20 to-cyan-500/20",
    borderColor: "border-blue-500/30",
    category: "stakes",
    cost: "Ставка",
  },
  {
    id: "plinko",
    title: "Plinko Dash",
    desc: "Запусти шарик сквозь неоновые колышки и сорви множитель до x100 в зависимости от того, куда он упадет.",
    href: "/promo/plinko",
    color: "from-pink-500/20 to-purple-500/20",
    borderColor: "border-pink-500/30",
    category: "stakes",
    cost: "Ставка",
  },
  {
    id: "coinflip",
    title: "Coin Flip 3D",
    desc: "Орёл или Решка? Выбери сторону монеты, удвой ставку или набери серию побед вплоть до рекордных x8!",
    href: "/promo/coinflip",
    color: "from-yellow-500/20 to-amber-500/20",
    borderColor: "border-yellow-500/30",
    category: "stakes",
    cost: "Ставка",
  },
  {
    id: "tower",
    title: "Tower Climb",
    desc: "Поднимайся по этажам башни, угадывай безопасные неоновые плиты и приумножай баланс с каждым шагом.",
    href: "/promo/tower",
    color: "from-blue-500/20 to-indigo-500/20",
    borderColor: "border-blue-500/30",
    category: "stakes",
    cost: "Ставка",
  },
  {
    id: "hilo",
    title: "Hi-Lo Cards",
    desc: "Больше или меньше? Угадай значение следующей карты в колоде с динамическими шансами и множителями.",
    href: "/promo/hilo",
    color: "from-red-500/20 to-orange-500/20",
    borderColor: "border-red-500/30",
    category: "stakes",
    cost: "Ставка",
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
      <main className="max-w-6xl mx-auto p-6 pt-10 pb-32">
        {activeTab === "games" && (
          <>
            {/* Battle Pass Section */}
            {player?.bp && (
              <div className="mb-12">
                <BPPlayerWidget bp={player.bp} />
              </div>
            )}

            {/* Active Boost Banner */}
            {player?.activeBoostPercent > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-12 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-yellow-500/10 border border-yellow-500/20 rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(234,179,8,0.05)] relative overflow-hidden group"
              >
                {/* Decorative background glow */}
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-yellow-500/10 blur-3xl rounded-full" />
                <div className="absolute -left-10 -top-10 w-40 h-40 bg-amber-500/5 blur-3xl rounded-full" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center shrink-0">
                      <motion.div
                        animate={{
                          scale: [1, 1.1, 1],
                          rotate: [0, -10, 10, -10, 10, 0]
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.5,
                          repeatDelay: 3
                        }}
                      >
                        <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500/30" />
                      </motion.div>
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase italic tracking-tight text-yellow-500">
                        Активен буст вывода: +{player.activeBoostPercent}%
                      </h4>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1 leading-relaxed">
                        Ваше следующее пополнение счета на кассе увеличит ваш лимит вывода на {player.activeBoostPercent}% от суммы!
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/promo/withdraw"
                    className="flex-none bg-yellow-500 hover:bg-yellow-600 text-black text-xs font-black uppercase tracking-widest px-6 py-3.5 rounded-2xl transition-all active:scale-95 flex items-center gap-2"
                  >
                    Подробнее <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            )}

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
                      const rule = player?.settings?.service_rules?.find((r: any) => String(r.id) === String(id));
                      return rule ? rule.name : null;
                    }).filter(Boolean);

                    const triggerProducts = (program.trigger_product_ids || []).map((id: number) => {
                      const prod = products.find((p: any) => p.id === id);
                      return prod ? prod.name : null;
                    }).filter(Boolean);

                    let triggerText = "";
                    const items = [...triggerServices, ...triggerProducts];
                    if (program.type === "package_accumulation") {
                      if (items.length > 0) {
                        triggerText = `Покупка: ${items.join(", ")}`;
                      } else {
                        triggerText = "Покупка любого пакета";
                      }
                    } else if (program.type === "visit_accumulation") {
                      if (items.length > 0) {
                        triggerText = `Визит с покупкой: ${items.join(", ")}`;
                      } else {
                        triggerText = "Визит с покупкой любого пакета";
                      }
                    } else if (program.type === "visit_streak") {
                      if (items.length > 0) {
                        triggerText = `Каждый день покупка: ${items.join(", ")}`;
                      } else {
                        triggerText = "Каждый день покупка любого пакета";
                      }
                    }

                    const rewardItems: { text: string; icon: string; className: string }[] = [];
                    if (program.rewards) {
                      if (program.rewards.xp > 0) {
                        rewardItems.push({
                          text: `+${program.rewards.xp} XP`,
                          icon: "⚡",
                          className: "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        });
                      }
                      if (program.rewards.tickets > 0) {
                        rewardItems.push({
                          text: `+${program.rewards.tickets} билета`,
                          icon: "🎟️",
                          className: "bg-orange-500/10 border-orange-500/20 text-orange-400"
                        });
                      }
                      if (program.rewards.bonus_balance > 0) {
                        rewardItems.push({
                          text: `+${program.rewards.bonus_balance} бонусов`,
                          icon: "🪙",
                          className: "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
                        });
                      }
                      if (program.rewards.free_package || program.rewards.free_package === "true") {
                        const freeQty = Math.max(1, Number(program.rewards.free_package_quantity || 1));
                        const freeQtySuffix = freeQty > 1 ? ` (x${freeQty})` : "";
                        rewardItems.push({
                          text: `Пакет: ${program.rewards.free_package_name || "Бесплатный пакет"}${freeQtySuffix}`,
                          icon: "🎁",
                          className: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                        });
                      }
                      const qty = Math.max(1, Number(program.rewards.bar_reward_quantity || 1));
                      const qtySuffix = qty > 1 ? ` (x${qty})` : "";
                      if (program.rewards.bar_reward_type === "product" && program.rewards.bar_product_id) {
                        const rewardProduct = products.find((p: any) => String(p.id) === String(program.rewards.bar_product_id));
                        rewardItems.push({
                          text: rewardProduct ? `Товар: ${rewardProduct.name}${qtySuffix}` : `Товар из бара${qtySuffix}`,
                          icon: "🍔",
                          className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        });
                      } else if (program.rewards.bar_reward_type === "category") {
                        rewardItems.push({
                          text: `Товар из бара${qtySuffix}`,
                          icon: "🍔",
                          className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        });
                      }
                    } else if (program.isLegacy) {
                      rewardItems.push({
                        text: program.title || "Бесплатный пакет",
                        icon: "🎁",
                        className: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                      });
                    }

                    let rewardName = program.title || "";
                    if (!rewardName) {
                      if (program.type === "package_accumulation") rewardName = program.rewards?.free_package_name || "Бесплатный пакет";
                      else if (program.type === "visit_accumulation") rewardName = "Подарок за посещения";
                      else rewardName = "Приз за серию дней";
                    }

                    return (
                      <motion.div
                        key={program.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex flex-col justify-between min-h-[18rem] relative overflow-hidden group hover:border-white/20 transition-all duration-300"
                      >
                        <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-10 transition-opacity pointer-events-none select-none duration-500">
                          {program.type === "visit_streak" ? (
                            <Flame className="w-24 h-24 text-white animate-pulse" />
                          ) : program.type === "visit_accumulation" ? (
                            <Award className="w-24 h-24 text-white" />
                          ) : (
                            <Gift className="w-24 h-24 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            {program.type === "visit_streak" ? (
                              <Flame className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform animate-pulse" />
                            ) : program.type === "visit_accumulation" ? (
                              <Award className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
                            ) : (
                              <Gift className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                            )}
                            <h4 className="font-black uppercase italic text-xs tracking-wider text-gray-400">
                              {program.type === "package_accumulation"
                                ? "Накопление"
                                : program.type === "visit_accumulation"
                                ? "Посещения"
                                : "Серия дней"}
                            </h4>
                          </div>
                          
                          <p className="text-base font-black uppercase text-white tracking-tight leading-snug line-clamp-2">
                            {rewardName}
                          </p>

                          {/* Trigger condition details */}
                          <div className="mt-4 space-y-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 block">Условие:</span>
                            <div className="text-[10px] text-gray-200 font-bold uppercase tracking-wider bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2 leading-relaxed">
                              {triggerText}
                            </div>
                          </div>

                          {/* Rewards list display */}
                          {rewardItems.length > 0 && (
                            <div className="mt-4 space-y-1.5">
                              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 block">Награда:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {rewardItems.map((r, i) => (
                                  <span key={i} className={`inline-flex items-center gap-1.5 border text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl transition-all duration-300 ${r.className}`}>
                                    <span className="text-xs">{r.icon}</span>
                                    <span>{r.text}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-4 mt-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-gray-500">
                              <span>Прогресс</span>
                              <span className="text-amber-500">{current} / {target}</span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
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
                                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all hover:scale-[1.02] shadow-lg shadow-orange-500/20 animate-pulse cursor-pointer"
                              >
                                {claimingLoyalty === (program.isLegacy ? program.legacyType : program.id) ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                                ) : (
                                  "Забрать подарок"
                                )}
                              </button>
                            )
                          ) : (
                            <div className="text-[9px] font-black uppercase tracking-wider text-gray-400 text-center py-2 bg-white/3 rounded-xl border border-white/5 flex items-center justify-center gap-1">
                              {program.type === "visit_streak" && <Flame className="w-3 h-3 text-orange-500 animate-pulse" />}
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
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Ticket className="w-20 h-20 text-orange-500" />
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Ticket className="w-4 h-4 text-orange-500" />
                  </div>
                  <h4 className="text-md font-black uppercase italic tracking-tight">
                    Билеты
                  </h4>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed max-w-2xl">
                  Используй билеты для участия в призовых играх. Каждый билет — это шанс выиграть реальные подарки: от напитков до игрового времени на баланс.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {GAMES.filter(
                  (g) =>
                    g.category === "tickets" &&
                    (publicClubInfo?.settings?.enabled_games || []).includes(
                      g.id,
                    ),
                ).map((game, index) => {
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
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h4 className="font-black uppercase italic tracking-tight">
                      Как получить билеты?
                    </h4>
                    <p className="text-xs text-gray-500 font-medium">
                      Смотри правила и историю своих начислений
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-white transition-colors" />
              </Link>
            </motion.div>

            {/* Stakes Category */}
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
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Coins className="w-20 h-20 text-yellow-500" />
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                    <Coins className="w-4 h-4 text-yellow-500" />
                  </div>
                  <h4 className="text-md font-black uppercase italic tracking-tight">
                    Ставка
                  </h4>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed max-w-2xl">
                  Играй на свои бонусы! Умножай накопленный баланс в динамичных играх, но будь осторожен — здесь всё зависит от твоей стратегии и удачи.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {GAMES.filter(
                  (g) =>
                    g.category === "stakes" &&
                    (publicClubInfo?.settings?.enabled_games || []).includes(
                      g.id,
                    ),
                ).map((game, index) => {
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
          </>
        )}

        {activeTab === "shop" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-12"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h2 className="text-3xl font-black uppercase italic tracking-tight mb-2">
                  Маркет <span className="text-orange-500">Бонусов</span>
                </h2>
                <p className="text-gray-400 text-sm font-medium">
                  Обменивай накопленные бонусы на реальные товары из нашего бара
                </p>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={() => setShowOrderDialog(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic px-8 py-4 rounded-3xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]"
                >
                  Оформить заказ ({Math.floor(cartTotal)} 🪙)
                </button>
              )}
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
                  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1 space-y-2 w-full">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                        <span>Лимит на покупки за бонусы ({new Date().toLocaleString("ru-RU", { month: "long" })})</span>
                        <div className="flex items-center gap-2">
                          {activeGroup && (
                            <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              ✨ {activeGroup.name}
                            </span>
                          )}
                          {player?.hasPremiumBp ? (
                            <span className="text-[8px] font-black uppercase tracking-widest bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20">
                              🔥 BP {limitPercent}%
                            </span>
                          ) : (
                            <span className="text-[8px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20">
                              {limitPercent}%
                            </span>
                          )}
                          <span className="text-orange-500">{Math.floor(remainingLimit)} ₽ осталось из {Math.floor(allowedLimit)} ₽</span>
                        </div>
                      </div>
                      <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, progressPercent)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-relaxed md:max-w-xs shrink-0">
                      {remainingLimit <= 0 ? (
                        <>
                          Лимит исчерпан. <span className="text-orange-500 font-black">Пополните счет</span> или купите в баре за рубли, чтобы увеличить лимит!
                        </>
                      ) : (
                        <>
                          Оплата бонусами расходует ваш ежемесячный лимит на вывод и покупки.
                        </>
                      )}
                    </div>
                  </div>

                  {/* Battle Pass Promo Banner inside Shop */}
                  {player?.hasPremiumBp ? (
                    <div className="bg-indigo-500/[0.03] border border-indigo-500/10 rounded-[1.5rem] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="text-[9px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                          🌟 PREMIUM BATTLE PASS АКТИВЕН
                        </div>
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                          Ваш лимит на покупки увеличен до <span className="text-indigo-400 font-black">{limitPercent}%</span> благодаря Battle Pass!
                        </div>
                      </div>
                    </div>
                  ) : (
                    player?.settings?.bp_enabled !== false && (
                      <Link
                        href="/promo"
                        className="bg-gradient-to-r from-indigo-950/20 to-purple-950/20 border border-indigo-500/15 hover:border-indigo-500/30 transition-all rounded-[1.5rem] p-4 flex items-center justify-between group"
                      >
                        <div className="space-y-0.5">
                          <div className="text-[9px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                            ⚡ УВЕЛИЧИТЬ ЛИМИТ ДО {player?.settings?.withdraw_limit_percent_bp ?? 80}%
                          </div>
                          <div className="text-[8px] text-gray-400 font-medium uppercase tracking-wider">
                            Активируйте Premium Battle Pass для повышенного лимита вывода и покупок!
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </Link>
                    )
                  )}
                </div>
              );
            })()}

            <AnimatePresence>
              {cart.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-[2.5rem] flex gap-5 items-start">
                    <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-orange-500 uppercase italic mb-1">
                        Как получить ваш товар?
                      </h4>
                      <p className="text-xs text-gray-400 font-medium leading-relaxed">
                        Подойдите к стойке ресепшен, отсканируйте наш QR-код и в
                        появившемся меню выберите кнопку{" "}
                        <span className="text-orange-500 font-black">
                          "ЗА БОНУСЫ"
                        </span>
                        . После этого администратор сразу увидит ваш заказ и
                        выдаст его вам.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-12">
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
                <div key={category} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
                      {category}
                    </h3>
                    <div className="h-px w-full bg-white/5" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {catProducts.map((product) => {
                      const bonusPrice =
                        product.bonus_price ||
                        Math.floor(product.selling_price * multiplier);
                      const inCart =
                        cart.find((i) => i.id === product.id)?.quantity || 0;

                      return (
                        <div
                          key={product.id}
                          className="bg-white/5 border border-white/10 rounded-[2rem] p-5 flex flex-col group hover:border-orange-500/30 transition-all"
                        >
                          <div className="flex-1 space-y-3">
                            <div className="font-bold text-sm sm:text-base leading-tight">
                              {product.name}
                            </div>
                            <div className="flex items-center gap-2 text-yellow-500">
                              <Coins className="w-4 h-4" />
                              <span className="font-black text-lg">
                                {bonusPrice}
                              </span>
                            </div>
                          </div>

                          <div className="mt-6 flex items-center gap-2">
                            {inCart > 0 ? (
                              <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl w-full overflow-hidden">
                                <button
                                  onClick={() => removeFromCart(product.id)}
                                  className="w-full h-10 flex items-center justify-center hover:bg-white/5 transition-colors"
                                >
                                  -
                                </button>
                                <span className="w-full text-center font-black text-sm">
                                  {inCart}
                                </span>
                                <button
                                  onClick={() => addToCart(product)}
                                  className="w-full h-10 flex items-center justify-center hover:bg-white/5 transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(product)}
                                className="w-full bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/50 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
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
  const content = (
    <div
      className={cn(
        "h-full relative p-8 rounded-[2.5rem] border-2 transition-all overflow-hidden flex flex-col",
        locked
          ? "border-white/5 bg-white/5"
          : cn(
              "bg-linear-to-br group hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
              game.borderColor,
              game.color,
            ),
      )}
    >
      {/* Decorative Glow */}
      {!locked && (
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
      )}

      <div className="flex items-center justify-between mb-3 relative z-10">
        <h3
          className={cn(
            "text-2xl font-black uppercase italic tracking-tight transition-colors",
            !locked ? "group-hover:text-white" : "text-white/40",
          )}
        >
          {game.title}
        </h3>
        {locked && (
          <div className="bg-white/5 px-3 py-1 rounded-lg border border-white/5 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-white/20" />
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
              Lvl {minLevel}
            </span>
          </div>
        )}
      </div>

      <p
        className={cn(
          "text-sm leading-relaxed mb-8 line-clamp-3 relative z-10",
          locked ? "text-gray-600" : "text-gray-400",
        )}
      >
        {game.desc}
      </p>

      <div className="mt-auto flex items-center justify-between relative z-10">
        <div
          className={cn(
            "px-4 py-1.5 rounded-full border",
            locked ? "bg-white/5 border-white/5" : "bg-black/30 border-white/5",
          )}
        >
          <span
            className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              locked ? "text-white/20" : "text-white/60",
            )}
          >
            {game.cost}
          </span>
        </div>

        {locked ? (
          <div className="text-[10px] font-black text-white/20 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl border border-white/5">
            Нужен уровень {minLevel}
          </div>
        ) : (
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <ArrowRight className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      {locked ? content : <Link href={game.href}>{content}</Link>}
    </motion.div>
  );
}
