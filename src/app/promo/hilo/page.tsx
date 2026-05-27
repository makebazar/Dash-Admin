"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Coins, Play, Trophy, ArrowUp, ArrowDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { GameHeader } from "../components/GameHeader";

/**
 * ИГРА "HI-LO CARDS" (БОЛЬШЕ / МЕНЬШЕ)
 * 
 * - Премиальный карточный стол с 3D-наклоном карт при наведении
 * - Динамический расчет коэффициентов на основе вероятностей текущей карты
 * - Играйте сериями и увеличивайте множитель после каждого верного прогноза
 * - Забирайте деньги (Cash Out) в любой момент!
 * - Интеграция с балансом и историей через /api/promo/balance
 */

type GameState = "betting" | "playing" | "won_round" | "gameover" | "cashedout";

interface Card {
  suit: "spades" | "hearts" | "diamonds" | "clubs";
  value: number; // 2 to 14 (Jack=11, Queen=12, King=13, Ace=14)
}

const SUITS: Card["suit"][] = ["spades", "hearts", "diamonds", "clubs"];
const SUIT_SYMBOLS: Record<Card["suit"], string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};
const SUIT_COLORS: Record<Card["suit"], string> = {
  spades: "text-white",
  hearts: "text-red-500",
  diamonds: "text-red-500",
  clubs: "text-white",
};

