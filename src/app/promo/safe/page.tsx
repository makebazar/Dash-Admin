"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GameHeader } from "../components/GameHeader";
import { PrizesSidebar } from "../components/PrizesSidebar";

/**
 * КОНЦЕПЦИЯ "DEEP DIVE" (Глубокое погружение)
 * При вводе кода камера "приближается" к замку, мы видим цифровую верификацию,
 * а при успехе механизм "раскрывается" из центра, открывая приз.
 */

const GENERATE_CODES = () => {
  const codes = [];
  for (let i = 0; i < 6; i++) {
    codes.push(Math.floor(1000 + Math.random() * 9000).toString());
  }
  return codes;
};

type GameStatus = "idle" | "entering" | "verifying" | "success" | "fail";

export default function DeepDiveSafeDemo() {
  const [codes, setCodes] = useState<string[]>([]);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [ticketsCount, setTicketsCount] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [player, setPlayer] = useState<any>(null);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [showPrizes, setShowPrizes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wonPrize, setWonPrize] = useState<any>(null);

  // Для эффекта перебора цифр
  const [decryptionText, setDecryptionText] = useState("0000");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [fakeCorrectCode, setFakeCorrectCode] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const showError = (msg: string) => {
    playBeep(200, "sawtooth", 0.4);
    setErrorMsg(msg);
    setStatus("fail");
    setDecryptionText("ОТКАЗ");
    setTimeout(() => {
      setErrorMsg(null);
      resetGame();
    }, 3000);
  };

  useEffect(() => {
    fetchGameData();
  }, []);

  const fetchGameData = async () => {
    try {
      setLoading(true);
      const [playerRes, prizesRes] = await Promise.all([
        fetch("/api/promo/player"),
        fetch("/api/promo/prizes?gameType=safe&all=true"),
      ]);

      const playerData = await playerRes.json();
      if (playerData.success || playerData.tickets !== undefined) {
        setPlayer(playerData.player);
        setTicketsCount(playerData.tickets);
        setBonusBalance(playerData.player?.bonusBalance || 0);
      }

      const prizesData = await prizesRes.json();
      if (prizesData.success) {
        setPrizes(prizesData.prizes || []);
      }

      resetGame();
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetGame = () => {
    setCodes(GENERATE_CODES());
    setStatus("idle");
    setSelectedCode(null);
    setWonPrize(null);
    setDecryptionText("0000");
    setFakeCorrectCode(null);
  };

  const playBeep = (
    freq: number,
    type: OscillatorType = "square",
    duration: number = 0.1,
  ) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const handleCodeClick = async (code: string) => {
    if (status !== "idle") return;
    if (ticketsCount <= 0) {
      showError("НЕТ БИЛЕТОВ");
      return;
    }

    setSelectedCode(code);
    setStatus("entering");

    try {
      // 1. API Call Start
      const playPromise = fetch("/api/promo/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "safe",
          selectedCode: code,
          availableCodes: codes,
        }),
      });

      // 2. Zoom in effect and fast changing numbers (Decryption phase)
      playBeep(400, "sawtooth", 0.1);
      await new Promise((r) => setTimeout(r, 400));
      setStatus("verifying");

      let intervalCounter = 0;
      const decryptInterval = setInterval(() => {
        setDecryptionText(Math.floor(1000 + Math.random() * 9000).toString());
        if (intervalCounter % 2 === 0)
          playBeep(800 + Math.random() * 200, "sine", 0.05);
        intervalCounter++;
      }, 50);

      // Wait for API
      const res = await playPromise;
      const data = await res.json();

      clearInterval(decryptInterval);

      if (!data.success) {
        showError(data.error || "Ошибка сервера");
        return;
      }

      setTicketsCount((prev) => prev - 1);

      // 3. Lock in the selected code on the display
      setDecryptionText(code);
      playBeep(1200, "square", 0.2);
      await new Promise((r) => setTimeout(r, 800));

      // 4. Result evaluation
      const isActualWin = data.won && data.prize;
      const isEmptyPrize =
        isActualWin &&
        (data.prize.type === "none" ||
          data.prize.name.toLowerCase() === "пусто" ||
          data.prize.name.toLowerCase() === "попробуй еще" ||
          parseFloat(data.prize.value) === 0);

      if (data.isCodeCorrect) {
        if (isActualWin && !isEmptyPrize) {
          setWonPrize(data.prize);

          // Update counters instantly for the animation
          if (data.prize.type === "virtual" || data.prize.type === "bonus_limitless") {
            setBonusBalance((prev) => prev + parseFloat(data.prize.value));
          } else if (data.prize.type === "attempt") {
            setTicketsCount(
              (prev) => prev + Math.floor(parseFloat(data.prize.value) || 1),
            );
          }
        } else {
          // Correct code but NO PRIZE or EMPTY PRIZE
          setWonPrize({ name: "Пусто", type: "none", value: 0 });
        }

        // Handle Quest Rewards
        if (data.questRewards && data.questRewards.length > 0) {
          data.questRewards.forEach((q: any) => {
            if (q.rewardBonusBalance > 0) {
              setBonusBalance(
                (prev) => prev + parseFloat(q.rewardBonusBalance),
              );
            }
            if (q.rewardTickets > 0) {
              setTicketsCount((prev) => prev + parseInt(q.rewardTickets));
            }
          });
        }

        setStatus("success");
        playBeep(300, "square", 0.1);
        setTimeout(() => playBeep(400, "square", 0.1), 100);
        setTimeout(() => playBeep(800, "sine", 0.8), 200);
      } else {
        const winningCodeFromServer = data.winningCode || code;

        setStatus("fail");
        playBeep(200, "sawtooth", 0.6);

        // Show their wrong code for a moment, then flash the correct one
        setTimeout(() => {
          setFakeCorrectCode(winningCodeFromServer);
          setDecryptionText(winningCodeFromServer);
          playBeep(600, "sine", 0.1);
          setTimeout(() => playBeep(800, "sine", 0.2), 150);
        }, 1000);

        setTimeout(() => resetGame(), 3500);
      }
    } catch (err) {
      console.error("Game error:", err);
      showError("Ошибка сети");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] bg-linear-to-b from-[#0f172a] to-[#020617] flex flex-col items-center justify-center font-mono overflow-hidden relative text-white perspective-distant">
      <GameHeader
        ticketsCount={ticketsCount}
        bonusBalance={bonusBalance}
        accentColor="text-green-500"
        showPrizes={showPrizes}
        onPrizesClick={() => setShowPrizes(true)}
      />

      <PrizesSidebar
        isOpen={showPrizes}
        onClose={() => setShowPrizes(false)}
        prizes={prizes}
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

      <div className="flex-1 w-full flex items-center justify-center mt-12">
        {/* Main Container for the "Zoom" effect */}
        <motion.div
          animate={{
            scale: status === "idle" ? 1 : status === "success" ? 1.1 : 1.2,
            y: status === "idle" ? 0 : status === "success" ? 20 : -40,
          }}
          transition={{
            duration: status === "success" ? 1.5 : 0.8,
            ease: "easeInOut",
          }}
          className="relative flex items-center justify-center w-80 h-80 sm:w-90 sm:h-90"
        >
          {/* === БОЛЬШОЕ ВНЕШНЕЕ КОЛЬЦО (Механизм) === */}
          <motion.div
            animate={{
              rotate:
                status === "verifying" ? 180 : status === "success" ? -90 : 0,
            }}
            transition={{
              duration: status === "verifying" ? 2 : 2,
              ease: "easeInOut",
            }}
            className="absolute inset-0 rounded-full border-15 border-[#1e293b] shadow-[0_0_40px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,0,0,0.9)]"
          >
            {/* Декоративные зубцы шестеренки */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute inset-0"
                  style={{ transform: `rotate(${i * 30}deg)` }}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-8 bg-linear-to-b from-[#334155] to-[#1e293b] border border-[#475569] shadow-lg rounded-t-sm" />
                </div>
              ))}
            </div>

            {/* Внутренний акцентный ободок */}
            <div className="absolute inset-0 rounded-full border border-green-500/20 m-0.5 pointer-events-none" />
          </motion.div>
          {/* === ВНУТРЕННЕЕ КОЛЬЦО === */}
          <motion.div
            animate={{ rotate: status === "verifying" ? -360 : 0 }}
            transition={{
              duration: 2,
              ease: "linear",
              repeat: status === "verifying" ? Infinity : 0,
            }}
            className="absolute w-60 h-60 sm:w-70 sm:h-70 rounded-full border-2 border-dashed border-[#475569] opacity-60"
          />
          <div className="absolute w-55 h-55 sm:w-65 sm:h-65 rounded-full border border-green-500/10" />

          {/* === ЦЕНТРАЛЬНЫЙ МОДУЛЬ (Замок / Экран) === */}
          <AnimatePresence mode="wait">
            {status !== "success" ? (
              <motion.div
                key="lock-module"
                exit={{ scale: 0, opacity: 0, rotate: 180 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="absolute z-20 flex flex-col items-center"
              >
                {/* ЭКРАН ВЕРИФИКАЦИИ */}
                <div className="w-60 h-16 bg-[#020617] border-2 border-green-500/40 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden shadow-[0_0_30px_rgba(74,222,128,0.1),inset_0_0_20px_black]">
                  <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.6)_51%)] bg-size-[100%_4px] opacity-30 pointer-events-none z-10" />
                  <div className="absolute top-0 w-full h-1 bg-green-500/40 blur-[2px] animate-[scan_2s_linear_infinite]" />

                  <span
                    className={`text-2xl tracking-[0.3em] font-black z-0 ${status === "fail" ? (decryptionText !== fakeCorrectCode ? "text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" : "text-green-500 drop-shadow-[0_0_15px_rgba(74,222,128,0.8)]") : "text-green-500 drop-shadow-[0_0_15px_rgba(74,222,128,0.8)]"}`}
                  >
                    {status === "idle" || status === "entering"
                      ? "ГОТОВ"
                      : decryptionText}
                  </span>
                </div>

                {/* КНОПКИ ВВОДА КОДА */}
                <div className="grid grid-cols-3 gap-2 w-60 z-50">
                  {codes.map((code) => (
                    <button
                      key={code}
                      disabled={status !== "idle"}
                      onClick={() => handleCodeClick(code)}
                      className={`
                        py-2 rounded-lg bg-[#0f172a] border border-[#334155] text-gray-300 font-bold tracking-widest text-xs transition-all shadow-md
                        ${status === "idle" ? "hover:bg-[#1e293b] hover:text-green-400 hover:border-green-500/60 hover:shadow-[0_0_15px_rgba(74,222,128,0.2)] active:scale-95" : "opacity-60"}
                        ${selectedCode === code ? "bg-[#1e293b] text-yellow-400 border-yellow-500/60 scale-105 opacity-100 shadow-[0_0_20px_rgba(234,179,8,0.3)] z-10" : ""}
                        ${status === "fail" && selectedCode === code ? "text-red-400 border-red-500 bg-red-900/30 shadow-[0_0_20px_rgba(239,68,68,0.4)]" : ""}
                        ${status === "fail" && fakeCorrectCode === code ? "text-green-400 border-green-500 bg-green-900/30 shadow-[0_0_20px_rgba(74,222,128,0.4)] scale-105 opacity-100" : ""}
                      `}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              /* === РАСКРЫТИЕ ПРИЗА (SUCCESS) === */
              <motion.div
                key="prize-module"
                initial={{ scale: 0, opacity: 0, filter: "brightness(2)" }}
                animate={{ scale: 1, opacity: 1, filter: "brightness(1)" }}
                transition={{
                  delay: 0.5,
                  duration: 1,
                  type: "spring",
                  bounce: 0.4,
                }}
                className="absolute z-30 flex flex-col items-center justify-center w-75 h-75"
              >
                {/* Свечение сзади */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(74,222,128,0.4)_0%,transparent_60%)] pointer-events-none"
                />

                <motion.div
                  animate={{ y: [-10, 10, -10] }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="text-[80px] mb-4 filter drop-shadow-[0_0_30px_rgba(74,222,128,1)]"
                >
                  {wonPrize?.type === "attempt"
                    ? "🎟️"
                    : wonPrize?.type === "virtual" || wonPrize?.type === "bonus_limitless"
                      ? "💎"
                      : wonPrize?.type === "bonus"
                        ? "⚡"
                        : "🎁"}
                </motion.div>

                <div className="text-[10px] font-bold text-green-400 tracking-[0.5em] mb-2 uppercase opacity-90 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]">
                  Доступ Разрешен
                </div>
                <div className="text-2xl font-black text-white uppercase tracking-widest text-center px-6 py-3 bg-black/60 rounded-xl border-2 border-green-500/50 backdrop-blur-md shadow-[0_0_30px_rgba(74,222,128,0.2)]">
                  {wonPrize?.name}
                </div>

                {wonPrize?.value > 0 && (
                  <div className="mt-4 px-4 py-1.5 bg-green-500/20 rounded-full border border-green-500/60 text-green-400 font-bold tracking-widest text-lg shadow-[0_0_20px_rgba(74,222,128,0.2)]">
                    +{wonPrize.value}{" "}
                    {wonPrize.type === "bonus"
                      ? "XP"
                      : wonPrize.type === "virtual" || wonPrize.type === "bonus_limitless"
                        ? "₽"
                        : "шт"}
                  </div>
                )}

                <button
                  onClick={resetGame}
                  className="mt-8 px-6 py-2.5 bg-[#0f172a]/80 backdrop-blur-sm border border-[#334155] text-gray-300 hover:text-white hover:border-green-500/50 hover:shadow-[0_0_15px_rgba(74,222,128,0.2)] rounded-full text-xs font-bold tracking-widest uppercase transition-all active:scale-95"
                >
                  Сброс системы
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes scan {
          0% { top: -10%; }
          100% { top: 110%; }
        }
      `,
        }}
      />
    </div>
  );
}
