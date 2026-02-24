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
    Search
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { MaintenanceSessionWizard } from "@/app/clubs/[clubId]/equipment/maintenance/MaintenanceSessionWizard"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Fragment } from "react"

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

    const groupedTasks = useMemo(() => {
        const groups: Record<string, MaintenanceTask[]> = {}
        
        tasks.forEach(task => {
            const location = task.workstation_name || "Склад"
            if (!groups[location]) groups[location] = []
            groups[location].push(task)
        })

        return Object.entries(groups).sort(([a], [b]) => {
            if (a === "Склад") return -1
            if (b === "Склад") return 1
            return a.localeCompare(b)
        })
    }, [tasks])

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
        const total = tasks.length
        const in_progress = tasks.filter(t => t.status === 'IN_PROGRESS').length
        const overdue = tasks.filter(t => new Date(t.due_date) < new Date()).length
        return { total, in_progress, overdue }
    }, [tasks])

    const renderTaskCard = (task: MaintenanceTask, isFree: boolean = false, hideLocation: boolean = false) => {
        const isOverdue = new Date(task.due_date) < new Date()
        const isInProgress = task.status === 'IN_PROGRESS'

        return (
            <Card key={task.id} className={cn(
                "transition-all duration-300 border-none shadow-sm overflow-hidden",
                isInProgress ? "ring-1 ring-indigo-500 bg-indigo-50/5" : "bg-white dark:bg-slate-800/80 hover:shadow-md",
                isFree && "opacity-80 hover:opacity-100"
            )}>
                <CardContent className="p-0">
                    <div className="flex items-stretch h-16">
                        <div className={cn(
                            "w-1 transition-all shrink-0",
                            isFree ? "bg-slate-300 dark:bg-slate-600" : isOverdue ? "bg-rose-500" : isInProgress ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"
                        )} />
                        <div className="px-4 flex-1 grid grid-cols-[1fr_auto] items-center gap-3 min-w-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={cn(
                                    "h-9 w-9 rounded-xl flex items-center justify-center transition-colors shrink-0",
                                    isInProgress ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                                )}>
                                    <Monitor className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h4 className="font-bold text-sm truncate">{task.equipment_name}</h4>
                                        {!isFree && isOverdue && (
                                            <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0" title="Просрочено" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                        <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded leading-none shrink-0">{task.equipment_type_name}</span>
                                        {!hideLocation && (
                                            <span className="truncate opacity-60">{task.workstation_name || "Склад"}</span>
                                        )}
                                        {isFree && <span className="text-indigo-500 opacity-100">СВОБОДНО</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="shrink-0">
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
                                ) : isInProgress ? (
                                    <Button
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 h-9 w-24 rounded-lg font-bold text-xs shadow-sm shadow-emerald-200 dark:shadow-none transition-all"
                                        onClick={() => handleAction(task.id, 'COMPLETE')}
                                        disabled={isUpdating === task.id}
                                    >
                                        {isUpdating === task.id ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : "Завершить"}
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

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-3 md:gap-6">
                <Card className="border-none shadow-sm bg-blue-50/50 dark:bg-blue-900/10">
                    <CardContent className="p-3 md:p-6">
                        <div className="flex items-center justify-between">
                            <div className="min-w-0">
                                <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-0.5">Всего</p>
                                <p className="text-xl md:text-3xl font-black text-blue-900 dark:text-blue-100">{stats.total}</p>
                            </div>
                            <div className="hidden md:flex h-10 w-10 bg-white dark:bg-slate-800 rounded-xl items-center justify-center text-blue-600 shadow-sm">
                                <Monitor className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-indigo-50/50 dark:bg-indigo-900/10">
                    <CardContent className="p-3 md:p-6">
                        <div className="flex items-center justify-between">
                            <div className="min-w-0">
                                <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-0.5">В работе</p>
                                <p className="text-xl md:text-3xl font-black text-indigo-900 dark:text-indigo-100">{stats.in_progress}</p>
                            </div>
                            <div className="hidden md:flex h-10 w-10 bg-white dark:bg-slate-800 rounded-xl items-center justify-center text-indigo-600 shadow-sm">
                                <Play className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-rose-50/50 dark:bg-rose-900/10">
                    <CardContent className="p-3 md:p-6">
                        <div className="flex items-center justify-between">
                            <div className="min-w-0">
                                <p className="text-[9px] md:text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-0.5">Срок</p>
                                <p className="text-xl md:text-3xl font-black text-rose-900 dark:text-rose-100">{stats.overdue}</p>
                            </div>
                            <div className="hidden md:flex h-10 w-10 bg-white dark:bg-slate-800 rounded-xl items-center justify-center text-rose-600 shadow-sm">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tasks List */}
            <div className="space-y-6">
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
