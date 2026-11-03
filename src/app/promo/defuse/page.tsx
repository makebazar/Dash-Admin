"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  Scissors,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { GameHeader } from "../components/GameHeader";
import { PrizesSidebar } from "../components/PrizesSidebar";

const WIRES = [
  {
    id: "red",
    label: "КРАСНЫЙ",
    code: "01",
    color: "#ef4444",
    glow: "rgba(239, 68, 68, 0.55)",
    gradient: "from-red-700 via-red-500 to-red-700",
    dot: "bg-red-500",
  },
  {
    id: "blue",
    label: "СИНИЙ",
    code: "02",
    color: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.55)",
    gradient: "from-blue-700 via-sky-400 to-blue-700",
    dot: "bg-blue-500",
  },
  {
    id: "yellow",
    label: "ЖЁЛТЫЙ",
    code: "03",
    color: "#eab308",
    glow: "rgba(234, 179, 8, 0.55)",
    gradient: "from-amber-600 via-yellow-300 to-amber-600",
    dot: "bg-yellow-400",
  },
  {
    id: "green",
    label: "ЗЕЛЁНЫЙ",
    code: "04",
    color: "#10b981",
    glow: "rgba(16, 185, 129, 0.55)",
    gradient: "from-emerald-700 via-emerald-400 to-emerald-700",
    dot: "bg-emerald-500",
  },
  {
    id: "purple",
    label: "ФИОЛЕТОВЫЙ",
    code: "05",
    color: "#a855f7",
    glow: "rgba(168, 85, 247, 0.55)",
    gradient: "from-purple-700 via-fuchsia-400 to-purple-700",
    dot: "bg-purple-500",
  },
] as const;

type WireId = (typeof WIRES)[number]["id"];

const INITIAL_SECONDS = 5.0;
const BONUS_SECONDS = 3.0;

