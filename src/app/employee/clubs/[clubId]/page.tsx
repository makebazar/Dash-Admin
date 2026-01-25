"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Clock, Loader2, LogIn, LogOut, Wallet, Activity, Calendar,
    TrendingUp, Target, Zap, ChevronRight, Trophy
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ClubInfo {
    id: number
    name: string
    role: string
}

interface ActiveShift {
    id: number
    check_in: string
    total_hours: number
}

interface Stats {
    today_hours: number
    week_hours: number
    week_earnings: number
    month_earnings: number
    hourly_rate: number
    last_week_hours?: number
}

interface KPIItem {
    id: string
    name: string
    metric_key: string
    current_value: number
    target_value: number
    progress_percent: number
    is_met: boolean
    current_reward: number
    bonus_amount: number
}

interface RecentShift {
    id: number
    date: string
    hours: number
    earnings: number
}

export default function EmployeeClubPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState<string>('')
    const [club, setClub] = useState<ClubInfo | null>(null)
    const [activeShift, setActiveShift] = useState<ActiveShift | null>(null)
    const [stats, setStats] = useState<Stats | null>(null)
    const [kpiData, setKpiData] = useState<any>(null)
    const [recentShifts, setRecentShifts] = useState<RecentShift[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isActionLoading, setIsActionLoading] = useState(false)

    // Live timer
    const [liveSeconds, setLiveSeconds] = useState(0)

    // Report Modal State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)
    const [reportTemplate, setReportTemplate] = useState<any>(null)
    const [reportData, setReportData] = useState<Record<string, any>>({})

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchData(p.clubId)
        })
    }, [params])

    // Live timer effect
    useEffect(() => {
        if (!activeShift) return

        const interval = setInterval(() => {
            const start = new Date(activeShift.check_in).getTime()
            const now = Date.now()
            const diffSeconds = Math.floor((now - start) / 1000)
            setLiveSeconds(diffSeconds)
        }, 1000)

        return () => clearInterval(interval)
    }, [activeShift])

    const fetchData = async (id: string) => {
        try {
            // Fetch club info
            const meRes = await fetch('/api/auth/me')
            const meData = await meRes.json()

            if (meRes.ok) {
                const clubInfo = meData.employeeClubs.find((c: ClubInfo) => c.id === parseInt(id))
                setClub(clubInfo || null)
            }

            // Fetch active shift
            const shiftRes = await fetch(`/api/employee/clubs/${id}/active-shift`)
            const shiftData = await shiftRes.json()

            if (shiftRes.ok && shiftData.shift) {
                setActiveShift(shiftData.shift)
            } else {
                setActiveShift(null)
            }

            // Fetch stats
            const statsRes = await fetch(`/api/employee/clubs/${id}/stats`)
            const statsData = await statsRes.json()

            if (statsRes.ok) {
                setStats(statsData)
            }

            // Fetch KPI data
            const kpiRes = await fetch(`/api/employee/clubs/${id}/kpi`)
            const kpiJson = await kpiRes.json()
            if (kpiRes.ok) {
                setKpiData(kpiJson)
            }

        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleStartShift = async () => {
        setIsActionLoading(true)
        try {
            const res = await fetch('/api/employee/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ club_id: parseInt(clubId) }),
            })

            if (res.ok) {
                await fetchData(clubId)
            } else {
                const data = await res.json()
                alert(data.error || 'Не удалось начать смену')
            }
        } catch (error) {
            console.error('Error starting shift:', error)
            alert('Ошибка начала смены')
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleEndShiftClick = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/settings/reports`, { cache: 'no-store' })
            const data = await res.json()
            if (data.currentTemplate) {
                setReportTemplate(data.currentTemplate)
                setReportData({})
                setIsReportModalOpen(true)
            } else {
                if (confirm('Завершить смену?')) {
                    submitEndShift({})
                }
            }
        } catch (e) {
            console.error(e)
            if (confirm('Завершить смену?')) {
                submitEndShift({})
            }
        }
    }

    const submitEndShift = async (data: any) => {
        setIsActionLoading(true)
        try {
            const res = await fetch(`/api/employee/shifts/${activeShift?.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportData: data,
                    templateId: reportTemplate?.id
                }),
            })

            if (res.ok) {
                setIsReportModalOpen(false)
                await fetchData(clubId)
            } else {
                const err = await res.json()
                alert(err.error || 'Не удалось завершить смену')
            }
        } catch (error) {
            console.error('Error ending shift:', error)
            alert('Ошибка завершения смены')
        } finally {
            setIsActionLoading(false)
        }
    }

    // Format live time
    const formatLiveTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60
        return {
            hours: hours.toString().padStart(2, '0'),
            minutes: minutes.toString().padStart(2, '0'),
            seconds: seconds.toString().padStart(2, '0')
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount) + ' ₽'
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto" />
                    <p className="mt-4 text-purple-200">Загрузка...</p>
                </div>
            </div>
        )
    }

    if (!club) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <h3 className="text-xl font-semibold">Клуб не найден</h3>
                    <Link href="/employee/dashboard" className="mt-4 inline-block text-purple-500">
                        ← Вернуться к списку клубов
                    </Link>
                </div>
            </div>
        )
    }

    const liveTime = formatLiveTime(liveSeconds)
    const currentEarnings = stats ? (liveSeconds / 3600) * stats.hourly_rate : 0

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-900">
            {/* Header */}
            <div className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                                {club.name}
                            </h1>
                            <p className="text-sm text-muted-foreground">Рабочее пространство</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{club.role}</span>
                            </div>
                            <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{stats?.hourly_rate}₽/час</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

                {/* Main Grid */}
                <div className="grid gap-6 lg:grid-cols-3">

                    {/* Shift Control - Main Card */}
                    <div className="lg:col-span-2">
                        <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 text-white">
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                            <div className="relative">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-white/90">
                                            <Clock className="h-5 w-5 text-purple-400" />
                                            Управление сменой
                                        </CardTitle>
                                        {activeShift && (
                                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                <span className="text-sm font-medium text-emerald-400">Активна</span>
                                            </div>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {activeShift ? (
                                        <div className="space-y-6">
                                            {/* Live Timer */}
                                            <div className="flex flex-col items-center justify-center py-8">
                                                <div className="flex items-baseline gap-1 font-mono">
                                                    <span className="text-6xl font-bold text-white">{liveTime.hours}</span>
                                                    <span className="text-4xl text-white/50">:</span>
                                                    <span className="text-6xl font-bold text-white">{liveTime.minutes}</span>
                                                    <span className="text-4xl text-white/50">:</span>
                                                    <span className="text-4xl font-medium text-purple-400">{liveTime.seconds}</span>
                                                </div>
                                                <p className="mt-4 text-white/60">
                                                    Начало в {new Date(activeShift.check_in).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                </p>

                                                {/* Live Earnings */}
                                                <div className="mt-6 px-6 py-3 rounded-2xl bg-white/10 backdrop-blur border border-white/10">
                                                    <div className="flex items-center gap-2">
                                                        <Zap className="h-5 w-5 text-yellow-400" />
                                                        <span className="text-sm text-white/70">Заработано за смену:</span>
                                                        <span className="text-xl font-bold text-emerald-400">
                                                            +{formatCurrency(currentEarnings)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                variant="destructive"
                                                className="w-full h-14 text-lg shadow-lg bg-red-600 hover:bg-red-700 transition-all"
                                                onClick={handleEndShiftClick}
                                                disabled={isActionLoading}
                                            >
                                                {isActionLoading && !isReportModalOpen ? (
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                ) : (
                                                    <LogOut className="mr-2 h-5 w-5" />
                                                )}
                                                Завершить смену
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="py-8 space-y-6">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="h-28 w-28 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                                                    <CoffeeIcon className="h-12 w-12 text-white/40" />
                                                </div>
                                                <h3 className="text-xl font-medium text-white/80">Вы сейчас не на работе</h3>
                                                <p className="text-white/50 mt-1">Начните смену для учёта времени</p>
                                            </div>

                                            <Button
                                                className="w-full h-14 text-lg bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/25 transition-all"
                                                onClick={handleStartShift}
                                                disabled={isActionLoading}
                                            >
                                                {isActionLoading ? (
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                ) : (
                                                    <LogIn className="mr-2 h-5 w-5" />
                                                )}
                                                Начать смену
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </div>
                        </Card>
                    </div>

                    {/* Stats Column */}
                    <div className="space-y-4">
                        {/* Today */}
                        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 backdrop-blur">
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Сегодня</p>
                                        <p className="text-3xl font-bold mt-1">{stats?.today_hours.toFixed(1)}ч</p>
                                        <p className="text-sm text-emerald-500 font-medium mt-1">
                                            +{formatCurrency(stats ? stats.today_hours * stats.hourly_rate : 0)}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-purple-500/10">
                                        <Activity className="h-6 w-6 text-purple-500" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* This Week */}
                        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 backdrop-blur">
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Эта неделя</p>
                                        <p className="text-3xl font-bold mt-1">{stats?.week_hours.toFixed(1)}ч</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {formatCurrency(stats?.week_earnings || 0)}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-blue-500/10">
                                        <Calendar className="h-6 w-6 text-blue-500" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Monthly Salary */}
                        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-white/70">Зарплата (месяц)</p>
                                        <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.month_earnings || 0)}</p>
                                        {kpiData && kpiData.total_kpi_bonus > 0 && (
                                            <p className="text-sm text-emerald-300 font-medium mt-1">
                                                +{formatCurrency(kpiData.total_kpi_bonus)} KPI
                                            </p>
                                        )}
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/20">
                                        <Wallet className="h-6 w-6 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* KPI Tracker */}
                {kpiData && kpiData.kpi.length > 0 && (
                    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="h-5 w-5 text-purple-500" />
                                Прогресс KPI
                                <span className="ml-auto text-sm font-normal text-muted-foreground">
                                    {kpiData.shifts_count} смен из {kpiData.planned_shifts} • {kpiData.days_remaining} дней осталось
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {kpiData.kpi.map((kpi: any) => (
                                <div key={kpi.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="font-semibold text-lg">{kpi.name}</span>
                                        {kpi.is_met ? (
                                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-medium">
                                                Уровень {kpi.current_level} • {kpi.current_reward}%
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-sm font-medium">
                                                Без бонуса
                                            </span>
                                        )}
                                    </div>

                                    {/* Current Stats */}
                                    <div className="grid grid-cols-2 gap-4 mb-4 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Текущая выручка</p>
                                            <p className="text-xl font-bold">{formatCurrency(kpi.current_value)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Средняя за смену</p>
                                            <p className="text-xl font-bold">{formatCurrency(kpi.avg_per_shift)}</p>
                                        </div>
                                    </div>

                                    {/* All Thresholds - Monthly Values */}
                                    {kpi.all_thresholds && kpi.all_thresholds.length > 0 && (
                                        <div className="space-y-2 mb-4">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Месячные уровни бонусов</p>
                                            {kpi.all_thresholds.map((threshold: any) => (
                                                <div
                                                    key={threshold.level}
                                                    className={`p-3 rounded-lg border ${threshold.is_met
                                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={threshold.is_met ? 'text-emerald-500 text-lg' : 'text-slate-400'}>
                                                                {threshold.is_met ? '✓' : '○'}
                                                            </span>
                                                            <span className="font-semibold">Уровень {threshold.level}</span>
                                                            <span className="text-sm text-muted-foreground">
                                                                ({formatCurrency(threshold.monthly_threshold)}/мес → {threshold.percent}%)
                                                            </span>
                                                        </div>
                                                        {threshold.is_met && (
                                                            <span className="text-emerald-600 font-bold">
                                                                +{formatCurrency(kpi.current_value * threshold.percent / 100)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Per-shift recommendations */}
                                                    <div className="text-sm grid grid-cols-2 gap-2">
                                                        {threshold.is_met ? (
                                                            <>
                                                                <div className="text-emerald-700 dark:text-emerald-400">
                                                                    <span className="text-muted-foreground">Чтобы остаться:</span>{' '}
                                                                    <span className="font-semibold">{formatCurrency(threshold.per_shift_to_stay)}/смену</span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div>
                                                                    <span className="text-muted-foreground">Осталось:</span>{' '}
                                                                    <span className="font-semibold">{formatCurrency(threshold.remaining_total)}</span>
                                                                </div>
                                                                {threshold.per_shift_to_reach > 0 && kpi.remaining_shifts > 0 && (
                                                                    <div className="text-purple-600 dark:text-purple-400">
                                                                        <span className="text-muted-foreground">Нужно:</span>{' '}
                                                                        <span className="font-semibold">{formatCurrency(threshold.per_shift_to_reach)}/смену</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Current Bonus */}
                                    {kpi.is_met && kpi.bonus_amount > 0 && (
                                        <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-emerald-100">Текущий бонус (Уровень {kpi.current_level}, {kpi.current_reward}%)</p>
                                                    <p className="text-xs text-emerald-200">{formatCurrency(kpi.current_value)} × {kpi.current_reward}%</p>
                                                </div>
                                                <span className="text-2xl font-bold">{formatCurrency(kpi.bonus_amount)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Projection */}
                                    {kpi.projected_total > kpi.current_value && kpi.remaining_shifts > 0 && (
                                        <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                            <div className="flex items-center gap-2 mb-2">
                                                <TrendingUp className="h-4 w-4 text-blue-500" />
                                                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                                    Прогноз при текущем темпе ({kpi.remaining_shifts} смен осталось)
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-blue-600/70">Прогноз выручки:</p>
                                                    <p className="font-semibold text-blue-700 dark:text-blue-300">~{formatCurrency(kpi.projected_total)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-blue-600/70">Уровень / Бонус:</p>
                                                    <p className="font-semibold text-blue-700 dark:text-blue-300">
                                                        Ур. {kpi.projected_level} / ~{formatCurrency(kpi.projected_bonus)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Total Summary */}
                            <div className="grid gap-4 md:grid-cols-2">
                                {kpiData.total_kpi_bonus > 0 && (
                                    <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Trophy className="h-5 w-5 text-emerald-500" />
                                                <span className="font-medium text-emerald-700 dark:text-emerald-400">Текущие KPI бонусы:</span>
                                            </div>
                                            <span className="text-2xl font-bold text-emerald-600">
                                                {formatCurrency(kpiData.total_kpi_bonus)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {kpiData.total_projected_bonus > 0 && (
                                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="h-5 w-5 text-blue-500" />
                                                <span className="font-medium text-blue-700 dark:text-blue-400">Прогноз к концу месяца:</span>
                                            </div>
                                            <span className="text-2xl font-bold text-blue-600">
                                                ~{formatCurrency(kpiData.total_projected_bonus)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Workday Progress (if shift active) */}
                {activeShift && kpiData && (
                    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 backdrop-blur">
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-muted-foreground">Прогресс рабочего дня</span>
                                <span className="text-sm font-medium">
                                    {(liveSeconds / 3600).toFixed(1)}ч из ~12ч
                                </span>
                            </div>
                            <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 transition-all duration-1000"
                                    style={{ width: `${Math.min((liveSeconds / 3600 / 12) * 100, 100)}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Report Modal */}
            <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
                <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Отчет о смене</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Пожалуйста, заполните данные перед закрытием смены
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                        {reportTemplate?.schema.map((field: any, idx: number) => (
                            <div key={idx} className="space-y-2">
                                <Label>
                                    {field.custom_label}
                                    {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                </Label>
                                <Input
                                    required={field.is_required}
                                    type={field.metric_key.includes('comment') ? 'text' : 'number'}
                                    className="bg-slate-900 border-slate-700"
                                    onChange={(e) => setReportData({ ...reportData, [field.metric_key]: e.target.value })}
                                />
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => submitEndShift(reportData)}
                            disabled={isActionLoading}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Отправить отчет и закрыть смену
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function CoffeeIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M10 2v2" />
            <path d="M14 2v2" />
            <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
            <path d="M6 2v2" />
        </svg>
    )
}
