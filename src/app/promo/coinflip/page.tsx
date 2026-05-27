"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Coins, Play, Trophy, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { GameHeader } from "../components/GameHeader";

/**
 * ИГРА "OREL ILI RESHKA 3D" (ОРЕЛ ИЛИ РЕШКА)
 * 
 * - Премиальная золотая монета (Орел или Решка)
 * - Плавный 3D CSS переворот монеты с размытием
 * - Риск-игра (Double-Up): победы можно копить в комбо-цепочку до x7.60!
 * - Настройка шанса выигрыша из админки (высокий хаус эдж)
 * - Интеграция с балансом и историей через /api/promo/balance
 */

type Side = "heads" | "tails";
type GameState = "betting" | "flipping" | "won_round" | "gameover" | "cashedout";

export default function CoinFlipGame() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState>("betting");
  const [tickets, setTickets] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [player, setPlayer] = useState<any>(null);

  const [selectedBet, setSelectedBet] = useState(10);
  const [comboStep, setComboStep] = useState(0);
  
  const [flipResult, setFlipResult] = useState<Side | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [history, setHistory] = useState<{ combo: number; won: number }[]>([]);

  // Config fallback
  const [config, setConfig] = useState<any>({
    base_bonus: 1,
    round1_multiplier: 1.95,
    round2_multiplier: 3.8,
    round3_multiplier: 7.6,
    win_chance: 45, // 45% win chance, 55% loss chance
  });

  const multipliers = React.useMemo(() => [
    config.round1_multiplier || 1.95,
    config.round2_multiplier || 3.8,
    config.round3_multiplier || 7.6
  ], [config.round1_multiplier, config.round2_multiplier, config.round3_multiplier]);

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
        if (data.player?.settings?.game_configs?.coinflip) {
          setConfig((prev: any) => ({
            ...prev,
            ...data.player.settings.game_configs.coinflip,
          }));
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchData();
  }, []);

  // Visual state for Coin CSS 3D animation
  const [coinRotation, setCoinRotation] = useState({ x: 0, y: 0 });
  const [isCoinBlur, setIsCoinBlur] = useState(false);

  // Trigger Coin Flip Animation
  const startFlip = async (sideGuess: Side) => {
    if (gameState === "flipping") return;

    let currentBet = selectedBet;
    let isFirstRound = comboStep === 0;

    if (isFirstRound) {
      if (bonusBalance < selectedBet) return;
      setBonusBalance((prev) => prev - selectedBet);

      // Deduct bet from server
      try {
        await fetch("/api/promo/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: -selectedBet, reason: "coinflip_bet" }),
          keepalive: true,
        });
      } catch (err) {
        console.error(err);
      }
    }

    setGameState("flipping");
    setIsCoinBlur(true);
    playSound(350, "sine", 0.1);

    // Spin animation logic (Add 5-8 full spins)
    const spins = 5 + Math.floor(Math.random() * 4);
    
    // Configurable win chance (e.g. 45%) to guarantee higher loss rate for player
    const winChance = (config.win_chance || 45) / 100;
    const didWin = Math.random() < winChance;
    
    // Choose outcome based on determined win/loss state
    const serverOutcome: Side = didWin 
      ? sideGuess 
      : (sideGuess === "heads" ? "tails" : "heads");
    
    // Calculate ending angle: Heads (eagle) is 0 deg, Tails (10) is 180 deg
    const targetYRotation = spins * 360 + (serverOutcome === "heads" ? 0 : 180);
    
    setCoinRotation({
      x: spins * 180,
      y: targetYRotation,
    });

    // Flip sound beats
    let soundInterval = setInterval(() => {
      playSound(450 + Math.random() * 200, "triangle", 0.04);
    }, 150);

    setTimeout(async () => {
      clearInterval(soundInterval);
      setIsCoinBlur(false);
      setFlipResult(serverOutcome);

      if (didWin) {
        const nextStep = comboStep + 1;
        setComboStep(nextStep);
        playSound(880, "triangle", 0.15);

        // If reached max step, automatically cash out
        if (nextStep === multipliers.length) {
          await cashOut(nextStep);
        } else {
          setGameState("won_round");
        }
      } else {
        // BOOM - Lose everything in current combo
        setGameState("gameover");
        setComboStep(0);
        playSound(180, "sawtooth", 0.4);
      }
    }, 1800); // 1.8 seconds flip animation duration
  };

  // Cash Out winnings
  const cashOut = async (forcedStep?: number) => {
    const activeStep = forcedStep || comboStep;
    if (activeStep === 0) return;

    setGameState("cashedout");
    const mult = multipliers[activeStep - 1] * config.base_bonus;
    const wonAmount = Math.floor(selectedBet * mult);

    if (wonAmount > 0) {
      setBonusBalance((prev) => prev + wonAmount);
      // Persist win transaction
      try {
        await fetch("/api/promo/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: wonAmount, reason: "coinflip_win" }),
          keepalive: true,
        });
      } catch (err) {
        console.error(err);
      }
    }

    setHistory((prev) => [
      { combo: activeStep, won: wonAmount },
      ...prev.slice(0, 9),
    ]);

    setComboStep(0);
    playSound(980, "triangle", 0.25);
  };

  // Reset to initial betting phase
  const resetGame = () => {
    setComboStep(0);
    setGameState("betting");
    setFlipResult(null);
    setCoinRotation({ x: 0, y: 0 });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center overflow-hidden relative font-sans select-none touch-none">
      <div className="absolute inset-0 bg-linear-to-b from-amber-500/10 via-transparent to-transparent pointer-events-none" />

      {/* Top Bar */}
      <GameHeader
        ticketsCount={tickets}
        bonusBalance={bonusBalance}
        accentColor="text-amber-500"
      />

      <main className="flex-1 w-full flex flex-col items-center justify-center p-4 pt-16 pb-36 max-w-md">
        
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-amber-500 tracking-tighter uppercase italic leading-none">
            Орёл <span className="text-white">или Решка</span>
          </h1>
          <p className="text-gray-500 text-[9px] uppercase tracking-[0.4em] font-bold mt-2">
            Испытай свою интуицию
          </p>
        </div>

        {/* Multiplier Combo Progress bar */}
        {comboStep > 0 && (
          <div className="w-full bg-[#111] p-3 rounded-2xl border border-white/5 flex items-center justify-between mb-6">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-2">
              Комбо уровень:
            </span>
            <div className="flex gap-2">
              {multipliers.map((m, idx) => {
                const isPassed = comboStep > idx;
                const isActive = comboStep === idx;
                return (
                  <div
                    key={idx}
                    className={`px-3 py-1 rounded-xl text-[10px] font-black transition-all ${
                      isPassed
                        ? "bg-green-500 text-white"
                        : isActive
                        ? "bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                        : "bg-white/5 text-gray-500"
                    }`}
                  >
                    x{(m * config.base_bonus).toFixed(2)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3D CSS Coin Display Container */}
        <div className="relative w-full aspect-square flex flex-col items-center justify-center bg-[#07190e] rounded-[2.5rem] border-4 border-[#12301c] shadow-[inset_0_0_50px_rgba(0,0,0,0.9),0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.05)_0%,transparent_70%)] pointer-events-none" />
          
          {/* Coin Wrapper with Perspective */}
          <div className="perspective-800 w-36 h-36 relative z-10">
            <div
              className={`w-full h-full relative transform-style-3d transition-transform duration-[1800ms] ease-out-quint`}
              style={{
                transform: `rotateX(${coinRotation.x}deg) rotateY(${coinRotation.y}deg)`,
                filter: isCoinBlur ? "blur(3px)" : "none",
              }}
            >
              {/* Heads Side (Front) */}
              <div className="absolute inset-0 w-full h-full rounded-full backface-hidden flex flex-col items-center justify-center bg-radial from-amber-300 via-amber-500 to-amber-700 border-4 border-amber-200 shadow-[0_0_35px_rgba(245,158,11,0.6),inset_0_0_20px_rgba(0,0,0,0.8)]">
                <div className="w-24 h-24 rounded-full border border-amber-200/20 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="text-4xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">🦅</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-100 italic mt-1.5 filter drop-shadow-[0_1px_2px_black]">
                    ОРЁЛ
                  </span>
                </div>
              </div>

              {/* Tails Side (Back) */}
              <div className="absolute inset-0 w-full h-full rounded-full backface-hidden flex flex-col items-center justify-center bg-radial from-amber-300 via-amber-500 to-amber-700 border-4 border-amber-200 shadow-[0_0_35px_rgba(245,158,11,0.6),inset_0_0_20px_rgba(0,0,0,0.8)] transform rotate-y-180">
                <div className="w-24 h-24 rounded-full border border-amber-200/20 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="text-3xl font-black italic text-amber-100 tracking-tighter filter drop-shadow-[0_2px_4px_black]">10</span>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-200 mt-1 filter drop-shadow-[0_1px_2px_black]">
                    РЕШКА
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Central Result Notification Overlays */}
          <AnimatePresence>
            {gameState === "won_round" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 rounded-[2.2rem] p-6 text-center"
              >
                <Trophy className="w-12 h-12 text-amber-500 mb-2 animate-bounce" />
                <h3 className="text-white font-black text-2xl italic uppercase tracking-tighter">
                  Верный прогноз!
                </h3>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                  Текущий выигрыш: <span className="text-green-500">{Math.floor(selectedBet * multipliers[comboStep - 1] * config.base_bonus)} ₽</span>
                </p>

                <div className="grid grid-cols-2 gap-3 w-full mt-6 max-w-[280px]">
                  <button
                    onClick={() => setGameState("betting")}
                    className="bg-white hover:bg-gray-100 text-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Рискнуть x{multipliers[comboStep] || ""}
                  </button>
                  <button
                    onClick={() => cashOut()}
                    className="bg-green-500 hover:bg-green-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-green-500/20"
                  >
                    Забрать ₽
                  </button>
                </div>
              </motion.div>
            )}

            {gameState === "cashedout" && lastWin !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 rounded-[2.2rem] p-6 text-center"
              >
                <Trophy className="w-14 h-14 text-yellow-500 mb-2 animate-pulse" />
                <h3 className="text-white font-black text-3xl italic uppercase tracking-tighter">
                  Забрали!
                </h3>
                <div className="text-yellow-500 font-black text-2xl mt-2 flex items-center gap-2">
                  <Coins className="w-6 h-6 fill-current" />
                  +{lastWin} ₽
                </div>

                <button
                  onClick={resetGame}
                  className="mt-6 bg-amber-500 hover:bg-amber-600 text-white py-3 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-amber-500/20"
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
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 rounded-[2.2rem] p-6 text-center"
              >
                <div className="text-red-500 font-black text-4xl italic uppercase tracking-tighter mb-2">
                  Не повезло!
                </div>
                <p className="text-gray-400 text-xs font-medium max-w-[240px]">
                  Монета приземлилась другой стороной. Попробуйте ещё раз!
                </p>

                <button
                  onClick={resetGame}
                  className="mt-6 bg-white text-black hover:bg-red-500 hover:text-white py-3.5 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                >
                  Сбросить
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Controls */}
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

      {/* Sticky Bottom Control Panel */}
      <div className="w-full fixed bottom-0 left-0 right-0 p-6 bg-linear-to-t from-black via-black/80 to-transparent z-50 flex flex-col items-center">
        {history.length > 0 && gameState === "betting" && (
          <div className="w-full max-w-sm mb-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="shrink-0 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl flex items-center gap-2"
                >
                  <span className="text-amber-500 font-black italic text-[10px]">
                    x{multipliers[h.combo - 1].toFixed(2)}
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
          {gameState === "flipping" ? (
            <button
              disabled
              className="w-full py-5 rounded-[2rem] font-black text-xl bg-gray-800 text-gray-500 cursor-not-allowed opacity-50 uppercase tracking-tighter flex items-center justify-center gap-3"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-5 h-5 border-4 border-gray-500 border-t-transparent rounded-full"
              />
              МОНЕТА КРУТИТСЯ...
            </button>
          ) : gameState === "won_round" ? (
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={() => setGameState("betting")}
                className="py-5 rounded-[2rem] font-black text-sm bg-white text-black uppercase tracking-widest active:scale-95 transition-all shadow-md"
              >
                ПРОДОЛЖИТЬ
              </button>
              <button
                onClick={() => cashOut()}
                className="py-5 rounded-[2rem] font-black text-sm bg-green-500 text-white uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-green-500/20"
              >
                ЗАБРАТЬ ₽
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={() => startFlip("heads")}
                disabled={comboStep === 0 && bonusBalance < selectedBet}
                className={`py-5 rounded-[2rem] font-black text-lg uppercase tracking-tighter transition-all active:scale-95 ${
                  comboStep > 0 || bonusBalance >= selectedBet
                    ? "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_10px_20px_rgba(245,158,11,0.35)]"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
                }`}
              >
                СТАВКА ОРЁЛ
              </button>
              <button
                onClick={() => startFlip("tails")}
                disabled={comboStep === 0 && bonusBalance < selectedBet}
                className={`py-5 rounded-[2rem] font-black text-lg uppercase tracking-tighter transition-all active:scale-95 ${
                  comboStep > 0 || bonusBalance >= selectedBet
                    ? "bg-amber-600 hover:bg-amber-500 text-white shadow-[0_10px_20px_rgba(217,119,6,0.35)]"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
                }`}
              >
                СТАВКА РЕШКА
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global CSS for 3D Perspective & Rotation */}
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
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .ease-out-quint {
          transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
        }
      `}</style>
    </div>
  );
}
