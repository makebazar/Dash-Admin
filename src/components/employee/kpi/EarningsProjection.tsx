"use client";

import { TrendingUp, Wallet, ArrowRight } from "lucide-react";

interface EarningsProjectionProps {
    kpi: any;
    formatCurrency: (amount: number) => string;
}

export function EarningsProjection({ kpi, formatCurrency }: EarningsProjectionProps) {
    const projectedBonus = kpi.projected_bonus || 0;
    const currentBonus = kpi.bonus_amount || 0;
    const isOnTrackForMore = projectedBonus > currentBonus;

    return (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-blue-500/10 transition-colors" />

            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <TrendingUp className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Прогноз за месяц</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-4">
                    <div className="flex items-end gap-3">
                        <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-none">Сейчас</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                                {formatCurrency(currentBonus)}
                            </p>
                        </div>
                        <ArrowRight className="h-6 w-6 text-slate-300 pb-1" />
                        <div className="space-y-1">
                            <p className="text-[10px] text-blue-600 uppercase font-black tracking-widest leading-none">Прогноз</p>
                            <p className="text-2xl font-black text-blue-600 leading-none">
                                ~{formatCurrency(projectedBonus)}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-800/50 p-0.5 relative">
                            {/* Actual Progress */}
                            <div
                                className="absolute left-0.5 top-0.5 bottom-0.5 bg-emerald-500 rounded-full z-10 transition-all duration-1000 shadow-[2px_0_5px_rgba(16,185,129,0.3)]"
                                style={{ width: `${Math.min((currentBonus / Math.max(projectedBonus, 1)) * 100, 100)}%` }}
                            />
                            {/* Projected Progress (faint) */}
                            <div
                                className="h-full bg-blue-400 rounded-full opacity-30 shadow-[0_0_10px_rgba(96,165,250,0.5)] transition-all duration-1000"
                                style={{ width: `100%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                            <span>Бонус сегодня</span>
                            <span>Ожидаемый бонус</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                    {isOnTrackForMore ? (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Темп выше среднего
                            </p>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                Если сохранишь темп, в конце месяца твой бонус вырастет на <span className="text-slate-900 dark:text-white font-bold">{formatCurrency(projectedBonus - currentBonus)}</span>. Не сбавляй обороты!
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Нужно ускориться
                            </p>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                При текущем темпе ты идешь на минимальный бонус. Попробуй поднять средний чек, чтобы выйти на Уровень {kpi.current_level + 1}.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
