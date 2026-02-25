"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import {
    ChevronLeft,
    Trash2,
    Monitor,
    Wrench,
    History,
    User,
    Camera,
    X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import Link from "next/link"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface MaintenanceTask {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type: string
    equipment_type_name: string
    equipment_icon: string
    last_cleaned_at: string | null
    workstation_name: string | null
    workstation_zone: string | null
    assigned_user_id: string | null
    assigned_to_name: string | null
    due_date: string
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
    completed_at: string | null
    completed_by_name: string | null
    task_type: string
    photos: string[] | null
}

export default function MaintenanceHistory() {
    const { clubId } = useParams()
    const [tasks, setTasks] = useState<MaintenanceTask[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
    const [viewingPhotos, setViewingPhotos] = useState<string[] | null>(null)

    const fetchHistory = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch(
                `/api/clubs/${clubId}/equipment/maintenance?status=COMPLETED&sort_by=completed_at&order=desc`
            )
            const data = await res.json()
            if (res.ok) {
                setTasks(data.tasks || [])
            } else {
                console.error("Failed to load history")
            }
        } catch (error) {
            console.error("Error fetching history:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    useEffect(() => {
        fetchHistory()
    }, [fetchHistory])

    const handleDeleteClick = (taskId: string) => {
        setTaskToDelete(taskId)
        setIsDialogOpen(true)
    }

    const confirmDelete = async () => {
        if (!taskToDelete) return

        setDeletingId(taskToDelete)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${taskToDelete}`, {
                method: 'DELETE'
            })
            
            if (res.ok) {
                // Remove from local state
                setTasks(prev => prev.filter(t => t.id !== taskToDelete))
                setIsDialogOpen(false)
            } else {
                const error = await res.json()
                alert(error.message || "Не удалось удалить запись")
            }
        } catch (error) {
            console.error("Error deleting task:", error)
            alert("Ошибка при удалении")
        } finally {
            setDeletingId(null)
            setTaskToDelete(null)
        }
    }

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link 
                    href={`/clubs/${clubId}/equipment`} 
                    className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    К оборудованию
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <History className="h-8 w-8 text-slate-700" />
                        История обслуживания
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Лог выполненных работ и изменений статусов
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Дата выполнения</TableHead>
                            <TableHead>Оборудование</TableHead>
                            <TableHead>Тип работ</TableHead>
                            <TableHead>Фото</TableHead>
                            <TableHead>Исполнитель</TableHead>
                            <TableHead>Местоположение</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    Загрузка...
                                </TableCell>
                            </TableRow>
                        ) : tasks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    История пуста
                                </TableCell>
                            </TableRow>
                        ) : (
                            tasks.map((task) => (
                                <TableRow key={task.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {task.completed_at 
                                                    ? format(new Date(task.completed_at), 'd MMMM yyyy, HH:mm', { locale: ru })
                                                    : '-'
                                                }
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                План: {format(new Date(task.due_date), 'd MMM', { locale: ru })}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                                {task.equipment_type === 'PC' ? <Monitor className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{task.equipment_name}</span>
                                                <span className="text-xs text-muted-foreground">{task.equipment_type_name}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            {task.task_type === 'CLEANING' ? 'Чистка' : task.task_type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {task.photos && task.photos.length > 0 ? (
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-8 gap-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                onClick={() => setViewingPhotos(task.photos)}
                                            >
                                                <Camera className="h-4 w-4" />
                                                <span className="text-xs font-bold">{task.photos.length}</span>
                                            </Button>
                                        ) : (
                                            <span className="text-slate-300 text-xs">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
                                                <User className="h-3 w-3 text-slate-500" />
                                            </div>
                                            <span className="text-sm">{task.completed_by_name || '—'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm text-muted-foreground">
                                            {task.workstation_name ? (
                                                <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium text-xs">
                                                    {task.workstation_zone} :: {task.workstation_name}
                                                </span>
                                            ) : 'Склад'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDeleteClick(task.id)}
                                            disabled={deletingId === task.id}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Удалить запись?</DialogTitle>
                        <DialogDescription>
                            Это действие отменит факт выполнения обслуживания. 
                            Если это была последняя чистка, дата последней чистки оборудования будет возвращена к предыдущему значению.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Отмена
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={confirmDelete}
                            disabled={!!deletingId}
                        >
                            {deletingId ? "Удаление..." : "Удалить"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Photo Viewer Dialog */}
            <Dialog open={!!viewingPhotos} onOpenChange={(open) => !open && setViewingPhotos(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
                    <div className="relative w-full h-[80vh] flex items-center justify-center">
                        <button 
                            onClick={() => setViewingPhotos(null)}
                            className="absolute top-4 right-4 z-50 p-2 bg-black/50 text-white rounded-full hover:bg-white/20 transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        
                        <div className="w-full h-full p-4 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {viewingPhotos?.map((url, idx) => (
                                    <div key={idx} className="relative rounded-lg overflow-hidden border border-white/10">
                                        <img 
                                            src={url} 
                                            alt={`Photo ${idx + 1}`} 
                                            className="w-full h-auto object-contain"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
