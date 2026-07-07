"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Gamepad2, Zap, Shield, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface FragTabProps {
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
}

export function FragTab({ settings, saveSettings }: FragTabProps) {
  if (!settings) return null;

  // Initialize state from settings or default values
  const fragConfig = settings.frag || {
    is_active: false,
    tariffs: {
      cs2_kill: 0.50,
      cs2_hs: 0.50,
      cs2_knife: 4.50,
      cs2_zeus: 2.50,
      cs2_assist: 0.25,
      cs2_mvp: 1.00,
      cs2_win: 10.00,
      dota_kill: 0.50,
      dota_assist: 0.25,
      dota_lasthit_10: 0.05,
      dota_denies_5: 0.05,
      dota_networth_1000: 0.10,
      dota_win: 10.00,
    },
  };

  const [isActive, setIsActive] = useState<boolean>(fragConfig.is_active);
  const [tariffs, setTariffs] = useState<any>({ ...fragConfig.tariffs });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleToggleActive = () => {
    setIsActive(!isActive);
  };

  const handleTariffChange = (key: string, val: string) => {
    const numericVal = parseFloat(val) || 0;
    setTariffs((prev: any) => ({
      ...prev,
      [key]: numericVal,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...settings,
        frag: {
          is_active: isActive,
          tariffs: tariffs,
        },
      };
      await saveSettings(updatedSettings);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      key="frag"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: General Control */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase italic">
                  Модуль <span className="text-indigo-500">Frag</span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                  Начисление за игровые успехи
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Интеграция с локальным игровым агентом. Когда гость играет на ПК в CS2 или Dota 2, его успехи (убийства, хэдшоты, победы) автоматически вознаграждаются реальными бонусами на промо-баланс.
            </p>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group">
              <div>
                <div className="font-black italic uppercase text-xs tracking-tight">
                  Статус интеграции
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                  Включить или выключить Frag
                </div>
              </div>
              <button
                onClick={handleToggleActive}
                className={cn(
                  "w-12 h-6 rounded-full relative transition-colors duration-300",
                  isActive ? "bg-emerald-500" : "bg-slate-300"
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                    isActive ? "left-7" : "left-1"
                  )}
                />
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black uppercase italic text-xs tracking-widest transition-all",
                "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10",
                "disabled:opacity-50"
              )}
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Сохранить настройки
            </button>
          </div>
        </div>

        {/* Right Columns: Game Tariffs */}
        <div className="md:col-span-2 space-y-8">
          
          {/* CS2 Tariffs Card */}
          <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-black uppercase italic">
                  Тарифы <span className="text-orange-500">Counter-Strike 2</span>
                </h4>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                  Награда за внутриигровые действия
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: "cs2_kill", label: "Обычное убийство (Frag)", suffix: "₽" },
                { key: "cs2_hs", label: "Убийство в голову (HS bonus)", suffix: "₽" },
                { key: "cs2_knife", label: "Убийство ножом (Knife bonus)", suffix: "₽" },
                { key: "cs2_zeus", label: "Убийство с Zeus/Taser (Zeus bonus)", suffix: "₽" },
                { key: "cs2_assist", label: "Ассист / Помощь (Assist)", suffix: "₽" },
                { key: "cs2_mvp", label: "Звезда MVP раунда (Round MVP)", suffix: "₽" },
                { key: "cs2_win", label: "Победа в матче (Match Win)", suffix: "₽" },
              ].map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">
                    {item.label}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tariffs[item.key] ?? 0}
                      onChange={(e) => handleTariffChange(item.key, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-orange-500 focus:bg-white transition-all pr-10"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                      {item.suffix}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dota 2 Tariffs Card */}
          <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-black uppercase italic">
                  Тарифы <span className="text-red-500">Dota 2</span>
                </h4>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                  Награда за внутриигровые действия
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: "dota_kill", label: "Убийство героя (Hero Kill)", suffix: "₽" },
                { key: "dota_assist", label: "Ассист в замесе (Hero Assist)", suffix: "₽" },
                { key: "dota_lasthit_10", label: "Каждые 10 добитых крипов (Last Hits)", suffix: "₽" },
                { key: "dota_denies_5", label: "Каждые 5 союзных крипов (Denies)", suffix: "₽" },
                { key: "dota_networth_1000", label: "Каждые 1000 золота (Networth)", suffix: "₽" },
                { key: "dota_win", label: "Победа в матче (Match Win)", suffix: "₽" },
              ].map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">
                    {item.label}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tariffs[item.key] ?? 0}
                      onChange={(e) => handleTariffChange(item.key, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-sm outline-none focus:border-red-500 focus:bg-white transition-all pr-10"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                      {item.suffix}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
