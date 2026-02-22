"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import {
    Monitor,
    Calendar,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Clock,
    AlertCircle,
    UserPlus,
    Loader2,
    ClipboardList,
    Layers,
    User,
    ArrowRight,
    CircleDashed,
    Wrench,
    Plus
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface MaintenanceTask {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type: string
    equipment_type_name: string
    equipment_icon: string
    workstation_name: string | null
    workstation_zone: string | null
    assigned_user_id: string | null
    assigned_to_name: string | null
    due_date: string
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
    completed_at: string | null
    completed_by_name: string | null
    task_type: string
}

interface Employee {
    id: string
    full_name: string
}

export default function MaintenanceSchedule() {
    const { clubId } = useParams()
    const [tasks, setTasks] = useState<MaintenanceTask[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isGenerating, setIsGenerating] = useState(false)

    // View state
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

    const monthNames = useMemo(() => [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ], [])

    const ensurePlan = useCallback(async (firstDay: string, lastDay: string) => {
        setIsGenerating(true)
        try {
            await fetch(`/api/clubs/${clubId}/equipment/maintenance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date_from: firstDay,
                    date_to: lastDay,
                    task_type: 'CLEANING'
                })
            })
        } finally {
            setIsGenerating(false)
        }
    }, [clubId])

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            // Get first and last day of selected month
            const firstDay = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split('T')[0]
            const lastDay = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

            await ensurePlan(firstDay, lastDay)

            const [tasksRes, empRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/equipment/maintenance?date_from=${firstDay}&date_to=${lastDay}&include_overdue=true`),
                fetch(`/api/clubs/${clubId}/employees`)
            ])

            const tasksData = await tasksRes.json()
            const empData = await empRes.json()

            if (tasksRes.ok) setTasks(tasksData.tasks || [])
            if (empRes.ok) setEmployees(empData.employees || [])
        } catch (error) {
            console.error("Error fetching maintenance data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId, selectedMonth, selectedYear, ensurePlan])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleGenerateTasks = async () => {
        try {
            fetchData()
        } catch (error) {
            console.error("Error generating tasks:", error)
        }
    }

    const handleAssign = async (taskId: string, userId: string) => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assigned_user_id: userId === 'none' ? null : userId } : t))

        try {
            await fetch(`/api/clubs/${clubId}/equipment/maintenance/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigned_user_id: userId === 'none' ? null : userId })
            })
            // Fetch again to be sure (especially names)
            fetchData()
        } catch (error) {
            console.error("Error assigning task:", error)
            fetchData() // Rollback
        }
    }

    const stats = useMemo(() => {
        const total = tasks.length
        const completed = tasks.filter(t => t.status === 'COMPLETED').length
        const pending = tasks.filter(t => t.status === 'PENDING').length
        const overdue = tasks.filter(t => t.status === 'PENDING' && new Date(t.due_date) < new Date()).length
        const progress = total > 0 ? (completed / total) * 100 : 0
        return { total, completed, pending, overdue, progress }
    }, [tasks])

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href={`/clubs/${clubId}/equipment`} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    К обзору
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">🧹 График обслуживания</h1>
                        <p className="text-muted-foreground mt-1">Планирование чистки и технического регламента</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500"
                                onClick={() => {
                                    if (selectedMonth === 1) {
                                        setSelectedMonth(12)
                                        setSelectedYear(prev => prev - 1)
                                    } else {
                                        setSelectedMonth(prev => prev - 1)
                                    }
                                }}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="px-4 text-sm font-bold min-w-[140px] text-center">
                                {monthNames[selectedMonth - 1]} {selectedYear}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500"
                                onClick={() => {
                                    if (selectedMonth === 12) {
                                        setSelectedMonth(1)
                                        setSelectedYear(prev => prev + 1)
                                    } else {
                                        setSelectedMonth(prev => prev + 1)
                                    }
                                }}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Hero Section */}
            <Card className="border-none shadow-md bg-gradient-to-br from-indigo-500 to-blue-600 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <ClipboardList className="h-32 w-32" />
                </div>
                <CardContent className="pt-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                        <div className="space-y-6 flex-1">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-indigo-100 mb-2">Прогресс за {monthNames[selectedMonth - 1].toLowerCase()}</p>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-6xl font-black tracking-tighter">{Math.round(stats.progress)}%</span>
                                    <span className="text-indigo-100/80 font-medium">{stats.completed} из {stats.total} единиц обслужено</span>
                                </div>
                            </div>
                            <div className="h-3 w-full bg-indigo-900/30 rounded-full overflow-hidden border border-white/20 shadow-inner">
                                <div
                                    className="h-full bg-white transition-all duration-700 ease-out"
                                    style={{ width: `${stats.progress}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 min-w-[280px]">
                            {tasks.length === 0 ? (
                                <Button
                                    onClick={handleGenerateTasks}
                                    disabled={isGenerating}
                                    size="lg"
                                    className="h-20 w-full rounded-2xl bg-white text-indigo-600 hover:bg-slate-50 font-black shadow-xl hover:scale-[1.02] transition-all"
                                >
                                    {isGenerating ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Plus className="mr-2 h-6 w-6" />}
                                    Пересчитать план на {monthNames[selectedMonth - 1]}
                                </Button>
                            ) : (
                                <>
                                    <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20 text-center flex-1">
                                        <p className="text-[10px] text-indigo-100 uppercase font-black tracking-widest mb-1">Просрочено</p>
                                        <p className="text-3xl font-black text-rose-200">{stats.overdue}</p>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20 text-center flex-1">
                                        <p className="text-[10px] text-indigo-100 uppercase font-black tracking-widest mb-1">Осталось</p>
                                        <p className="text-3xl font-black">{stats.pending}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tasks Table */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Layers className="h-5 w-5 text-indigo-500" />
                        Пообъектный контроль
                    </h2>
                    <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div> Готово</div>
                        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"></div> В работе</div>
                        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-slate-200"></div> Ожидает</div>
                    </div>
                </div>

                <Card className="border-none shadow-sm overflow-hidden bg-white">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[300px]">Объект обслуживания</TableHead>
                                <TableHead>Место / Зона</TableHead>
                                <TableHead>Срок выполнения</TableHead>
                                <TableHead>Ответственный</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead className="text-right">Завершено</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 opacity-50 text-indigo-500" />
                                        Синхронизация графика...
                                    </TableCell>
                                </TableRow>
                            ) : tasks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4 max-w-sm mx-auto opacity-60">
                                            <div className="h-20 w-20 bg-slate-50 rounded-[40px] flex items-center justify-center border-4 border-white shadow-lg">
                                                <Calendar className="h-10 w-10 text-slate-300" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-lg font-bold">Нет задач на период</p>
                                                <p className="text-sm text-muted-foreground leading-relaxed">Система не нашла устройств, требующих чистки в выбранном периоде.</p>
                                            </div>
                                                <Button onClick={handleGenerateTasks} variant="secondary" className="mt-2">
                                                    Пересчитать план
                                                </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tasks.map((task) => {
                                    const isOverdue = task.status === 'PENDING' && new Date(task.due_date) < new Date()
                                    const isCompleted = task.status === 'COMPLETED'

                                    return (
                                        <TableRow key={task.id} className="group hover:bg-slate-50/30 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all border",
                                                        isCompleted ? "bg-green-50 text-green-600 border-green-100" : "bg-slate-50 text-slate-500 border-slate-100 group-hover:border-slate-200 group-hover:bg-white"
                                                    )}>
                                                        <Monitor className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">{task.equipment_name}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{task.equipment_type_name}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold">{task.workstation_name || "Склад"}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase">{task.workstation_zone}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className={cn(
                                                        "text-[10px] px-2 py-0 border-none shadow-none font-bold",
                                                        isOverdue ? "text-rose-600 bg-rose-50" : "text-slate-500 bg-slate-100"
                                                    )}>
                                                        {new Date(task.due_date).toLocaleDateString("ru-RU", { day: 'numeric', month: 'short' })}
                                                    </Badge>
                                                    {isOverdue && <AlertCircle className="h-3 w-3 text-rose-500 animate-pulse" />}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {isCompleted ? (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <User className="h-3 w-3" />
                                                        {task.completed_by_name || task.assigned_to_name}
                                                    </div>
                                                ) : (
                                                    <Select
                                                        value={task.assigned_user_id || "none"}
                                                        onValueChange={(val) => handleAssign(task.id, val)}
                                                    >
                                                        <SelectTrigger className="h-8 text-xs bg-white border-dashed w-[160px]">
                                                            <div className="flex items-center gap-2">
                                                                <UserPlus className="h-3 w-3 text-muted-foreground" />
                                                                <SelectValue placeholder="Назначить" />
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">👥 Свободный пул</SelectItem>
                                                            {employees.map(emp => (
                                                                <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {task.status === 'COMPLETED' ? (
                                                    <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 shadow-none border-none text-[10px] gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> Выполнено
                                                    </Badge>
                                                ) : task.status === 'IN_PROGRESS' ? (
                                                    <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 shadow-none border-none text-[10px] gap-1 animate-pulse">
                                                        <CircleDashed className="h-3 w-3 animate-spin" /> В работе
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-500 shadow-none border-none text-[10px] gap-1">
                                                        <Clock className="h-3 w-3" /> Ожидает
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {task.completed_at ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[11px] font-bold">
                                                            {new Date(task.completed_at).toLocaleDateString("ru-RU")}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground italic">
                                                            {new Date(task.completed_at).toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-200">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </div>
    )
}