export default function DefuseGame() {
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<any>(null);
  const [tickets, setTickets] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [showPrizes, setShowPrizes] = useState(false);

  const [gameState, setGameState] = useState<"idle" | "armed" | "result">(
    "idle",
  );
  const [timerText, setTimerText] = useState("05.00");
  const [bonusAdded, setBonusAdded] = useState(false);
  const [cutWires, setCutWires] = useState<WireId[]>([]);
  const [safeWires, setSafeWires] = useState<WireId[]>([]);
  const [explodedWire, setExplodedWire] = useState<WireId | null>(null);
  const [result, setResult] = useState<{
    won: boolean;
    prize?: any;
    reason?: "defused" | "wrong_wire" | "timeout";
  } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const router = useRouter();

  const audioCtxRef = useRef<AudioContext | null>(null);
  const isMutedRef = useRef(isMuted);
  const rafRef = useRef<number | null>(null);

  // Active armed round state stored in ref for instant synchronous access on wire tap / timer tick
  const roundRef = useRef<{
    active: boolean;
    startTime: number;
    bonusSeconds: number;
    lastBeep: number;
    serverPromise: Promise<any> | null;
    serverData: any | null;
    failOnStep: 1 | 2;
    cutList: WireId[];
  }>({
    active: false,
    startTime: 0,
    bonusSeconds: 0,
    lastBeep: 0,
    serverPromise: null,
    serverData: null,
    failOnStep: 2,
    cutList: [],
  });

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const getAudioCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const playSound = useCallback(
    (type: "beep" | "arm" | "snip_ok" | "defused" | "explode") => {
      if (isMutedRef.current) return;
      const ctx = getAudioCtx();
      if (!ctx) return;

      const now = ctx.currentTime;
      if (type === "beep") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(2750, now);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.065);
      } else if (type === "arm") {
        [1800, 2400].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(freq, now + i * 0.07);
          gain.gain.setValueAtTime(0.06, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.065);
        });
      } else if (type === "snip_ok") {
        [880, 1320].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + i * 0.055);
          gain.gain.setValueAtTime(0.11, now + i * 0.055);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.055);
          osc.stop(now + i * 0.055 + 0.13);
        });
      } else if (type === "defused") {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.11, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + idx * 0.07 + 0.35,
          );
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.36);
        });
      } else if (type === "explode") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.48);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.52);
      }
    },
    [getAudioCtx],
  );

  useEffect(() => {
    async function init() {
      try {
        const [playerRes, prizesRes] = await Promise.all([
          fetch("/api/promo/player"),
          fetch("/api/promo/prizes?gameType=defuse&all=true"),
        ]);

        if (playerRes.status === 401) {
          router.push("/promo");
          return;
        }

        const playerData = await playerRes.json();
        const prizesData = await prizesRes.json();

        setPlayer(playerData.player);
        setTickets(playerData.tickets || 0);
        setBonusBalance(playerData.player?.bonusBalance || 0);
        setPrizes(prizesData.prizes || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [router]);

  const ticketCost =
    Number(player?.settings?.game_configs?.defuse?.tickets_per_play) || 1;

  const applyServerRewards = useCallback((data: any) => {
    if (!data) return;
    if (data.won && data.prize) {
      if (
        data.prize.type === "virtual" ||
        data.prize.type === "bonus_limitless"
      ) {
        setBonusBalance((prev) => prev + (parseFloat(data.prize.value) || 0));
      } else if (data.prize.type === "attempt") {
        setTickets(
          (prev) => prev + Math.floor(parseFloat(data.prize.value) || 1),
        );
      }
    }
    if (Array.isArray(data.questRewards)) {
      data.questRewards.forEach((q: any) => {
        if (q.rewardBonusBalance > 0) {
          setBonusBalance(
            (prev) => prev + (parseFloat(q.rewardBonusBalance) || 0),
          );
        }
        if (q.rewardTickets > 0) {
          setTickets((prev) => prev + (parseInt(q.rewardTickets) || 0));
        }
      });
    }
  }, []);

  const finishRound = useCallback(
    async (
      finalCutList: WireId[],
      outcome: "defused" | "wrong_wire" | "timeout",
    ) => {
      roundRef.current.active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      let data = roundRef.current.serverData;
      if (!data && roundRef.current.serverPromise) {
        try {
          data = await roundRef.current.serverPromise;
        } catch {
          data = null;
        }
      }

      const allIds = WIRES.map((w) => w.id);
      const didWin = Boolean(outcome === "defused" && data?.won && data?.prize);

      if (didWin) {
        setSafeWires(finalCutList);
        setExplodedWire(null);
        setResult({
          won: true,
          prize: data.prize,
          reason: "defused",
        });
        setGameState("result");
        playSound("defused");
        applyServerRewards(data);
      } else {
        const badWire =
          outcome === "wrong_wire"
            ? finalCutList[finalCutList.length - 1]
            : null;
        const firstSafe =
          finalCutList.length === 2 ? [finalCutList[0]] : [];
        const candidates = allIds.filter(
          (id) => id !== badWire && !firstSafe.includes(id),
        );
        const picked = [...firstSafe];
        while (picked.length < 2 && candidates.length > 0) {
          const idx = Math.floor(Math.random() * candidates.length);
          picked.push(candidates.splice(idx, 1)[0]);
        }

        setSafeWires(picked);
        setExplodedWire(badWire);
        if (outcome === "timeout") setTimerText("00.00");
        setResult({
          won: false,
          prize: null,
          reason: outcome,
        });
        setGameState("result");
        playSound("explode");
        applyServerRewards(data);
      }
    },
    [applyServerRewards, playSound],
  );

  // Start a new armed C4 round when clicking the sticky bottom "ИГРАТЬ" button
  const startRound = async () => {
    if (gameState === "armed" || tickets < ticketCost) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    setCutWires([]);
    setSafeWires([]);
    setExplodedWire(null);
    setBonusAdded(false);
    setResult(null);
    setTimerText("05.00");
    setGameState("armed");
    playSound("arm");

    setTickets((prev) => Math.max(0, prev - ticketCost));

    const startTime = performance.now();
    const failOnStep: 1 | 2 = Math.random() < 0.35 ? 1 : 2;

    const serverPromise = fetch("/api/promo/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameType: "defuse",
        availableWires: WIRES.map((w) => w.id),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        roundRef.current.serverData = data;
        return data;
      });

    roundRef.current = {
      active: true,
      startTime,
      bonusSeconds: 0,
      lastBeep: 0,
      serverPromise,
      serverData: null,
      failOnStep,
      cutList: [],
    };

    const tick = (now: number) => {
      if (!roundRef.current.active) return;
      const totalAllowed = INITIAL_SECONDS + roundRef.current.bonusSeconds;
      const elapsedSec = (now - roundRef.current.startTime) / 1000;
      const rem = Math.max(0, totalAllowed - elapsedSec);
      const sec = Math.floor(rem).toString().padStart(2, "0");
      const cs = Math.floor((rem % 1) * 100)
        .toString()
        .padStart(2, "0");
      setTimerText(`${sec}.${cs}`);

      // Accelerating C4 beep based on remaining time
      const beepGap = Math.max(85, Math.min(500, rem * 90));
      if (now - roundRef.current.lastBeep >= beepGap) {
        roundRef.current.lastBeep = now;
        playSound("beep");
      }

      if (
        rem <= 0.08 &&
        roundRef.current.serverData?.won &&
        roundRef.current.serverData?.prize
      ) {
        const currentCuts = [...roundRef.current.cutList];
        for (const w of WIRES) {
          if (currentCuts.length >= 2) break;
          if (!currentCuts.includes(w.id)) currentCuts.push(w.id);
        }
        roundRef.current.cutList = currentCuts;
        setCutWires(currentCuts);
        setTimerText("00.08");
        finishRound(currentCuts, "defused");
        return;
      }

      if (rem <= 0) {
        finishRound(roundRef.current.cutList, "timeout");
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  // Player taps a wire during the armed countdown to cut it (need 2 wires out of 5)
  const handleCutWire = async (wireId: WireId) => {
    if (gameState !== "armed" || !roundRef.current.active) return;
    if (roundRef.current.cutList.includes(wireId)) return;

    const nextCuts = [...roundRef.current.cutList, wireId];
    roundRef.current.cutList = nextCuts;
    setCutWires(nextCuts);

    let data = roundRef.current.serverData;
    if (!data && roundRef.current.serverPromise) {
      try {
        data = await roundRef.current.serverPromise;
      } catch {
        data = null;
      }
    }

    if (!data?.success) {
      roundRef.current.active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setGameState("idle");
      setTimerText("05.00");
      return;
    }

    const isWinningRound = Boolean(data.won && data.prize);

    if (nextCuts.length === 1) {
      // 1st wire cut: if safe, grant +3.0s bonus time!
      if (isWinningRound || roundRef.current.failOnStep === 2) {
        roundRef.current.bonusSeconds += BONUS_SECONDS;
        setBonusAdded(true);
        playSound("snip_ok");
        setSafeWires([wireId]);
      } else {
        finishRound(nextCuts, "wrong_wire");
      }
    } else if (nextCuts.length === 2) {
      if (isWinningRound) {
        finishRound(nextCuts, "defused");
      } else {
        finishRound(nextCuts, "wrong_wire");
      }
    }
  };

  if (loading) {
    return (
      <div className="h-dvh w-screen bg-[#050505] flex items-center justify-center overflow-hidden">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  const isDefusedWin = gameState === "result" && Boolean(result?.won);
  const isExplodedLoss = gameState === "result" && !result?.won;
  const safePairLabels = safeWires
    .map((id) => WIRES.find((w) => w.id === id)?.label)
    .filter(Boolean)
    .join(" + ");

  return (
    <div className="h-dvh w-screen bg-[#050505] text-white font-sans flex flex-col justify-between overflow-hidden select-none relative">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] transition-colors duration-700 ${
            isDefusedWin
              ? "bg-emerald-500/15"
              : isExplodedLoss
                ? "bg-red-600/20"
                : gameState === "armed"
                  ? "bg-amber-500/15"
                  : "bg-red-500/10"
          }`}
        />
      </div>

      {/* Top Game Header & Prizes Drawer */}
      <GameHeader
        ticketsCount={tickets}
        bonusBalance={bonusBalance}
        accentColor="text-red-500"
        showPrizes={showPrizes}
        onPrizesClick={() => setShowPrizes(true)}
      />

      <PrizesSidebar
        isOpen={showPrizes}
        onClose={() => setShowPrizes(false)}
        prizes={prizes}
      />

      {/* Centered Fixed Game Area */}
      <main className="flex-1 w-full max-w-[430px] mx-auto px-3 sm:px-4 pt-16 pb-24 flex flex-col justify-center gap-2.5 min-h-0 relative z-10">
        {/* Top Status / Result HUD Bar ABOVE the C4 Playing Field (Full width, never truncates) */}
        <div className="w-full min-h-[52px] flex items-center justify-center shrink-0">
          <AnimatePresence mode="wait">
            {gameState === "result" && result ? (
              <motion.div
                key="result-hud"
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className={`w-full rounded-2xl px-3.5 py-2.5 border backdrop-blur-xl flex items-center justify-between gap-2 shadow-xl ${
                  result.won
                    ? "bg-emerald-950/60 border-emerald-500/40"
                    : "bg-red-950/60 border-red-500/40"
                }`}
              >
                <div className="flex items-center gap-2 shrink-0">
                  {result.won ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span
                    className={`text-xs sm:text-sm font-black uppercase italic whitespace-nowrap ${
                      result.won ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {result.won
                      ? "ОБЕЗВРЕЖЕНО!"
                      : result.reason === "timeout"
                        ? "ВРЕМЯ ВЫШЛО!"
                        : "ДЕТОНАЦИЯ!"}
                  </span>
                </div>

                <div className="text-right text-[10px] sm:text-xs font-black uppercase tracking-wider">
                  {result.won ? (
                    <span className="text-emerald-300">
                      Награда: {result.prize?.name}
                    </span>
                  ) : (
                    <span className="text-gray-300">
                      Пара:{" "}
                      <b className="text-emerald-400">{safePairLabels}</b>
                    </span>
                  )}
                </div>
              </motion.div>
            ) : gameState === "armed" ? (
              <motion.div
                key="armed-hud"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`w-full rounded-2xl px-3.5 py-2.5 border backdrop-blur-md flex items-center justify-between gap-2 ${
                  bonusAdded
                    ? "bg-emerald-950/50 border-emerald-500/40"
                    : "bg-amber-950/40 border-amber-500/30"
                }`}
              >
                <span
                  className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${
                    bonusAdded ? "text-emerald-400" : "text-amber-300"
                  }`}
                >
                  {bonusAdded
                    ? "1-Й ПРОВОД УГАДАН! РЕЖЬ 2-Й"
                    : "ВЫБЕРИ И ПЕРЕРЕЖЬ 2 ПРОВОДА"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                    bonusAdded
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {bonusAdded ? `+${BONUS_SECONDS} СЕК ДОП. ВРЕМЯ` : `${cutWires.length} / 2`}
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="idle-hud"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full rounded-2xl px-3.5 py-2.5 bg-zinc-900/60 border border-white/10 flex items-center justify-between gap-2"
              >
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-300">
                  Угадай 2 провода из 5 до взрыва
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-400 whitespace-nowrap">
                  1-й провод = +{BONUS_SECONDS} сек
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* C4 Bomb Casing */}
        <motion.div
          animate={
            isExplodedLoss
              ? { x: [0, -10, 10, -8, 8, -4, 4, 0] }
              : { x: 0 }
          }
          transition={{ duration: 0.45 }}
          className="w-full"
        >
          <div
            className={`relative rounded-3xl bg-gradient-to-b from-zinc-800/95 via-zinc-900 to-black p-3.5 sm:p-4 border-2 transition-all duration-500 shadow-[0_20px_60px_rgba(0,0,0,0.85)] ${
              isDefusedWin
                ? "border-emerald-500/50 shadow-emerald-500/15"
                : isExplodedLoss
                  ? "border-red-500/60 shadow-red-500/25"
                  : gameState === "armed"
                    ? "border-amber-500/50 shadow-amber-500/15"
                    : "border-white/10"
            }`}
          >
            {/* Top Military Bar + Mute Button + Status LED */}
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-md bg-black/60 border border-white/10 font-mono text-[10px] font-black tracking-widest text-gray-400">
                  C4 // 7355608
                </div>
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title={isMuted ? "Включить звук" : "Выключить звук"}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-red-400" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    isDefusedWin
                      ? "text-emerald-400"
                      : isExplodedLoss
                        ? "text-red-500"
                        : gameState === "armed"
                          ? "text-amber-400"
                          : "text-gray-400"
                  }`}
                >
                  {isDefusedWin
                    ? "DEFUSED"
                    : isExplodedLoss
                      ? "DETONATED"
                      : gameState === "armed"
                        ? `ПРОВОДА: ${cutWires.length} / 2`
                        : "STANDBY"}
                </span>
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    isDefusedWin
                      ? "bg-emerald-400 shadow-[0_0_12px_#10b981]"
                      : isExplodedLoss
                        ? "bg-red-600 shadow-[0_0_16px_#dc2626]"
                        : gameState === "armed"
                          ? "bg-amber-400 animate-ping"
                          : "bg-red-500/60"
                  }`}
                />
              </div>
            </div>

            {/* Digital Countdown Display (Clean & Uncluttered) */}
            <div className="relative bg-[#070907] rounded-2xl px-3.5 py-2 sm:py-2.5 mb-2.5 border border-white/10 shadow-inner flex items-center justify-between">
              <div>
                <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.22em] text-gray-500">
                  ТАЙМЕР ДЕТОНАЦИИ
                </div>
                <div
                  className={`font-mono tabular-nums text-3xl sm:text-4xl font-black tracking-wider leading-tight transition-colors ${
                    isDefusedWin
                      ? "text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                      : isExplodedLoss
                        ? "text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                        : gameState === "armed"
                          ? "text-amber-400"
                          : "text-red-500/80"
                  }`}
                >
                  00:{timerText}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                {bonusAdded && (
                  <motion.span
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-black uppercase tracking-wider"
                  >
                    +{BONUS_SECONDS}.00s БОНУС
                  </motion.span>
                )}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-gray-300">
                  <Scissors className="w-3 h-3 text-red-400" />
                  <span>{cutWires.length} / 2 ПРОВОДОВ</span>
                </div>
              </div>
            </div>

            {/* 5 Interactive Wires Bay */}
            <div className="bg-black/60 rounded-2xl p-2.5 sm:p-3.5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">
                <span>Силовой контур C4</span>
                <span>
                  {gameState === "armed"
                    ? `Обезврежено: ${cutWires.length} из 2`
                    : "Нужно перерезать 2 провода"}
                </span>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                {WIRES.map((wire) => {
                  const isCut = cutWires.includes(wire.id);
                  const isSafeWire = safeWires.includes(wire.id);
                  const isBoomWire = explodedWire === wire.id;

                  return (
                    <button
                      key={wire.id}
                      type="button"
                      disabled={gameState !== "armed" || isCut}
                      onClick={() => handleCutWire(wire.id)}
                      className={`w-full group relative rounded-xl px-2.5 py-2 sm:py-2.5 border transition-all text-left flex flex-col gap-1.5 ${
                        isBoomWire
                          ? "bg-red-500/20 border-red-500/70"
                          : isSafeWire
                            ? "bg-emerald-500/15 border-emerald-500/60 shadow-[0_0_16px_rgba(16,185,129,0.2)]"
                            : gameState === "armed"
                              ? "bg-white/[0.05] border-white/20 hover:bg-white/15 hover:border-amber-400/60 cursor-pointer active:scale-[0.99]"
                              : "bg-white/[0.03] border-white/10 opacity-75"
                      }`}
                    >
                      {/* Top mini row: Wire label + Status badge */}
                      <div className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${wire.dot}`}
                          />
                          <span className="font-mono text-[9px] font-black text-gray-400">
                            W-{wire.code}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-white">
                            {wire.label}
                          </span>
                        </div>

                        <div>
                          {isBoomWire ? (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/25 border border-red-500/50 text-red-300 text-[8px] font-black uppercase tracking-wider">
                              ВЗРЫВ
                            </span>
                          ) : isSafeWire && isCut ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 text-[8px] font-black uppercase tracking-wider">
                              ЧИСТ ✓
                            </span>
                          ) : isSafeWire && gameState === "result" ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[8px] font-black uppercase tracking-wider">
                              НУЖНЫЙ
                            </span>
                          ) : gameState === "armed" ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[8px] font-black uppercase tracking-wider">
                              <Scissors className="w-2.5 h-2.5" />
                              РЕЗАТЬ
                            </span>
                          ) : (
                            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">
                              КОНТУР
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Full-width Wire Cable */}
                      <div className="w-full relative h-3.5 flex items-center">
                        <div className="w-2.5 h-3.5 rounded-sm bg-zinc-500 border border-zinc-300/40 shrink-0 z-10" />

                        {!isCut ? (
                          <div
                            className={`flex-1 h-2.5 rounded-full bg-gradient-to-r ${wire.gradient} transition-all relative`}
                            style={{
                              boxShadow:
                                gameState === "armed"
                                  ? `0 0 12px ${wire.glow}`
                                  : `0 0 5px ${wire.glow}`,
                            }}
                          >
                            <div className="absolute inset-x-2 top-0.5 h-0.5 rounded-full bg-white/35" />
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-between px-1 relative">
                            <div
                              className={`w-[44%] h-2.5 rounded-l-full bg-gradient-to-r ${wire.gradient} -rotate-3 origin-left`}
                            />
                            <div className="flex items-center justify-center">
                              {isBoomWire ? (
                                <Zap className="w-3.5 h-3.5 text-red-400 animate-ping" />
                              ) : (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                            </div>
                            <div
                              className={`w-[44%] h-2.5 rounded-r-full bg-gradient-to-r ${wire.gradient} rotate-3 origin-right`}
                            />
                          </div>
                        )}

                        <div className="w-2.5 h-3.5 rounded-sm bg-zinc-500 border border-zinc-300/40 shrink-0 z-10" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Sticky Bottom Action Button — Same style as the other promo games */}
      <div className="w-full fixed bottom-0 left-0 right-0 p-4 sm:p-5 bg-linear-to-t from-black via-black/80 to-transparent z-50 flex justify-center">
        <div className="w-full max-w-sm">
          <button
            type="button"
            onClick={startRound}
            disabled={gameState === "armed" || tickets < ticketCost}
            className={`w-full py-4 sm:py-5 rounded-[1.8rem] font-black text-lg sm:text-xl uppercase tracking-tighter transition-all active:scale-95 relative overflow-hidden cursor-pointer ${
              gameState === "armed" || tickets < ticketCost
                ? "bg-gray-800 text-gray-400 cursor-not-allowed opacity-70"
                : "bg-white text-black shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:shadow-none"
            }`}
          >
            {gameState === "armed" ? (
              <span className="flex items-center justify-center gap-3 text-amber-400 text-sm sm:text-base tracking-wider">
                <Scissors className="w-5 h-5 animate-bounce" />
                ПЕРЕРЕЖЬ ЕЩЁ {2 - cutWires.length}{" "}
                {2 - cutWires.length === 1 ? "ПРОВОД" : "ПРОВОДА"}!
              </span>
            ) : tickets < ticketCost ? (
              "НЕТ БИЛЕТОВ"
            ) : (
              <div className="flex flex-col items-center">
                <span>{gameState === "result" ? "ИГРАТЬ ЕЩЁ" : "ИГРАТЬ"}</span>
                <span className="text-[10px] font-bold opacity-40 -mt-0.5 tracking-widest uppercase">
                  {ticketCost}{" "}
                  {ticketCost === 1
                    ? "Билет"
                    : ticketCost < 5
                      ? "Билета"
                      : "Билетов"}{" "}
                  за игру
                </span>
              </div>
            )}
            {gameState !== "armed" && tickets >= ticketCost && (
              <motion.div
                animate={{ x: ["-100%", "250%"] }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="absolute inset-0 bg-linear-to-r from-transparent via-white/50 to-transparent -skew-x-20 pointer-events-none"
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
