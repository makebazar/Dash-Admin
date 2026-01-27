"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Loader2, Calendar, Clock, DollarSign, ChevronLeft,
    ChevronRight, TrendingUp, TrendingDown, Wallet, Activity, Target
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Shift {
    id: string
    check_in: string
    check_out: string
    total_hours: number
    earnings: number
    total_revenue: number
    kpi_bonus: number
    status: string
    shift_type: string
}

interface SummaryItem {
    value: number
    diff: number
}

interface Summary {
    earnings: SummaryItem
    hours: SummaryItem
    revenue: SummaryItem
    shifts_count: SummaryItem
}

const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

export default function ShiftHistoryPage() {
    const params = useParams()
    const clubId = params.clubId as string

    const [shifts, setShifts] = useState<Shift[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const now = new Date()
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(now.getFullYear())

    const fetchHistory = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/employee/clubs/${clubId}/history?month=${selectedMonth}&year=${selectedYear}`)
            const data = await res.json()
            if (res.ok) {
                setShifts(data.shifts)
                setSummary(data.summary)
            }
        } catch (error) {
            console.error('Error fetching history:', error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId, selectedMonth, selectedYear])

    useEffect(() => {
        if (clubId) {
            fetchHistory()
        }
    }, [fetchHistory])

    const navigateMonth = (direction: number) => {
        let newMonth = selectedMonth + direction
        let newYear = selectedYear
        if (newMonth > 12) { newMonth = 1; newYear++ }
        else if (newMonth < 1) { newMonth = 12; newYear-- }
        setSelectedMonth(newMonth)
        setSelectedYear(newYear)
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'decimal',
            maximumFractionDigits: 0
        }).format(amount) + ' ₽'
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID':
                return <Badge className="bg-emerald-500 hover:bg-emerald-600 border-0">Оплачено</Badge>
            case 'VERIFIED':
                return <Badge className="bg-blue-500 hover:bg-blue-600 border-0">Проверено</Badge>
            case 'CLOSED':
                return <Badge variant="outline" className="text-slate-500 border-slate-300">Закрыта</Badge>
            default:
                return <Badge variant="secondary">{status}</Badge>
        }
    }

    const DiffBadge = ({ diff }: { diff: number }) => {
        if (diff === 0) return null
        const isPositive = diff > 0
        return (
            <div className={cn(
                "flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1 w-fit",
                isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            )}>
                {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {isPositive ? "+" : ""}{diff.toFixed(0)}%
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8 min-h-screen bg-slate-50/50">
            {/* Header & Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <Link
                        href={`/employee/clubs/${clubId}`}
                        className="text-xs font-bold text-muted-foreground flex items-center hover:text-purple-600 transition-colors mb-2 uppercase tracking-widest"
                    >
                        <ChevronLeft className="h-3 w-3 mr-1" />
                        Личный кабинет
                    </Link>
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900 leading-none">
                        История <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">смен</span>
                    </h1>
                </div>

                <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => navigateMonth(-1)}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="text-sm font-black min-w-[140px] text-center uppercase tracking-tight text-slate-700">
                        {monthNames[selectedMonth - 1]} {selectedYear}
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => navigateMonth(1)}>
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                    <div className="w-[1px] h-6 bg-slate-200 mx-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs font-bold text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-3 h-10 rounded-xl"
                        onClick={() => { setSelectedMonth(now.getMonth() + 1); setSelectedYear(now.getFullYear()) }}
                    >
                        Сегодня
                    </Button>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-0 shadow-lg bg-white overflow-hidden group">
                    <CardContent className="p-6 relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Wallet className="h-12 w-12 text-slate-900" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Заработано</p>
                        <div className="text-2xl font-black text-slate-900">{summary ? formatCurrency(summary.earnings.value) : '—'}</div>
                        {summary && <DiffBadge diff={summary.earnings.diff} />}
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white overflow-hidden group">
                    <CardContent className="p-6 relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Clock className="h-12 w-12 text-slate-900" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Отработано</p>
                        <div className="text-2xl font-black text-slate-900">{summary ? `${summary.hours.value.toFixed(1)} ч` : '—'}</div>
                        {summary && <DiffBadge diff={summary.hours.diff} />}
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white overflow-hidden group">
                    <CardContent className="p-6 relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Activity className="h-12 w-12 text-slate-900" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Выручка</p>
                        <div className="text-2xl font-black text-slate-900">{summary ? formatCurrency(summary.revenue.value) : '—'}</div>
                        {summary && <DiffBadge diff={summary.revenue.diff} />}
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white overflow-hidden group">
                    <CardContent className="p-6 relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Calendar className="h-12 w-12 text-slate-900" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Смен</p>
                        <div className="text-2xl font-black text-slate-900">{summary ? summary.shifts_count.value : '—'}</div>
                        {summary && <DiffBadge diff={summary.shifts_count.diff} />}
                    </CardContent>
                </Card>
            </div>

            {/* Shifts Table */}
            <Card className="border-0 shadow-2xl bg-white overflow-hidden rounded-3xl">
                <CardHeader className="bg-slate-900 text-white p-6">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-purple-400" />
                            Детализация за период
                        </CardTitle>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-widest">
                            Найдено: {shifts.length} смен
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex h-64 items-center justify-center bg-white/50 backdrop-blur-sm">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-slate-100 hover:bg-transparent">
                                        <TableHead className="w-[180px] font-black uppercase text-[10px] text-slate-500 tracking-widest pl-8">Дата</TableHead>
                                        <TableHead className="text-center font-black uppercase text-[10px] text-slate-500 tracking-widest">Часы</TableHead>
                                        <TableHead className="text-right font-black uppercase text-[10px] text-slate-500 tracking-widest">Выручка</TableHead>
                                        <TableHead className="text-right font-black uppercase text-[10px] text-purple-500 tracking-widest">Эффект. (₽/ч)</TableHead>
                                        <TableHead className="text-right font-black uppercase text-[10px] text-emerald-500 tracking-widest">KPI Бонус</TableHead>
                                        <TableHead className="text-right font-black uppercase text-[10px] text-slate-900 tracking-widest">Итого З/П</TableHead>
                                        <TableHead className="text-center font-black uppercase text-[10px] text-slate-500 tracking-widest pr-8">Статус</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shifts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-48 text-center text-slate-400 font-medium italic">
                                                Смены за этот период отсутствуют
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        shifts.map((shift) => {
                                            const sDate = new Date(shift.check_in)
                                            const hours = Number(shift.total_hours || 0)
                                            const revenue = Number(shift.total_revenue || 0)
                                            const efficiency = hours > 0 ? revenue / hours : 0

                                            return (
                                                <TableRow key={shift.id} className="group border-slate-50 hover:bg-slate-50/70 transition-all duration-300">
                                                    <TableCell className="pl-8 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-900 text-sm">
                                                                {sDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">
                                                                {sDate.toLocaleDateString('ru-RU', { weekday: 'long' })} • {shift.shift_type === 'night' ? 'Ночь' : 'День'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <td className="text-center">
                                                        <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-900 px-2 py-1 rounded-lg text-xs font-bold">
                                                            <Clock className="h-3 w-3 opacity-40" />
                                                            {hours.toFixed(1)} ч
                                                        </div>
                                                    </td>
                                                    <td className="text-right font-bold text-slate-700 text-sm">
                                                        {formatCurrency(revenue)}
                                                    </td>
                                                    <td className="text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-black text-purple-600 text-sm">{formatCurrency(efficiency)}</span>
                                                            <span className="text-[9px] text-muted-foreground uppercase font-bold">рублей в час</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-right">
                                                        <div className="flex items-center justify-end gap-1 font-bold text-emerald-600 text-sm">
                                                            <Target className="h-3 w-3 opacity-40" />
                                                            +{formatCurrency(shift.kpi_bonus)}
                                                        </div>
                                                    </td>
                                                    <td className="text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-black text-slate-900 text-lg leading-none">{formatCurrency(Number(shift.earnings || 0))}</span>
                                                            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-1">начислено</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-center pr-8">
                                                        {getStatusBadge(shift.status)}
                                                    </td>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
