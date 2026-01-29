"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    TrendingUp, TrendingDown, DollarSign, Wallet,
    Calendar, AlertCircle, ArrowUpRight, ArrowDownRight,
    Percent, Target, Clock, ChevronLeft, ChevronRight
} from "lucide-react"
import { useParams } from 'next/navigation'
import TransactionList from '@/components/finance/TransactionList'
import RecurringPayments from '@/components/finance/RecurringPayments'
import FinanceReports from '@/components/finance/FinanceReports'
import RevenueImport from '@/components/finance/RevenueImport'

interface FinanceStats {
    total_income: number
    total_expense: number
    profit: number
    profitability: number
}

interface CategoryItem {
    id: number
    name: string
    icon: string
    color: string
    total_amount: number
    transaction_count: number
    percentage: number
}

interface TrendItem {
    month: string
    income: number
    expense: number
    profit: number
}

interface AnalyticsData {
    summary: FinanceStats
    category_breakdown: {
        income: CategoryItem[]
        expense: CategoryItem[]
    }
    monthly_trend: TrendItem[]
    cash_flow_forecast: {
        30: { income: number; expense: number; net: number }
        60: { income: number; expense: number; net: number }
        90: { income: number; expense: number; net: number }
    }
    top_expenses: Array<{
        category_name: string
        icon: string
        total_amount: number
        transaction_count: number
    }>
    break_even_point: number
    upcoming_payments: Array<{
        id: number
        amount: number
        type: string
        transaction_date: string
        description: string
        category_name: string
        icon: string
    }>
}

export default function FinancePage() {
    const params = useParams()
    const clubId = params?.clubId as string

    const [activeTab, setActiveTab] = useState('dashboard')
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

    useEffect(() => {
        if (clubId) {
            fetchAnalytics()
        }
    }, [clubId, selectedMonth, selectedYear])

    const fetchAnalytics = async () => {
        setLoading(true)
        try {
            // Calculate start and end dates for selected month
            const startDate = new Date(selectedYear, selectedMonth - 1, 1)
            const endDate = new Date(selectedYear, selectedMonth, 0)

            const res = await fetch(
                `/api/clubs/${clubId}/finance/analytics?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`
            )
            const data = await res.json()
            setAnalytics(data)
        } catch (error) {
            console.error('Failed to fetch analytics:', error)
        } finally {
            setLoading(false)
        }
    }

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
            maximumFractionDigits: 0
        }).format(amount) + ' ₽'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Загрузка финансовых данных...</p>
                </div>
            </div>
        )
    }

    const summary = analytics?.summary || {
        total_income: 0,
        total_expense: 0,
        profit: 0,
        profitability: 0
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold tracking-tight">💰 Финансы</h1>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="text-lg font-medium min-w-[160px] text-center">
                            {monthNames[selectedMonth - 1]} {selectedYear}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    onClick={() => {
                        setSelectedMonth(new Date().getMonth() + 1)
                        setSelectedYear(new Date().getFullYear())
                    }}
                >
                    Сегодня
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
                    <TabsTrigger value="transactions">📝 Транзакции</TabsTrigger>
                    <TabsTrigger value="recurring">🔄 Повторяющиеся</TabsTrigger>
                    <TabsTrigger value="import">Импорт</TabsTrigger>
                    <TabsTrigger value="credits">💳 Кредиты</TabsTrigger>
                    <TabsTrigger value="reports">📈 Отчеты</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-6">
                    {/* Key Metrics */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Доходы
                                </CardTitle>
                                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                                    <TrendingUp className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold tracking-tight text-emerald-600">
                                    {formatCurrency(summary.total_income)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    за выбранный период
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Расходы
                                </CardTitle>
                                <div className="rounded-lg bg-red-100 p-2 text-red-700">
                                    <TrendingDown className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold tracking-tight text-red-600">
                                    {formatCurrency(summary.total_expense)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    за выбранный период
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Прибыль
                                </CardTitle>
                                <div className={`rounded-lg p-2 ${summary.profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    <DollarSign className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold tracking-tight ${summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatCurrency(summary.profit)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {summary.profit >= 0 ? 'положительная' : 'убыток'}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Рентабельность
                                </CardTitle>
                                <div className="rounded-lg bg-primary/20 p-2 text-primary">
                                    <Percent className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold tracking-tight text-primary">
                                    {summary.profitability.toFixed(1)}%
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    ключевой показатель
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Upcoming Payments & Break-even */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Upcoming Payments */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-primary" />
                                    Предстоящие платежи (7 дней)
                                </CardTitle>
                                <CardDescription>Запланированные транзакции</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {analytics?.upcoming_payments && analytics.upcoming_payments.length > 0 ? (
                                    <div className="space-y-3">
                                        {analytics.upcoming_payments.map((payment) => (
                                            <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{payment.icon}</span>
                                                    <div>
                                                        <p className="font-medium text-sm">{payment.category_name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {new Date(payment.transaction_date).toLocaleDateString('ru-RU')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={`font-bold ${payment.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {payment.type === 'income' ? '+' : '-'}{formatCurrency(payment.amount)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-muted-foreground py-8">
                                        Нет запланированных платежей
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Break-even & Top Expenses */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Target className="h-5 w-5 text-primary" />
                                        Точка безубыточности
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold text-primary">
                                        {formatCurrency(analytics?.break_even_point || 0)}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Минимальная выручка для покрытия постоянных расходов
                                    </p>
                                    {summary.total_income >= (analytics?.break_even_point || 0) ? (
                                        <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700 text-xs">
                                            <ArrowUpRight className="h-4 w-4" />
                                            Точка безубыточности достигнута!
                                        </div>
                                    ) : (
                                        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-xs">
                                            <AlertCircle className="h-4 w-4" />
                                            Недостаточно для покрытия расходов
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Top Expenses Preview */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Топ-5 расходов</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {analytics?.top_expenses.slice(0, 3).map((expense, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm">
                                                <span className="flex items-center gap-2">
                                                    <span>{expense.icon}</span>
                                                    <span className="text-muted-foreground">{expense.category_name}</span>
                                                </span>
                                                <span className="font-bold">{formatCurrency(expense.total_amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="transactions">
                    <TransactionList clubId={clubId} />
                </TabsContent>

                <TabsContent value="recurring">
                    <RecurringPayments clubId={clubId} />
                </TabsContent>

                <TabsContent value="import">
                    <RevenueImport clubId={clubId} />
                </TabsContent>

                <TabsContent value="credits">
                    <Card>
                        <CardHeader>
                            <CardTitle>Кредиты и займы</CardTitle>
                            <CardDescription>Отслеживание долговых обязательств</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-center py-8">
                                Функционал управления кредитами будет добавлен в следующей версии.
                                <br />
                                <span className="text-xs">(Таблица finance_credits уже создана в БД)</span>
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="reports">
                    <FinanceReports clubId={clubId} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
