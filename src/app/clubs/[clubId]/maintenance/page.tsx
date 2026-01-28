"use client"

import { useEffect, useState, useMemo, useCallback, memo } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Loader2,
    Settings,
    Calendar,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Clock,
    AlertCircle,
    Monitor,
    LayoutGrid,
    UserPlus
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface MaintenanceTask {
    id: string
    workstation_id: string
    workstation_name: string
    zone: string
    assigned_user_id: string | null
    assigned_to: string | null
    status: 'PENDING' | 'COMPLETED'
    completed_at: string | null
    notes: string | null
}

interface Employee {
    id: string
    full_name: string
}

const MaintenanceRow = memo(({
    task,
    employees,
    onAssign
}: {
    task: MaintenanceTask,
    employees: Employee[],
    onAssign: (taskId: string, userId: string) => void
}) => {
    const isCompleted = task.status === 'COMPLETED';

    return (
        <tr className="hover:bg-accent">
            <td className="p-4">
                <div className="flex items-center gap-3">
                    <div className={isCompleted ? "bg-green-100 p-2 rounded-lg" : "bg-muted p-2 rounded-lg"}>
                        <Monitor className={cn("h-4 w-4", isCompleted ? "text-green-600" : "text-primary")} />
                    </div>
                    <div>
                        <p className="font-semibold text-sm">{task.workstation_name}</p>
                        <p className="text-xs text-muted-foreground">ID: {task.workstation_id.slice(0, 8)}</p>
                    </div>
                </div>
            </td>
            <td className="p-4">
                <span className="inline-block px-2 py-1 text-xs font-medium bg-muted rounded">{task.zone}</span>
            </td>
            <td className="p-4">
                <select
                    className="w-full max-w-[200px] bg-background border rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={task.assigned_user_id || ''}
                    onChange={(e) => onAssign(task.id, e.target.value)}
                >
                    <option value="">🚫 Не назначен</option>
                    {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>👤 {emp.full_name}</option>
                    ))}
                </select>
            </td>
            <td className="p-4">
                {isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Готово
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">
                        <Clock className="h-3.5 w-3.5" /> В работе
                    </span>
                )}
            </td>
            <td className="p-4 text-right text-sm">
                {task.completed_at ? (
                    <div className="text-xs">
                        <div className="font-medium">{new Date(task.completed_at).toLocaleDateString('ru-RU')}</div>
                        <div className="text-muted-foreground">{new Date(task.completed_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                ) : (
                    <span className="text-muted-foreground">—</span>
                )}
            </td>
        </tr>
    )
})

MaintenanceRow.displayName = "MaintenanceRow"

