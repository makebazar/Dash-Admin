"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, Coins, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface VirtualBalanceCardProps {
    balance: number;
    accruedToday: number;
    currency: string;
    formatCurrency: (amount: number) => string;
    className?: string;
}

export function VirtualBalanceCard({
    balance,
    accruedToday,
    currency = "RUB",
    formatCurrency,
    className
}: VirtualBalanceCardProps) {
    const hasBalance = balance > 0;
    const hasTodayAccrual = accruedToday > 0;

    return (
        <Card className={cn(
            "border-0 shadow-xl overflow-hidden relative group",
            hasBalance 
                ? "bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white" 
                : "bg-white dark:bg-slate-800/50 backdrop-blur",
            className
        )}>
            {/* Animated background pattern */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-white/15 transition-all duration-700" />
            
            <CardContent className="p-6 relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2.5 rounded-xl",
                            hasBalance ? "bg-white/20 backdrop-blur" : "bg-indigo-500/10"
                        )}>
                            <Wallet className={cn(
                                "h-6 w-6",
                                hasBalance ? "text-white" : "text-indigo-500"
                            )} />
                        </div>
                        <div>
                            <h3 className={cn(
                                "text-sm font-bold uppercase tracking-wider",
                                hasBalance ? "text-white/80" : "text-muted-foreground"
                            )}>
                                Виртуальный баланс
                            </h3>
                            <p className={cn(
                                "text-xs",
                                hasBalance ? "text-white/60" : "text-muted-foreground"
                            )}>
                                {currency === "RUB" ? "Рубли" : currency === "HOURS" ? "Часы игры" : "Кредиты"}
                            </p>
                        </div>
                    </div>
                    
                    {hasBalance && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30">
                            <Coins className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400">Доступно</span>
                        </div>
                    )}
                </div>

                {/* Balance Display */}
                <div className="space-y-4">
                    {/* Main Balance */}
                    <div className="text-center py-4">
                        <p className={cn(
                            "text-sm mb-2",
                            hasBalance ? "text-white/70" : "text-muted-foreground"
                        )}>
                            Текущий баланс
                        </p>
                        <div className="flex items-baseline justify-center gap-2">
                            <span className={cn(
                                "text-4xl md:text-5xl font-black",
                                hasBalance ? "text-white" : "text-indigo-500"
                            )}>
                                {hasBalance ? formatCurrency(balance).replace(' ₽', '') : '0'}
                            </span>
                            {currency === "RUB" && (
                                <span className={cn(
                                    "text-2xl font-bold",
                                    hasBalance ? "text-white/40" : "text-indigo-400"
                                )}>
                                    ₽
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Today's Accrual */}
                    {hasTodayAccrual && (
                        <div className={cn(
                            "flex items-center justify-between gap-3 px-4 py-3 rounded-xl",
                            hasBalance ? "bg-white/10 backdrop-blur border border-white/20" : "bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800"
                        )}>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-emerald-500/20">
                                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                                </div>
                                <div>
                                    <p className={cn(
                                        "text-xs font-medium",
                                        hasBalance ? "text-white/70" : "text-muted-foreground"
                                    )}>
                                        Начислено за сегодня
                                    </p>
                                    <p className={cn(
                                        "text-sm font-bold",
                                        hasBalance ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400"
                                    )}>
                                        +{formatCurrency(accruedToday)}
                                    </p>
                                </div>
                            </div>
                            <ArrowRight className={cn(
                                "h-5 w-5",
                                hasBalance ? "text-white/40" : "text-muted-foreground"
                            )} />
                        </div>
                    )}

                    {/* Empty State Message */}
                    {!hasBalance && (
                        <div className="text-center py-3">
                            <p className={cn(
                                "text-sm",
                                hasBalance ? "text-white/60" : "text-muted-foreground"
                            )}>
                                Бонусы с типом выплаты &quot;Виртуальный баланс&quot; будут отображаться здесь
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