export default function HiLoGame() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState>("betting");
  const [tickets, setTickets] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [player, setPlayer] = useState<any>(null);

  const [selectedBet, setSelectedBet] = useState(10);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [nextCard, setNextCard] = useState<Card | null>(null);
  
  const [multiplier, setMultiplier] = useState(1.0);
  const [history, setHistory] = useState<{ multiplier: number; won: number }[]>([]);

  // Config fallback
  const [config, setConfig] = useState<any>({
    base_bonus: 1,
    max_multiplier: 100,
    rtp: 92,
  });

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playSound = useCallback((freq: number, type: OscillatorType = "sine", duration: number = 0.1) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, []);

  // Fetch initial player state
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/promo/player");
        const data = await res.json();
        if (data.player) {
          setPlayer(data.player);
          setTickets(data.tickets || 0);
          setBonusBalance(data.player.bonusBalance || 0);
        }
        if (data.player?.settings?.game_configs?.hilo) {
          setConfig((prev: any) => ({
            ...prev,
            ...data.player.settings.game_configs.hilo,
          }));
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchData();
  }, []);

  // Generate a random card
  const getRandomCard = useCallback((): Card => {
    const value = Math.floor(Math.random() * 13) + 2; // 2 to 14
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    return { suit, value };
  }, []);

  // Calculate dynamic multipliers based on current card
  const higherMultiplier = useMemo(() => {
    if (!currentCard) return 1.95;
    const cardsAbove = 14 - currentCard.value;
    if (cardsAbove === 0) return 15.0; // Ace is top card, extremely rare chance to tie/higher
    
    // Mathematically: total cards / possible cards above * commission
    const rtpRatio = (config.rtp || 92) / 100;
    const raw = 13 / cardsAbove * rtpRatio;
    return Math.min(Math.max(raw, 1.05), config.max_multiplier);
  }, [currentCard, config.max_multiplier, config.rtp]);

  const lowerMultiplier = useMemo(() => {
    if (!currentCard) return 1.95;
    const cardsBelow = currentCard.value - 2;
    if (cardsBelow === 0) return 15.0; // 2 is lowest
    
    const rtpRatio = (config.rtp || 92) / 100;
    const raw = 13 / cardsBelow * rtpRatio;
    return Math.min(Math.max(raw, 1.05), config.max_multiplier);
  }, [currentCard, config.max_multiplier, config.rtp]);

  // Card formatting helper
  const formatCardName = (val: number) => {
    if (val <= 10) return String(val);
    if (val === 11) return "J";
    if (val === 12) return "Q";
    if (val === 13) return "K";
    return "A";
  };

  // Start game / Place first bet
  const startGame = async () => {
    if (bonusBalance < selectedBet) return;
    setBonusBalance((prev) => prev - selectedBet);

    // Deduct bet from server
    try {
      await fetch("/api/promo/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: -selectedBet, reason: "hilo_bet" }),
        keepalive: true,
      });
    } catch (err) {
      console.error(err);
    }

    const card = getRandomCard();
    setCurrentCard(card);
    setNextCard(null);
    setMultiplier(1.0);
    setGameState("playing");
    playSound(520, "sine", 0.1);
  };

  // Guess Higher/Lower card
  const makeGuess = async (guess: "higher" | "lower") => {
    if (gameState !== "playing" || !currentCard) return;

    // Draw next card
    const drawn = getRandomCard();
    setNextCard(drawn);
    playSound(400, "sine", 0.08);

    // Evaluate result
    let didWin = false;
    if (guess === "higher") {
      didWin = drawn.value >= currentCard.value;
    } else {
      didWin = drawn.value <= currentCard.value;
    }

    // Flip transition time delay
    setTimeout(async () => {
      if (didWin) {
        // Round Won
        const stepMult = guess === "higher" ? higherMultiplier : lowerMultiplier;
        const newMult = multiplier * stepMult;
        setMultiplier(newMult);
        setCurrentCard(drawn);
        setNextCard(null);
        playSound(880, "triangle", 0.15);
      } else {
        // Game Over
        setGameState("gameover");
        setMultiplier(1.0);
        playSound(180, "sawtooth", 0.4);
      }
    }, 800); // Wait for card flip animation
  };

  // Cash out
  const cashOut = async () => {
    if (gameState !== "playing" || multiplier === 1.0) return;

    setGameState("cashedout");
    const mult = multiplier * config.base_bonus;
    const wonAmount = Math.floor(selectedBet * mult);

    if (wonAmount > 0) {
      setBonusBalance((prev) => prev + wonAmount);
      // Persist win transaction
      try {
        await fetch("/api/promo/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: wonAmount, reason: "hilo_win" }),
          keepalive: true,
        });
      } catch (err) {
        console.error(err);
      }
    }

    setHistory((prev) => [
      { multiplier: mult, won: wonAmount },
      ...prev.slice(0, 9),
    ]);

    setMultiplier(1.0);
    setCurrentCard(null);
    playSound(980, "sine", 0.25);
  };

  // Reset to betting
  const resetGame = () => {
    setGameState("betting");
    setCurrentCard(null);
    setNextCard(null);
    setMultiplier(1.0);
  };

  // Interactive 3D Card Hover Tilt Ref/Events
  const cardRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // Map mouse position to deg tilt (max 15 deg)
    const rx = -(y / (rect.height / 2)) * 12;
    const ry = (x / (rect.width / 2)) * 12;
    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (card) {
      card.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center overflow-hidden relative font-sans select-none touch-none">
      <div className="absolute inset-0 bg-linear-to-b from-orange-500/10 via-transparent to-transparent pointer-events-none" />

      {/* Top Bar */}
      <GameHeader
        ticketsCount={tickets}
        bonusBalance={bonusBalance}
        accentColor="text-orange-500"
      />

      <main className="flex-1 w-full flex flex-col items-center justify-center p-4 pt-16 pb-36 max-w-md">
        
        {/* Title */}
        {gameState === "betting" && (
          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-black text-orange-500 tracking-tighter uppercase italic leading-none">
              Hi-Lo <span className="text-white">Cards</span>
            </h1>
            <p className="text-gray-500 text-[9px] uppercase tracking-[0.4em] font-bold mt-2">
              Больше или Меньше? Решай!
            </p>
          </div>
        )}

        {/* Current Multiplier Display */}
        {gameState !== "betting" && (
          <div className="text-center mb-4 z-10">
            <motion.div
              key={multiplier}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-5xl font-black italic tracking-tighter ${
                gameState === "gameover" ? "text-red-500" : "text-orange-500"
              }`}
            >
              x{(multiplier * config.base_bonus).toFixed(2)}
            </motion.div>
            <div className="text-lg font-black text-white mt-1">
              {gameState === "gameover"
                ? "0"
                : Math.floor(multiplier * selectedBet * config.base_bonus)}{" "}
              ₽
            </div>
          </div>
        )}

        {/* 3D Card Table Display Board */}
        <div className="w-full relative flex items-center justify-center bg-[#062615] rounded-[2.5rem] border-4 border-[#123a24] py-8 px-4 shadow-[inset_0_0_60px_rgba(0,0,0,0.8),0_15px_30px_rgba(0,0,0,0.5)] overflow-hidden aspect-square">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.06)_0%,transparent_70%)] pointer-events-none" />

          {/* Cards Frame Wrapper */}
          <div className="flex gap-4 relative z-10 perspective-800">
            
            {/* Current card on table */}
            {currentCard && (
              <div
                ref={cardRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="w-28 h-40 bg-white border border-gray-200 rounded-2xl flex flex-col justify-between p-4 shadow-2xl transition-all duration-100 ease-out transform-style-3d cursor-grab active:cursor-grabbing"
              >
                <div className="flex justify-between items-start leading-none">
                  <span className={`text-xl font-black italic ${SUIT_COLORS[currentCard.suit]}`}>
                    {formatCardName(currentCard.value)}
                  </span>
                  <span className={`text-2xl ${SUIT_COLORS[currentCard.suit]}`}>
                    {SUIT_SYMBOLS[currentCard.suit]}
                  </span>
                </div>

                <div className={`text-5xl self-center leading-none ${SUIT_COLORS[currentCard.suit]}`}>
                  {SUIT_SYMBOLS[currentCard.suit]}
                </div>

                <div className="flex justify-between items-end leading-none rotate-180">
                  <span className={`text-xl font-black italic ${SUIT_COLORS[currentCard.suit]}`}>
                    {formatCardName(currentCard.value)}
                  </span>
                  <span className={`text-2xl ${SUIT_COLORS[currentCard.suit]}`}>
                    {SUIT_SYMBOLS[currentCard.suit]}
                  </span>
                </div>
              </div>
            )}

            {/* Next incoming flipped card */}
            <AnimatePresence>
              {nextCard && (
                <motion.div
                  initial={{ rotateY: -180, scale: 0.8, x: 50, opacity: 0 }}
                  animate={{ rotateY: 0, scale: 1, x: 0, opacity: 1 }}
                  exit={{ rotateY: 180, scale: 0.8, x: -50, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="w-28 h-40 bg-white border border-gray-200 rounded-2xl flex flex-col justify-between p-4 shadow-2xl backface-hidden transform-style-3d"
                >
                  <div className="flex justify-between items-start leading-none">
                    <span className={`text-xl font-black italic ${SUIT_COLORS[nextCard.suit]}`}>
                      {formatCardName(nextCard.value)}
                    </span>
                    <span className={`text-2xl ${SUIT_COLORS[nextCard.suit]}`}>
                      {SUIT_SYMBOLS[nextCard.suit]}
                    </span>
                  </div>

                  <div className={`text-5xl self-center leading-none ${SUIT_COLORS[nextCard.suit]}`}>
                    {SUIT_SYMBOLS[nextCard.suit]}
                  </div>

                  <div className="flex justify-between items-end leading-none rotate-180">
                    <span className={`text-xl font-black italic ${SUIT_COLORS[nextCard.suit]}`}>
                      {formatCardName(nextCard.value)}
                    </span>
                    <span className={`text-2xl ${SUIT_COLORS[nextCard.suit]}`}>
                      {SUIT_SYMBOLS[nextCard.suit]}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Card shirt if in betting state */}
            {gameState === "betting" && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-28 h-40 bg-radial from-[#bf953f] via-[#fcf6ba] to-[#aa771c] border-4 border-yellow-500 rounded-2xl flex items-center justify-center p-2 shadow-2xl"
              >
                <div className="w-full h-full border border-yellow-500/30 rounded-xl flex items-center justify-center font-black text-xl italic text-yellow-600/80 uppercase tracking-widest bg-black/10">
                  HI-LO
                </div>
              </motion.div>
            )}

          </div>

          {/* Central Notification Overlays */}
          <AnimatePresence>
            {gameState === "cashedout" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 rounded-[2.2rem] p-6 text-center pointer-events-none"
              >
                <Trophy className="w-12 h-12 text-yellow-500 mb-2 animate-bounce" />
                <h3 className="text-white font-black text-2xl italic uppercase tracking-tighter">
                  Выигрыш!
                </h3>
                <div className="text-yellow-500 font-black text-2xl mt-1">
                  + {Math.floor(multiplier * selectedBet * config.base_bonus)} ₽
                </div>

                <button
                  onClick={resetGame}
                  className="mt-6 pointer-events-auto bg-orange-500 hover:bg-orange-600 text-white py-3 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-orange-500/20"
                >
                  Сыграть ещё
                </button>
              </motion.div>
            )}

            {gameState === "gameover" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 rounded-[2.2rem] p-6 text-center pointer-events-none"
              >
                <div className="text-red-500 font-black text-4xl italic uppercase tracking-tighter mb-2 animate-pulse">
                  Промах!
                </div>
                <p className="text-gray-400 text-xs font-medium max-w-[200px]">
                  Неверный выбор. Карта не подыграла вашей интуиции.
                </p>

                <button
                  onClick={resetGame}
                  className="mt-6 pointer-events-auto bg-white text-black hover:bg-red-500 hover:text-white py-3.5 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                  Сбросить
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Input panel choices */}
        {gameState === "betting" && (
          <div className="w-full mt-4 space-y-4">
            <div className="bg-[#111] p-4 rounded-[2.5rem] border border-white/5 space-y-4">
              
              {/* Select bet sizes */}
              <div>
                <div className="flex justify-between items-center mb-2 px-2">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                    Ваша ставка
                  </span>
                  <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {selectedBet} ₽
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[10, 50, 100, 250, 500, 1000].map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        setSelectedBet(n);
                        playSound(600, "sine", 0.05);
                      }}
                      className={`py-2 rounded-xl text-xs font-black transition-all ${selectedBet === n ? "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Sticky Bottom Actions Bar */}
      <div className="w-full fixed bottom-0 left-0 right-0 p-6 bg-linear-to-t from-black via-black/80 to-transparent z-50 flex flex-col items-center">
        {history.length > 0 && gameState === "betting" && (
          <div className="w-full max-w-sm mb-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="shrink-0 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl flex items-center gap-2"
                >
                  <span className="text-orange-500 font-black italic text-[10px]">
                    x{h.multiplier.toFixed(2)}
                  </span>
                  <span className="text-white font-bold text-[8px] opacity-75">
                    {h.won} ₽
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="w-full max-w-sm">
          {gameState === "playing" ? (
            <div className="flex flex-col gap-3 w-full">
              
              {/* Higher / Lower action buttons */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => makeGuess("higher")}
                  className="py-5 rounded-[2rem] font-black text-sm bg-orange-500 text-white uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-orange-500/20 flex flex-col items-center justify-center leading-none"
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowUp className="w-4 h-4" /> ВЫШЕ / =
                  </span>
                  <span className="text-[9px] font-bold opacity-75 mt-1">
                    x{higherMultiplier.toFixed(2)}
                  </span>
                </button>

                <button
                  onClick={() => makeGuess("lower")}
                  className="py-5 rounded-[2rem] font-black text-sm bg-white text-black uppercase tracking-wider active:scale-95 transition-all shadow-md flex flex-col items-center justify-center leading-none"
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowDown className="w-4 h-4" /> НИЖЕ / =
                  </span>
                  <span className="text-[9px] font-bold opacity-75 mt-1">
                    x{lowerMultiplier.toFixed(2)}
                  </span>
                </button>
              </div>

              {/* Cash out button */}
              <button
                onClick={cashOut}
                disabled={multiplier === 1.0}
                className={`w-full py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${
                  multiplier > 1.0
                    ? "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 animate-pulse"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
                }`}
              >
                {multiplier > 1.0
                  ? `ЗАБРАТЬ ${Math.floor(multiplier * selectedBet * config.base_bonus)} ₽`
                  : "СДЕЛАЙТЕ СТАВКУ"}
              </button>

            </div>
          ) : (
            <button
              onClick={startGame}
              disabled={bonusBalance < selectedBet}
              className={`w-full py-5 rounded-[2rem] font-black text-xl uppercase tracking-tighter transition-all active:scale-95 shadow-2xl ${
                bonusBalance >= selectedBet
                  ? "bg-white text-black hover:bg-orange-500 hover:text-white shadow-[0_20px_40px_rgba(255,255,255,0.05)]"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
              }`}
            >
              {bonusBalance >= selectedBet ? (
                <div className="flex flex-col items-center">
                  <span className="flex items-center gap-2">
                    <Play className="w-5 h-5 fill-current" />
                    РАЗДАТЬ КАРТУ
                  </span>
                  <span className="text-[9px] font-bold opacity-50 -mt-0.5 tracking-widest uppercase">
                    Ставка: {selectedBet} ₽
                  </span>
                </div>
              ) : (
                "НЕДОСТАТОЧНО ₽"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Styles for 3D Perspective and cards table */}
      <style jsx global>{`
        .perspective-800 {
          perspective: 800px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
