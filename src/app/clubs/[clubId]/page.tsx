"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet, PiggyBank, Users, Clock, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Stats {
    revenue: { total: number; change: number }
    expenses: { total: number; change: number }
    balance: { actual: number }
    profit: { total: number; change: number }
}

interface Shift {
    id: string
    user_name: string
    role: string
    check_in: string
    total_hours: number
}

interface RevenueData {
    date: string
    revenue: number
}

export default function ClubDashboardPage({ params }: { params: Promise<{ clubId: string }> }) {
    const [clubId, setClubId] = useState<string>('')
    const [stats, setStats] = useState<Stats | null>(null)
    const [activeShifts, setActiveShifts] = useState<Shift[]>([])
    const [revenueData, setRevenueData] = useState<RevenueData[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchData(p.clubId)
        })
    }, [params])

    const fetchData = async (id: string) => {
        try {
            const [statsRes, shiftsRes, chartRes] = await Promise.all([
                fetch(`/api/clubs/${id}/stats`),
                fetch(`/api/clubs/${id}/active-shifts`),
                fetch(`/api/clubs/${id}/revenue-chart?days=7`)
            ])

            const [statsData, shiftsData, chartData] = await Promise.all([
                statsRes.json(),
                shiftsRes.json(),
                chartRes.json()
            ])

            if (statsRes.ok) setStats(statsData)
            if (shiftsRes.ok) setActiveShifts(shiftsData.shifts)
            if (chartRes.ok) setRevenueData(chartData.data)
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const StatCard = ({
        title,
        value,
        change,
        icon: Icon,
        trend
    }: {
        title: string
        value: string
        change?: number
        icon: any
        trend?: 'up' | 'down'
    }) => (
        <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-4 w-4 text-primary" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                {change !== undefined && (
                    <div className="mt-2 flex items-center gap-1 text-sm">
                        {trend === 'up' ? (
                            <>
                                <ArrowUpRight className="h-4 w-4 text-green-500" />
                                <span className="font-medium text-green-500">+{change}%</span>
                            </>
                        ) : (
                            <>
                                <ArrowDownRight className="h-4 w-4 text-red-500" />
                                <span className="font-medium text-red-500">{change}%</span>
                            </>
                        )}
                        <span className="text-muted-foreground">vs прошлый месяц</span>
                    </div>
                )}
            </CardContent>
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        </Card>
    )

    return (
        <div className="space-y-8 p-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Дашборд</h1>
                <p className="text-muted-foreground mt-1">
                    Обзор показателей клуба
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Выручка"
                    value={`${stats?.revenue.total.toLocaleString('ru-RU')} ₽`}
                    change={stats?.revenue.change}
                    trend={stats && stats.revenue.change >= 0 ? 'up' : 'down'}
                    icon={DollarSign}
                />
                <StatCard
                    title="Расходы"
                    value={`${stats?.expenses.total.toLocaleString('ru-RU')} ₽`}
                    change={stats?.expenses.change}
                    trend={stats && stats.expenses.change >= 0 ? 'down' : 'up'}
                    icon={CreditCard}
                />
                <StatCard
                    title="Баланс"
                    value={`${stats?.balance.actual.toLocaleString('ru-RU')} ₽`}
                    icon={Wallet}
                />
                <StatCard
                    title="Прибыль"
                    value={`${stats?.profit.total.toLocaleString('ru-RU')} ₽`}
                    change={stats?.profit.change}
                    trend={stats && stats.profit.change >= 0 ? 'up' : 'down'}
                    icon={PiggyBank}
                />
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 lg:grid-cols-7">
                {/* Revenue Chart */}
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Выручка за последние 7 дней</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={350}>
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                                <XAxis
                                    dataKey="date"
                                    className="text-xs"
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                                />
                                <YAxis className="text-xs" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px'
                                    }}
                                    labelFormatter={(value) => new Date(value).toLocaleDateString('ru-RU')}
                                    formatter={(value: number) => [`${value.toLocaleString('ru-RU')} ₽`, 'Выручка']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Active Shifts */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Активные смены
                            </CardTitle>
                            <Badge variant="secondary" className="text-xs">
                                {activeShifts.length}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {activeShifts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="rounded-full bg-muted p-4 mb-4">
                                    <Users className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Нет активных смен
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeShifts.map((shift) => (
                                    <div
                                        key={shift.id}
                                        className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-lg bg-primary/10 p-2">
                                                <Users className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{shift.user_name}</p>
                                                <p className="text-sm text-muted-foreground">{shift.role}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-sm font-medium">
                                                <Clock className="h-3 w-3 text-muted-foreground" />
                                                {new Date(shift.check_in).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {shift.total_hours.toFixed(1)}ч
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
