"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    TrendingUp, TrendingDown, DollarSign, PieChart,
    Download, Calendar as CalendarIcon, FileText
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import DDSReport from "./DDSReport"

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { formatLocalDate } from "@/lib/utils"

const UITooltip = Tooltip

interface AnalyticsData {
    summary: {
        total_income: number
        total_expense: number
        profit: number
        profitability: number
        income_count: number
        expense_count: number
    }
    category_breakdown: {
        income: any[]
        expense: any[]
    }
    dds_breakdown?: any
}

interface FinanceReportsProps {
    clubId: string
}

export default function FinanceReports({ clubId }: FinanceReportsProps) {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [reportType, setReportType] = useState<string>('summary')

    const [analytics, setAnalytics] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        // Set default to current month
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        setStartDate(formatLocalDate(firstDay))
        setEndDate(formatLocalDate(lastDay))
    }, [])

    useEffect(() => {
        if (startDate && endDate) {
            fetchAnalytics()
        }
    }, [clubId, startDate, endDate])

    const fetchAnalytics = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate
            })
            const res = await fetch(`/api/clubs/${clubId}/finance/analytics?${params}`)
            const data = await res.json()
            setAnalytics(data)
        } catch (error) {
            console.error('Failed to fetch analytics:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            maximumFractionDigits: 0
        }).format(amount) + ' ₽'
    }

    const exportToCSV = () => {
        if (!analytics) return

        const rows = [
            ['Финансовый отчет'],
            ['Период:', `${startDate} - ${endDate}`],
            [''],
            ['Общая сводка'],
            ['Доходы:', analytics.summary.total_income],
            ['Расходы:', analytics.summary.total_expense],
            ['Прибыль:', analytics.summary.profit],
            ['Рентабельность:', `${analytics.summary.profitability}%`],
            [''],
            ['Категории доходов'],
            ['Категория', 'Сумма', 'Процент']
        ]

        analytics.category_breakdown.income.forEach((cat: any) => {
            rows.push([cat.name, cat.total_amount, `${cat.percentage}%`])
        })

        rows.push([''])
        rows.push(['Категории расходов'])
        rows.push(['Категория', 'Сумма', 'Процент'])

        analytics.category_breakdown.expense.forEach((cat: any) => {
            rows.push([cat.name, cat.total_amount, `${cat.percentage}%`])
        })

        const csvContent = rows.map(row => row.join(',')).join('\n')
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `finance_report_${startDate}_${endDate}.csv`
        link.click()
    }

    return (
        <div className="space-y-8">
            {/* Header Redesign */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-2xl font-black text-slate-900">Финансовая аналитика</h3>
                    <p className="text-sm font-medium text-slate-500">Глубокий анализ показателей и формирование отчетности</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportToCSV} disabled={!analytics} className="rounded-xl border-slate-200 hover:bg-slate-50 font-bold text-xs">
                        <Download className="h-4 w-4 mr-2 text-slate-500" />
                        Экспорт CSV
                    </Button>
                    <Button onClick={fetchAnalytics} disabled={loading} className="rounded-xl font-bold text-xs shadow-sm shadow-primary/10">
                        <PieChart className="h-4 w-4 mr-2" />
                        {loading ? 'Обновление...' : 'Сформировать'}
                    </Button>
                </div>
            </div>

            {/* Filters Redesign */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Начало периода</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Конец периода</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1.5">
                                Формат отчета
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-3 w-3 text-slate-300 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[200px]">
                                            <strong>ДДС</strong> — показывает движение реальных денег. <strong>Сводка</strong> — общие итоги по категориям.
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </Label>
                            <Select value={reportType} onValueChange={setReportType}>
                                <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="summary">📊 Общая сводка</SelectItem>
                                    <SelectItem value="dds">📑 Отчет ДДС (Cash Flow)</SelectItem>
                                    <SelectItem value="detailed">📋 Детальный анализ</SelectItem>
                                    <SelectItem value="comparison">🔄 Сравнение периодов</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            {/* DDS Report Integration */}
            {analytics && reportType === 'dds' && analytics.dds_breakdown && (
                <DDSReport 
                    data={analytics.dds_breakdown} 
                    formatCurrency={formatCurrency} 
                />
            )}

            {/* Summary Report Redesign */}
            {analytics && reportType === 'summary' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid gap-4 md:grid-cols-4">
                        <TooltipProvider>
                            <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-1 group hover:border-emerald-200 transition-all cursor-help">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Суммарный доход</p>
                                    <UITooltip>
                                        <TooltipTrigger>
                                            <Info className="h-3 w-3 text-slate-300" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Все пришедшие деньги за период.</TooltipContent>
                                    </UITooltip>
                                </div>
                                <div className="text-2xl font-black text-emerald-600">
                                    {formatCurrency(analytics.summary.total_income)}
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">
                                    {analytics.summary.income_count} операций
                                </p>
                            </div>

                            <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-1 group hover:border-rose-200 transition-all cursor-help">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Суммарный расход</p>
                                    <UITooltip>
                                        <TooltipTrigger>
                                            <Info className="h-3 w-3 text-slate-300" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Все выплаты и траты за период.</TooltipContent>
                                    </UITooltip>
                                </div>
                                <div className="text-2xl font-black text-rose-600">
                                    {formatCurrency(analytics.summary.total_expense)}
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">
                                    {analytics.summary.expense_count} операций
                                </p>
                            </div>

                            <div className="p-6 rounded-3xl bg-slate-900 shadow-xl shadow-slate-200 space-y-1 relative overflow-hidden group cursor-help">
                                <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-all" />
                                <div className="flex items-center justify-between relative z-10">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Чистая прибыль</p>
                                    <UITooltip>
                                        <TooltipTrigger>
                                            <Info className="h-3 w-3 text-slate-600" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Доход минус Расход. Ваша реальная выгода.</TooltipContent>
                                    </UITooltip>
                                </div>
                                <div className={`text-2xl font-black relative z-10 ${analytics.summary.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {formatCurrency(analytics.summary.profit)}
                                </div>
                            </div>

                            <div className="p-6 rounded-3xl bg-primary shadow-xl shadow-primary/20 space-y-1 relative overflow-hidden group cursor-help">
                                <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all" />
                                <div className="flex items-center justify-between relative z-10">
                                    <p className="text-[10px] font-black uppercase text-primary-foreground/60 tracking-tighter">Рентабельность</p>
                                    <UITooltip>
                                        <TooltipTrigger>
                                            <Info className="h-3 w-3 text-primary-foreground/40" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Эффективность: сколько копеек прибыли в каждом рубле выручки.</TooltipContent>
                                    </UITooltip>
                                </div>
                                <div className="text-3xl font-black text-white relative z-10">
                                    {analytics.summary.profitability.toFixed(1)}%
                                </div>
                            </div>
                        </TooltipProvider>
                    </div>

                    {/* Category Breakdown Redesign */}
                    <div className="grid gap-8 md:grid-cols-2">
                        {/* Income Categories */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 ml-2">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                                    <TrendingUp className="h-4 w-4" />
                                </div>
                                <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Структура доходов</h4>
                            </div>
                            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                                {analytics.category_breakdown.income.map((cat: any, idx: number) => (
                                    <div key={idx} className="space-y-2 group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                                                <div>
                                                    <div className="font-black text-slate-800 text-sm">{cat.name}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                                                        {cat.transaction_count} транз.
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-emerald-600 text-sm">
                                                    {formatCurrency(cat.total_amount)}
                                                </div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                    {cat.percentage?.toFixed(1)}% от общего
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-1 bg-slate-50 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                                style={{ width: `${cat.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {analytics.category_breakdown.income.length === 0 && (
                                    <div className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-widest">Нет данных</div>
                                )}
                            </div>
                        </div>

                        {/* Expense Categories */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 ml-2">
                                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner">
                                    <TrendingDown className="h-4 w-4" />
                                </div>
                                <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Структура расходов</h4>
                            </div>
                            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                                {analytics.category_breakdown.expense.map((cat: any, idx: number) => (
                                    <div key={idx} className="space-y-2 group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                                                <div>
                                                    <div className="font-black text-slate-800 text-sm">{cat.name}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                                                        {cat.transaction_count} транз.
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-rose-600 text-sm">
                                                    {formatCurrency(cat.total_amount)}
                                                </div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                    {cat.percentage?.toFixed(1)}% от общего
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-1 bg-slate-50 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-rose-500 rounded-full transition-all duration-1000"
                                                style={{ width: `${cat.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {analytics.category_breakdown.expense.length === 0 && (
                                    <div className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-widest">Нет данных</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
