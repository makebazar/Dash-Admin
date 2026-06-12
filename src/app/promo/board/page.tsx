"use client";

import React, { useEffect, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import {
  Trophy,
  Target,
  Gift,
  Ticket,
  Coins,
  Star,
  Zap,
  Clock,
  Crown,
  Flame,
  Users,
  RotateCw,
  Loader2,
  Gamepad2,
  CreditCard,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QRCode } from "@/components/qr/QRCode";

// --- HELPERS ---

const getQuestStyle = (trigger: string) => {
  switch (trigger) {
    case "receipt_item":
    case "receipt_total":
      return {
        icon: <UtensilsCrossed className="w-5 h-5 text-blue-400" />,
        color: "from-blue-500/20 to-indigo-500/20",
        borderColor: "border-blue-500/30",
      };
    case "balance_topup":
      return {
        icon: <CreditCard className="w-5 h-5 text-yellow-400" />,
        color: "from-yellow-500/20 to-orange-500/20",
        borderColor: "border-yellow-500/30",
      };
    case "game_play_count":
    case "game_win_count":
      return {
        icon: <Gamepad2 className="w-5 h-5 text-emerald-400" />,
        color: "from-emerald-500/20 to-teal-500/20",
        borderColor: "border-emerald-500/30",
      };
    case "ticket_spend":
      return {
        icon: <Ticket className="w-5 h-5 text-purple-400" />,
        color: "from-purple-500/20 to-pink-500/20",
        borderColor: "border-purple-500/30",
      };
    default:
      return {
        icon: <Zap className="w-5 h-5 text-orange-400" />,
        color: "from-orange-500/20 to-red-500/20",
        borderColor: "border-orange-500/30",
      };
  }
};

const Card = ({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className={cn(
      "rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden",
      className,
    )}
  >
    {children}
  </motion.div>
);

function PromoBoardContent() {
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId");

  const [now, setNow] = useState(new Date());
  const [wins, setWins] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [quests, setQuests] = useState<any[]>([]);

  const [isPortrait, setIsPortrait] = useState(false);
  const [clubName, setClubName] = useState<string | null>(null);
  const [promoDomain, setPromoDomain] = useState("game.mydashadmin.ru");
  const [loading, setLoading] = useState(true);
  const [questPage, setQuestPage] = useState(0);

  const questsPerPage = 3;
  const totalQuestPages = Math.ceil(quests.length / questsPerPage);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);

    if (!clubId) {
      setLoading(false);
      return () => clearInterval(timer);
    }

    async function initData() {
      try {
        const clubRes = await fetch(`/api/clubs/${clubId}`);
        if (clubRes.ok) {
          const data = await clubRes.json();
          if (data.club) {
            setClubName(data.club.name);
            const settings = data.club.promo_settings || {};
            const base = typeof window !== "undefined"
              ? window.location.origin
              : "https://game.mydashadmin.ru";
            setPromoDomain(base);
          }
        }

        const boardRes = await fetch(
          `/api/promo/public/board-data?clubId=${clubId}`,
        );
        if (boardRes.ok) {
          const data = await boardRes.json();
          setLeaderboard(data.leaderboard || []);
          setQuests(data.quests || []);
          setWins(data.wins || []);
        }
      } catch (err) {
        console.error("Failed to fetch data", err);
      } finally {
        setLoading(false);
      }
    }

    initData();

    // Real-time Stream
    const streamUrl = `/api/promo/public/board-data/stream?clubId=${clubId}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_win") {
          setWins((prev) => {
            if (prev.some((w) => w.id === data.win.id)) return prev;
            return [data.win, ...prev.slice(0, 4)];
          });
        }
      } catch (e) {
        console.error("Stream parse error", e);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      eventSource.close();
    };

    return () => {
      clearInterval(timer);
      eventSource.close();
    };
  }, [clubId]);

  useEffect(() => {
    if (quests.length <= questsPerPage) return;
    const questTimer = setInterval(() => {
      setQuestPage(
        (prev) => (prev + 1) % Math.ceil(quests.length / questsPerPage),
      );
    }, 10000);
    return () => clearInterval(questTimer);
  }, [quests.length]);

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const currentQuests = quests.slice(
    questPage * questsPerPage,
    (questPage + 1) * questsPerPage,
  );

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#050816] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
          <p className="text-white/40 font-black uppercase tracking-[0.3em] text-xs">
            Загрузка данных...
          </p>
        </div>
      </div>
    );
  }

  if (!clubId) {
    return (
      <div className="h-screen w-screen bg-[#050816] flex items-center justify-center text-center p-8">
        <div className="max-w-md space-y-4">
          <Flame className="w-16 h-16 text-orange-500 mx-auto animate-pulse" />
          <h1 className="text-3xl font-black italic uppercase">
            DashAdmin Promo
          </h1>
          <p className="text-white/60">
            Для работы панели необходимо передать clubId в URL.
          </p>
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl font-mono text-sm text-orange-400">
            /promo/board?clubId=YOUR_ID
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black overflow-hidden relative">
      <div className="flex h-screen w-screen flex-col bg-[#050816] text-white overflow-hidden font-sans p-4 sm:p-6 lg:p-8 gap-4 lg:gap-8 relative transition-all duration-500 shrink-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none" />

        <header className="flex flex-col sm:flex-row justify-between items-center sm:items-end shrink-0 relative z-10 gap-2">
          <div className="flex items-center gap-4 text-center sm:text-left">
            {clubName && (
              <h1 className="text-2xl lg:text-5xl font-black italic uppercase tracking-tighter leading-none">
                {clubName.split(" ")[0]}
                <span className="text-orange-500">
                  {" "}
                  {clubName.split(" ").slice(1).join(" ")}
                </span>
              </h1>
            )}
          </div>
        </header>

        <main
          className={cn(
            "flex-1 grid gap-4 lg:gap-8 min-h-0 relative z-10",
            isPortrait
              ? "grid-cols-1 grid-rows-[auto_1fr_auto]"
              : "grid-cols-1 lg:grid-cols-12",
          )}
        >
          {/* LEADERBOARD */}
          <section
            className={cn(
              "flex flex-col min-h-0 overflow-hidden",
              isPortrait ? "row-span-1" : "col-span-1 lg:col-span-4",
            )}
          >
            <div className="flex items-center gap-2 lg:gap-3 mb-3 lg:mb-6 px-4 shrink-0">
              <Trophy
                className={cn(
                  "text-yellow-500",
                  isPortrait ? "w-5 h-5" : "w-4 h-4 lg:w-6 lg:h-6",
                )}
              />
              <h2
                className={cn(
                  "font-black uppercase italic tracking-tight",
                  isPortrait ? "text-lg" : "text-sm lg:text-xl",
                )}
              >
                Зал Славы XP
              </h2>
            </div>

            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              {isPortrait && leaderboard.length >= 3 && (
                <div className="grid grid-cols-3 gap-3 mb-2 shrink-0 px-2">
                  {[leaderboard[1], leaderboard[0], leaderboard[2]].map(
                    (user) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "p-3 rounded-2xl border flex flex-col items-center text-center gap-1 relative overflow-hidden",
                          user.rank === 1
                            ? "bg-yellow-500/20 border-yellow-500/50 h-32 pt-5"
                            : "bg-white/5 border-white/10 h-28 mt-4",
                        )}
                      >
                        {user.rank === 1 && (
                          <Crown className="w-6 h-6 text-yellow-500 absolute top-2 animate-bounce" />
                        )}
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-xl mb-1",
                            user.rank === 1
                              ? "bg-yellow-500 text-black scale-110"
                              : user.rank === 2
                                ? "bg-slate-300 text-black"
                                : "bg-orange-600 text-white",
                          )}
                        >
                          {user.rank}
                        </div>
                        <div className="font-bold text-[10px] uppercase italic truncate w-full">
                          {user.name}
                        </div>
                        <div className="font-black text-xs text-orange-500 italic">
                          {Math.floor(user.xp).toLocaleString()}{" "}
                          <span className="text-[8px] opacity-50 not-italic">
                            XP
                          </span>
                        </div>
                      </motion.div>
                    ),
                  )}
                </div>
              )}
              <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                {(isPortrait
                  ? leaderboard.slice(3, 8)
                  : leaderboard.slice(0, 10)
                ).map((user, idx) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "flex items-center gap-2 lg:gap-4 p-2 lg:p-4 rounded-xl lg:rounded-2xl border border-white/5 bg-white/5 transition-all min-h-0",
                      user.rank === 1
                        ? "bg-yellow-500/10 border-yellow-500/30 ring-1 ring-yellow-500/20 shadow-lg"
                        : "",
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center font-black text-[10px] lg:text-lg shrink-0",
                        user.rank === 1
                          ? "bg-yellow-500 text-black -rotate-6"
                          : user.rank === 2
                            ? "bg-slate-300 text-black rotate-[4deg]"
                            : user.rank === 3
                              ? "bg-orange-600 text-white -rotate-3"
                              : "bg-white/10 text-white/40",
                      )}
                    >
                      {user.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs lg:text-lg truncate uppercase italic tracking-tight">
                        {user.name}
                      </div>
                      <div className="flex items-center gap-1 text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-white/40">
                        <Star className="w-2 h-2 lg:w-3 lg:h-3 text-orange-500" />{" "}
                        Lvl {user.level}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-xs lg:text-xl italic text-orange-500">
                        {Math.floor(user.xp).toLocaleString()}{" "}
                        <span className="text-[8px] lg:text-xs opacity-50 not-italic">
                          XP
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* QUESTS */}
          <section
            className={cn(
              "flex flex-col gap-4 lg:gap-8 min-h-0",
              isPortrait ? "row-span-1" : "col-span-1 lg:col-span-5",
            )}
          >
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
              <div className="flex items-center gap-2 lg:gap-3 mb-2 lg:mb-6 px-4 shrink-0">
                <Target
                  className={cn(
                    "text-orange-500",
                    isPortrait ? "w-5 h-5" : "w-4 h-4 lg:w-6 lg:h-6",
                  )}
                />
                <h2
                  className={cn(
                    "font-black uppercase italic tracking-tight",
                    isPortrait ? "text-lg" : "text-sm lg:text-xl",
                  )}
                >
                  Активные Квесты
                </h2>
              </div>

              <div className={cn("flex-1 relative")}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={questPage}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.5 }}
                    className={cn(
                      "grid gap-3 lg:gap-4 absolute inset-0",
                      isPortrait
                        ? "grid-cols-1 flex flex-col"
                        : "grid-cols-1 flex flex-col",
                    )}
                  >
                    {currentQuests.map((quest) => {
                      const style = getQuestStyle(quest.trigger);
                      return (
                        <Card
                          key={quest.id}
                          className={cn(
                            "p-4 lg:p-6 flex items-start gap-4 lg:gap-6 group hover:border-orange-500/30 transition-all flex-1 min-h-0",
                          )}
                        >
                          <div
                            className={cn(
                              "rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 shadow-xl bg-linear-to-br border",
                              style.color,
                              style.borderColor,
                              "w-12 h-12 lg:w-14 lg:h-14",
                            )}
                          >
                            {React.cloneElement(
                              style.icon as React.ReactElement,
                              { className: "w-6 h-6 lg:w-7 lg:h-7" },
                            )}
                          </div>
                          <div className="flex-1 space-y-1 lg:space-y-2 min-w-0">
                            <h3
                              className={cn(
                                "font-black uppercase italic tracking-tight truncate",
                                isPortrait ? "text-lg" : "text-sm lg:text-xl",
                              )}
                            >
                              {quest.title}
                            </h3>
                            <p
                              className={cn(
                                "text-white/60 font-medium leading-tight line-clamp-1",
                                isPortrait
                                  ? "text-xs"
                                  : "text-[10px] lg:text-sm lg:line-clamp-2",
                              )}
                            >
                              {quest.description}
                            </p>

                            <div className="pt-1 flex flex-wrap gap-2">
                              {quest.rewards.xp > 0 && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                                  <Star className="w-3 h-3 text-orange-500" />
                                  <span className="text-[10px] font-black text-orange-500">
                                    +{quest.rewards.xp} XP
                                  </span>
                                </div>
                              )}
                              {quest.rewards.tickets > 0 && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                  <Ticket className="w-3 h-3 text-blue-400" />
                                  <span className="text-[10px] font-black text-blue-400">
                                    +{quest.rewards.tickets} Билета
                                  </span>
                                </div>
                              )}
                              {quest.rewards.bonus > 0 && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                  <Coins className="w-3 h-3 text-yellow-500" />
                                  <span className="text-[10px] font-black text-yellow-500">
                                    +{quest.rewards.bonus} ₽
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>

              {totalQuestPages > 1 && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
                  {Array.from({ length: totalQuestPages }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-500 shadow-lg",
                        i === questPage ? "bg-orange-500 w-6" : "bg-white/20",
                      )}
                    />
                  ))}
                </div>
              )}
            </div>

            <div
              className={cn(
                "rounded-[1.5rem] lg:rounded-[2.5rem] bg-orange-500 flex items-center gap-4 lg:gap-8 shadow-2xl relative overflow-hidden group shrink-0",
                isPortrait ? "p-4" : "p-4 lg:p-8",
              )}
            >
              <div className="bg-white p-1.5 lg:p-3 rounded-xl lg:rounded-3xl shadow-2xl relative z-10 shrink-0">
                <QRCode
                  value={`${promoDomain}/promo?clubId=${clubId}&action=checkin`}
                  size={isPortrait ? 80 : 100}
                />
              </div>
              <div className="flex-1 space-y-1 lg:space-y-4 relative z-10">
                <div className="space-y-0.5">
                  <h3
                    className={cn(
                      "font-black text-black uppercase italic tracking-tighter leading-none",
                      isPortrait ? "text-xl" : "text-xl lg:text-4xl",
                    )}
                  >
                    Сканируй <span className="text-white">и играй!</span>
                  </h3>
                  <p className="text-black/70 font-bold uppercase tracking-widest text-[8px] lg:text-xs">
                    Личный кабинет в телефоне
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* WINS FEED */}
          <section
            className={cn(
              "flex flex-col min-h-0",
              isPortrait ? "row-span-1" : "col-span-1 lg:col-span-3",
            )}
          >
            <div className="flex items-center gap-2 lg:gap-3 mb-2 lg:mb-6 px-4 shrink-0">
              <Gift
                className={cn(
                  "text-emerald-500",
                  isPortrait ? "w-5 h-5" : "w-4 h-4 lg:w-6 lg:h-6",
                )}
              />
              <h2
                className={cn(
                  "font-black uppercase italic tracking-tight",
                  isPortrait ? "text-lg" : "text-sm lg:text-xl",
                )}
              >
                Лента Побед
              </h2>
            </div>
            <div
              className={cn(
                "overflow-hidden",
                isPortrait
                  ? "flex flex-row gap-3 h-28"
                  : "flex-1 flex flex-col gap-2 lg:gap-4",
              )}
            >
              <AnimatePresence mode="popLayout">
                {wins.length > 0 ? (
                  wins.slice(0, isPortrait ? 2 : 4).map((win) => (
                    <motion.div
                      key={win.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9, y: -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="p-3 lg:p-5 rounded-2xl lg:rounded-3xl border border-white/5 bg-white/5 flex flex-col justify-center flex-1 min-h-0 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-5">
                        {win.type === "bonus" ? (
                          <Coins className="w-8 h-8 lg:w-12 lg:h-12 text-yellow-500" />
                        ) : win.type === "attempt" ? (
                          <Ticket className="w-8 h-8 lg:w-12 lg:h-12 text-blue-500" />
                        ) : (
                          <Gift className="w-8 h-8 lg:w-12 lg:h-12 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex justify-between items-start mb-1 shrink-0">
                        <div
                          className={cn(
                            "text-[7px] lg:text-[10px] font-black uppercase tracking-widest",
                            win.type === "bonus"
                              ? "text-yellow-500"
                              : win.type === "attempt"
                                ? "text-blue-400"
                                : "text-emerald-500",
                          )}
                        >
                          {win.type === "bonus"
                            ? "Бонусы!"
                            : win.type === "attempt"
                              ? "Попытка!"
                              : "Приз!"}
                        </div>
                        <div className="text-[6px] lg:text-[8px] font-bold text-white/20 uppercase whitespace-nowrap">
                          {win.time}
                        </div>
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        <div className="text-[10px] lg:text-lg font-black uppercase italic tracking-tight truncate leading-tight">
                          {win.player}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] lg:text-sm font-bold text-white/60 truncate">
                          {win.type === "bonus" ? (
                            <Coins className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-yellow-500 shrink-0" />
                          ) : win.type === "attempt" ? (
                            <Ticket className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-blue-400 shrink-0" />
                          ) : (
                            <Gift className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-emerald-500 shrink-0" />
                          )}
                          {win.prize}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl opacity-20">
                    <Gift className="w-8 h-8 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">
                      Побед пока нет
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </main>

        <footer className="h-8 lg:h-12 shrink-0 border-t border-white/5 flex items-center overflow-hidden relative z-10">
          <div className="flex whitespace-nowrap animate-marquee">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 lg:gap-8 px-4 lg:px-8"
              >
                <span className="flex items-center gap-1.5 lg:gap-2 text-[8px] lg:text-xs font-black uppercase tracking-widest text-white/40">
                  <Star className="w-2 h-2 lg:w-3 lg:h-3 text-orange-500" />{" "}
                  Пополняй баланс и получай билеты
                </span>
                <span className="flex items-center gap-1.5 lg:gap-2 text-[8px] lg:text-xs font-black uppercase tracking-widest text-white/40">
                  <Target className="w-2 h-2 lg:w-3 lg:h-3 text-emerald-500" />{" "}
                  Выполняй квесты и открывай новые уровни
                </span>
              </div>
            ))}
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        ::-webkit-scrollbar {
          display: none;
        }
        * {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

export default function PromoBoardPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#050816] flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        </div>
      }
    >
      <PromoBoardContent />
    </Suspense>
  );
}
