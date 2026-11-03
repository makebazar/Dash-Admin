"use client";

import React from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Zap, Store } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccrualTabProps {
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
}

interface RuleListProps {
  title: string;
  icon: any;
  color: string;
  rulesKey: "accrual_rules" | "bar_accrual_rules";
  description: string;
  settings: any;
  handleAddRule: (key: "accrual_rules" | "bar_accrual_rules") => void;
  handleRemoveRule: (
    key: "accrual_rules" | "bar_accrual_rules",
    index: number,
  ) => void;
  handleUpdateRule: (
    key: "accrual_rules" | "bar_accrual_rules",
    index: number,
    updates: any,
  ) => void;
}

const RuleList = ({
  title,
  icon: Icon,
  color,
  rulesKey,
  description,
  settings,
  handleAddRule,
  handleRemoveRule,
  handleUpdateRule,
}: RuleListProps) => (
  <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-xs space-y-5">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          {title} правила
        </h3>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          {description}
        </p>
      </div>
      <button
        onClick={() => handleAddRule(rulesKey)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        Добавить
      </button>
    </div>

    <div className="space-y-3">
      {(settings[rulesKey] || []).length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-slate-400 font-medium text-xs">
          Правила не настроены
        </div>
      ) : (
        (settings[rulesKey] || []).map((rule: any, idx: number) => (
          <div
            key={idx}
            className="flex items-center gap-4 p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl transition-all"
          >
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Тип начисления
                  </label>
                  <select
                    value={rule.type || "step"}
                    onChange={(e) =>
                      handleUpdateRule(rulesKey, idx, { type: e.target.value })
                    }
                    className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs font-medium text-slate-800 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  >
                    <option value="step">За каждые ₽</option>
                    <option value="threshold">При сумме от ₽</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Сумма (₽)
                  </label>
                  <input
                    type="number"
                    value={rule.amount || 0}
                    onChange={(e) =>
                      handleUpdateRule(rulesKey, idx, {
                        amount: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs font-medium text-slate-800 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Билеты (шт)
                  </label>
                  <input
                    type="number"
                    value={rule.tickets || 0}
                    onChange={(e) =>
                      handleUpdateRule(rulesKey, idx, {
                        tickets: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs font-medium text-slate-800 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>
              </div>

              {/* Group overrides for sum threshold */}
              {settings.limit_groups && settings.limit_groups.length > 0 && (
                <div className="border-t border-slate-200 pt-2.5 space-y-2">
                  <div className="text-xs font-semibold text-slate-600">
                    Пороги для групп лимитов
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {settings.limit_groups.map((group: any) => (
                      <div key={group.id} className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-500 truncate block">
                          Сумма {group.name} (₽)
                        </label>
                        <input
                          type="number"
                          placeholder="Например, 300"
                          value={rule.group_amounts?.[group.id] ?? ""}
                          onChange={(e) => {
                            const groupAmounts = { ...(rule.group_amounts || {}) };
                            if (e.target.value.trim() === "") {
                              delete groupAmounts[group.id];
                            } else {
                              groupAmounts[group.id] = parseFloat(e.target.value) || 0;
                            }
                            handleUpdateRule(rulesKey, idx, { group_amounts: groupAmounts });
                          }}
                          className="w-full h-8 bg-white border border-slate-200 rounded-lg px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => handleRemoveRule(rulesKey, idx)}
              className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              title="Удалить правило"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      )}
    </div>
  </div>
);

export function AccrualTab({ settings, saveSettings }: AccrualTabProps) {
  if (!settings) return null;

  const handleAddRule = (key: "accrual_rules" | "bar_accrual_rules") => {
    const current = settings[key] || [];
    saveSettings({
      ...settings,
      [key]: [...current, { type: "step", amount: 1000, tickets: 1 }],
    });
  };

  const handleRemoveRule = (
    key: "accrual_rules" | "bar_accrual_rules",
    index: number,
  ) => {
    const current = settings[key] || [];
    saveSettings({
      ...settings,
      [key]: current.filter((_: any, i: number) => i !== index),
    });
  };

  const handleUpdateRule = (
    key: "accrual_rules" | "bar_accrual_rules",
    index: number,
    updates: any,
  ) => {
    const current = [...(settings[key] || [])];
    current[index] = { ...current[index], ...updates };
    saveSettings({ ...settings, [key]: current });
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <RuleList
        title="Пополнение"
        icon={Zap}
        color="orange"
        rulesKey="accrual_rules"
        description="Билеты за пополнение баланса через панель"
        settings={settings}
        handleAddRule={handleAddRule}
        handleRemoveRule={handleRemoveRule}
        handleUpdateRule={handleUpdateRule}
      />

      <RuleList
        title="Бар"
        icon={Store}
        color="emerald"
        rulesKey="bar_accrual_rules"
        description="Билеты за покупки товаров в барном модуле"
        settings={settings}
        handleAddRule={handleAddRule}
        handleRemoveRule={handleRemoveRule}
        handleUpdateRule={handleUpdateRule}
      />
    </div>
  );
}
