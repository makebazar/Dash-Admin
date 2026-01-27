"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, Zap } from "lucide-react";

interface TargetCoachProps {
    kpi: any;
    formatCurrency: (amount: number) => string;
}

export function TargetCoach({ kpi, formatCurrency }: TargetCoachProps) {
    const nextThreshold = kpi.all_thresholds?.find((t: any) => !t.is_met);

    if (!nextThreshold) {
        return (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap className="w-24 h-24 rotate-12" />
                </div>
                <CardContent className="p-6 relative z-10 text-center">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-white/20 mb-4 scale-110 shadow-inner group-hover:scale-125 transition-transform duration-500">
                        <Zap className="h-8 w-8 text-yellow-300 fill-yellow-300" />
                    </div>
                    <h2 className="text-2xl font-black mb-1 uppercase tracking-tighter">Максимальный уровень!</h2>
                    <p className="text-emerald-100 font-medium opacity-90">Вперед за новыми рекордами. Работаем на максимум!</p>
                </CardContent>
            </Card>
        );
    }

    const perShift = nextThreshold.per_shift_to_reach;

    return (
        <Card className="border-0 shadow-2xl bg-slate-900 overflow-hidden relative group">
            {/* Animated background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-blue-600/20 to-transparent opacity-50 transition-opacity group-hover:opacity-70 duration-700" />
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />

            <CardContent className="p-8 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/30">
                                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Следующая цель</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                                <Target className="w-3 h-3" />
                                <span>Уровень {nextThreshold.level}</span>
                            </div>
                        </div>

                        <h2 className="text-3xl font-black text-white tracking-tight leading-none">
                            Нужно <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">{formatCurrency(nextThreshold.per_shift_to_reach)}</span> <span className="text-slate-400 text-lg font-bold">/ смену</span>
                        </h2>
                        <p className="text-slate-400 text-sm max-w-md font-medium">
                            До конца месяца {kpi.remaining_shifts} смен. Держи этот темп, чтобы забрать бонус <span className="text-slate-200 font-bold">{nextThreshold.percent}%</span>
                        </p>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 w-full md:w-auto shadow-xl">
                            <div className="flex items-center justify-between md:justify-end gap-6">
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Потенциальный бонус</p>
                                    <p className="text-2xl font-black text-emerald-400">+{formatCurrency(nextThreshold.potential_bonus)}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress bar towards the next level */}
                <div className="mt-8 space-y-2">
                    <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span>Прогресс до цели</span>
                        <span className="text-purple-400">{Math.round((kpi.current_value / nextThreshold.monthly_threshold) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                        <div
                            className="h-full bg-gradient-to-r from-purple-600 via-blue-500 to-cyan-400 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all duration-1000 ease-out animate-pulse"
                            style={{ width: `${Math.min((kpi.current_value / nextThreshold.monthly_threshold) * 100, 100)}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-slate-500 text-center pt-1 font-medium">
                        Осталось набрать <span className="text-slate-300">{formatCurrency(nextThreshold.remaining_total)}</span> общей выручки
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
