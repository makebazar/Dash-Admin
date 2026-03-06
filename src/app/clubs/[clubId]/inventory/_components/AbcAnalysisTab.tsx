"use client"

import { useState, useEffect, useTransition } from "react"
import { getAbcAnalysisData, manualTriggerReplenishment } from "../actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AbcAnalysisTabProps {
    clubId: string
}

export function AbcAnalysisTab({ clubId }: AbcAnalysisTabProps) {
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
        totalRevenue: data.reduce((acc, curr) => acc + Number(curr.total_revenue), 0)
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <p className="text-sm font-medium">Загрузка аналитики...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">ABC Анализ</h2>
                    <p className="text-sm text-slate-500">Классификация товаров по вкладу в выручку за 30 дней</p>
                </div>
                <Button 
                    onClick={handleRecalculate} 
                    disabled={isPending}
                    variant="outline"
                    className="gap-2"
                >
                    <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                    Пересчитать
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <Badge className="bg-green-500 text-white font-black">Группа A</Badge>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900">{stats.A.length}</h3>
                    <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">Товаров-локомотивов</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: '80%' }} />
                        </div>
                        <span className="text-xs font-black text-green-600">~80% выручки</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-amber-50 rounded-lg">
                            <Info className="h-5 w-5 text-amber-600" />
                        </div>
                        <Badge className="bg-amber-500 text-white font-black">Группа B</Badge>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900">{stats.B.length}</h3>
                    <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">Стабильные товары</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: '15%' }} />
                        </div>
                        <span className="text-xs font-black text-amber-600">~15% выручки</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-400" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-slate-600" />
                        </div>
                        <Badge className="bg-slate-400 text-white font-black">Группа C</Badge>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900">{stats.C.length}</h3>
                    <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">Малоценные товары</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-400" style={{ width: '5%' }} />
                        </div>
                        <span className="text-xs font-black text-slate-600">~5% выручки</span>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        Детализация по товарам
                    </h4>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                        Всего выручки: {stats.totalRevenue.toLocaleString()} ₽
                    </span>
                </div>
                
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[50px] text-center">#</TableHead>
                                <TableHead>Товар</TableHead>
                                <TableHead className="text-center">Группа</TableHead>
                                <TableHead className="text-right">Выручка (30д)</TableHead>
                                <TableHead className="text-right">Доля в выручке</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((item, index) => (
                                <TableRow key={item.product_id} className="group hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="text-center text-slate-400 font-mono text-xs">
                                        {index + 1}
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-700">
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
                                    <TableCell className="text-right font-black text-slate-900">
                                        {Number(item.total_revenue).toLocaleString()} ₽
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-sm font-bold text-blue-600">{item.revenue_share}%</span>
                                            <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
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
                                    <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">
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
