"use client";
import React from "react";
import { AlertTriangle, CheckCircle, Users } from "lucide-react";
import { Competitor } from "../types";

interface UnpaidPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  unpaidList: Competitor[];
  paidList: Competitor[];
  onConfirmAndStartAll: () => Promise<void>;
  onStartPaidOnly: () => Promise<void>;
}

export function UnpaidPromptModal({
  isOpen,
  onClose,
  unpaidList,
  paidList,
  onConfirmAndStartAll,
  onStartPaidOnly,
}: UnpaidPromptModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl space-y-6 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-xs">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900">
            Неоплаченные <span className="text-orange-500">Заявки</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            В турнире зарегистрировано участников без подтверждения оплаты:{" "}
            <span className="font-bold text-slate-800">
              {unpaidList.length}
            </span>
            . Выберите действие перед формированием турнирной сетки:
          </p>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
          {unpaidList.map((comp) => (
            <div
              key={comp.id}
              className="flex justify-between items-center text-xs font-bold p-2.5 bg-white rounded-xl border border-slate-200/50 shadow-xs"
            >
              <span className="truncate pr-2 text-slate-800">
                {comp.display_name}
              </span>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                Не оплачено
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={onConfirmAndStartAll}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              Подтвердить оплату всем ({unpaidList.length}) и запустить
            </span>
          </button>

          {paidList.length >= 2 ? (
            <button
              type="button"
              onClick={onStartPaidOnly}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4 text-slate-500" />
              <span>
                Запустить только с оплатившими ({paidList.length})
              </span>
            </button>
          ) : (
            <div className="text-[10px] text-center text-slate-400 font-bold uppercase py-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Оплативших участников меньше 2 ({paidList.length})
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-slate-400 hover:text-slate-800 text-[10px] font-black uppercase tracking-widest transition-colors py-2 cursor-pointer"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
