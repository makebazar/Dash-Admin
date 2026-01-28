"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    TrendingUp, TrendingDown, DollarSign, PieChart,
    Download, Calendar as CalendarIcon
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

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

        setStartDate(firstDay.toISOString().split('T')[0])
        setEndDate(lastDay.toISOString().split('T')[0])
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
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold">Финансовые отчеты</h3>
                <p className="text-sm text-muted-foreground">
                    Детальная аналитика и экспорт данных
                </p>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Параметры отчета</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label>Дата начала</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Дата окончания</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Тип отчета</Label>
                            <Select value={reportType} onValueChange={setReportType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="summary">Общая сводка</SelectItem>
                                    <SelectItem value="detailed">Детальный</SelectItem>
                                    <SelectItem value="comparison">Сравнение периодов</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={fetchAnalytics} disabled={loading}>
                            <PieChart className="h-4 w-4 mr-2" />
                            {loading ? 'Загрузка...' : 'Сформировать отчет'}
                        </Button>
                        <Button variant="outline" onClick={exportToCSV} disabled={!analytics}>
                            <Download className="h-4 w-4 mr-2" />
                            Экспорт в CSV
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Report */}
            {analytics && (
                <>
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Доходы</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-600">
                                    {formatCurrency(analytics.summary.total_income)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {analytics.summary.income_count} транзакций
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Расходы</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                    {formatCurrency(analytics.summary.total_expense)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {analytics.summary.expense_count} транзакций
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Прибыль</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${analytics.summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatCurrency(analytics.summary.profit)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Рентабельность</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${analytics.summary.profitability >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {analytics.summary.profitability.toFixed(1)}%
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Category Breakdown */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Income Categories */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                                    Категории доходов
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {analytics.category_breakdown.income.map((cat: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">{cat.icon}</span>
                                                <div>
                                                    <div className="font-medium text-sm">{cat.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {cat.transaction_count} транзакций
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-emerald-600">
                                                    {formatCurrency(cat.total_amount)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {cat.percentage?.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {analytics.category_breakdown.income.length === 0 && (
                                        <p className="text-center text-muted-foreground py-4">
                                            Нет данных
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Expense Categories */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <TrendingDown className="h-4 w-4 text-red-600" />
                                    Категории расходов
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {analytics.category_breakdown.expense.map((cat: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">{cat.icon}</span>
                                                <div>
                                                    <div className="font-medium text-sm">{cat.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {cat.transaction_count} транзакций
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-red-600">
                                                    {formatCurrency(cat.total_amount)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {cat.percentage?.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {analytics.category_breakdown.expense.length === 0 && (
                                        <p className="text-center text-muted-foreground py-4">
                                            Нет данных
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Monthly Trend */}
                    {analytics.monthly_trend?.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Динамика по месяцам</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {analytics.monthly_trend.map((month: any, idx: number) => {
                                        const date = new Date(month.month)
                                        const monthName = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

                                        return (
                                            <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                                                <div className="font-medium">{monthName}</div>
                                                <div className="flex gap-6 text-sm">
                                                    <span className="text-emerald-600">
                                                        ↑ {formatCurrency(month.income)}
                                                    </span>
                                                    <span className="text-red-600">
                                                        ↓ {formatCurrency(month.expense)}
                                                    </span>
                                                    <span className={`font-bold ${month.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        = {formatCurrency(month.profit)}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    )
}