export default function MaintenanceDashboard() {
    const { clubId } = useParams()
    const [tasks, setTasks] = useState<MaintenanceTask[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [isGenerating, setIsGenerating] = useState(false)

    const monthNames = useMemo(() => [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ], []);

    const fetchTasks = useCallback(async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/maintenance/tasks?month=${selectedMonth}&year=${selectedYear}`)
            const data = await res.json()
            if (res.ok && Array.isArray(data)) {
                setTasks(data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId, selectedMonth, selectedYear])

    const fetchEmployees = useCallback(async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/employees`)
            const data = await res.json()
            if (res.ok && data.employees) {
                setEmployees(data.employees)
            }
        } catch (error) {
            console.error(error)
        }
    }, [clubId])

    useEffect(() => {
        if (clubId) {
            fetchTasks()
            fetchEmployees()
        }
    }, [clubId, fetchTasks, fetchEmployees])

    const generateTasks = async () => {
        setIsGenerating(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/maintenance/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month: selectedMonth, year: selectedYear })
            })
            if (res.ok) fetchTasks()
        } catch (error) {
            console.error(error)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleAssign = useCallback(async (taskId: string, userId: string) => {
        const targetUserId = userId === '' ? null : userId;

        // Optimistic update
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, assigned_user_id: targetUserId } : t
        ));

        try {
            const res = await fetch(`/api/clubs/${clubId}/maintenance/tasks/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigned_user_id: targetUserId })
            })
            if (!res.ok) {
                // Rollback on error
                fetchTasks();
            }
        } catch (error) {
            console.error(error)
            fetchTasks();
        }
    }, [clubId, fetchTasks])

    const stats = useMemo(() => {
        const completedCount = tasks.filter(t => t.status === 'COMPLETED').length
        const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0
        const unassignedCount = tasks.filter(t => !t.assigned_user_id).length
        return { completedCount, progress, unassignedCount }
    }, [tasks])

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">🛠 Обслуживание ПК</h1>
                    <p className="text-muted-foreground">Контроль ежемесячной чистки и технического состояния</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-card border rounded-lg p-1 shadow-sm">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedMonth(prev => prev === 1 ? 12 : prev - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-4 font-bold min-w-[140px] text-center text-sm">
                            {monthNames[selectedMonth - 1]} {selectedYear}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedMonth(prev => prev === 12 ? 1 : prev + 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <Link href={`/clubs/${clubId}/settings/workstations`}>
                        <Button variant="outline" className="shadow-sm"><Settings className="h-4 w-4 mr-2" /> Настроить ПК</Button>
                    </Link>
                </div>
            </div>

            <Card className="bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 border-none shadow-md overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Monitor className="h-32 w-32" />
                </div>
                <CardContent className="pt-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-black text-primary uppercase tracking-widest mb-2">Общий прогресс периода</p>
                                <div className="flex items-end gap-3">
                                    <span className="text-5xl font-black tracking-tighter">{Math.round(stats.progress)}%</span>
                                    <span className="text-muted-foreground font-medium pb-1.5">{stats.completedCount} из {tasks.length} ПК обслужено</span>
                                </div>
                            </div>
                            <div className="h-3 w-full md:w-[400px] bg-muted rounded-full overflow-hidden border border-primary/10 shadow-inner">
                                <div
                                    className="h-full bg-primary transition-all duration-500"
                                    style={{ width: `${stats.progress}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            {tasks.length === 0 ? (
                                <Button onClick={generateTasks} disabled={isGenerating} size="lg" className="h-16 px-8 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                    {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Calendar className="mr-2 h-5 w-5" />}
                                    Сформировать план на {monthNames[selectedMonth - 1]}
                                </Button>
                            ) : (
                                <>
                                    <div className="bg-background p-4 rounded-2xl border shadow-sm text-center min-w-[140px]">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Осталось ПК</p>
                                        <p className="text-3xl font-black">{tasks.length - stats.completedCount}</p>
                                    </div>
                                    <div className="bg-background p-4 rounded-2xl border shadow-sm text-center min-w-[140px]">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Без админа</p>
                                        <p className="text-3xl font-black text-amber-500">{stats.unassignedCount}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                        <LayoutGrid className="h-5 w-5 text-primary" /> Пообъектный контроль
                    </h2>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-green-500"></div> Готово</div>
                        <div className="flex items-center gap-1.5 ml-4"><div className="h-2 w-2 rounded-full bg-amber-500"></div> В работе</div>
                    </div>
                </div>

                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr className="text-left text-muted-foreground text-[10px] uppercase font-black tracking-widest">
                                    <th className="p-5">Компьютер / Место</th>
                                    <th className="p-5">Зона</th>
                                    <th className="p-5">Ответственный администратор</th>
                                    <th className="p-5">Текущий статус</th>
                                    <th className="p-5 text-right">Выполнено</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-foreground/5">
                                {tasks.map(task => (
                                    <MaintenanceRow
                                        key={task.id}
                                        task={task}
                                        employees={employees}
                                        onAssign={handleAssign}
                                    />
                                ))}
                                {tasks.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-20 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-4 opacity-50">
                                                <div className="h-16 w-16 bg-muted rounded-2xl flex items-center justify-center">
                                                    <AlertCircle className="h-8 w-8" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-lg font-bold">Задачи не сформированы</p>
                                                    <p className="text-sm">Нажмите кнопку сверху, чтобы подготовить план работ на месяц</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
