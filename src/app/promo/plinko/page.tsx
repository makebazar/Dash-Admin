"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Coins, Play, Sparkles, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { GameHeader } from "../components/GameHeader";

/**
 * ИГРА "PLINKO DASH"
 * 
 * - Треугольная доска с колышками (8 рядов)
 * - 3 режима риска: Низкий (Low), Средний (Medium), Высокий (High)
 * - Настоящая Canvas-физика падения шарика с отскоками и звуками
 * - Интеграция с балансом игрока и историей через /api/promo/balance
 */

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  history: { x: number; y: number }[];
}

interface Peg {
  x: number;
  y: number;
  radius: number;
}

interface Bin {
  x: number;
  w: number;
  multiplier: number;
  color: string;
}

function getBinColors(rows: number, risk: "low" | "medium" | "high"): string[] {
  const size = rows + 1;
  const colors: string[] = [];
  const mid = rows / 2;
  
  for (let i = 0; i < size; i++) {
    const dist = Math.abs(i - mid) / mid; // 0 at center, 1 at edge
    if (risk === "high") {
      if (dist < 0.25) {
        colors.push("#1e293b"); // slate
      } else if (dist < 0.5) {
        colors.push("#f97316"); // orange
      } else if (dist < 0.75) {
        colors.push("#dc2626"); // red
      } else {
        colors.push("#7f1d1d"); // dark red
      }
    } else if (risk === "medium") {
      if (dist < 0.25) {
        colors.push("#eab308"); // yellow
      } else if (dist < 0.5) {
        colors.push("#f97316"); // orange
      } else if (dist < 0.75) {
        colors.push("#ea580c"); // dark orange
      } else {
        colors.push("#ef4444"); // red
      }
    } else {
      if (dist < 0.25) {
        colors.push("#10b981"); // emerald
      } else if (dist < 0.5) {
        colors.push("#22c55e"); // green
      } else if (dist < 0.75) {
        colors.push("#eab308"); // yellow
      } else {
        colors.push("#f97316"); // orange
      }
    }
  }
  return colors;
}

