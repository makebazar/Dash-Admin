"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Clock, Loader2, LogIn, LogOut, Wallet, Activity, Calendar,
    TrendingUp, Target, Zap, ChevronRight, Trophy, Brush, ClipboardCheck, Monitor, AlertCircle, Ban, ArrowRightLeft, MessageSquare, ShoppingCart
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { SSEProvider } from "@/hooks/usePOSWebSocket"
import { KpiOverview, ChecklistKpiCard, MaintenanceKpiCard } from "@/components/employee/kpi/KpiOverview"
import { ShiftClosingWizard } from "./_components/ShiftClosingWizard"
import { ShiftOpeningWizard } from "./_components/ShiftOpeningWizard"
import { EmployeeSupplyWizard } from "./_components/EmployeeSupplyWizard"
import { EmployeeWriteOffWizard } from "./_components/EmployeeWriteOffWizard"
import { EmployeeTransferWizard } from "./_components/EmployeeTransferWizard"
import { EmployeeRequestWizard } from "./_components/EmployeeRequestWizard"
import { getEmployeeRequests } from "./requests-actions"

interface ClubInfo {
    id: number
    name: string
    role: string
    inventory_required: boolean
    inventory_settings?: {
        employee_default_metric_key?: string
        employee_allowed_warehouse_ids?: number[]
        sales_capture_mode?: 'INVENTORY' | 'SHIFT'
    }
}

interface ActiveShift {
    id: string | number
    check_in: string
    total_hours: number
    report_data?: any
}

interface Stats {
    today_hours: number
    week_hours: number
    total_hours: number
    week_earnings: number
    month_earnings: number
    hourly_rate: number
    kpi_bonus: number
    last_week_hours?: number
    breakdown?: {
        base_salary: number
        shift_bonuses: number
        checklist_bonuses: number
        maintenance_bonuses: number
        revenue_kpi_bonuses: number
        bar_deductions?: number
        revenue_kpi_breakdown?: Array<{
            name: string
            amount: number
            metPercent?: number
            is_virtual: boolean
        }>
        virtual_bonuses?: {
            checklist: number
            maintenance: number
            revenue: number
            total: number
        }
    }
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
    const [employeeClubs, setEmployeeClubs] = useState<ClubInfo[]>([])
    const [activeShift, setActiveShift] = useState<ActiveShift | null>(null)
    const [stats, setStats] = useState<Stats | null>(null)
    const [kpiData, setKpiData] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const [pendingTasksCount, setPendingTasksCount] = useState(0)
    const [reworkTasksCount, setReworkTasksCount] = useState(0)

    // Indicators Modal State
    const [isIndicatorsModalOpen, setIsIndicatorsModalOpen] = useState(false)
    const [isSupplyWizardOpen, setIsSupplyWizardOpen] = useState(false)
    const [isWriteOffWizardOpen, setIsWriteOffWizardOpen] = useState(false)
    const [isTransferWizardOpen, setIsTransferWizardOpen] = useState(false)
    const [isRequestWizardOpen, setIsRequestWizardOpen] = useState(false)
    const [unreadRequestsCount, setUnreadRequestsCount] = useState(0)

    // Live timer
    const [liveSeconds, setLiveSeconds] = useState(0)

    // Report Modal State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)
    const [reportTemplate, setReportTemplate] = useState<any>(null)
    const [reportData, setReportData] = useState<Record<string, any>>({})
    
    // Checklist State
    const [checklistTemplates, setChecklistTemplates] = useState<any[]>([])
    const [isHandoverOpen, setIsHandoverOpen] = useState(false)
    const [handoverTemplate, setHandoverTemplate] = useState<any>(null)

    const [currentUserId, setCurrentUserId] = useState<string>('')
    const [evaluationScore, setEvaluationScore] = useState<number | null>(null)
    const [isEvaluationsLoading, setIsEvaluationsLoading] = useState(false)

