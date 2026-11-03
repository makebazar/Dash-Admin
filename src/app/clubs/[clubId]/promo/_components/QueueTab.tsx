"use client";

import React from "react";
import { motion } from "framer-motion";
import { Trophy, CheckCircle2, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type QueueItem = {
  id: string;
  player_name: string;
  player_phone: string;
  prize_name: string;
  prize_type: string;
  status: "pending" | "claimed" | "canceled";
  created_at: string;
  withdraw_amount?: string;
};

interface QueueTabProps {
  queue: QueueItem[];
  handleClaim: (id: string, customAmount?: number) => Promise<void>;
  handleCancel: (id: string) => Promise<void>;
}

export function QueueTab({ queue, handleClaim, handleCancel }: QueueTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Очередь выдачи
            </h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Призы и бонусы, ожидающие подтверждения администратора
            </p>
          </div>
        </div>

        <div>
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <p className="text-sm font-semibold text-slate-900">Очередь пуста</p>
              <p className="text-xs text-slate-500 mt-1">Все запросы на выдачу призов обработаны</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-base text-slate-900">
                        {item.player_name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          {item.player_phone}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(item.created_at).toLocaleString("ru-RU", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 sm:gap-6">
                    <div className="text-left md:text-right space-y-1">
                      <div className="flex items-center md:justify-end gap-2">
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider",
                            item.prize_type === "physical"
                              ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
                          )}
                        >
                          {item.prize_type === "physical" ? "Товар" : "Бонус"}
                        </span>
                      </div>
                      <div className="font-bold text-base text-slate-900">
                        {item.prize_name}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          const withdrawAmt = item.withdraw_amount ? parseFloat(item.withdraw_amount) : 0;
                          if (withdrawAmt > 0) {
                            const val = prompt(
                              `Введите сумму к выдаче (максимум ${withdrawAmt} ₽):`,
                              String(withdrawAmt)
                            );
                            if (val === null) return;
                            const parsed = parseFloat(val);
                            if (isNaN(parsed) || parsed < 0 || parsed > withdrawAmt) {
                              alert("Некорректная сумма");
                              return;
                            }
                            await handleClaim(item.id, parsed);
                          } else {
                            await handleClaim(item.id);
                          }
                        }}
                        className="h-10 sm:h-11 px-4 sm:px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center gap-2 font-medium text-xs sm:text-sm transition-all shadow-xs cursor-pointer active:scale-98"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Выдать</span>
                      </button>
                      <button
                        onClick={() => handleCancel(item.id)}
                        className="h-10 sm:h-11 w-10 sm:w-11 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-98"
                        title="Отклонить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
