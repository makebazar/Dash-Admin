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
                isInProgress ? "ring-1 ring-primary bg-primary/5" : "bg-card hover:shadow-md",
                (isFree || showAsCompleted) && "opacity-80 hover:opacity-100",
                showAsCompleted && "bg-accent/30",
                isRejected && "ring-1 ring-rose-500 bg-rose-500/5"
            )}>
                <CardContent className="p-0">
                    <div className="flex items-stretch min-h-16">
                        <div className={cn(
                            "w-1 transition-all shrink-0",
                            isRejected ? "bg-rose-500" : isCompleted ? "bg-emerald-500" : isFuture ? "bg-blue-400" : isFree ? "bg-muted-foreground/30" : isOverdue ? "bg-rose-500" : isInProgress ? "bg-primary" : "bg-muted-foreground/20"
                        )} />
                        <div className="px-4 py-3 flex-1 grid grid-cols-[1fr_auto] items-center gap-3 min-w-0">
                            <div className="flex flex-col gap-2 min-w-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        "h-9 w-9 rounded-xl flex items-center justify-center transition-colors shrink-0",
                                        isRejected ? "bg-rose-500/10 text-rose-500" : isInProgress ? "bg-primary text-primary-foreground" : showAsCompleted ? "bg-emerald-500/10 text-emerald-500" : "bg-accent text-muted-foreground/70"
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
                                                <Badge variant="destructive" className="h-5 px-1.5 text-[10px] bg-rose-500 hover:bg-rose-600">На доработку</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                            <span className="bg-accent px-1.5 py-0.5 rounded leading-none shrink-0">{task.equipment_type_name}</span>
                                            {!hideLocation && (
                                                <span className="truncate opacity-60">{task.workstation_name || "Склад"}</span>
                                            )}
                                            {isFree && <span className="text-primary opacity-100">СВОБОДНО</span>}
                                            {task.last_cleaned_at && (
                                                <span className="text-emerald-500/70 flex items-center gap-1">
                                                    <Check className="h-3 w-3" />
                                                    {format(new Date(task.last_cleaned_at), 'dd.MM')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {isRejected && task.rejection_reason && (
                                    <div className="text-xs bg-rose-500/10 text-rose-500 p-2 rounded-md border border-rose-500/20 mt-1">
                                        <span className="font-bold">Комментарий:</span> {task.rejection_reason}
                                    </div>
                                )}
                            </div>

                            <div className="shrink-0 self-center">
                                {isFree ? (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-9 w-24 rounded-lg font-bold bg-accent hover:bg-accent/80 text-foreground text-xs transition-all"
                                        onClick={() => handleClaim(task.id)}
                                        disabled={isUpdating === task.id}
                                    >
                                        {isUpdating === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Взять"}
                                    </Button>
                                ) : showAsCompleted ? (
                                    <div className="flex flex-col items-end justify-center h-9 w-24">
                                        <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">След.</span>
                                        <span className="text-xs font-black text-muted-foreground">
                                            {format(new Date(task.due_date), 'dd.MM')}
                                        </span>
                                    </div>
                                ) : isInProgress ? (
                                    <Button
                                        size="sm"
                                        className={cn(
                                            "h-9 w-24 rounded-lg font-bold text-xs shadow-sm transition-all text-white",
                                            isRejected 
                                                ? "bg-rose-500 hover:bg-rose-600" 
                                                : "bg-emerald-500 hover:bg-emerald-600"
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
                                        className="h-9 w-24 rounded-lg font-bold border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/30 text-xs transition-all"
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
        <div className="w-full max-w-5xl mx-auto px-4 py-8 md:px-8 md:py-12 space-y-8 relative z-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Задачи</h1>
                    <p className="text-sm text-muted-foreground mt-1">Техобслуживание оборудования</p>
                </div>
                
                <div className="flex items-center gap-1 bg-accent p-1 rounded-lg border border-border">
                    <Button
                        size="sm"
                        variant={filterMode === 'current' ? 'default' : 'ghost'}
                        className={cn("h-7 px-4 text-xs font-medium rounded-md", filterMode === 'current' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
                        onClick={() => setFilterMode('current')}
                    >
                        Актуальные
                    </Button>
                    <Button
                        size="sm"
                        variant={filterMode === 'all' ? 'default' : 'ghost'}
                        className={cn("h-7 px-4 text-xs font-medium rounded-md", filterMode === 'all' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
                        onClick={() => setFilterMode('all')}
                    >
                        План месяца
                    </Button>
                </div>
            </div>

            {/* Unified Stats Panel */}
            {apiStats && (
                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 bg-accent/10">
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">План на месяц</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Выполнено по плану текущего месяца</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <span className="text-2xl font-bold text-emerald-500">
                                    {apiStats.month_completed_count}
                                </span>
                                <span className="text-sm font-medium text-muted-foreground ml-1">
                                    / {apiStats.month_plan_count}
                                </span>
                            </div>
                            <div className="h-8 w-px bg-border mx-1" />
                            <div className="text-right">
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 font-bold mb-1">
                                    {Math.round(apiStats.raw_efficiency || 0)}%
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <Progress 
                        value={apiStats.raw_efficiency || 0} 
                        className="h-1 rounded-none bg-accent"
                    />
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
                        {/* Overdue */}
                        <div className={cn("p-4 md:p-5 transition-colors", (apiStats?.overdue_count || 0) > 0 ? "bg-rose-500/5" : "bg-transparent")}>
                            <div className="flex items-center justify-between mb-2">
                                <p className={cn("text-[10px] font-semibold uppercase tracking-widest", (apiStats?.overdue_count || 0) > 0 ? "text-rose-500" : "text-muted-foreground")}>Просрочено</p>
                                <AlertCircle className={cn("h-4 w-4", (apiStats?.overdue_count || 0) > 0 ? "text-rose-500 opacity-70" : "text-muted-foreground opacity-30")} />
                            </div>
                            <p className={cn("text-2xl font-bold", (apiStats?.overdue_count || 0) > 0 ? "text-rose-500" : "text-foreground")}>{apiStats?.overdue_count || 0}</p>
                        </div>

                        {/* Today */}
                        <div className={cn("p-4 md:p-5 transition-colors", (apiStats?.due_today_count || 0) > 0 ? "bg-blue-500/5" : "bg-transparent")}>
                            <div className="flex items-center justify-between mb-2">
                                <p className={cn("text-[10px] font-semibold uppercase tracking-widest", (apiStats?.due_today_count || 0) > 0 ? "text-blue-500" : "text-muted-foreground")}>На сегодня</p>
                                <Clock className={cn("h-4 w-4", (apiStats?.due_today_count || 0) > 0 ? "text-blue-500 opacity-70" : "text-muted-foreground opacity-30")} />
                            </div>
                            <p className={cn("text-2xl font-bold", (apiStats?.due_today_count || 0) > 0 ? "text-blue-500" : "text-foreground")}>{apiStats?.due_today_count || 0}</p>
                        </div>

                        {/* In Progress */}
                        <div className={cn("p-4 md:p-5 transition-colors", (apiStats?.in_progress_count || 0) > 0 ? "bg-primary/5" : "bg-transparent")}>
                            <div className="flex items-center justify-between mb-2">
                                <p className={cn("text-[10px] font-semibold uppercase tracking-widest", (apiStats?.in_progress_count || 0) > 0 ? "text-primary" : "text-muted-foreground")}>В работе</p>
                                <Play className={cn("h-4 w-4 ml-0.5", (apiStats?.in_progress_count || 0) > 0 ? "text-primary opacity-70" : "text-muted-foreground opacity-30")} />
                            </div>
                            <div className="flex flex-col gap-1 items-start">
                                <p className={cn("text-2xl font-bold leading-none", (apiStats?.in_progress_count || 0) > 0 ? "text-primary" : "text-foreground")}>{apiStats?.in_progress_count || 0}</p>
                                {(apiStats?.rework_count || 0) > 0 && (
                                    <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">Доработка: {apiStats?.rework_count}</span>
                                )}
                            </div>
                        </div>

                        {/* Completed */}
                        <div className="p-4 md:p-5 bg-emerald-500/5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">Закрыто</p>
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-70" />
                            </div>
                            <div className="flex flex-col gap-1 items-start">
                                <p className="text-2xl font-bold text-emerald-500 leading-none">{apiStats?.month_completed_count || 0}</p>
                                {(apiStats?.old_debt_closed_count || 0) > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded" title="Закрыт старый долг">+{apiStats?.old_debt_closed_count} долг</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tasks List */}
            {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-10">
                    {groupedTasks.length === 0 ? (
                        <div className="text-center py-20 bg-card rounded-2xl border border-border">
                            <div className="h-20 w-20 bg-accent rounded-3xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
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
                                    className="mt-4 text-primary font-medium"
                                    onClick={() => setFilterMode('all')}
                                >
                                    Посмотреть весь план ({tasks.length})
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-10">
                            {groupedTasks.map(([location, groupTasks]) => (
                                <div key={location} className="space-y-4">
                                    <div className="flex items-center gap-3 border-b border-border pb-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                                            {location}
                                        </h3>
                                        <span className="text-xs font-bold text-muted-foreground bg-accent px-2 py-0.5 rounded-full">{groupTasks.length}</span>
                                    </div>
                                    <div className="grid gap-3">
                                        {groupTasks.map(task => renderTaskCard(task, false, true))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Free Tasks */}
            {groupedFreeTasks.length > 0 && (
                <div className="space-y-10 pt-8 border-t border-border mt-12">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold tracking-tight text-muted-foreground">Свободные задачи</h2>
                        <Badge variant="outline" className="text-muted-foreground border-border">
                            {freeTasks.length} доступно
                        </Badge>
                    </div>

                    <div className="grid gap-10">
                        {groupedFreeTasks.map(([location, groupTasks]) => (
                            <div key={`free-${location}`} className="space-y-4 opacity-80 hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-3 border-b border-border pb-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                        {location}
                                    </h3>
                                    <span className="text-xs font-bold text-muted-foreground bg-accent px-2 py-0.5 rounded-full">{groupTasks.length}</span>
                                </div>
                                <div className="grid gap-3">
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
