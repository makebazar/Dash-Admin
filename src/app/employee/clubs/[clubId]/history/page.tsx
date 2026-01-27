"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Loader2, Calendar, Clock, ChevronLeft,
    ChevronRight, TrendingUp, TrendingDown, Sun, Moon
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
    total_expenses: number
    cash_income: number
    card_income: number
    kpi_bonus: number
    status: string
    shift_type: string
    employee_name: string
    report_data: any
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
    const [metricMetadata, setMetricMetadata] = useState<Record<string, any>>({})
    const [dynamicColumns, setDynamicColumns] = useState<string[]>([])
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
                setMetricMetadata(data.metric_metadata || {})

                // Determine dynamic columns based on metadata
                // Filter for INCOME metrics that are present in at least one shift or just from metadata
                // Excluding standard ones
                const metadata = data.metric_metadata || {};
                const dynCols = Object.keys(metadata).filter(key =>
                    metadata[key].category === 'INCOME' &&
                    key !== 'cash_income' &&
                    key !== 'card_income' &&
                    key !== 'total_revenue' &&
                    key !== 'total_income'
                );
                setDynamicColumns(dynCols);
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

    const formatCurrency = (amount: number, showColor: boolean = false) => {
        const formatted = new Intl.NumberFormat('ru-RU', {
            style: 'decimal',
            maximumFractionDigits: 0
        }).format(amount) + ' ₽'

        if (!showColor || amount === 0) return formatted;

        return <span className={amount > 0 ? "text-emerald-600" : "text-rose-500"}>{formatted}</span>
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID':
                return <Badge variant="outline" className="bg-blue-50 text-blue-500 border-blue-100 rounded-full px-4 py-0.5 text-[10px] font-bold">Оплачено</Badge>
            case 'VERIFIED':
                return <Badge variant="outline" className="bg-emerald-50 text-emerald-500 border-emerald-100 rounded-full px-4 py-0.5 text-[10px] font-bold">Проверено</Badge>
            case 'CLOSED':
                return <Badge variant="outline" className="bg-blue-50 text-blue-500 border-blue-100 rounded-full px-4 py-0.5 text-[10px] font-bold">Закрыта</Badge>
            case 'ACTIVE':
                return <Badge variant="outline" className="bg-amber-50 text-amber-500 border-amber-100 rounded-full px-4 py-0.5 text-[10px] font-bold">Активна</Badge>
            default:
                return <Badge variant="secondary" className="rounded-full px-4 py-0.5 text-[10px] font-bold">{status}</Badge>
        }
    }

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '-'
        // Using 'en-GB' to force 24h format without AM/PM and potential timezone mess if defaulting to US
        return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }

    const getShiftType = (shift: Shift) => {
        // Prefer explicit type if available
        if (shift.shift_type === 'night') return { icon: <Moon className="h-3 w-3 text-blue-400" />, label: 'Ночь' }
        if (shift.shift_type === 'day') return { icon: <Sun className="h-3.5 w-3.5 text-amber-400" />, label: 'День' }

        // Fallback based on check_in time
        const hour = new Date(shift.check_in).getHours()
        if (hour >= 20 || hour < 5) return { icon: <Moon className="h-3 w-3 text-blue-400" />, label: 'Ночь' }
        return { icon: <Sun className="h-3.5 w-3.5 text-amber-400" />, label: 'День' }
    }

    const DiffBadge = ({ diff }: { diff: number }) => {
        const isPositive = diff > 0
        return (
            <div className={cn(
                "flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-lg mt-1 w-fit",
                isPositive ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"
            )}>
                {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {isPositive ? "+" : ""}{diff.toFixed(0)}%
            </div>
        )
    }

    return (
        <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6 min-h-screen bg-[#FDFDFD]">
            {/* Header & Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                <div className="space-y-1">
                    <Link
                        href={`/employee/clubs/${clubId}`}
                        className="text-[10px] font-bold text-muted-foreground flex items-center hover:text-slate-900 transition-colors mb-1 uppercase tracking-widest"
                    >
                        <ChevronLeft className="h-3 w-3 mr-1" />
                        Личный кабинет
                    </Link>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900">
                        История <span className="text-purple-600">смен</span>
                    </h1>
                </div>

                <div className="flex items-center gap-2 bg-slate-50/80 p-1 rounded-2xl border border-slate-100">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-white hover:shadow-sm" onClick={() => navigateMonth(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-xs font-black min-w-[120px] text-center uppercase tracking-tight text-slate-700">
                        {monthNames[selectedMonth - 1]} {selectedYear}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-white hover:shadow-sm" onClick={() => navigateMonth(1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] font-black text-purple-600 hover:text-purple-700 hover:bg-white hover:shadow-sm px-3 h-8 rounded-xl"
                        onClick={() => { setSelectedMonth(now.getMonth() + 1); setSelectedYear(now.getFullYear()) }}
                    >
                        Сегодня
                    </Button>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid gap-4 md:grid-cols-4 px-2">
                {[
                    { label: 'Заработано', value: summary ? formatCurrency(summary.earnings.value) : '—', diff: summary?.earnings.diff, icon: <TrendingUp className="h-5 w-5 text-slate-300" /> },
                    { label: 'Отработано', value: summary ? `${summary.hours.value.toFixed(1)} ч` : '—', diff: summary?.hours.diff, icon: <Clock className="h-5 w-5 text-slate-300" /> },
                    { label: 'Выручка', value: summary ? formatCurrency(summary.revenue.value) : '—', diff: summary?.revenue.diff, icon: <TrendingUp className="h-5 w-5 text-slate-300" /> },
                    { label: 'Смен', value: summary ? summary.shifts_count.value : '—', diff: summary?.shifts_count.diff, icon: <Calendar className="h-5 w-5 text-slate-300" /> }
                ].map((item, idx) => (
                    <Card key={idx} className="border-0 shadow-sm bg-white rounded-2xl transition-all hover:shadow-md">
                        <CardContent className="p-5 flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{item.label}</p>
                                <div className="text-xl font-black text-slate-900">{item.value}</div>
                                {item.diff !== undefined && <DiffBadge diff={item.diff} />}
                            </div>
                            <div className="p-2 bg-slate-50 rounded-xl">
                                {item.icon}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Table Header */}
            <div className="px-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">История смен</h3>
                <p className="text-[11px] text-slate-400">Последние 100 смен с отчетами. Данные пересчитываются автоматически.</p>
            </div>

            {/* Shifts Table */}
            <div className="overflow-x-auto px-2 pb-10">
                <Table className="border-collapse">
                    <TableHeader>
                        <TableRow className="border-slate-50 hover:bg-transparent">
                            <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-tight py-4">Дата ↑↓</TableHead>
                            <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-tight">Тип</TableHead>
                            {/* Employee column removed */}
                            <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-tight">Время</TableHead>
                            <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-tight">Часы ↑↓</TableHead>
                            <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-tight">Нал ↑↓</TableHead>
                            <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-tight">Безнал ↑↓</TableHead>
                            <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-tight">Расходы ↑↓</TableHead>
                            {/* Dynamic Columns Header */}
                            {dynamicColumns.map(colKey => (
                                <TableHead key={colKey} className="font-bold text-[11px] text-slate-400 uppercase tracking-tight">
                                    {metricMetadata[colKey]?.label || colKey}
                                </TableHead>
                            ))}
                            <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-tight text-right pr-4">Статус</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8 + dynamicColumns.length} className="h-32 text-center">
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-300" />
                                </TableCell>
                            </TableRow>
                        ) : shifts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8 + dynamicColumns.length} className="h-32 text-center text-slate-400 text-xs italic">
                                    Нет данных за этот период
                                </TableCell>
                            </TableRow>
                        ) : (
                            shifts.map((shift) => {
                                const sDate = new Date(shift.check_in)
                                const typeInfo = getShiftType(shift)

                                return (
                                    <TableRow key={shift.id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="py-4 font-bold text-[13px] text-slate-900">
                                            {sDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 font-bold text-[12px] text-slate-600">
                                                {typeInfo.icon} {typeInfo.label}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[12px] text-slate-500 font-medium whitespace-nowrap">
                                            {formatTime(shift.check_in)} — {formatTime(shift.check_out)}
                                        </TableCell>
                                        <TableCell className="font-bold text-[12px] text-slate-500">
                                            {Number(shift.total_hours || 0).toFixed(1)}ч
                                        </TableCell>
                                        <TableCell className="font-bold text-[12px]">
                                            {formatCurrency(Number(shift.cash_income || 0), true)}
                                        </TableCell>
                                        <TableCell className="font-bold text-[12px]">
                                            {formatCurrency(Number(shift.card_income || 0), true)}
                                        </TableCell>
                                        <TableCell className="font-bold text-[12px]">
                                            {formatCurrency(Number(shift.total_expenses || 0), true)}
                                        </TableCell>
                                        {/* Dynamic Columns Cells */}
                                        {dynamicColumns.map(colKey => {
                                            const val = shift.report_data?.[colKey] || 0;
                                            return (
                                                <TableCell key={colKey} className="font-bold text-[12px] text-slate-500">
                                                    {val > 0 ? formatCurrency(parseFloat(val)) : '—'}
                                                </TableCell>
                                            )
                                        })}
                                        <TableCell className="text-right pr-4">
                                            {getStatusBadge(shift.status)}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