    // Helper functions (должны быть до useMemo)
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

    // Оптимизация: мемоизация KPI компонентов (должен быть до useEffect)
    const kpiComponents = useMemo(() => {
        if (!kpiData?.kpi) return null
        return kpiData.kpi.map((kpi: any) => (
            <div key={kpi.id} className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    <div className="h-6 w-1 bg-purple-600 rounded-full" />
                    <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Выручка: {kpi.name}</h2>
                </div>
                <KpiOverview
                    kpi={kpi}
                    formatCurrency={formatCurrency}
                    remainingShifts={kpiData.remaining_shifts || 0}
                    shiftsCount={kpiData.shifts_count || 0}
                    completedShiftsCount={kpiData.completed_shifts || 0}
                    plannedShifts={kpiData.planned_shifts || 0}
                    daysRemaining={kpiData.days_remaining || 0}
                    activeShift={activeShift}
                />
            </div>
        ))
    }, [kpiData?.kpi?.length, kpiData?.remaining_shifts, kpiData?.shifts_count, activeShift?.id])

    const checklistComponents = useMemo(() => {
        if (!kpiData?.checklist) return null
        return kpiData.checklist.map((checklist: any) => (
            <div key={checklist.id} className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    <div className="h-6 w-1 bg-fuchsia-600 rounded-full" />
                    <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Чек-лист</h2>
                </div>
                <ChecklistKpiCard kpi={checklist} formatCurrency={formatCurrency} />
            </div>
        ))
    }, [kpiData?.checklist?.length])

