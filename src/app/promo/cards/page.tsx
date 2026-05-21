"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  History,
  ChevronLeft,
  CreditCard as CardIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { GameHeader } from "../components/GameHeader";
import { PrizesSidebar } from "../components/PrizesSidebar";

/**
 * ИГРА "ТРИ КАРТЫ" (LUCKY CARDS) - БОЕВАЯ ВЕРСИЯ
 */

type CardStatus = "back" | "front" | "hidden";

interface Card {
  id: number;
  prizeId: number | string;
  value: string;
  type: "win" | "lose" | "bonus";
  label: string;
  color: string;
}

const playSound = (type: "shuffle" | "flip" | "win" | "lose" | "gather") => {
  try {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === "flip") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === "shuffle") {
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      noise.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } else if (type === "gather") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === "win") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } else if (type === "lose") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {}
};

export default function LuckyCardsGame() {
  const router = useRouter();
  const [tickets, setTickets] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [player, setPlayer] = useState<any>(null);
  const [rawPrizes, setRawPrizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrizes, setShowPrizes] = useState(false);
  const [gameSettings, setGameSettings] = useState<any>(null);

  // Game states
  const [gameState, setGameState] = useState<
    "idle" | "revealing" | "gathering" | "shuffling" | "playing" | "result"
  >("idle");

  const [cards, setCards] = useState<Card[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [gameMessage, setGameMessage] = useState<{
    text: string;
    sub?: string;
    color: string;
  } | null>(null);

  // Stores the result from the server
  const [serverResult, setServerResult] = useState<any>(null);

  // Helper to map DB prize to visual Card
  const mapPrizeToCard = useCallback((prize: any, index: number): Card => {
    const nameLower = prize?.name?.toLowerCase() || "";
    const isLose =
      nameLower.includes("пусто") ||
      nameLower.includes("ничего") ||
      prize?.value == 0;
    const isBonus = prize?.type === "attempt" || nameLower.includes("билет");

    return {
      id: index + 1,
      prizeId: prize?.id || `fallback-${index}`,
      value: isLose ? "❌" : isBonus ? "🎟" : "🎁",
      label: prize?.name || "Приз",
      type: isLose ? "lose" : isBonus ? "bonus" : "win",
      color: isLose
        ? "from-gray-600 to-gray-800"
        : isBonus
          ? "from-blue-500 to-indigo-600"
          : "from-orange-500 to-red-600",
    };
  }, []);

  const generateDefaultCards = useCallback((count: number): Card[] => {
    const newCards: Card[] = [];
    for (let i = 0; i < count; i++) {
      if (i === 0) {
        newCards.push({
          id: 1,
          prizeId: 1,
          value: "🎁",
          type: "win",
          label: "Приз",
          color: "from-orange-500 to-red-600",
        });
      } else if (i === 1 && count >= 4) {
        newCards.push({
          id: 2,
          prizeId: 2,
          value: "🎟",
          type: "bonus",
          label: "+1 Билет",
          color: "from-blue-500 to-indigo-600",
        });
      } else {
        newCards.push({
          id: i + 1,
          prizeId: i + 1,
          value: "❌",
          type: "lose",
          label: "Пусто",
          color: "from-gray-600 to-gray-800",
        });
      }
    }
    return newCards;
  }, []);

  const getLevelCards = useCallback((prizesList: any[], level: number): Card[] => {
    // Filter for current level
    const levelPrizes = prizesList.filter(
      (p: any) => (p.target_level || 1) === level,
    );

    // Map and limit to 5
    let mapped = levelPrizes.map((p: any, i: number) =>
      mapPrizeToCard(p, i),
    );

    if (mapped.length > 5) {
      mapped = mapped.slice(0, 5);
    }

    // Ensure at least 3 cards for a good look
    if (mapped.length < 3) {
      const needed = 3 - mapped.length;
      for (let i = 0; i < needed; i++) {
        mapped.push({
          id: mapped.length + 1,
          prizeId: `empty-${i}`,
          value: "❌",
          type: "lose",
          label: "Пусто",
          color: "from-gray-600 to-gray-800",
        });
      }
    }
    return mapped;
  }, [mapPrizeToCard]);

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const playerRes = await fetch("/api/promo/player");
        const playerData = await playerRes.json();
        if (playerData.success || playerData.tickets !== undefined) {
          setPlayer(playerData.player);
          setTickets(playerData.tickets);
          setBonusBalance(playerData.player?.bonusBalance || 0);
          setGameSettings(playerData.player?.settings || {});
        }

        const prizesRes = await fetch(
          "/api/promo/prizes?gameType=cards&all=true",
        );
        const prizesData = await prizesRes.json();

        if (prizesData.success && prizesData.prizes?.length > 0) {
          const allPrizes = prizesData.prizes;
          setRawPrizes(allPrizes);

          // Get player level
          const currentLevel = playerData.player?.level?.currentLevel || 1;

          // Map and filter prizes for level using helper
          const mapped = getLevelCards(allPrizes, currentLevel);

          setCards(mapped);
        } else {
          setCards(generateDefaultCards(3));
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setCards(generateDefaultCards(3));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [generateDefaultCards, getLevelCards]);

  const currentLevel = player?.level?.currentLevel || 1;
  const levelPrizesCount = rawPrizes.filter(
    (p: any) => (p.target_level || 1) === currentLevel,
  ).length;
  const cardCount = Math.min(5, Math.max(3, levelPrizesCount));

  const startGameSequence = async () => {
    if (gameState !== "idle" && gameState !== "result") return;
    if (tickets <= 0) return;

    setGameMessage(null);
    setSelectedId(null);
    setServerResult(null);

    // Call server immediately to get result
    try {
      const res = await fetch("/api/promo/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "cards" }),
      });
      const data = await res.json();

      if (!data.success) {
        setGameMessage({
          text: "ОШИБКА",
          sub: data.error || "Сбой сети",
          color: "text-red-500",
        });
        return;
      }

      setServerResult(data);
      setTickets((prev) => prev - 1);

      // Setup initial face-up cards based on raw prizes filtered by level
      const currentLevel = player?.level?.currentLevel || 1;
      let initialCards =
        rawPrizes.length > 0
          ? getLevelCards(rawPrizes, currentLevel)
          : generateDefaultCards(cardCount);

      setCards(initialCards);

      // 2. Reveal State - Flip them face UP to show prizes
      setGameState("revealing");
      playSound("flip");

      // Wait for user to look at them
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 3. Gathering State - Flip face down and move to a single stack in the center
      setGameState("gathering");
      playSound("gather");
      await new Promise((resolve) => setTimeout(resolve, 600)); // wait for them to gather

      // 4. Shuffling State - Vibrate in the center to simulate shuffling
      setGameState("shuffling");

      let shuffleInterval = setInterval(() => playSound("shuffle"), 150);

      // Actually randomize the array visually while they are in the center
      const shuffled = [...initialCards].sort(() => Math.random() - 0.5);
      setCards(shuffled);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      clearInterval(shuffleInterval);

      // 5. Playing State - Deal them back out
      setGameState("playing");
      playSound("flip"); // Sound for dealing out
    } catch (err) {
      console.error("Play error:", err);
      setGameMessage({
        text: "ОШИБКА",
        sub: "Нет связи с сервером",
        color: "text-red-500",
      });
    }
  };

  const handleCardClick = (id: number) => {
    if (gameState !== "playing" || selectedId !== null || !serverResult) return;

    playSound("flip");
    setSelectedId(id);

    // At this moment, we manipulate the `cards` array so that the clicked card (id)
    // receives the `serverResult.prize` (if any), and the other cards receive the remaining prizes.

    let wonPrize = serverResult.prize;
    
    // Filter level prizes for correct fallback and remaining prize distribution
    const currentLevel = player?.level?.currentLevel || 1;
    const levelPrizes = rawPrizes.filter(
      (p: any) => (p.target_level || 1) === currentLevel,
    );

    // If somehow the server didn't return a prize (e.g. lost and no generic 'lose' prize returned),
    // we fallback to the first 'lose' prize or generic empty
    if (!wonPrize) {
      wonPrize =
        levelPrizes.find((p) => p.name.toLowerCase().includes("пусто")) ||
        levelPrizes[0];
    }

    const wonCard = wonPrize
      ? mapPrizeToCard(wonPrize, 0)
      : generateDefaultCards(1)[0];
    wonCard.id = id; // Give it the ID of the clicked card so Framer Motion maps it correctly

    // Get up to 5 active prizes for level, filter out the won prize
    let activePrizes = levelPrizes;
    if (activePrizes.length > 5) {
      activePrizes = activePrizes.slice(0, 5);
    }
    const remainingPrizes = activePrizes.filter((p) => p.id !== wonPrize?.id);
    const newCardsState = cards.map((c) => {
      if (c.id === id) {
        return wonCard;
      } else {
        const nextPrize = remainingPrizes.pop();
        if (nextPrize) {
          const mapped = mapPrizeToCard(nextPrize, c.id);
          mapped.id = c.id;
          return mapped;
        } else {
          // If we run out of level prizes, fill with a "lose" (empty) card
          return {
            id: c.id,
            prizeId: `empty-reveal-${c.id}`,
            value: "❌",
            type: "lose" as const,
            label: "Пусто",
            color: "from-gray-600 to-gray-800",
          };
        }
      }
    });

    setCards(newCardsState);

    setTimeout(() => {
      setGameState("result");

      setHistory((prev) => [wonCard.label, ...prev].slice(0, 10));

      const isActualWin = serverResult.won && serverResult.prize;
      const isEmptyPrize =
        isActualWin &&
        (serverResult.prize.type === "none" ||
          serverResult.prize.name.toLowerCase() === "пусто" ||
          serverResult.prize.name.toLowerCase() === "попробуй еще" ||
          parseFloat(serverResult.prize.value) === 0);

      if (isActualWin && !isEmptyPrize) {
        playSound("win");
        if (serverResult.prize.type === "attempt") {
          setTickets(
            (prev) =>
              prev + Math.floor(parseFloat(serverResult.prize.value) || 1),
          );
          setGameMessage({
            text: "БОНУС!",
            sub: "Билет зачислен",
            color: "text-blue-400",
          });
        } else {
          setGameMessage({
            text: "ВЫИГРЫШ!",
            sub: serverResult.prize.name,
            color: "text-orange-500",
          });
        }
      } else {
        playSound("lose");
        setGameMessage({
          text: "УВЫ, ПУСТО",
          sub: "Попробуйте еще раз",
          color: "text-gray-500",
        });
      }

      if (
        isActualWin &&
        !isEmptyPrize &&
        serverResult.prize.type === "virtual"
      ) {
        setBonusBalance((prev) => prev + parseFloat(serverResult.prize.value));
      }

      // Handle Quest Rewards
      if (serverResult.questRewards && serverResult.questRewards.length > 0) {
        serverResult.questRewards.forEach((q: any) => {
          if (q.rewardBonusBalance > 0) {
            setBonusBalance((prev) => prev + parseFloat(q.rewardBonusBalance));
          }
          if (q.rewardTickets > 0) {
            setTickets((prev) => prev + parseInt(q.rewardTickets));
          }
        });
      }
    }, 600);
  };

  const resetBoard = () => {
    setGameState("idle");
    setSelectedId(null);
    setGameMessage(null);
    setServerResult(null);
    const currentLevel = player?.level?.currentLevel || 1;
    setCards(
      rawPrizes.length > 0
        ? getLevelCards(rawPrizes, currentLevel)
        : generateDefaultCards(cardCount),
    );
  };

  const isActionDisabled =
    loading ||
    gameState === "revealing" ||
    gameState === "gathering" ||
    gameState === "shuffling" ||
    (gameState === "playing" && selectedId === null) ||
    (gameState === "idle" && tickets <= 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center overflow-hidden relative font-sans select-none">
      <div className="absolute inset-0 bg-linear-to-b from-purple-900/10 via-transparent to-transparent pointer-events-none" />

      {/* Top Bar - Compact & Intrusive-free */}
      <GameHeader
        ticketsCount={tickets}
        bonusBalance={bonusBalance}
        showPrizes={showPrizes}
        onPrizesClick={() => setShowPrizes(true)}
        accentColor="text-purple-500"
      />

      <PrizesSidebar
        isOpen={showPrizes}
        onClose={() => setShowPrizes(false)}
        prizes={rawPrizes}
        playerLevel={player?.level?.currentLevel}
      />

      <main className="flex-1 w-full flex flex-col items-center justify-center p-4 pt-24 pb-36 min-h-0">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-500 to-orange-500 tracking-tighter uppercase italic leading-none drop-shadow-[0_0_15px_rgba(236,72,153,0.3)]">
            Карты
          </h1>
          <p className="text-gray-400 text-[10px] uppercase tracking-[0.4em] font-bold mt-3">
            Испытай свою удачу
          </p>
        </motion.div>

        {/* Cards Container */}
        <div
          className="relative w-full max-w-4xl h-87.5 sm:h-100 flex justify-center items-center"
          style={{ perspective: "1200px" }}
        >
          <AnimatePresence>
            {cards.map((card, index) => {
              const isSelected = selectedId === card.id;

              const showFront =
                gameState === "revealing" ||
                isSelected ||
                gameState === "result";

              const cardWidth =
                cardCount === 5 ? 80 : cardCount === 4 ? 96 : 112;
              const gap = 16;

              let xPos = 0;
              let yPos = 0;
              let zIndex = index;

              if (
                gameState === "idle" ||
                gameState === "revealing" ||
                gameState === "playing" ||
                gameState === "result"
              ) {
                // Layout logic based on cardCount
                if (cardCount === 5) {
                  // 3 on top, 2 on bottom
                  if (index < 3) {
                    // Top row (3 cards)
                    const totalWidthTop = 3 * cardWidth + 2 * gap;
                    const startXTop = -totalWidthTop / 2 + cardWidth / 2;
                    xPos = startXTop + index * (cardWidth + gap);
                    yPos = -60 + (isSelected ? -20 : 0);
                  } else {
                    // Bottom row (2 cards)
                    const totalWidthBottom = 2 * cardWidth + 1 * gap;
                    const startXBottom = -totalWidthBottom / 2 + cardWidth / 2;
                    xPos = startXBottom + (index - 3) * (cardWidth + gap);
                    yPos = 80 + (isSelected ? -20 : 0);
                  }
                } else if (cardCount === 4) {
                  // 2 on top, 2 on bottom
                  const row = Math.floor(index / 2);
                  const col = index % 2;
                  const totalWidthRow = 2 * cardWidth + 1 * gap;
                  const startXRow = -totalWidthRow / 2 + cardWidth / 2;
                  xPos = startXRow + col * (cardWidth + gap);
                  yPos =
                    row === 0
                      ? -60 + (isSelected ? -20 : 0)
                      : 80 + (isSelected ? -20 : 0);
                } else {
                  // Default 3 cards in a single row
                  const totalWidth =
                    cardCount * cardWidth + (cardCount - 1) * gap;
                  const startX = -totalWidth / 2 + cardWidth / 2;
                  xPos = startX + index * (cardWidth + gap);
                  yPos = isSelected ? -20 : 0;
                }
              } else if (
                gameState === "gathering" ||
                gameState === "shuffling"
              ) {
                xPos = 0;
                yPos = 0;
                if (gameState === "shuffling") {
                  xPos += Math.random() * 6 - 3;
                  yPos += Math.random() * 6 - 3;
                }
              }

              const backStyle =
                gameSettings?.game_configs?.cards?.card_back_style || "default";

              return (
                <motion.div
                  key={card.id}
                  layoutId={`card-${card.id}`}
                  initial={{ opacity: 0, scale: 0.5, y: 50, x: xPos }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: xPos,
                    y: yPos,
                    rotateY: showFront ? 180 : 0,
                    rotateZ:
                      gameState === "shuffling" ? Math.random() * 4 - 2 : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: gameState === "shuffling" ? 300 : 200,
                    damping: gameState === "shuffling" ? 10 : 20,
                    delay:
                      gameState === "playing" || gameState === "revealing"
                        ? index * 0.1
                        : 0,
                  }}
                  style={{
                    position: "absolute",
                    zIndex: zIndex,
                    transformStyle: "preserve-3d",
                  }}
                  onClick={() => handleCardClick(card.id)}
                  className={`${cardCount === 5 ? "w-20 sm:w-28" : cardCount === 4 ? "w-24 sm:w-32" : "w-28 sm:w-40"} aspect-2/3 cursor-pointer group`}
                >
                  {/* Card Back Face */}
                  <div
                    className={`absolute inset-0 rounded-2xl border-[3px] shadow-2xl flex items-center justify-center backface-hidden overflow-hidden ${gameState !== "playing" ? "opacity-70" : "transition-all"} ${
                      backStyle === "gold"
                        ? "border-yellow-600/50 bg-linear-to-br from-amber-900 to-yellow-950 group-hover:border-yellow-400"
                        : backStyle === "neon"
                          ? "border-cyan-500/50 bg-slate-950 group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                          : "border-purple-500/30 bg-[#0f0c1b] group-hover:border-purple-400/60 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
                    }`}
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "translateZ(1px)",
                    }}
                  >
                    {/* Style-specific overlays */}
                    {backStyle === "gold" ? (
                      <>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.1),transparent)]" />
                        <div className="absolute inset-2 border border-yellow-600/20 rounded-xl bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                        <div className="w-14 h-14 rounded-full border-2 border-yellow-600/40 bg-linear-to-t from-amber-900 to-yellow-700 flex items-center justify-center shadow-lg">
                          <CardIcon className="w-7 h-7 text-yellow-500" />
                        </div>
                      </>
                    ) : backStyle === "neon" ? (
                      <>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.15),transparent)]" />
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-size-[20px_20px]" />
                        <div className="w-14 h-14 rounded-full border border-cyan-500/40 bg-cyan-500/10 backdrop-blur-sm flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                          <CardIcon className="w-7 h-7 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-linear-to-tr from-blue-600/40 via-purple-500/40 to-pink-500/40 opacity-50 mix-blend-color-dodge animate-pulse" />
                        <div className="absolute inset-2 border border-purple-500/20 rounded-xl bg-[linear-gradient(45deg,transparent_25%,rgba(168,85,247,0.1)_50%,transparent_75%)] bg-size-[20px_20px]" />
                        <div className="w-14 h-14 rounded-full border border-purple-400/40 bg-purple-900/40 backdrop-blur-sm flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                          <CardIcon className="w-7 h-7 text-purple-300 drop-shadow-[0_0_5px_rgba(216,180,254,0.8)]" />
                        </div>
                      </>
                    )}
                    {/* Global Shimmer */}
                    <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  </div>

                  {/* Front Face */}
                  <div
                    className={`absolute inset-0 rounded-2xl border-4 border-white/10 bg-linear-to-br ${card.color} shadow-2xl flex flex-col items-center justify-center ${!isSelected && gameState === "result" ? "opacity-60 grayscale-30" : ""}`}
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg) translateZ(1px)",
                    }}
                  >
                    <div className="text-4xl sm:text-6xl mb-2 drop-shadow-lg flex items-center justify-center h-16 w-16">
                      {card.value}
                    </div>
                    <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white/90 drop-shadow-md text-center px-1 leading-tight">
                      {card.label}
                    </div>

                    {!isSelected &&
                      gameState === "result" &&
                      card.type === "win" && (
                        <div className="absolute inset-0 border-4 border-orange-400/50 rounded-xl animate-pulse pointer-events-none" />
                      )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Message Overlay */}
        <div className="h-24 flex items-center justify-center mt-8">
          <AnimatePresence>
            {gameMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="text-center bg-black/40 px-8 py-4 rounded-3xl backdrop-blur-md border border-white/5"
              >
                <div
                  className={`text-3xl font-black italic tracking-tighter drop-shadow-lg ${gameMessage.color}`}
                >
                  {gameMessage.text}
                </div>
                <div className="text-white/60 text-xs font-bold uppercase tracking-widest mt-1">
                  {gameMessage.sub}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Sticky Bottom Action Button */}
      <div className="w-full fixed bottom-0 left-0 right-0 p-6 bg-linear-to-t from-black via-black/90 to-transparent z-50 flex justify-center pb-8">
        <div className="w-full max-w-sm">
          <button
            onClick={gameState === "result" ? resetBoard : startGameSequence}
            disabled={isActionDisabled}
            className={`
              w-full py-5 sm:py-6 rounded-[2rem] font-black text-xl sm:text-2xl uppercase tracking-tighter transition-all active:scale-95 relative overflow-hidden
              ${
                isActionDisabled
                  ? "bg-white/10 text-white/40 cursor-not-allowed"
                  : "bg-linear-to-r from-purple-500 to-orange-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.4)]"
              }
            `}
          >
            {gameState === "revealing" ? (
              "ЗАПОМИНАЙ..."
            ) : gameState === "gathering" || gameState === "shuffling" ? (
              <span className="flex items-center justify-center gap-4">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 sm:w-6 sm:h-6 border-4 border-white/20 border-t-white rounded-full"
                />
                ТАСУЕМ...
              </span>
            ) : gameState === "result" ? (
              "ЕЩЕ РАЗ"
            ) : tickets <= 0 ? (
              "НЕТ БИЛЕТОВ"
            ) : gameState === "playing" ? (
              "ВЫБЕРИ КАРТУ"
            ) : (
              <div className="flex flex-col items-center">
                <span className="drop-shadow-md">ИГРАТЬ</span>
                <span className="text-[10px] font-bold opacity-80 -mt-1 tracking-widest uppercase">
                  1 Билет за игру
                </span>
              </div>
            )}

            {!isActionDisabled && tickets > 0 && gameState !== "playing" && (
              <motion.div
                animate={{ x: ["-100%", "250%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                className="absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent -skew-x-20 pointer-events-none"
              />
            )}
          </button>
        </div>
      </div>

      {/* History Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="absolute top-20 right-4 z-60 flex flex-col gap-2 items-end max-h-[40vh] overflow-y-auto scrollbar-hide pr-2"
          >
            {history.length === 0 && (
              <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full">
                Пусто
              </span>
            )}
            {history.map((h, i) => (
              <motion.div
                key={`h-${i}-${h}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="px-4 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center font-black text-sm backdrop-blur-md shadow-lg"
              >
                {h}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
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
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
