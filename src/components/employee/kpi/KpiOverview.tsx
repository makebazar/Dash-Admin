"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, Zap, Trophy, ChevronRight, ClipboardCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface KpiOverviewProps {
    kpi: any;
    formatCurrency: (amount: number) => string;
    remainingShifts: number;
    shiftsCount: number;
    completedShiftsCount?: number;
    plannedShifts: number;
    daysRemaining: number;
    activeShift: any | null;
}

export function MaintenanceKpiCard({ kpi, formatCurrency }: { kpi: any, formatCurrency: (amount: number) => string }) {
    const [showDetails, setShowDetails] = useState(false);
    const nextThreshold = kpi.thresholds?.find((t: any) => !t.is_met);
    const liveCurrentValue = kpi.live_current_value ?? kpi.current_value ?? 0;
    const liveTargetValue = kpi.live_target_value ?? kpi.target_value ?? 0;
    const completedMonthValue = kpi.completed_month_value ?? liveCurrentValue;
    const adjustedCompletedMonthValue = kpi.adjusted_completed_month_value ?? completedMonthValue;
    const totalMonthTarget = kpi.total_month_target ?? liveTargetValue;
    const projectedCompletedValue = kpi.projected_completed_value ?? adjustedCompletedMonthValue;
    const projectedEfficiency = kpi.projected_efficiency ?? kpi.efficiency ?? 0;
    const projectedBonusAmount = kpi.projected_bonus_amount ?? kpi.bonus_amount ?? 0;
    const projectedTierLabel = kpi.projected_tier_label ?? null;
    const progressPercent = totalMonthTarget > 0 ? Math.min((completedMonthValue / totalMonthTarget) * 100, 100) : 100;
    const oldDebtClosed = kpi.old_debt_closed_tasks || 0;
    const overdueCompletedAverageDays = (kpi.overdue_completed_tasks || 0) > 0
        ? Math.round((kpi.overdue_completed_days || 0) / (kpi.overdue_completed_tasks || 1))
        : 0;

    return (
        <div className="space-y-4">
            <Card className="border-0 shadow-lg bg-card border border-border overflow-hidden relative w-full">
                <CardContent className="p-6 relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-accent/50 border border-border">
                                <Wrench className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-foreground/50 uppercase tracking-wider font-bold">{kpi.name}</p>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mb-6">
                        <p className="text-muted-foreground text-sm mb-1">Эффективность</p>
                        <div className="flex items-baseline justify-center gap-2">
                            <span className="text-4xl font-semibold tracking-tight text-foreground">{(kpi.efficiency || 0).toFixed(1)}</span>
                            <span className="text-xl font-medium text-muted-foreground">%</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        <div className="rounded-2xl border border-border bg-accent/50 p-4 flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Задачи (план месяца)</p>
                            <p className="text-2xl font-semibold text-foreground">
                                <span className="text-emerald-400 font-black">{completedMonthValue}</span> <span className="text-muted-foreground">/</span> {totalMonthTarget}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1">Просрочено</p>
                            <p className="text-3xl font-black text-rose-500">{kpi.overdue_open_tasks || 0}</p>
                            <div className="mt-2 space-y-1">
                                {(kpi.rework_open_tasks || 0) > 0 && (
                                    <p className="text-[10px] font-medium text-rose-400/80">На доработке: {kpi.rework_open_tasks}</p>
                                )}
                                {(kpi.overdue_penalty_amount || 0) > 0 && (
                                    <p className="text-[10px] font-bold text-rose-500 mt-1">Штраф: -{formatCurrency(kpi.overdue_penalty_amount || 0)}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                        {oldDebtClosed > 0 && (
                            <div className="rounded-full border border-border bg-accent/50 px-3 py-1 text-[11px] text-foreground/70">
                                Закрыт старый долг: <span className="font-bold text-foreground">{oldDebtClosed}</span>
                            </div>
                        )}
                        {(kpi.overdue_completed_tasks || 0) > 0 && (
                            <div className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-400">
                                С просрочкой: <span className="font-bold">{kpi.overdue_completed_tasks}</span> (в ср. {overdueCompletedAverageDays} дн.)
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="h-2 w-full bg-accent/50 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-foreground/60"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        
                        <div className="flex justify-between items-center pt-2 border-t border-border">
                            <div>
                                <p className="text-xs text-foreground/50">Текущий бонус</p>
                                <p className="text-xl font-bold text-emerald-400">+{formatCurrency(kpi.bonus_amount)}</p>
                            </div>
                            {nextThreshold && (
                                <div className="text-right">
                                    <p className="text-xs text-foreground/50">Цель</p>
                                    <p className="text-sm font-bold text-foreground">эфф. ≥ {nextThreshold.from}% → {formatCurrency(nextThreshold.amount)}</p>
                                </div>
                            )}
                        </div>

                        {kpi.thresholds?.length > 0 && (
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="w-full flex items-center justify-center gap-2 text-sm text-foreground/40 hover:text-foreground/70 transition-colors pt-2 border-t border-border mt-2"
                            >
                                <span>{showDetails ? 'Скрыть уровни' : 'Показать все уровни'}</span>
                                <ChevronRight className={cn("h-4 w-4 transition-transform", showDetails && "rotate-90")} />
                            </button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {showDetails && kpi.thresholds && (
                <Card className="border border-border shadow-lg bg-card overflow-hidden">
                    <CardContent className="p-4 space-y-2">
                        {kpi.thresholds.map((t: any) => (
                            <div 
                                key={t.level}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border transition-all",
                                    t.is_met 
                                        ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30" 
                                        : t.level === nextThreshold?.level
                                            ? "bg-accent/50 border-border ring-1 ring-foreground/15"
                                            : "bg-accent/30 border-border opacity-50"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                        t.is_met ? "bg-emerald-500 text-foreground" : "bg-accent/80 text-muted-foreground"
                                    )}>
                                        {t.is_met ? "✓" : t.level}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">Эффективность ≥ {t.from}%</p>
                                        {t.level === nextThreshold?.level && (
                                            <p className="text-[10px] text-muted-foreground font-bold">Текущая цель</p>
                                        )}
                                    </div>
                                </div>
                                <p className="font-black text-lg text-foreground">{formatCurrency(t.amount)}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export function ChecklistKpiCard({ kpi, formatCurrency }: { kpi: any, formatCurrency: (amount: number) => string }) {
    const [showDetails, setShowDetails] = useState(false);
    const nextThreshold = kpi.thresholds?.find((t: any) => !t.is_met);
    const progressPercent = Math.min((kpi.current_value / (nextThreshold?.from || 100)) * 100, 100);

    return (
        <div className="space-y-4">
            <Card className="border-0 shadow-lg bg-card border border-border overflow-hidden relative w-full">
                <CardContent className="p-6 relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-accent/50 border border-border">
                                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-foreground/50 uppercase tracking-wider font-bold">{kpi.name}</p>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mb-6">
                        <p className="text-muted-foreground text-sm mb-1">Средний балл</p>
                        <div className="flex items-baseline justify-center gap-2">
                            <span className="text-4xl font-semibold tracking-tight text-foreground">{(kpi.current_value || 0).toFixed(1)}</span>
                            <span className="text-xl font-medium text-muted-foreground">%</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        <div className="rounded-2xl border border-border bg-accent/50 p-4 flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Количество проверок</p>
                            <p className="text-2xl font-semibold text-foreground">
                                <span className="text-emerald-400 font-black">{kpi.count}</span>
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-accent/50 p-4 flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Текущий бонус</p>
                            <p className="text-2xl font-black text-emerald-400">+{formatCurrency(kpi.bonus_amount)}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="h-2 w-full bg-accent/50 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-foreground/60"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        
                        <div className="flex justify-between items-center pt-2 border-t border-border">
                            <div>
                                <p className="text-xs text-foreground/50">Прогресс</p>
                                <p className="text-xl font-bold text-foreground">{(kpi.current_value || 0).toFixed(1)}%</p>
                            </div>
                            {nextThreshold && (
                                <div className="text-right">
                                    <p className="text-xs text-foreground/50">Цель</p>
                                    <p className="text-sm font-bold text-foreground">балл ≥ {nextThreshold.from}% → {formatCurrency(nextThreshold.amount)}</p>
                                </div>
                            )}
                        </div>

                        {kpi.thresholds?.length > 0 && (
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="w-full flex items-center justify-center gap-2 text-sm text-foreground/40 hover:text-foreground/70 transition-colors pt-2 border-t border-border mt-2"
                            >
                                <span>{showDetails ? 'Скрыть уровни' : 'Показать все уровни'}</span>
                                <ChevronRight className={cn("h-4 w-4 transition-transform", showDetails && "rotate-90")} />
                            </button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {showDetails && kpi.thresholds && (
                <Card className="border border-border shadow-lg bg-card overflow-hidden">
                    <CardContent className="p-4 space-y-2">
                        {kpi.thresholds.map((t: any) => (
                            <div 
                                key={t.level}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border transition-all",
                                    t.is_met 
                                        ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30" 
                                        : t.level === nextThreshold?.level
                                            ? "bg-accent/50 border-border ring-1 ring-foreground/15"
                                            : "bg-accent/30 border-border opacity-50"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                        t.is_met ? "bg-emerald-500 text-foreground" : "bg-accent/80 text-muted-foreground"
                                    )}>
                                        {t.is_met ? "✓" : t.level}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">Средний балл ≥ {t.from}%</p>
                                        {t.level === nextThreshold?.level && (
                                            <p className="text-[10px] text-muted-foreground font-bold">Текущая цель</p>
                                        )}
                                    </div>
                                </div>
                                <p className="font-black text-lg text-foreground">{formatCurrency(t.amount)}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export function KpiOverview({
    kpi,
    formatCurrency,
    remainingShifts,
    shiftsCount,
    completedShiftsCount,
    plannedShifts,
    daysRemaining,
    activeShift
}: KpiOverviewProps) {
    const [showDetails, setShowDetails] = useState(false);
    const nextThreshold = kpi.all_thresholds?.find((t: any) => !t.is_met);
    const currentAchievedLevel = kpi.all_thresholds
        ?.filter((t: any) => t.is_met)
        ?.sort((a: any, b: any) => b.level - a.level)[0];
    const maxLevel = kpi.all_thresholds?.length > 0 && !nextThreshold; 

    // No thresholds defined - simple progress or misconfiguration
    if (!kpi.all_thresholds || kpi.all_thresholds.length === 0) {
        return (
            <Card className="border border-border shadow-lg bg-card text-foreground p-6">
                <div className="flex items-center gap-3">
                    <Target className="h-6 w-6 text-muted-foreground" />
                    <div>
                        <p className="text-xs text-foreground/50 uppercase tracking-wider font-bold">{kpi.name}</p>
                        <p className="text-lg font-bold">Прогресс: {formatCurrency(kpi.current_value)}</p>
                    </div>
                </div>
            </Card>
        );
    }

    // Карточка максимального уровня
    if (maxLevel) {
        return (
            <Card className="border-0 shadow-lg bg-card border border-border overflow-hidden relative w-full">
                <CardContent className="p-6 md:p-8 relative z-10">
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center p-4 rounded-full bg-accent/50">
                            <Trophy className="h-12 w-12 text-yellow-300" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black mb-2">Максимальный бонус!</h2>
                            <p className="text-lg text-foreground/80">
                                {kpi.all_thresholds?.length > 0 && kpi.all_thresholds[kpi.all_thresholds.length - 1]?.percent > 0 
                                    ? `Вы получаете ${kpi.all_thresholds[kpi.all_thresholds.length - 1]?.percent}% бонус`
                                    : `Вы получили максимальную премию`}
                            </p>
                            <p className="text-4xl font-black mt-4">
                                +{formatCurrency(kpi.bonus_amount)}
                            </p>
                        </div>
                        <p className="text-foreground/70 text-sm">
                            Продолжайте в том же духе, чтобы сохранить уровень до конца месяца!
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const targetMonthValue = nextThreshold?.planned_month_threshold || nextThreshold?.monthly_threshold || 0
    const progressPercent = targetMonthValue > 0 ? Math.min((kpi.current_value / targetMonthValue) * 100, 100) : 0
    const requiredPerShift = nextThreshold?.per_shift_to_reach || 0
    const onTrack = requiredPerShift > 0 ? kpi.avg_per_shift >= requiredPerShift : true

    // Мотивирующие сообщения
    const getMessageIndex = (seed: string, length: number) => {
        let hash = 0
        for (let i = 0; i < seed.length; i++) {
            hash = (hash * 31 + seed.charCodeAt(i)) | 0
        }
        return Math.abs(hash) % length
    }

    const getMotivationMessage = () => {
        if (onTrack) {
            const messages = [
                `Отличный темп! Вы уверенно идете к следующему уровню.`,
                `Супер результат! Ваша выручка за смену выше плановой.`,
                `Так держать! Бонус уже близко.`,
                `Вы на верном пути! Продолжайте в том же духе.`
            ];
            const seed = `${kpi.avg_per_shift}-${nextThreshold.level}-${kpi.current_value}-${kpi.bonus_amount}`
            return messages[getMessageIndex(seed, messages.length)];
        } else {
            const diff = nextThreshold.per_shift_to_reach - kpi.avg_per_shift;
            const percentDiff = (diff / nextThreshold.per_shift_to_reach) * 100;
            
            if (percentDiff < 15) {
                return `Вы совсем близко! Нужно продавать в смену всего на ${formatCurrency(diff)} больше. Предлагайте напитки и снеки каждому гостю!`;
            } else {
                return `Есть потенциал для роста. Обратите внимание на чистоту и сервис — довольные гости тратят больше. Нужно ускориться!`;
            }
        }
    };

    // Label count for revenue
    const revenueShiftLabel = completedShiftsCount !== undefined 
        ? (completedShiftsCount === 1 ? '1 смена' : `${completedShiftsCount} смен`)
        : `${shiftsCount} смен`;

    return (
        <div className="space-y-4">
            <Card className="border-0 shadow-lg bg-card border border-border overflow-hidden relative w-full">
                <CardContent className="p-6 md:p-8 relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-accent/50 border border-border">
                                <Target className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-foreground/50 uppercase tracking-wider font-bold">{kpi.name || 'KPI'}</p>
                                {nextThreshold ? (
                                    <p className="text-sm text-muted-foreground font-medium">
                                        Следующая цель: {nextThreshold.label}{' '}
                                        {nextThreshold.percent > 0 ? `${nextThreshold.percent}%` : formatCurrency(nextThreshold.amount)}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-foreground/50">Осталось</p>
                            <p className="text-lg font-bold">{remainingShifts} {remainingShifts === 1 ? 'смена' : remainingShifts < 5 ? 'смены' : 'смен'}</p>
                        </div>
                    </div>

                    {currentAchievedLevel && (
                        <div className="flex justify-center mb-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/50 border border-border">
                                <span className="text-xs font-semibold text-foreground">
                                    Уровень сейчас: {currentAchievedLevel.label}{' '}
                                    {currentAchievedLevel.percent > 0 ? `${currentAchievedLevel.percent}%` : formatCurrency(currentAchievedLevel.amount)}
                                </span>
                            </div>
                        </div>
                    )}

                        <div className="rounded-xl border border-border bg-accent/30 p-5">
                            <p className="text-xs font-medium text-muted-foreground">План на смену</p>
                            <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
                                {requiredPerShift ? formatCurrency(requiredPerShift) : "—"}
                            </p>
                            {nextThreshold ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Для уровня “{nextThreshold.label}”
                                </p>
                            ) : null}
                        </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-4">
                        <div className="rounded-lg border border-border bg-card p-4">
                            <p className="text-[11px] text-muted-foreground">Выручка за месяц</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(kpi.current_value)}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4">
                            <p className="text-[11px] text-muted-foreground">Цель месяца</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{targetMonthValue ? formatCurrency(targetMonthValue) : "—"}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{plannedShifts} смен</p>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4">
                            <p className="text-[11px] text-muted-foreground">Средняя за смену</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(kpi.avg_per_shift || 0)}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{daysRemaining} дн. осталось</p>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4">
                            <p className="text-[11px] text-muted-foreground">Премия сейчас</p>
                            <p className="mt-1 text-sm font-semibold text-emerald-500">+{formatCurrency(kpi.bonus_amount || 0)}</p>
                            {nextThreshold ? (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    След. уровень: {nextThreshold.percent > 0 ? `${nextThreshold.percent}%` : formatCurrency(nextThreshold.amount)}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-8 space-y-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Прогресс к цели месяца</span>
                            <span>{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="relative h-2.5 w-full bg-accent/50 rounded-full border border-border overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full ",
                                    onTrack
                                        ? "bg-emerald-500"
                                        : "bg-orange-500"
                                )}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    <div className={cn(
                        "mt-6 p-4 rounded-lg flex items-start gap-3 text-sm font-medium border",
                        onTrack
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-orange-500/10 border-orange-500/20 text-orange-400"
                    )}>
                        <div className={cn("w-2 h-2 rounded-full animate-pulse mt-1.5 shrink-0", onTrack ? "bg-emerald-400" : "bg-orange-400")} />
                        <div>
                            {onTrack
                                ? "Темп нормальный: идёте к следующему уровню."
                                : `Не хватает примерно ${formatCurrency(Math.max(0, requiredPerShift - (kpi.avg_per_shift || 0)))} в среднем на смену.`}
                            {requiredPerShift > 0 ? (
                                <p className="text-xs opacity-70 mt-1 font-normal">
                                    Средняя: {formatCurrency(kpi.avg_per_shift || 0)} · План: {formatCurrency(requiredPerShift)}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <span>{showDetails ? 'Скрыть детали' : 'Показать все уровни'}</span>
                        <ChevronRight className={cn(
                            "h-4 w-4 transition-transform",
                            showDetails && "rotate-90"
                        )} />
                    </button>
                </CardContent>
            </Card>

            {showDetails && (
                <Card className="border border-border shadow-lg bg-card overflow-hidden">
                    <CardContent className="p-6">
                        <h3 className="text-lg font-bold mb-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-muted-foreground" />
                                Все уровни бонусов
                            </div>
                            <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground bg-accent/30 px-3 py-1.5 rounded-full border border-border">
                                <Zap className="h-3 w-3" />
                                Выручка: <span className="font-semibold text-foreground">{formatCurrency(kpi.current_value)}</span>
                            </div>
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
                                                ? "bg-emerald-500/10 border-emerald-500/20"
                                                : isNext
                                                    ? "bg-accent/50 border-border ring-1 ring-foreground/15"
                                                    : "bg-accent/20 border-border opacity-60"
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                                                    isCompleted
                                                        ? "bg-emerald-500 text-foreground"
                                                        : isNext
                                                            ? "bg-foreground/15 text-foreground"
                                                            : "bg-foreground/10 text-muted-foreground"
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
                                                    {level.display_shifts_count > 0 ? (
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            План на {level.display_shifts_count} {
                                                                level.display_shifts_count === 1 ? 'закрытую смену' : 
                                                                level.display_shifts_count < 5 ? 'закрытые смены' : 'закрытых смен'
                                                            }: {formatCurrency(level.scaled_threshold)}
                                                            {isCompleted && ' ✓'}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={cn(
                                                    "text-2xl font-black",
                                                    isCompleted ? "text-emerald-400" : isNext ? "text-foreground" : "text-muted-foreground"
                                                )}>
                                                    {level.percent > 0 ? `${level.percent}%` : formatCurrency(level.amount)}
                                                </p>
                                                {isNext && (
                                                    <p className="text-xs text-muted-foreground font-semibold">Текущая цель</p>
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
