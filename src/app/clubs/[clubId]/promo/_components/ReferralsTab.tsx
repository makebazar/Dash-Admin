"use client";

import React from "react";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReferralsTabProps {
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
}

export function ReferralsTab({ settings, saveSettings }: ReferralsTabProps) {
  if (!settings) return null;

  const referralSettings = settings.referral_settings || {
    enabled: true,
    threshold: 1000.0,
    fixed_reward_tickets: 5,
    fixed_reward_bonus: 0.0,
    recurring_percent: 10.0,
  };

  const updateSetting = (key: string, value: any) => {
    saveSettings({
      ...settings,
      referral_settings: {
        ...referralSettings,
        [key]: value,
      },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8 max-w-5xl"
    >
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/10">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase italic">
              Реферальная <span className="text-orange-500">система</span>
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
              Настройка программы «Пригласи друга» для вашего клуба
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group">
            <div>
              <div className="font-black italic uppercase text-xs tracking-tight">
                Реферальная программа активна
              </div>
              <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                Включает или полностью отключает реферальную систему и выплату вознаграждений
              </div>
            </div>
            <button
              onClick={() => updateSetting("enabled", referralSettings.enabled !== false ? false : true)}
              className={cn(
                "w-12 h-6 rounded-full relative transition-colors duration-300",
                referralSettings.enabled !== false
                  ? "bg-orange-500"
                  : "bg-slate-300",
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                  referralSettings.enabled !== false ? "left-7" : "left-1",
                )}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Threshold */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                Порог пополнений друга (₽)
              </label>
              <input
                type="number"
                value={referralSettings.threshold ?? 1000}
                onChange={(e) => updateSetting("threshold", parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
              />
              <p className="text-[9px] text-slate-400 font-medium px-4">
                Сумма пополнений друга, после которой выдается разовая награда
              </p>
            </div>

            {/* Recurring Percent */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                Постоянный процент от пополнений (%)
              </label>
              <input
                type="number"
                step="1"
                value={referralSettings.recurring_percent ?? 10}
                onChange={(e) => updateSetting("recurring_percent", parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
              />
              <p className="text-[9px] text-slate-400 font-medium px-4">
                Процент, начисляемый пригласившему в рублях на бонусный счет с каждого депозита друга
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fixed reward tickets */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                Разовая награда билетами (шт)
              </label>
              <input
                type="number"
                value={referralSettings.fixed_reward_tickets ?? 5}
                onChange={(e) => updateSetting("fixed_reward_tickets", parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
              />
              <p className="text-[9px] text-slate-400 font-medium px-4">
                Количество билетов в колесо фортуны за достижение порога
              </p>
            </div>

            {/* Fixed reward bonus */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                Разовая награда на бонусный баланс (₽)
              </label>
              <input
                type="number"
                value={referralSettings.fixed_reward_bonus ?? 0}
                onChange={(e) => updateSetting("fixed_reward_bonus", parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
              />
              <p className="text-[9px] text-slate-400 font-medium px-4">
                Сумма в рублях за достижение порога (начисляется на баланс)
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
