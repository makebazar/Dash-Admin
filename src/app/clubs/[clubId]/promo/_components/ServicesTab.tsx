"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Disc,
  Clock,
  Calendar,
  Edit2,
  X,
  Save,
  Zap,
  CheckCircle2,
  Ticket,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

interface ServicesTabProps {
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
  tariffs?: any[];
  zones?: Array<{ id: string | number; title: string }>;
}

const DAYS = [
  { id: 1, label: "Пн" },
  { id: 2, label: "Вт" },
  { id: 3, label: "Ср" },
  { id: 4, label: "Чт" },
  { id: 5, label: "Пт" },
  { id: 6, label: "Сб" },
  { id: 0, label: "Вс" },
];

export function ServicesTab({
  settings,
  saveSettings,
  tariffs = [],
  zones = [],
}: ServicesTabProps) {
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [localRule, setLocalRule] = useState<any>(null);
  const [isSavingTariffs, setIsSavingTariffs] = useState(false);
  const [expandedZoneTariffs, setExpandedZoneTariffs] = useState<Record<string, boolean>>({});

  if (!settings) return null;

  const rules = settings.service_rules || [];
  const tariffTicketRules: Record<string, any> = settings.tariff_ticket_rules || {};
  const smartshellTariffs = tariffs.filter((t) => t.source === "smartshell");

  const toggleZoneExpand = (tariffId: string | number) => {
    setExpandedZoneTariffs((prev) => ({
      ...prev,
      [String(tariffId)]: !prev[String(tariffId)],
    }));
  };

  const getTariffTickets = (tariffId: string | number, zoneId?: string | number): number => {
    const key = String(tariffId);
    const rule = tariffTicketRules[key];
    if (zoneId !== undefined && zoneId !== null) {
      const zoneKey = `${key}_zone_${zoneId}`;
      if (tariffTicketRules[zoneKey] !== undefined) {
        return Number(tariffTicketRules[zoneKey]) || 0;
      }
      if (typeof rule === "object" && rule?.zones?.[String(zoneId)] !== undefined) {
        return Number(rule.zones[String(zoneId)]) || 0;
      }
    }
    if (typeof rule === "number") return rule;
    if (typeof rule === "object" && rule?.base !== undefined) return Number(rule.base) || 0;
    return 0;
  };

  const handleTariffTicketChange = async (
    tariffId: string | number,
    value: number,
    zoneId?: string | number
  ) => {
    const nextValue = Math.max(0, Math.floor(value));
    const key = String(tariffId);

    let nextRules = { ...tariffTicketRules };

    if (zoneId !== undefined && zoneId !== null) {
      const zoneKey = `${key}_zone_${zoneId}`;
      nextRules[zoneKey] = nextValue;
    } else {
      nextRules[key] = nextValue;
    }

    setIsSavingTariffs(true);
    try {
      await saveSettings({
        ...settings,
        tariff_ticket_rules: nextRules,
      });
    } finally {
      setIsSavingTariffs(false);
    }
  };

  const handleAddRule = () => {
    const newRule = {
      id: uuidv4(),
      name: "Новая услуга",
      tickets: 1,
      days: [1, 2, 3, 4, 5, 6, 0],
      time_start: "00:00",
      time_end: "23:59",
    };
    setLocalRule(newRule);
    setEditingRuleId(newRule.id);
  };

  const handleEditRule = (rule: any) => {
    setLocalRule({ ...rule });
    setEditingRuleId(rule.id);
  };

  const handleSaveLocal = () => {
    let nextRules;
    if (rules.find((r: any) => r.id === localRule.id)) {
      nextRules = rules.map((r: any) =>
        r.id === localRule.id ? localRule : r,
      );
    } else {
      nextRules = [...rules, localRule];
    }
    saveSettings({ ...settings, service_rules: nextRules });
    setEditingRuleId(null);
    setLocalRule(null);
  };

  const handleRemoveRule = (id: string) => {
    if (!confirm("Удалить это правило?")) return;
    saveSettings({
      ...settings,
      service_rules: rules.filter((r: any) => r.id !== id),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8 max-w-5xl"
    >
      {/* SmartShell Synced Tariffs Section with Zone Controls */}
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black uppercase italic">
                  Начисление билетов за <span className="text-amber-500">пакеты SmartShell</span>
                </h3>
                <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Синхронизировано
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                Укажите сколько билетов Promo получит гость автоматически при покупке каждого пакета (с поддержкой зон)
              </p>
            </div>
          </div>
        </div>

        {smartshellTariffs.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
            <p className="text-sm font-bold text-slate-500">
              Тарифы загружаются из SmartShell...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {smartshellTariffs.map((t) => {
              const hours = t.duration ? Math.round(t.duration / 3600) : null;
              const baseTickets = getTariffTickets(t.id);
              const isExpanded = !!expandedZoneTariffs[String(t.id)];

              return (
                <div
                  key={t.id}
                  className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition-all space-y-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">ID: {t.id}</span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {hours ? `${hours} ч.` : `${t.duration || 0} сек.`}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">
                      {t.name}
                    </h4>
                  </div>

                  {/* Base Tickets Input */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-amber-500" />
                        Базово билетов:
                      </label>
                      {zones.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleZoneExpand(t.id)}
                          className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md transition-colors"
                        >
                          <Layers className="w-3 h-3" />
                          {isExpanded ? "Скрыть зоны" : "По зонам"}
                          {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTariffTicketChange(t.id, baseTickets - 1)}
                        disabled={baseTickets <= 0 || isSavingTariffs}
                        className="w-8 h-8 rounded-xl bg-slate-200/80 hover:bg-slate-300 disabled:opacity-30 font-black text-sm flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={baseTickets}
                        onChange={(e) => handleTariffTicketChange(t.id, parseInt(e.target.value) || 0)}
                        className="flex-1 bg-white border border-slate-200 rounded-xl py-1.5 text-center font-black text-sm text-slate-800 outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleTariffTicketChange(t.id, baseTickets + 1)}
                        disabled={isSavingTariffs}
                        className="w-8 h-8 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm flex items-center justify-center transition-colors shadow-sm"
                      >
                        +
                      </button>
                    </div>

                    {/* Zone-Specific Overrides (if expanded) */}
                    {isExpanded && zones.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2.5 bg-blue-50/40 p-3 rounded-xl">
                        <div className="text-[9px] font-black uppercase tracking-wider text-blue-700">
                          Настройка билетов по зонам:
                        </div>
                        {zones.map((z) => {
                          const zoneTickets = getTariffTickets(t.id, z.id);
                          return (
                            <div key={z.id} className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">
                                {z.title}:
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleTariffTicketChange(t.id, zoneTickets - 1, z.id)}
                                  disabled={zoneTickets <= 0 || isSavingTariffs}
                                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold text-xs flex items-center justify-center"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={zoneTickets}
                                  onChange={(e) => handleTariffTicketChange(t.id, parseInt(e.target.value) || 0, z.id)}
                                  className="w-12 bg-white border border-slate-200 rounded-lg py-0.5 text-center font-bold text-xs outline-none focus:border-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleTariffTicketChange(t.id, zoneTickets + 1, z.id)}
                                  disabled={isSavingTariffs}
                                  className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {baseTickets > 0 ? (
                      <p className="text-[9px] font-bold text-emerald-600 text-center">
                        ✓ Автоматически выдаётся +{baseTickets} 🎟️
                      </p>
                    ) : (
                      <p className="text-[9px] font-medium text-slate-400 text-center">
                        Билеты не начисляются (0)
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Cashier Buttons */}
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
              <Disc className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase italic">
                Кнопки начисления <span className="text-blue-500">на кассе</span>
              </h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                Дополнительные кнопки для ручной выдачи билетов администратором
              </p>
            </div>
          </div>
          <button
            onClick={handleAddRule}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold transition-all text-sm shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            ДОБАВИТЬ КНОПКУ
          </button>
        </div>

        {editingRuleId && localRule && (
          <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-lg uppercase italic">
                {rules.find((r: any) => r.id === localRule.id)
                  ? "Редактирование"
                  : "Новое правило"}
              </h4>
              <button
                onClick={() => {
                  setEditingRuleId(null);
                  setLocalRule(null);
                }}
                className="p-2 hover:bg-slate-200 rounded-full"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Название кнопки
                  </label>
                  <input
                    type="text"
                    value={localRule.name}
                    onChange={(e) =>
                      setLocalRule({ ...localRule, name: e.target.value })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-blue-500"
                    placeholder="Напр. Пакет 3 часа"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Количество билетов
                  </label>
                  <input
                    type="number"
                    value={localRule.tickets}
                    onChange={(e) =>
                      setLocalRule({
                        ...localRule,
                        tickets: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Начало действия
                    </label>
                    <input
                      type="time"
                      value={localRule.time_start}
                      onChange={(e) =>
                        setLocalRule({
                          ...localRule,
                          time_start: e.target.value,
                        })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Конец действия
                    </label>
                    <input
                      type="time"
                      value={localRule.time_end}
                      onChange={(e) =>
                        setLocalRule({ ...localRule, time_end: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Дни недели
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS.map((day) => {
                      const active = (localRule.days || []).includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            const curDays = localRule.days || [];
                            const next = active
                              ? curDays.filter((d: number) => d !== day.id)
                              : [...curDays, day.id];
                            setLocalRule({ ...localRule, days: next });
                          }}
                          className={cn(
                            "py-2 rounded-xl font-black text-xs transition-all",
                            active
                              ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                              : "bg-white border border-slate-200 text-slate-400 hover:border-slate-300",
                          )}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setEditingRuleId(null);
                  setLocalRule(null);
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 transition-colors"
              >
                ОТМЕНА
              </button>
              <button
                onClick={handleSaveLocal}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all"
              >
                <Save className="w-4 h-4" />
                СОХРАНИТЬ
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rules.length === 0 ? (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl">
              <p className="text-sm font-bold text-slate-400">
                Нет добавленных ручных кнопок на кассе
              </p>
            </div>
          ) : (
            rules.map((rule: any) => (
              <div
                key={rule.id}
                className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-4 relative group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-black text-lg uppercase tracking-tight">
                      {rule.name}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">ID: {rule.id}</span>
                  </div>
                  <span className="text-xl font-black text-blue-500">
                    +{rule.tickets} 🎟️
                  </span>
                </div>

                <div className="space-y-2 text-xs font-bold text-slate-500">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>
                      {rule.time_start || "00:00"} - {rule.time_end || "23:59"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div className="flex gap-1">
                      {DAYS.map((d) => {
                        const active = (rule.days || []).includes(d.id);
                        return (
                          <span
                            key={d.id}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded",
                              active
                                ? "bg-blue-100 text-blue-600"
                                : "text-slate-300",
                            )}
                          >
                            {d.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200/60 flex justify-end gap-2">
                  <button
                    onClick={() => handleEditRule(rule)}
                    className="p-2 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveRule(rule.id)}
                    className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
