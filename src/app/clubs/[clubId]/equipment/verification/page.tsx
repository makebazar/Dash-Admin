"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { 
    CheckCircle2, 
    XCircle, 
    AlertTriangle, 
    Clock, 
    Search,
    User,
    Calendar,
    ArrowLeft,
    Eye,
    Monitor,
    Keyboard,
    Mouse,
    Headphones,
    Gamepad2,
    Tv,
    Box,
    Trash2
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { ImageViewer } from "@/components/ui/image-viewer"
import Link from "next/link"

interface VerificationTask {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type: string
    workstation_name: string | null
    zone_name: string | null
    task_type: string
    status: string
    verification_status: string
    due_date: string
    completed_at: string
    completed_by_name: string | null
    photos: string[] | null
    notes: string | null
    bonus_earned: number
    kpi_points: number
}

const getEquipmentIcon = (type: string) => {
    switch (type) {
        case 'PC': return <Monitor className="h-5 w-5" />;
        case 'MONITOR': return <Monitor className="h-5 w-5" />;
        case 'KEYBOARD': return <Keyboard className="h-5 w-5" />;
        case 'MOUSE': return <Mouse className="h-5 w-5" />;
        case 'HEADSET': return <Headphones className="h-5 w-5" />;
        case 'CONSOLE': return <Gamepad2 className="h-5 w-5" />;
        case 'TV': return <Tv className="h-5 w-5" />;
        default: return <Box className="h-5 w-5" />;
    }
}

