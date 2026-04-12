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
import { getMonthRangeInTimezone } from "@/lib/utils"
import { SSEProvider } from "@/hooks/usePOSWebSocket"
import { KpiOverview, ChecklistKpiCard, MaintenanceKpiCard } from "@/components/employee/kpi/KpiOverview"
import { normalizeInventorySettings } from "@/lib/inventory-settings"
import { ShiftClosingWizard } from "./_components/ShiftClosingWizard"
import { ShiftOpeningWizard } from "./_components/ShiftOpeningWizard"
import { EmployeeSupplyWizard } from "./_components/EmployeeSupplyWizard"
import { EmployeeWriteOffWizard } from "./_components/EmployeeWriteOffWizard"
import { EmployeeTransferWizard } from "./_components/EmployeeTransferWizard"
import { EmployeeRequestWizard } from "./_components/EmployeeRequestWizard"
import { ShiftZoneSnapshotWizard } from "./_components/ShiftZoneSnapshotWizard"
import { EmployeeSignageControlCard } from "./_components/EmployeeSignageControlCard"

type ShiftAccountabilityStatusResponse = {
    mode: 'DISABLED' | 'WAREHOUSE'
    enabled: boolean
    ready: boolean
    warehouses_count: number
    configured_warehouses: Array<{
        id: number
        name: string
        shift_zone_key: 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM'
        shift_zone_label: string
    }>
    issues: string[]
}

interface ClubInfo {
    id: number
    name: string
    role: string
    timezone?: string
    inventory_settings?: {
        employee_default_metric_key?: string
        employee_allowed_warehouse_ids?: number[]
        sales_capture_mode?: 'SHIFT'
        inventory_timing?: 'END_SHIFT'
        shift_accountability_mode?: 'DISABLED' | 'WAREHOUSE'
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
    leaderboard?: {
        rank: number
        score: number
        total_participants: number
        is_frozen?: boolean
        finalized_at?: string | null
        leader: {
            rank: number
            user_id: string
            full_name: string
            score: number
        } | null
        top: Array<{
            rank: number
            user_id: string
            full_name: string
            score: number
        }>
        breakdown: {
            revenue: number
            checklist: number
            maintenance: number
            schedule: number
            discipline: number
        }
    } | null
    breakdown?: {
        base_salary: number
        shift_bonuses: number
        checklist_bonuses: number
        maintenance_bonuses: number
        maintenance_penalty?: number
        leaderboard_bonuses?: Array<{
            name: string
            amount: number
            rank: number
            score: number
            is_virtual: boolean
        }>
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
            maintenance_penalty?: number
            leaderboard?: number
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

async function fetchShiftAccountabilityStatus(clubId: string): Promise<ShiftAccountabilityStatusResponse> {
    const res = await fetch(`/api/employee/clubs/${clubId}/shift-accountability`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'Не удалось загрузить статус сменной ответственности')
    }
    return data as ShiftAccountabilityStatusResponse
}

async function fetchHasOpenZoneSnapshot(clubId: string, shiftId: string | number) {
    const res = await fetch(`/api/employee/clubs/${clubId}/shifts/${shiftId}/open-snapshot`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'Не удалось проверить приемку остатков')
    }
    return Boolean(data.has_snapshot)
}

async function fetchEmployeeRequests(clubId: string) {
    const res = await fetch(`/api/employee/clubs/${clubId}/requests`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'Не удалось загрузить заявки')
    }
    return Array.isArray(data.requests) ? data.requests : []
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
    const [clubTasks, setClubTasks] = useState<any[]>([])
    const [isUpdatingTask, setIsUpdatingTask] = useState<string | null>(null)

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
    const [startedShiftId, setStartedShiftId] = useState<string | number | null>(null)
    const [isOpenZoneSnapshotModalOpen, setIsOpenZoneSnapshotModalOpen] = useState(false)
    const [isCloseZoneSnapshotModalOpen, setIsCloseZoneSnapshotModalOpen] = useState(false)
    const [hasShiftAccountability, setHasShiftAccountability] = useState<boolean | null>(null)
    const [hasOpenZoneSnapshotDraft, setHasOpenZoneSnapshotDraft] = useState(false)
    const [hasPendingZoneStartAcceptance, setHasPendingZoneStartAcceptance] = useState(false)
    const [pendingShiftCloseData, setPendingShiftCloseData] = useState<any>(null)
    const [reportTemplate, setReportTemplate] = useState<any>(null)
    const [reportData, setReportData] = useState<Record<string, any>>({})
    
