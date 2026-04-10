"use client"

import { useState, useEffect, useTransition } from "react"
import { getAbcAnalysisData, manualTriggerReplenishment } from "../actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Info, Package, DollarSign, PieChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Product } from "../actions"

interface AbcAnalysisTabProps {
    clubId: string
    products: Product[]
}

export function AbcAnalysisTab({ clubId, products }: AbcAnalysisTabProps) {
    const [data, setData] = useState<any[]>([])
    const [isPending, startTransition] = useTransition()
    const [isLoading, setIsLoading] = useState(true)

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const res = await getAbcAnalysisData(clubId)
            setData(res)
        } catch (err) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [clubId])

    const handleRecalculate = () => {
        startTransition(async () => {
            await manualTriggerReplenishment(clubId)
            await fetchData()
        })
    }

    const stats = {
        A: data.filter(i => i.abc_category === 'A'),
        B: data.filter(i => i.abc_category === 'B'),
        C: data.filter(i => i.abc_category === 'C'),
        totalRevenue: data.reduce((acc, curr) => acc + Number(curr.total_revenue), 0),
        totalProfit: data.reduce((acc, curr) => acc + Number(curr.total_profit), 0),
        
        // Stock Stats
        totalProducts: products.length,
        stockCost: products.reduce((acc, p) => acc + (p.cost_price * (p.current_stock || 0)), 0),
        stockValue: products.reduce((acc, p) => acc + (p.selling_price * (p.current_stock || 0)), 0),
    }

    const potentialProfit = stats.stockValue - stats.stockCost
    const stockMargin = stats.stockValue > 0 ? (potentialProfit / stats.stockValue * 100) : 0
    const avgMargin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue * 100) : 0

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/70 gap-4">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <p className="text-sm font-medium">Загрузка аналитики...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">
                        Аналитика
                    </h2>
                    <p className="text-sm text-muted-foreground">Складские показатели и ABC-анализ продаж за 30 дней</p>
                </div>
                <Button 
                    onClick={handleRecalculate} 
                    disabled={isPending}
                    variant="outline"
                    className="gap-2"
                >
                    <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                    Обновить данные
                </Button>
            </div>

            {/* Inventory Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card p-4 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Package className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-[10px] text-muted-foreground/70 uppercase font-bold tracking-wider">Товаров в наличии</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-foreground">{stats.totalProducts}</span>
                        <span className="text-xs text-muted-foreground font-medium">позиций</span>
                    </div>
                </div>

                <div className="bg-card p-4 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-muted rounded-lg">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-[10px] text-muted-foreground/70 uppercase font-bold tracking-wider">Сумма в закупе</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-foreground">{Math.round(stats.stockCost).toLocaleString('ru-RU')} ₽</span>
                    </div>
                </div>

                <div className="bg-card p-4 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="text-[10px] text-muted-foreground/70 uppercase font-bold tracking-wider">Сумма в продаже</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-foreground">{Math.round(stats.stockValue).toLocaleString('ru-RU')} ₽</span>
                    </div>
                </div>

                <div className="bg-card p-4 rounded-2xl border border-border shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-card rounded-lg shadow-sm">
                            <PieChart className="h-4 w-4 text-indigo-600" />
                        </div>
                        <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider">Потенц. прибыль</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-indigo-900">{Math.round(potentialProfit).toLocaleString('ru-RU')} ₽</span>
                        <span className="text-xs text-indigo-600 font-bold">({stockMargin.toFixed(1)}%)</span>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card p-4 md:p-6 rounded-2xl border border-border shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <Badge className="bg-green-500 text-primary-foreground font-black">Группа A</Badge>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-foreground">{stats.A.length}</h3>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1 uppercase font-bold tracking-wider">Товаров-локомотивов</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-accent rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: '80%' }} />
                        </div>
                        <span className="text-[10px] md:text-xs font-black text-green-600">~80% выручки</span>
                    </div>
                </div>

                <div className="bg-card p-4 md:p-6 rounded-2xl border border-border shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-amber-50 rounded-lg">
                            <Info className="h-5 w-5 text-amber-600" />
                        </div>
                        <Badge className="bg-amber-500 text-primary-foreground font-black">Группа B</Badge>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-foreground">{stats.B.length}</h3>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1 uppercase font-bold tracking-wider">Стабильные товары</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-accent rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: '15%' }} />
                        </div>
                        <span className="text-[10px] md:text-xs font-black text-amber-600">~15% выручки</span>
                    </div>
                </div>

                <div className="bg-card p-4 md:p-6 rounded-2xl border border-border shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-400" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-muted rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <Badge className="bg-slate-400 text-primary-foreground font-black">Группа C</Badge>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-foreground">{stats.C.length}</h3>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1 uppercase font-bold tracking-wider">Малоценные товары</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-accent rounded-full overflow-hidden">
                            <div className="h-full bg-slate-400" style={{ width: '5%' }} />
                        </div>
                        <span className="text-[10px] md:text-xs font-black text-muted-foreground">~5% выручки</span>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border/50 bg-muted/50 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        Детализация по товарам
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-[10px] text-muted-foreground/70 uppercase font-bold tracking-widest">
                            Выручка: {stats.totalRevenue.toLocaleString('ru-RU')} ₽
                        </span>
                        <span className="text-[10px] text-green-600 uppercase font-bold tracking-widest">
                            Прибыль: {stats.totalProfit.toLocaleString('ru-RU')} ₽ ({avgMargin.toFixed(1)}%)
                        </span>
                    </div>
                </div>
                
                {/* Mobile View */}
                <div className="md:hidden divide-y divide-slate-100">
                    {data.map((item, index) => (
                        <div key={item.product_id} className="p-4 space-y-3">
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground/70 font-mono">#{index + 1}</span>
                                        <h5 className="font-bold text-foreground truncate">{item.name}</h5>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge 
                                            className={cn(
                                                "h-4 px-1.5 text-[9px] font-black uppercase",
                                                item.abc_category === 'A' ? "bg-green-500" :
                                                item.abc_category === 'B' ? "bg-amber-500" :
                                                "bg-slate-400"
                                            )}
                                        >
                                            Группа {item.abc_category}
                                        </Badge>
                                        {item.days_left !== null && (
                                            <span className={cn(
                                                "text-[10px] font-bold",
                                                Number(item.days_left) < 3 ? "text-rose-500" : 
                                                Number(item.days_left) < 7 ? "text-amber-500" : 
                                                "text-muted-foreground"
                                            )}>
                                                Запас: {Math.round(item.days_left)} дн.
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-foreground leading-none">
                                        {Number(item.total_revenue).toLocaleString('ru-RU')} ₽
                                    </div>
                                    <div className="text-[10px] font-bold text-green-600 mt-1">
                                        +{Number(item.total_profit).toLocaleString('ru-RU')} ₽
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-50 bg-muted/30 rounded-lg px-2">
                                <div className="space-y-0.5">
                                    <div className="text-[9px] text-muted-foreground/70 uppercase font-bold tracking-wider">Продано</div>
                                    <div className="text-xs font-bold text-muted-foreground">{Number(item.total_sold).toLocaleString('ru-RU')} шт.</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-[9px] text-muted-foreground/70 uppercase font-bold tracking-wider">Маржа</div>
                                    <div className="text-xs font-bold text-foreground">{item.margin_percent}%</div>
                                </div>
                                <div className="space-y-0.5 text-right">
                                    <div className="text-[9px] text-muted-foreground/70 uppercase font-bold tracking-wider">Доля</div>
                                    <div className="text-xs font-black text-blue-600">{item.revenue_share}%</div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {data.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground/70 italic text-sm px-4">
                            Нет данных о продажах за последние 30 дней
                        </div>
                    )}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[50px] text-center">#</TableHead>
                                <TableHead>Товар</TableHead>
                                <TableHead className="text-center">Группа</TableHead>
                                <TableHead className="text-right">Продано</TableHead>
                                <TableHead className="text-right">Выручка</TableHead>
                                <TableHead className="text-right">Прибыль</TableHead>
                                <TableHead className="text-right">Маржа</TableHead>
                                <TableHead className="text-right">Запас (дн)</TableHead>
                                <TableHead className="text-right">Доля</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((item, index) => (
                                <TableRow key={item.product_id} className="group hover:bg-muted/50 transition-colors">
                                    <TableCell className="text-center text-muted-foreground/70 font-mono text-xs">
                                        {index + 1}
                                    </TableCell>
                                    <TableCell className="font-bold text-foreground">
                                        {item.name}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge 
                                            className={cn(
                                                "h-5 px-2 text-[10px] font-black uppercase",
                                                item.abc_category === 'A' ? "bg-green-500 hover:bg-green-600" :
                                                item.abc_category === 'B' ? "bg-amber-500 hover:bg-amber-600" :
                                                "bg-slate-400 hover:bg-slate-500"
                                            )}
                                        >
                                            {item.abc_category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-muted-foreground">
                                        {Number(item.total_sold).toLocaleString('ru-RU')} шт.
                                    </TableCell>
                                    <TableCell className="text-right font-black text-foreground">
                                        {Number(item.total_revenue).toLocaleString('ru-RU')} ₽
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-green-600">
                                        {Number(item.total_profit).toLocaleString('ru-RU')} ₽
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="outline" className="font-bold border-border">
                                            {item.margin_percent}%
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {item.days_left !== null ? (
                                            <span className={cn(
                                                "text-xs font-bold",
                                                Number(item.days_left) < 3 ? "text-rose-500" : 
                                                Number(item.days_left) < 7 ? "text-amber-500" : 
                                                "text-muted-foreground"
                                            )}>
                                                {Math.round(item.days_left)} дн.
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-[10px]">∞</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-sm font-bold text-blue-600">{item.revenue_share}%</span>
                                            <div className="w-16 h-1 bg-accent rounded-full overflow-hidden">
                                                <div 
                                                    className={cn(
                                                        "h-full",
                                                        item.abc_category === 'A' ? "bg-green-500" :
                                                        item.abc_category === 'B' ? "bg-amber-500" :
                                                        "bg-slate-400"
                                                    )}
                                                    style={{ width: `${item.revenue_share}%` }}
                                                />
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground/70 italic">
                                        Нет данных о продажах за последние 30 дней
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
