
"use client"

import { useEffect, useState, useMemo } from "react"
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
    Trash2,
    Filter,
    Layers
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
    
    // Filters
    const [filterZone, setFilterZone] = useState<string>("all")
    const [filterEmployee, setFilterEmployee] = useState<string>("all")

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

    // Extract unique zones and employees for filters
    const zones = useMemo(() => {
        const unique = new Set(tasks.map(t => t.zone_name || 'Без зоны'))
        return Array.from(unique).sort()
    }, [tasks])

    const employees = useMemo(() => {
        const unique = new Set(tasks.map(t => t.completed_by_name || 'Неизвестный'))
        return Array.from(unique).sort()
    }, [tasks])

    // Group tasks by Zone
    const groupedTasks = useMemo(() => {
        const filtered = tasks.filter(t => {
            if (filterZone !== "all" && (t.zone_name || 'Без зоны') !== filterZone) return false
            if (filterEmployee !== "all" && (t.completed_by_name || 'Неизвестный') !== filterEmployee) return false
            return true
        })

        const groups: Record<string, VerificationTask[]> = {}
        
        filtered.forEach(task => {
            const zone = task.zone_name || 'Общая зона'
            if (!groups[zone]) groups[zone] = []
            groups[zone].push(task)
        })

        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
    }, [tasks, filterZone, filterEmployee])

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

                {/* Filters */}
                {tasks.length > 0 && (
                    <div className="flex gap-2">
                        <Select value={filterZone} onValueChange={setFilterZone}>
                            <SelectTrigger className="w-[180px]">
                                <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Все зоны" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Все зоны</SelectItem>
                                {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                            <SelectTrigger className="w-[180px]">
                                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Все сотрудники" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Все сотрудники</SelectItem>
                                {employees.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}
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
                <div className="space-y-8">
                    {groupedTasks.map(([zoneName, zoneTasks]) => (
                        <div key={zoneName} className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <Layers className="h-5 w-5 text-slate-500" />
                                <h2 className="text-xl font-semibold text-slate-800">{zoneName}</h2>
                                <Badge variant="secondary" className="ml-2">{zoneTasks.length}</Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {zoneTasks.map((task) => (
                                    <Card 
                                        key={task.id} 
                                        className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-amber-400 group" 
                                        onClick={() => setSelectedTask(task)}
                                    >
                                        <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-amber-50 transition-colors">
                                                        {getEquipmentIcon(task.equipment_type)}
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <CardTitle className="text-base truncate" title={task.equipment_name}>{task.equipment_name}</CardTitle>
                                                        <CardDescription className="text-xs truncate">
                                                            {task.workstation_name || 'Общее оборудование'}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pb-3 text-sm space-y-3">
                                            <div className="flex justify-between items-center text-xs text-muted-foreground bg-slate-50 p-2 rounded-md">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-3 w-3" />
                                                    <span className="truncate max-w-[80px]">{task.completed_by_name?.split(' ')[0] || '...'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3" />
                                                    <span>
                                                        {task.completed_at ? format(new Date(task.completed_at), 'HH:mm', { locale: ru }) : '-'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {task.photos && task.photos.length > 0 ? (
                                                <div className="grid grid-cols-3 gap-1 mt-2">
                                                    {task.photos.slice(0, 3).map((photo, i) => (
                                                        <div key={i} className="aspect-square rounded-md overflow-hidden relative border bg-slate-50">
                                                            <img src={photo} className="h-full w-full object-cover" alt="" />
                                                        </div>
                                                    ))}
                                                    {task.photos.length > 3 && (
                                                        <div className="aspect-square rounded-md bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-500 border">
                                                            +{task.photos.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="h-14 flex items-center justify-center text-xs text-muted-foreground bg-slate-50 rounded border border-dashed">
                                                    Нет фото
                                                </div>
                                            )}
                                        </CardContent>
                                        <CardFooter className="pt-0">
                                            <Button className="w-full group-hover:bg-amber-600 group-hover:text-white transition-colors" variant="secondary" size="sm">
                                                Проверить
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Verification Sheet (Side Panel) */}
            <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
                <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col bg-slate-50/50">
                    {selectedTask && (
                        <>
                            <SheetHeader className="px-6 py-4 bg-background border-b shadow-sm z-10">
                                <SheetTitle className="flex items-center gap-2">
                                    <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                                        {getEquipmentIcon(selectedTask.equipment_type)}
                                    </div>
                                    <div>
                                        <div className="text-lg">{selectedTask.equipment_name}</div>
                                        <div className="text-xs font-normal text-muted-foreground flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal bg-slate-50">
                                                {selectedTask.task_type}
                                            </Badge>
                                            <span>•</span>
                                            <span>{selectedTask.zone_name || 'Без зоны'}</span>
                                        </div>
                                    </div>
                                </SheetTitle>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto">
                                <div className="p-6 space-y-6">
                                    {/* Info Cards */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white p-3 rounded-xl border shadow-sm">
                                            <div className="text-xs text-muted-foreground mb-1">Исполнитель</div>
                                            <div className="font-medium flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-xs">
                                                    <User className="h-3 w-3" />
                                                </div>
                                                {selectedTask.completed_by_name}
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border shadow-sm">
                                            <div className="text-xs text-muted-foreground mb-1">Время выполнения</div>
                                            <div className="font-medium flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-xs">
                                                    <Clock className="h-3 w-3" />
                                                </div>
                                                {selectedTask.completed_at ? format(new Date(selectedTask.completed_at), 'd MMM HH:mm', { locale: ru }) : '-'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Photos Section */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                            <Eye className="h-4 w-4" /> Фотоотчет ({selectedTask.photos?.length || 0})
                                        </h3>
                                        
                                        {selectedTask.photos && selectedTask.photos.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                {selectedTask.photos.map((photo, i) => (
                                                    <div 
                                                        key={i} 
                                                        className="group relative aspect-video bg-white rounded-xl overflow-hidden border shadow-sm cursor-zoom-in hover:ring-2 ring-primary/50 transition-all"
                                                        onClick={() => openImage(photo)}
                                                    >
                                                        <img 
                                                            src={photo} 
                                                            alt={`Фото ${i+1}`} 
                                                            className="w-full h-full object-cover" 
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <div className="bg-white/90 p-2 rounded-full shadow-lg">
                                                                <Eye className="text-slate-900 h-5 w-5" />
                                                            </div>
                                                        </div>
                                                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                            Фото {i + 1}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-muted-foreground">
                                                <Eye className="h-8 w-8 text-slate-300 mb-2" />
                                                <p className="text-sm">Нет фото</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Comments Section */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                            <User className="h-4 w-4" /> Комментарии
                                        </h3>

                                        {selectedTask.notes ? (
                                            <div className="bg-white p-4 rounded-xl border shadow-sm relative">
                                                <p className="text-slate-700 italic text-sm pl-2 border-l-2 border-amber-300">
                                                    "{selectedTask.notes}"
                                                </p>
                                                <div className="mt-2 text-[10px] text-muted-foreground text-right">— Комментарий сотрудника</div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground italic pl-2">
                                                Комментарий отсутствует
                                            </div>
                                        )}

                                        <div className="pt-4 border-t">
                                            <label className="text-sm font-medium mb-2 block">Ваш комментарий (для доработки):</label>
                                            <Textarea 
                                                placeholder="Опишите, что нужно исправить..." 
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                                className="resize-none bg-white min-h-[100px]"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="h-20" /> {/* Spacer for footer */}
                                </div>
                            </div>

                            <SheetFooter className="p-6 bg-white border-t mt-auto z-10 flex-col gap-3 sm:flex-col sm:space-x-0">
                                <div className="grid grid-cols-2 gap-3 w-full">
                                    <Button 
                                        variant="outline" 
                                        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-12"
                                        onClick={() => handleVerify('REJECT')}
                                        disabled={isSubmitting || !comment.trim()}
                                    >
                                        <XCircle className="mr-2 h-5 w-5" />
                                        На доработку
                                    </Button>
                                    <Button 
                                        className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200 h-12" 
                                        onClick={() => handleVerify('APPROVE')}
                                        disabled={isSubmitting}
                                    >
                                        <CheckCircle2 className="mr-2 h-5 w-5" />
                                        Одобрить
                                    </Button>
                                </div>
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
                            </SheetFooter>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <ImageViewer 
                src={viewerImage} 
                isOpen={viewerOpen} 
                onClose={() => setViewerOpen(false)} 
            />
        </div>
    )
}
