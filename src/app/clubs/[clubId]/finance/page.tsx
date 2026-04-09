"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    TrendingUp, TrendingDown, DollarSign,
    Percent, ChevronLeft, ChevronRight, Settings, Plus,
    Calendar as CalendarIcon, Info, CreditCard, Wallet, Banknote
} from "lucide-react"
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PageShell } from '@/components/layout/PageShell'
import TransactionList from '@/components/finance/TransactionList'
import FinanceReports from '@/components/finance/FinanceReports'
import { AccountBalances } from '@/components/finance/AccountBalances'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
    Tooltip as UITooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

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
    dds_breakdown: {
        operating: { income: number; expense: number; net: number }
        investing: { income: number; expense: number; net: number }
        financing: { income: number; expense: number; net: number }
    }
    break_even_point: number
}

import { CheckCircle2, Zap } from "lucide-react"
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
            return sum + (t.type === 'expense' ? amount : -amount)
        }, 0)

        let status = 'unpaid'
        if (targetAmount > 0) {
            if (paidAmount >= targetAmount) status = 'paid'
            else if (paidAmount > 0) status = 'partial'
        } else {
            if (paidAmount > 0) status = 'paid'
        }

        return {
            status,
            paidAmount,
            remainingAmount: targetAmount > 0 ? Math.max(0, targetAmount - paidAmount) : 0
        }
    }

    const openPaymentModal = (rp: RecurringPayment, initialAmount?: number) => {
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
                    payment_method: 'cash',
                    account_id: data.accountId,
                    status: 'completed'
                })
            });

            if (res.ok) {
                await fetchAnalytics();
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

    const formatShortCurrency = (amount: number) => {
        if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M ₽'
        if (amount >= 1000) return (amount / 1000).toFixed(0) + 'K ₽'
        return amount + ' ₽'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground animate-pulse font-medium">Загрузка финансовых данных...</p>
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

    const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

    return (
        <PageShell maxWidth="5xl">
            {/* Header Redesign */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                <div className="space-y-1">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Финансы</h1>
                    <p className="text-slate-500 text-lg mt-2">Аналитика, ДДС и планирование платежей</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 w-full sm:w-auto justify-between sm:justify-start">
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} className="hover:bg-slate-50 rounded-xl h-10 w-10 shrink-0 border border-slate-200">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2 px-4 py-1 font-bold text-slate-700 whitespace-nowrap">
                            <CalendarIcon className="h-4 w-4 text-primary" />
                            <span className="min-w-[110px] text-center text-sm">
                                {monthNames[selectedMonth - 1]} {selectedYear}
                            </span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} className="hover:bg-slate-50 rounded-xl h-10 w-10 shrink-0 border border-slate-200">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Link href={`/clubs/${clubId}/finance/settings`} className="flex-1 sm:flex-none">
                            <Button variant="outline" className="w-full rounded-xl border-slate-200 hover:bg-slate-50 font-medium h-12 px-6 shadow-sm">
                                <Settings className="h-4 w-4 mr-2 text-slate-500" />
                                <span className="hidden sm:inline">Настройки</span>
                                <span className="sm:hidden">Настройки</span>
                            </Button>
                        </Link>
                        <Button 
                            onClick={() => { setActiveTab('transactions'); setTimeout(() => setTransactionDialogOpen(true), 100); }}
                            className="flex-[2] sm:flex-none rounded-xl bg-slate-900 text-white shadow-sm hover:bg-slate-800 font-medium h-12 px-6"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Новая операция
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full md:w-auto bg-slate-100/50 border border-slate-200 p-1.5 rounded-2xl mb-8 shadow-sm">
                    <TabsTrigger value="dashboard" className="rounded-xl px-6 py-2.5 font-medium text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all">Дашборд</TabsTrigger>
                    <TabsTrigger value="transactions" className="rounded-xl px-6 py-2.5 font-medium text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all">Операции</TabsTrigger>
                    <TabsTrigger value="reports" className="rounded-xl px-6 py-2.5 font-medium text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all">Отчеты ДДС</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-6 focus-visible:outline-none">
                    {/* Education block for beginners */}
                    <div className="bg-blue-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-blue-200">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                                💡
                            </div>
                            <div className="flex-1 text-center md:text-left space-y-1">
                                <h3 className="text-xl font-black tracking-tight">Добро пожаловать в центр управления финансами!</h3>
                                <p className="text-blue-100 text-sm font-medium leading-relaxed max-w-3xl">
                                    Здесь вы можете видеть реальную прибыль клуба, контролировать остатки на счетах и планировать бюджет. 
                                    Используйте подсказки <Info className="inline h-3.5 w-3.5 opacity-70" /> на карточках, чтобы лучше разобраться в показателях.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Key Metrics Redesign */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <TooltipProvider>
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                                <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">

                                        Доходы
                                    </h3>
                                    <UITooltip>
                                        <TooltipTrigger>
                                            <TrendingUp className="h-4 w-4 text-emerald-500 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[200px] p-3 leading-relaxed">
                                            Сумма всех поступлений за выбранный месяц: выручка от смен, продажи на баре и прочие доходы.
                                        </TooltipContent>
                                    </UITooltip>
                                </div>
                                <div className="p-6 pt-0">
                                    <div className="text-2xl font-black text-slate-900">
                                        {formatCurrency(summary.total_income)}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded uppercase">За месяц</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                                <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">

                                        Расходы
                                    </h3>
                                    <UITooltip>
                                        <TooltipTrigger>
                                            <TrendingDown className="h-4 w-4 text-rose-500 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[200px] p-3 leading-relaxed">
                                            Все выплаты: зарплаты, закупка товаров, аренда и коммуналка. Показывает реальный отток денег.
                                        </TooltipContent>
                                    </UITooltip>
                                </div>
                                <div className="p-6 pt-0">
                                    <div className="text-2xl font-black text-slate-900">
                                        {formatCurrency(summary.total_expense)}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 rounded uppercase">Оплачено</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                                <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">

                                        Чистая прибыль
                                    </h3>
                                    <UITooltip>
                                        <TooltipTrigger>
                                            <DollarSign className="h-4 w-4 text-blue-500 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[200px] p-3 leading-relaxed">
                                            Остаток после вычета всех расходов из доходов. Если число отрицательное — клуб работает в убыток.
                                        </TooltipContent>
                                    </UITooltip>
                                </div>
                                <div className="p-6 pt-0">
                                    <div className={`text-2xl font-black ${summary.profit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                                        {formatCurrency(summary.profit)}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className={`text-[10px] font-bold px-1.5 rounded uppercase ${summary.profit >= 0 ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50'}`}>
                                            {summary.profit >= 0 ? 'Профит' : 'Убыток'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-sm text-white overflow-hidden relative group">
                                <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                                        Рентабельность
                                    </h3>
                                    <UITooltip>
                                        <TooltipTrigger>
                                            <Percent className="h-4 w-4 opacity-80 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[200px] p-3 leading-relaxed bg-slate-900 text-white">
                                            Процент прибыли от выручки. Показывает эффективность бизнеса. Хороший показатель для клуба — от 20%.
                                        </TooltipContent>
                                    </UITooltip>
                                </div>
                                <div className="p-6 pt-0">
                                    <div className="text-3xl font-black">
                                        {summary.profitability.toFixed(1)}%
                                    </div>
                                    <p className="text-[10px] font-bold uppercase opacity-80 mt-1 text-primary-foreground/70">
                                        Эффективность клуба
                                    </p>
                                </div>
                            </div>
                        </TooltipProvider>
                    </div>

                    {/* Main Charts & Accounts Grid */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Area Chart - Trend */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 lg:col-span-2 shadow-sm">
                            <div className="flex flex-row items-center justify-between mb-6">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Динамика потоков</h2>
                                        <TooltipProvider>
                                            <UITooltip>
                                                <TooltipTrigger>
                                                    <Info className="h-3.5 w-3.5 text-slate-300" />
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-[250px]">
                                                    Сравнение доходов и расходов во времени. В идеале линия <strong>Дохода</strong> (зеленая) должна быть всегда выше <strong>Расхода</strong> (красная).
                                                </TooltipContent>
                                            </UITooltip>
                                        </TooltipProvider>
                                    </div>
                                    <p className="text-sm font-medium text-slate-500 mt-1">Доходы и расходы за последние 6 месяцев</p>
                                </div>
                                <div className="flex gap-4 text-[10px] font-bold uppercase">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span>Доход</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                                        <span>Расход</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analytics?.monthly_trend || []}>
                                        <defs>
                                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="month" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}}
                                            tickFormatter={(val) => new Date(val).toLocaleDateString('ru-RU', {month: 'short'})}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}}
                                            tickFormatter={(val) => formatShortCurrency(val)}
                                        />
                                        <Tooltip 
                                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                                            formatter={(val: any) => [formatCurrency(Number(val)), '']}
                                            labelFormatter={(val) => new Date(val).toLocaleDateString('ru-RU', {month: 'long', year: 'numeric'})}
                                        />
                                        <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                                        <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Account Balances Widget */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col shadow-sm">
                            <div className="mb-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Счета и остатки</h2>
                                    <TooltipProvider>
                                        <UITooltip>
                                            <TooltipTrigger>
                                                <Info className="h-4 w-4 text-slate-400" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[200px]">
                                                Общий баланс по всем активным счетам клуба
                                            </TooltipContent>
                                        </UITooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto max-h-[380px] scrollbar-hide">
                                <AccountBalances clubId={clubId} />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* DDS Mini Summary */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 lg:col-span-2 shadow-sm">
                            <div className="mb-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Сводка ДДС</h2>
                                        <p className="text-sm font-medium text-slate-500 mt-1">Чистый поток по видам деятельности</p>
                                    </div>
                                    <Link href="#" onClick={(e) => { e.preventDefault(); setActiveTab('reports'); }} className="text-xs font-bold text-primary hover:underline">Детальный отчет</Link>
                                </div>
                            </div>
                            <div>
                                {analytics?.dds_breakdown && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <TooltipProvider>
                                            <UITooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 group hover:border-blue-200 transition-colors cursor-help">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                                <Wallet className="h-4 w-4" />
                                                            </div>
                                                            <span className="text-[10px] font-bold uppercase text-slate-500">Операционный</span>
                                                        </div>
                                                        <div className={`text-xl font-black ${analytics.dds_breakdown.operating.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {formatCurrency(analytics.dds_breakdown.operating.net)}
                                                        </div>
                                                        <div className="flex justify-between text-[10px] font-medium text-slate-400">
                                                            <span>+ {formatShortCurrency(analytics.dds_breakdown.operating.income)}</span>
                                                            <span>- {formatShortCurrency(analytics.dds_breakdown.operating.expense)}</span>
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" className="max-w-[250px] p-3 leading-relaxed">
                                                    <strong>Операционная деятельность</strong>: это «жизнь» клуба. Выручка, зарплаты, аренда и закупка товаров.
                                                </TooltipContent>
                                            </UITooltip>

                                            <UITooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 group hover:border-amber-200 transition-colors cursor-help">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                                                <CreditCard className="h-4 w-4" />
                                                            </div>
                                                            <span className="text-[10px] font-bold uppercase text-slate-500">Инвестиционный</span>
                                                        </div>
                                                        <div className={`text-xl font-black ${analytics.dds_breakdown.investing.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {formatCurrency(analytics.dds_breakdown.investing.net)}
                                                        </div>
                                                        <div className="flex justify-between text-[10px] font-medium text-slate-400">
                                                            <span>+ {formatShortCurrency(analytics.dds_breakdown.investing.income)}</span>
                                                            <span>- {formatShortCurrency(analytics.dds_breakdown.investing.expense)}</span>
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" className="max-w-[250px] p-3 leading-relaxed">
                                                    <strong>Инвестиционная деятельность</strong>: вложения в развитие. Покупка компов, ремонт и оборудование.
                                                </TooltipContent>
                                            </UITooltip>

                                            <UITooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 group hover:border-emerald-200 transition-colors cursor-help">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                                                <Banknote className="h-4 w-4" />
                                                            </div>
                                                            <span className="text-[10px] font-bold uppercase text-slate-500">Финансовый</span>
                                                        </div>
                                                        <div className={`text-xl font-black ${analytics.dds_breakdown.financing.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {formatCurrency(analytics.dds_breakdown.financing.net)}
                                                        </div>
                                                        <div className="flex justify-between text-[10px] font-medium text-slate-400">
                                                            <span>+ {formatShortCurrency(analytics.dds_breakdown.financing.income)}</span>
                                                            <span>- {formatShortCurrency(analytics.dds_breakdown.financing.expense)}</span>
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" className="max-w-[250px] p-3 leading-relaxed">
                                                    <strong>Финансовая деятельность</strong>: кредиты, вложения владельцев и выплата дивидендов.
                                                </TooltipContent>
                                            </UITooltip>
                                        </TooltipProvider>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top Expenses Redesign */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                            <div className="mb-6">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Основные расходы</h2>
                                    <TooltipProvider>
                                        <UITooltip>
                                            <TooltipTrigger>
                                                <Info className="h-3.5 w-3.5 text-slate-300" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[200px]">
                                                Топ-5 категорий, на которые клуб тратит больше всего денег в этом месяце.
                                            </TooltipContent>
                                        </UITooltip>
                                    </TooltipProvider>
                                </div>
                                <p className="text-sm font-medium text-slate-500 mt-1">Топ категорий за текущий месяц</p>
                            </div>
                            <div className="p-6 pt-0">
                                <div className="space-y-4">
                                    {analytics?.top_expenses.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400 font-medium">Расходы не найдены</div>
                                    ) : (
                                        analytics?.top_expenses.slice(0, 5).map((expense, idx) => (
                                            <div key={idx} className="space-y-1.5">
                                                <div className="flex items-center justify-between text-xs font-bold">
                                                    <span className="flex items-center gap-3 text-slate-700 font-medium">
                                                        <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-sm">{expense.icon}</div>
                                                        {expense.category_name}
                                                    </span>
                                                    <span className="text-slate-900">{formatCurrency(expense.total_amount)}</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full rounded-full transition-all duration-1000"
                                                        style={{ 
                                                            width: `${(expense.total_amount / (analytics?.summary.total_expense || 1)) * 100}%`,
                                                            backgroundColor: COLORS[idx % COLORS.length]
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Monthly Bills Widget Redesign */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 lg:col-span-3 shadow-sm">
                            <div className="flex flex-row items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Планируемые платежи</h2>
                                    <p className="text-sm font-medium text-slate-500 mt-1">Регулярные обязательства этого месяца</p>
                                </div>
                                <Link href={`/clubs/${clubId}/finance/settings`}>
                                    <Button variant="ghost" size="sm" className="text-xs font-bold text-primary">Настроить</Button>
                                </Link>
                            </div>
                            <div className="p-6 pt-0">
                                {recurringPayments.length === 0 ? (
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed">
                                        <p className="text-slate-400 font-medium text-sm">Нет регулярных платежей</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        {recurringPayments.sort((a, b) => a.day_of_month - b.day_of_month).map(rp => {
                                            const { status, paidAmount, remainingAmount } = getPaymentStatus(rp.id, rp.amount)
                                            const isPaid = status === 'paid'
                                            const isPartial = status === 'partial'

                                            return (
                                                <div key={rp.id} className={`p-4 rounded-2xl border transition-all ${isPaid ? 'bg-emerald-50/30 border-emerald-100 opacity-80' : 'bg-white border-slate-100 hover:border-primary/20 shadow-sm'}`}>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 text-lg shadow-inner">
                                                                {rp.category_icon || '📅'}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                                                    {rp.name}
                                                                    {isPaid && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                                                                </div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase">
                                                                    Дедлайн: {rp.day_of_month}-е число
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {isPaid ? (
                                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded uppercase">Оплачено</span>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => openPaymentModal(rp, isPartial ? remainingAmount : undefined)}
                                                                className={`h-8 text-[11px] font-bold rounded-lg ${rp.is_consumption_based ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                                                                variant={isPartial ? "secondary" : "default"}
                                                            >
                                                                {rp.is_consumption_based ? <><Zap className="h-3 w-3 mr-1" /> Внести</> : isPartial ? `+${formatShortCurrency(remainingAmount)}` : formatShortCurrency(rp.amount)}
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {isPartial && !rp.is_consumption_based && (
                                                        <div className="mt-3 space-y-1">
                                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                                                <span>Оплачено: {formatShortCurrency(paidAmount)}</span>
                                                                <span>{Math.round((paidAmount / rp.amount) * 100)}%</span>
                                                            </div>
                                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
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
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="transactions" className="space-y-4 focus-visible:outline-none">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div>
                            <TransactionList
                                clubId={clubId as string}
                                startDate={startDateStr}
                                endDate={endDateStr}
                                dialogOpen={transactionDialogOpen}
                                onDialogOpenChange={setTransactionDialogOpen}
                            />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="reports" className="focus-visible:outline-none">
                    <FinanceReports clubId={clubId} />
                </TabsContent>
            </Tabs>

            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                payment={selectedPayment}
                accounts={accounts}
                onConfirm={handleConfirmPayment}
            />
        </PageShell>
    )
}
