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
  Share2,
  Copy,
  Check,
  Users,
  Award,
  Clock,
  Smartphone,
  Download,
  Package,
} from "lucide-react";
import Link from "next/link";
import { getPhoneDisplay } from "@/lib/phone-utils";
import { BottomNav } from "../components/BottomNav";

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

  // Referral states
  const [referralData, setReferralData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"invite" | "friends" | "history">(
    "invite",
  );
  const [copied, setCopied] = useState(false);

  // PWA states
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        alert(`Не удалось скопировать автоматически. Ссылка: ${text}`);
      }
    } catch (err) {
      console.error("Fallback copy failed", err);
      alert(`Не удалось скопировать автоматически. Ссылка: ${text}`);
    }
  };

  const handleCopyLink = () => {
    if (!referralData?.referralCode) return;
    const link = `${window.location.origin}/promo/login?ref=${referralData.referralCode}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(link)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          console.error("Failed to copy using clipboard API", err);
          fallbackCopyText(link);
        });
    } else {
      fallbackCopyText(link);
    }
  };

  const fetchData = async () => {
    try {
      const [playerRes, clubsRes, referralsRes, inventoryRes] = await Promise.all([
        fetch("/api/promo/player"),
        fetch("/api/promo/player/clubs"),
        fetch("/api/promo/player/referrals").then((res) =>
          res.ok ? res.json() : null,
        ),
        fetch("/api/promo/inventory").then((res) =>
          res.ok ? res.json() : null,
        ),
      ]);

      if (playerRes.status === 401) {
        router.push("/promo");
        return;
      }

      const playerData = await playerRes.json();
      const clubsData = await clubsRes.json();

      setPlayer({ ...playerData.player, activeTickets: playerData.tickets });
      setClubs(clubsData.clubs || []);
      if (referralsRes) {
        setReferralData(referralsRes);
      }
      if (inventoryRes) {
        setInventory(inventoryRes.inventory || []);
      }
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
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 pb-24 font-sans">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-2xl font-black uppercase italic tracking-tight">
            Личный <span className="text-orange-500">Кабинет</span>
          </h1>
          <button
            onClick={handleLogout}
            className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Player Card */}
        <div className="bg-linear-to-br from-orange-500 to-red-600 rounded-[2.5rem] p-8 mb-10 shadow-[0_20px_40px_rgba(234,88,12,0.2)] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-20">
            <Trophy className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-1 uppercase italic tracking-tighter flex items-center gap-3">
              {player?.fullName || "Игрок"}
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full text-white tracking-widest not-italic">
                LVL {player?.level?.currentLevel || 1}
              </span>
            </h2>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-3">
              {player?.phoneNumber
                ? getPhoneDisplay(player.phoneNumber)
                : "..."}
            </p>
            {player?.limitGroupId && player?.settings?.limit_groups && (() => {
              const group = player.settings.limit_groups.find((g: any) => g.id === player.limitGroupId);
              if (!group) return null;
              return (
                <div className="inline-flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-white mb-4">
                  ✨ Группа: {group.name}
                </div>
              );
            })()}

            <Link
              href="/promo/roadmap"
              className="block w-full bg-black/20 hover:bg-black/30 rounded-2xl p-4 mb-6 transition-colors border border-white/10"
            >
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/80 mb-2">
                <span>
                  {player?.level?.isMaxLevel ? "МАКС. УРОВЕНЬ" : "ОПЫТ"}
                </span>
                <span>
                  {player?.level?.isMaxLevel
                    ? `${Math.floor(player?.level?.totalXp || 0)} XP`
                    : `${Math.floor(player?.level?.progressXp || 0)} / ${player?.level?.targetXp || 0} XP`}
                </span>
              </div>
              <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-white h-full rounded-full transition-all"
                  style={{
                    width: `${player?.level?.isMaxLevel ? 100 : Math.min(100, Math.max(0, ((player?.level?.progressXp || 0) / (player?.level?.targetXp || 1)) * 100))}%`,
                  }}
                />
              </div>
            </Link>

            <div className="flex gap-4 sm:gap-8">
              <Link
                href="/promo/accruals"
                className="flex-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl p-4 transition-colors"
              >
                <div className="text-[10px] text-white/70 font-black uppercase tracking-widest mb-1">
                  Билеты
                </div>
                <div className="text-2xl font-black flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-white/80" />
                  {player?.activeTickets || 0}
                </div>
              </Link>
              <Link
                href="/promo/withdraw"
                className="flex-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl p-4 transition-colors"
              >
                <div className="text-[10px] text-white/70 font-black uppercase tracking-widest mb-1">
                  Бонусы
                </div>
                <div className="text-2xl font-black flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-white/80" />
                  {Math.floor(player?.bonusBalance || 0)}
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* PWA Install Banner */}
        {showInstallBtn && (
          <div className="bg-[#151515] border border-orange-500/20 rounded-[2.5rem] p-5 sm:p-6 mb-10 relative overflow-hidden shadow-2xl">
            {/* Background glowing gradient */}
            <div className="absolute -right-20 -bottom-20 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-3 sm:gap-4 relative z-10">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500/10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border border-orange-500/20">
                <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-black uppercase italic tracking-tight text-white leading-tight">
                  Установи <span className="text-orange-500">Приложение</span>
                </h3>
                <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5 truncate">
                  Быстрый доступ и оффлайн-режим
                </p>
              </div>
              <button
                onClick={handleInstallClick}
                className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(234,88,12,0.3)] shrink-0 flex items-center gap-1.5 sm:gap-2"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Скачать
              </button>
            </div>
          </div>
        )}
        {/* Inventory Section */}
        <div className="mb-10 bg-[#151515] border border-white/5 rounded-[2.5rem] p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase italic tracking-tight text-white">
                Мой <span className="text-orange-500">Инвентарь</span>
              </h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                Выигранные призы и бонусы
              </p>
            </div>
          </div>

          {inventory.length === 0 ? (
            <div className="bg-black/20 border border-white/5 rounded-2xl p-6 text-center text-gray-500 text-xs font-bold uppercase tracking-wider">
              Ваш инвентарь пока пуст. Открывайте кейсы в разделе «Кейсы», чтобы выиграть призы!
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
                    className={`bg-black/30 border rounded-2xl p-4 flex flex-col gap-3 transition ${
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
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
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
                        <p className="text-[8px] text-gray-500 font-mono tracking-normal not-italic">
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

        {/* Referral Program */}
        {referralData && (
          <div className="bg-[#151515] border border-white/5 rounded-[2.5rem] p-6 mb-10 relative overflow-hidden shadow-2xl">
            {/* Title */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
                <Share2 className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tight text-white">
                  Пригласи <span className="text-orange-500">Друга</span>
                </h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  Получай бонусы от игр друзей
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-black/40 p-1.5 rounded-2xl mb-6">
              {(["invite", "friends", "history"] as const).map((tab) => {
                const label =
                  tab === "invite"
                    ? "Инфо"
                    : tab === "friends"
                      ? "Друзья"
                      : "История";
                const isSelected = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-xl transition-all relative ${
                      isSelected
                        ? "bg-orange-500 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {label}
                    {tab === "friends" &&
                      referralData.stats.friendsCount > 0 && (
                        <span
                          className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                            isSelected
                              ? "bg-white text-orange-500"
                              : "bg-white/10 text-gray-400"
                          }`}
                        >
                          {referralData.stats.friendsCount}
                        </span>
                      )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              {activeTab === "invite" && (
                <motion.div
                  key="invite"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {referralData?.invitedBy && (
                    <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(234,88,12,0.15)]">
                        <Award className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-orange-500/80">
                          Вас пригласил(а)
                        </div>
                        <div className="text-sm font-black text-white mt-0.5">
                          {referralData.invitedBy.fullName}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Share Link Card */}
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">
                      Твоя ссылка для приглашения
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 bg-black/60 rounded-xl p-2.5 sm:p-3 border border-white/5 overflow-hidden">
                      <input
                        type="text"
                        readOnly
                        value={
                          typeof window !== "undefined"
                            ? `${window.location.origin}/promo/login?ref=${referralData.referralCode}`
                            : `.../promo/login?ref=${referralData.referralCode}`
                        }
                        className="bg-transparent flex-1 min-w-0 outline-none text-[10px] sm:text-xs font-mono text-gray-400 truncate"
                      />
                      <button
                        onClick={handleCopyLink}
                        className={`px-3 sm:px-4 py-2 rounded-lg font-black text-[10px] sm:text-xs uppercase transition-all active:scale-95 shrink-0 ${
                          copied
                            ? "bg-emerald-500 text-white"
                            : "bg-orange-500 hover:bg-orange-600 text-white"
                        }`}
                      >
                        {copied ? (
                          <div className="flex items-center gap-1">
                            <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Коп.
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Коп.
                          </div>
                        )}
                      </button>
                    </div>
                    <div className="text-center text-[10px] text-gray-600 font-bold uppercase tracking-wider">
                      Код приглашения:{" "}
                      <span className="text-orange-500/80 font-mono tracking-normal">
                        {referralData.referralCode}
                      </span>
                    </div>
                  </div>

                  {/* Program Rules */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Условия программы
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex gap-4 bg-white/5 border border-white/5 rounded-2xl p-4">
                        <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
                          <Wallet className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <div className="text-xs font-black uppercase tracking-wide text-white">
                            {referralData.settings.recurring_percent || 10}% от
                            пополнений
                          </div>
                          <p className="text-[10px] text-gray-500 font-bold mt-1 leading-relaxed">
                            Получай постоянный кэшбек на бонусный баланс от
                            каждого пополнения приглашенного друга.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4 bg-white/5 border border-white/5 rounded-2xl p-4">
                        <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
                          <Ticket className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <div className="text-xs font-black uppercase tracking-wide text-white">
                            +{referralData.settings.fixed_reward_tickets || 5}{" "}
                            билетов разово
                          </div>
                          <p className="text-[10px] text-gray-500 font-bold mt-1 leading-relaxed">
                            Начисляется в личный кабинет, когда суммарные
                            депозиты друга достигают{" "}
                            {referralData.settings.threshold || 1000} ₽.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "friends" && (
                <motion.div
                  key="friends"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Приглашенные друзья ({referralData.referredFriends.length})
                  </div>
                  {referralData.referredFriends.length === 0 ? (
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-6 text-center text-gray-500 text-xs font-bold uppercase tracking-wider">
                      У тебя пока нет рефералов. Отправь ссылку другу, чтобы
                      начать получать бонусы!
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                      {referralData.referredFriends.map((friend: any) => {
                        const threshold = parseFloat(
                          referralData.settings.threshold || "1000",
                        );
                        const progressPercent = Math.min(
                          100,
                          (friend.totalReferredDeposits / threshold) * 100,
                        );
                        const isReached =
                          friend.status === "threshold_reached" ||
                          friend.totalReferredDeposits >= threshold;

                        return (
                          <div
                            key={friend.id}
                            className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-xs font-bold text-gray-300">
                                  {friend.fullName[0]?.toUpperCase() || "?"}
                                </div>
                                <div className="text-xs font-black uppercase tracking-wide text-white">
                                  {friend.fullName}
                                </div>
                              </div>
                              <span
                                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isReached
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                }`}
                              >
                                {isReached ? "Условия выполнены" : "В процессе"}
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                                <span>Пополнения друга:</span>
                                <span
                                  className={
                                    isReached
                                      ? "text-emerald-400"
                                      : "text-gray-400"
                                  }
                                >
                                  {Math.floor(friend.totalReferredDeposits)} /{" "}
                                  {threshold} ₽
                                </span>
                              </div>
                              <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isReached
                                      ? "bg-emerald-500"
                                      : "bg-orange-500"
                                  }`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    История реферальных начислений
                  </div>
                  {referralData.history.length === 0 ? (
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-6 text-center text-gray-500 text-xs font-bold uppercase tracking-wider">
                      История начислений пока пуста
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                      {referralData.history.map((item: any) => {
                        const isFixed = item.type === "REFERRAL_FIXED_AWARD";
                        return (
                          <div
                            key={item.id}
                            className="bg-black/30 border border-white/5 rounded-2xl p-4 flex justify-between items-center"
                          >
                            <div className="space-y-1">
                              <div className="text-xs font-black uppercase tracking-wide text-white">
                                {isFixed
                                  ? "Разовый бонус"
                                  : `Комиссия ${item.percent}%`}
                              </div>
                              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                от друга: {item.friendName}
                              </div>
                              <div className="text-[9px] text-gray-600 font-bold">
                                {new Date(item.createdAt).toLocaleDateString(
                                  "ru-RU",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {item.amount > 0 && (
                                <div className="text-emerald-400 text-sm font-black italic">
                                  +{Math.floor(item.amount)} БОН.
                                </div>
                              )}
                              {item.tickets > 0 && (
                                <div className="text-orange-500 text-sm font-black italic flex items-center justify-end gap-1">
                                  +{item.tickets} БИЛ.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Clubs List */}
        <div className="mb-6 flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
            Мои Клубы
          </h3>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-1 hover:text-orange-400 transition-colors"
          >
            <PlusCircle className="w-3 h-3" /> Добавить
          </button>
        </div>

        <div className="space-y-4">
          {clubs.length === 0 ? (
            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 text-center">
              <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-4 opacity-20" />
              <p className="text-gray-500 text-sm font-medium">
                Вы еще не добавили ни одного клуба
              </p>
            </div>
          ) : (
            clubs.map((club, idx) => {
              const isSelected = String(club.id) === String(player?.clubId);
              return (
                <motion.button
                  key={club.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => !isSelected && handleSwitchClub(club.id)}
                  className={`w-full border rounded-3xl p-6 flex items-center gap-4 group transition-all active:scale-98 ${
                    isSelected
                      ? "bg-orange-500/10 border-orange-500/50"
                      : "bg-[#151515] border-white/5 hover:border-orange-500/30"
                  }`}
                >
                  <div className="flex-1 text-left">
                    <div
                      className={`text-lg font-black uppercase italic tracking-tight transition-colors ${
                        isSelected
                          ? "text-orange-500"
                          : "group-hover:text-orange-500"
                      }`}
                    >
                      {club.name}
                    </div>
                    {club.address && (
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                        {club.address}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center gap-1">
                        <Ticket
                          className={`w-3 h-3 ${isSelected ? "text-orange-500" : "text-gray-600"}`}
                        />
                        <span className="text-[10px] font-bold text-gray-500">
                          {club.tickets} бил.
                        </span>
                      </div>
                      <div className="w-1 h-1 bg-white/10 rounded-full" />
                      <div className="text-[10px] font-bold text-gray-500 uppercase">
                        {Math.floor(club.bonusBalance)} бонусов
                      </div>
                    </div>
                  </div>
                  {isSelected ? (
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-white transition-colors" />
                  )}
                </motion.button>
              );
            })
          )}
        </div>

        {/* Global Stats Footer */}
        <div className="mt-12 p-6 border-t border-white/5 grid grid-cols-2 gap-8">
          <div className="flex flex-col gap-1">
            <History className="w-5 h-5 text-gray-600 mb-2" />
            <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">
              Всего игр
            </div>
            <div className="text-lg font-black italic">124</div>
          </div>
          <div className="flex flex-col gap-1">
            <Trophy className="w-5 h-5 text-gray-600 mb-2" />
            <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">
              Призов получено
            </div>
            <div className="text-lg font-black italic">12</div>
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
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-85 bg-[#151515] border border-white/10 rounded-[2.5rem] p-8 z-70 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-orange-500" />
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-2xl font-black uppercase italic tracking-tight mb-2 text-white">
                Добавить <span className="text-orange-500">Клуб</span>
              </h2>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-8 leading-relaxed">
                Введите 4-значный код клуба <br /> с информационной стойки
              </p>

              <form onSubmit={handleAddClub} className="space-y-6">
                <div className="relative">
                  <input
                    type="text"
                    maxLength={4}
                    value={addCode}
                    onChange={(e) => setAddCode(e.target.value.toUpperCase())}
                    placeholder="ABCD"
                    autoFocus
                    className="w-full bg-black border border-white/10 rounded-2xl py-5 text-center text-3xl font-black tracking-[0.5em] text-white focus:border-orange-500/50 outline-none transition-all"
                  />
                </div>

                {addError && (
                  <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center">
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
