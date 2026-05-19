"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  BarChart3,
  Ticket,
  Plus,
  Loader2,
  Search,
  RefreshCw,
  Trash2,
  Edit2,
  X,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { BPActivationButton } from "./BPActivationButton";

interface PlayersTabProps {
  clubId: string;
  players: any[];
  onRefresh: () => void;
}

export function PlayersTab({ clubId, players, onRefresh }: PlayersTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [issueForm, setIssueForm] = useState({
    phone: "",
    amount: "",
    mode: "amount" as "amount" | "count",
    ticketCount: "1",
  });

  const handleIssueTickets = async () => {
    if (!issueForm.phone) return;
    setIsIssuing(true);
    try {
      const res = await fetch(`/api/promo/admin/issue-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: issueForm.phone,
          amount: issueForm.amount,
          mode: issueForm.mode,
          ticketCount: issueForm.ticketCount,
          clubId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIssueForm({
          phone: "",
          amount: "",
          mode: "amount",
          ticketCount: "1",
        });
        onRefresh();
      }
    } catch (error) {
      console.error("Issue Tickets Error:", error);
    } finally {
      setIsIssuing(false);
    }
  };

  const handleUpdatePlayer = async () => {
    if (!editingPlayer) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/promo/admin/players?clubId=${clubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: editingPlayer.id,
          clubId,
          fullName: editingPlayer.full_name,
          totalXp: editingPlayer.total_xp,
          bonusBalance: editingPlayer.bonus_balance,
          ticketsCount: editingPlayer.tickets_count,
        }),
      });
      if (res.ok) {
        setEditingPlayer(null);
        onRefresh();
      }
    } catch (error) {
      console.error("Update Player Error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const resetPlayerTickets = async (playerId: string) => {
    if (!confirm("Вы уверены, что хотите обнулить все активные билеты игрока?"))
      return;
    try {
      await fetch(
        `/api/promo/admin/issue-tickets?clubId=${clubId}&playerId=${playerId}`,
        {
          method: "DELETE",
        },
      );
      onRefresh();
    } catch (error) {
      console.error("Reset Tickets Error:", error);
    }
  };

  const resetPlayerPin = async (playerId: string) => {
    if (
      !confirm("Сбросить PIN-код игрока? Он сможет установить новый при входе.")
    )
      return;
    try {
      await fetch(`/api/promo/admin/players/reset-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, clubId }),
      });
      alert("PIN-код сброшен");
    } catch (error) {
      console.error("Reset PIN Error:", error);
    }
  };
  return (
    <motion.div
      key="players"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      {/* Quick Issue Form */}
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black uppercase italic">
            Быстрое <span className="text-orange-500">начисление</span>
          </h3>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setIssueForm({ ...issueForm, mode: "amount" })}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                issueForm.mode === "amount"
                  ? "bg-white text-orange-500 shadow-sm"
                  : "text-slate-400 hover:text-slate-600",
              )}
            >
              По сумме
            </button>
            <button
              onClick={() => setIssueForm({ ...issueForm, mode: "count" })}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                issueForm.mode === "count"
                  ? "bg-white text-orange-500 shadow-sm"
                  : "text-slate-400 hover:text-slate-600",
              )}
            >
              По количеству
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
              Номер телефона
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="79000000000"
                value={issueForm.phone}
                onChange={(e) =>
                  setIssueForm({ ...issueForm, phone: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
              />
            </div>
          </div>

          {issueForm.mode === "amount" ? (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                Сумма пополнения (₽)
              </label>
              <div className="relative">
                <BarChart3 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  placeholder="1000"
                  value={issueForm.amount}
                  onChange={(e) =>
                    setIssueForm({
                      ...issueForm,
                      amount: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                Кол-во билетов
              </label>
              <div className="relative">
                <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  placeholder="1"
                  value={issueForm.ticketCount}
                  onChange={(e) =>
                    setIssueForm({
                      ...issueForm,
                      ticketCount: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                />
              </div>
            </div>
          )}

          <div className="md:col-span-2 flex items-end">
            <button
              onClick={handleIssueTickets}
              disabled={isIssuing || !issueForm.phone}
              className="w-full h-[52px] bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center gap-2 font-black uppercase italic tracking-wider transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]"
            >
              {isIssuing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Начислить билеты
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Players List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
              База игроков
            </h3>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              type="text"
              placeholder="Поиск по телефону или имени..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Игрок
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Уровень / XP
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Баланс 🪙
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Пополнил (₽)
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Списал (₽)
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {players
                  .filter(
                    (p) =>
                      p.full_name
                        ?.toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      p.phone_number?.includes(searchQuery),
                  )
                  .map((player) => (
                    <tr key={player.id} className="hover:bg-slate-50/30">
                      <td className="px-8 py-4">
                        <div className="font-black italic uppercase text-slate-900">
                          {player.full_name}
                        </div>
                        <div className="text-xs font-bold text-slate-400">
                          {player.phone_number}
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center font-black text-white italic shrink-0">
                            {player.level || 1}
                          </div>
                          <div className="space-y-1">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                              {Math.round(player.total_xp || 0)} /{" "}
                              {player.next_level_xp} XP
                            </div>
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (((player.total_xp || 0) -
                                      (player.current_level_xp || 0)) /
                                      ((player.next_level_xp || 1) -
                                        (player.current_level_xp || 0))) *
                                      100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="font-black text-emerald-600 italic text-lg">
                          {Math.round(player.bonus_balance || 0)} ₽
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="font-black text-amber-600 italic text-base">
                          {Math.round(player.total_deposited || 0)}
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="font-black text-red-500 italic text-base">
                          {Math.round(player.total_withdrawn || 0)}
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <BPActivationButton
                            clubId={clubId}
                            playerId={player.id}
                            hasPremium={player.bp_is_premium}
                          />
                          <button
                            onClick={() => setEditingPlayer(player)}
                            title="Редактировать"
                            className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => resetPlayerPin(player.id)}
                            title="Сбросить PIN"
                            className="p-2 hover:bg-amber-50 text-amber-500 rounded-lg transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => resetPlayerTickets(player.id)}
                            title="Обнулить билеты"
                            className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase italic text-slate-900">
                  Редактировать <span className="text-blue-500">игрока</span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {editingPlayer.phone_number}
                </p>
              </div>
              <button
                onClick={() => setEditingPlayer(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Имя игрока
                </label>
                <div className="relative">
                  <Edit2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={editingPlayer.full_name || ""}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        full_name: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-11 pr-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                    Опыт (XP)
                  </label>
                  <input
                    type="number"
                    value={editingPlayer.total_xp}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        total_xp: parseFloat(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                    Билеты (шт)
                  </label>
                  <div className="relative">
                    <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="number"
                      value={editingPlayer.tickets_count || 0}
                      onChange={(e) =>
                        setEditingPlayer({
                          ...editingPlayer,
                          tickets_count: parseInt(e.target.value),
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-11 pr-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Бонусный баланс (₽)
                </label>
                <input
                  type="number"
                  value={editingPlayer.bonus_balance}
                  onChange={(e) =>
                    setEditingPlayer({
                      ...editingPlayer,
                      bonus_balance: parseFloat(e.target.value),
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all outline-none"
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={handleUpdatePlayer}
                  disabled={isSaving}
                  className="w-full h-[60px] bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center gap-3 font-black uppercase italic tracking-wider transition-all shadow-xl active:scale-[0.98]"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Сохранить изменения
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
