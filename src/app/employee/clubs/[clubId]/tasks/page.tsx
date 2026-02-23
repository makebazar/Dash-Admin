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
    ChevronLeft,
    Zap,
    Trophy
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { MaintenanceSessionWizard } from "@/app/clubs/[clubId]/equipment/maintenance/MaintenanceSessionWizard"

interface MaintenanceTask {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type: string
    equipment_type_name: string
    workstation_name: string | null
    due_date: string
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
    kpi_points: number
}

export default function EmployeeTasksPage() {
    const { clubId } = useParams()
    const [tasks, setTasks] = useState<MaintenanceTask[]>([])
    const [freeTasks, setFreeTasks] = useState<MaintenanceTask[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUpdating, setIsUpdating] = useState<string | null>(null)
    
    // Session Wizard State
    const [isSessionOpen, setIsSessionOpen] = useState(false)
    const [sessionTasks, setSessionTasks] = useState<MaintenanceTask[]>([])

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const today = new Date().toISOString().split('T')[0]
            const [assignedRes, freeRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/equipment/maintenance?assigned=me&status=PENDING,IN_PROGRESS`),
                fetch(`/api/clubs/${clubId}/equipment/maintenance?assigned=unassigned&status=PENDING&date_to=${today}`)
            ])

            const assignedData = await assignedRes.json()
            const freeData = await freeRes.json()

            if (assignedRes.ok) setTasks(assignedData.tasks || [])
            if (freeRes.ok) setFreeTasks(freeData.tasks || [])
        } catch (error) {
            console.error("Error fetching tasks:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

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

    const stats = useMemo(() => {
        const total = tasks.length
        const in_progress = tasks.filter(t => t.status === 'IN_PROGRESS').length
        const overdue = tasks.filter(t => new Date(t.due_date) < new Date()).length
        return { total, in_progress, overdue }
    }, [tasks])

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">🧹 Задачи по обслуживанию</h1>
                        <p className="text-muted-foreground mt-1">Список оборудования, требующего вашего внимания</p>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm bg-blue-50 dark:bg-blue-900/10">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">Всего задач</p>
                                <p className="text-3xl font-black text-blue-900 dark:text-blue-100">{stats.total}</p>
                            </div>
                            <div className="h-12 w-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                                <Monitor className="h-6 w-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-indigo-50 dark:bg-indigo-900/10">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">В процессе</p>
                                <p className="text-3xl font-black text-indigo-900 dark:text-indigo-100">{stats.in_progress}</p>
                            </div>
                            <div className="h-12 w-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                                <Play className="h-6 w-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-rose-50 dark:bg-rose-900/10">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-1">Просрочено</p>
                                <p className="text-3xl font-black text-rose-900 dark:text-rose-100">{stats.overdue}</p>
                            </div>
                            <div className="h-12 w-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm">
                                <AlertCircle className="h-6 w-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tasks List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-800/50 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <div className="h-20 w-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm text-green-500">
                            <CheckCircle2 className="h-10 w-10" />
                        </div>
                        <h3 className="text-lg font-bold">Нет активных задач</h3>
                        <p className="text-sm text-muted-foreground">На данный момент у вас нет назначенных задач по чистке.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {tasks.map(task => {
                            const isOverdue = new Date(task.due_date) < new Date()
                            const isInProgress = task.status === 'IN_PROGRESS'

                            return (
                                <Card key={task.id} className={cn(
                                    "transition-all duration-300 border-none shadow-sm overflow-hidden",
                                    isInProgress ? "ring-2 ring-indigo-500 bg-indigo-50/10" : "bg-white dark:bg-slate-800/80"
                                )}>
                                    <CardContent className="p-0">
                                        <div className="flex items-stretch min-h-[100px]">
                                            <div className={cn(
                                                "w-2 transition-all",
                                                isOverdue ? "bg-rose-500" : isInProgress ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"
                                            )} />
                                            <div className="p-5 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                                                        isInProgress ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                                                    )}>
                                                        <Monitor className="h-6 w-6" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold">{task.equipment_name}</h4>
                                                            {isOverdue && <Badge className="bg-rose-100 text-rose-600 border-none text-[10px] font-bold">ПРОСРОЧЕНО</Badge>}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                                                            <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded uppercase tracking-wider">{task.equipment_type_name}</span>
                                                            <span className="uppercase tracking-widest">{task.workstation_name || "Склад"}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {isInProgress ? (
                                                        <Button
                                                            size="lg"
                                                            className="bg-emerald-600 hover:bg-emerald-700 h-12 px-6 rounded-xl font-bold"
                                                            onClick={() => handleAction(task.id, 'COMPLETE')}
                                                            disabled={isUpdating === task.id}
                                                        >
                                                            {isUpdating === task.id ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Check className="mr-2 h-5 w-5" />}
                                                            Завершить
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="lg"
                                                            variant="outline"
                                                            className="h-12 px-6 rounded-xl font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                                            onClick={() => handleAction(task.id, 'START')}
                                                            disabled={isUpdating === task.id}
                                                        >
                                                            {isUpdating === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
                                                            Начать
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Free Tasks */}
            {freeTasks.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-500">Свободные задачи</h2>
                    <div className="grid gap-4 opacity-75 hover:opacity-100 transition-opacity">
                        {freeTasks.map(task => (
                            <Card key={task.id} className="border-none shadow-sm bg-white dark:bg-slate-800/80">
                                <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center">
                                            <Monitor className="h-6 w-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="font-bold">{task.equipment_name}</h4>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                                                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded uppercase tracking-wider">{task.equipment_type_name}</span>
                                                <span className="uppercase tracking-widest">{task.workstation_name || "Склад"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        size="lg"
                                        variant="secondary"
                                        className="h-12 px-6 rounded-xl font-bold"
                                        onClick={() => handleClaim(task.id)}
                                        disabled={isUpdating === task.id}
                                    >
                                        {isUpdating === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Взять в работу"}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Info Footer */}
            <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 flex items-start gap-4">
                <Trophy className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-100">Зарабатывайте бонусы!</p>
                    <p className="text-xs text-amber-800/70 dark:text-amber-200/50 leading-relaxed">
                        Своевременное выполнение задач по обслуживанию оборудования приносит дополнительные баллы в вашу систему KPI.
                        Баллы конвертируются в денежный бонус при расчете зарплаты в конце месяца.
                    </p>
                </div>
            </div>

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
