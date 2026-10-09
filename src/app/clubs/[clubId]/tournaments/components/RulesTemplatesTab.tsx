"use client";
import React from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { RulesTemplate } from "../types";

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
      <div className="flex justify-between items-center bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Всего шаблонов регламента: {templates.length}
        </span>
        <button
          onClick={onCreate}
          className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Создать шаблон
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((temp) => (
          <div
            key={temp.id}
            className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black bg-slate-100 text-slate-600 uppercase tracking-widest px-2.5 py-1 rounded">
                  {temp.discipline.toUpperCase()}
                </span>
              </div>
              <h3 className="text-md font-black uppercase text-slate-800 tracking-tight mb-2">
                {temp.name}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-4 leading-relaxed mb-6 whitespace-pre-wrap">
                {temp.rules_text}
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
              <button
                onClick={() => onEdit(temp)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 cursor-pointer"
                title="Редактировать"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(temp.id)}
                className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all border border-slate-100 cursor-pointer"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="col-span-full text-center py-20 text-slate-400 bg-white border border-slate-200/60 rounded-[2rem] text-sm">
            Шаблонов не найдено. Создайте свой первый шаблон!
          </div>
        )}
      </div>
    </div>
  );
}
