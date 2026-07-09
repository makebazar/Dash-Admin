"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Coins, Play, Trophy, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { GameHeader } from "../components/GameHeader";

/**
 * ИГРА "TOWER CLIMB" (БАШНЯ)
 * 
 * - Вертикальная башня из 8 этажей
 * - На каждом этаже по 4 плиты (1 мина, 3 безопасных)
 * - Поднимайтесь по плитам этаж за этажом
 * - Множители растут с каждым шагом: 1.3x -> 1.7x -> 2.3x -> 3.1x -> 4.2x -> 5.7x -> 7.8x -> 10.5x
 * - Забирайте выигрыш (Cash Out) на любом пройденном этаже!
 * - Интеграция с балансом и историей через /api/promo/balance
 */

type GameState = "betting" | "playing" | "gameover" | "cashedout";

const TOTAL_ROWS = 8;

export default function TowerGame() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState>("betting");
  const [tickets, setTickets] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [player, setPlayer] = useState<any>(null);

  const [selectedBet, setSelectedBet] = useState(10);
  const [activeRow, setActiveRow] = useState(0); // 0 corresponds to first floor (Level 1)
  const [mines, setMines] = useState<Record<number, number[]>>({}); // rowId -> mineIndices
  const [revealed, setRevealed] = useState<Record<number, number>>({}); // rowId -> chosenIndex
  
  const [history, setHistory] = useState<{ score: number; multiplier: number; won: number }[]>([]);

  // Config fallback
  const [config, setConfig] = useState<any>({
    base_bonus: 1,
    max_multiplier: 100,
    tiles_count: 4,
    mines_count: 1,
    multipliers: "1.3, 1.7, 2.3, 3.1, 4.2, 5.7, 7.8, 10.5",
  });

  const tilesPerRow = config.tiles_count || 4;
  const minesCount = config.mines_count || 1;

  const multipliers = React.useMemo(() => {
    const raw = config.multipliers || "1.3, 1.7, 2.3, 3.1, 4.2, 5.7, 7.8, 10.5";
    const parsed = raw.split(",").map((s: string) => parseFloat(s.trim())).filter((n: number) => !isNaN(n));
    if (parsed.length >= 8) return parsed.slice(0, 8);
    const fallback = [1.3, 1.7, 2.3, 3.1, 4.2, 5.7, 7.8, 10.5];
    while (parsed.length < 8) {
      parsed.push(fallback[parsed.length]);
    }
    return parsed;
  }, [config.multipliers]);

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
        if (data.player?.settings?.game_configs?.tower) {
          setConfig((prev: any) => ({
            ...prev,
            ...data.player.settings.game_configs.tower,
          }));
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchData();
  }, []);

  // Start the Tower game
  const startGame = async () => {
    if (bonusBalance < selectedBet) return;
    setBonusBalance((prev) => prev - selectedBet);

    // Deduct bet from server
    try {
      await fetch("/api/promo/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: -selectedBet, reason: "tower_bet" }),
        keepalive: true,
      });
    } catch (err) {
      console.error(err);
    }

    // Pre-calculate mine positions for all rows
    const newMines: Record<number, number[]> = {};
    for (let r = 0; r < TOTAL_ROWS; r++) {
      const rowMines: number[] = [];
      while (rowMines.length < minesCount) {
        const idx = Math.floor(Math.random() * tilesPerRow);
        if (!rowMines.includes(idx)) {
          rowMines.push(idx);
        }
      }
      newMines[r] = rowMines;
    }

    setMines(newMines);
    setRevealed({});
    setActiveRow(0);
    setGameState("playing");
    playSound(440, "sine", 0.12);
  };

  // Handle clicking a plate on the active row
  const handleTileClick = async (rowIndex: number, tileIndex: number) => {
    if (gameState !== "playing" || rowIndex !== activeRow || revealed[rowIndex] !== undefined) return;

    const chosenMines = mines[rowIndex] || [];
    const isMine = chosenMines.includes(tileIndex);

    setRevealed((prev) => ({
      ...prev,
      [rowIndex]: tileIndex,
    }));

    if (isMine) {
      // BOOM! Hit a mine
      setGameState("gameover");
      playSound(150, "sawtooth", 0.5);
    } else {
      // SAFE! Climbed successfully
      playSound(500 + rowIndex * 80, "sine", 0.1);
      
      const nextRow = rowIndex + 1;
      if (nextRow === TOTAL_ROWS) {
        // Reached the peak, auto Cash Out
        await cashOut(nextRow);
      } else {
        setActiveRow(nextRow);
      }
    }
  };

  // Cash Out winnings
  const cashOut = async (forcedRow?: number) => {
    const finishedRow = forcedRow !== undefined ? forcedRow : activeRow;
    if (gameState !== "playing" || finishedRow === 0) return;

    setGameState("cashedout");
    const mult = multipliers[finishedRow - 1] * config.base_bonus;
    const wonAmount = Math.floor(selectedBet * mult);

    if (wonAmount > 0) {
      setBonusBalance((prev) => prev + wonAmount);
      // Persist win transaction
      try {
        await fetch("/api/promo/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: wonAmount, reason: "tower_win" }),
          keepalive: true,
        });
      } catch (err) {
        console.error(err);
      }
    }

    setHistory((prev) => [
      { score: finishedRow, multiplier: mult, won: wonAmount },
      ...prev.slice(0, 9),
    ]);
    playSound(880, "sine", 0.25);
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

      <main className="flex-1 w-full flex flex-col items-center justify-center p-4 pt-16 pb-36 max-w-md lg:max-w-lg mx-auto lg:my-8 lg:p-8 lg:bg-[#111113]/50 lg:border lg:border-white/10 lg:rounded-[2.5rem] lg:shadow-2xl">
        
        {/* Title */}
        {gameState === "betting" && (
          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-black text-orange-500 tracking-tighter uppercase italic leading-none">
              Tower <span className="text-white">Climb</span>
            </h1>
            <p className="text-gray-500 text-[9px] uppercase tracking-[0.4em] font-bold mt-2">
              Поднимайся за сокровищами
            </p>
          </div>
        )}

        {/* Dynamic Multiplier & Current Payout info */}
        {gameState !== "betting" && (
          <div className="text-center mb-4 z-10">
            <motion.div
              key={activeRow}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-5xl font-black italic tracking-tighter ${
                gameState === "gameover" ? "text-red-500" : "text-orange-500"
              }`}
            >
              x{((activeRow > 0 ? multipliers[activeRow - 1] : 1.0) * config.base_bonus).toFixed(2)}
            </motion.div>
            <div className="text-lg font-black text-white mt-1">
              {gameState === "gameover"
                ? "0"
                : Math.floor(
                    (activeRow > 0 ? multipliers[activeRow - 1] : 1.0) * selectedBet * config.base_bonus
                  )}{" "}
              ₽
            </div>
          </div>
        )}

        {/* Vertical Tower Grid Board */}
        <div className="w-full relative flex flex-col-reverse gap-1.5 bg-[#0a0a0a]/50 p-4 rounded-[2.5rem] border border-white/5 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] overflow-y-auto max-h-[380px] scrollbar-hide">
          {Array.from({ length: TOTAL_ROWS }).map((_, rIdx) => {
            const isActive = rIdx === activeRow && gameState === "playing";
            const isPassed = rIdx < activeRow;
            const hasPlayed = revealed[rIdx] !== undefined;

            return (
              <div
                key={rIdx}
                className={`grid grid-cols-5 gap-1.5 p-1.5 rounded-2xl border transition-all ${
                  isActive
                    ? "bg-orange-500/10 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]"
                    : isPassed
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-white/2 border-white/5 opacity-40 pointer-events-none"
                }`}
              >
                {/* Level multiplier indicator */}
                <div className="col-span-1 flex items-center justify-center font-black italic text-[9px] text-gray-500">
                  x{(multipliers[rIdx] * config.base_bonus).toFixed(1)}
                </div>

                {/* Plates grid row */}
                <div
                  className="col-span-4 grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${tilesPerRow}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: tilesPerRow }).map((_, tIdx) => {
                    const isMine = (mines[rIdx] || []).includes(tIdx);
                    const isChosen = revealed[rIdx] === tIdx;
                    const isGameOver = gameState === "gameover" || gameState === "cashedout";

                    return (
                      <button
                        key={tIdx}
                        disabled={!isActive || isGameOver}
                        onClick={() => handleTileClick(rIdx, tIdx)}
                        className={`
                          h-9 sm:h-10 rounded-xl transition-all relative overflow-hidden flex items-center justify-center
                          ${
                            isChosen
                              ? isMine
                                ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] text-white"
                                : "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)] text-white"
                              : isGameOver && isMine
                              ? "bg-red-900/30 text-red-500/50"
                              : "bg-[#161616]"
                          }
                          ${isActive && !isChosen ? "border border-orange-500/30 hover:border-orange-500 hover:bg-orange-500/10" : "border border-white/5"}
                        `}
                      >
                        {isChosen && !isMine && <Coins className="w-4 h-4 fill-current animate-bounce" />}
                        {((isChosen && isMine) || (isGameOver && isMine)) && (
                          <ShieldAlert className={`w-4 h-4 ${isChosen ? "text-white" : "text-red-500/50"}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Game Ending Full Screen Overlays */}
          <AnimatePresence>
            {gameState === "gameover" && (
              <motion.div
                initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                animate={{ opacity: 1, backdropFilter: "blur(2px)" }}
                exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 rounded-[2.5rem] p-6 text-center"
              >
                <div className="text-red-500 font-black text-4xl italic uppercase tracking-tighter mb-2">
                  Взрыв!
                </div>
                <p className="text-gray-400 text-xs font-medium max-w-[220px]">
                  Вы наткнулись на мину на этаже {activeRow + 1}. Попробуйте ещё раз!
                </p>

                <button
                  onClick={() => setGameState("betting")}
                  className="mt-6 bg-white hover:bg-red-500 hover:text-white text-black py-3 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                >
                  Заново
                </button>
              </motion.div>
            )}

            {gameState === "cashedout" && (
              <motion.div
                initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                animate={{ opacity: 1, backdropFilter: "blur(2px)" }}
                exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 rounded-[2.5rem] p-6 text-center animate-fade-in"
              >
                <Trophy className="w-12 h-12 text-yellow-500 mb-2 animate-bounce" />
                <h3 className="text-white font-black text-2xl italic uppercase tracking-tighter">
                  Победа!
                </h3>
                <div className="text-yellow-500 font-black text-2xl mt-1">
                  +{Math.floor((activeRow > 0 ? multipliers[activeRow - 1] : 1.0) * selectedBet * config.base_bonus)} ₽
                </div>

                <button
                  onClick={() => setGameState("betting")}
                  className="mt-6 bg-orange-500 hover:bg-orange-600 text-white py-3 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-orange-500/20"
                >
                  Ещё раз
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input betting choices */}
        {gameState === "betting" && (
          <div className="w-full mt-4 space-y-4">
            <div className="bg-[#111] p-4 rounded-[2.5rem] border border-white/5 space-y-4">
              
              {/* Bet amount buttons */}
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
            <button
              onClick={() => cashOut()}
              disabled={activeRow === 0}
              className={`w-full py-5 rounded-[2rem] font-black text-xl uppercase tracking-tighter transition-all active:scale-95 shadow-2xl ${
                activeRow > 0
                  ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_20px_40px_rgba(34,197,94,0.3)] animate-pulse"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
              }`}
            >
              {activeRow > 0
                ? `ЗАБРАТЬ ${Math.floor(multipliers[activeRow - 1] * selectedBet * config.base_bonus)} ₽`
                : "ВЫБЕРИТЕ ПЛИТУ"}
            </button>
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
                    НАЧАТЬ ИГРУ
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