    // Checklist State
    const [checklistTemplates, setChecklistTemplates] = useState<any[]>([])
    const [isHandoverOpen, setIsHandoverOpen] = useState(false)
    const [handoverTemplate, setHandoverTemplate] = useState<any>(null)

    const [currentUserId, setCurrentUserId] = useState<string>('')
    const [evaluationScore, setEvaluationScore] = useState<number | null>(null)
    const [isEvaluationsLoading, setIsEvaluationsLoading] = useState(false)
    const normalizedInventorySettings = useMemo(() => normalizeInventorySettings(club?.inventory_settings), [club?.inventory_settings])
    const isSuppliesEnabled = normalizedInventorySettings.supplies_enabled
    const isStockEnabled = normalizedInventorySettings.stock_enabled
    const isCashboxEnabled = normalizedInventorySettings.cashbox_enabled && Boolean(normalizedInventorySettings.cashbox_warehouse_id)
    const canUseEmployeeWriteOff = isStockEnabled && normalizedInventorySettings.employee_writeoff_enabled
    const canUseEmployeeTransfer = isStockEnabled && normalizedInventorySettings.employee_transfer_enabled

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
                    
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">Выручка: {kpi.name}</h2>
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
    }, [kpiData?.kpi, kpiData?.remaining_shifts, kpiData?.shifts_count, kpiData?.completed_shifts, kpiData?.planned_shifts, kpiData?.days_remaining, activeShift?.id])

    const checklistComponents = useMemo(() => {
        if (!kpiData?.checklist) return null
        return kpiData.checklist.map((checklist: any) => (
            <div key={checklist.id} className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">Чек-лист</h2>
                </div>
                <ChecklistKpiCard kpi={checklist} formatCurrency={formatCurrency} />
            </div>
        ))
    }, [kpiData?.checklist?.length])

    const isBarBlockedByStartAcceptance = useMemo(() => {
        return false
    }, [])

    useEffect(() => {
        if (!clubId || !activeShift?.id) {
            setHasOpenZoneSnapshotDraft(false)
            return
        }
        try {
            const raw = window.localStorage.getItem(`shift-zone-snapshot:${clubId}:${activeShift.id}:OPEN`)
            if (!raw) {
                setHasOpenZoneSnapshotDraft(false)
                return
            }
            const parsed = JSON.parse(raw) as { items?: Array<{ counted_quantity?: number | null }>; selected_handover_source_shift_id?: string | null }
            const hasItems = Array.isArray(parsed.items) && parsed.items.length > 0
            const hasAnyCount = Array.isArray(parsed.items) && parsed.items.some((item) => item.counted_quantity !== null && item.counted_quantity !== undefined)
            setHasOpenZoneSnapshotDraft(Boolean(parsed.selected_handover_source_shift_id) || hasItems || hasAnyCount)
        } catch (error) {
            console.error("Failed to inspect open snapshot draft", error)
            setHasOpenZoneSnapshotDraft(false)
        }
    }, [activeShift?.id, clubId, isOpenZoneSnapshotModalOpen])

    useEffect(() => {
        if (!clubId || !activeShift?.id || !hasShiftAccountability) {
            setHasPendingZoneStartAcceptance(false)
            return
        }

        let cancelled = false

        fetchHasOpenZoneSnapshot(clubId, activeShift.id)
            .then((hasOpenSnapshot) => {
                if (cancelled) return
                const pendingAcceptance = !hasOpenSnapshot
                setHasPendingZoneStartAcceptance(pendingAcceptance)
                if (pendingAcceptance) {
                    setStartedShiftId(activeShift.id)
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    console.error('Failed to inspect zone start acceptance:', error)
                    setHasPendingZoneStartAcceptance(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [activeShift?.id, clubId, hasShiftAccountability, isOpenZoneSnapshotModalOpen])

    const maintenanceComponent = useMemo(() => {
        if (!kpiData?.maintenance) return null
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                    
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">Обслуживание</h2>
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
        if (clubInfo) {
            fetchData(clubId)
        }
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
        let cancelled = false

        fetchShiftAccountabilityStatus(clubId)
            .then((status) => {
                if (!cancelled) setHasShiftAccountability(status.enabled && status.ready)
            })
            .catch((error) => {
                if (!cancelled) {
                    console.error("Failed to load shift accountability status", error)
                    setHasShiftAccountability(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [clubId, currentUserId])

    useEffect(() => {
        if (!clubId || !currentUserId) return
        
        // Оптимизация: не создаем SSE если страница не активна
        const fetchUnreadRequests = async () => {
            try {
                const requests = await fetchEmployeeRequests(clubId)
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
            const clubTimezone = employeeClubs.find((item: ClubInfo) => String(item.id) === id)?.timezone || 'Europe/Moscow'
            const { firstDay: monthStart, lastDay: monthEnd } = getMonthRangeInTimezone(new Date(), clubTimezone)

            await fetch(`/api/clubs/${id}/equipment/maintenance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date_from: monthStart,
                    date_to: monthEnd,
                    task_type: "CLEANING"
                })
            })

            // Оптимизация: выполняем все запросы параллельно
            const results = await Promise.all([
                fetch(`/api/employee/clubs/${id}/active-shift`).then(r => r.json()),
                fetch(`/api/employee/clubs/${id}/stats`).then(r => r.json()),
                fetch(`/api/employee/clubs/${id}/kpi`).then(r => r.json()),
                fetch(`/api/clubs/${id}/settings/reports`, { cache: 'no-store' }).then(r => r.json()),
                fetch(`/api/clubs/${id}/equipment/maintenance?assigned=me&status=PENDING,IN_PROGRESS`).then(r => r.json()),
                fetch(`/api/clubs/${id}/equipment/maintenance?assigned=me&verification_status=REJECTED`).then(r => r.json()),
                fetch(`/api/employee/clubs/${id}/equipment-rating`).then(r => r.json()),
                fetch(`/api/clubs/${id}/tasks`).then(r => r.json()),
            ])

            const [
                shiftData,
                statsData,
                kpiData,
                reportJson,
                tasksData,
                reworkData,
                ratingData,
                tasksJson
            ] = results

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

            // Club Tasks
            if (tasksJson?.tasks) {
                setClubTasks(tasksJson.tasks || [])
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

            const data = await res.json()

            if (res.ok) {
                const accountabilityStatus = await fetchShiftAccountabilityStatus(clubId)
                const hasShiftZones = accountabilityStatus.enabled && accountabilityStatus.ready
                setHasShiftAccountability(hasShiftZones)

                if (data.shift_id) {
                    setStartedShiftId(data.shift_id)
                    if (hasShiftZones) {
                        setIsOpenZoneSnapshotModalOpen(true)
                    }
                }
                await fetchData(clubId)
            } else {
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
                    const accountabilityStatus = await fetchShiftAccountabilityStatus(clubId)
                    const hasShiftZones = accountabilityStatus.enabled && accountabilityStatus.ready
                    setHasShiftAccountability(hasShiftZones)
                    if (activeShift?.id && hasShiftZones) {
                        setPendingShiftCloseData({})
                        setIsCloseZoneSnapshotModalOpen(true)
                        return
                    }
                    submitEndShift({})
                }
            }
        } catch (e) {
            console.error(e)
            if (confirm('Завершить смену?')) {
                const accountabilityStatus = await fetchShiftAccountabilityStatus(clubId)
                const hasShiftZones = accountabilityStatus.enabled && accountabilityStatus.ready
                setHasShiftAccountability(hasShiftZones)
                if (activeShift?.id && hasShiftZones) {
                    setPendingShiftCloseData({})
                    setIsCloseZoneSnapshotModalOpen(true)
                    return
                }
                submitEndShift({})
            }
        }
    }

    const finalizeShiftClose = useCallback(async (data: any) => {
        await submitEndShift(data)
    }, [activeShift?.id, reportTemplate?.id, currentUserId, clubId])

    const handleCompleteClubTask = async (taskId: string) => {
        setIsUpdatingTask(taskId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taskId })
            })

            if (res.ok) {
                setClubTasks(prev => prev.filter((t: any) => t.id !== taskId))
            } else {
                const data = await res.json()
                alert(data.error || "Ошибка при выполнении задачи")
            }
        } catch (error) {
            console.error("Error completing club task:", error)
            alert("Ошибка сети")
        } finally {
            setIsUpdatingTask(null)
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

    const handleShiftClosingWizardComplete = useCallback(async (data: any) => {
        const accountabilityStatus = await fetchShiftAccountabilityStatus(clubId)
        const hasShiftZones = accountabilityStatus.enabled && accountabilityStatus.ready
        setHasShiftAccountability(hasShiftZones)
        if (activeShift?.id && hasShiftZones) {
            setPendingShiftCloseData(data)
            setIsReportModalOpen(false)
            setIsCloseZoneSnapshotModalOpen(true)
            return
        }
        await finalizeShiftClose(data)
    }, [activeShift?.id, clubId, finalizeShiftClose])

    const liveTime = formatLiveTime(liveSecondsRef.current)
    const currentEarnings = stats ? (liveSecondsRef.current / 3600) * stats.hourly_rate : 0

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto" />
                    <p className="mt-4 text-sm text-muted-foreground">Загрузка...</p>
                </div>
            </div>
        )
    }

    if (!club) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <h3 className="text-xl font-semibold">Клуб не найден</h3>
                    <Link href="/employee/dashboard" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors">
                        ← Вернуться к списку клубов
                    </Link>
                </div>
            </div>
        )
    }

    if (!currentUserId) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto" />
                    <p className="mt-4 text-sm text-muted-foreground">Загрузка...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-4 py-8 md:px-8 md:py-12 space-y-12 relative z-0">
            {/* Rework Alert Notification */}
            {reworkTasksCount > 0 && (
                <Link href={`/employee/clubs/${clubId}/tasks?verification_status=REJECTED`} className="block group">
                    <div className="flex items-center justify-between rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 transition-colors hover:bg-rose-500/20">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-500">
                                <AlertCircle className="h-4 w-4" />
                            </div>
                            <div className="space-y-1 pr-4">
                                <p className="font-bold text-sm text-rose-500">Доработка ({reworkTasksCount})</p>
                                <p className="text-xs text-rose-400/80 leading-relaxed max-w-2xl">
                                    Ваша работа не прошла проверку. Руководитель или система контроля вернули задачи на исправление. Пожалуйста, исправьте недочеты, чтобы не потерять бонус за эффективность.
                                </p>
                            </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 opacity-50 group-hover:opacity-100 transition-opacity shrink-0">
                            <ChevronRight className="h-4 w-4" />
                        </div>
                    </div>
                </Link>
            )}

            <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
                {/* Main Content */}
                <div className="space-y-10">
                    
                    {/* Shift Control */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold tracking-tight text-foreground">Смена</h2>
                            {activeShift && (
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Активна</span>
                                </div>
                            )}
                        </div>

                        {activeShift ? (
                            <div className="space-y-8 rounded-xl border bg-card p-6">
                                <div className="flex flex-col items-center justify-center py-4">
                                    <div className="flex items-baseline gap-1 font-mono tracking-tighter">
                                        <span className="text-6xl md:text-7xl font-bold text-foreground">{liveDisplay.split(':')[0]}</span>
                                        <span className="text-3xl md:text-5xl text-muted-foreground/30">:</span>
                                        <span className="text-6xl md:text-7xl font-bold text-foreground">{liveDisplay.split(':')[1]}</span>
                                        <span className="text-3xl md:text-5xl text-muted-foreground/30">:</span>
                                        <span className="text-3xl md:text-5xl font-medium text-muted-foreground">{liveDisplay.split(':')[2]}</span>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>Начало в {new Date(activeShift.check_in).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="w-1 h-1 rounded-full bg-border" />
                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">+{formatCurrency(currentEarnings)}</span>
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    {isBarBlockedByStartAcceptance && (
                                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
                                            Завершите приемку остатков. Касса и складские действия заблокированы.
                                        </div>
                                    )}
                                    {(hasOpenZoneSnapshotDraft || hasPendingZoneStartAcceptance) && activeShift?.id && (
                                        <Button
                                            variant="outline"
                                            className="w-full h-11 text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:bg-amber-900/50 dark:text-amber-400"
                                            onClick={() => {
                                                setStartedShiftId(activeShift.id)
                                                setIsOpenZoneSnapshotModalOpen(true)
                                            }}
                                        >
                                            {hasPendingZoneStartAcceptance && !hasOpenZoneSnapshotDraft ? "Начать приемку остатков" : "Вернуться к приемке"}
                                        </Button>
                                    )}
                                    <Button
                                        variant="default"
                                        className="w-full h-12 text-sm font-semibold shadow-none"
                                        onClick={handleEndShiftClick}
                                    >
                                        {isActionLoading && !isReportModalOpen ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Завершить смену
                                    </Button>
                                </div>

                                {/* Utilities */}
                                <div className="pt-2">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {isSuppliesEnabled && (
                                            <Button
                                                variant="outline"
                                                className="h-10 text-xs shadow-none border-border bg-card hover:bg-accent hover:text-accent-foreground"
                                                onClick={() => setIsSupplyWizardOpen(true)}
                                                disabled={isBarBlockedByStartAcceptance}
                                            >
                                                Поставка
                                            </Button>
                                        )}
                                        {isCashboxEnabled && (
                                            <Button
                                                variant="outline"
                                                className="h-10 text-xs shadow-none border-border bg-card hover:bg-accent hover:text-accent-foreground"
                                                onClick={() => window.open(`/employee/clubs/${clubId}/pos`, '_blank', 'noopener,noreferrer')}
                                                disabled={isBarBlockedByStartAcceptance}
                                            >
                                                Касса
                                            </Button>
                                        )}
                                        {canUseEmployeeWriteOff && (
                                            <Button
                                                variant="outline"
                                                className="h-10 text-xs shadow-none border-border bg-card hover:bg-accent hover:text-accent-foreground"
                                                onClick={() => setIsWriteOffWizardOpen(true)}
                                                disabled={isBarBlockedByStartAcceptance}
                                            >
                                                Списание
                                            </Button>
                                        )}
                                        {canUseEmployeeTransfer && (
                                            <Button
                                                variant="outline"
                                                className="h-10 text-xs shadow-none border-border bg-card hover:bg-accent hover:text-accent-foreground"
                                                onClick={() => setIsTransferWizardOpen(true)}
                                                disabled={isBarBlockedByStartAcceptance}
                                            >
                                                Перемещение
                                            </Button>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        className="w-full mt-2 h-10 text-xs text-muted-foreground border border-transparent hover:bg-accent hover:border-border hover:text-foreground transition-all"
                                        onClick={() => setIsRequestWizardOpen(true)}
                                    >
                                        Связаться с руководством
                                        {unreadRequestsCount > 0 && (
                                            <Badge variant="secondary" className="ml-2 h-4 px-1 text-[9px] bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                                                {unreadRequestsCount}
                                            </Badge>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 space-y-6 flex flex-col items-center justify-center rounded-xl border bg-card">
                                <div className="text-center space-y-1">
                                    <h3 className="text-base font-medium text-foreground">Смена закрыта</h3>
                                    <p className="text-sm text-muted-foreground">Начните смену для учёта рабочего времени</p>
                                </div>

                                <Button
                                    className="h-11 px-8 shadow-none"
                                    onClick={handleStartShift}
                                >
                                    {isActionLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Начать смену
                                </Button>
                            </div>
                        )}
                    </section>

                    {activeShift && (
                        <EmployeeSignageControlCard clubId={clubId} enabled={Boolean(activeShift)} />
                    )}

                    {/* Warehouse Tasks */}
                    {clubTasks.length > 0 && (
                        <section className="space-y-4">
                            <h2 className="text-lg font-semibold tracking-tight text-foreground">Пополнение склада</h2>
                            <div className="grid gap-3">
                                {clubTasks.map((task: any) => (
                                    <div key={task.id} className="group flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                                        <div className="space-y-1.5 min-w-0">
                                            <h3 className="truncate text-sm font-semibold text-slate-900">
                                                {task.title.replace('Пополнить: ', '')}
                                            </h3>
                                            <div className="space-y-1 text-xs text-slate-600">
                                                {task.target_warehouse_name ? (
                                                    <div>
                                                        Текущий остаток в {task.target_warehouse_name}: <span className="font-semibold text-slate-900">{Number(task.current_target_stock || 0)} шт</span>
                                                    </div>
                                                ) : null}
                                                {task.suggested_restock_quantity !== undefined && task.suggested_restock_quantity !== null ? (
                                                    <div>
                                                        Доставить до <span className="font-semibold text-slate-900">{Number(task.current_target_stock || 0) + Number(task.suggested_restock_quantity || 0)} шт</span>
                                                    </div>
                                                ) : null}
                                                {task.source_warehouse_name ? (
                                                    <div>
                                                        Взять из: <span className="font-semibold text-slate-900">{task.source_warehouse_name}</span>
                                                        {task.current_source_stock !== undefined && task.current_source_stock !== null ? (
                                                            <span className="text-slate-500">, доступно {Number(task.current_source_stock || 0)} шт</span>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                                {!task.source_warehouse_name && !task.target_warehouse_name ? (
                                                    <div>{task.description}</div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-8 shrink-0 bg-slate-900 text-xs text-white shadow-none hover:bg-slate-800"
                                            onClick={() => handleCompleteClubTask(task.id)}
                                            disabled={isUpdatingTask === task.id}
                                        >
                                            {isUpdatingTask === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Выполнено"}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Maintenance Tasks Overview */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold tracking-tight text-foreground">Обслуживание</h2>
                            <Link href={`/employee/clubs/${clubId}/tasks`} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                                Все задачи →
                            </Link>
                        </div>
                        <Link href={`/employee/clubs/${clubId}/tasks`} className="block">
                            <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-foreground">Задачи на смену</p>
                                    <p className="text-xs text-muted-foreground">
                                        {pendingTasksCount > 0 ? `${pendingTasksCount} требуют внимания` : "Всё оборудование чистое"}
                                    </p>
                                </div>
                                {pendingTasksCount > 0 ? (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                        <Brush className="h-4 w-4" />
                                    </div>
                                ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                        <ClipboardCheck className="h-4 w-4" />
                                    </div>
                                )}
                            </div>
                        </Link>
                    </section>

                </div>

                {/* Sidebar (Stats & Leaderboard) */}
                <div className="space-y-8 lg:border-l lg:pl-8">
                    
                    {/* Salary Estimate */}
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Зарплата за месяц</h2>
                        <div className="space-y-1">
                            <p className="text-4xl font-bold tracking-tight text-foreground">{formatCurrency(stats?.month_earnings || 0)}</p>
                            <p className="text-xs text-muted-foreground">Ориентировочный расчет</p>
                        </div>

                        {stats?.breakdown && (
                            <div className="pt-4 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Ставка ({stats.total_hours?.toFixed(1) || (stats.today_hours + stats.week_hours)?.toFixed(1)} ч)</span>
                                    <span className="font-medium text-foreground">{formatCurrency(stats.breakdown.base_salary)}</span>
                                </div>
                                {stats.breakdown.shift_bonuses > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Бонусы смен</span>
                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">+{formatCurrency(stats.breakdown.shift_bonuses)}</span>
                                    </div>
                                )}
                                {stats.breakdown.revenue_kpi_breakdown?.filter((b: any) => !b.is_virtual).map((bonus: any, idx: number) => (
                                    <div key={`real-${idx}`} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">{bonus.name}</span>
                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">+{formatCurrency(bonus.amount)}</span>
                                    </div>
                                ))}
                                {stats.breakdown.checklist_bonuses > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Чек-листы</span>
                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">+{formatCurrency(stats.breakdown.checklist_bonuses)}</span>
                                    </div>
                                )}
                                {stats.breakdown.maintenance_bonuses > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Обслуживание</span>
                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">+{formatCurrency(stats.breakdown.maintenance_bonuses)}</span>
                                    </div>
                                )}
                                {stats.breakdown.leaderboard_bonuses?.filter((b: any) => !b.is_virtual).map((bonus: any, idx: number) => (
                                    <div key={`lead-${idx}`} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Рейтинг</span>
                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">+{formatCurrency(bonus.amount)}</span>
                                    </div>
                                ))}
                                {(stats.breakdown.maintenance_penalty || 0) > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Штраф</span>
                                        <span className="font-medium text-rose-600 dark:text-rose-400">-{formatCurrency(stats.breakdown.maintenance_penalty || 0)}</span>
                                    </div>
                                )}
                                {(stats.breakdown.bar_deductions || 0) > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Бар в счет ЗП</span>
                                        <span className="font-medium text-rose-600 dark:text-rose-400">-{formatCurrency(stats.breakdown.bar_deductions || 0)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Leaderboard */}
                    {stats?.leaderboard && (
                        <section className="space-y-4 pt-6 border-t">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Рейтинг</h2>
                                {stats.leaderboard.is_frozen && (
                                    <Badge variant="outline" className="text-[9px] uppercase">Заморожен</Badge>
                                )}
                            </div>
                            
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold tracking-tight text-foreground">{stats.leaderboard.score.toFixed(1)}</span>
                                <span className="text-sm text-muted-foreground">/ 10</span>
                                <Badge variant="secondary" className="ml-auto bg-accent">
                                    #{stats.leaderboard.rank} из {stats.leaderboard.total_participants}
                                </Badge>
                            </div>

                            <div className="space-y-2 pt-2">
                                {stats.leaderboard.top.map(item => (
                                    <div key={item.user_id} className={cn(
                                        "flex items-center justify-between text-sm py-1.5 px-2 rounded",
                                        item.rank === stats.leaderboard?.rank ? "bg-accent/50 font-medium text-foreground" : "text-muted-foreground"
                                    )}>
                                        <div className="flex items-center gap-3">
                                            <span className="w-4 text-xs font-semibold">{item.rank}</span>
                                            <span>{item.full_name}</span>
                                        </div>
                                        <span className="font-semibold text-foreground">{item.score.toFixed(1)}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>

            {(kpiComponents || checklistComponents || maintenanceComponent) && (
                <section className="space-y-6 pt-10 mt-10 border-t">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">Показатели (KPI)</h2>
                    <div className="space-y-8">
                        {kpiComponents}
                        <div className="grid gap-6 lg:grid-cols-1">
                            {maintenanceComponent}
                            {checklistComponents}
                        </div>
                    </div>
                </section>
            )}

            {(!kpiData || (!kpiData.kpi?.length && !kpiData.checklist?.length && !kpiData.maintenance)) && (
                <section className="pt-10 mt-10 border-t">
                    <p className="text-sm text-muted-foreground text-center py-8">KPI показатели пока не назначены</p>
                </section>
            )}

            {/* Modals and Wizards */}
            {isHandoverOpen && handoverTemplate && (
                <ShiftOpeningWizard
                    isOpen={isHandoverOpen}
                    onClose={() => setIsHandoverOpen(false)}
                    onComplete={async (checklistResponses: Record<number, { score: number, comment: string, photo_urls?: string[] }>, targetShiftId?: string, selectedUserId?: string | null) => {
                        try {
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

            {activeShift && club && (
                <SSEProvider clubId={clubId} userId={currentUserId}>
                    <ShiftClosingWizard
                        isOpen={isReportModalOpen}
                        onClose={() => setIsReportModalOpen(false)}
                        onComplete={handleShiftClosingWizardComplete}
                        clubId={clubId}
                        userId={currentUserId}
                        reportTemplate={reportTemplate}
                        activeShiftId={activeShift.id}
                        skipInventory
                        checklistTemplates={checklistTemplates}
                        inventorySettings={{
                            employee_default_metric_key: normalizedInventorySettings.employee_default_metric_key,
                            employee_allowed_warehouse_ids: normalizedInventorySettings.employee_allowed_warehouse_ids,
                            blind_inventory_enabled: normalizedInventorySettings.blind_inventory_enabled,
                            report_reconciliation_enabled: normalizedInventorySettings.report_reconciliation_enabled,
                            cashbox_warehouse_id: normalizedInventorySettings.cashbox_warehouse_id,
                            handover_warehouse_id: normalizedInventorySettings.handover_warehouse_id,
                            sales_capture_mode: normalizedInventorySettings.sales_capture_mode,
                            inventory_timing: normalizedInventorySettings.inventory_timing,
                        }}
                    />
                </SSEProvider>
            )}

            {startedShiftId && (
                <ShiftZoneSnapshotWizard
                    isOpen={isOpenZoneSnapshotModalOpen}
                    onClose={() => setIsOpenZoneSnapshotModalOpen(false)}
                    onComplete={async () => {
                        await fetchData(clubId)
                    }}
                    clubId={clubId}
                    shiftId={String(startedShiftId)}
                    snapshotType="OPEN"
                />
            )}

            {activeShift?.id && (
                <ShiftZoneSnapshotWizard
                    isOpen={isCloseZoneSnapshotModalOpen}
                    onClose={() => setIsCloseZoneSnapshotModalOpen(false)}
                    onComplete={async () => {
                        const data = pendingShiftCloseData
                        setPendingShiftCloseData(null)
                        await finalizeShiftClose(data || {})
                    }}
                    clubId={clubId}
                    shiftId={String(activeShift.id)}
                    snapshotType="CLOSE"
                    blindCloseMode={Boolean(normalizedInventorySettings.blind_inventory_enabled)}
                />
            )}

            <EmployeeSupplyWizard
                isOpen={isSupplyWizardOpen}
                onClose={() => setIsSupplyWizardOpen(false)}
                clubId={clubId}
                userId={currentUserId}
                activeShiftId={activeShift?.id?.toString()}
            />

            <EmployeeWriteOffWizard
                isOpen={isWriteOffWizardOpen}
                onClose={() => setIsWriteOffWizardOpen(false)}
                clubId={clubId}
                userId={currentUserId}
                activeShiftId={activeShift?.id?.toString()}
            />

            <EmployeeTransferWizard
                isOpen={isTransferWizardOpen}
                onClose={() => setIsTransferWizardOpen(false)}
                clubId={clubId}
                userId={currentUserId}
                activeShiftId={activeShift?.id?.toString()}
            />

            <EmployeeRequestWizard
                isOpen={isRequestWizardOpen}
                onClose={() => setIsRequestWizardOpen(false)}
                clubId={clubId}
                userId={currentUserId}
            />

            <Dialog open={isIndicatorsModalOpen} onOpenChange={setIsIndicatorsModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Промежуточные показатели</DialogTitle>
                        <DialogDescription>
                            Внесите текущие данные, чтобы увидеть обновленный прогноз KPI
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                        {reportTemplate?.schema?.map((field: any, idx: number) => (
                            <div key={idx} className="space-y-2">
                                <Label>{field.custom_label}</Label>
                                <Input
                                    type={field.metric_key.includes('comment') ? 'text' : 'number'}
                                    placeholder="Текущее значение"
                                    onChange={(e) => setReportData({ ...reportData, [field.metric_key]: e.target.value })}
                                    defaultValue={activeShift ? (
                                        typeof activeShift.report_data === 'string'
                                            ? JSON.parse(activeShift.report_data || '{}')[field.metric_key]
                                            : (activeShift.report_data as any)?.[field.metric_key]
                                    ) : ''}
                                />
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => submitUpdateIndicators(reportData)}
                            disabled={isActionLoading}
                            className="w-full"
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