export default function PlinkoGame() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [gameState, setGameState] = useState<"idle" | "rolling" | "landed">("idle");
  const [tickets, setTickets] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [player, setPlayer] = useState<any>(null);
  
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [selectedBet, setSelectedBet] = useState(10);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [lastMultiplier, setLastMultiplier] = useState<number | null>(null);
  const [history, setHistory] = useState<{ multiplier: number; won: number }[]>([]);

  // Base configurations
  const [config, setConfig] = useState<any>({
    base_bonus: 1,
    max_multiplier: 100,
    rows: 8,
    max_edge_mult: 80,
  });

  const rows = config.rows || 8;
  const maxEdgeMult = config.max_edge_mult || 80;

  const multipliers = useMemo(() => {
    const defaultHighEdges: Record<number, number> = { 8: 80, 10: 120, 12: 250 };
    const baseMults: Record<number, Record<string, number[]>> = {
      8: {
        low: [5.0, 2.0, 1.2, 0.7, 0.5, 0.7, 1.2, 2.0, 5.0],
        medium: [15.0, 4.0, 1.5, 0.5, 0.2, 0.5, 1.5, 4.0, 15.0],
        high: [80.0, 10.0, 2.0, 0.3, 0.0, 0.3, 2.0, 10.0, 80.0],
      },
      10: {
        low: [8.0, 4.0, 2.0, 1.3, 1.0, 0.8, 1.0, 1.3, 2.0, 4.0, 8.0],
        medium: [25.0, 8.0, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 8.0, 25.0],
        high: [120.0, 25.0, 7.0, 2.0, 0.5, 0.2, 0.5, 2.0, 7.0, 25.0, 120.0],
      },
      12: {
        low: [12.0, 6.0, 3.0, 1.5, 1.1, 0.9, 0.8, 0.9, 1.1, 1.5, 3.0, 6.0, 12.0],
        medium: [40.0, 12.0, 5.0, 2.0, 1.0, 0.6, 0.3, 0.6, 1.0, 2.0, 5.0, 12.0, 40.0],
        high: [250.0, 50.0, 15.0, 4.0, 1.5, 0.3, 0.1, 0.3, 1.5, 4.0, 15.0, 50.0, 250.0],
      }
    };

    const rowVal = rows === 10 ? 10 : rows === 12 ? 12 : 8;
    const base = baseMults[rowVal][risk];
    const defaultHigh = defaultHighEdges[rowVal];
    const scale = maxEdgeMult / defaultHigh;

    return base.map((val) => {
      if (val === 0.0) return 0.0;
      const scaled = val * scale;
      return parseFloat(scaled.toFixed(1));
    });
  }, [rows, maxEdgeMult, risk]);

  const binColors = useMemo(() => {
    return getBinColors(rows, risk);
  }, [rows, risk]);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playSound = useCallback((freq: number, type: OscillatorType = "sine", duration: number = 0.08) => {
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
        if (data.player?.settings?.game_configs?.plinko) {
          setConfig((prev: any) => ({
            ...prev,
            ...data.player.settings.game_configs.plinko,
          }));
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchData();
  }, []);

  // Animation Engine Refs
  const ballsRef = useRef<Ball[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Layout calculations
  const gravity = 0.18;
  const bounce = 0.5;

  const initPhysics = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Dimensions
    const width = canvas.width;
    const height = canvas.height;

    // Dynamic horizontal and vertical peg spacing based on rows to make it fit beautifully
    let spacingX = 36;
    if (rows === 10) spacingX = 28;
    else if (rows === 12) spacingX = 23;
    const spacingY = spacingX * 0.88;

    const pegRadius = rows === 12 ? 2.5 : rows === 10 ? 3.0 : 3.5;

    // Build pegs
    const pegs: Peg[] = [];
    const startY = 80;

    for (let r = 0; r < rows; r++) {
      const rowPegs = r + 3; // rows have 3, 4, 5... pegs
      const rowWidth = (rowPegs - 1) * spacingX;
      const startX = (width - rowWidth) / 2;

      for (let p = 0; p < rowPegs; p++) {
        pegs.push({
          x: startX + p * spacingX,
          y: startY + r * spacingY,
          radius: pegRadius,
        });
      }
    }

    // Build bins matching spacingX precisely
    const bins: Bin[] = [];
    const binCount = rows + 1;
    const binWidth = spacingX;
    const totalBinWidth = binCount * binWidth;
    const binStartX = (width - totalBinWidth) / 2;

    for (let b = 0; b < binCount; b++) {
      bins.push({
        x: binStartX + b * binWidth,
        w: binWidth,
        multiplier: multipliers[b] || 0,
        color: binColors[b] || "#ef4444",
      });
    }

    return { pegs, bins };
  }, [rows, multipliers, binColors]);

  // Main Draw/Animation Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const physics = initPhysics(canvas);
    if (!physics) return;
    const { pegs, bins } = physics;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pegs (neon dots)
    pegs.forEach((peg) => {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.shadowBlur = 0;
      ctx.fill();
    });

    // Draw Bins
    const binY = canvas.height - 50;
    const binH = 30;

    bins.forEach((bin) => {
      // Background Box
      ctx.beginPath();
      ctx.roundRect(bin.x + 2, binY, bin.w - 4, binH, 6);
      ctx.fillStyle = bin.color + "20"; // translucency
      ctx.strokeStyle = bin.color + "60";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // Text Multiplier
      ctx.font = "black 9px sans-serif";
      ctx.fillStyle = bin.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${bin.multiplier}x`, bin.x + bin.w / 2, binY + binH / 2);
    });

    // Update & Draw active balls
    const activeBalls = ballsRef.current;
    ballsRef.current = activeBalls.filter((ball) => {
      // 1. Apply gravity
      ball.vy += gravity;
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Limit speed
      ball.vx = Math.max(-5, Math.min(5, ball.vx));
      ball.vy = Math.max(-10, Math.min(10, ball.vy));

      // Ball trail
      ball.history.push({ x: ball.x, y: ball.y });
      if (ball.history.length > 6) ball.history.shift();

      // Collision with pegs
      pegs.forEach((peg) => {
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = ball.radius + peg.radius;

        if (dist < minDist) {
          // Push out of collision
          const angle = Math.atan2(dy, dx);
          ball.x = peg.x + Math.cos(angle) * minDist;
          ball.y = peg.y + Math.sin(angle) * minDist;

          // Reflect velocity with friction
          const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
          ball.vx = Math.cos(angle) * speed * bounce + (Math.random() - 0.5) * 0.4;
          ball.vy = Math.sin(angle) * speed * bounce;

          // Peg bounce sound
          playSound(300 + Math.random() * 500, "sine", 0.06);
        }
      });

      // Left/Right boundaries of the triangle
      const maxLeft = 20;
      const maxRight = canvas.width - 20;
      if (ball.x < maxLeft) {
        ball.x = maxLeft;
        ball.vx *= -bounce;
      }
      if (ball.x > maxRight) {
        ball.x = maxRight;
        ball.vx *= -bounce;
      }

      // Landing check (reaches binY)
      if (ball.y >= binY) {
        // Find which bin it landed in
        let landedBin = bins.find((b) => ball.x >= b.x && ball.x <= b.x + b.w);
        // Fallback to closest bin if borders
        if (!landedBin) {
          if (ball.x < bins[0].x) landedBin = bins[0];
          else landedBin = bins[bins.length - 1];
        }

        handleLanding(landedBin.multiplier);
        return false; // delete ball
      }

      // Draw ball trail
      ctx.beginPath();
      ball.history.forEach((pos, idx) => {
        const size = ball.radius * (idx / ball.history.length);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(249, 115, 22, ${0.1 * idx})`;
        ctx.fill();
      });

      // Draw ball itself (neon orange sphere)
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#f97316";
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      return true; // keep ball
    });

    if (ballsRef.current.length > 0 || gameState === "rolling") {
      animationFrameRef.current = requestAnimationFrame(draw);
    }
  }, [gameState, initPhysics, playSound]);

  // Launch Draw Loop on state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.parentElement?.clientWidth || 360;
      canvas.height = 360;
      draw();
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [draw, risk]);

  // Handle final landing
  const handleLanding = async (multiplierValue: number) => {
    const wonAmount = Math.floor(selectedBet * config.base_bonus * multiplierValue);
    setLastMultiplier(multiplierValue);
    setLastWin(wonAmount);
    setGameState("landed");

    // Play landing jackpot sound
    if (multiplierValue >= 2.0) {
      playSound(880, "triangle", 0.3);
      setTimeout(() => playSound(1100, "triangle", 0.3), 100);
    } else if (multiplierValue > 0) {
      playSound(600, "sine", 0.15);
    } else {
      playSound(180, "sawtooth", 0.3);
    }

    if (wonAmount > 0) {
      setBonusBalance((prev) => prev + wonAmount);
      // Persist win transaction
      try {
        await fetch("/api/promo/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: wonAmount, reason: "plinko_win" }),
          keepalive: true,
        });
      } catch (err) {
        console.error(err);
      }
    }

    setHistory((prev) => [
      { multiplier: multiplierValue * config.base_bonus, won: wonAmount },
      ...prev.slice(0, 9),
    ]);
  };

  // Launch Plinko Ball
  const dropBall = async () => {
    if (bonusBalance < selectedBet || ballsRef.current.length > 0) return;

    setGameState("rolling");
    setLastWin(null);
    setLastMultiplier(null);
    setBonusBalance((prev) => prev - selectedBet);

    // Deduct bet transaction
    try {
      await fetch("/api/promo/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: -selectedBet, reason: "plinko_bet" }),
        keepalive: true,
      });
    } catch (err) {
      console.error(err);
    }

    // Add ball to simulation
    const canvas = canvasRef.current;
    if (canvas) {
      const centerX = canvas.width / 2;
      ballsRef.current.push({
        x: centerX + (Math.random() - 0.5) * 12, // slight offset from center
        y: 25,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0.5,
        radius: rows === 12 ? 4 : rows === 10 ? 5 : 6,
        history: [],
      });
      playSound(440, "triangle", 0.12);
      draw();
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
        <div className="text-center mb-2">
          <h1 className="text-3xl sm:text-4xl font-black text-orange-500 tracking-tighter uppercase italic leading-none">
            Plinko <span className="text-white">Dash</span>
          </h1>
          <p className="text-gray-500 text-[9px] uppercase tracking-[0.4em] font-bold mt-2">
            Запусти шар удачи
          </p>
        </div>

        {/* Pegs Canvas Board */}
        <div className="w-full relative flex items-center justify-center bg-[#0a0a0a]/50 rounded-[2.5rem] border border-white/5 py-4 px-2 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] overflow-hidden aspect-square">
          <canvas ref={canvasRef} className="w-full max-w-[360px] h-auto block z-10" />

          {/* Central Result Display Overlay */}
          <AnimatePresence>
            {gameState === "landed" && lastMultiplier !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.3 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs z-20 rounded-[2.5rem] pointer-events-none"
              >
                <div className="bg-black/60 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center min-w-44 text-center">
                  <div className="text-orange-500 text-[10px] font-black uppercase tracking-widest mb-1">
                    Шарик приземлился!
                  </div>
                  <div className="text-5xl font-black italic tracking-tighter text-white py-1">
                    x{lastMultiplier.toFixed(1)}
                  </div>
                  <div className="flex items-center gap-2 text-2xl font-black text-yellow-500 italic mt-2">
                    <Coins className="w-5 h-5 fill-current" />
                    +{lastWin} ₽
                  </div>
                  <button
                    onClick={() => setGameState("idle")}
                    className="mt-6 pointer-events-auto bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-[10px] tracking-widest py-3 px-6 rounded-2xl active:scale-95 transition-all shadow-lg shadow-orange-500/20"
                  >
                    Продолжить
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Risk and Betting Controllers */}
        <div className="w-full mt-4 space-y-4">
          <div className="bg-[#111] p-4 rounded-[2.5rem] border border-white/5 space-y-4">
            
            {/* Risk Selection */}
            <div>
              <div className="flex justify-between items-center mb-2 px-2">
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                  Уровень риска
                </span>
                <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {risk === "low" ? "Низкий" : risk === "medium" ? "Средний" : "Высокий"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["low", "medium", "high"].map((r) => (
                  <button
                    key={r}
                    disabled={ballsRef.current.length > 0}
                    onClick={() => {
                      setRisk(r as any);
                      playSound(500, "sine", 0.05);
                    }}
                    className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 ${risk === r ? "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
                  >
                    {r === "low" ? "Low" : r === "medium" ? "Med" : "High"}
                  </button>
                ))}
              </div>
            </div>

            {/* Bet Sizes */}
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
                    disabled={ballsRef.current.length > 0}
                    onClick={() => {
                      setSelectedBet(n);
                      playSound(600, "sine", 0.05);
                    }}
                    className={`py-2 rounded-xl text-xs font-black transition-all disabled:opacity-40 ${selectedBet === n ? "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* History panel & Drop button */}
      <div className="w-full fixed bottom-0 left-0 right-0 p-6 bg-linear-to-t from-black via-black/80 to-transparent z-50 flex flex-col items-center">
        {history.length > 0 && gameState === "idle" && (
          <div className="w-full max-w-sm mb-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="shrink-0 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl flex items-center gap-2"
                >
                  <span className="text-orange-500 font-black italic text-[10px]">
                    x{h.multiplier.toFixed(1)}
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
          <button
            onClick={dropBall}
            disabled={bonusBalance < selectedBet || ballsRef.current.length > 0}
            className={`w-full py-5 rounded-[2rem] font-black text-xl uppercase tracking-tighter shadow-2xl transition-all active:scale-95 relative overflow-hidden ${
              bonusBalance >= selectedBet && ballsRef.current.length === 0
                ? "bg-white text-black hover:bg-orange-500 hover:text-white shadow-[0_20px_40px_rgba(255,255,255,0.05)]"
                : "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
            }`}
          >
            {ballsRef.current.length > 0 ? (
              <span className="flex items-center justify-center gap-3">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-4 border-gray-500 border-t-transparent rounded-full"
                />
                ШАРИК В ПУТИ...
              </span>
            ) : bonusBalance < selectedBet ? (
              "НЕДОСТАТОЧНО ₽"
            ) : (
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-2">
                  <Play className="w-5 h-5 fill-current" />
                  ЗАПУСТИТЬ ШАР
                </span>
                <span className="text-[9px] font-bold opacity-50 -mt-0.5 tracking-widest uppercase">
                  Ставка: {selectedBet} ₽
                </span>
              </div>
            )}
          </button>
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