    const maintenanceComponent = useMemo(() => {
        if (!kpiData?.maintenance) return null
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    <div className="h-6 w-1 bg-indigo-600 rounded-full" />
                    <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Обслуживание</h2>
                </div>
                <MaintenanceKpiCard kpi={kpiData.maintenance} formatCurrency={formatCurrency} />
            </div>
        )
    }, [kpiData?.maintenance?.current_value, kpiData?.maintenance?.target_value])

    useEffect(() => {
        // Fetch current user ID
        fetch('/api/auth/me').then(res => res.json()).then(data => {
            if (data.user) setCurrentUserId(data.user.id)
            if (Array.isArray(data.employeeClubs)) {
                setEmployeeClubs(data.employeeClubs)
            }
        })
        
        params.then(p => {
            setClubId(p.clubId)
            fetchData(p.clubId)
            fetchChecklistTemplates(p.clubId)
        })
    }, [params])

    useEffect(() => {
        if (!clubId || employeeClubs.length === 0) return
        const clubInfo = employeeClubs.find((c: ClubInfo) => c.id === parseInt(clubId))
        setClub(clubInfo || null)
    }, [clubId, employeeClubs])

    useEffect(() => {
        if (!clubId || !currentUserId) return
        const fetchEvaluationScore = async () => {
            setIsEvaluationsLoading(true)
            try {
                const res = await fetch(`/api/clubs/${clubId}/evaluations?employee_id=${currentUserId}`)
                const data = await res.json()
                if (res.ok && Array.isArray(data)) {
                    const now = new Date()
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
                    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
                    const monthlyScores = data
                        .filter((item: any) => {
                            const date = item.evaluation_date || item.created_at
                            if (!date) return false
                            const parsed = new Date(date)
                            return parsed >= startOfMonth && parsed < nextMonth
                        })
                        .map((item: any) => Number(item.total_score))
                        .filter((value: number) => Number.isFinite(value))

                    if (monthlyScores.length > 0) {
                        const avg = monthlyScores.reduce((sum: number, value: number) => sum + value, 0) / monthlyScores.length
                        setEvaluationScore(avg)
                    } else {
                        setEvaluationScore(null)
                    }
                } else {
                    setEvaluationScore(null)
                }
            } catch (error) {
                console.error('Error fetching evaluations', error)
                setEvaluationScore(null)
            } finally {
                setIsEvaluationsLoading(false)
            }
        }
        fetchEvaluationScore()
    }, [clubId, currentUserId])

    useEffect(() => {
        if (!clubId || !currentUserId) return
        
        // Оптимизация: не создаем SSE если страница не активна
        const fetchUnreadRequests = async () => {
            try {
                const requests = await getEmployeeRequests(clubId, currentUserId)
                const unreadCount = requests.filter((r: any) => !r.is_read_by_employee).length
                setUnreadRequestsCount(unreadCount)
            } catch (error) {
                console.error('Error fetching requests:', error)
            }
        }
        
        fetchUnreadRequests()
        
        // SSE для updates - нужен только для подсчета непрочитанных
        const eventSource = new EventSource(`/api/clubs/${clubId}/requests/stream`)
        const onUpdate = () => {
            fetchUnreadRequests()
        }
        eventSource.addEventListener("update", onUpdate)
        
        return () => {
            eventSource.removeEventListener("update", onUpdate)
            eventSource.close()
        }
    }, [clubId, currentUserId])
    // Убрали isRequestWizardOpen из зависимостей - лишние переподключения

    const fetchChecklistTemplates = async (clubId: string) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/evaluations/templates`)
            const data = await res.json()
            if (res.ok) setChecklistTemplates(data)
        } catch (e) {
            console.error('Failed to fetch checklists', e)
        }
    }

    // Live timer - оптимизировано (без ре-рендера всей страницы)
    const liveSecondsRef = useRef(0)
    const [liveDisplay, setLiveDisplay] = useState("00:00:00")

    useEffect(() => {
        if (!activeShift) return

        const updateTimer = () => {
            const start = new Date(activeShift.check_in).getTime()
            const now = Date.now()
            const diffSeconds = Math.floor((now - start) / 1000)
            liveSecondsRef.current = diffSeconds
            
            // Форматируем только для отображения
            const hours = Math.floor(diffSeconds / 3600).toString().padStart(2, '0')
            const minutes = Math.floor((diffSeconds % 3600) / 60).toString().padStart(2, '0')
            const seconds = (diffSeconds % 60).toString().padStart(2, '0')
            setLiveDisplay(`${hours}:${minutes}:${seconds}`)
        }

        updateTimer()
        const interval = setInterval(updateTimer, 1000)

        return () => clearInterval(interval)
    }, [activeShift])

    const fetchData = async (id: string) => {
        try {
            // Оптимизация: выполняем все запросы параллельно
            const [
                shiftData,
                statsData,
                kpiData,
                reportJson,
                tasksData,
                reworkData,
                ratingData
            ] = await Promise.all([
                fetch(`/api/employee/clubs/${id}/active-shift`).then(r => r.json()),
                fetch(`/api/employee/clubs/${id}/stats`).then(r => r.json()),
                fetch(`/api/employee/clubs/${id}/kpi`).then(r => r.json()),
                fetch(`/api/clubs/${id}/settings/reports`, { cache: 'no-store' }).then(r => r.json()),
                fetch(`/api/clubs/${id}/equipment/maintenance?assigned=me&status=PENDING,IN_PROGRESS`).then(r => r.json()),
                fetch(`/api/clubs/${id}/equipment/maintenance?assigned=me&verification_status=REJECTED`).then(r => r.json()),
                fetch(`/api/employee/clubs/${id}/equipment-rating`).then(r => r.json()),
            ])

            // Shift
            if (shiftData.shift) {
                setActiveShift(shiftData.shift)
            } else {
                setActiveShift(null)
            }

            // Stats
            if (statsData) {
                setStats(statsData)
            }

            // KPI
            if (kpiData) {
                setKpiData(kpiData)
            }

            // Report template
            if (reportJson?.currentTemplate) {
                setReportTemplate(reportJson.currentTemplate)
            }

            // Tasks
            if (tasksData) {
                setPendingTasksCount(tasksData.total || 0)
            }

            // Rework tasks
            if (reworkData) {
                setReworkTasksCount(reworkData.total || 0)
            }

            // Rating
            if (ratingData) {
                setKpiData((prev: any) => ({ ...prev, equipment_rating: ratingData }))
            }

        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Оптимизация: мемоизация обработчиков
    const handleStartShift = useCallback(async () => {
        console.log('[handleStartShift] clubId:', clubId, 'club:', club)
        const requiredHandover = checklistTemplates.find((t: any) => t.type === 'shift_handover' && t.settings?.block_shift_open)

        if (requiredHandover) {
            setHandoverTemplate(requiredHandover)
            setIsHandoverOpen(true)
            return
        }

        await executeStartShift()
    }, [checklistTemplates, clubId, club])

    const executeStartShift = useCallback(async () => {
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
    }, [clubId])

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
        if (!activeShift?.id) {
            alert('Ошибка: активная смена не найдена')
            return
        }
        
        setIsActionLoading(true)
        try {
            const { checklistResponses, checklistId, ...cleanReportData } = data || {}

            if (checklistId && checklistResponses && currentUserId) {
                const evalRes = await fetch(`/api/clubs/${clubId}/evaluations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        template_id: checklistId,
                        employee_id: currentUserId,
                        target_user_id: currentUserId,
                        shift_id: activeShift.id,
                        responses: Object.entries(checklistResponses).map(([k, v]: any) => ({
                            item_id: parseInt(k),
                            score: v.score,
                            comment: v.comment,
                            selected_workstations: v.selected_workstations
                        }))
                    })
                })

                if (!evalRes.ok) {
                    const err = await evalRes.json().catch(() => ({}))
                    alert(err.error || 'Не удалось сохранить чеклист закрытия смены')
                    return
                }
            }

            const res = await fetch(`/api/employee/shifts/${activeShift.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportData: cleanReportData,
                    templateId: reportTemplate?.id
                }),
            })

            if (res.ok) {
                setIsReportModalOpen(false)
                await fetchData(clubId)
            } else {
                const err = await res.json()
                alert(err.error || `Не удалось завершить смену: ${res.status}`)
            }
        } catch (error) {
            console.error('Error ending shift:', error)
            alert(`Ошибка завершения смены: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
        } finally {
            setIsActionLoading(false)
        }
    }

    const liveTime = formatLiveTime(liveSecondsRef.current)
    const currentEarnings = stats ? (liveSecondsRef.current / 3600) * stats.hourly_rate : 0

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

    if (!currentUserId) {
        return (
            <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto" />
                    <p className="mt-4 text-purple-200">Загрузка...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8 space-y-6 relative z-0">
            {/* Rework Alert Notification */}
                {reworkTasksCount > 0 && (
                    <Link href={`/employee/clubs/${clubId}/tasks?verification_status=REJECTED`} className="block group">
                        <div className="relative overflow-hidden rounded-2xl bg-rose-500 p-4 text-white shadow-lg">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10" />
                            <div className="flex flex-col gap-4 relative z-10">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                                        <AlertCircle className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-lg font-bold leading-tight">Доработка!</h3>
                                        <p className="text-sm text-white/90 mt-1 leading-snug">
                                            Админ вернул <span className="font-black underline decoration-2">{reworkTasksCount} задач(и)</span>. Исправьте их, чтобы не терять бонусы.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center gap-2 font-bold bg-white/20 px-6 py-3 rounded-xl text-base">
                                    Исправить сейчас
                                    <ChevronRight className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    </Link>
                )}

                {/* Main Grid */}
                <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">

                    {/* Shift Control - Main Card */}
                    <div className="lg:col-span-2">
                        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 text-white relative">
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none" />
                            <div className="relative z-10">
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
                                        <div className="space-y-4">
                                            {/* Live Timer */}
                                            <div className="flex flex-col items-center justify-center py-6">
                                                <div className="flex items-baseline gap-1 font-mono">
                                                    <span className="text-4xl md:text-6xl font-bold text-white">{liveDisplay.split(':')[0]}</span>
                                                    <span className="text-2xl md:text-4xl text-white/50">:</span>
                                                    <span className="text-4xl md:text-6xl font-bold text-white">{liveDisplay.split(':')[1]}</span>
                                                    <span className="text-2xl md:text-4xl text-white/50">:</span>
                                                    <span className="text-2xl md:text-4xl font-medium text-purple-400">{liveDisplay.split(':')[2]}</span>
                                                </div>
                                                <p className="mt-2 text-white/60">
                                                    Начало в {new Date(activeShift.check_in).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                </p>

                                                {/* Live Earnings */}
                                                <div className="mt-4 px-4 py-2 rounded-xl bg-white/10 border border-white/10">
                                                    <div className="flex items-center gap-2">
                                                        <Zap className="h-4 w-4 text-yellow-400" />
                                                        <span className="text-xs text-white/70">Заработано за смену:</span>
                                                        <span className="text-lg font-bold text-emerald-400">
                                                            +{formatCurrency(currentEarnings)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                variant="destructive"
                                                className="w-full h-12 text-base shadow-lg bg-red-600 hover:bg-red-700"
                                                onClick={handleEndShiftClick}
                                            >
                                                {isActionLoading && !isReportModalOpen ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <LogOut className="mr-2 h-4 w-4" />
                                                )}
                                                Завершить смену
                                            </Button>

                                            <Button
                                                variant="outline"
                                                className="w-full h-auto py-3 text-sm border-white/20 bg-white/5 text-white"
                                                onClick={() => setIsRequestWizardOpen(true)}
                                            >
                                                <div className="relative">
                                                    <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                                                    {unreadRequestsCount > 0 && (
                                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500 border border-white/20"></span>
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-center">Связаться с руководством</span>
                                            </Button>

                                            <div className={cn(
                                                "pt-2 border-t border-white/10 mt-2 grid gap-2",
                                                club?.inventory_settings?.sales_capture_mode === 'SHIFT' ? "grid-cols-4" : "grid-cols-3"
                                            )}>
                                                <Button
                                                    variant="ghost"
                                                    className="w-full h-12 text-[10px] text-purple-300 rounded-xl"
                                                    onClick={() => setIsSupplyWizardOpen(true)}
                                                >
                                                    <Zap className="mr-1.5 h-3.5 w-3.5" />
                                                    Поставка
                                                </Button>
                                                {club?.inventory_settings?.sales_capture_mode === 'SHIFT' && (
                                                    <Button
                                                        variant="ghost"
                                                        className="w-full h-12 text-[10px] text-emerald-300 rounded-xl"
                                                        onClick={() => window.open(`/employee/clubs/${clubId}/pos`, '_blank', 'noopener,noreferrer')}
                                                    >
                                                        <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                                                        Продажи
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    className="w-full h-12 text-[10px] text-red-300 rounded-xl"
                                                    onClick={() => setIsWriteOffWizardOpen(true)}
                                                >
                                                    <Ban className="mr-1.5 h-3.5 w-3.5" />
                                                    Списание
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="w-full h-12 text-[10px] text-emerald-300 rounded-xl"
                                                    onClick={() => setIsTransferWizardOpen(true)}
                                                >
                                                    <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                                                    Перемещение
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-6 space-y-4">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="h-24 w-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                                    <CoffeeIcon className="h-10 w-10 text-white/40" />
                                                </div>
                                                <h3 className="text-lg font-medium text-white/80">Вы сейчас не на работе</h3>
                                                <p className="text-sm text-white/50 mt-1">Начните смену для учёта времени</p>
                                            </div>

                                            <Button
                                                className="w-full h-12 text-base bg-gradient-to-r from-emerald-500 to-green-600 shadow-lg"
                                                onClick={handleStartShift}
                                            >
                                                {isActionLoading ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <LogIn className="mr-2 h-4 w-4" />
                                                )}
                                                Начать смену
                                            </Button>

                                            <div className="pt-2 border-t border-white/10 mt-2">
                                                <Button
                                                    variant="ghost"
                                                    className="w-full h-12 text-[10px] text-white/60 rounded-xl"
                                                    onClick={() => setIsRequestWizardOpen(true)}
                                                >
                                                <div className="relative">
                                                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                                                    {unreadRequestsCount > 0 && (
                                                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                                        </span>
                                                    )}
                                                </div>
                                                Связаться с руководством
                                                </Button>
                                            </div>
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
                                "border-0 shadow-lg",
                                reworkTasksCount > 0
                                    ? "bg-gradient-to-br from-rose-500 to-red-600 text-white"
                                    : pendingTasksCount > 0
                                        ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                                        : "bg-white dark:bg-slate-800/50"
                            )}>
                                <CardContent className="pt-6">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className={cn(
                                                "text-sm font-medium",
                                                (pendingTasksCount > 0 || reworkTasksCount > 0) ? "text-white/80" : "text-muted-foreground"
                                            )}>Задачи по обслуживанию</p>
                                            <p className="text-3xl font-bold mt-1">
                                                {reworkTasksCount > 0 ? reworkTasksCount : pendingTasksCount} задач
                                            </p>
                                            <p className={cn(
                                                "text-sm mt-1",
                                                reworkTasksCount > 0 
                                                    ? "text-white font-black underline underline-offset-4" 
                                                    : pendingTasksCount > 0 
                                                        ? "text-white/70" 
                                                        : "text-emerald-500 font-medium"
                                            )}>
                                                {reworkTasksCount > 0 
                                                    ? "ЕСТЬ ДОРАБОТКА!" 
                                                    : pendingTasksCount > 0 
                                                        ? "Требуют внимания" 
                                                        : "Все оборудование чистое"}
                                            </p>
                                        </div>
                                        <div className={cn(
                                            "p-3 rounded-xl",
                                            (pendingTasksCount > 0 || reworkTasksCount > 0) ? "bg-white/20" : "bg-amber-500/10"
                                        )}>
                                            {reworkTasksCount > 0 ? (
                                                <AlertCircle className="h-6 w-6 text-white" />
                                            ) : (
                                                <Brush className={cn(
                                                    "h-6 w-6",
                                                    pendingTasksCount > 0 ? "text-white" : "text-amber-500"
                                                )} />
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>

                        {/* Monthly Salary */}
                        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                            <div className="absolute inset-0 bg-white/5" />
                            <CardContent className="pt-6 relative z-10">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-white/70">Зарплата (ориентировочно)</p>
                                        <p className="text-3xl font-bold mt-1">{formatCurrency(stats?.month_earnings || 0)}</p>
                                        
                                        {stats?.breakdown && (
                                            <div className="mt-4 space-y-1.5 pt-4 border-t border-white/10">
                                                <div className="flex justify-between text-[11px] text-white/60">
                                                    <span>Ставка ({stats.total_hours?.toFixed(1) || (stats.today_hours + stats.week_hours)?.toFixed(1)} ч):</span>
                                                    <span className="font-bold text-white">{formatCurrency(stats.breakdown.base_salary)}</span>
                                                </div>
                                                
                                                {stats.breakdown.shift_bonuses > 0 && (
                                                    <div className="flex justify-between text-[11px] text-white/60">
                                                        <span>Бонусы смен:</span>
                                                        <span className="font-bold text-emerald-300">+{formatCurrency(stats.breakdown.shift_bonuses)}</span>
                                                    </div>
                                                )}

                                                {stats.breakdown.revenue_kpi_breakdown?.filter((b: any) => !b.is_virtual).map((bonus: any, idx: number) => (
                                                    <div key={`real-${idx}`} className="flex justify-between text-[11px] text-white/60">
                                                        <span>{bonus.name} ({bonus.metPercent}%):</span>
                                                        <span className="font-bold text-emerald-300">+{formatCurrency(bonus.amount)}</span>
                                                    </div>
                                                ))}

                                                {stats.breakdown.checklist_bonuses > 0 && (
                                                    <div className="flex justify-between text-[11px] text-white/60">
                                                        <span>Чек-листы (мес):</span>
                                                        <span className="font-bold text-emerald-300">+{formatCurrency(stats.breakdown.checklist_bonuses)}</span>
                                                    </div>
                                                )}

                                                {stats.breakdown.maintenance_bonuses > 0 && (
                                                    <div className="flex justify-between text-[11px] text-white/60">
                                                        <span>Обслуживание:</span>
                                                        <span className="font-bold text-emerald-300">+{formatCurrency(stats.breakdown.maintenance_bonuses)}</span>
                                                    </div>
                                                )}

                                                {(stats.breakdown.bar_deductions || 0) > 0 && (
                                                    <div className="flex justify-between text-[11px] text-white/70">
                                                        <span>Бар в счет ЗП:</span>
                                                        <span className="font-bold text-rose-300">-{formatCurrency(stats.breakdown.bar_deductions || 0)}</span>
                                                    </div>
                                                )}

                                                {stats.breakdown.virtual_bonuses && stats.breakdown.virtual_bonuses.total > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                                                        <p className="text-[9px] uppercase tracking-wider text-white/40 font-bold">На бонусный баланс</p>
                                                        {stats.breakdown.virtual_bonuses.checklist > 0 && (
                                                            <div className="flex justify-between text-[11px] text-white/60">
                                                                <span>Чек-листы:</span>
                                                                <span className="font-bold text-amber-300">+{stats.breakdown.virtual_bonuses.checklist} Б</span>
                                                            </div>
                                                        )}
                                                        {stats.breakdown.virtual_bonuses.maintenance > 0 && (
                                                            <div className="flex justify-between text-[11px] text-white/60">
                                                                <span>Обслуживание:</span>
                                                                <span className="font-bold text-amber-300">+{stats.breakdown.virtual_bonuses.maintenance} Б</span>
                                                            </div>
                                                        )}
                                                        {stats.breakdown.revenue_kpi_breakdown?.filter(b => b.is_virtual).map((bonus, idx) => (
                                                            <div key={`virtual-${idx}`} className="flex justify-between text-[11px] text-white/60">
                                                                <span>{bonus.name} ({bonus.metPercent}%):</span>
                                                                <span className="font-bold text-amber-300">+{bonus.amount} Б</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
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

                {/* KPI Trackers */}
                <div className="space-y-6">
                    {/* Revenue KPI (Progressive) */}
                    {kpiComponents}

                    {/* Checklist and Maintenance KPIs */}
                    {(checklistComponents || maintenanceComponent) && (
                        <div className="grid gap-6 md:grid-cols-2">
                            {checklistComponents}
                            {maintenanceComponent}
                        </div>
                    )}

                    {(!kpiData || (!kpiData.kpi?.length && !kpiData.checklist?.length && !kpiData.maintenance)) && (
                        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
                            <CardContent className="py-8 text-center text-muted-foreground">
                                <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>KPI показатели пока не назначены</p>
                                {kpiData?.message && <p className="text-xs mt-2 opacity-50">{kpiData.message}</p>}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Workday Progress (if shift active) - Removed */}

                {isHandoverOpen && handoverTemplate && (
                <ShiftOpeningWizard
                    isOpen={isHandoverOpen}
                    onClose={() => setIsHandoverOpen(false)}
                    onComplete={async (checklistResponses: Record<number, { score: number, comment: string, photo_urls?: string[] }>, targetShiftId?: string, selectedUserId?: string | null) => {
                        try {
                            // Find recent closed shift (previous shift) or use selected
                            let targetUserId = selectedUserId || null
                            
                            if (!targetUserId && targetShiftId) {
                                const shiftRes = await fetch(`/api/clubs/${clubId}/shifts/${targetShiftId}`)
                                if (shiftRes.ok) {
                                    const shiftData = await shiftRes.json()
                                    targetUserId = shiftData?.shift?.user_id || shiftData?.user_id || null
                                }
                            } else if (!targetUserId) {
                                const recentRes = await fetch(`/api/clubs/${clubId}/shifts/recent`)
                                const recentData = await recentRes.json()
                                const lastShift = (recentData?.shifts || []).find((s: any) => s.status === 'CLOSED')
                                if (lastShift) targetUserId = lastShift.user_id
                            }

                            if (!targetUserId) {
                                alert('Не удалось определить сотрудника предыдущей смены. Попробуйте выбрать смену вручную.')
                                return
                            }

                            const evalRes = await fetch(`/api/clubs/${clubId}/evaluations`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    template_id: handoverTemplate.id,
                                    employee_id: targetUserId,
                                    target_user_id: targetUserId,
                                    shift_id: targetShiftId,
                                    responses: Object.entries(checklistResponses).map(([k, v]: any) => ({
                                        item_id: parseInt(k),
                                        score: v.score,
                                        comment: v.comment,
                                        photo_urls: v.photo_urls,
                                        selected_workstations: v.selected_workstations
                                    }))
                                })
                            })

                            if (!evalRes.ok) {
                                const err = await evalRes.json().catch(() => ({}))
                                alert(err.error || 'Не удалось сохранить результат чеклиста')
                                return
                            }
                        } catch (e) {
                            console.error(e)
                        }

                        setIsHandoverOpen(false)
                        await executeStartShift()
                    }}
                    checklistTemplate={handoverTemplate}
                />
            )}

            {/* Report Modal */}
            {activeShift && club && (
                <SSEProvider clubId={clubId} userId={currentUserId}>
                    <ShiftClosingWizard
                        isOpen={isReportModalOpen}
                        onClose={() => setIsReportModalOpen(false)}
                        onComplete={(data) => submitEndShift(data)}
                        clubId={clubId}
                        userId={currentUserId}
                        reportTemplate={reportTemplate}
                        activeShiftId={activeShift.id}
                        skipInventory={!club.inventory_required}
                        checklistTemplates={checklistTemplates}
                        inventorySettings={club.inventory_settings}
                    />
                </SSEProvider>
            )}

            {/* Supply Wizard */}
            <EmployeeSupplyWizard
                isOpen={isSupplyWizardOpen}
                onClose={() => setIsSupplyWizardOpen(false)}
                clubId={clubId}
                userId={currentUserId}
                activeShiftId={activeShift?.id?.toString()}
            />

            {/* Write-off Wizard */}
            <EmployeeWriteOffWizard
                isOpen={isWriteOffWizardOpen}
                onClose={() => setIsWriteOffWizardOpen(false)}
                clubId={clubId}
                userId={currentUserId}
                activeShiftId={activeShift?.id?.toString()}
                currentSalary={stats?.month_earnings || 0}
            />

            {/* Transfer Wizard */}
            <EmployeeTransferWizard
                isOpen={isTransferWizardOpen}
                onClose={() => setIsTransferWizardOpen(false)}
                clubId={clubId}
                userId={currentUserId}
                activeShiftId={activeShift?.id?.toString()}
            />

            {/* Support Requests Wizard */}
            <EmployeeRequestWizard
                isOpen={isRequestWizardOpen}
                onClose={() => setIsRequestWizardOpen(false)}
                clubId={clubId}
                userId={currentUserId}
            />

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
