"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
} from "framer-motion";
import { GameHeader } from "../components/GameHeader";
import { PrizesSidebar } from "../components/PrizesSidebar";

/**
 * РЕАЛИСТИЧНАЯ ФИЗИКА КОЛЕСА ФОРТУНЫ
 *
 * - SVG отрисовка (как на скриншоте)
 * - Настоящая физика коллизий "язычка" (флаппера) и штифтов
 * - Генерация звука (механический щелчок) через Web Audio API
 */

// Математика для SVG-секторов
const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) => {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M",
    x,
    y,
    "L",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    1,
    end.x,
    end.y,
    "Z",
  ].join(" ");
};

// Sector Colors
const COLORS = [
  "#a855f7", // Purple
  "#334155", // Slate (for empty)
  "#ef4444", // Red
  "#334155", // Slate
  "#f97316", // Orange
  "#4ade80", // Green
  "#3b82f6", // Blue
  "#eab308", // Yellow
];

export default function RealisticWheel() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [ticketsCount, setTicketsCount] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [player, setPlayer] = useState<any>(null);
  const [sectors, setSectors] = useState<any[]>([]);
  const [rawPrizes, setRawPrizes] = useState<any[]>([]);
  const [showPrizes, setShowPrizes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3000);
  };

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Fetch tickets
        const playerRes = await fetch("/api/promo/player");
        const playerData = await playerRes.json();
        if (playerData.success || playerData.tickets !== undefined) {
          setPlayer(playerData.player);
          setTicketsCount(playerData.tickets);
          setBonusBalance(playerData.player?.bonusBalance || 0);
        }

        // 2. Fetch prizes
        const prizesRes = await fetch(
          "/api/promo/prizes?gameType=wheel&all=true",
        );
        const prizesData = await prizesRes.json();

        if (prizesData.success) {
          const allPrizes = prizesData.prizes || [];
          setRawPrizes(allPrizes);

          // Get player level from playerData if possible, or fallback to currentLevel
          const currentLevel = playerData.player?.level?.currentLevel || 1;

          // Filter prizes for the wheel: only current level
          const wheelPrizes = allPrizes.filter(
            (p: any) => (p.target_level || 1) === currentLevel,
          );

          interface Sector {
            id: string | number;
            label: string;
            color: string;
            isPrize: boolean;
          }

          // Build sectors.
          let newSectors: Sector[] = wheelPrizes.map((p: any, i: number) => {
            const isEmpty =
              p.type === "none" ||
              p.name.toLowerCase() === "пусто" ||
              p.name.toLowerCase() === "попробуй еще" ||
              p.value === 0;

            return {
              id: p.id,
              label: p.name,
              color: COLORS[i % COLORS.length],
              isPrize: !isEmpty,
            };
          });

          // If too few sectors, add some empty ones for balance
          if (newSectors.length < 8) {
            const needed = 8 - newSectors.length;
            for (let i = 0; i < needed; i++) {
              newSectors.push({
                id: `fallback-empty-${i}`,
                label: "Пусто",
                color: "#334155",
                isPrize: false,
              });
            }
          }

          // If too many sectors (unlikely with level filtering, but for safety), limit them
          if (newSectors.length > 16) {
            newSectors = newSectors.slice(0, 16);
          }

          // Shuffle sectors
          const shuffledSectors = newSectors.sort(() => Math.random() - 0.5);
          setSectors(shuffledSectors);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Motion Value для отслеживания текущего угла поворота колеса
  const wheelRotation = useMotionValue(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastPinRef = useRef<number>(-1);

  const sectorAngle = 360 / (sectors.length || 1);

  // === ФИЗИКА ЯЗЫЧКА (Флаппера) ===
  const flapperRot = useTransform(wheelRotation, (r) => {
    if (sectors.length === 0) return 0;

    // Штифты находятся на границах секторов
    const halfSector = sectorAngle / 2;
    const mod = (((r + halfSector) % sectorAngle) + sectorAngle) % sectorAngle;

    const threshold = sectorAngle * 0.85;
    if (mod > threshold) {
      const progress = (mod - threshold) / (sectorAngle - threshold);
      return progress * -35;
    }
    if (mod < 10) {
      const progress = mod / 10;
      return Math.sin(progress * Math.PI * 2) * (1 - progress) * 15;
    }
    return 0;
  });

  // === ЗВУК И КОЛЛИЗИИ ===
  useEffect(() => {
    if (sectors.length === 0) return;

    const playTick = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.03);

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    };

    const unsubscribe = wheelRotation.on("change", (latest) => {
      const halfSector = sectorAngle / 2;
      const currentPin = Math.floor((latest + halfSector) / sectorAngle);
      if (currentPin !== lastPinRef.current) {
        if (lastPinRef.current !== -1) playTick();
        lastPinRef.current = currentPin;
      }
    });

    return () => unsubscribe();
  }, [wheelRotation, sectors, sectorAngle]);

  const spinWheel = async () => {
    if (isSpinning || sectors.length === 0) return;

    if (ticketsCount <= 0) {
      showError("У вас нет билетов!");
      return;
    }

    setIsSpinning(true);
    setResult(null);

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }

    try {
      const res = await fetch("/api/promo/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "wheel" }),
        cache: "no-store",
      });

      const data = await res.json();

      if (!data.success) {
        showError(data.error || "Ошибка запуска игры");
        setIsSpinning(false);
        return;
      }

      setTicketsCount((prev) => prev - 1);

      let targetSector;
      if (data.won) {
        // Find sector by prize ID
        targetSector = sectors.find((s) => s.id === data.prize.id);
        // Fallback if ID didn't match (e.g. dynamic sectors)
        if (!targetSector) {
          targetSector = sectors.find((s) => s.isPrize) || sectors[0];
        }
      } else {
        const emptySectors = sectors.filter((s) => !s.isPrize);
        targetSector =
          emptySectors[Math.floor(Math.random() * emptySectors.length)] ||
          sectors[0];
      }

      const idx = sectors.indexOf(targetSector);
      const currentRot = wheelRotation.get();

      const extraSpins = 8 + Math.floor(Math.random() * 4);
      const baseRot = currentRot + extraSpins * 360;
      const jitter = (Math.random() - 0.5) * (sectorAngle * 0.6);

      // Target angle: 360 - (idx * sectorAngle)
      const targetMod = (360 - idx * sectorAngle + jitter) % 360;
      const currentMod = baseRot % 360;
      let diff = targetMod - currentMod;
      if (diff < 0) diff += 360;

      const finalAngle = baseRot + diff;

      await animate(wheelRotation, finalAngle, {
        type: "tween",
        duration: 7 + Math.random() * 2,
        ease: [0.15, 0, 0.1, 1],
      });

      setResult(targetSector);

      // Update counters instantly for the animation
      if (data.won && data.prize) {
        if (data.prize.type === "virtual" || data.prize.type === "bonus_limitless") {
          setBonusBalance((prev) => prev + parseFloat(data.prize.value));
        } else if (data.prize.type === "attempt") {
          setTicketsCount(
            (prev) => prev + Math.floor(parseFloat(data.prize.value) || 1),
          );
        }
      }

      // Handle Quest Rewards (Show a notification or update balance)
      if (data.questRewards && data.questRewards.length > 0) {
        data.questRewards.forEach((q: any) => {
          if (q.rewardBonusBalance > 0) {
            setBonusBalance((prev) => prev + parseFloat(q.rewardBonusBalance));
          }
          if (q.rewardTickets > 0) {
            setTicketsCount((prev) => prev + parseInt(q.rewardTickets));
          }
        });
      }
    } catch (err) {
      console.error("Spin error:", err);
      showError("Ошибка сети");
    } finally {
      setIsSpinning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col items-center justify-center p-6 overflow-hidden font-sans relative">
      <GameHeader
        ticketsCount={ticketsCount}
        bonusBalance={bonusBalance}
        accentColor="text-orange-500"
        showPrizes={showPrizes}
        onPrizesClick={() => setShowPrizes(true)}
      />

      <PrizesSidebar
        isOpen={showPrizes}
        onClose={() => setShowPrizes(false)}
        prizes={rawPrizes}
        playerLevel={player?.level?.currentLevel}
      />

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="absolute top-20 z-100 bg-red-900/90 text-red-100 px-6 py-3 rounded-xl font-bold tracking-widest uppercase shadow-[0_0_30px_rgba(239,68,68,0.6)] border-2 border-red-500/80 backdrop-blur-md text-sm text-center"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <h1 className="text-3xl font-bold mb-16 text-orange-500 mt-16 sm:mt-0">
        Колесо Фортуны
      </h1>

      <div className="relative w-[320px] h-80 sm:w-112.5 sm:h-112.5">
        <div className="absolute inset-0 rounded-full bg-[#1c1c1c] shadow-[0_0_40px_rgba(0,0,0,0.8),inset_0_10px_20px_rgba(0,0,0,0.5)] box-border">
          <motion.div
            style={{ rotate: wheelRotation }}
            className="w-full h-full relative rounded-full overflow-hidden"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {sectors.map((sector, i) => (
                <g key={i}>
                  <path
                    d={describeArc(
                      50,
                      50,
                      50,
                      i * sectorAngle - sectorAngle / 2,
                      i * sectorAngle + sectorAngle / 2,
                    )}
                    fill={sector.color}
                  />
                  {/* Текст (Радиальное расположение) */}
                  <text
                    x="50"
                    y="10" // Располагаем ближе к краю
                    transform={`rotate(${i * sectorAngle}, 50, 50) rotate(90, 50, 10)`}
                    textAnchor="start"
                    alignmentBaseline="middle"
                    className="fill-white font-bold tracking-tight"
                    style={{
                      fontSize:
                        sectors.length > 12
                          ? "2.5px"
                          : sectors.length > 8
                            ? "3.5px"
                            : "4.5px",
                      filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.8))",
                    }}
                  >
                    {sector.label.length > 15
                      ? sector.label.substring(0, 12) + ".."
                      : sector.label}
                  </text>
                </g>
              ))}

              <circle
                cx="50"
                cy="50"
                r="12"
                fill="#1c1c1c"
                stroke="#ffffff"
                strokeWidth="1"
              />
              <circle cx="50" cy="50" r="4" fill="#333" />
            </svg>

            {sectors.map((_, i) => {
              const pos = polarToCartesian(
                50,
                50,
                46,
                i * sectorAngle + sectorAngle / 2,
              );
              return (
                <div
                  key={`pin-${i}`}
                  className="absolute w-[4%] h-[4%] bg-linear-to-br from-gray-100 to-gray-400 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.8)] border border-gray-600"
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              );
            })}
          </motion.div>
        </div>

        <div className="absolute -top-7.5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
          <div className="w-8 h-6 bg-linear-to-b from-gray-200 to-gray-400 rounded-t-md shadow-md border-b border-gray-500 flex items-center justify-center z-20">
            <div className="w-3 h-3 bg-gray-500 rounded-full shadow-inner border border-gray-400" />
          </div>

          <motion.div
            className="w-4 h-14 bg-white shadow-[0_5px_15px_rgba(0,0,0,0.5)] -mt-1 z-10"
            style={{
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
              rotate: flapperRot,
              transformOrigin: "top center",
            }}
          >
            <div className="w-1 h-full bg-black/10 ml-0.5" />
          </motion.div>
        </div>
      </div>

      <div className="mt-16 flex flex-col items-center gap-6">
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-2xl font-bold bg-white/10 px-8 py-3 rounded-full border border-white/20 text-center"
            >
              {!result.isPrize ||
              result.label.toLowerCase() === "пусто" ||
              result.label.toLowerCase() === "попробуй еще"
                ? "Попробуй еще раз! 🥺"
                : `Твой приз: ${result.label} 🎉`}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={spinWheel}
          disabled={isSpinning || sectors.length === 0}
          className={`
            px-12 py-4 rounded-full font-bold text-xl transition-all active:scale-95
            ${
              isSpinning || sectors.length === 0
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-linear-to-r from-orange-500 to-red-600 hover:shadow-[0_0_30px_rgba(234,88,12,0.4)] shadow-lg text-white"
            }
          `}
        >
          {isSpinning ? "Крутится..." : "КРУТИТЬ!"}
        </button>

        <p className="text-gray-500 text-sm italic">
          У вас доступно: {ticketsCount}{" "}
          {ticketsCount % 10 === 1 && ticketsCount % 100 !== 11
            ? "попытка"
            : ticketsCount % 10 >= 2 &&
                ticketsCount % 10 <= 4 &&
                (ticketsCount % 100 < 10 || ticketsCount % 100 >= 20)
              ? "попытки"
              : "попыток"}
        </p>
      </div>
    </div>
  );
}
