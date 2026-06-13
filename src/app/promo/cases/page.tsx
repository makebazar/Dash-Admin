"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Award, Sparkles, X, ShoppingCart, HelpCircle, Loader2 } from "lucide-react";
import { PromoHeader } from "../components/PromoHeader";
import { BottomNav } from "../components/BottomNav";
import { cn } from "@/lib/utils";

interface CaseItem {
  id: number;
  name: string;
  description: string;
  reward_type: string;
  reward_value: number;
  image_url: string;
  is_rare: boolean;
}

interface Case {
  id: number;
  name: string;
  description: string;
  price_bonus: number;
  rtp: number;
  image_url: string;
  is_active: boolean;
  items: CaseItem[];
}

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal & Spin States
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [spinItems, setSpinItems] = useState<CaseItem[]>([]);
  const [showWinModal, setShowWinModal] = useState(false);
  
  const rouletteTrackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  // Play audio effect using Web Audio API
  const playSound = (type: "tick" | "win") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === "tick") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.06);
      } else if (type === "win") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      }
    } catch (e) {
      console.warn("Audio Context failed to play sound:", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [casesRes, playerRes] = await Promise.all([
        fetch("/api/promo/cases"),
        fetch("/api/promo/player"),
      ]);

      if (casesRes.ok && playerRes.ok) {
        const casesData = await casesRes.json();
        const playerData = await playerRes.json();
        setCases(casesData.cases || []);
        setPlayer(playerData.player || null);
      }
    } catch (err) {
      console.error("Failed to fetch player cases:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCase = async (c: Case) => {
    if (!player) return;
    if (player.bonusBalance < c.price_bonus) {
      alert("Недостаточно бонусов для открытия этого кейса!");
      return;
    }

    setSelectedCase(c);
    setIsSpinning(true);
    setWonItem(null);
    setShowWinModal(false);

    try {
      const res = await fetch("/api/promo/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: c.id }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Не удалось открыть кейс");
        setIsSpinning(false);
        setSelectedCase(null);
        return;
      }

      const data = await res.json();
      const actualWonItem = data.wonItem;

      // Deduct balance in UI immediately
      setPlayer((prev: any) => ({
        ...prev,
        bonusBalance: data.newBalance,
      }));

      // Generate 40 items for the roulette reel
      const possibleItems = c.items;
      const itemsForReel: CaseItem[] = [];
      for (let i = 0; i < 40; i++) {
        if (i === 32) {
          itemsForReel.push(actualWonItem); // Winning item goes to index 32
        } else {
          // Fill other slots randomly from possible drops
          const randomIdx = Math.floor(Math.random() * possibleItems.length);
          itemsForReel.push(possibleItems[randomIdx]);
        }
      }
      setSpinItems(itemsForReel);
      setWonItem(actualWonItem);

      // Perform the animation timeline
      // Total duration of spin: 4.5 seconds
      let tickTimer: NodeJS.Timeout;
      const startSpinTime = Date.now();
      const duration = 4500;

      const runTicks = () => {
        const elapsed = Date.now() - startSpinTime;
        if (elapsed < duration) {
          // Speed starts fast, slows down exponentially
          const progress = elapsed / duration;
          const currentSpeed = 50 + progress * 400; // time in ms between ticks
          playSound("tick");
          tickTimer = setTimeout(runTicks, currentSpeed);
        }
      };
      
      tickTimer = setTimeout(runTicks, 100);

      // Scroll roulette reel
      setTimeout(() => {
        clearTimeout(tickTimer);
        playSound("win");
        setIsSpinning(false);
        setShowWinModal(true);
      }, duration);

    } catch (err) {
      console.error("Open Case API Error:", err);
      alert("Ошибка сети");
      setIsSpinning(false);
      setSelectedCase(null);
    }
  };

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
      case "bonus_limitless":
        return "Безлимитные Бонусы";
      case "bonus_standard":
        return "Бонусы клуба";
      case "bar_item":
      case "bar_category":
        return "Товар Бара";
      case "club_service":
        return "Услуга клуба";
      case "withdraw_boost":
      case "xp_boost":
        return "Буст лимита вывода";
      case "bp_xp":
        return "Опыт";
      case "ticket":
        return "Билет";
      case "custom":
        return "Приз";
      default:
        return "Приз";
    }
  };

  const getRewardUnitLabel = (type: string, value: number) => {
    switch (type) {
      case "bonus_limitless":
      case "bonus_standard":
      case "club_service":
        return `${value} ₽`;
      case "club_time":
        return `${value} мин.`;
      case "withdraw_boost":
      case "xp_boost":
        return `+${value}%`;
      case "bp_xp":
        return `+${value} XP`;
      case "ticket":
        return `+${value} шт.`;
      default:
        return value > 0 ? `${value} ₽` : "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between">
        <PromoHeader title="Кейсы" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
          <p className="text-neutral-500 text-xs font-black uppercase tracking-widest">Загрузка кейсов...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between pb-32">
      <PromoHeader title="Кейсы" />

      <div className="flex-1 max-w-md mx-auto w-full px-4 pt-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-black italic uppercase tracking-tight flex items-center gap-2">
            Кейсы <span className="text-orange-500">удачи</span>
          </h1>
          <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest">
            Открывай сундуки за накопленные бонусы
          </p>
        </div>

        {/* Display player balance details */}
        {player && (
          <div className="bg-neutral-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Ваш баланс бонусов</p>
              <p className="text-xl font-black text-orange-500">{player.bonusBalance} ₽</p>
            </div>
            <div className="space-y-0.5 text-right">
              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Безлимитный лимит</p>
              <p className="text-sm font-bold text-emerald-400">+{player.extraWithdrawLimit || 0} ₽</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {cases.map((c) => (
            <div
              key={c.id}
              className="relative bg-neutral-900/20 border border-white/10 rounded-3xl p-5 overflow-hidden flex flex-col justify-between gap-4 shadow-xl hover:border-orange-500/20 transition-all duration-300"
            >
              {/* Glow filter background */}
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-orange-500/10 blur-2xl rounded-full pointer-events-none" />

              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-neutral-800/50 rounded-2xl flex items-center justify-center border border-white/5 shrink-0">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="w-12 h-12 object-contain" />
                  ) : (
                    <Package className="w-10 h-10 text-orange-500/60" />
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="font-black italic uppercase text-base tracking-tight">{c.name}</h3>
                  <p className="text-neutral-400 text-xs leading-relaxed font-medium">
                    {c.description}
                  </p>
                </div>
              </div>

              {/* Possible prize showcase */}
              <div className="bg-neutral-900/50 rounded-2xl p-3 border border-white/5 space-y-2">
                <p className="text-[8px] font-black uppercase text-neutral-500 tracking-wider">Возможные призы внутри:</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.items.slice(0, 5).map((item) => (
                    <span
                      key={item.id}
                      className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-md border",
                        item.is_rare
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                          : "bg-neutral-800/40 text-neutral-300 border-white/5"
                      )}
                    >
                      {item.name}
                    </span>
                  ))}
                  {c.items.length > 5 && (
                    <span className="text-[9px] font-bold bg-neutral-800/40 text-neutral-400 border border-white/5 px-2 py-0.5 rounded-md">
                      +{c.items.length - 5} еще
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleOpenCase(c)}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black uppercase italic text-xs tracking-widest py-3.5 px-4 rounded-2xl transition shadow-lg shadow-orange-500/10 active:scale-95"
                >
                  Открыть за {c.price_bonus} ₽
                </button>
              </div>
            </div>
          ))}

          {cases.length === 0 && (
            <div className="bg-neutral-900/10 border border-white/5 rounded-3xl p-10 text-center text-neutral-500 space-y-2">
              <Package className="w-12 h-12 mx-auto text-neutral-700" />
              <p className="font-bold text-sm uppercase italic">Нет доступных кейсов</p>
              <p className="text-xs">В данный момент нет кейсов, доступных для открытия в этом клубе.</p>
            </div>
          )}
        </div>
      </div>

      {/* ROULETTE OPEN MODAL */}
      <AnimatePresence>
        {selectedCase && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full text-center space-y-8">
              <div className="space-y-2">
                <h2 className="text-xl font-black italic uppercase tracking-wide text-orange-500">
                  {selectedCase.name}
                </h2>
                <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Открытие кейса...</p>
              </div>

              {/* Roulette Container */}
              <div className="relative w-full overflow-hidden bg-neutral-900 border-y-2 border-white/10 py-6 my-4">
                {/* Center marker line */}
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-orange-500 z-10 shadow-[0_0_15px_rgba(249,115,22,0.8)]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-t-8 border-x-8 border-t-orange-500 border-x-transparent z-10" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-b-8 border-x-8 border-b-orange-500 border-x-transparent z-10" />

                {/* Left/Right fading gradient overlays */}
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-neutral-900 to-transparent z-10" />
                <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-neutral-900 to-transparent z-10" />

                {/* Track */}
                <motion.div
                  ref={rouletteTrackRef}
                  className="flex gap-2 px-[50%]"
                  animate={
                    wonItem
                      ? {
                          // Scroll to wonItem at index 32
                          // Width of item is 100px, gap is 8px. Total offset is 32 * 108 = 3456px
                          // Center adjustment is done using px-[50%] padding
                          x: -3456 - 50, // -50px to align center of item with center line
                        }
                      : { x: 0 }
                  }
                  transition={{
                    duration: 4.5,
                    ease: [0.05, 0.9, 0.1, 1.0], // Exponential slowing down curve
                  }}
                >
                  {spinItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "w-[100px] h-[100px] rounded-2xl flex flex-col justify-between p-2 shrink-0 border select-none text-left transition duration-300",
                        item.is_rare
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                          : "bg-neutral-800/50 border-white/5 text-neutral-200"
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-neutral-900/50 flex items-center justify-center border border-white/5">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-6 h-6 object-contain" />
                        ) : (
                          <Award className="w-4 h-4 text-orange-500/60" />
                        )}
                      </div>
                      <div>
                        <p className="text-[8px] font-black uppercase truncate text-neutral-400">{item.name}</p>
                        <p className="text-[10px] font-black italic">{getRewardUnitLabel(item.reward_type, item.reward_value)}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>

              {/* Status Info / Back Button */}
              <div className="pt-4">
                {!isSpinning && wonItem && showWinModal && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-neutral-900 border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
                    
                    <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-inner shadow-orange-500/20 animate-bounce">
                      {wonItem.image_url ? (
                        <img src={wonItem.image_url} alt={wonItem.name} className="w-12 h-12 object-contain" />
                      ) : (
                        <Sparkles className="w-8 h-8 text-orange-400" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-orange-500 tracking-wider">Ваш Выигрыш!</p>
                      <h3 className="text-lg font-black uppercase italic leading-tight">{wonItem.name}</h3>
                      <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider mt-1">
                        {getRewardTypeLabel(wonItem.reward_type)}: {getRewardUnitLabel(wonItem.reward_type, wonItem.reward_value)}
                      </p>
                    </div>

                    <p className="text-[10px] text-neutral-400 leading-relaxed max-w-xs mx-auto">
                      Выигранный предмет добавлен в ваш инвентарь. Вы можете активировать его в Личном кабинете в любой момент.
                    </p>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          setSelectedCase(null);
                          setWonItem(null);
                        }}
                        className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold uppercase text-xs tracking-wider py-3 rounded-xl transition"
                      >
                        Закрыть
                      </button>
                      <button
                        onClick={() => handleOpenCase(selectedCase)}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic text-xs tracking-widest py-3 rounded-xl transition"
                      >
                        Еще раз
                      </button>
                    </div>
                  </motion.div>
                )}

                {isSpinning && (
                  <p className="text-xs text-neutral-500 animate-pulse font-bold uppercase tracking-widest">
                    Фортуна выбирает ваш приз...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
