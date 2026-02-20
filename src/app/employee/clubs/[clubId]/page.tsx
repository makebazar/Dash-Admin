"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Clock, Loader2, LogIn, LogOut, Wallet, Activity, Calendar,
    TrendingUp, Target, Zap, ChevronRight, Trophy, Brush, ClipboardCheck
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { KpiOverview } from "@/components/employee/kpi/KpiOverview"

interface ClubInfo {
    id: number
    name: string
    role: string
    inventory_required: boolean
}

interface ActiveShift {
    id: number
    check_in: string
    total_hours: number
    report_data?: any
}

interface Stats {
    today_hours: number
    week_hours: number
    week_earnings: number
    month_earnings: number
    hourly_rate: number
    kpi_bonus: number
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

import { ShiftClosingWizard } from "./_components/ShiftClosingWizard"

export default function EmployeeClubPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState<string>('')
    const [club, setClub] = useState<ClubInfo | null>(null)
    const [activeShift, setActiveShift] = useState<ActiveShift | null>(null)
    const [stats, setStats] = useState<Stats | null>(null)
    const [kpiData, setKpiData] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const [pendingTasksCount, setPendingTasksCount] = useState(0)

    // Indicators Modal State
    const [isIndicatorsModalOpen, setIsIndicatorsModalOpen] = useState(false)

    // Live timer
    const [liveSeconds, setLiveSeconds] = useState(0)

    // Report Modal State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)
    const [reportTemplate, setReportTemplate] = useState<any>(null)
    const [reportData, setReportData] = useState<Record<string, any>>({})

    const [currentUserId, setCurrentUserId] = useState<string>('')

