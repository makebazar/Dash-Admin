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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

interface ServicesTabProps {
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
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

export function ServicesTab({ settings, saveSettings }: ServicesTabProps) {
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [localRule, setLocalRule] = useState<any>(null);

  if (!settings) return null;

  const rules = settings.service_rules || [];

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
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
              <Disc className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase italic">
                Услуги и <span className="text-blue-500">пакеты</span>
              </h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                Настройте кнопки для ручного начисления билетов администратором
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
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => {
                      const isSelected = (localRule.days || []).includes(
                        day.id,
                      );
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            const current = localRule.days || [];
                            const next = isSelected
                              ? current.filter((id: number) => id !== day.id)
                              : [...current, day.id];
                            setLocalRule({ ...localRule, days: next });
                          }}
                          className={cn(
                            "w-10 h-10 rounded-xl text-[10px] font-black transition-all border shadow-sm",
                            isSelected
                              ? "bg-blue-500 border-blue-600 text-white"
                              : "bg-white border-slate-200 text-slate-600 hover:border-blue-500",
                          )}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleSaveLocal}
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-2xl font-bold uppercase italic text-xs tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                  >
                    <Save className="w-4 h-4" />
                    СОХРАНИТЬ ПРАВИЛО
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.length === 0 ? (
            <div className="md:col-span-2 text-center py-20 border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 font-bold uppercase italic text-sm">
              Список услуг пуст
            </div>
          ) : (
            rules.map((rule: any) => (
              <div
                key={rule.id}
                className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all duration-500"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                    <div className="text-blue-500 font-black italic text-lg">
                      +{rule.tickets}
                    </div>
                  </div>
                  <div>
                    <div className="font-black uppercase italic text-sm tracking-tight">
                      {rule.name}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      <div className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {rule.time_start}-
                        {rule.time_end}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" /> {rule.days.length}{" "}
                        дн.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditRule(rule)}
                    className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveRule(rule.id)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
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
