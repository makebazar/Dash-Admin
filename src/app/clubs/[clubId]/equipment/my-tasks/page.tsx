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
    Trophy,
    History
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface MaintenanceTask {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type_name: string
    workstation_name: string | null
    due_date: string
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
    bonus_potential?: number
}

const getLocalDateKey = (date: Date = new Date()) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export default function MyMaintenanceTasks() {
    const { clubId } = useParams()
    const [tasks, setTasks] = useState<MaintenanceTask[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUpdating, setIsUpdating] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            // Fetch tasks assigned to current user (the API should handle filtering by current session user)
            const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance?assigned=me&status=PENDING,IN_PROGRESS`)
            const data = await res.json()
            if (res.ok) setTasks(data.tasks || [])
        } catch (error) {
            console.error("Error fetching my tasks:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleAction = async (taskId: string, action: 'START' | 'COMPLETE') => {
        setIsUpdating(taskId)
        try {
            const status = action === 'START' ? 'IN_PROGRESS' : 'COMPLETED'
            const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status })
            })

            if (res.ok) {
                if (action === 'COMPLETE') {
                    setTasks(prev => prev.filter(t => t.id !== taskId))
                } else {
                    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'IN_PROGRESS' } : t))
                }
            }
        } catch (error) {
            console.error("Error updating task status:", error)
        } finally {
            setIsUpdating(null)
        }
    }

    const stats = useMemo(() => {
        const todayKey = getLocalDateKey()
        const total = tasks.length
        const in_progress = tasks.filter(t => t.status === 'IN_PROGRESS').length
        const overdue = tasks.filter(t => t.status === 'PENDING' && t.due_date < todayKey).length
        return { total, in_progress, overdue }
    }, [tasks])

    return (
        <div className="p-8 space-y-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href={`/clubs/${clubId}/equipment`} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    К оборудованию
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">🧹 Мои задачи</h1>
                        <p className="text-muted-foreground mt-1">Список оборудования для обслуживания и чистки</p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-4 py-1 gap-2">
                        <Trophy className="h-4 w-4" />
                        Доступно бонусов: {tasks.length * 50} ₽
                    </Badge>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm bg-blue-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">Всего задач</p>
                                <p className="text-3xl font-black text-blue-900">{stats.total}</p>
                            </div>
                            <div className="h-12 w-12 bg-card rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                                <Monitor className="h-6 w-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-indigo-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">В процессе</p>
                                <p className="text-3xl font-black text-indigo-900">{stats.in_progress}</p>
                            </div>
                            <div className="h-12 w-12 bg-card rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                                <Play className="h-6 w-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-rose-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-rose-600 mb-1">Просрочено</p>
                                <p className="text-3xl font-black text-rose-900">{stats.overdue}</p>
                            </div>
                            <div className="h-12 w-12 bg-card rounded-2xl flex items-center justify-center text-rose-600 shadow-sm">
                                <AlertCircle className="h-6 w-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tasks List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Текущий план
                    </h2>
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:bg-transparent px-0" asChild>
                        <Link href={`/clubs/${clubId}/equipment/maintenance`}><History className="h-3 w-3 mr-2" /> Просмотреть весь график</Link>
                    </Button>
                </div>

                {isLoading ? (
                    <div className="h-64 flex items-center justify-center opacity-20">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-20 bg-muted rounded-[40px] border-2 border-dashed border-border">
                        <div className="h-20 w-20 bg-card rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm text-green-500">
                            <CheckCircle2 className="h-10 w-10" />
                        </div>
                        <h3 className="text-lg font-bold">Все чисто!</h3>
                        <p className="text-sm text-muted-foreground">На сегодня у вас нет запланированных задач по обслуживанию.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {tasks.map(task => {
                            const isOverdue = task.status === 'PENDING' && task.due_date < getLocalDateKey()
                            const isInProgress = task.status === 'IN_PROGRESS'

                            return (
                                <Card key={task.id} className={cn(
                                    "group border-none shadow-sm overflow-hidden",
                                    isInProgress ? "ring-2 ring-indigo-500 bg-indigo-50/10" : "bg-card"
                                )}>
                                    <CardContent className="p-0">
                                        <div className="flex items-stretch min-h-[100px]">
                                            <div className={cn(
                                                "w-2 transition-all",
                                                isOverdue ? "bg-rose-500" : isInProgress ? "bg-indigo-500" : "bg-slate-200 group-hover:bg-slate-300"
                                            )} />
                                            <div className="p-5 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                                                        isInProgress ? "bg-indigo-500 text-primary-foreground" : "bg-muted text-muted-foreground/70 group-hover:bg-card border group-hover:border-border/50 shadow-none"
                                                    )}>
                                                        <Monitor className="h-6 w-6" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-foreground">{task.equipment_name}</h4>
                                                            {isOverdue && <Badge className="h-5 bg-rose-50 text-rose-600 border-none text-[9px] font-black uppercase tracking-tighter shadow-none">Просрочено</Badge>}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                            <span className="flex items-center gap-1"><Badge variant="outline" className="text-[10px] font-medium">{task.equipment_type_name}</Badge></span>
                                                            <span className="flex items-center gap-1 font-bold text-muted-foreground uppercase tracking-tighter">{task.workstation_name || "Склад"}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6">
                                                    <div className="text-right hidden md:block">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Дедлайн</p>
                                                        <p className={cn(
                                                            "text-sm font-bold",
                                                            isOverdue ? "text-rose-600" : "text-foreground"
                                                        )}>
                                                            {new Date(task.due_date).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long' })}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {isInProgress ? (
                                                            <Button
                                                                size="lg"
                                                                className="bg-green-600 hover:bg-green-700 h-12 px-6 rounded-xl font-bold shadow-lg shadow-green-100"
                                                                onClick={() => handleAction(task.id, 'COMPLETE')}
                                                                disabled={isUpdating === task.id}
                                                            >
                                                                {isUpdating === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
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
                                                                Начать чистку
                                                            </Button>
                                                        )}
                                                    </div>
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

            {/* Disclaimer / Info */}
            <div className="p-6 rounded-3xl bg-accent/50 border border-border border-dashed flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-muted-foreground/70 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">Как это работает?</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        За каждую выполненную чистку вы получаете баллы согласно настройкам клуба.
                        Баллы конвертируются в денежный бонус в конце месяца при расчете зарплаты.
                        Старайтесь выполнять задачи до наступления дедлайна, чтобы не терять бонусные множители.
                    </p>
                </div>
            </div>
        </div>
    )
}