    useEffect(() => {
        // Fetch current user ID
        fetch('/api/auth/me').then(res => res.json()).then(data => {
            if (data.user) setCurrentUserId(data.user.id)
        })
        
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

            // Fetch report template for indicators/end shift
            const reportRes = await fetch(`/api/clubs/${id}/settings/reports`, { cache: 'no-store' })
            const reportJson = await reportRes.json()
            if (reportRes.ok && reportJson.currentTemplate) {
                setReportTemplate(reportJson.currentTemplate)
            }

            // Fetch pending maintenance tasks count
            const tasksRes = await fetch(`/api/clubs/${id}/equipment/maintenance?assigned=me&status=PENDING,IN_PROGRESS`)
            const tasksData = await tasksRes.json()
            if (tasksRes.ok) {
                setPendingTasksCount(tasksData.total || 0)
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

    const submitUpdateIndicators = async (data: any) => {
        setIsActionLoading(true)
        try {
            const res = await fetch(`/api/employee/shifts/${activeShift?.id}/indicators`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ indicators: data }),
            })

            if (res.ok) {
                setIsIndicatorsModalOpen(false)
                await fetchData(clubId)
            } else {
                const err = await res.json()
                alert(err.error || 'Не удалось обновить показатели')
            }
        } catch (error) {
            console.error('Error updating indicators:', error)
            alert('Ошибка обновления показателей')
        } finally {
            setIsActionLoading(false)
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
            <div className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-30 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 py-4 md:px-6">
                    <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                                {club.name}
                            </h1>
                            <p className="text-sm text-muted-foreground">Рабочее пространство</p>
                        </div>
                        <div className="flex items-center gap-3">
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8 space-y-6">

                {/* Main Grid */}
                <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">

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
                                                    <span className="text-5xl md:text-6xl font-bold text-white">{liveTime.hours}</span>
                                                    <span className="text-3xl md:text-4xl text-white/50">:</span>
                                                    <span className="text-5xl md:text-6xl font-bold text-white">{liveTime.minutes}</span>
                                                    <span className="text-3xl md:text-4xl text-white/50">:</span>
                                                    <span className="text-3xl md:text-4xl font-medium text-purple-400">{liveTime.seconds}</span>
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

                                            <Button
                                                variant="outline"
                                                className="w-full h-12 text-md border-white/20 bg-white/5 text-white hover:bg-white/10"
                                                onClick={() => setIsIndicatorsModalOpen(true)}
                                                disabled={isActionLoading}
                                            >
                                                <Target className="mr-2 h-4 w-4" />
                                                Внести промежуточные показатели
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
                        {/* Maintenance Tasks */}
                        <Link href={`/employee/clubs/${clubId}/tasks`} className="block">
                            <Card className={cn(
                                "border-0 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]",
                                pendingTasksCount > 0
                                    ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                                    : "bg-white dark:bg-slate-800/50 backdrop-blur"
                            )}>
                                <CardContent className="pt-6">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className={cn(
                                                "text-sm font-medium",
                                                pendingTasksCount > 0 ? "text-white/80" : "text-muted-foreground"
                                            )}>Задачи по обслуживанию</p>
                                            <p className="text-3xl font-bold mt-1">{pendingTasksCount} задач</p>
                                            <p className={cn(
                                                "text-sm mt-1",
                                                pendingTasksCount > 0 ? "text-white/70" : "text-emerald-500 font-medium"
                                            )}>
                                                {pendingTasksCount > 0 ? "Требуют внимания" : "Все оборудование чистое"}
                                            </p>
                                        </div>
                                        <div className={cn(
                                            "p-3 rounded-xl",
                                            pendingTasksCount > 0 ? "bg-white/20" : "bg-amber-500/10"
                                        )}>
                                            <Brush className={cn(
                                                "h-6 w-6",
                                                pendingTasksCount > 0 ? "text-white" : "text-amber-500"
                                            )} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* Evaluations */}
                        <Link href={`/employee/clubs/${clubId}/evaluations`} className="block">
                            <Card className="hover:shadow-md transition-all active:scale-[0.99] border-l-4 border-l-orange-500">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                                            <ClipboardCheck className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Мои проверки</p>
                                            <p className="text-xs text-muted-foreground">Результаты аудитов</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                </CardContent>
                            </Card>
                        </Link>

                        {/* Monthly Salary */}
                        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-white/70">Зарплата (ориентировочно)</p>
                                        <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.month_earnings || 0)}</p>
                                        {stats && stats.kpi_bonus > 0 && (
                                            <p className="text-sm text-emerald-300 font-medium mt-1">
                                                Включая {formatCurrency(stats.kpi_bonus)} бонусов
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

                {/* KPI Tracker - Simplified Experience */}
                {kpiData && kpiData.kpi && kpiData.kpi.length > 0 ? (
                    kpiData.kpi.map((kpi: any) => (
                    <div key={kpi.id} className="space-y-4">
                        {kpiData.kpi.length > 1 && (
                            <div className="flex items-center gap-3 px-1">
                                <div className="h-6 w-1 bg-purple-600 rounded-full" />
                                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{kpi.name}</h2>
                            </div>
                        )}

                        <KpiOverview
                            kpi={kpi}
                            formatCurrency={formatCurrency}
                            remainingShifts={kpiData.remaining_shifts}
                            shiftsCount={kpiData.shifts_count}
                            plannedShifts={kpiData.planned_shifts}
                            daysRemaining={kpiData.days_remaining}
                            activeShift={activeShift}
                        />
                    </div>
                ))) : (
                    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50 backdrop-blur">
                        <CardContent className="py-8 text-center text-muted-foreground">
                            <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>KPI показатели пока не назначены</p>
                            {kpiData?.message && <p className="text-xs mt-2 opacity-50">{kpiData.message}</p>}
                        </CardContent>
                    </Card>
                )}

                {/* Workday Progress (if shift active) - Removed */}
            </div>

            {/* Report Modal */}
            {activeShift && club && (
                <ShiftClosingWizard 
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    onComplete={(data) => submitEndShift(data)}
                    clubId={clubId}
                    userId={currentUserId}
                    reportTemplate={reportTemplate}
                    activeShiftId={activeShift.id}
                    skipInventory={!club.inventory_required}
                />
            )}

            {/* Intermediate Indicators Modal */}
            <Dialog open={isIndicatorsModalOpen} onOpenChange={setIsIndicatorsModalOpen}>
                <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Промежуточные показатели</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Внесите текущие данные, чтобы увидеть обновленный прогноз KPI
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                        {reportTemplate?.schema?.map((field: any, idx: number) => {
                            // Only show INCOME fields for intermediate updates? Or all?
                            // For simplicity, showing all.
                            return (
                                <div key={idx} className="space-y-2">
                                    <Label>
                                        {field.custom_label}
                                    </Label>
                                    <Input
                                        type={field.metric_key.includes('comment') ? 'text' : 'number'}
                                        placeholder="Текущее значение"
                                        className="bg-slate-900 border-slate-700"
                                        onChange={(e) => setReportData({ ...reportData, [field.metric_key]: e.target.value })}
                                        defaultValue={activeShift ? (
                                            typeof activeShift.report_data === 'string'
                                                ? JSON.parse(activeShift.report_data || '{}')[field.metric_key]
                                                : (activeShift.report_data as any)?.[field.metric_key]
                                        ) : ''}
                                    />
                                </div>
                            )
                        })}
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => submitUpdateIndicators(reportData)}
                            disabled={isActionLoading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                            {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Обновить показатели
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
