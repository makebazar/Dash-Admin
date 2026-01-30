"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    TrendingUp, TrendingDown, DollarSign,
    Percent, ChevronLeft, ChevronRight, Settings
} from "lucide-react"
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TransactionList from '@/components/finance/TransactionList'
import FinanceReports from '@/components/finance/FinanceReports'
import { AccountBalances } from '@/components/finance/AccountBalances'

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

interface RecurringPayment {
    id: number
    name: string
    amount: number
    day_of_month: number
    category_id: number
    category_name?: string
    category_color?: string
    category_icon?: string
    is_consumption_based: boolean
    consumption_unit?: string
    default_unit_price?: number
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
}

import { CheckCircle2, AlertCircle, Zap } from "lucide-react"

export default function FinancePage() {
    const params = useParams()
    const clubId = params?.clubId as string

    const [activeTab, setActiveTab] = useState('dashboard')
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

    // Monthly Bills State
    const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([])
    const [monthTransactions, setMonthTransactions] = useState<any[]>([])
    const [isPaying, setIsPaying] = useState<number | null>(null)

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
            const startDateStr = startDate.toISOString().split('T')[0]
            const endDateStr = endDate.toISOString().split('T')[0]

            const res = await fetch(
                `/api/clubs/${clubId}/finance/analytics?start_date=${startDateStr}&end_date=${endDateStr}`
            )
            const data = await res.json()
            setAnalytics(data)

            // Fetch Recurring Templates
            const recRes = await fetch(`/api/clubs/${clubId}/finance/recurring`)
            if (recRes.ok) {
                const recData = await recRes.json()
                setRecurringPayments(recData.recurring_payments || [])
            }

            // Fetch Transactions for checks
            const txRes = await fetch(
                `/api/clubs/${clubId}/finance/transactions?start_date=${startDateStr}&end_date=${endDateStr}&page=1&limit=1000`
            )
            if (txRes.ok) {
                const txData = await txRes.json()
                setMonthTransactions(txData.transactions || [])
            }

        } catch (error) {
            console.error('Failed to fetch analytics:', error)
        } finally {
            setLoading(false)
        }
    }

    const checkIsPaid = (recurringId: number) => {
        return monthTransactions.some(t =>
            t.notes && t.notes.includes(`[Recurring:${recurringId}]`)
        )
    }

    const handlePayBill = async (rp: RecurringPayment) => {
        let amount = rp.amount;
        let notes = `Авто-платеж: ${rp.name} [Recurring:${rp.id}]`;

        if (rp.is_consumption_based) {
            const val = prompt(`Введите расход за месяц (${rp.consumption_unit}):`);
            if (val === null) return;
            const consumption = parseFloat(val);
            if (isNaN(consumption) || consumption < 0) {
                alert('Некорректное значение');
                return;
            }
            amount = consumption * (rp.default_unit_price || 0);
            notes = `${rp.name}: ${consumption} ${rp.consumption_unit} x ${rp.default_unit_price}₽ [Recurring:${rp.id}]`;

            if (!confirm(`К оплате: ${formatCurrency(amount)}. Создать транзакцию?`)) return;
        } else {
            if (!confirm(`Оплатить ${rp.name} (${formatCurrency(amount)})?`)) return;
        }

        setIsPaying(rp.id);
        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category_id: rp.category_id,
                    amount: amount,
                    type: 'expense',
                    transaction_date: new Date().toISOString().split('T')[0],
                    notes: notes,
                    payment_method: 'cash', // Default to cash for quick pay
                    status: 'completed'
                })
            });

            if (res.ok) {
                await fetchAnalytics(); // Refresh data
            } else {
                alert('Ошибка создания транзакции');
            }
        } catch (error) {
            console.error(error);
            alert('Ошибка выполнения');
        } finally {
            setIsPaying(null);
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
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setSelectedMonth(new Date().getMonth() + 1)
                            setSelectedYear(new Date().getFullYear())
                        }}
                    >
                        Сегодня
                    </Button>
                    <Link href={`/clubs/${clubId}/finance/settings`}>
                        <Button variant="outline">
                            <Settings className="h-4 w-4 mr-2" />
                            Настройки
                        </Button>
                    </Link>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex flex-wrap w-full h-auto bg-muted p-1">
                    <TabsTrigger value="dashboard" className="flex-1">📊 Dashboard</TabsTrigger>
                    <TabsTrigger value="transactions" className="flex-1">📝 Транзакции</TabsTrigger>
                    <TabsTrigger value="reports" className="flex-1">📈 Отчеты</TabsTrigger>
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

                    {/* Account Balances */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Остатки на счетах</h3>
                        <AccountBalances clubId={clubId} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Monthly Bills Widget */}
                        <Card className="md:col-span-1">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-amber-500" />
                                    Счета к оплате
                                </CardTitle>
                                <CardDescription>Обязательные платежи за этот месяц</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {recurringPayments.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        Нет регулярных платежей.
                                        <br />
                                        <Link href={`/clubs/${clubId}/finance/settings`} className="text-primary hover:underline">
                                            Настроить в Settings
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {recurringPayments.sort((a, b) => a.day_of_month - b.day_of_month).map(rp => {
                                            const isPaid = checkIsPaid(rp.id);
                                            return (
                                                <div key={rp.id} className={`flex items-center justify-between p-3 border rounded-lg ${isPaid ? 'bg-muted/50 opacity-70' : 'bg-card'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded flex items-center justify-center bg-primary/10 text-primary">
                                                            {rp.category_icon || '📅'}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium flex items-center gap-2">
                                                                {rp.name}
                                                                {isPaid && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Срок: до {rp.day_of_month}-го числа
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {isPaid ? (
                                                        <div className="text-sm font-medium text-green-600">
                                                            Оплачено
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handlePayBill(rp)}
                                                            disabled={isPaying === rp.id}
                                                            className={rp.is_consumption_based ? "bg-amber-600 hover:bg-amber-700" : ""}
                                                        >
                                                            {isPaying === rp.id ? '...' : (
                                                                rp.is_consumption_based ? (
                                                                    <>
                                                                        <Zap className="h-3 w-3 mr-1" />
                                                                        Внести
                                                                    </>
                                                                ) : (
                                                                    `Оплатить ${formatCurrency(rp.amount)}`
                                                                )
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Top Expenses Preview */}
                        <Card className="md:col-span-1">
                            <CardHeader>
                                <CardTitle className="text-sm">Топ-5 расходов</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {analytics?.top_expenses.slice(0, 5).map((expense, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm p-2 hover:bg-muted/50 rounded transition-colors">
                                            <span className="flex items-center gap-2">
                                                <span className="text-xl">{expense.icon}</span>
                                                <span className="text-muted-foreground">{expense.category_name}</span>
                                            </span>
                                            <span className="font-bold">{formatCurrency(expense.total_amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="transactions">
                    <TransactionList clubId={clubId} />
                </TabsContent>

                <TabsContent value="reports">
                    <FinanceReports clubId={clubId} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
