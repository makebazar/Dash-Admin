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
  Award,
} from "lucide-react";
import Link from "next/link";
import { PromoHeader } from "../components/PromoHeader";
import { BottomNav } from "../components/BottomNav";

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
  const totalReceived = history.reduce((acc: number, curr: any) => acc + curr.count, 0);
  const playerGroupId = player?.limitGroupId || null;
  const limitGroups: any[] = settings.limit_groups || [];
  const playerGroup = playerGroupId ? limitGroups.find((g: any) => g.id === playerGroupId) : null;

  // Returns the effective amount for a rule respecting the player's group
  const getRuleAmount = (rule: any): { amount: number; isGroupOverride: boolean } => {
    if (playerGroupId && rule.group_amounts && rule.group_amounts[playerGroupId] !== undefined) {
      return { amount: parseFloat(rule.group_amounts[playerGroupId]) || 0, isGroupOverride: true };
    }
    return { amount: parseFloat(rule.amount) || 0, isGroupOverride: false };
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30 overflow-x-hidden">
      <PromoHeader title="История билетов" />

      <main className="max-w-md lg:max-w-6xl mx-auto p-6 pb-32">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Balance Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-amber-500/15 via-orange-500/5 to-transparent border border-amber-500/25 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-7 shadow-lg shadow-black/20 relative overflow-hidden group"
            >
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity pointer-events-none" />
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none select-none">
                <Ticket className="w-24 h-24 text-amber-400 rotate-12" />
              </div>
              <div className="relative z-10">
                <div className="text-[10px] text-amber-400 font-black uppercase tracking-widest mb-1.5">
                  Доступно сейчас
                </div>
                <div className="text-4xl sm:text-5xl font-black italic tracking-tight text-white flex items-baseline gap-2 mb-6">
                  {tickets}
                  <span className="text-base font-bold uppercase tracking-wider text-gray-400">
                    билетов
                  </span>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center gap-5">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">
                      Всего получено
                    </div>
                    <div className="text-base font-black italic tracking-tight text-amber-400">
                      {totalReceived} шт.
                    </div>
                  </div>
                  <div className="w-px h-7 bg-white/10" />
                  <p className="flex-1 text-gray-400 text-xs font-medium leading-tight">
                    Пополняйте баланс и покупайте в баре для начисления билетов.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Rules Section */}
            <div className="space-y-4">
              <div className="px-1">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
                  Правила начисления
                </h3>
              </div>

              {/* Welcome Bonus */}
              {settings.welcome_bonus_tickets > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-white">Бонус за регистрацию</div>
                    <div className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-wider mt-0.5">
                      Начисляется один раз
                    </div>
                  </div>
                  <div className="text-base font-black text-emerald-400">
                    +{settings.welcome_bonus_tickets}
                  </div>
                </div>
              )}

              {/* Top-up Rules */}
              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <div className="bg-white/[0.02] px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    Пополнение баланса
                  </div>
                </div>
                <div className="p-2 space-y-1">
                  {accrualRules.length > 0 ? (
                    accrualRules.map((rule: any, idx: number) => {
                      const { amount, isGroupOverride } = getRuleAmount(rule);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-xs sm:text-sm font-bold text-gray-200">
                              {rule.type === "threshold"
                                ? `От ${amount.toLocaleString("ru-RU")} ₽`
                                : `Каждые ${amount.toLocaleString("ru-RU")} ₽`}
                            </div>
                            {isGroupOverride && (
                              <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                                {playerGroup?.name}
                              </span>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm font-black text-amber-400">
                            +{rule.tickets}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl transition-colors">
                      <div className="text-xs sm:text-sm font-bold text-gray-200">
                        Каждые {settings.ticket_price || 500} ₽
                      </div>
                      <div className="text-xs sm:text-sm font-black text-amber-400">
                        +1
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bar Rules */}
              {settings.bar_accrual_enabled && (
                <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                  <div className="bg-white/[0.02] px-5 py-3 border-b border-white/5 flex items-center justify-between">
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                      Покупки в баре
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    {barAccrualRules.length > 0 ? (
                      barAccrualRules.map((rule: any, idx: number) => {
                        const { amount, isGroupOverride } = getRuleAmount(rule);
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="text-xs sm:text-sm font-bold text-gray-200">
                                {rule.type === "threshold"
                                  ? `От ${amount.toLocaleString("ru-RU")} ₽`
                                  : `Каждые ${amount.toLocaleString("ru-RU")} ₽`}
                              </div>
                              {isGroupOverride && (
                                <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                                  {playerGroup?.name}
                                </span>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm font-black text-indigo-400">
                              +{rule.tickets}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex items-center justify-between p-3.5 text-gray-500">
                        <div className="text-xs sm:text-sm font-bold italic">
                          По основным тарифам
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="px-1">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
                История начислений
              </h3>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl divide-y divide-white/5 overflow-hidden">
              {history.length === 0 ? (
                <div className="p-12 text-center text-gray-500 text-xs font-bold uppercase tracking-widest italic">
                  Начислений еще не было
                </div>
              ) : (
                history.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 sm:p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-xs sm:text-sm text-white">
                        {item.source === "welcome_bonus"
                          ? "Бонус новичка"
                          : item.source === "pos_sale"
                            ? "Покупка в баре"
                            : item.source === "smartshell_tariff"
                              ? "Покупка пакета/тарифа"
                              : item.source === "admin_manual"
                                ? "Ручное начисление"
                                : item.source === "quest_reward" || item.source === "quest" || item.source === "quest_completion"
                                  ? "Награда за квест"
                                  : item.source === "referral" || item.source === "referral_bonus"
                                    ? "Реферальный бонус"
                                    : "Пополнение баланса"}
                      </div>
                      {item.source === "welcome_bonus" && (
                        <div className="text-[11px] text-emerald-400/80 font-medium">
                          Приветственный бонус при регистрации
                        </div>
                      )}
                      {item.source === "pos_sale" && (
                        <div className="text-[11px] text-indigo-300 font-medium line-clamp-1">
                          {item.bar_products || (item.topup_amount ? `Сумма чека: ${Number(item.topup_amount).toLocaleString()} ₽` : "Покупка в баре")}
                        </div>
                      )}
                      {item.source === "smartshell_tariff" && (
                        <div className="text-[11px] text-amber-300/90 font-medium line-clamp-1">
                          {item.tariff_name ? `Тариф: ${item.tariff_name}` : "Игровой пакет"}
                        </div>
                      )}
                      {(item.source === "smartshell_topup" || item.source === "topup" || (!["welcome_bonus", "pos_sale", "smartshell_tariff", "admin_manual", "quest", "quest_reward", "quest_completion", "referral", "referral_bonus"].includes(item.source))) && (
                        <div className="text-[11px] text-gray-400 font-medium">
                          {item.topup_amount
                            ? `Сумма: ${Number(item.topup_amount).toLocaleString()} ₽`
                            : "Пополнение через кассу"}
                          {item.payment_method && (
                            <span className="text-gray-500 font-normal ml-1.5">
                              • {item.payment_method === "CARD" ? "Карта" : item.payment_method === "CASH" ? "Наличные" : item.payment_method}
                            </span>
                          )}
                        </div>
                      )}
                      {item.source === "admin_manual" && (
                        <div className="text-[11px] text-gray-400 font-medium">
                          {item.detail_text || "Начислено администратором"}
                        </div>
                      )}
                      {(item.source === "quest_reward" || item.source === "quest" || item.source === "quest_completion") && (
                        <div className="text-[11px] text-purple-300 font-medium">
                          Квест: «{item.quest_title || item.detail_text || "Задание"}»
                        </div>
                      )}
                      {(item.source === "referral" || item.source === "referral_bonus") && (
                        <div className="text-[11px] text-yellow-300 font-medium">
                          {item.detail_text || "За приглашение друга"}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-500 font-medium">
                        {new Date(item.created_at).toLocaleDateString("ru-RU")} в{" "}
                        {new Date(item.created_at).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>

                    <div
                      className={`font-black text-base sm:text-lg shrink-0 ml-4 ${
                        item.source === "welcome_bonus"
                          ? "text-emerald-400"
                          : item.source === "pos_sale"
                            ? "text-indigo-400"
                            : item.source === "quest_reward" || item.source === "quest" || item.source === "quest_completion"
                              ? "text-purple-400"
                              : "text-amber-400"
                      }`}
                    >
                      +{item.count}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
