"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
    Monitor,
    Play,
    Check,
    MapPin,
    Search,
    List,
    Trash2
} from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns"
import { ru } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn, formatDateKeyInTimezone, getMonthRangeInTimezone } from "@/lib/utils"
import Link from "next/link"
import { MaintenanceSessionWizard } from "@/app/clubs/[clubId]/equipment/maintenance/MaintenanceSessionWizard"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"

interface MaintenanceTask {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type: string
    equipment_type_name: string
    workstation_name?: string
    due_date: string
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
    kpi_points: number
    last_cleaned_at?: string
    verification_status?: string
    rejection_reason?: string
}

const normalizeDateKey = (value?: string | null) => {
    if (!value) return ""
    const normalized = String(value).trim()
    const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
    return match ? match[1] : normalized
}

const normalizeStatus = (value?: string | null) => String(value || "").trim().toUpperCase()

const normalizeTask = (task: any): MaintenanceTask => ({
    ...task,
    due_date: normalizeDateKey(task?.due_date),
    status: normalizeStatus(task?.status) as MaintenanceTask["status"],
    verification_status: task?.verification_status ? normalizeStatus(task.verification_status) : task?.verification_status
})

export default function EmployeeTasksPage() {
    const { clubId } = useParams()
    const [clubTimezone, setClubTimezone] = useState('Europe/Moscow')
    const [tasks, setTasks] = useState<MaintenanceTask[]>([])
    const [freeTasks, setFreeTasks] = useState<MaintenanceTask[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUpdating, setIsUpdating] = useState<string | null>(null)
    const [apiStats, setApiStats] = useState<{
        overdue_count: number;
        due_today_count: number;
        upcoming_count: number;
        completed_count: number;
        in_progress_count: number;
        rework_count: number;
        stale_rework_count: number;
        month_plan_count: number;
        month_completed_count: number;
        old_debt_closed_count: number;
        quality_penalty_units: number;
        adjusted_month_completed_count: number;
        raw_efficiency: number;
        adjusted_efficiency: number;
    } | null>(null)
    const [filterMode, setFilterMode] = useState<'current' | 'all'>('current')
    
    // Session Wizard State
    const [isSessionOpen, setIsSessionOpen] = useState(false)
    const [sessionTasks, setSessionTasks] = useState<MaintenanceTask[]>([])

    const ensurePlan = useCallback(async (date: Date) => {
        try {
            const { firstDay, lastDay } = getMonthRangeInTimezone(date, clubTimezone)
            
            // Just ensure we have tasks generated for today/upcoming
            await fetch(`/api/clubs/${clubId}/equipment/maintenance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date_from: firstDay,
                    date_to: lastDay,
                    task_type: 'CLEANING'
                })
            })
        } catch (error) {
            console.error("Error ensuring plan:", error)
        }
    }, [clubId, clubTimezone])

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const today = formatDateKeyInTimezone(new Date(), clubTimezone)
            const { firstDay: monthStart, lastDay: monthEnd } = getMonthRangeInTimezone(new Date(), clubTimezone)
            
            // Ensure next tasks are generated
            await ensurePlan(new Date())
            
            const [assignedRes, freeRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/equipment/maintenance?assigned=me&date_from=${monthStart}&date_to=${monthEnd}&include_overdue=true`),
                fetch(`/api/clubs/${clubId}/equipment/maintenance?assigned=unassigned&status=PENDING&date_to=${today}&include_overdue=true`)
            ])

            const assignedData = await assignedRes.json()
            const freeData = await freeRes.json()

            if (assignedRes.ok) {
                setTasks(Array.isArray(assignedData.tasks) ? assignedData.tasks.map(normalizeTask) : [])
                if (assignedData.stats) {
                    setApiStats({
                        overdue_count: parseInt(assignedData.stats.overdue_count || '0'),
                        due_today_count: parseInt(assignedData.stats.due_today_count || '0'),
                        upcoming_count: parseInt(assignedData.stats.upcoming_count || '0'),
                        completed_count: parseInt(assignedData.stats.completed_count || '0'),
                        in_progress_count: parseInt(assignedData.stats.in_progress_count || '0'),
                        rework_count: parseInt(assignedData.stats.rework_count || '0'),
                        stale_rework_count: parseInt(assignedData.stats.stale_rework_count || '0'),
                        month_plan_count: parseInt(assignedData.stats.month_plan_count || '0'),
                        month_completed_count: parseInt(assignedData.stats.month_completed_count || '0'),
                        old_debt_closed_count: parseInt(assignedData.stats.old_debt_closed_count || '0'),
                        quality_penalty_units: parseInt(assignedData.stats.quality_penalty_units || '0'),
                        adjusted_month_completed_count: parseInt(assignedData.stats.adjusted_month_completed_count || '0'),
                        raw_efficiency: parseFloat(assignedData.stats.raw_efficiency || '0'),
                        adjusted_efficiency: parseFloat(assignedData.stats.adjusted_efficiency || '0')
                    })
                }
            }
            if (freeRes.ok) setFreeTasks(Array.isArray(freeData.tasks) ? freeData.tasks.map(normalizeTask) : [])
        } catch (error) {
            console.error("Error fetching tasks:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId, ensurePlan])

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                const currentClub = Array.isArray(data.employeeClubs)
                    ? data.employeeClubs.find((item: any) => String(item.id) === String(clubId))
                    : null
                if (currentClub?.timezone) {
                    setClubTimezone(currentClub.timezone)
                }
            })
            .catch(error => {
                console.error("Error fetching club timezone:", error)
            })
    }, [clubId])

    useEffect(() => {
        fetchData()
    }, [fetchData, clubTimezone])

    const handleStartSession = (task: MaintenanceTask) => {
        setSessionTasks([task])
        setIsSessionOpen(true)
    }

    const handleAction = async (taskId: string, action: 'START' | 'COMPLETE') => {
        // If completing, open wizard directly (wizard handles completion logic)
        if (action === 'COMPLETE') {
            const task = tasks.find(t => t.id === taskId)
            if (task) handleStartSession(task)
            return
        }

        // If starting, mark as IN_PROGRESS then open wizard
        setIsUpdating(taskId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: 'IN_PROGRESS' })
            })

            if (res.ok) {
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'IN_PROGRESS' } : t))
                const updatedTask = tasks.find(t => t.id === taskId)
                if (updatedTask) {
                    handleStartSession({ ...updatedTask, status: 'IN_PROGRESS' })
                }
            }
        } catch (error) {
            console.error("Error updating task status:", error)
        } finally {
            setIsUpdating(null)
        }
    }

    const handleClaim = async (taskId: string) => {
        setIsUpdating(taskId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ claim: true })
            })

            if (res.ok) {
                setFreeTasks(prev => prev.filter(t => t.id !== taskId))
                fetchData()
            }
        } catch (error) {
            console.error("Error claiming task:", error)
        } finally {
            setIsUpdating(null)
        }
    }

    const groupedTasks = useMemo(() => {
        const groups: Record<string, MaintenanceTask[]> = {}
        const todayStr = formatDateKeyInTimezone(new Date(), clubTimezone)
        
        tasks.forEach(task => {
            if (filterMode === 'current') {
                const isOverdue = task.status === 'PENDING' && task.due_date < todayStr
                const isTodayTask = task.status === 'PENDING' && task.due_date === todayStr
                const isInProgress = task.status === 'IN_PROGRESS'
                if (!isOverdue && !isTodayTask && !isInProgress) return
            }

            const location = task.workstation_name || "Склад"
            if (!groups[location]) groups[location] = []
            groups[location].push(task)
        })

        return Object.entries(groups).sort(([a], [b]) => {
            if (a === "Склад") return -1
            if (b === "Склад") return 1
            return a.localeCompare(b)
        })
    }, [tasks, filterMode])

    const groupedFreeTasks = useMemo(() => {
        const groups: Record<string, MaintenanceTask[]> = {}
        
        freeTasks.forEach(task => {
            const location = task.workstation_name || "Склад"
            if (!groups[location]) groups[location] = []
            groups[location].push(task)
        })

        return Object.entries(groups).sort(([a], [b]) => {
            if (a === "Склад") return -1
            if (b === "Склад") return 1
            return a.localeCompare(b)
        })
    }, [freeTasks])

    const stats = useMemo(() => {
        const todayKey = formatDateKeyInTimezone(new Date(), clubTimezone)
        const total = tasks.length
        const in_progress = tasks.filter(t => t.status === 'IN_PROGRESS').length
        const overdue = tasks.filter(t => t.status === 'PENDING' && t.due_date < todayKey).length
        return { total, in_progress, overdue }
    }, [tasks])

    const handleResetAll = async () => {
        if (!confirm("ВНИМАНИЕ: Это полностью удалит ВСЕ записи о чистке и сбросит даты последнего обслуживания для всего оборудования в клубе. Это действие необратимо! Вы уверены?")) return

        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/reset`, {
                method: "POST"
            })
            if (res.ok) {
                alert("Все записи удалены. Сейчас будут сгенерированы новые задачи.")
                // Force reload to regenerate
                window.location.reload()
            }
        } catch (error) {
            console.error("Error resetting tasks:", error)
            alert("Ошибка при сбросе")
        } finally {
            setIsLoading(false)
        }
    }

    const renderTaskCard = (task: MaintenanceTask, isFree: boolean = false, hideLocation: boolean = false) => {
        const todayStr = formatDateKeyInTimezone(new Date(), clubTimezone)
        const isFuture = task.status === 'PENDING' && task.due_date > todayStr
        const isOverdue = task.status === 'PENDING' && task.due_date < todayStr
        const isInProgress = task.status === 'IN_PROGRESS'
        const isCompleted = task.status === 'COMPLETED'
        const isRejected = task.verification_status === 'REJECTED' && task.status === 'IN_PROGRESS'
        const showAsCompleted = isCompleted || isFuture

        return (
            <Card key={task.id} className={cn(
                "border-none shadow-sm overflow-hidden",
                isInProgress ? "ring-1 ring-indigo-500 bg-indigo-50/5" : "bg-white dark:bg-slate-800/80 hover:shadow-md",
                (isFree || showAsCompleted) && "opacity-80 hover:opacity-100",
                showAsCompleted && "bg-slate-50 dark:bg-slate-900/50",
                isRejected && "ring-1 ring-red-500 bg-red-50/10"
            )}>
                <CardContent className="p-0">
                    <div className="flex items-stretch min-h-16">
                        <div className={cn(
                            "w-1 transition-all shrink-0",
                            isRejected ? "bg-red-500" : isCompleted ? "bg-emerald-500" : isFuture ? "bg-blue-400" : isFree ? "bg-slate-300 dark:bg-slate-600" : isOverdue ? "bg-rose-500" : isInProgress ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"
                        )} />
                        <div className="px-4 py-3 flex-1 grid grid-cols-[1fr_auto] items-center gap-3 min-w-0">
                            <div className="flex flex-col gap-2 min-w-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        "h-9 w-9 rounded-xl flex items-center justify-center transition-colors shrink-0",
                                        isRejected ? "bg-red-100 text-red-600" : isInProgress ? "bg-indigo-500 text-white" : showAsCompleted ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                                    )}>
                                        {isRejected ? <AlertCircle className="h-5 w-5" /> : showAsCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                                    </div>
                                    <div className="min-w-0 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h4 className={cn("font-bold text-sm truncate", showAsCompleted && "text-muted-foreground")}>{task.equipment_name}</h4>
                                            {!isFree && isOverdue && !showAsCompleted && (
                                                <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0" title="Просрочено" />
                                            )}
                                            {isRejected && (
                                                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">На доработку</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                            <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded leading-none shrink-0">{task.equipment_type_name}</span>
                                            {!hideLocation && (
                                                <span className="truncate opacity-60">{task.workstation_name || "Склад"}</span>
                                            )}
                                            {isFree && <span className="text-indigo-500 opacity-100">СВОБОДНО</span>}
                                            {task.last_cleaned_at && (
                                                <span className="text-emerald-600/70 dark:text-emerald-400/70 flex items-center gap-1">
                                                    <Check className="h-3 w-3" />
                                                    {format(new Date(task.last_cleaned_at), 'dd.MM')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {isRejected && task.rejection_reason && (
                                    <div className="text-xs bg-red-50 text-red-800 p-2 rounded-md border border-red-100 mt-1">
                                        <span className="font-bold">Комментарий:</span> {task.rejection_reason}
                                    </div>
                                )}
                            </div>

                            <div className="shrink-0 self-center">
                                {isFree ? (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-9 w-24 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs transition-all"
                                        onClick={() => handleClaim(task.id)}
                                        disabled={isUpdating === task.id}
                                    >
                                        {isUpdating === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Взять"}
                                    </Button>
                                ) : showAsCompleted ? (
                                    <div className="flex flex-col items-end justify-center h-9 w-24">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">След.</span>
                                        <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                                            {format(new Date(task.due_date), 'dd.MM')}
                                        </span>
                                    </div>
                                ) : isInProgress ? (
                                    <Button
                                        size="sm"
                                        className={cn(
                                            "h-9 w-24 rounded-lg font-bold text-xs shadow-sm transition-all",
                                            isRejected 
                                                ? "bg-red-600 hover:bg-red-700 shadow-red-200 text-white" 
                                                : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 text-white dark:shadow-none"
                                        )}
                                        onClick={() => handleAction(task.id, 'COMPLETE')}
                                        disabled={isUpdating === task.id}
                                    >
                                        {isUpdating === task.id ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : (isRejected ? "Исправить" : "Завершить")}
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-9 w-24 rounded-lg font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 text-xs transition-all"
                                        onClick={() => handleAction(task.id, 'START')}
                                        disabled={isUpdating === task.id}
                                    >
                                        {isUpdating === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Начать"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 p-4 md:p-6 space-y-6 md:space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">Задачи</h1>
                        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest opacity-60">Техобслуживание оборудования</p>
                    </div>
                </div>
            </div>

            {/* Progress and Stats */}
            <div className="space-y-4">
                {/* Monthly Plan Progress */}
                {apiStats && (
                    <Card className="border-none shadow-sm bg-white dark:bg-slate-800/50">
                        <CardContent className="p-4 md:p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider">План на месяц</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Выполнено по плану текущего месяца</p>
                                    <p className="text-[11px] text-indigo-600 mt-1 font-bold">
                                        Выполнение плана: {apiStats.month_completed_count} из {apiStats.month_plan_count} · {apiStats.raw_efficiency.toFixed(1)}%
                                    </p>
                                    {(apiStats.old_debt_closed_count || 0) > 0 && (
                                        <p className="text-[11px] text-slate-500 mt-1">
                                            Закрыт старый долг: <span className="font-bold text-slate-700">{apiStats.old_debt_closed_count}</span>
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <span className="text-xl font-black text-emerald-600">
                                            {apiStats.month_completed_count}
                                        </span>
                                        <span className="text-sm font-bold text-muted-foreground ml-1">
                                            / {apiStats.month_plan_count}
                                        </span>
                                    </div>
                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold">
                                        {Math.round(apiStats.raw_efficiency || 0)}%
                                    </Badge>
                                </div>
                            </div>
                            <Progress 
                                value={apiStats.raw_efficiency || 0} 
                                className="h-2 bg-slate-100 dark:bg-slate-700"
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                    {/* Overdue */}
                    <Card className={cn(
                        "border-none shadow-sm transition-all",
                        (apiStats?.overdue_count || 0) > 0 
                            ? "bg-rose-50/80 dark:bg-rose-900/10 ring-1 ring-rose-200 dark:ring-rose-900/30" 
                            : "bg-white dark:bg-slate-800/50"
                    )}>
                        <CardContent className="p-3 md:p-6">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className={cn(
                                        "text-[9px] md:text-xs font-black uppercase tracking-widest mb-0.5",
                                        (apiStats?.overdue_count || 0) > 0 ? "text-rose-600" : "text-muted-foreground"
                                    )}>Просрочено</p>
                                    <p className={cn(
                                        "text-xl md:text-3xl font-black",
                                        (apiStats?.overdue_count || 0) > 0 ? "text-rose-700 dark:text-rose-300" : "text-slate-900 dark:text-slate-100"
                                    )}>{apiStats?.overdue_count || 0}</p>
                                </div>
                                <div className={cn(
                                    "h-8 w-8 md:h-10 md:w-10 rounded-xl flex items-center justify-center shadow-sm",
                                    (apiStats?.overdue_count || 0) > 0 ? "bg-rose-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                                )}>
                                    <AlertCircle className="h-4 w-4 md:h-5 md:w-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Today */}
                    <Card className={cn(
                        "border-none shadow-sm transition-all",
                        (apiStats?.due_today_count || 0) > 0 
                            ? "bg-blue-50/80 dark:bg-blue-900/10 ring-1 ring-blue-200 dark:ring-blue-900/30" 
                            : "bg-white dark:bg-slate-800/50"
                    )}>
                        <CardContent className="p-3 md:p-6">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className={cn(
                                        "text-[9px] md:text-xs font-black uppercase tracking-widest mb-0.5",
                                        (apiStats?.due_today_count || 0) > 0 ? "text-blue-600" : "text-muted-foreground"
                                    )}>На сегодня</p>
                                    <p className={cn(
                                        "text-xl md:text-3xl font-black",
                                        (apiStats?.due_today_count || 0) > 0 ? "text-blue-700 dark:text-blue-300" : "text-slate-900 dark:text-slate-100"
                                    )}>{apiStats?.due_today_count || 0}</p>
                                </div>
                                <div className={cn(
                                    "h-8 w-8 md:h-10 md:w-10 rounded-xl flex items-center justify-center shadow-sm",
                                    (apiStats?.due_today_count || 0) > 0 ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                                )}>
                                    <Clock className="h-4 w-4 md:h-5 md:w-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* In Progress */}
                    <Card className={cn(
                        "border-none shadow-sm transition-all",
                        (apiStats?.in_progress_count || 0) > 0 
                            ? "bg-indigo-50/80 dark:bg-indigo-900/10 ring-1 ring-indigo-200 dark:ring-indigo-900/30" 
                            : "bg-white dark:bg-slate-800/50"
                    )}>
                        <CardContent className="p-3 md:p-6">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className={cn(
                                        "text-[9px] md:text-xs font-black uppercase tracking-widest mb-0.5",
                                        (apiStats?.in_progress_count || 0) > 0 ? "text-indigo-600" : "text-muted-foreground"
                                    )}>В работе</p>
                                    <p className={cn(
                                        "text-xl md:text-3xl font-black",
                                        (apiStats?.in_progress_count || 0) > 0 ? "text-indigo-700 dark:text-indigo-300" : "text-slate-900 dark:text-slate-100"
                                    )}>{apiStats?.in_progress_count || 0}</p>
                                    {(apiStats?.rework_count || 0) > 0 && (
                                        <p className="text-[10px] text-indigo-500 mt-1">На доработке: {apiStats?.rework_count || 0}</p>
                                    )}
                                </div>
                                <div className={cn(
                                    "h-8 w-8 md:h-10 md:w-10 rounded-xl flex items-center justify-center shadow-sm",
                                    (apiStats?.in_progress_count || 0) > 0 ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                                )}>
                                    <Play className="h-4 w-4 md:h-5 md:w-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Completed */}
                    <Card className="border-none shadow-sm bg-emerald-50/50 dark:bg-emerald-900/10">
                        <CardContent className="p-3 md:p-6">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-0.5">Выполнено по плану</p>
                                    <p className="text-xl md:text-3xl font-black text-emerald-900 dark:text-emerald-100">{apiStats?.month_completed_count || 0}</p>
                                </div>
                                <div className="h-8 w-8 md:h-10 md:w-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                                    <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Tasks List */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-xl font-black tracking-tight uppercase">
                        {filterMode === 'current' ? 'Актуальные задачи' : 'Все задачи на месяц'}
                    </h2>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <Button
                            size="sm"
                            variant={filterMode === 'current' ? 'default' : 'ghost'}
                            className={cn("h-7 px-3 text-[10px] font-bold uppercase tracking-wider rounded-md", filterMode === 'current' ? "bg-indigo-500 shadow-none" : "text-muted-foreground")}
                            onClick={() => setFilterMode('current')}
                        >
                            Сейчас
                        </Button>
                        <Button
                            size="sm"
                            variant={filterMode === 'all' ? 'default' : 'ghost'}
                            className={cn("h-7 px-3 text-[10px] font-bold uppercase tracking-wider rounded-md", filterMode === 'all' ? "bg-indigo-500 shadow-none" : "text-muted-foreground")}
                            onClick={() => setFilterMode('all')}
                        >
                            Весь план
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    </div>
                ) : (
                    <div className="space-y-8">
                        {groupedTasks.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-slate-800/50 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <div className="h-20 w-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm text-green-500">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>
                                <h3 className="text-lg font-bold">
                                    {filterMode === 'current' ? 'Нет актуальных задач' : 'Нет задач на месяц'}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {filterMode === 'current' ? 'Все текущие задачи выполнены. Можно отдохнуть или взять свободную задачу.' : 'На данный момент у вас нет назначенных задач.'}
                                </p>
                                {filterMode === 'current' && tasks.length > 0 && (
                                    <Button 
                                        variant="link" 
                                        className="mt-4 text-indigo-500 font-bold"
                                        onClick={() => setFilterMode('all')}
                                    >
                                        Посмотреть весь план ({tasks.length})
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="grid gap-8">
                                {groupedTasks.map(([location, groupTasks]) => (
                                    <div key={location} className="space-y-3">
                                        <div className="flex items-center gap-3 px-1 pt-2">
                                            <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                                                <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                                                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                                    {location}
                                                    <span className="text-indigo-500/50 ml-2 font-bold">{groupTasks.length}</span>
                                                </h3>
                                            </div>
                                            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800/50" />
                                        </div>
                                        <div className="grid gap-2">
                                            {groupTasks.map(task => renderTaskCard(task, false, true))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Free Tasks */}
            {groupedFreeTasks.length > 0 && (
                <div className="space-y-6 pt-8 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-black tracking-tight text-slate-400 uppercase">Свободные задачи</h2>
                        <Badge variant="outline" className="text-slate-400 border-slate-200">
                            {freeTasks.length} доступно
                        </Badge>
                    </div>

                    <div className="grid gap-8">
                        {groupedFreeTasks.map(([location, groupTasks]) => (
                            <div key={`free-${location}`} className="space-y-3">
                                <div className="flex items-center gap-3 px-1 pt-2">
                                    <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50 opacity-60">
                                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                            {location}
                                            <span className="text-slate-400 ml-2 font-bold">{groupTasks.length}</span>
                                        </h3>
                                    </div>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800/50" />
                                </div>
                                <div className="grid gap-2">
                                    {groupTasks.map(task => renderTaskCard(task, true, true))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}



            <MaintenanceSessionWizard
                isOpen={isSessionOpen}
                onClose={() => setIsSessionOpen(false)}
                tasks={sessionTasks}
                onComplete={() => {
                    setIsSessionOpen(false)
                    fetchData()
                }}
            />
        </div>
    )
}
