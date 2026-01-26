"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Loader2,
    CheckCircle2,
    Clock,
    Monitor,
    LayoutList as LayoutChecklist,
    AlertCircle,
    ArrowLeft
} from "lucide-react"
import Link from "next/link"

interface MaintenanceTask {
    id: string
    workstation_name: string
    zone: string
    status: 'PENDING' | 'COMPLETED'
    completed_at: string | null
    notes: string | null
}

export default function MyMaintenanceTasks() {
    const { clubId } = useParams()
    const [tasks, setTasks] = useState<MaintenanceTask[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear] = useState(new Date().getFullYear())

    useEffect(() => {
        if (clubId) fetchMyTasks()
    }, [clubId])

    const fetchMyTasks = async () => {
        try {
            // First get user info
            const userRes = await fetch('/api/auth/me')
            const userData = await userRes.json()
            const currentUserId = userData.user?.id || userData.id

            const res = await fetch(`/api/clubs/${clubId}/maintenance/tasks?month=${selectedMonth}&year=${selectedYear}`)
            const data = await res.json()

            if (res.ok && Array.isArray(data)) {
                const myTasks = data.filter((t: any) => t.assigned_user_id === currentUserId)
                setTasks(myTasks)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const toggleComplete = async (task: MaintenanceTask) => {
        const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
        try {
            const res = await fetch(`/api/clubs/${clubId}/maintenance/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            })
            if (res.ok) fetchMyTasks()
        } catch (error) {
            console.error(error)
        }
    }

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <Link href={`/dashboard`} className="mb-2 flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Назад
                </Link>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <LayoutChecklist className="h-8 w-8 text-primary" /> Мои задачи на чистку
                </h1>
                <p className="text-muted-foreground font-medium">Список назначенных компьютеров для обслуживания</p>
            </div>

            <div className="grid gap-6">
                {tasks.map(task => (
                    <Card key={task.id} className={`overflow-hidden transition-all duration-300 ${task.status === 'COMPLETED' ? 'bg-green-50/50 border-green-200 shadow-none' : 'shadow-xl shadow-foreground/5 hover:-translate-y-1'}`}>
                        <CardContent className="p-0">
                            <div className="flex items-center p-6 gap-6">
                                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-colors ${task.status === 'COMPLETED' ? 'bg-green-600 text-white' : 'bg-primary/10 text-primary'}`}>
                                    <Monitor className="h-7 w-7" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-xl font-bold">{task.workstation_name}</h3>
                                        <Badge variant="secondary" className="font-bold text-[10px] h-5">{task.zone}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Ежемесячное обслуживание</p>
                                </div>
                                <Button
                                    onClick={() => toggleComplete(task)}
                                    className={`h-12 px-6 rounded-xl font-black transition-all active:scale-95 ${task.status === 'COMPLETED' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20'}`}
                                >
                                    {task.status === 'COMPLETED' ? (
                                        <><CheckCircle2 className="h-4 w-4 mr-2" /> Сделано</>
                                    ) : (
                                        "Завершить"
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {tasks.length === 0 && (
                    <div className="p-20 text-center border-2 border-dashed rounded-[40px] space-y-4 bg-muted/20">
                        <div className="h-24 w-24 bg-background rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                            <AlertCircle className="h-10 w-10 text-muted-foreground opacity-30" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-2xl font-black tracking-tight">Задач не найдено</p>
                            <p className="text-muted-foreground font-medium max-w-xs mx-auto">У вас пока нет назначенных ПК на текущий месяц. Обратитесь к управляющему для назначения.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
