"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    TrendingUp, TrendingDown, DollarSign,
    Percent, ChevronLeft, ChevronRight, Settings, Plus
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
import { PaymentModal } from "./_components/PaymentModal"

export default function FinancePage() {
    const params = useParams()
    const clubId = params?.clubId as string

    const [activeTab, setActiveTab] = useState('dashboard')
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)

    // Monthly Bills State
    const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([])
    const [monthTransactions, setMonthTransactions] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])

    // Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [selectedPayment, setSelectedPayment] = useState<RecurringPayment | null>(null)

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

    // Calculate dates for selected month
    const startDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
    const endDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}`

    useEffect(() => {
        if (clubId) {
            fetchAnalytics()
        }
    }, [clubId, selectedMonth, selectedYear])

    const fetchAnalytics = async () => {
        setLoading(true)
        try {
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

            // Fetch Accounts
            const accRes = await fetch(`/api/clubs/${clubId}/finance/accounts`)
            if (accRes.ok) {
                const accData = await accRes.json()
                setAccounts(accData.accounts || [])
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

    const getPaymentStatus = (recurringId: number, targetAmount: number) => {
        const relevantTransactions = monthTransactions.filter(t =>
            t.notes && t.notes.includes(`[Recurring:${recurringId}]`)
        )

        const paidAmount = relevantTransactions.reduce((sum, t) => {
            const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount
            // Substract if it was an expense refund (though unlikely for bills)
            // Assuming all transactions linked are payments (expenses)
            return sum + (t.type === 'expense' ? amount : -amount)
        }, 0)

        // If targetAmount is 0 (e.g. variable consumption), it's only paid if we have actually paid something (> 0)
        let status = 'unpaid'
        if (targetAmount > 0) {
            if (paidAmount >= targetAmount) status = 'paid'
            else if (paidAmount > 0) status = 'partial'
        } else {
            // For variable amount items (target = 0)
            if (paidAmount > 0) status = 'paid'
        }

        return {
            status,
            paidAmount,
            remainingAmount: targetAmount > 0 ? Math.max(0, targetAmount - paidAmount) : 0
        }
    }

    const openPaymentModal = (rp: RecurringPayment, initialAmount?: number) => {
        // If initialAmount is provided (partial payment remainder), override the default amount
        // We do this by creating a copy of the payment object with the modified amount
        const paymentToEdit = initialAmount !== undefined
            ? { ...rp, amount: initialAmount }
            : rp

        setSelectedPayment(paymentToEdit)
        setIsPaymentModalOpen(true)
    }

    const handleConfirmPayment = async (data: { amount: number, date: string, notes: string, accountId: number }) => {
        if (!selectedPayment) return

        try {
            const res = await fetch(`/api/clubs/${clubId}/finance/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category_id: selectedPayment.category_id,
                    amount: data.amount,
                    type: 'expense',
                    transaction_date: data.date,
                    notes: data.notes,
                    payment_method: 'cash', // Keep as fallback or derive from account type
                    account_id: data.accountId,
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
                    <TabsTrigger value="dashboard" className="flex-1">📊 Обзор</TabsTrigger>
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
                        {/* Quick Add Transaction Widget */}
                        <Card className="md:col-span-1 bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Plus className="h-5 w-5 text-primary" />
                                    Быстрое добавление
                                </CardTitle>
                                <CardDescription>Создать транзакцию в один клик</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center py-8">
                                <Button
                                    size="lg"
                                    className="w-full max-w-xs"
                                    onClick={() => {
                                        setActiveTab('transactions');
                                        setTimeout(() => setTransactionDialogOpen(true), 100);
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Создать транзакцию
                                </Button>
                                <p className="text-xs text-muted-foreground mt-4 text-center">
                                    Переключит на вкладку транзакций и откроет форму создания
                                </p>
                            </CardContent>
                        </Card>

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
                                            const { status, paidAmount, remainingAmount } = getPaymentStatus(rp.id, rp.amount)
                                            const isPaid = status === 'paid'
                                            const isPartial = status === 'partial'

                                            return (
                                                <div key={rp.id} className={`p-3 border rounded-lg ${isPaid ? 'bg-muted/50 opacity-70' : 'bg-card'}`}>
                                                    <div className="flex items-center justify-between mb-2">
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
                                                            <div className="flex flex-col items-end gap-1">
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => openPaymentModal(rp, isPartial ? remainingAmount : undefined)}
                                                                    className={rp.is_consumption_based ? "bg-amber-600 hover:bg-amber-700" : ""}
                                                                    variant={isPartial ? "secondary" : "default"}
                                                                >
                                                                    {rp.is_consumption_based ? (
                                                                        <>
                                                                            <Zap className="h-3 w-3 mr-1" />
                                                                            Внести
                                                                        </>
                                                                    ) : (
                                                                        isPartial ? `Доплатить ${formatCurrency(remainingAmount)}` : `Оплатить ${formatCurrency(rp.amount)}`
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Progress Bar for Partial Payments */}
                                                    {isPartial && !rp.is_consumption_based && (
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                                <span>Оплачено: {formatCurrency(paidAmount)}</span>
                                                                <span>из {formatCurrency(rp.amount)}</span>
                                                            </div>
                                                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                                                                    style={{ width: `${Math.min(100, (paidAmount / rp.amount) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <PaymentModal
                            isOpen={isPaymentModalOpen}
                            onClose={() => setIsPaymentModalOpen(false)}
                            payment={selectedPayment}
                            accounts={accounts}
                            onConfirm={handleConfirmPayment}
                        />

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

                <TabsContent value="transactions" className="space-y-4">
                    <TransactionList
                        clubId={clubId as string}
                        startDate={startDateStr}
                        endDate={endDateStr}
                        dialogOpen={transactionDialogOpen}
                        onDialogOpenChange={setTransactionDialogOpen}
                    />
                </TabsContent>

                <TabsContent value="reports">
                    <FinanceReports clubId={clubId} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
