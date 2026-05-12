"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { GameHeader } from "../components/GameHeader";

/**
 * ИГРА "ROCKET" (CRASH) - PRO VISUALS
 *
 * - Динамическая система координат (масштабирование)
 * - Продвинутая отрисовка ракеты и следа
 * - Сетка с осями (X - время, Y - множитель)
 */

const VIEWPORT_PADDING = 80;

export default function RocketGame() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [gameState, setGameState] = useState<
    "betting" | "playing" | "crashed" | "cashedout"
  >("betting");

  const [tickets, setTickets] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [selectedBet, setSelectedBet] = useState(10);

  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [history, setHistory] = useState<
    { multiplier: string; wonRub: number; won: boolean }[]
  >([]);
  const [showHistory, setShowHistory] = useState(false);

  const [config, setConfig] = useState({
    base_bonus: 1,
    house_edge: 0.95,
    max_multiplier: 100,
    growth_rate: 0.08,
  });

  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pathPointsRef = useRef<
    { x: number; y: number; m: number; t: number }[]
  >([]);

  const playSound = useCallback(
    (
      freq: number,
      type: OscillatorType = "sine",
      duration: number = 0.1,
      volume = 0.05,
    ) => {
      try {
        const AudioContextClass =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
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

        if (data.player?.settings?.game_configs?.rocket) {
          const rocketConfig = data.player.settings.game_configs.rocket;
          setConfig((prev) => ({
            ...prev,
            ...rocketConfig,
            base_bonus: parseFloat(rocketConfig.base_bonus) || 1,
            house_edge: parseFloat(rocketConfig.house_edge) || 0.95,
            max_multiplier: parseFloat(rocketConfig.max_multiplier) || 100,
            growth_rate: parseFloat(rocketConfig.growth_rate) || 0.08,
          }));
        }
      } catch (e) {
        console.error("Failed to load game config", e);
      }
    }
    fetchConfig();
  }, []);

  const generateCrashPoint = useCallback(() => {
    // Instant crash check (House Edge)
    // 0.95 means 5% chance to crash instantly at 1.00x
    if (Math.random() > config.house_edge) return 1.0;

    const h = crypto.getRandomValues(new Uint32Array(1))[0];
    const e = 2 ** 32;
    const result = Math.floor((100 * e - h) / (e - h)) / 100;

    // Ensure it doesn't drop below 1.01 if it passed the instant crash
    const finalResult = Math.max(1.01, result);
    return Math.min(finalResult, config.max_multiplier);
  }, [config]);

  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Clear background
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, w, h);

      // Coordinate mapping
      const maxT = Math.max(8, ((time - startTimeRef.current) / 1000) * 1.2);
      const maxM = Math.max(2, multiplier * 1.2);

      const getX = (t: number) =>
        VIEWPORT_PADDING + (t / maxT) * (w - VIEWPORT_PADDING * 2);
      const getY = (m: number) =>
        h -
        VIEWPORT_PADDING -
        ((m - 1) / (maxM - 1)) * (h - VIEWPORT_PADDING * 2);

      // Draw Grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;

      // Vertical lines (time)
      for (let t = 0; t <= maxT; t += 2) {
        const x = getX(t);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - VIEWPORT_PADDING);
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.font = "10px sans-serif";
        ctx.fillText(`${t}s`, x - 5, h - VIEWPORT_PADDING + 20);
      }

      // Horizontal lines (multiplier)
      for (let m = 1; m <= maxM; m += Math.max(0.5, Math.floor(maxM / 5))) {
        const y = getY(m);
        ctx.beginPath();
        ctx.moveTo(VIEWPORT_PADDING, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillText(`${m.toFixed(1)}x`, 20, y + 4);
      }

      if (gameState === "playing") {
        const elapsed = (time - startTimeRef.current) / 1000;
        const m = Math.pow(Math.E, config.growth_rate * elapsed);
        setMultiplier(m);

        if (m >= crashPoint) {
          setGameState("crashed");
          setMultiplier(crashPoint);
          setHistory((prev) =>
            [
              { multiplier: crashPoint.toFixed(2), wonRub: 0, won: false },
              ...prev,
            ].slice(0, 10),
          );
          playSound(80, "sawtooth", 0.6, 0.1);
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
          return;
        }

        // Add current point to path
        pathPointsRef.current.push({
          t: elapsed,
          m: m,
          x: getX(elapsed),
          y: getY(m),
        });
        if (pathPointsRef.current.length > 500) pathPointsRef.current.shift();

        // Draw Path Trail (Glow)
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#8b5cf6";
        ctx.strokeStyle = "#a78bfa";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(1));
        pathPointsRef.current.forEach((p) => ctx.lineTo(getX(p.t), getY(p.m)));
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw Rocket
        const curX = getX(elapsed);
        const curY = getY(m);

        // Calculate angle (tangent)
        const prev = pathPointsRef.current[
          pathPointsRef.current.length - 2
        ] || { t: 0, m: 1 };
        const angle = Math.atan2(curY - getY(prev.m), curX - getX(prev.t));

        // Shake effect (power vibration)
        const shakeIntensity = Math.min(2, m / 2); // Shakes more as it goes higher
        const shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
        const shakeY = (Math.random() - 0.5) * shakeIntensity * 2;

        ctx.save();
        ctx.translate(curX + shakeX, curY + shakeY);
        ctx.rotate(angle + Math.PI / 2);

        // 1. ENGINE FIRE
        const firePulse = Math.sin(time / 50) * 5;
        const fireHeight = 35 + firePulse;

        const fireGlow = ctx.createRadialGradient(
          0,
          20,
          0,
          0,
          20,
          fireHeight * 1.5,
        );
        fireGlow.addColorStop(0, "rgba(249, 115, 22, 0.8)");
        fireGlow.addColorStop(1, "rgba(249, 115, 22, 0)");
        ctx.fillStyle = fireGlow;
        ctx.beginPath();
        ctx.arc(0, 20, fireHeight, 0, Math.PI * 2);
        ctx.fill();

        const flameGrd = ctx.createLinearGradient(0, 15, 0, 15 + fireHeight);
        flameGrd.addColorStop(0, "#fff");
        flameGrd.addColorStop(0.2, "#60a5fa");
        flameGrd.addColorStop(0.5, "#f97316");
        flameGrd.addColorStop(1, "transparent");

        ctx.fillStyle = flameGrd;
        ctx.beginPath();
        ctx.moveTo(-8, 15);
        ctx.quadraticCurveTo(0, 15 + fireHeight * 1.2, 8, 15);
        ctx.fill();

        // 2. ROCKET BODY
        const bodyGrd = ctx.createLinearGradient(-15, 0, 15, 0);
        bodyGrd.addColorStop(0, "#cbd5e1");
        bodyGrd.addColorStop(0.5, "#f8fafc");
        bodyGrd.addColorStop(1, "#94a3b8");

        ctx.fillStyle = bodyGrd;
        ctx.beginPath();
        ctx.moveTo(0, -35);
        ctx.bezierCurveTo(15, -15, 15, 10, 12, 25);
        ctx.lineTo(-12, 25);
        ctx.bezierCurveTo(-15, 10, -15, -15, 0, -35);
        ctx.fill();

        // 3. FINS
        ctx.fillStyle = "#6366f1";
        ctx.beginPath();
        ctx.moveTo(-12, 5);
        ctx.lineTo(-25, 28);
        ctx.lineTo(-12, 20);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(12, 5);
        ctx.lineTo(25, 28);
        ctx.lineTo(12, 20);
        ctx.fill();

        ctx.fillStyle = "#8b5cf6";
        ctx.fillRect(-2, 15, 4, 12);

        // 4. NOSE CONE
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.moveTo(0, -35);
        ctx.bezierCurveTo(5, -25, 5, -20, 5, -15);
        ctx.lineTo(-5, -15);
        ctx.bezierCurveTo(-5, -20, -5, -25, 0, -35);
        ctx.fill();

        // 5. PORTHOLE
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(0, -2, 7, 0, Math.PI * 2);
        ctx.fill();

        const glassGrd = ctx.createLinearGradient(-5, -5, 5, 5);
        glassGrd.addColorStop(0, "#38bdf8");
        glassGrd.addColorStop(1, "#0284c7");
        ctx.fillStyle = glassGrd;
        ctx.beginPath();
        ctx.arc(0, -2, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.ellipse(-2, -4, 2, 1, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else if (
        gameState === "betting" ||
        gameState === "crashed" ||
        gameState === "cashedout"
      ) {
        // Draw static rocket at start position
        ctx.save();
        ctx.translate(getX(0), getY(1));
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(10, 10);
        ctx.lineTo(-10, 10);
        ctx.fill();
        ctx.restore();
      }

      requestRef.current = requestAnimationFrame(draw);
    },
    [gameState, multiplier, crashPoint, playSound, config.growth_rate],
  );

  const startGame = () => {
    if (bonusBalance < selectedBet) return;
    setBonusBalance((prev) => prev - selectedBet);

    // Persist deduction to server
    fetch("/api/promo/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: -selectedBet, reason: "rocket_bet" }),
      keepalive: true,
    }).catch(console.error);

    setCrashPoint(generateCrashPoint());
    setMultiplier(1.0);
    setGameState("playing");
    startTimeRef.current = performance.now();
    pathPointsRef.current = [];
    playSound(400, "sine", 0.1);
    requestRef.current = requestAnimationFrame(draw);
  };

  const cashOut = () => {
    if (gameState !== "playing") return;
    setGameState("cashedout");

    const wonAmount = Math.floor(selectedBet * config.base_bonus * multiplier);

    if (wonAmount > 0) {
      setBonusBalance((prev) => prev + wonAmount);
      // Persist to server
      fetch("/api/promo/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: wonAmount, reason: "rocket_win" }),
        keepalive: true,
      }).catch(console.error);
    }

    setHistory((prev) =>
      [
        {
          multiplier: (multiplier * config.base_bonus).toFixed(2),
          wonRub: wonAmount,
          won: true,
        },
        ...prev,
      ].slice(0, 10),
    );
    playSound(800, "sine", 0.2);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(draw); // keep drawing static
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight * 0.55; // Leave room for UI below
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    requestRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [draw]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center overflow-hidden relative font-sans select-none touch-none">
      <GameHeader
        bonusBalance={bonusBalance}
        ticketsCount={tickets}
        onHistoryClick={() => setShowHistory(!showHistory)}
        showHistory={showHistory}
        accentColor="text-indigo-500"
      />

      <div className="w-full relative mt-16" style={{ height: "55vh" }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-0 w-full h-full"
        />
        <div className="absolute inset-0 bg-linear-to-b from-indigo-500/10 via-transparent to-transparent pointer-events-none z-0" />

        {/* HUD Overlay */}
        <div className="absolute top-[20%] z-10 pointer-events-none flex flex-col items-center w-full">
          <AnimatePresence mode="wait">
            {gameState !== "betting" && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                className="text-center"
              >
                <div
                  className={`text-7xl sm:text-8xl font-black italic tracking-tighter drop-shadow-[0_0_20px_rgba(139,92,246,0.3)] ${gameState === "crashed" ? "text-red-500" : "text-indigo-400"}`}
                >
                  x{(multiplier * config.base_bonus).toFixed(2)}
                </div>
                {gameState === "playing" && (
                  <div className="text-2xl font-black text-white mt-2 drop-shadow-md">
                    {Math.floor(multiplier * selectedBet * config.base_bonus)} ₽
                  </div>
                )}
                {gameState === "crashed" && (
                  <div className="text-red-500 font-bold uppercase tracking-[0.4em] text-xs mt-2">
                    Ракета взорвалась
                  </div>
                )}
                {gameState === "cashedout" && (
                  <div className="text-green-500 font-bold uppercase tracking-[0.4em] text-xs mt-2">
                    Успешно
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <main className="flex-1 w-full flex flex-col items-center p-4 z-20 bg-[#0a0a0f] border-t border-white/5 relative">
        <AnimatePresence mode="wait">
          {gameState === "betting" ||
          gameState === "crashed" ||
          gameState === "cashedout" ? (
            <motion.div
              key="betting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md space-y-4"
            >
              <div className="bg-[#111] p-5 rounded-[2.5rem] border border-white/5">
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

              <button
                onClick={startGame}
                disabled={bonusBalance < selectedBet}
                className={`w-full py-6 rounded-[2rem] font-black text-2xl uppercase tracking-tighter shadow-2xl transition-all active:scale-95 ${bonusBalance >= selectedBet ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_40px_rgba(79,70,229,0.4)]" : "bg-gray-800 text-gray-500 cursor-not-allowed"}`}
              >
                {bonusBalance >= selectedBet ? "Запуск" : "Недостаточно ₽"}
              </button>

              {gameState === "crashed" && (
                <div className="text-center text-red-500 text-xs font-bold uppercase tracking-widest mt-4">
                  Вы не успели забрать ставку
                </div>
              )}
              {gameState === "cashedout" && (
                <div className="text-center text-green-500 text-xs font-bold uppercase tracking-widest mt-4">
                  Выигрыш зачислен на баланс
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md mt-4"
            >
              <button
                onClick={() => cashOut()}
                className="w-full py-6 rounded-[2rem] font-black text-2xl uppercase tracking-tighter transition-all active:scale-95 bg-orange-500 text-white shadow-[0_0_40px_rgba(249,115,22,0.6)] hover:bg-orange-600"
              >
                Забрать{" "}
                {Math.floor(multiplier * selectedBet * config.base_bonus)} ₽
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick History Bar */}
        {history.length > 0 && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full max-w-md">
              {history.map((h, i) => (
                <div
                  key={i}
                  className={`shrink-0 px-3 py-1.5 rounded-xl border flex items-center gap-2 text-[10px] font-black italic ${h.won ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-red-500/10 border-red-500/20 text-red-500"}`}
                >
                  x{h.multiplier}
                </div>
              ))}
            </div>
          </div>
        )}
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
