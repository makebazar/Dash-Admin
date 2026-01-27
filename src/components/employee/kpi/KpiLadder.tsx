"use client";

import { CheckCircle2, Trophy, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiLadderProps {
    kpi: any;
    formatCurrency: (amount: number) => string;
}

export function KpiLadder({ kpi, formatCurrency }: KpiLadderProps) {
    const levels = kpi.all_thresholds || [];

    return (
        <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 mb-6">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Путь к бонусам</h3>
            </div>

            <div className="relative space-y-0 px-2 lg:px-4">
                {/* Connector Line */}
                <div className="absolute left-[20px] lg:left-[28px] top-6 bottom-6 w-[2px] bg-slate-200 dark:bg-slate-800" />

                {levels.map((level: any, idx: number) => {
                    const isCurrent = (kpi.current_level || 0) === level.level;
                    const isCompleted = (kpi.current_level || 0) >= level.level;
                    const isNext = (kpi.current_level || 0) + 1 === level.level;

                    return (
                        <div
                            key={level.level}
                            className={cn(
                                "relative flex items-start gap-4 lg:gap-6 pb-8 last:pb-0 transition-all duration-300",
                                !isCompleted && !isNext && "opacity-40 grayscale-[0.5]"
                            )}
                        >
                            {/* Node Indicator */}
                            <div className="relative z-10 flex flex-col items-center">
                                <div className={cn(
                                    "flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full border-4 transition-all duration-500",
                                    isCompleted
                                        ? "bg-emerald-500 border-emerald-100 dark:border-emerald-900 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                        : isNext
                                            ? "bg-blue-600 border-blue-100 dark:border-blue-900 animate-pulse"
                                            : "bg-slate-100 dark:bg-slate-800 border-white dark:border-slate-950"
                                )}>
                                    {isCompleted ? (
                                        <CheckCircle2 className="w-5 h-5 text-white" />
                                    ) : level.level === levels.length ? (
                                        <Crown className={cn("w-5 h-5", isNext ? "text-white" : "text-slate-400")} />
                                    ) : (
                                        <span className={cn("text-xs font-black", isNext ? "text-white" : "text-slate-500")}>
                                            {level.level}
                                        </span>
                                    )}
                                </div>
                                {isNext && (
                                    <div className="absolute -inset-1 bg-blue-500/20 rounded-full blur animate-pulse" />
                                )}
                            </div>

                            {/* Content */}
                            <div className={cn(
                                "flex-1 p-4 rounded-xl border transition-all duration-300",
                                isCompleted
                                    ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-900/30"
                                    : isNext
                                        ? "bg-white dark:bg-slate-900 border-blue-400 shadow-lg shadow-blue-500/10 scale-[1.02]"
                                        : "bg-white/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                            )}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className={cn(
                                            "font-bold text-sm lg:text-base mb-1",
                                            isCurrent || isCompleted ? "text-emerald-700 dark:text-emerald-400" : isNext ? "text-blue-600 tracking-tight" : "text-slate-600 dark:text-slate-400"
                                        )}>
                                            Уровень {level.level} • {level.percent}%
                                        </h4>
                                        <div className="flex flex-col">
                                            <p className="text-[10px] lg:text-xs text-slate-800 dark:text-slate-200 font-bold tracking-wide">
                                                Порог: {formatCurrency(level.scaled_threshold)} {isCompleted && "✓"}
                                            </p>
                                            {level.scaled_threshold !== level.monthly_threshold && (
                                                <p className="text-[9px] text-slate-500 font-medium">
                                                    Цель месяца: {formatCurrency(level.monthly_threshold)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {isCompleted && (
                                        <div className="text-right">
                                            <p className="text-[10px] text-emerald-600 uppercase font-bold tracking-widest">Достигнуто</p>
                                        </div>
                                    )}

                                    {isNext && (
                                        <div className="text-right">
                                            <p className="text-[10px] text-blue-600 uppercase font-black tracking-widest animate-bounce">Текущая цель</p>
                                        </div>
                                    )}
                                </div>

                                {isNext && (
                                    <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/30">
                                        <p className="text-xs text-slate-600 dark:text-slate-400">
                                            Осталось <span className="font-bold text-blue-600">{formatCurrency(level.remaining_total)}</span>.
                                            Вам нужно выдавать в среднем <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(level.per_shift_to_reach)}</span> за смену.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
