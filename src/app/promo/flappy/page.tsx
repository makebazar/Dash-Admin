"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  History,
  ChevronLeft,
  Trophy,
  Play,
  Bird,
  Zap,
  Coins,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameHeader } from "../components/GameHeader";

/**
 * ИГРА "FLAPPY DASH" - FULLSCREEN & ADAPTIVE
 */

const GRAVITY = 0.3;
const JUMP_STRENGTH = -5.8;
const PIPE_WIDTH = 65;
const PIPE_GAP_BASE = 180;
const PIPE_SPEED_BASE = 3.0;
const BIRD_SIZE = 34;

interface Pipe {
  id: number;
  x: number;
  topHeight: number;
  passed: boolean;
}

export default function FlappyDashGame() {
  const router = useRouter();
  const [gameState, setGameState] = useState<
    "betting" | "playing" | "gameover"
  >("betting");
  const [gameStarted, setGameStarted] = useState(false);
  const [tickets, setTickets] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [score, setScore] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [bestScore, setBestScore] = useState(0);
  const [history, setHistory] = useState<
    { score: number; multiplier: string; won: number }[]
  >([]);
  const [selectedBet, setSelectedBet] = useState(10);

  // Game Config from Admin
  const [config, setConfig] = useState({
    base_bonus: 1, // acts as a multiplier for the bet in this mode
    multiplier_step: 0.1,
    max_multiplier: 10,
    tickets_per_play: 1,
    difficulty: "medium",
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", updateDimensions);
    updateDimensions();
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/promo/player");
        const data = await res.json();

        // Fix balance visibility: ensuring we use correct keys from API
        if (data.player) {
          setTickets(data.tickets || 0);
          setBonusBalance(data.player.bonusBalance || 0);
        }

        if (data.player?.settings?.game_configs?.flappy) {
          const flappyConfig = data.player.settings.game_configs.flappy;
          setConfig((prev) => ({
            ...prev,
            ...flappyConfig,
            base_bonus: flappyConfig.base_bonus || 1, // fallback to 1 to avoid NaN
          }));
        }
      } catch (e) {
        console.error("Failed to load game config", e);
      }
    }
    fetchConfig();
  }, []);

  // Physics Refs
  const birdYRef = useRef(0);
  const birdVelocityRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const requestRef = useRef<number | null>(null);
  const lastPipeId = useRef(0);

  const [renderBird, setRenderBird] = useState({ y: 0, vel: 0 });
  const [renderPipes, setRenderPipes] = useState<Pipe[]>([]);

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

  const calculateMultiplier = useCallback(
    (s: number) => {
      const m = 1.0 + s * config.multiplier_step;
      return Math.min(m, config.max_multiplier);
    },
    [config.multiplier_step, config.max_multiplier],
  );

  const gameOver = useCallback(
    (isWin: boolean = false) => {
      setGameState("gameover");
      setGameStarted(false);

      const finalMult = isWin ? calculateMultiplier(score) : 0;
      const wonAmount = Math.floor(selectedBet * config.base_bonus * finalMult);

      if (wonAmount > 0) {
        setBonusBalance((prev) => prev + wonAmount);
        // Persist to server
        fetch("/api/promo/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: wonAmount, reason: "flappy_win" }),
          keepalive: true,
        }).catch(console.error);
      }

      setMultiplier(finalMult);

      setHistory((prev) =>
        [
          { score, multiplier: finalMult.toFixed(2), won: wonAmount },
          ...prev,
        ].slice(0, 10),
      );

      if (score > bestScore) setBestScore(score);

      if (isWin) {
        playSound(800, "sine", 0.2);
      } else {
        playSound(200, "sawtooth", 0.4);
      }

      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    },
    [
      score,
      bestScore,
      playSound,
      config.base_bonus,
      selectedBet,
      calculateMultiplier,
    ],
  );

  const startGame = () => {
    if (bonusBalance < selectedBet) return;
    setBonusBalance((prev) => prev - selectedBet);

    // Persist deduction to server
    fetch("/api/promo/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: -selectedBet, reason: "flappy_bet" }),
      keepalive: true,
    }).catch(console.error);

    setGameState("playing");
    setGameStarted(false);
    setScore(0);
    setMultiplier(1.0);

    birdYRef.current = dimensions.height / 2;
    birdVelocityRef.current = 0;
    pipesRef.current = [];
    lastPipeId.current = 0;

    setRenderBird({ y: dimensions.height / 2, vel: 0 });
    setRenderPipes([]);
    playSound(440, "sine", 0.1);
  };

  const jump = useCallback(() => {
    if (gameState !== "playing") return;
    if (!gameStarted) {
      setGameStarted(true);
      const initialTop =
        100 + Math.random() * (dimensions.height - PIPE_GAP_BASE - 200);
      pipesRef.current = [
        {
          id: ++lastPipeId.current,
          x: dimensions.width,
          topHeight: initialTop,
          passed: false,
        },
      ];
    }
    birdVelocityRef.current = JUMP_STRENGTH;
    playSound(600, "sine", 0.08);
  }, [gameState, gameStarted, playSound, dimensions]);

  const collectPrize = useCallback(() => {
    if (gameState !== "playing" || !gameStarted) return;
    gameOver(true);
  }, [gameState, gameStarted, gameOver]);

  const lastTimeRef = useRef<number>(0);
  const update = useCallback(
    (time: number) => {
      if (gameState !== "playing") return;

      const dt = lastTimeRef.current
        ? Math.min((time - lastTimeRef.current) / 16.67, 3)
        : 1;
      lastTimeRef.current = time;

      if (gameStarted) {
        birdVelocityRef.current += GRAVITY * dt;
        birdYRef.current += birdVelocityRef.current * dt;

        if (
          birdYRef.current < -50 ||
          birdYRef.current > dimensions.height + 50
        ) {
          gameOver();
          return;
        }

        const speed =
          PIPE_SPEED_BASE *
          (config.difficulty === "hard"
            ? 1.3
            : config.difficulty === "easy"
              ? 0.8
              : 1);
        const nextPipes = pipesRef.current
          .map((p) => ({ ...p, x: p.x - speed * dt }))
          .filter((p) => p.x + PIPE_WIDTH > -100);

        if (
          nextPipes.length === 0 ||
          nextPipes[nextPipes.length - 1].x < dimensions.width * 0.5
        ) {
          const gap =
            PIPE_GAP_BASE *
            (config.difficulty === "hard"
              ? 0.9
              : config.difficulty === "easy"
                ? 1.2
                : 1);

          // Smart height generation: limit difference from last pipe
          const lastPipe = nextPipes[nextPipes.length - 1];
          const minH = 100;
          const maxH = dimensions.height - gap - 100;

          let newTop;
          if (lastPipe) {
            const range = 160; // Max vertical shift between pipes
            const preferredMin = Math.max(minH, lastPipe.topHeight - range);
            const preferredMax = Math.min(maxH, lastPipe.topHeight + range);
            newTop =
              preferredMin + Math.random() * (preferredMax - preferredMin);
          } else {
            newTop = minH + Math.random() * (maxH - minH);
          }

          nextPipes.push({
            id: ++lastPipeId.current,
            x: dimensions.width,
            topHeight: newTop,
            passed: false,
          });
        }

        const birdX = dimensions.width * 0.25;
        const hitMargin = 6;

        nextPipes.forEach((pipe) => {
          const gap =
            PIPE_GAP_BASE *
            (config.difficulty === "hard"
              ? 0.9
              : config.difficulty === "easy"
                ? 1.2
                : 1);
          if (
            birdX + BIRD_SIZE - hitMargin > pipe.x &&
            birdX + hitMargin < pipe.x + PIPE_WIDTH
          ) {
            if (
              birdYRef.current + hitMargin < pipe.topHeight ||
              birdYRef.current + BIRD_SIZE - hitMargin > pipe.topHeight + gap
            ) {
              gameOver();
            }
          }
          if (!pipe.passed && pipe.x + PIPE_WIDTH < birdX) {
            pipe.passed = true;
            setScore((s) => {
              const newScore = s + 1;
              setMultiplier(calculateMultiplier(newScore));
              return newScore;
            });
            playSound(800, "sine", 0.05);
          }
        });
        pipesRef.current = nextPipes;
      }

      setRenderBird({ y: birdYRef.current, vel: birdVelocityRef.current });
      setRenderPipes([...pipesRef.current]);
      requestRef.current = requestAnimationFrame(update);
    },
    [
      gameState,
      gameStarted,
      gameOver,
      playSound,
      dimensions,
      config,
      calculateMultiplier,
    ],
  );

  useEffect(() => {
    if (gameState === "playing") {
      lastTimeRef.current = 0;
      requestRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (gameState === "playing") jump();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, jump]);

  return (
    <div className="fixed inset-0 bg-[#050505] text-white flex flex-col overflow-hidden font-sans select-none touch-none">
      <div className="absolute inset-0 bg-linear-to-b from-green-500/10 via-transparent to-transparent pointer-events-none z-10" />

      <GameHeader
        ticketsCount={tickets}
        bonusBalance={bonusBalance}
        showPrizes={false}
        accentColor="text-green-500"
      />

      <main
        ref={containerRef}
        className="flex-1 relative w-full overflow-hidden max-w-md lg:max-w-lg mx-auto lg:my-8 lg:border lg:border-white/10 lg:rounded-[2.5rem] lg:shadow-2xl lg:bg-[#0a0a0f]"
        onMouseDown={(e) => {
          e.preventDefault();
          if (gameState === "playing") jump();
        }}
      >
        {/* Game Content */}
        {gameState === "playing" && (
          <>
            {/* Background Decor */}
            <div className="absolute bottom-0 w-full h-32 bg-linear-to-t from-green-500/10 to-transparent pointer-events-none" />

            {/* HUD */}
            <div className="absolute top-24 left-0 right-0 z-40 flex flex-col items-center pointer-events-none">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className="text-7xl font-black italic text-orange-500 drop-shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                  x{multiplier.toFixed(2)}
                </div>
                <div className="text-white/50 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                  ВЫИГРЫШ:{" "}
                  {Math.floor(selectedBet * config.base_bonus * multiplier)} ₽
                </div>
              </motion.div>
            </div>

            {/* Collect Button at Bottom */}
            {gameStarted && (
              <div className="absolute bottom-12 left-0 right-0 z-50 flex justify-center pointer-events-none">
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    collectPrize();
                  }}
                  className="pointer-events-auto bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-3xl font-black uppercase tracking-widest shadow-[0_0_40px_rgba(249,115,22,0.6)] transition-all active:scale-95 text-xl"
                >
                  ЗАБРАТЬ{" "}
                  {Math.floor(selectedBet * config.base_bonus * multiplier)} ₽
                </motion.button>
              </div>
            )}

            {/* Bird */}
            <div
              className="absolute z-30 transition-transform duration-0"
              style={{
                left: dimensions.width * 0.25,
                width: BIRD_SIZE,
                height: BIRD_SIZE,
                transform: `translateY(${renderBird.y}px) rotate(${Math.min(Math.max(renderBird.vel * 4, -25), 90)}deg)`,
              }}
            >
              <div className="w-full h-full bg-yellow-400 rounded-lg shadow-[0_0_20px_rgba(250,204,21,0.6)] flex items-center justify-center relative">
                <div className="absolute right-1 top-2 w-2.5 h-2.5 bg-black rounded-full" />
                <div className="absolute -right-2 top-4 w-4 h-3.5 bg-orange-500 rounded-full" />
                {!gameStarted && (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute -top-16 left-1/2 -translate-x-1/2 text-[10px] font-black text-white whitespace-nowrap bg-green-500 px-4 py-2 rounded-full shadow-xl border border-white/20 uppercase tracking-widest"
                  >
                    Жми для старта!
                  </motion.div>
                )}
              </div>
            </div>

            {/* Pipes */}
            {renderPipes.map((pipe) => {
              const gap =
                PIPE_GAP_BASE *
                (config.difficulty === "hard"
                  ? 0.9
                  : config.difficulty === "easy"
                    ? 1.2
                    : 1);
              return (
                <React.Fragment key={pipe.id}>
                  <div
                    className="absolute bg-linear-to-b from-green-600 to-green-800 border-x-4 border-green-900 z-20 shadow-2xl"
                    style={{
                      left: pipe.x,
                      top: 0,
                      width: PIPE_WIDTH,
                      height: pipe.topHeight,
                      borderBottomRightRadius: 12,
                      borderBottomLeftRadius: 12,
                    }}
                  />
                  <div
                    className="absolute bg-linear-to-t from-green-600 to-green-800 border-x-4 border-green-900 z-20 shadow-2xl"
                    style={{
                      left: pipe.x,
                      top: pipe.topHeight + gap,
                      width: PIPE_WIDTH,
                      height: dimensions.height - (pipe.topHeight + gap),
                      borderTopRightRadius: 12,
                      borderTopLeftRadius: 12,
                    }}
                  />
                </React.Fragment>
              );
            })}

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
              <div className="text-[20rem] font-black italic">{score}</div>
            </div>
          </>
        )}

        {/* Betting Overlay */}
        <AnimatePresence>
          {gameState === "betting" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-100 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 pt-24 text-center"
            >
              <div className="w-24 h-24 bg-green-500 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl border-4 border-white/10">
                <Bird className="w-12 h-12 text-white fill-current" />
              </div>

              <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-2">
                Flappy <span className="text-green-500">Dash</span>
              </h1>
              <p className="text-gray-400 text-sm mb-10 max-w-xs uppercase tracking-widest font-bold">
                Выбери ставку и начни полет за бонусами
              </p>

              <div className="w-full max-w-sm space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  {[10, 50, 100, 250, 500, 1000].map((bet) => (
                    <button
                      key={bet}
                      onClick={() => setSelectedBet(bet)}
                      className={`py-4 rounded-2xl font-black text-lg transition-all border-2 ${selectedBet === bet ? "bg-green-500 border-white text-white shadow-lg scale-105" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"}`}
                    >
                      {bet}
                    </button>
                  ))}
                </div>

                <button
                  onClick={startGame}
                  disabled={bonusBalance < selectedBet}
                  className={`w-full py-6 rounded-[2rem] font-black text-2xl uppercase tracking-tighter transition-all active:scale-95 ${bonusBalance >= selectedBet ? "bg-white text-black shadow-2xl" : "bg-gray-800 text-gray-500 cursor-not-allowed"}`}
                >
                  {bonusBalance >= selectedBet ? (
                    <div className="flex flex-col">
                      <span>ПОЛЕТЕЛИ!</span>
                      <span className="text-[10px] opacity-40 -mt-1 tracking-widest uppercase">
                        Ставка: {selectedBet} ₽
                      </span>
                    </div>
                  ) : (
                    "НЕДОСТАТОЧНО БОНУСОВ"
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameState === "gameover" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 z-100 bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-8 pt-20 text-center"
            >
              <div
                className={`font-black text-3xl uppercase italic mb-2 tracking-tighter ${multiplier > 0 ? "text-green-500" : "text-red-500"}`}
              >
                {multiplier > 0 ? "ВЫИГРЫШ" : "СТОЛКНОВЕНИЕ"}
              </div>
              <div className="text-8xl font-black mb-2 text-orange-500 italic drop-shadow-[0_0_30px_rgba(249,115,22,0.5)]">
                x{multiplier.toFixed(2)}
              </div>
              <div className="text-4xl font-black mb-10 text-white">
                {multiplier > 0
                  ? `+${Math.floor(selectedBet * config.base_bonus * multiplier)} ₽`
                  : "0 ₽"}
              </div>

              <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-10">
                <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                  <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">
                    Труб
                  </div>
                  <div className="text-2xl font-black">{score}</div>
                </div>
                <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                  <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">
                    Рекорд
                  </div>
                  <div className="text-2xl font-black">{bestScore}</div>
                </div>
              </div>

              <div className="w-full max-w-sm space-y-4">
                <button
                  onClick={startGame}
                  disabled={bonusBalance < selectedBet}
                  className={`w-full py-6 rounded-[2rem] font-black text-2xl uppercase tracking-tighter transition-all active:scale-95 ${bonusBalance >= selectedBet ? "bg-green-500 text-white shadow-xl shadow-green-500/20" : "bg-gray-800 text-gray-500"}`}
                >
                  {bonusBalance >= selectedBet
                    ? `СНОВА ЗА ${selectedBet} ₽`
                    : "НЕТ БОНУСОВ"}
                </button>
                <button
                  onClick={() => setGameState("betting")}
                  className="w-full py-4 text-gray-400 font-black text-sm uppercase tracking-widest hover:text-white transition-colors"
                >
                  Изменить ставку
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

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
