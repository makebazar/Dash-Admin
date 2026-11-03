"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Award,
  Plus,
  Trash2,
  Save,
  Loader2,
  Package,
  Layers,
  Clock,
  CheckCircle2,
  Sparkles,
  Ticket,
  Coins,
  Gift,
  Calendar,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

interface LoyaltyTabProps {
  clubId: string;
  tariffs?: any[];
  zones?: any[];
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
  isSmartShellEnabled?: boolean;
}

const LOYALTY_PROGRAM_TYPES = [
  {
    id: "package_accumulation",
    label: "Накопление пакетов",
    desc: "Купи N пакетов времени, получи подарок или бонус",
    icon: <Package className="w-5 h-5 text-amber-500" />,
  },
  {
    id: "visit_accumulation",
    label: "Накопление посещений",
    desc: "Приходи N раз в клуб (сессия ≥ 30 мин), получи награду",
    icon: <Calendar className="w-5 h-5 text-blue-500" />,
  },
  {
    id: "visit_streak",
    label: "Серия посещений (Стрик)",
    desc: "Посещай клуб N дней подряд без пропуска",
    icon: <Flame className="w-5 h-5 text-orange-500" />,
  },
];

export function LoyaltyTab({
  clubId,
  tariffs = [],
  zones = [],
  settings,
  saveSettings,
  isSmartShellEnabled = false,
}: LoyaltyTabProps) {
  const [localSettings, setLocalSettings] = useState<any>(settings || null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  if (!localSettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const getLoyaltyPrograms = (): any[] => {
    return localSettings?.loyalty_programs || [];
  };

  const updateProgram = (index: number, updates: any) => {
    const progs = [...getLoyaltyPrograms()];
    progs[index] = { ...progs[index], ...updates };
    setLocalSettings({ ...localSettings, loyalty_programs: progs });
  };

  const updateProgramRewards = (index: number, rewardUpdates: any) => {
    const progs = [...getLoyaltyPrograms()];
    progs[index] = {
      ...progs[index],
      rewards: {
        ...(progs[index]?.rewards || {}),
        ...rewardUpdates,
      },
    };
    setLocalSettings({ ...localSettings, loyalty_programs: progs });
  };

  const addProgram = () => {
    const newProg = {
      id: uuidv4(),
      type: "package_accumulation",
      title: "Купи 5 пакетов — 6-й в подарок",
      enabled: true,
      target: 5,
      target_zone_id: null,
      trigger_service_ids: [],
      rewards: {
        tickets: 0,
        bonus_balance: 0,
        free_package: true,
        free_package_name: "Бесплатный пакет",
        free_package_quantity: 1,
      },
    };
    const progs = [...getLoyaltyPrograms(), newProg];
    setLocalSettings({ ...localSettings, loyalty_programs: progs });
  };

  const removeProgram = (index: number) => {
    if (!confirm("Удалить эту программу лояльности?")) return;
    const progs = getLoyaltyPrograms().filter((_, i) => i !== index);
    setLocalSettings({ ...localSettings, loyalty_programs: progs });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await saveSettings(localSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Save Loyalty Error:", err);
      alert("Ошибка при сохранении настроек");
    } finally {
      setSaving(false);
    }
  };

  const smartshellTariffs = tariffs.filter((t) => t.source === "smartshell");

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Программа лояльности
            </h2>
            {isSmartShellEnabled && (
              <span className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                SmartShell Sync
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs font-normal mt-0.5">
            Накопление пакетов, бесплатные часы и вознаграждения за визиты
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center justify-center gap-2 h-10 sm:h-11 px-5 rounded-xl font-medium transition-all text-xs sm:text-sm shadow-xs active:scale-98 shrink-0 cursor-pointer",
            saveSuccess
              ? "bg-emerald-600 text-white"
              : "bg-slate-900 hover:bg-slate-800 text-white"
          )}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-white" />
          ) : (
            <Save className="w-4 h-4 text-white" />
          )}
          <span>{saveSuccess ? "Сохранено!" : "Сохранить настройки"}</span>
        </button>
      </div>

      {/* Programs List */}
      <div className="space-y-4">
        {getLoyaltyPrograms().length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Нет активных программ лояльности
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Создайте первую программу (например, «6-й ночной пакет в подарок» или «10-е посещение бесплатно»)
              </p>
            </div>
            <button
              type="button"
              onClick={addProgram}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить программу лояльности</span>
            </button>
          </div>
        ) : (
          getLoyaltyPrograms().map((prog: any, idx: number) => {
            const currentType = LOYALTY_PROGRAM_TYPES.find((t) => t.id === prog.type) || LOYALTY_PROGRAM_TYPES[0];

            return (
              <div
                key={prog.id || idx}
                className={cn(
                  "bg-white border rounded-2xl p-5 sm:p-6 shadow-xs transition-all space-y-5",
                  prog.enabled ? "border-slate-200" : "border-slate-200/60 opacity-60 bg-slate-50/50"
                )}
              >
                {/* Top Control Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <select
                        value={prog.type || "package_accumulation"}
                        onChange={(e) => updateProgram(idx, { type: e.target.value })}
                        className="font-bold text-base text-slate-900 bg-transparent border-none outline-none cursor-pointer hover:text-slate-700 transition-colors"
                      >
                        {LOYALTY_PROGRAM_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-slate-500 font-normal">{currentType.desc}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">
                        {prog.enabled ? "Включено" : "Отключено"}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateProgram(idx, { enabled: !prog.enabled })}
                        className={cn(
                          "w-11 h-6 rounded-full relative transition-colors duration-200 cursor-pointer",
                          prog.enabled ? "bg-slate-900" : "bg-slate-200"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow-xs",
                            prog.enabled ? "left-6" : "left-1"
                          )}
                        />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeProgram(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Удалить программу"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {prog.enabled && (
                  <div className="space-y-5">
                    {/* Goal, Title and Zone Selector */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">
                          {prog.type === "visit_streak"
                            ? "Дней подряд"
                            : prog.type === "visit_accumulation"
                            ? "Цель (посещений)"
                            : "Цель (пакетов)"}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={prog.target ?? 5}
                          onChange={(e) => updateProgram(idx, { target: parseInt(e.target.value) || 1 })}
                          className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Название программы
                        </label>
                        <input
                          type="text"
                          value={prog.title || ""}
                          onChange={(e) => updateProgram(idx, { title: e.target.value })}
                          placeholder="Напр. 6-я ночь в подарок"
                          className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                        />
                      </div>

                      {/* Zone Selector */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Зона зала
                        </label>
                        <select
                          value={prog.target_zone_id || ""}
                          onChange={(e) => updateProgram(idx, { target_zone_id: e.target.value || null })}
                          className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                        >
                          <option value="">-- Любая зона зала --</option>
                          {zones.map((z: any) => (
                            <option key={z.id} value={z.id}>
                              {z.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Filter by Specific Tariffs */}
                    {prog.type === "package_accumulation" && isSmartShellEnabled && smartshellTariffs.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                          Учитываемые пакеты времени (оставьте пустым — учитываются любые)
                        </label>
                        <div className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-4 space-y-2 max-w-xl">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-500" /> Пакеты SmartShell
                          </span>
                          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                            {smartshellTariffs.map((t: any) => {
                              const isChecked = (prog.trigger_service_ids || []).includes(String(t.id));
                              return (
                                <label
                                  key={t.id}
                                  className="flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200/60 hover:border-slate-300 cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      const ids = prog.trigger_service_ids || [];
                                      updateProgram(idx, {
                                        trigger_service_ids: isChecked
                                          ? ids.filter((id: string) => id !== String(t.id))
                                          : [...ids, String(t.id)],
                                      });
                                    }}
                                    className="accent-amber-500 w-4 h-4 rounded"
                                  />
                                  <div className="min-w-0 flex-1 flex items-center justify-between">
                                    <div className="text-xs font-bold text-slate-800 truncate">{t.name}</div>
                                    <span className="text-[9px] text-slate-400 font-mono">ID: {t.id}</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rewards Configuration */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">
                        Награды за выполнение цели
                      </label>

                      {/* Tickets & Rubles */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-blue-50/50 to-white border border-blue-100 rounded-2xl p-4 space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
                            <Ticket className="w-4 h-4 text-blue-500" /> Начислить билеты Promo
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={prog.rewards?.tickets || 0}
                            onChange={(e) => updateProgramRewards(idx, { tickets: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-white border border-blue-200 rounded-xl py-2 px-3 text-sm font-black outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="0"
                          />
                        </div>

                        <div className="bg-gradient-to-br from-emerald-50/50 to-white border border-emerald-100 rounded-2xl p-4 space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                            <Coins className="w-4 h-4 text-emerald-500" /> Бонусный баланс (₽)
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={prog.rewards?.bonus_balance || 0}
                            onChange={(e) => updateProgramRewards(idx, { bonus_balance: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-white border border-emerald-200 rounded-xl py-2 px-3 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-200"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {/* Free Package / Direct Session startup */}
                      <div className="bg-gradient-to-br from-amber-50/50 to-white border border-amber-100 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-700 flex items-center gap-2">
                            <Gift className="w-4 h-4 text-amber-500" /> Бесплатный пакет / сессия
                          </span>
                          <button
                            type="button"
                            onClick={() => updateProgramRewards(idx, { free_package: !prog.rewards?.free_package })}
                            className={cn(
                              "w-10 h-5 rounded-full relative transition-colors duration-200",
                              prog.rewards?.free_package ? "bg-amber-500" : "bg-slate-200"
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow-sm",
                                prog.rewards?.free_package ? "left-5" : "left-0.5"
                              )}
                            />
                          </button>
                        </div>

                        {prog.rewards?.free_package && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* SmartShell Tariff Selector or Free text input */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  {isSmartShellEnabled ? "Привязать тариф SmartShell" : "Название подарочного пакета"}
                                </label>
                                {isSmartShellEnabled && smartshellTariffs.length > 0 ? (
                                  <select
                                    value={prog.rewards?.free_package_tariff_id || ""}
                                    onChange={(e) => {
                                      const selectedTariffId = e.target.value;
                                      const matched = smartshellTariffs.find((t: any) => String(t.id) === String(selectedTariffId));
                                      const zoneObj = zones.find((z: any) => String(z.id) === String(prog.rewards?.free_package_zone_id));
                                      const zoneSuffix = zoneObj ? ` (${zoneObj.title})` : "";
                                      updateProgramRewards(idx, {
                                        free_package_tariff_id: selectedTariffId || null,
                                        free_package_name: matched ? `${matched.name}${zoneSuffix}` : (prog.rewards?.free_package_name || "Бесплатный пакет"),
                                      });
                                    }}
                                    className="w-full bg-white border border-amber-200 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200"
                                  >
                                    <option value="">-- Произвольный пакет (ручное название) --</option>
                                    {smartshellTariffs.map((t: any) => (
                                      <option key={t.id} value={t.id}>
                                        ⚡ {t.name} (ID: {t.id})
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={prog.rewards?.free_package_name || ""}
                                    onChange={(e) => {
                                      updateProgramRewards(idx, {
                                        free_package_name: e.target.value,
                                      });
                                    }}
                                    placeholder="Например: Пакет 3 часа"
                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-medium outline-none focus:ring-2 focus:ring-slate-300"
                                  />
                                )}
                              </div>

                              {/* Zone Selector for Free Package */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  Зона действия подарка
                                </label>
                                <select
                                  value={prog.rewards?.free_package_zone_id || ""}
                                  onChange={(e) => {
                                    const selectedZoneId = e.target.value;
                                    const zoneObj = zones.find((z: any) => String(z.id) === String(selectedZoneId));
                                    const baseName = prog.rewards?.free_package_name?.replace(/\s*\([^)]*\)$/, "") || "Бесплатный пакет";
                                    const zoneSuffix = zoneObj ? ` (${zoneObj.title})` : "";
                                    updateProgramRewards(idx, {
                                      free_package_zone_id: selectedZoneId || null,
                                      free_package_name: `${baseName}${zoneSuffix}`,
                                    });
                                  }}
                                  className="w-full bg-white border border-amber-200 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200"
                                >
                                  <option value="">-- Любая зона зала (по умолчанию) --</option>
                                  {zones.map((z: any) => (
                                    <option key={z.id} value={z.id}>
                                      {z.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  Название подарка (в профиле гостя)
                                </label>
                                <input
                                  type="text"
                                  value={prog.rewards?.free_package_name || ""}
                                  onChange={(e) => updateProgramRewards(idx, { free_package_name: e.target.value })}
                                  placeholder="Напр. 6-я ночь в подарок"
                                  className="w-full bg-white border border-amber-200 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  Количество купонов (шт.)
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={prog.rewards?.free_package_quantity ?? 1}
                                  onChange={(e) =>
                                    updateProgramRewards(idx, { free_package_quantity: parseInt(e.target.value) || 1 })
                                  }
                                  className="w-full bg-white border border-amber-200 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Add Program Button */}
        <button
          type="button"
          onClick={addProgram}
          className="w-full py-4 border border-dashed border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 rounded-2xl text-slate-600 hover:text-slate-900 transition-all font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Добавить программу лояльности
        </button>
      </div>
    </div>
  );
}
