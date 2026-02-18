"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, Zap, Trophy, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface KpiOverviewProps {
    kpi: any;
    formatCurrency: (amount: number) => string;
    remainingShifts: number;
    shiftsCount: number;
    plannedShifts: number;
    daysRemaining: number;
    activeShift: any | null;
}

export function KpiOverview({
    kpi,
    formatCurrency,
    remainingShifts,
    shiftsCount,
    plannedShifts,
    daysRemaining,
    activeShift
}: KpiOverviewProps) {
    const [showDetails, setShowDetails] = useState(false);
    const nextThreshold = kpi.all_thresholds?.find((t: any) => !t.is_met);
    const currentAchievedLevel = kpi.all_thresholds
        ?.filter((t: any) => t.is_met)
        ?.sort((a: any, b: any) => b.level - a.level)[0];
    const maxLevel = !nextThreshold; // Достигнут максимум

    // Карточка максимального уровня
    if (maxLevel) {
        return (
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-emerald-500 via-green-600 to-teal-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-3xl -ml-24 -mb-24" />

                <CardContent className="p-6 md:p-8 relative z-10">
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center p-4 rounded-full bg-white/20 backdrop-blur">
                            <Trophy className="h-12 w-12 text-yellow-300" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black mb-2">Максимальный бонус!</h2>
                            <p className="text-lg text-white/80">
                                Вы получаете {kpi.all_thresholds[kpi.all_thresholds.length - 1]?.percent}% бонус
                            </p>
                            <p className="text-4xl font-black mt-4">
                                +{formatCurrency(kpi.bonus_amount)}
                            </p>
                        </div>
                        <p className="text-white/70 text-sm">
                            Продолжайте в том же духе, чтобы сохранить уровень до конца месяца!
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const progressPercent = Math.min((kpi.current_value / (nextThreshold.planned_month_threshold || nextThreshold.monthly_threshold)) * 100, 100);
    const onTrack = kpi.avg_per_shift >= nextThreshold.per_shift_to_reach;

    // Мотивирующие сообщения
    const getMotivationMessage = () => {
        if (onTrack) {
            const messages = [
                `Отличный темп! Вы уверенно идете к следующему уровню.`,
                `Супер результат! Ваш средний чек (${formatCurrency(kpi.avg_per_shift)}) выше планового.`,
                `Так держать! Бонус уже близко.`,
                `Вы на верном пути! Продолжайте в том же духе.`
            ];
            return messages[Math.floor(Math.random() * messages.length)];
        } else {
            const diff = nextThreshold.per_shift_to_reach - kpi.avg_per_shift;
            const percentDiff = (diff / nextThreshold.per_shift_to_reach) * 100;
            
            if (percentDiff < 15) {
                return `Вы совсем близко! Нужно подтянуть средний чек всего на ${formatCurrency(diff)}. Предлагайте напитки и снеки каждому гостю!`;
            } else {
                return `Есть потенциал для роста. Обратите внимание на чистоту и сервис — довольные гости тратят больше. Нужно ускориться!`;
            }
        }
    };

    return (
        <div className="space-y-4">
            {/* Main Focus Card - Что нужно сегодня */}
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 text-white overflow-hidden relative group">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-purple-500/30 transition-all duration-700" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl -ml-24 -mb-24 group-hover:bg-blue-500/30 transition-all duration-700" />

                <CardContent className="p-6 md:p-8 relative z-10">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                                <Target className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-xs text-white/50 uppercase tracking-wider font-bold">{kpi.name || 'KPI'}</p>
                                <p className="text-sm text-purple-400 font-medium">
                                    {currentAchievedLevel
                                        ? `${currentAchievedLevel.label} ${currentAchievedLevel.percent}% → ${nextThreshold.label} ${nextThreshold.percent}%`
                                        : `Следующая цель: ${nextThreshold.label} ${nextThreshold.percent}%`
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-white/50">Осталось</p>
                            <p className="text-lg font-bold">{remainingShifts} {remainingShifts === 1 ? 'смена' : remainingShifts < 5 ? 'смены' : 'смен'}</p>
                        </div>
                    </div>

                    {/* Current Level Indicator */}
                    {currentAchievedLevel && (
                        <div className="flex justify-center mb-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                                <span className="text-xs font-bold text-emerald-400">
                                    ✓ Ваш уровень: {currentAchievedLevel.label} {currentAchievedLevel.percent}%
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Main Target */}
                    <div className="text-center space-y-4">
                        <div>
                            <p className="text-white/60 text-sm mb-2">
                                {activeShift 
                                    ? <span>Чтобы достичь <span className="text-purple-300 font-bold">{nextThreshold.label} ({nextThreshold.percent}%)</span>, сегодня нужно:</span>
                                    : <span>Чтобы достичь <span className="text-purple-300 font-bold">{nextThreshold.label} ({nextThreshold.percent}%)</span>, делайте в смену:</span>
                                }
                            </p>
                            <div className="flex items-baseline justify-center gap-2">
                                <span className="text-4xl md:text-6xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                                    {formatCurrency(nextThreshold.per_shift_to_reach).replace(' ₽', '')}
                                </span>
                                <span className="text-2xl font-bold text-white/40">₽</span>
                            </div>
                        </div>

                        {/* Current Progress Today - only if shift is active */}
                        {activeShift && kpi.current_shift_value > 0 && (
                            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/20">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-yellow-400" />
                                    <span className="text-sm text-white/80">Сейчас:</span>
                                    <span className="text-lg font-bold text-white">{formatCurrency(kpi.current_shift_value)}</span>
                                </div>
                                {kpi.current_shift_value < nextThreshold.per_shift_to_reach ? (
                                    <span className="text-sm text-orange-400 font-medium">
                                        еще {formatCurrency(nextThreshold.per_shift_to_reach - kpi.current_shift_value)}
                                    </span>
                                ) : (
                                    <span className="text-sm text-emerald-400 font-bold">✓ План выполнен!</span>
                                )}
                            </div>
                        )}

                        {/* Reward */}
                        <div className="pt-4 border-t border-white/10">
                            <p className="text-xs text-white/50 mb-1">Ваша текущая премия</p>
                            <p className="text-3xl font-black text-emerald-400">+{formatCurrency(kpi.bonus_amount || 0)}</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-8 space-y-4">
                        <div className="flex justify-between text-xs text-white/60">
                            <span>Прогресс к бонусу {nextThreshold.percent}%</span>
                        </div>
                        <div className="relative h-3 w-full bg-white/10 rounded-full backdrop-blur border border-white/20">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all duration-1000 shadow-[0_0_20px_currentColor]",
                                    onTrack
                                        ? "bg-gradient-to-r from-emerald-500 to-green-400"
                                        : "bg-gradient-to-r from-orange-500 to-amber-400"
                                )}
                                style={{ width: `${progressPercent}%` }}
                            />
                            {/* Floating percentage label */}
                            <div 
                                className="absolute -top-9 transition-all duration-1000 z-10"
                                style={{ left: `${progressPercent}%`, transform: 'translateX(-50%)' }}
                            >
                                <div className={cn(
                                    "px-2 py-0.5 rounded text-xs font-bold shadow-sm whitespace-nowrap mb-0.5",
                                    onTrack ? "bg-emerald-500 text-white" : "bg-orange-500 text-white"
                                )}>
                                    {Math.round(progressPercent)}%
                                </div>
                                <div className={cn(
                                    "w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] mx-auto",
                                    onTrack ? "border-t-emerald-500" : "border-t-orange-500"
                                )} />
                            </div>
                        </div>
                        <div className="flex justify-between text-xs pt-1">
                            <div>
                                <p className="text-white/50 mb-0.5">Выручка ({shiftsCount} смен)</p>
                                <p className="font-bold text-white text-sm">{formatCurrency(kpi.current_value)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-white/50 mb-0.5">Цель</p>
                                <p className="font-bold text-white text-sm">{formatCurrency(nextThreshold.planned_month_threshold || nextThreshold.monthly_threshold)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Info about maintaining current level */}
                    {currentAchievedLevel && nextThreshold && currentAchievedLevel.level < nextThreshold.level && (
                        <div className="mt-4 p-3 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm">
                            <p className="font-medium">
                                💡 Чтобы сохранить <span className="font-bold text-blue-200">{currentAchievedLevel.label} ({currentAchievedLevel.percent}%)</span>, нужно минимум{' '}
                                <span className="font-bold text-white">
                                    {remainingShifts > 0 
                                        ? formatCurrency(Math.max(0, (currentAchievedLevel.planned_month_threshold - kpi.current_value) / remainingShifts))
                                        : '0 ₽'
                                    }
                                </span> за смену в оставшиеся дни
                            </p>
                        </div>
                    )}

                    {/* Status Indicator */}
                    <div className={cn(
                        "mt-4 p-3 rounded-lg flex items-start gap-3 text-sm font-medium",
                        onTrack
                            ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                            : "bg-orange-500/20 border border-orange-500/30 text-orange-400"
                    )}>
                        <div className={cn("w-2 h-2 rounded-full animate-pulse mt-1.5 shrink-0", onTrack ? "bg-emerald-400" : "bg-orange-400")} />
                        <div>
                            {getMotivationMessage()}
                            <p className="text-xs opacity-70 mt-1 font-normal">
                                Средняя выручка: {formatCurrency(kpi.avg_per_shift)} / План: {formatCurrency(nextThreshold.per_shift_to_reach)}
                            </p>
                        </div>
                    </div>

                    {/* Toggle Details */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-white/60 hover:text-white/90 transition-colors group/btn"
                    >
                        <span>{showDetails ? 'Скрыть детали' : 'Показать все уровни'}</span>
                        <ChevronRight className={cn(
                            "h-4 w-4 transition-transform",
                            showDetails && "rotate-90"
                        )} />
                    </button>
                </CardContent>
            </Card>

            {/* Detailed Ladder - Collapsible */}
            {showDetails && (
                <Card className="border-0 shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                    <CardContent className="p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            Все уровни бонусов
                        </h3>
                        <div className="space-y-3">
                            {kpi.all_thresholds?.map((level: any, idx: number) => {
                                const isCompleted = level.is_met;
                                const isNext = level.level === nextThreshold?.level;

                                return (
                                    <div
                                        key={level.level}
                                        className={cn(
                                            "p-4 rounded-xl border transition-all",
                                            isCompleted
                                                ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30"
                                                : isNext
                                                    ? "bg-purple-50 dark:bg-purple-900/10 border-purple-300 dark:border-purple-900/50 ring-2 ring-purple-500/20"
                                                    : "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 opacity-50"
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                                                    isCompleted
                                                        ? "bg-emerald-500 text-white"
                                                        : isNext
                                                            ? "bg-purple-500 text-white"
                                                            : "bg-slate-200 dark:bg-slate-700 text-slate-400"
                                                )}>
                                                    {isCompleted ? "✓" : level.level}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-sm">{level.label}</p>

                                                    {/* Месячный план */}
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        План на месяц: {formatCurrency(level.planned_month_threshold || level.monthly_threshold)} за {plannedShifts} смен
                                                    </p>

                                                    {/* Актуальный порог для закрытых смен */}
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                                        План на {shiftsCount} смен: {formatCurrency(level.scaled_threshold)}
                                                        {isCompleted && ' ✓'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={cn(
                                                    "text-2xl font-black",
                                                    isCompleted ? "text-emerald-600" : isNext ? "text-purple-600" : "text-slate-400"
                                                )}>
                                                    {level.percent}%
                                                </p>
                                                {isNext && (
                                                    <p className="text-xs text-purple-600 font-bold">Текущая цель</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
