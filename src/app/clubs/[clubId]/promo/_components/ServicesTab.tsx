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
  isSmartShellEnabled?: boolean;
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
  isSmartShellEnabled = false,
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
    <div className="space-y-6">
      {/* SmartShell Synced Tariffs Section with Zone Controls */}
      {isSmartShellEnabled && (
        <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Начисление билетов за пакеты SmartShell
                </h3>
                <span className="bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-emerald-200/60">
                  Синхронизировано
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Количество билетов Promo, получаемых гостем при покупке пакета (с поддержкой зон)
              </p>
            </div>
          </div>

          {smartshellTariffs.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <p className="text-sm font-semibold text-slate-600">
                Тарифы SmartShell еще не загружены
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Нажмите «Синхронизация со SmartShell» вверху страницы для получения тарифов клуба.
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {smartshellTariffs.map((t) => {
              const hours = t.duration ? Math.round(t.duration / 3600) : null;
              const baseTickets = getTariffTickets(t.id);
              const isExpanded = !!expandedZoneTariffs[String(t.id)];

              return (
                <div
                  key={t.id}
                  className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">ID: {t.id}</span>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {hours ? `${hours} ч.` : `${t.duration || 0} сек.`}
                      </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                      {t.name}
                    </h4>
                  </div>

                  {/* Base Tickets Input */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-slate-700" />
                        Базово билетов:
                      </label>
                      {zones.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleZoneExpand(t.id)}
                          className="text-[11px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
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
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 font-bold text-sm flex items-center justify-center transition-colors cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={baseTickets}
                        onChange={(e) => handleTariffTicketChange(t.id, parseInt(e.target.value) || 0)}
                        className="flex-1 h-8 bg-white border border-slate-200 rounded-lg py-1 text-center font-bold text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => handleTariffTicketChange(t.id, baseTickets + 1)}
                        disabled={isSavingTariffs}
                        className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    {/* Zone-Specific Overrides (if expanded) */}
                    {isExpanded && zones.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 bg-slate-50/70 p-3 rounded-xl">
                        <div className="text-[11px] font-semibold text-slate-600">
                          Настройка билетов по зонам:
                        </div>
                        {zones.map((z) => {
                          const zoneTickets = getTariffTickets(t.id, z.id);
                          return (
                            <div key={z.id} className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">
                                {z.title}:
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleTariffTicketChange(t.id, zoneTickets - 1, z.id)}
                                  disabled={zoneTickets <= 0 || isSavingTariffs}
                                  className="w-6 h-6 rounded-md bg-white border border-slate-200 hover:bg-slate-100 font-bold text-xs flex items-center justify-center cursor-pointer"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={zoneTickets}
                                  onChange={(e) => handleTariffTicketChange(t.id, parseInt(e.target.value) || 0, z.id)}
                                  className="w-12 h-6 bg-white border border-slate-200 rounded-md text-center font-semibold text-xs outline-none focus:border-slate-900"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleTariffTicketChange(t.id, zoneTickets + 1, z.id)}
                                  disabled={isSavingTariffs}
                                  className="w-6 h-6 rounded-md bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer"
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
                      <p className="text-[11px] font-medium text-emerald-600 text-center">
                        ✓ Автоматически выдаётся +{baseTickets} 🎟️
                      </p>
                    ) : (
                      <p className="text-[11px] font-normal text-slate-400 text-center">
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
      )}

      {/* Manual Cashier Buttons */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Кнопки начисления на кассе
            </h3>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Дополнительные кнопки для ручной выдачи билетов администратором
            </p>
          </div>
          <button
            onClick={handleAddRule}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-medium transition-all text-xs sm:text-sm shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Добавить кнопку
          </button>
        </div>

        {editingRuleId && localRule && (
          <div className="bg-slate-50/70 border border-slate-200/80 p-5 rounded-xl space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm sm:text-base text-slate-900">
                {rules.find((r: any) => r.id === localRule.id)
                  ? "Редактирование кнопки"
                  : "Новая кнопка"}
              </h4>
              <button
                onClick={() => {
                  setEditingRuleId(null);
                  setLocalRule(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Название кнопки
                  </label>
                  <input
                    type="text"
                    value={localRule.name}
                    onChange={(e) =>
                      setLocalRule({ ...localRule, name: e.target.value })
                    }
                    className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 font-medium text-xs text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                    placeholder="Напр. Пакет 3 часа"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
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
                    className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 font-medium text-xs text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
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
                      className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 font-medium text-xs text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Конец действия
                    </label>
                    <input
                      type="time"
                      value={localRule.time_end}
                      onChange={(e) =>
                        setLocalRule({ ...localRule, time_end: e.target.value })
                      }
                      className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 font-medium text-xs text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> Дни недели
                </label>
                <div className="grid grid-cols-7 gap-1.5">
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
                          "py-2 rounded-lg font-medium text-xs transition-all cursor-pointer",
                          active
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300",
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => {
                  setEditingRuleId(null);
                  setLocalRule(null);
                }}
                className="px-4 py-2 rounded-xl font-medium text-xs text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveLocal}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-medium text-xs shadow-xs transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Сохранить
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.length === 0 ? (
            <div className="col-span-full py-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-medium">
              Нет добавленных ручных кнопок на кассе
            </div>
          ) : (
            rules.map((rule: any) => (
              <div
                key={rule.id}
                className="bg-white border border-slate-200 p-4 sm:p-5 rounded-xl shadow-xs space-y-3 relative hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-slate-900 tracking-tight">
                      {rule.name}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">ID: {rule.id}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                    +{rule.tickets} 🎟️
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-normal text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {rule.time_start || "00:00"} - {rule.time_end || "23:59"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <div className="flex gap-1">
                      {DAYS.map((d) => {
                        const active = (rule.days || []).includes(d.id);
                        return (
                          <span
                            key={d.id}
                            className={cn(
                              "text-[10px] px-1 py-0.2 rounded font-medium",
                              active
                                ? "bg-slate-900 text-white"
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

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-1.5">
                  <button
                    onClick={() => handleEditRule(rule)}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                    title="Редактировать"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemoveRule(rule.id)}
                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                    title="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
