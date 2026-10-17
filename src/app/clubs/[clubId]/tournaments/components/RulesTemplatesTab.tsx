"use client";
import React from "react";
import { Plus, Edit, Trash2, FileText } from "lucide-react";
import { RulesTemplate } from "../types";
import { Button } from "@/components/ui/button";

interface RulesTemplatesTabProps {
  templates: RulesTemplate[];
  onCreate: () => void;
  onEdit: (template: RulesTemplate) => void;
  onDelete: (templateId: string) => void;
}

export function RulesTemplatesTab({
  templates,
  onCreate,
  onEdit,
  onDelete,
}: RulesTemplatesTabProps) {
  return (
    <div className="space-y-6">
      {/* Top action toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs">
        <div>
          <span className="text-xs font-semibold text-slate-500">
            Всего шаблонов регламента: <strong className="text-slate-900">{templates.length}</strong>
          </span>
          <p className="text-xs text-slate-400 mt-0.5">
            Готовые правила турниров для быстрого выбора при создании
          </p>
        </div>
        <Button
          onClick={onCreate}
          className="h-10 sm:h-11 rounded-xl px-4 sm:px-5 bg-black text-white hover:bg-slate-800 font-medium transition-all shadow-sm flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Создать шаблон</span>
        </Button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {templates.map((temp) => (
          <div
            key={temp.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider px-2.5 py-0.5 rounded-md font-mono">
                  {temp.discipline.toUpperCase()}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
                {temp.name}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-4 leading-relaxed mb-6 whitespace-pre-wrap">
                {temp.rules_text}
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
              <Button
                variant="outline"
                size="icon"
                onClick={() => onEdit(temp)}
                className="h-9 w-9 rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
                title="Редактировать"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onDelete(temp.id)}
                className="h-9 w-9 rounded-xl border-rose-200 text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-all"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="col-span-full text-center py-16 px-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">Шаблонов пока нет</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Создайте регламент для дисциплин CS2, FIFA или UFC, чтобы переиспользовать его в турнирах.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

