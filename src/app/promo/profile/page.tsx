"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  MapPin,
  Ticket,
  ChevronRight,
  LogOut,
  Loader2,
  PlusCircle,
  Trophy,
  History,
  Gamepad2,
  X,
  ArrowRight,
  Wallet,
  ShoppingCart,
  Clock,
  Smartphone,
  Download,
  Package,
} from "lucide-react";
import Link from "next/link";
import { getPhoneDisplay } from "@/lib/phone-utils";
import { BottomNav } from "../components/BottomNav";
import { cn } from "@/lib/utils";

export default function PromoProfile() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const router = useRouter();

  // Inventory states
  const [inventory, setInventory] = useState<any[]>([]);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // PWA states
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const fetchData = async () => {
    try {
      const [playerRes, clubsRes, inventoryRes] = await Promise.all([
        fetch("/api/promo/player"),
        fetch("/api/promo/player/clubs"),
        fetch("/api/promo/inventory").then((res) =>
          res.ok ? res.json() : null,
        ),
      ]);

      if (playerRes.status === 401) {
        fetch("http://localhost:3033/promo/logout", {
          method: "POST",
          mode: "no-cors",
        }).catch(() => {});
        router.push("/promo/login");
        return;
      }

      const playerData = await playerRes.json();
      const clubsData = await clubsRes.json();

      setPlayer({ ...playerData.player, activeTickets: playerData.tickets });
      setClubs(clubsData.clubs || []);
      if (inventoryRes) {
        setInventory(inventoryRes.inventory || []);
      }

      // Sync active session to local DashFrag Agent if running
      fetch("/api/promo/auth/cookies")
        .then((r) => (r.ok ? r.json() : null))
        .then((cData) => {
          if (cData?.cookies) {
            const qs = encodeURIComponent(cData.cookies);
            fetch(`http://localhost:3033/promo/set-cookies?cookies=${qs}`, {
              method: "POST",
              mode: "no-cors",
              body: JSON.stringify({ cookies: cData.cookies }),
            }).catch(() => {});
          }
        })
        .catch(() => {});
    } catch (err) {
      console.error("Failed to fetch profile data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [router]);

  useEffect(() => {
    // Check if running in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone;

    // Check if iOS device
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    if (!isStandalone) {
      if ((window as any).deferredPrompt) {
        setShowInstallBtn(true);
      } else if (ios) {
        setShowInstallBtn(true);
      }

      const handlePrompt = () => {
        setShowInstallBtn(true);
      };
      window.addEventListener("pwa-install-prompt-available", handlePrompt);
      return () => {
        window.removeEventListener(
          "pwa-install-prompt-available",
          handlePrompt,
        );
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    const promptEvent = (window as any).deferredPrompt;
    if (!promptEvent) return;

    promptEvent.prompt();

    const { outcome } = await promptEvent.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    (window as any).deferredPrompt = null;
    setShowInstallBtn(false);
  };

  const handleAddClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addCode.length < 4) return;

    setIsAdding(true);
    setAddError("");

    try {
      const res = await fetch("/api/promo/player/clubs/add", {
        method: "POST",
        body: JSON.stringify({ code: addCode }),
      });
      const data = await res.json();

      if (data.success) {
        setIsAddModalOpen(false);
        setAddCode("");
        await fetchData(); // Refresh data
      } else {
        setAddError(data.error || "Ошибка при добавлении клуба");
      }
    } catch (err) {
      setAddError("Ошибка соединения");
    } finally {
      setIsAdding(false);
    }
  };

  const handleSwitchClub = async (clubId: string) => {
    try {
      await fetch("/api/promo/player/clubs", {
        method: "POST",
        body: JSON.stringify({ clubId }),
      });

      // Update local player state with info from the selected club
      const selectedClub = clubs.find((c) => String(c.id) === String(clubId));
      if (selectedClub && player) {
        setPlayer({
          ...player,
          clubId: clubId,
          activeTickets: selectedClub.tickets,
          bonusBalance: selectedClub.bonusBalance,
          clubName: selectedClub.name,
        });
      }
    } catch (err) {
      console.error("Failed to switch club", err);
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
        await fetchData();
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

  const handleLogout = async () => {
    try {
      // Notify local agent to logout immediately
      try {
        await fetch("http://localhost:3033/promo/logout", {
          method: "POST",
          mode: "no-cors",
        });
      } catch {
        // Ignore if local agent is not running
      }

      await fetch("/api/promo/auth/logout", {
        method: "POST",
      });
      router.push("/promo");
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 pb-48 sm:pb-36 font-sans">
      <div className="max-w-md lg:max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white leading-snug">
            Личный кабинет
          </h1>
          <button
            onClick={handleLogout}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer border border-white/5"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Player Card */}
            <div className="bg-gradient-to-br from-amber-500/15 via-orange-500/5 to-transparent border border-amber-500/25 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-7 shadow-lg shadow-black/20 relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none" />
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none select-none">
                <Trophy className="w-24 h-24 text-amber-400" />
              </div>
              <div className="relative z-10">
                <h2 className="text-2xl sm:text-3xl font-black mb-1 uppercase italic tracking-tight text-white">
                  {player?.fullName || "Игрок"}
                </h2>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                    {player?.phoneNumber
                      ? getPhoneDisplay(player.phoneNumber)
                      : "..."}
                  </p>
                  {player?.id && (
                    <Link
                      href={`/promo/player/${player.id}`}
                      className="text-[10px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1 rounded-xl transition-all flex items-center gap-1"
                    >
                      Публичный вид ↗
                    </Link>
                  )}
                </div>
                {player?.limitGroupId && player?.settings?.limit_groups && (() => {
                  const group = player.settings.limit_groups.find((g: any) => g.id === player.limitGroupId);
                  if (!group) return null;
                  return (
                    <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-amber-300 mb-4">
                      <span>Группа: {group.name}</span>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap sm:flex-nowrap gap-3 sm:gap-4 mt-2">
                  <Link
                    href="/promo/accruals"
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 transition-all group/card"
                  >
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                      Билеты
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-amber-400 flex items-center gap-1.5">
                      <Ticket className="w-4 h-4 text-amber-400" />
                      {player?.activeTickets || 0}
                    </div>
                  </Link>
                  <Link
                    href="/promo/withdraw"
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 transition-all group/card"
                  >
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                      Бонусы
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-yellow-400 flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-yellow-400" />
                      {Math.floor(player?.bonusBalance || 0)} ₽
                    </div>
                  </Link>
                </div>
              </div>
            </div>

            {/* PWA Install Banner */}
            {showInstallBtn && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-5 relative overflow-hidden shadow-lg">
                <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0 border border-amber-500/20">
                    <Smartphone className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black uppercase italic tracking-tight text-white leading-tight">
                      Установите приложение
                    </h3>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5 truncate">
                      Быстрый доступ с главного экрана
                    </p>
                  </div>
                  <button
                    onClick={handleInstallClick}
                    className="bg-white/10 hover:bg-white/20 border border-white/15 active:scale-95 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Установить
                  </button>
                </div>
              </div>
            )}

            {/* Clubs List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
                  Мои Клубы
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Добавить
                </button>
              </div>

              <div className="space-y-3">
                {clubs.length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
                    <MapPin className="w-8 h-8 text-gray-600 mx-auto mb-3 opacity-30" />
                    <p className="text-gray-400 text-xs font-medium">
                      Вы еще не добавили ни одного клуба
                    </p>
                  </div>
                ) : (
                  clubs.map((club, idx) => {
                    const isSelected = String(club.id) === String(player?.clubId);
                    return (
                      <motion.button
                        key={club.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => !isSelected && handleSwitchClub(club.id)}
                        className={`w-full border rounded-3xl p-5 flex items-center gap-4 group transition-all text-left cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500/40"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-base font-black uppercase italic tracking-tight transition-colors truncate ${
                              isSelected
                                ? "text-amber-400"
                                : "text-white group-hover:text-amber-300"
                            }`}
                          >
                            {club.name}
                          </div>
                          {club.address && (
                            <div className="text-[10px] text-gray-400 font-medium mt-0.5 truncate">
                              {club.address}
                            </div>
                          )}
                          <div className="flex items-center gap-2.5 mt-2.5">
                            <span className="text-[11px] font-bold text-amber-400">
                              {club.tickets} бил.
                            </span>
                            <span className="text-gray-600 font-normal">•</span>
                            <span className="text-[11px] font-bold text-yellow-400">
                              {Math.floor(club.bonusBalance)} ₽
                            </span>
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shrink-0">
                            <div className="w-2 h-2 bg-black rounded-full" />
                          </div>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors shrink-0" />
                        )}
                      </motion.button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Inventory Section */}
            <div className="bg-white/5 border border-white/10 rounded-3xl sm:rounded-[2.5rem] p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight text-white">
                    Мой инвентарь
                  </h3>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    Выигранные призы, напитки и бонусы
                  </p>
                </div>
              </div>

              {inventory.length === 0 ? (
                <div className="bg-white/2 border border-white/5 rounded-2xl p-6 text-center text-gray-500 text-xs font-medium">
                  Ваш инвентарь пока пуст. Крутите «Колесо фортуны» и открывайте сейфы, чтобы получить призы!
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
                  {inventory.map((item) => {
                    const isAcquired = item.status === "acquired";
                    const isActivated = item.status === "activated";
                    const isClaimed = item.status === "claimed";

                    return (
                      <div
                        key={item.id}
                        className={`bg-white/5 border rounded-2xl p-4 flex flex-col gap-3 transition ${
                          item.is_rare ? "border-amber-500/30" : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="text-sm font-black uppercase tracking-tight text-white flex items-center gap-2">
                              <span className="truncate">{item.name}</span>
                              {item.is_rare && (
                                <span className="text-[9px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                  Редкий
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                              {item.reward_type === "bonus_limitless" && "Безлимитные бонусы"}
                              {item.reward_type === "bonus_standard" && "Стандартные бонусы"}
                              {(item.reward_type === "bar_item" || item.reward_type === "bar_category") && "Товар бара"}
                              {item.reward_type === "club_service" && "Услуга клуба"}
                              {(item.reward_type === "withdraw_boost" || item.reward_type === "xp_boost") && "Буст лимита вывода"}
                              {item.reward_type === "bp_xp" && "Опыт"}
                              {item.reward_type === "ticket" && "Билет"}
                              {item.reward_type === "custom" && "Приз"}
                              {item.reward_type === "club_time" && "Игровое время"}
                            </p>
                          </div>

                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${
                              isAcquired
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : isActivated
                                  ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {isAcquired && "В инвентаре"}
                            {isActivated && "На выдаче"}
                            {isClaimed && "Использовано"}
                          </span>
                        </div>

                        {isAcquired && (
                          <button
                            onClick={() => handleUseItem(item.id)}
                            disabled={activatingId === item.id}
                            className="w-full bg-white/10 hover:bg-white/20 border border-white/15 disabled:opacity-50 text-white font-black uppercase italic text-xs tracking-wider py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            {activatingId === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Активировать на кассе"
                            )}
                          </button>
                        )}

                        {isActivated && (
                          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 text-xs text-amber-300 font-medium text-center space-y-1">
                            <p>Покажите этот экран администратору на кассе</p>
                            <p className="text-[11px] text-gray-400 font-mono tracking-wider">
                              Код приза: <span className="text-white font-bold">{item.id.slice(0, 8).toUpperCase()}</span>
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

      <BottomNav />

      {/* Add Club Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-60"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[#121212] border border-white/10 rounded-3xl p-6 sm:p-8 z-70 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                  <MapPin className="w-5 h-5 text-amber-400" />
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-9 h-9 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer border border-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h2 className="text-xl font-black uppercase italic tracking-tight mb-1 text-white">
                Добавить клуб
              </h2>
              <p className="text-gray-400 text-xs font-medium mb-6 leading-relaxed">
                Введите 4-значный код клуба с информационной стойки или у администратора
              </p>

              <form onSubmit={handleAddClub} className="space-y-5">
                <div className="relative">
                  <input
                    type="text"
                    maxLength={4}
                    value={addCode}
                    onChange={(e) => setAddCode(e.target.value.toUpperCase())}
                    placeholder="ABCD"
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 text-center text-2xl font-black tracking-[0.4em] text-white focus:border-amber-500/50 outline-none transition-all"
                  />
                </div>

                {addError && (
                  <p className="text-rose-400 text-xs font-bold text-center">
                    {addError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isAdding || addCode.length < 4}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_10px_20px_rgba(234,88,12,0.3)]"
                >
                  {isAdding ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      ПОДТВЕРДИТЬ <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </>
        )}

        {/* iOS Installation Guide Modal */}
        {showIOSGuide && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIOSGuide(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-60"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[22rem] bg-[#151515] border border-white/10 rounded-[2.5rem] p-8 z-70 shadow-2xl text-center"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-orange-500" />
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-2xl font-black uppercase italic tracking-tight mb-2 text-white text-left">
                Установка на{" "}
                <span className="text-orange-500">iOS / Safari</span>
              </h2>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-8 text-left leading-relaxed">
                Добавьте приложение на экран «Домой» за пару простых шагов:
              </p>

              <div className="space-y-4 text-left mb-8">
                <div className="flex items-start gap-4 bg-white/5 border border-white/5 rounded-2xl p-4">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 font-black text-sm shrink-0">
                    1
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-white">
                      Нажмите кнопку «Поделиться»
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold mt-1">
                      Она находится на нижней панели браузера Safari (иконка с
                      вылетающей стрелкой{" "}
                      <span className="text-orange-500">📤</span>)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 bg-white/5 border border-white/5 rounded-2xl p-4">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 font-black text-sm shrink-0">
                    2
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-white">
                      Выберите «На экран Домой»
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold mt-1">
                      Прокрутите меню вниз и выберите опцию «На экран „Домой“»
                      или «Добавить на экран Домой» (
                      <span className="text-orange-500">📱</span>)
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_10px_20px_rgba(234,88,12,0.3)]"
              >
                ПОНЯТНО
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
