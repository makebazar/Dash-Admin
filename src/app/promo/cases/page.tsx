"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Award, Sparkles, X, ShoppingCart, HelpCircle, Loader2 } from "lucide-react";
import { PromoHeader } from "../components/PromoHeader";
import { BottomNav } from "../components/BottomNav";
import { cn } from "@/lib/utils";

interface CaseItem {
  id: number;
  name: string;
  description: string;
  reward_type: string;
  reward_value: number;
  image_url: string;
  is_rare: boolean;
}

interface Case {
  id: number;
  name: string;
  description: string;
  price_bonus: number;
  rtp: number;
  image_url: string;
  is_active: boolean;
  items: CaseItem[];
}

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  
  // Modal & Spin States
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [spinItems, setSpinItems] = useState<CaseItem[]>([]);
  const [showWinModal, setShowWinModal] = useState(false);
  const [modalPhase, setModalPhase] = useState<"loading" | "ready" | "shaking" | "spinning" | "revealed">("loading");
  
  const rouletteTrackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<any[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  // Play audio effect using Web Audio API
  const playSound = (type: "tick" | "win") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === "tick") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.06);
      } else if (type === "win") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      }
    } catch (e) {
      console.warn("Audio Context failed to play sound:", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [router]);

  useEffect(() => {
    if (selectedCase && canvasRef.current) {
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
      
      const handleResize = () => {
        if (canvasRef.current) {
          canvasRef.current.width = window.innerWidth;
          canvasRef.current.height = window.innerHeight;
        }
      };
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      };
    }
  }, [selectedCase]);

  const createParticles = (x: number, y: number, color: string, count = 60) => {
    const newParticles = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 4;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 3,
        size: Math.random() * 3 + 1.5,
        color,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.01,
        gravity: 0.15,
        drag: 0.98
      });
    }
    particlesRef.current = [...particlesRef.current, ...newParticles];
    
    if (!animationFrameIdRef.current) {
      animateParticles();
    }
  };

  const animateParticles = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity;
      p.alpha -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0);

    if (particlesRef.current.length > 0) {
      animationFrameIdRef.current = requestAnimationFrame(animateParticles);
    } else {
      animationFrameIdRef.current = null;
    }
  };

  const renderChestGraphic = (caseName: string, isShaking: boolean) => {
    const isGold = caseName.toLowerCase().includes("золот");
    const isSilver = caseName.toLowerCase().includes("серебр");
    
    let primaryColor = "from-amber-600 via-amber-700 to-amber-900"; // Bronze
    let glowColor = "shadow-[0_0_40px_rgba(249,115,22,0.25)]";
    let borderGlow = "border-amber-500/30";
    
    if (isGold) {
      primaryColor = "from-yellow-500 via-amber-500 to-yellow-600";
      glowColor = "shadow-[0_0_40px_rgba(234,179,8,0.3)]";
      borderGlow = "border-yellow-400/40";
    } else if (isSilver) {
      primaryColor = "from-slate-400 via-zinc-400 to-slate-500";
      glowColor = "shadow-[0_0_40px_rgba(34,211,238,0.3)]";
      borderGlow = "border-cyan-400/40";
    }

    return (
      <motion.div
        animate={
          isShaking
            ? {
                x: [-3, 3, -3, 3, -2, 2, 0],
                y: [-2, 2, -1, 1, -2, 2, 0],
                scale: [1, 1.04, 0.98, 1.04, 1],
              }
            : {
                y: [0, -10, 0],
              }
        }
        transition={
          isShaking
            ? { repeat: Infinity, duration: 0.12, ease: "linear" }
            : { repeat: Infinity, duration: 2.5, ease: "easeInOut" }
        }
        className={cn(
          "relative w-44 h-44 mx-auto rounded-3xl bg-gradient-to-br flex flex-col items-center justify-center border shadow-2xl transition-all duration-300 z-10",
          primaryColor,
          borderGlow,
          glowColor,
          isShaking ? "brightness-125 border-white/40" : ""
        )}
      >
        <div className="absolute inset-0 rounded-3xl overflow-hidden opacity-30 pointer-events-none">
          <div className="absolute top-10 left-8 w-1 h-1 rounded-full bg-white animate-ping" />
          <div className="absolute bottom-12 right-10 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        </div>

        <div className="w-14 h-14 rounded-full bg-neutral-950/95 border border-white/10 flex items-center justify-center shadow-lg relative">
          <div className="w-4 h-6 rounded-md border-2 border-orange-500 bg-transparent flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full bg-orange-500/10 animate-ping pointer-events-none" />
        </div>

        <div className="absolute inset-x-6 bottom-5 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
            className="w-1/3 h-full bg-gradient-to-r from-transparent via-orange-400 to-transparent"
          />
        </div>

        <Sparkles className="absolute top-3 right-3 w-5 h-5 text-white/30 animate-pulse" />
      </motion.div>
    );
  };

  const triggerSpinSequence = () => {
    if (!selectedCase || !wonItem) return;
    
    setModalPhase("shaking");
    playSound("tick");
    
    setTimeout(() => {
      const x = window.innerWidth / 2;
      const y = window.innerHeight / 2 - 50;
      const isGold = selectedCase.name.toLowerCase().includes("золот");
      const isSilver = selectedCase.name.toLowerCase().includes("серебр");
      const themeColor = isGold ? "#eab308" : isSilver ? "#22d3ee" : "#f97316";
      createParticles(x, y, themeColor, 80);
      
      setModalPhase("spinning");
      setIsSpinning(true);
      
      let tickTimer: NodeJS.Timeout;
      const startSpinTime = Date.now();
      const duration = 4000;

      const runTicks = () => {
        const elapsed = Date.now() - startSpinTime;
        if (elapsed < duration) {
          const progress = elapsed / duration;
          const currentSpeed = 50 + progress * 400;
          playSound("tick");
          tickTimer = setTimeout(runTicks, currentSpeed);
        }
      };
      
      tickTimer = setTimeout(runTicks, 100);

      setTimeout(() => {
        clearTimeout(tickTimer);
        
        const centerLineX = window.innerWidth / 2;
        const centerLineY = window.innerHeight / 2;
        const rarityColor = wonItem.is_rare ? "#f97316" : "#22d3ee";
        createParticles(centerLineX, centerLineY, rarityColor, 100);
        
        playSound("win");
        setIsSpinning(false);
        setModalPhase("revealed");
        setShowWinModal(true);
        fetchData(true);
      }, duration);
      
    }, 1200);
  };

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [casesRes, playerRes, inventoryRes] = await Promise.all([
        fetch("/api/promo/cases"),
        fetch("/api/promo/player"),
        fetch("/api/promo/inventory").then((res) => (res.ok ? res.json() : null)),
      ]);

      if (playerRes.status === 401 || casesRes.status === 401) {
        router.push("/promo/login");
        return;
      }

      if (casesRes.ok && playerRes.ok) {
        const casesData = await casesRes.json();
        const playerData = await playerRes.json();
        setCases(casesData.cases || []);
        setPlayer(playerData.player || null);
      }
      if (inventoryRes) {
        setInventory(inventoryRes.inventory || []);
      }
    } catch (err) {
      console.error("Failed to fetch player cases:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleUseItem = async (inventoryId: string) => {
    try {
      setActivatingId(inventoryId);
      const res = await fetch("/api/promo/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId }),
      });
      if (res.ok) {
        await fetchData(true);
        window.dispatchEvent(new CustomEvent("promo-player-updated"));
      } else {
        alert("Не удалось активировать предмет");
      }
    } catch (err) {
      console.error("Failed to activate item:", err);
    } finally {
      setActivatingId(null);
    }
  };

  const handleOpenCase = async (c: Case) => {
    if (!player) return;
    if (player.bonusBalance < c.price_bonus) {
      alert("Недостаточно бонусов для открытия этого кейса!");
      return;
    }

    setSelectedCase(c);
    setModalPhase("loading");
    setWonItem(null);
    setShowWinModal(false);

    try {
      const res = await fetch("/api/promo/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: c.id }),
      });

      if (!res.ok) {
        let errorMsg = "Не удалось открыть кейс";
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch (parseErr) {
          errorMsg = `Ошибка сервера (Код ${res.status}). Пожалуйста, попробуйте еще раз. Ваши бонусы не были списаны.`;
        }
        alert(errorMsg);
        setSelectedCase(null);
        return;
      }

      const data = await res.json();
      const actualWonItem = data.wonItem;

      setPlayer((prev: any) => ({
        ...prev,
        bonusBalance: data.newBalance,
      }));
      window.dispatchEvent(new CustomEvent("promo-player-updated"));

      const possibleItems = c.items;
      const itemsForReel: CaseItem[] = [];
      for (let i = 0; i < 40; i++) {
        if (i === 32) {
          itemsForReel.push(actualWonItem);
        } else {
          const randomIdx = Math.floor(Math.random() * possibleItems.length);
          itemsForReel.push(possibleItems[randomIdx]);
        }
      }
      setSpinItems(itemsForReel);
      setWonItem(actualWonItem);
      setModalPhase("ready");

    } catch (err: any) {
      console.error("Open Case API Error:", err);
      alert(`Ошибка соединения или сети. Проверьте подключение к интернету или попробуйте позже. Ваши бонусы не были списаны. (${err?.message || ''})`);
      setSelectedCase(null);
    }
  };

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
      case "bonus_limitless":
        return "Безлимитные Бонусы";
      case "bonus_standard":
        return "Бонусы клуба";
      case "bar_item":
      case "bar_category":
        return "Товар Бара";
      case "club_service":
        return "Услуга клуба";
      case "withdraw_boost":
      case "xp_boost":
        return "Буст лимита вывода";
      case "bp_xp":
        return "Опыт";
      case "ticket":
        return "Билет";
      case "custom":
        return "Приз";
      default:
        return "Приз";
    }
  };

  const getRewardUnitLabel = (type: string, value: number) => {
    const num = parseFloat(value as any);
    switch (type) {
      case "bonus_limitless":
      case "bonus_standard":
      case "club_service":
        return `${num} ₽`;
      case "club_time":
        return `${num} мин.`;
      case "withdraw_boost":
      case "xp_boost":
        return `+${num}%`;
      case "bp_xp":
        return `+${num} XP`;
      case "ticket":
        return `+${num} шт.`;
      default:
        return num > 0 ? `${num} ₽` : "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between">
        <PromoHeader title="Кейсы" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
          <p className="text-neutral-500 text-xs font-black uppercase tracking-widest">Загрузка кейсов...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between pb-32">
      <PromoHeader title="Кейсы" />

      <div className="flex-1 max-w-md lg:max-w-6xl mx-auto w-full px-4 pt-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-6">
            <div className="space-y-1">
          <h1 className="text-2xl font-black italic uppercase tracking-tight flex items-center gap-2">
            Кейсы <span className="text-orange-500">удачи</span>
          </h1>
          <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest">
            Открывай сундуки за накопленные бонусы
          </p>
        </div>

        {/* Display player balance details */}
        {player && (
          <div className="bg-neutral-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Ваш баланс бонусов</p>
              <p className="text-xl font-black text-orange-500">{parseFloat(player.bonusBalance || 0)} ₽</p>
            </div>
            <div className="space-y-0.5 text-right">
              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Безлимитный лимит</p>
              <p className="text-sm font-bold text-emerald-400">+{parseFloat(player.extraWithdrawLimit || 0)} ₽</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((c) => (
            <div
              key={c.id}
              className="relative bg-neutral-900/20 border border-white/10 rounded-3xl p-5 overflow-hidden flex flex-col justify-between gap-4 shadow-xl hover:border-orange-500/20 transition-all duration-300"
            >
              {/* Glow filter background */}
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-orange-500/10 blur-2xl rounded-full pointer-events-none" />

              <div className="flex items-start gap-4">
                <div className="space-y-1">
                  <h3 className="font-black italic uppercase text-base tracking-tight">{c.name}</h3>
                  <p className="text-neutral-400 text-xs leading-relaxed font-medium">
                    {c.description}
                  </p>
                </div>
              </div>

              {/* Possible prize showcase */}
              <div className="bg-neutral-900/50 rounded-2xl p-3 border border-white/5 space-y-2">
                <p className="text-[8px] font-black uppercase text-neutral-500 tracking-wider">Возможные призы внутри:</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.items.slice(0, 5).map((item) => (
                    <span
                      key={item.id}
                      className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-md border",
                        item.is_rare
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                          : "bg-neutral-800/40 text-neutral-300 border-white/5"
                      )}
                    >
                      {item.name}
                    </span>
                  ))}
                  {c.items.length > 5 && (
                    <span className="text-[9px] font-bold bg-neutral-800/40 text-neutral-400 border border-white/5 px-2 py-0.5 rounded-md">
                      +{c.items.length - 5} еще
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleOpenCase(c)}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black uppercase italic text-xs tracking-widest py-3.5 px-4 rounded-2xl transition shadow-lg shadow-orange-500/10 active:scale-95"
                >
                  Открыть за {parseFloat(c.price_bonus as any)} ₽
                </button>
              </div>
            </div>
          ))}

          {cases.length === 0 && (
            <div className="bg-neutral-900/10 border border-white/5 rounded-3xl p-10 text-center text-neutral-500 space-y-2">
              <Package className="w-12 h-12 mx-auto text-neutral-700" />
              <p className="font-bold text-sm uppercase italic">Нет доступных кейсов</p>
              <p className="text-xs">В данный момент нет кейсов, доступных для открытия в этом клубе.</p>
            </div>
          )}
        </div>

        </div>

          {/* Right Column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Inventory Section */}
        <div className="bg-neutral-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] p-6 shadow-2xl mt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase italic tracking-tight text-white">
                Мой <span className="text-orange-500">Инвентарь</span>
              </h3>
              <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">
                Выигранные призы и бонусы
              </p>
            </div>
          </div>

          {inventory.length === 0 ? (
            <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 text-center text-neutral-500 text-xs font-bold uppercase tracking-wider">
              Ваш инвентарь пока пуст. Открывайте кейсы выше, чтобы получить свои первые призы!
            </div>
          ) : (
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
              {inventory.map((item) => {
                const isAcquired = item.status === "acquired";
                const isActivated = item.status === "activated";
                const isClaimed = item.status === "claimed";

                return (
                  <div
                    key={item.id}
                    className={`bg-neutral-900/30 border rounded-2xl p-4 flex flex-col gap-3 transition ${
                      item.is_rare ? "border-orange-500/20" : "border-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-black uppercase tracking-wide text-white flex items-center gap-1.5">
                          {item.name}
                          {item.is_rare && (
                            <span className="text-[7px] font-black bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Редкий
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">
                          {item.reward_type === "bonus_limitless" && "Безлимитные бонусы"}
                          {item.reward_type === "bonus_standard" && "Стандартные бонусы"}
                          {(item.reward_type === "bar_item" || item.reward_type === "bar_category") && "Товар Бара"}
                          {item.reward_type === "club_service" && "Услуга клуба"}
                          {(item.reward_type === "withdraw_boost" || item.reward_type === "xp_boost") && "Буст лимита вывода"}
                          {item.reward_type === "bp_xp" && "Опыт"}
                          {item.reward_type === "ticket" && "Билет"}
                          {item.reward_type === "custom" && "Приз"}
                          {item.reward_type === "club_time" && "Игровое время"}
                        </p>
                        {item.reward_type === "bonus_limitless" && (
                          <p className="text-[8px] text-orange-400 font-bold tracking-wide mt-1 leading-normal max-w-[220px]">
                            💡 Вывод без ограничений (даже если исчерпан месячный лимит)
                          </p>
                        )}
                        {item.reward_type === "withdraw_boost" && (
                          <p className="text-[8px] text-yellow-400 font-bold tracking-wide mt-1 leading-normal max-w-[220px]">
                            💡 Буст к лимиту (начисляется автоматически при следующем пополнении)
                          </p>
                        )}
                      </div>

                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isAcquired
                            ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                            : isActivated
                              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {isAcquired && "В инвентаре"}
                        {isActivated && "Ожидает выдачи"}
                        {isClaimed && "Использовано"}
                      </span>
                    </div>

                    {isAcquired && (
                      <button
                        onClick={() => handleUseItem(item.id)}
                        disabled={activatingId === item.id}
                        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black uppercase italic text-[10px] tracking-widest py-2.5 rounded-xl transition active:scale-95 flex items-center justify-center gap-1"
                      >
                        {activatingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Использовать / Активировать"
                        )}
                      </button>
                    )}
                    {isActivated && (
                      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-3 text-[10px] text-yellow-400 font-bold uppercase tracking-wider leading-relaxed text-center space-y-1">
                        <p>Покажите этот экран администратору на кассе</p>
                        <p className="text-[8px] text-neutral-500 font-mono tracking-normal not-italic">
                          Код приза: {item.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
</div>
        </div>
            </div>

      {/* ROULETTE OPEN MODAL */}
      <AnimatePresence>
        {selectedCase && (
          <div className="fixed inset-0 bg-neutral-950/95 backdrop-blur-xl z-[100] flex flex-col justify-center items-center p-4 overflow-hidden">
            {/* Canvas for Particle Effects */}
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-50" />

            <div className="max-w-md w-full text-center space-y-8 relative z-10">
              {/* Top Exit button - only allowed if not spinning/shaking */}
              {modalPhase !== "shaking" && modalPhase !== "spinning" && (
                <button
                  onClick={() => {
                    setSelectedCase(null);
                    setWonItem(null);
                  }}
                  className="absolute -top-12 right-2 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Title Section */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-orange-500 tracking-[0.25em]">
                  {selectedCase.name}
                </p>
                <h2 className="text-2xl font-black italic uppercase tracking-tight text-white">
                  {modalPhase === "loading" && "ЗАГРУЗКА..."}
                  {modalPhase === "ready" && "СУНДУК ГОТОВ"}
                  {modalPhase === "shaking" && "АКТИВАЦИЯ..."}
                  {modalPhase === "spinning" && "ВЫБОР НАГРАДЫ..."}
                  {modalPhase === "revealed" && "ПОЗДРАВЛЯЕМ!"}
                </h2>
              </div>

              {/* Phase 1: Loading / Ready / Shaking */}
              {(modalPhase === "loading" || modalPhase === "ready" || modalPhase === "shaking") && (
                <div className="py-8 flex flex-col items-center justify-center relative">
                  {/* Outer glow ring */}
                  <div className="absolute w-72 h-72 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />

                  {/* Render the actual chest/capsule */}
                  {renderChestGraphic(selectedCase.name, modalPhase === "shaking")}

                  {/* Action Buttons */}
                  <div className="mt-10 w-full px-8">
                    {modalPhase === "loading" && (
                      <div className="flex items-center justify-center gap-2 text-neutral-500 text-xs font-bold uppercase tracking-widest">
                        <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                        Получение данных...
                      </div>
                    )}
                    {modalPhase === "ready" && (
                      <motion.button
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={triggerSpinSequence}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-black uppercase italic text-sm tracking-widest shadow-[0_0_35px_rgba(249,115,22,0.4)] hover:shadow-[0_0_50px_rgba(249,115,22,0.6)] transition-all duration-300"
                      >
                        ОТКРЫТЬ КЕЙС
                      </motion.button>
                    )}
                    {modalPhase === "shaking" && (
                      <div className="text-orange-500 text-xs font-black uppercase tracking-[0.15em] animate-pulse">
                        Вскрытие замков...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Phase 2: Spinning */}
              {modalPhase === "spinning" && (
                <div className="space-y-6">
                  {/* Roulette Container */}
                  <div className="relative w-full overflow-hidden bg-neutral-900/40 border-y border-white/5 py-8 my-4 backdrop-blur-md">
                    {/* Glowing Laser Pointer (Center Marker) */}
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-orange-500 z-20 shadow-[0_0_15px_rgba(249,115,22,0.8)]" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 border-t-8 border-x-8 border-t-orange-500 border-x-transparent z-20" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 border-b-8 border-x-8 border-b-orange-500 border-x-transparent z-20" />

                    {/* Magnifying Lens Screen Overlay */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[108px] h-[108px] rounded-2xl border-2 border-orange-500/50 bg-orange-500/10 backdrop-blur-xs z-10 pointer-events-none shadow-[0_0_30px_rgba(249,115,22,0.25)] animate-pulse" />

                    {/* Left/Right fading gradient overlays */}
                    <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-neutral-950 to-transparent z-10" />
                    <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-neutral-950 to-transparent z-10" />

                    {/* Track */}
                    <motion.div
                      ref={rouletteTrackRef}
                      className="flex gap-2 px-[50%]"
                      style={{
                        filter: isSpinning ? "blur(1.5px)" : "none",
                        willChange: "transform",
                      }}
                      animate={
                        wonItem
                          ? { x: -3456 - 50 }
                          : { x: 0 }
                      }
                      transition={{
                        duration: 4,
                        ease: [0.05, 0.9, 0.1, 1.0], // Custom slow down curve
                      }}
                    >
                      {spinItems.map((item, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "w-[100px] h-[100px] rounded-2xl flex flex-col justify-between p-2 shrink-0 border select-none text-left transition-all duration-300",
                            item.is_rare
                              ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                              : "bg-neutral-800/40 border-white/5 text-neutral-200"
                          )}
                        >
                          <div className="w-8 h-8 rounded-lg bg-neutral-900/50 flex items-center justify-center border border-white/5">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-6 h-6 object-contain" />
                            ) : (
                              <Award className="w-4 h-4 text-orange-500/60" />
                            )}
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase truncate text-neutral-400">{item.name}</p>
                            <p className="text-[10px] font-black italic">{getRewardUnitLabel(item.reward_type, item.reward_value)}</p>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  </div>

                  <p className="text-xs text-neutral-500 animate-pulse font-bold uppercase tracking-[0.2em]">
                    Фортуна выбирает ваш приз...
                  </p>
                </div>
              )}

              {/* Phase 3: Revealed (Win Screen) */}
              {modalPhase === "revealed" && wonItem && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="relative max-w-sm mx-auto rounded-[2.5rem] bg-gradient-to-b from-neutral-900 to-neutral-950 border border-white/10 p-8 space-y-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
                >
                  {/* Dynamic background glow based on rarity */}
                  <div
                    className={cn(
                      "absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 blur-[80px] rounded-full pointer-events-none",
                      wonItem.is_rare ? "bg-orange-500/20" : "bg-cyan-500/20"
                    )}
                  />

                  {/* Shiny Diagonal Sweep (gloss effect) */}
                  <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none" />

                  {/* Premium Prize Container */}
                  <div
                    className={cn(
                      "w-24 h-24 rounded-3xl flex items-center justify-center mx-auto border shadow-2xl relative",
                      wonItem.is_rare
                        ? "bg-gradient-to-br from-orange-500/10 to-amber-500/5 border-orange-500/40 shadow-orange-500/10"
                        : "bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border-cyan-500/40 shadow-cyan-500/10"
                    )}
                  >
                    {wonItem.image_url ? (
                      <img src={wonItem.image_url} alt={wonItem.name} className="w-16 h-16 object-contain" />
                    ) : (
                      <Sparkles className={cn("w-10 h-10", wonItem.is_rare ? "text-orange-400" : "text-cyan-400")} />
                    )}

                    {/* Rare badge */}
                    {wonItem.is_rare && (
                      <span className="absolute -bottom-2 bg-orange-500 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full border border-neutral-900 tracking-wider">
                        РЕДКИЙ
                      </span>
                    )}
                  </div>

                  {/* Prize Details */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.2em]">
                      Ваш Выигрыш!
                    </p>
                    <h3 className="text-2xl font-black italic uppercase leading-none text-white tracking-tight drop-shadow-md">
                      {wonItem.name}
                    </h3>
                    <p className={cn("text-xs font-bold uppercase tracking-wider", wonItem.is_rare ? "text-orange-400" : "text-cyan-400")}>
                      {getRewardTypeLabel(wonItem.reward_type)}: {getRewardUnitLabel(wonItem.reward_type, wonItem.reward_value)}
                    </p>
                  </div>
                  
                  {wonItem.reward_type === "bonus_limitless" && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3 max-w-[280px] mx-auto text-[10px] text-orange-400 font-bold uppercase tracking-wide leading-normal">
                      💡 Вы можете вывести эти бонусы на наличные, даже если ваш месячный лимит вывода полностью исчерпан!
                    </div>
                  )}
                  {wonItem.reward_type === "withdraw_boost" && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 max-w-[280px] mx-auto text-[10px] text-yellow-400 font-bold uppercase tracking-wide leading-normal">
                      💡 Этот буст применится автоматически на кассе при следующем пополнении и увеличит ваш лимит вывода!
                    </div>
                  )}

                  <p className="text-[11px] text-neutral-400 leading-relaxed max-w-[280px] mx-auto font-medium">
                    Выигранный предмет добавлен в ваш инвентарь. Вы можете активировать его в Личном кабинете в любой момент.
                  </p>

                  {/* Bottom Action buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setSelectedCase(null);
                        setWonItem(null);
                      }}
                      className="flex-1 bg-neutral-900 hover:bg-neutral-800 border border-white/5 text-neutral-300 font-black uppercase italic text-xs tracking-widest py-4 rounded-2xl transition-all duration-200 active:scale-95"
                    >
                      Закрыть
                    </button>
                    <button
                      onClick={() => handleOpenCase(selectedCase)}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black uppercase italic text-xs tracking-widest py-4 rounded-2xl transition-all duration-200 shadow-lg shadow-orange-500/10 active:scale-95"
                    >
                      Еще раз
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      <BottomNav />
      <style>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