export default function VerificationPage() {
    const { clubId } = useParams()
    const router = useRouter()
    const [tasks, setTasks] = useState<VerificationTask[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedTask, setSelectedTask] = useState<VerificationTask | null>(null)
    const [comment, setComment] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    // Image Viewer State
    const [viewerOpen, setViewerOpen] = useState(false)
    const [viewerImage, setViewerImage] = useState("")

    useEffect(() => {
        fetchTasks()
    }, [clubId])

    const fetchTasks = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/verification/list`)
            if (res.ok) {
                const data = await res.json()
                setTasks(data)
            }
        } catch (error) {
            console.error("Error fetching tasks:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleVerify = async (action: 'APPROVE' | 'REJECT') => {
        if (!selectedTask) return
        if (action === 'REJECT' && !comment.trim()) {
            alert("Пожалуйста, укажите причину возврата на доработку")
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${selectedTask.id}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    comment
                })
            })

            if (res.ok) {
                // Remove from list
                setTasks(prev => prev.filter(t => t.id !== selectedTask.id))
                setSelectedTask(null)
                setComment("")
            } else {
                alert("Ошибка при сохранении решения")
            }
        } catch (error) {
            console.error("Error verifying task:", error)
            alert("Произошла ошибка")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!selectedTask) return
        if (!confirm("Вы уверены, что хотите удалить этот отчет? Это действие нельзя отменить.")) return

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${selectedTask.id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                setTasks(prev => prev.filter(t => t.id !== selectedTask.id))
                setSelectedTask(null)
            } else {
                alert("Ошибка при удалении")
            }
        } catch (error) {
            console.error("Error deleting task:", error)
            alert("Произошла ошибка")
        } finally {
            setIsSubmitting(false)
        }
    }

    const openImage = (src: string) => {
        setViewerImage(src)
        setViewerOpen(true)
    }

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/clubs/${clubId}/equipment`}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Проверка отчетов</h1>
                    <p className="text-muted-foreground">Верификация выполненных работ и фотоотчетов</p>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : tasks.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="p-4 bg-green-50 rounded-full mb-4">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                        <h3 className="text-lg font-semibold">Все проверено!</h3>
                        <p className="text-muted-foreground mt-2">Нет задач, ожидающих проверки.</p>
                        <Button variant="outline" className="mt-6" onClick={() => router.push(`/clubs/${clubId}/equipment`)}>
                            Вернуться к оборудованию
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tasks.map((task) => (
                        <Card key={task.id} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-400" onClick={() => setSelectedTask(task)}>
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-slate-100 rounded-lg">
                                            {getEquipmentIcon(task.equipment_type)}
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{task.equipment_name}</CardTitle>
                                            <CardDescription className="text-xs">
                                                {task.workstation_name ? `${task.workstation_name} • ` : ''}
                                                {task.zone_name || 'Без зоны'}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                        Ожидает
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-3 text-sm space-y-3">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="h-4 w-4" />
                                    <span>{task.completed_by_name || 'Неизвестный'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span>
                                        {task.completed_at ? format(new Date(task.completed_at), 'd MMM HH:mm', { locale: ru }) : '-'}
                                    </span>
                                </div>
                                {task.photos && task.photos.length > 0 && (
                                    <div className="flex gap-1 mt-2">
                                        {task.photos.slice(0, 3).map((photo, i) => (
                                            <div key={i} className="h-12 w-12 rounded-md overflow-hidden relative border bg-slate-50">
                                                <img src={photo} className="h-full w-full object-cover" alt="" />
                                            </div>
                                        ))}
                                        {task.photos.length > 3 && (
                                            <div className="h-12 w-12 rounded-md bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-500 border">
                                                +{task.photos.length - 3}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="pt-0">
                                <Button className="w-full" variant="secondary" size="sm">
                                    Проверить
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Verification Dialog */}
            <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Проверка задачи</DialogTitle>
                        <DialogDescription>
                            Проверьте выполненную работу и фотоотчет
                        </DialogDescription>
                    </DialogHeader>

                    {selectedTask && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                            {/* Left: Details */}
                            <div className="space-y-6">
                                <div className="p-4 bg-slate-50 rounded-lg space-y-3 border">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <span className="text-muted-foreground">Оборудование:</span>
                                        <span className="font-medium text-right">{selectedTask.equipment_name}</span>
                                        
                                        <span className="text-muted-foreground">Место:</span>
                                        <span className="font-medium text-right">{selectedTask.workstation_name || '-'}</span>
                                        
                                        <span className="text-muted-foreground">Тип работ:</span>
                                        <span className="font-medium text-right translate-y-[2px]">
                                            <Badge variant="secondary" className="text-xs">{selectedTask.task_type}</Badge>
                                        </span>

                                        <span className="text-muted-foreground">Исполнитель:</span>
                                        <span className="font-medium text-right">{selectedTask.completed_by_name}</span>

                                        <span className="text-muted-foreground">Выполнено:</span>
                                        <span className="font-medium text-right">
                                            {selectedTask.completed_at ? format(new Date(selectedTask.completed_at), 'd MMMM yyyy, HH:mm', { locale: ru }) : '-'}
                                        </span>
                                    </div>
                                </div>

                                {selectedTask.notes && (
                                    <div>
                                        <h4 className="text-sm font-medium mb-2">Комментарий сотрудника:</h4>
                                        <p className="text-sm text-muted-foreground bg-slate-50 p-3 rounded-md italic border">
                                            "{selectedTask.notes}"
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-3 pt-4 border-t">
                                    <h4 className="text-sm font-medium">Ваше решение:</h4>
                                    <Textarea 
                                        placeholder="Комментарий (обязательно при возврате на доработку)..." 
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        className="resize-none"
                                        rows={3}
                                    />
                                    <div className="flex gap-3 pt-2">
                                        <Button 
                                            variant="destructive" 
                                            className="flex-1" 
                                            onClick={() => handleVerify('REJECT')}
                                            disabled={isSubmitting || !comment.trim()}
                                        >
                                            <XCircle className="mr-2 h-4 w-4" />
                                            На доработку
                                        </Button>
                                        <Button 
                                            className="flex-1 bg-green-600 hover:bg-green-700" 
                                            onClick={() => handleVerify('APPROVE')}
                                            disabled={isSubmitting}
                                        >
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Одобрить
                                        </Button>
                                    </div>
                                    <div className="flex justify-center pt-2">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 w-full"
                                            onClick={handleDelete}
                                            disabled={isSubmitting}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Удалить отчет навсегда
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Photos */}
                            <div>
                                <h4 className="text-sm font-medium mb-3 flex items-center justify-between">
                                    <span>Фотоотчет ({selectedTask.photos?.length || 0})</span>
                                    <span className="text-xs text-muted-foreground">Нажмите для просмотра</span>
                                </h4>
                                
                                {selectedTask.photos && selectedTask.photos.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedTask.photos.map((photo, i) => (
                                            <div 
                                                key={i} 
                                                className="group relative aspect-video bg-slate-100 rounded-lg overflow-hidden border cursor-zoom-in hover:ring-2 ring-primary/50 transition-all"
                                                onClick={() => openImage(photo)}
                                            >
                                                <img 
                                                    src={photo} 
                                                    alt={`Фото ${i+1}`} 
                                                    className="w-full h-full object-cover" 
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <Eye className="text-white drop-shadow-md h-8 w-8" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-slate-50 text-muted-foreground">
                                        <div className="p-4 bg-slate-100 rounded-full mb-3">
                                            <Eye className="h-6 w-6 text-slate-400" />
                                        </div>
                                        <p className="text-sm">Нет прикрепленных фото</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <ImageViewer 
                src={viewerImage} 
                isOpen={viewerOpen} 
                onClose={() => setViewerOpen(false)} 
            />
        </div>
    )
}
