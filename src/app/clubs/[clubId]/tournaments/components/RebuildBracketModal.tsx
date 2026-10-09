"use client";
import React from "react";
import { RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Competitor } from "../types";

interface RebuildBracketModalProps {
  isOpen: boolean;
  onClose: () => void;
  bracketType: "single_elimination" | "double_elimination" | "round_robin";
  setBracketType: (
    v: "single_elimination" | "double_elimination" | "round_robin"
  ) => void;
  includeUnpaid: boolean;
  setIncludeUnpaid: (v: boolean) => void;
  onRebuild: () => Promise<void>;
  isRebuilding: boolean;
  competitors: Competitor[];
}

export function RebuildBracketModal({
  isOpen,
  onClose,
  bracketType,
  setBracketType,
  includeUnpaid,
  setIncludeUnpaid,
  onRebuild,
  isRebuilding,
  competitors,
}: RebuildBracketModalProps) {
  if (!isOpen) return null;

  const unpaidCount = competitors.filter(
    (c) => c.payment_status === "PENDING_PAYMENT"
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl space-y-6 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center mx-auto text-orange-600 shadow-xs">
            <RefreshCw className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900">
            Пересобрать <span className="text-orange-500">Сетку Турнира</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Все текущие матчи и промежуточные счета будут сброшены. Новая сетка
            сформируется заново для всех подтвержденных участников.
          </p>
        </div>

        {/* Warning banner */}
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-900 font-medium leading-tight">
            <span className="font-bold block">
              Внимание: результаты текущих матчей будут удалены.
            </span>
            Посев участников в первом раунде будет перемешан заново.
          </div>
        </div>

        {/* Format choice */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
            Формат сетки
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "single_elimination", name: "Олимпийская" },
              { id: "double_elimination", name: "С нижней" },
              { id: "round_robin", name: "Группы" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setBracketType(item.id as any)}
                className={cn(
                  "py-3 px-2 rounded-2xl border font-bold text-[10px] uppercase tracking-wider transition-all text-center cursor-pointer",
                  bracketType === item.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* If there are unpaid participants */}
        {unpaidCount > 0 && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeUnpaid}
                onChange={(e) => setIncludeUnpaid(e.target.checked)}
                className="accent-orange-500 w-4 h-4 rounded"
              />
              <span className="text-xs text-slate-700 font-bold">
                Включить также неоплаченные заявки ({unpaidCount})
              </span>
            </label>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onRebuild}
            disabled={isRebuilding}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isRebuilding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Пересобрать сетку сейчас</span>
              </>
            )}
          </button>
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
