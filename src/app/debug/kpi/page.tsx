"use client";

import { cn } from "@/lib/utils";
import {
  Zap,
  Clock,
  Briefcase,
  AlertCircle,
  Wrench,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function DebugKPIPage() {
  const mockIndicators = {
    shift_earnings: 2500,
    kpi_bonus: 1150,
    total_hours: 12,
    hourly_rate: 208.33,
    maintenance: {
      total: 15,
      completed: 12,
      pending: 3,
      efficiency: 80,
      bonus_per_task: 50,
      total_bonus: 600,
      details: [
        { name: "Чистка ПК (Zone A)", status: "DONE", reward: 100 },
        { name: "Замена термопасты", status: "DONE", reward: 200 },
        { name: "Проверка девайсов", status: "PENDING", reward: 0 },
      ],
    },
    breakdown: {
      base: 2500,
      bonuses: [
        { name: "Выручка клуба (5%)", amount: 550, detail: "Факт: 11,000" },
        {
          name: "KPI Обслуживания",
          amount: 600,
          detail: "12 из 15 задач выполнено",
        },
      ],
      deductions: [
        { name: "Сэндвич с курицей", amount: 280, time: "14:20" },
        { name: "Coca-Cola 0.5", amount: 120, time: "14:22" },
      ],
      total_earned: 3650,
      total_deducted: 400,
      final_payout: 3250,
    },
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6 md:p-12 font-sans selection:bg-emerald-500/30">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="space-y-4 border-b border-zinc-900 pb-8">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white leading-none">
            Ваш <span className="text-emerald-500">Доход</span>
          </h1>
          <div className="flex items-center gap-6">
            <div className="text-3xl font-black text-white italic tabular-nums">
              {mockIndicators.breakdown.final_payout.toLocaleString()} ₽
            </div>
            <div className="h-4 w-px bg-zinc-800" />
            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Итого к выплате
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Earnings & Maintenance Status */}
          <div className="space-y-10">
            {/* 01. Financials */}
            <section className="space-y-6">
              <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3">
                <span className="text-emerald-500">01</span> Начисления
              </h2>
              <div className="space-y-1">
                <div className="p-6 bg-zinc-900/50 rounded-3xl border border-zinc-800">
                  <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                    Ставка за смену
                  </div>
                  <div className="text-2xl font-black text-white italic">
                    {mockIndicators.shift_earnings} ₽
                  </div>
                  <div className="text-[9px] font-medium text-zinc-600 uppercase tracking-tighter">
                    {mockIndicators.total_hours}ч × {mockIndicators.hourly_rate}
                    ₽
                  </div>
                </div>
                <div className="space-y-1 pt-4">
                  {mockIndicators.breakdown.bonuses.map((bonus, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-5 bg-zinc-950 border border-zinc-900 rounded-2xl"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-black text-white uppercase italic tracking-tight">
                          {bonus.name}
                        </div>
                        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                          {bonus.detail}
                        </div>
                      </div>
                      <div className="text-sm font-black text-emerald-500 italic">
                        +{bonus.amount} ₽
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 03. Maintenance (NEW) */}
            <section className="space-y-6">
              <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3">
                <span className="text-amber-500">03</span> Обслуживание
              </h2>
              <div className="bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wrench className="h-5 w-5 text-amber-500" />
                      <span className="text-xs font-black text-white uppercase italic tracking-tight">
                        Задачи по ТХ
                      </span>
                    </div>
                    <div className="text-xs font-black text-zinc-500 tabular-nums">
                      {mockIndicators.maintenance.completed} /{" "}
                      {mockIndicators.maintenance.total}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{
                        width: `${mockIndicators.maintenance.efficiency}%`,
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    {mockIndicators.maintenance.details.map((task, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center text-[10px]"
                      >
                        <div className="flex items-center gap-3">
                          {task.status === "DONE" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Clock className="h-3 w-3 text-zinc-700" />
                          )}
                          <span
                            className={cn(
                              "uppercase font-medium",
                              task.status === "DONE"
                                ? "text-zinc-300"
                                : "text-zinc-600",
                            )}
                          >
                            {task.name}
                          </span>
                        </div>
                        {task.reward > 0 && (
                          <span className="text-emerald-500 font-bold tabular-nums">
                            +{task.reward} ₽
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {mockIndicators.maintenance.pending > 0 && (
                  <div className="px-6 py-4 bg-amber-500/5 border-t border-zinc-900 flex items-center gap-3">
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">
                      Осталось {mockIndicators.maintenance.pending}{" "}
                      невыполненных задач
                    </span>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Deductions & Summary */}
          <div className="space-y-10">
            {/* 02. Deductions */}
            <section className="space-y-6">
              <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3">
                <span className="text-rose-500">02</span> Удержания
              </h2>
              <div className="bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 space-y-4">
                  <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-zinc-900 pb-2 flex justify-between">
                    <span>Покупки в баре</span>
                    <span>Сумма</span>
                  </div>
                  <div className="space-y-3">
                    {mockIndicators.breakdown.deductions.map((d, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center text-[10px]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-700 font-mono">
                            {d.time}
                          </span>
                          <span className="text-zinc-400 uppercase font-medium">
                            {d.name}
                          </span>
                        </div>
                        <span className="text-rose-500 font-black italic">
                          -{d.amount} ₽
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-zinc-900/30 border-t border-zinc-900 flex justify-between items-center text-rose-500">
                  <div className="text-[10px] font-black uppercase tracking-widest">
                    Всего вычтено
                  </div>
                  <div className="text-lg font-black italic">
                    -{mockIndicators.breakdown.total_deducted} ₽
                  </div>
                </div>
              </div>
            </section>

            {/* Final Confirmation */}
            <section className="pt-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
                <div className="space-y-1 text-center md:text-left">
                  <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-2">
                    Чистая прибыль за смену
                  </div>
                  <div className="text-5xl font-black text-white italic tracking-tighter tabular-nums">
                    {mockIndicators.breakdown.final_payout.toLocaleString()} ₽
                  </div>
                </div>
                <button className="w-full h-16 rounded-2xl bg-white text-black font-black uppercase italic tracking-tighter hover:bg-zinc-200 active:scale-95 transition-all text-base shadow-xl">
                  Завершить смену
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
