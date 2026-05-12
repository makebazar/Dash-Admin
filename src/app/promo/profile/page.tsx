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
} from "lucide-react";
import Link from "next/link";
import { getPhoneDisplay } from "@/lib/phone-utils";

export default function PromoProfile() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const router = useRouter();

  const fetchData = async () => {
    try {
      const [playerRes, clubsRes] = await Promise.all([
        fetch("/api/promo/player"),
        fetch("/api/promo/player/clubs"),
      ]);

      if (playerRes.status === 401) {
        router.push("/promo");
        return;
      }

      const playerData = await playerRes.json();
      const clubsData = await clubsRes.json();

      setPlayer({ ...playerData.player, activeTickets: playerData.tickets });
      setClubs(clubsData.clubs || []);
    } catch (err) {
      console.error("Failed to fetch profile data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [router]);

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
            <h2 className="text-3xl font-black mb-1 uppercase italic tracking-tighter">
              {player?.fullName || "Игрок"}
            </h2>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-6">
              {player?.phoneNumber
                ? getPhoneDisplay(player.phoneNumber)
                : "..."}
            </p>

            <div className="flex gap-8">
              <div>
                <div className="text-[10px] text-white/50 font-black uppercase tracking-widest mb-1">
                  Билеты
                </div>
                <div className="text-xl font-black flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-white/80" />
                  {player?.activeTickets || 0}
                </div>
              </div>
              <div className="flex-1 flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-white/50 font-black uppercase tracking-widest mb-1">
                    Бонусы
                  </div>
                  <div className="text-xl font-black">
                    {Math.floor(player?.bonusBalance || 0)}
                  </div>
                </div>
                {player?.bonusBalance > 0 && (
                  <Link
                    href="/promo/withdraw"
                    className="bg-black/20 hover:bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                  >
                    На аккаунт
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

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

      {/* Bottom Nav Simulation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-8 py-4 flex items-center gap-10 shadow-2xl z-50">
        <Link
          href="/promo"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <Gamepad2 className="w-6 h-6" />
        </Link>
        <Link
          href="/promo/accruals"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <Ticket className="w-6 h-6" />
        </Link>
        <Link
          href="/promo/withdraw"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <Wallet className="w-6 h-6" />
        </Link>
        <button className="text-orange-500">
          <User className="w-6 h-6" />
        </button>
      </div>

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
      </AnimatePresence>
    </div>
  );
}
