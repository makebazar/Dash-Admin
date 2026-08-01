"use client"

import { useState, useEffect, useTransition } from "react"
import { getAbcAnalysisData, manualTriggerReplenishment } from "../actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw } from "lucide-react"
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
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">Аналитика</h2>
                <Button 
                    onClick={handleRecalculate} 
                    disabled={isPending}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-sm"
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
                    Обновить
                </Button>
            </div>

            {/* Inventory Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="shadow-none border-border/80">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Товаров в наличии</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold text-slate-900">{stats.totalProducts}</span>
                            <span className="text-xs text-slate-400">позиций</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-none border-border/80">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Сумма в закупе</p>
                        <p className="text-2xl font-bold text-slate-900">{Math.round(stats.stockCost).toLocaleString('ru-RU')} ₽</p>
                    </CardContent>
                </Card>
                <Card className="shadow-none border-border/80">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Сумма в продаже</p>
                        <p className="text-2xl font-bold text-slate-900">{Math.round(stats.stockValue).toLocaleString('ru-RU')} ₽</p>
                    </CardContent>
                </Card>
                <Card className="shadow-none border-border/80">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Потенц. прибыль</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold text-slate-900">{Math.round(potentialProfit).toLocaleString('ru-RU')} ₽</span>
                            <span className="text-xs text-slate-400">{stockMargin.toFixed(1)}%</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ABC Group Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="shadow-none border-border/80">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-green-500 mb-1">Группа A</p>
                        <p className="text-3xl font-bold text-slate-900">{stats.A.length}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Товаров-локомотивов · ~80% выручки</p>
                    </CardContent>
                </Card>
                <Card className="shadow-none border-border/80">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 mb-1">Группа B</p>
                        <p className="text-3xl font-bold text-slate-900">{stats.B.length}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Стабильные товары · ~15% выручки</p>
                    </CardContent>
                </Card>
                <Card className="shadow-none border-border/80">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Группа C</p>
                        <p className="text-3xl font-bold text-slate-900">{stats.C.length}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Малоценные товары · ~5% выручки</p>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Table */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50 bg-slate-50 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Детализация по товарам</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                            Выручка: {stats.totalRevenue.toLocaleString('ru-RU')} ₽
                        </span>
                        <span className="text-[10px] text-green-600 uppercase font-semibold tracking-wider">
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
                                    <TableCell className="text-right font-medium text-slate-500">
                                        {Number(item.total_revenue).toLocaleString('ru-RU')} ₽
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-green-600">
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
