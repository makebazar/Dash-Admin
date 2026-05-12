"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  ChevronLeft,
  Bomb,
  Trophy,
  Play,
  Coins,
  Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameHeader } from "../components/GameHeader";

/**
 * ИГРА "MINES" (МИНЫ)
 *
 * - Сетка 5x5
 * - Игрок выбирает количество мин (только из настроенных админом)
 * - Каждая открытая пустая ячейка увеличивает множитель (согласно таблице)
 * - Попадание на мину — проигрыш всего накопленного
 * - Возможность забрать выигрыш (Cash Out) после выполнения условий
 */

const GRID_SIZE = 25;

export default function MinesGame() {
  const router = useRouter();
  const [gameState, setGameState] = useState<
    "betting" | "playing" | "gameover" | "cashedout"
  >("betting");
  const [tickets, setTickets] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [mineCount, setMineCount] = useState(3);
  const [mines, setMines] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [multiplier, setMultiplier] = useState(1.0);
  const [nextMultiplier, setNextMultiplier] = useState(0);
  const [history, setHistory] = useState<
    { score: number; multiplier: string; won: number }[]
  >([]);
  const [selectedBet, setSelectedBet] = useState(10);

  // Game Config from Admin
  const [config, setConfig] = useState<any>({
    base_bonus: 1,
    max_multiplier: 100,
    tickets_per_play: 1,
    min_cashout_reveals: 2,
    modes: [
      { mines: 3, multiplier_step: 0.2 },
      { mines: 5, multiplier_step: 0.5 },
    ],
  });

  // Get current multiplier step
  const currentStep = useMemo(() => {
    const mode = config.modes?.find((m: any) => m.mines === mineCount);
    return mode ? parseFloat(mode.multiplier_step || "0.2") : 0.2;
  }, [config.modes, mineCount]);

  // === AUDIO SYSTEM ===
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playSound = useCallback(
    (freq: number, type: OscillatorType = "sine", duration: number = 0.1) => {
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          ctx.currentTime + duration,
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    },
    [],
  );

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/promo/player");
        const data = await res.json();

        if (data.player) {
          setTickets(data.tickets || 0);
          setBonusBalance(data.player.bonusBalance || 0);
        }

        if (data.player?.settings?.game_configs?.mines) {
          const minesConfig = data.player.settings.game_configs.mines;
          setConfig((prev: any) => ({
            ...prev,
            ...minesConfig,
          }));

          // If current mineCount is not in new config, select first available
          if (minesConfig.modes && minesConfig.modes.length > 0) {
            const hasCurrent = minesConfig.modes.some(
              (m: any) => m.mines === mineCount,
            );
            if (!hasCurrent) {
              setMineCount(minesConfig.modes[0].mines);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load game config", e);
      }
    }
    fetchConfig();
  }, []);

  // Calculate next multiplier based on current state
  const calculateMultiplier = (revealedCount: number) => {
    if (revealedCount === 0) return 1.0;
    const rawMult = 1.0 + revealedCount * currentStep;
    return Math.min(rawMult, config.max_multiplier);
  };

  useEffect(() => {
    if (gameState === "playing") {
      setNextMultiplier(calculateMultiplier(revealed.length + 1));
    }
  }, [revealed, gameState, currentStep]);

  const startGame = () => {
    if (bonusBalance < selectedBet) return;
    setBonusBalance((prev) => prev - selectedBet);

    // Persist deduction to server
    fetch("/api/promo/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: -selectedBet, reason: "mines_bet" }),
      keepalive: true,
    }).catch(console.error);

    // Randomize mines
    const newMines: number[] = [];
    while (newMines.length < mineCount) {
      const pos = Math.floor(Math.random() * GRID_SIZE);
      if (!newMines.includes(pos)) newMines.push(pos);
    }

    setMines(newMines);
    setRevealed([]);
    setMultiplier(1.0);
    setGameState("playing");
    playSound(440, "sine", 0.1);
  };

  const handleCellClick = (index: number) => {
    if (gameState !== "playing" || revealed.includes(index)) return;

    if (mines.includes(index)) {
      // BOOM
      setGameState("gameover");
      // Reveal ALL mines
      setRevealed((prev) => [...prev, index]);
      playSound(150, "sawtooth", 0.5);
    } else {
      // SAFE
      const newRevealed = [...revealed, index];
      setRevealed(newRevealed);
      const newMult = calculateMultiplier(newRevealed.length);
      setMultiplier(newMult);
      playSound(600 + newRevealed.length * 50, "sine", 0.1);

      // If all safe cells opened, auto cash out
      if (newRevealed.length === GRID_SIZE - mineCount) {
        cashOut(newMult);
      }
    }
  };

  const cashOut = (forcedMult?: number) => {
    const finalMult = forcedMult || multiplier;
    if (gameState !== "playing" || revealed.length === 0) return;
    setGameState("cashedout");

    const wonAmount = Math.floor(selectedBet * config.base_bonus * finalMult);

    if (wonAmount > 0) {
      setBonusBalance((prev) => prev + wonAmount);
      // Persist to server
      fetch("/api/promo/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: wonAmount, reason: "mines_win" }),
        keepalive: true,
      }).catch(console.error);
    }

    setHistory((prev) =>
      [
        {
          score: revealed.length,
          multiplier: (finalMult * config.base_bonus).toFixed(2),
          won: wonAmount,
        },
        ...prev,
      ].slice(0, 10),
    );
    playSound(880, "sine", 0.2);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center overflow-hidden relative font-sans select-none touch-none">
      <div className="absolute inset-0 bg-linear-to-b from-orange-500/10 via-transparent to-transparent pointer-events-none" />

      {/* Top Bar */}
      <GameHeader
        bonusBalance={bonusBalance}
        ticketsCount={tickets}
        accentColor="text-orange-500"
      />

      <main className="flex-1 w-full flex flex-col items-center justify-center p-4 pt-4 relative">
        <AnimatePresence mode="wait">
          {gameState === "betting" ? (
            <motion.div
              key="betting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md space-y-4"
            >
              <div className="text-center">
                <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-1">
                  Mines <span className="text-orange-500">Dash</span>
                </h2>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em]">
                  Выберите режим и ставку
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-[#111] p-5 rounded-[2.5rem] border border-white/5 space-y-5">
                  <div>
                    <div className="flex justify-between items-center mb-3 px-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Количество мин
                      </span>
                      <span className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">
                        {mineCount} мин
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(config.modes || []).map((m: any) => (
                        <button
                          key={m.mines}
                          onClick={() => setMineCount(m.mines)}
                          className={`py-3 rounded-2xl text-sm font-black transition-all ${mineCount === m.mines ? "bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
                        >
                          {m.mines}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                      <span className="text-[9px] font-bold text-orange-400/80 uppercase tracking-widest">
                        Прирост за безопасную ячейку
                      </span>
                      <span className="text-orange-500 font-black text-xs">
                        +{currentStep}x
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-3 px-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Ваша ставка
                      </span>
                      <span className="bg-yellow-500 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase">
                        {selectedBet} ₽
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[10, 50, 100, 250, 500, 1000].map((n) => (
                        <button
                          key={n}
                          onClick={() => setSelectedBet(n)}
                          className={`py-3 rounded-2xl text-sm font-black transition-all ${selectedBet === n ? "bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.4)]" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-6 bg-linear-to-t from-black via-black/80 to-transparent z-50">
                  <div className="max-w-md mx-auto">
                    <button
                      onClick={startGame}
                      disabled={bonusBalance < selectedBet}
                      className={`w-full py-6 rounded-[2rem] font-black text-2xl uppercase tracking-tighter shadow-2xl transition-all active:scale-95 ${bonusBalance >= selectedBet ? "bg-orange-500 text-white hover:bg-orange-600 shadow-[0_0_40px_rgba(249,115,22,0.4)]" : "bg-gray-800 text-gray-500 cursor-not-allowed"}`}
                    >
                      {bonusBalance >= selectedBet
                        ? "Начать игру"
                        : "Недостаточно ₽"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center pb-32"
            >
              {/* Multiplier Info */}
              <div className="text-center mb-4">
                <motion.div
                  key={multiplier}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`text-6xl font-black italic tracking-tighter ${gameState === "gameover" ? "text-red-500" : "text-orange-500"}`}
                >
                  x{(multiplier * config.base_bonus).toFixed(2)}
                </motion.div>
                <div
                  className={`text-xl font-black mt-0 ${gameState === "gameover" ? "text-red-500/50" : "text-white"}`}
                >
                  {gameState === "gameover"
                    ? "0"
                    : Math.floor(
                        multiplier * selectedBet * config.base_bonus,
                      )}{" "}
                  ₽
                </div>
                {gameState === "playing" &&
                  revealed.length < GRID_SIZE - mineCount && (
                    <div className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em] mt-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                      След.:{" "}
                      <span className="text-orange-500">
                        x{(nextMultiplier * config.base_bonus).toFixed(2)}
                      </span>{" "}
                      (
                      {Math.floor(
                        nextMultiplier * selectedBet * config.base_bonus,
                      )}{" "}
                      ₽)
                    </div>
                  )}
              </div>

              {/* Game Grid */}
              <div className="grid grid-cols-5 gap-2.5 bg-[#111] p-4 rounded-[2.5rem] border-4 border-[#1a1a1a] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative">
                {Array.from({ length: GRID_SIZE }).map((_, i) => {
                  const isRevealed = revealed.includes(i);
                  const isMine = mines.includes(i);
                  const isGameOver =
                    gameState === "gameover" || gameState === "cashedout";

                  return (
                    <motion.button
                      key={i}
                      whileHover={
                        !isRevealed && !isGameOver
                          ? { scale: 1.05, backgroundColor: "#222" }
                          : {}
                      }
                      whileTap={
                        !isRevealed && !isGameOver ? { scale: 0.95 } : {}
                      }
                      onClick={() => handleCellClick(i)}
                      className={`
                        w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all relative overflow-hidden
                        ${
                          isRevealed
                            ? isMine
                              ? "bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)]"
                              : "bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]"
                            : isGameOver && isMine
                              ? "bg-red-900/40"
                              : "bg-[#1a1a1a]"
                        }
                        ${!isRevealed && !isGameOver ? "border border-white/10 hover:border-orange-500/50" : ""}
                      `}
                    >
                      <AnimatePresence>
                        {isRevealed && !isMine && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-white"
                          >
                            <Coins className="w-8 h-8 fill-current" />
                          </motion.div>
                        )}
                        {(isRevealed && isMine) || (isGameOver && isMine) ? (
                          <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className={
                              isRevealed ? "text-white" : "text-red-500/50"
                            }
                          >
                            <Bomb className="w-8 h-8 fill-current" />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}

                {/* Status Overlays */}
                <AnimatePresence>
                  {gameState === "gameover" && (
                    <motion.div
                      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                      animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
                      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 rounded-[2.2rem]"
                    >
                      <div className="text-red-500 font-black text-4xl italic uppercase tracking-tighter mb-6">
                        Взрыв!
                      </div>
                      <button
                        onClick={() => setGameState("betting")}
                        className="bg-white text-black px-8 py-3 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-red-500 hover:text-white transition-all"
                      >
                        Заново
                      </button>
                    </motion.div>
                  )}
                  {gameState === "cashedout" && (
                    <motion.div
                      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                      animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
                      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 rounded-[2.2rem]"
                    >
                      <Trophy className="w-12 h-12 text-yellow-500 mb-2" />
                      <div className="text-white font-black text-3xl italic uppercase tracking-tighter mb-1">
                        Победа!
                      </div>
                      <div className="text-yellow-500 font-black text-2xl mb-6">
                        +
                        {Math.floor(
                          multiplier * selectedBet * config.base_bonus,
                        )}{" "}
                        ₽
                      </div>
                      <button
                        onClick={() => setGameState("betting")}
                        className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-orange-600 transition-all shadow-xl"
                      >
                        Ещё раз
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Cashout Button - Sticky */}
              {gameState === "playing" && (
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-linear-to-t from-black via-black/80 to-transparent z-50">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="max-w-md mx-auto"
                  >
                    <button
                      onClick={() => cashOut()}
                      disabled={revealed.length < config.min_cashout_reveals}
                      className={`w-full py-6 rounded-[2rem] font-black text-2xl uppercase tracking-tighter shadow-2xl transition-all active:scale-95 ${revealed.length >= config.min_cashout_reveals ? "bg-green-500 text-white shadow-[0_0_40px_rgba(34,197,94,0.4)] hover:bg-green-600" : "bg-gray-800 text-gray-500 cursor-not-allowed"}`}
                    >
                      {revealed.length >= config.min_cashout_reveals
                        ? `Забрать ${Math.floor(multiplier * selectedBet * config.base_bonus)} ₽`
                        : `Минимум ${config.min_cashout_reveals} яч.`}
                    </button>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* History Bottom Bar */}
      {history.length > 0 && gameState === "betting" && (
        <div className="w-full max-w-md pb-32 px-4">
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
            {history.map((h, i) => (
              <div
                key={i}
                className="flex-shrink-0 bg-white/5 border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-3"
              >
                <span className="text-orange-500 font-black italic text-xs">
                  x{h.multiplier}
                </span>
                <span className="text-white font-bold text-[10px]">
                  {h.won} ₽
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
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
