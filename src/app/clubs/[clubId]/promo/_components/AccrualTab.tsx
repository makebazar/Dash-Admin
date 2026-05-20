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
  <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-900",
          )}
        >
          <Icon className={cn("w-6 h-6 text-white")} />
        </div>
        <div>
          <h3 className="text-xl font-black uppercase italic">
            {title}{" "}
            <span className={cn("text-" + color + "-500")}>правила</span>
          </h3>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
            {description}
          </p>
        </div>
      </div>
      <button
        onClick={() => handleAddRule(rulesKey)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl font-black uppercase italic text-[10px] tracking-widest transition-all",
          "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10",
        )}
      >
        <Plus className="w-3 h-3" />
        Добавить
      </button>
    </div>

    <div className="space-y-3">
      {(settings[rulesKey] || []).length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 font-bold uppercase italic text-xs">
          Правила не настроены
        </div>
      ) : (
        (settings[rulesKey] || []).map((rule: any, idx: number) => (
          <div
            key={idx}
            className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl group transition-all hover:bg-white hover:shadow-md"
          >
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-2">
                  Тип начисления
                </label>
                <select
                  value={rule.type || "step"}
                  onChange={(e) =>
                    handleUpdateRule(rulesKey, idx, { type: e.target.value })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs outline-none focus:border-orange-500"
                >
                  <option value="step">За каждые ₽</option>
                  <option value="threshold">При сумме от ₽</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-2">
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs outline-none focus:border-orange-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-2">
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-xs outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <button
              onClick={() => handleRemoveRule(rulesKey, idx)}
              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8 max-w-5xl"
    >
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
    </motion.div>
  );
}
