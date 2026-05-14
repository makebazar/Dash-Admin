"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Ticket,
  Clock,
  ChevronRight,
  Loader2,
  Store,
  Zap,
  Gift,
  Gamepad2,
  User,
  Wallet,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";

export default function AccrualsPage() {
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<any>(null);
  const [tickets, setTickets] = useState(0);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [pRes, hRes] = await Promise.all([
          fetch("/api/promo/player"),
          fetch("/api/promo/player/accruals"),
        ]);

        if (pRes.ok) {
          const pData = await pRes.json();
          setPlayer(pData.player);
          setTickets(pData.tickets);
        }

        if (hRes.ok) {
          const hData = await hRes.json();
          setHistory(hData.accruals || []);
        }
      } catch (err) {
        console.error("Failed to fetch accruals data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  const settings = player?.settings || {};
  const accrualRules = settings.accrual_rules || [];
  const barAccrualRules = settings.bar_accrual_rules || [];
  const totalReceived = history.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 pb-32 font-sans">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-2xl font-black uppercase italic tracking-tight">
            История <span className="text-orange-500">Билетов</span>
          </h1>
        </div>

        {/* Balance Card (Styled like Profile) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-linear-to-br from-orange-500 to-red-600 rounded-[2.5rem] p-8 mb-10 shadow-[0_20px_40px_rgba(234,88,12,0.2)] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-20">
            <Ticket className="w-24 h-24 text-white rotate-12" />
          </div>
          <div className="relative z-10">
            <div className="text-[10px] text-white/70 font-black uppercase tracking-widest mb-1">
              Доступно сейчас
            </div>
            <div className="text-5xl font-black italic tracking-tighter flex items-end gap-2 mb-6">
              {tickets}
              <span className="text-xl mb-1.5 opacity-90 font-black uppercase tracking-widest ml-1">
                Билетов
              </span>
            </div>

            <div className="pt-6 border-t border-white/10 flex items-center gap-6">
              <div>
                <div className="text-[8px] font-black uppercase tracking-widest text-white/50 mb-0.5">
                  Всего получено
                </div>
                <div className="text-lg font-black italic tracking-tight">
                  {totalReceived} 🎟
                </div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <p className="flex-1 text-white/60 text-[10px] font-medium leading-tight">
                Пополняй баланс или покупай в баре, чтобы получать новые
                попытки.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Rules Section */}
        <div className="mb-6 flex items-center px-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
            Правила начисления
          </h3>
        </div>

        <div className="space-y-3 mb-12">
          {/* Welcome Bonus */}
          {settings.welcome_bonus_tickets > 0 && (
            <div className="bg-[#151515] border border-white/5 rounded-3xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">Бонус за регистрацию</div>
                  <div className="text-[10px] text-gray-500 uppercase font-black">
                    Один раз
                  </div>
                </div>
              </div>
              <div className="text-lg font-black text-emerald-500">
                +{settings.welcome_bonus_tickets}
              </div>
            </div>
          )}

          {/* Top-up Rules */}
          <div className="bg-[#151515] border border-white/5 rounded-[2rem] overflow-hidden">
            <div className="bg-white/5 px-6 py-3 flex items-center gap-2">
              <Zap className="w-3 h-3 text-orange-500" />
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                Пополнение баланса
              </div>
            </div>
            <div className="p-2 space-y-1">
              {accrualRules.length > 0 ? (
                accrualRules.map((rule: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                  >
                    <div className="text-sm font-bold text-gray-300">
                      {rule.type === "threshold"
                        ? `От ${rule.amount} ₽`
                        : `Каждые ${rule.amount} ₽`}
                    </div>
                    <div className="text-sm font-black text-orange-500">
                      +{rule.tickets} 🎟
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors">
                  <div className="text-sm font-bold text-gray-300">
                    Каждые {settings.ticket_price || 500} ₽
                  </div>
                  <div className="text-sm font-black text-orange-500">
                    +1 🎟
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bar Rules */}
          {settings.bar_accrual_enabled && (
            <div className="bg-[#151515] border border-white/5 rounded-[2rem] overflow-hidden">
              <div className="bg-white/5 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="w-3 h-3 text-blue-500" />
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Покупки в баре
                  </div>
                </div>
              </div>
              <div className="p-2 space-y-1">
                {barAccrualRules.length > 0 ? (
                  barAccrualRules.map((rule: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors"
                    >
                      <div className="text-sm font-bold text-gray-300">
                        {rule.type === "threshold"
                          ? `От ${rule.amount} ₽`
                          : `Каждые ${rule.amount} ₽`}
                      </div>
                      <div className="text-sm font-black text-blue-500">
                        +{rule.tickets} 🎟
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors text-gray-500">
                    <div className="text-sm font-bold italic">
                      По основным тарифам
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* History List */}
        <div className="mb-6 flex items-center px-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
            История начислений
          </h3>
        </div>

        <div className="bg-[#151515] border border-white/5 rounded-[2.5rem] overflow-hidden divide-y divide-white/5">
          {history.length === 0 ? (
            <div className="p-12 text-center text-gray-600 text-xs font-bold uppercase tracking-widest italic">
              Начислений еще не было
            </div>
          ) : (
            history.map((item, idx) => (
              <div
                key={idx}
                className="p-6 flex items-center justify-between hover:bg-white/2 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      item.source === "welcome_bonus"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : item.source === "pos_sale"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-orange-500/10 text-orange-500"
                    }`}
                  >
                    {item.source === "welcome_bonus" ? (
                      <Gift className="w-5 h-5" />
                    ) : item.source === "pos_sale" ? (
                      <Store className="w-5 h-5" />
                    ) : (
                      <Ticket className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-gray-200">
                      {item.source === "welcome_bonus"
                        ? "Бонус новичка"
                        : item.source === "pos_sale"
                          ? "За покупку в баре"
                          : item.source === "admin_manual"
                            ? "Ручное начисление"
                            : "Пополнение баланса"}
                    </div>
                    {item.source === "pos_sale" && item.bar_products && (
                      <div className="text-[10px] text-blue-400/80 font-medium italic mt-0.5 line-clamp-1">
                        {item.bar_products}
                      </div>
                    )}
                    {item.source === "topup" && item.topup_amount && (
                      <div className="text-[10px] text-orange-400/80 font-bold mt-0.5">
                        Сумма: {Number(item.topup_amount).toLocaleString()} ₽
                      </div>
                    )}
                    <div className="text-[10px] text-gray-600 font-medium mt-1">
                      {new Date(item.created_at).toLocaleDateString()} в{" "}
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                <div
                  className={`font-black text-lg ${
                    item.source === "welcome_bonus"
                      ? "text-emerald-500"
                      : item.source === "pos_sale"
                        ? "text-blue-500"
                        : "text-orange-500"
                  }`}
                >
                  +{item.count}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sticky Bottom Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-8 py-4 flex items-center gap-8 sm:gap-10 shadow-2xl z-50">
        <Link
          href="/promo"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <Gamepad2 className="w-6 h-6" />
        </Link>
        <Link
          href="/promo?tab=shop"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <ShoppingCart className="w-6 h-6" />
        </Link>
        <button className="text-orange-500">
          <Ticket className="w-6 h-6" />
        </button>
        <Link
          href="/promo/withdraw"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <Wallet className="w-6 h-6" />
        </Link>
        <Link
          href="/promo/profile"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <User className="w-6 h-6" />
        </Link>
      </div>
    </div>
  );
}
