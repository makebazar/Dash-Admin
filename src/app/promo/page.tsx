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
  const hasCheckedIn = React.useRef(false);

  const multiplier = publicClubInfo?.settings?.bonus_price_multiplier || 2;

  const handleCheckIn = async (intent: "topup" | "pos" | "bonus_order") => {
    if (!urlClubId || isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      const res = await fetch("/api/promo/player/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId: urlClubId,
          intent,
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

        // Fetch products and settings
        const [prizesRes, productsRes, clubRes] = await Promise.all([
          fetch(`/api/promo/prizes?all=true`),
          fetch(`/api/promo/products?clubId=${currentClubId}`),
          fetch(`/api/promo/public-info?clubId=${currentClubId}`),
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

                <div className="space-y-3">
                  <button
                    onClick={() => handleCheckIn("bonus_order")}
                    disabled={
                      isCheckingIn || cartTotal > (player?.bonusBalance || 0)
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

            {/* Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Ticket className="w-24 h-24 text-orange-500" />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Ticket className="w-5 h-5 text-orange-500" />
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tight">
                    Билеты
                  </h3>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Используй билеты для участия в призовых играх. Каждый билет —
                  это шанс выиграть реальные подарки: от напитков до игрового
                  времени на баланс.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Coins className="w-24 h-24 text-yellow-500" />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                    <Coins className="w-5 h-5 text-yellow-500" />
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tight">
                    Ставка
                  </h3>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Играй на свои бонусы! Умножай накопленный баланс в динамичных
                  играх, но будь осторожен — здесь всё зависит от твоей
                  стратегии и удачи.
                </p>
              </motion.div>
            </div>

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

            {/* Tickets Category */}
            <section className="mb-16">
              <div className="flex items-center gap-4 mb-8">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
                  Игры за билеты
                </h3>
                <div className="h-px w-full bg-white/5" />
              </div>

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

            {/* Stakes Category */}
            <section>
              <div className="flex items-center gap-4 mb-8">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
                  Рискни бонусами
                </h3>
                <div className="h-px w-full bg-white/5" />
              </div>

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
