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
} from "lucide-react";
import { PrizesSidebar } from "./components/PrizesSidebar";
import { LandingView } from "./components/LandingView";

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
];

export default function PromoLobby() {
  const [player, setPlayer] = React.useState<any>(null);
  const [tickets, setTickets] = React.useState(0);
  const [prizes, setPrizes] = React.useState<any[]>([]);
  const [showPrizes, setShowPrizes] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [isAuth, setIsAuth] = React.useState(false);
  const [publicClubInfo, setPublicClubInfo] = React.useState<{
    name: string;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlClubId = searchParams.get("clubId");
  const action = searchParams.get("action");
  const [checkedIn, setCheckedIn] = React.useState(false);
  const hasCheckedIn = React.useRef(false);

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
        setPlayer(data.player);
        setTickets(data.tickets);
        setIsAuth(true);

        // Handle Check-in action from Static QR
        if (action === "checkin" && urlClubId && !hasCheckedIn.current) {
          hasCheckedIn.current = true;
          fetch("/api/promo/player/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clubId: urlClubId }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.success) {
                setCheckedIn(true);
                // Remove action from URL to avoid re-triggering on refresh
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete("action");
                window.history.replaceState({}, "", newUrl.toString());
              }
            })
            .catch(console.error);
        }

        // Fetch all prizes for the club
        const prizesRes = await fetch(`/api/promo/prizes`);
        const prizesData = await prizesRes.json();
        if (prizesData.success) {
          setPrizes(prizesData.prizes || []);
        }
      } catch (err) {
        console.error("Failed to fetch player data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
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

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none mb-1">
              {player?.clubName || "Клуб"}
            </div>
            <div className="text-sm font-black uppercase italic tracking-tight text-white leading-none">
              Игровая Зона
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tickets Display */}
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-3">
              <Ticket className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-black">{tickets}</span>
            </div>
            {/* Bonus Display */}
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-3">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-black">
                {Math.floor(player?.bonusBalance || 0)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <PrizesSidebar
        isOpen={showPrizes}
        onClose={() => setShowPrizes(false)}
        prizes={prizes}
      />

      <main className="max-w-6xl mx-auto p-6 pt-10 pb-32">
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
              Используй билеты для участия в призовых играх. Каждый билет — это
              шанс выиграть реальные подарки: от напитков до игрового времени на
              баланс.
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
              играх, но будь осторожен — здесь всё зависит от твоей стратегии и
              удачи.
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
            {GAMES.filter((g) => g.category === "tickets").map(
              (game, index) => (
                <GameCard key={game.id} game={game} index={index} />
              ),
            )}
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
            {GAMES.filter((g) => g.category === "stakes").map((game, index) => (
              <GameCard key={game.id} game={game} index={index} />
            ))}
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-8 py-4 flex items-center gap-10 shadow-2xl z-50">
        <button className="text-orange-500">
          <Gamepad2 className="w-6 h-6" />
        </button>
        <Link
          href="/promo/accruals"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <Ticket className="w-6 h-6" />
        </Link>
        <Link
          href="/promo/withdraw"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <Wallet className="w-6 h-6" />
        </Link>
        <Link
          href="/promo/profile"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <User className="w-6 h-6" />
        </Link>
      </div>
    </div>
  );
}

function GameCard({ game, index }: { game: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link
        href={game.href}
        className={`block h-full relative p-8 rounded-[2.5rem] border-2 ${game.borderColor} bg-linear-to-br ${game.color} hover:scale-[1.02] active:scale-[0.98] transition-all group overflow-hidden`}
      >
        {/* Decorative Glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />

        <h3 className="text-2xl font-black mb-3 uppercase italic tracking-tight relative z-10 group-hover:text-white transition-colors">
          {game.title}
        </h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-8 line-clamp-3 relative z-10">
          {game.desc}
        </p>

        <div className="mt-auto flex items-center justify-between relative z-10">
          <div className="px-4 py-1.5 bg-black/30 rounded-full border border-white/5">
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
              {game.cost}
            </span>
          </div>
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <ArrowRight className="w-5 h-5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
