"use client";
import React from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  availableDisciplines?: Array<{ key: string; name: string }>;
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
  availableDisciplines,
}: RulesTemplateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in-0">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 text-slate-900 animate-in zoom-in-95">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {templateId ? "Редактировать шаблон" : "Создать шаблон регламента"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Шаблон можно применить к любому новому турниру
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Название шаблона
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Стандарт CS2 5x5"
              className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>

          {!templateId && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Дисциплина
              </label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium transition-all"
              >
                {availableDisciplines && availableDisciplines.length > 0 ? (
                  availableDisciplines.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="cs2">Counter-Strike 2 (CS2)</option>
                    <option value="dota2">Dota 2</option>
                    <option value="fifa">EA Sports FC / FIFA</option>
                    <option value="ufc">UFC</option>
                  </>
                )}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Текст правил регламента
            </label>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={7}
              placeholder="Введите правила и ограничения турнира..."
              className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 sm:h-11 rounded-xl px-4 sm:px-5 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-all cursor-pointer"
          >
            Отмена
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || !name.trim()}
            className="h-10 sm:h-11 rounded-xl px-5 sm:px-6 bg-black text-white hover:bg-slate-800 font-medium transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            <span>Сохранить</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

