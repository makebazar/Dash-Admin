"use client";
import React from "react";
import { Loader2 } from "lucide-react";

interface RulesTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string | null;
  name: string;
  setName: (v: string) => void;
  discipline: string;
  setDiscipline: (v: string) => void;
  rules: string;
  setRules: (v: string) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

export function RulesTemplateModal({
  isOpen,
  onClose,
  templateId,
  name,
  setName,
  discipline,
  setDiscipline,
  rules,
  setRules,
  onSubmit,
  isSubmitting,
}: RulesTemplateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/70">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl space-y-6 text-slate-900">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900">
            {templateId ? "Редактировать" : "Создать"}{" "}
            <span className="text-orange-500">Шаблон</span>
          </h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-500">
              Название шаблона
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Стандарт CS2 5x5"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
            />
          </div>

          {!templateId && (
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-500">
                Дисциплина
              </label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none font-bold"
              >
                <option value="cs2">CS2</option>
                <option value="fifa">FIFA</option>
                <option value="ufc">UFC</option>
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-500">
              Текст правил регламента
            </label>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={8}
              placeholder="Введите правила..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl transition-colors shadow-lg shadow-orange-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Сохранить"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
