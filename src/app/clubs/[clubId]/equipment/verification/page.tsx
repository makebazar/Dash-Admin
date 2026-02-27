
"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { 
    CheckCircle2, 
    XCircle, 
    Clock, 
    User,
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
    Layers,
    ChevronDown,
    ChevronUp
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
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
import { cn } from "@/lib/utils"

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
        case 'PC': return <Monitor className="h-4 w-4" />;
        case 'MONITOR': return <Monitor className="h-4 w-4" />;
        case 'KEYBOARD': return <Keyboard className="h-4 w-4" />;
        case 'MOUSE': return <Mouse className="h-4 w-4" />;
        case 'HEADSET': return <Headphones className="h-4 w-4" />;
        case 'CONSOLE': return <Gamepad2 className="h-4 w-4" />;
        case 'TV': return <Tv className="h-4 w-4" />;
        default: return <Box className="h-4 w-4" />;
    }
}

export default function VerificationPage() {
    const { clubId } = useParams()
    const router = useRouter()
    const [tasks, setTasks] = useState<VerificationTask[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
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

    const handleVerify = async (task: VerificationTask, action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !comment.trim()) {
            alert("Пожалуйста, укажите причину возврата на доработку")
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${task.id}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    comment
                })
            })

            if (res.ok) {
                // Remove from list
                setTasks(prev => prev.filter(t => t.id !== task.id))
                if (expandedTaskId === task.id) {
                    setExpandedTaskId(null)
                    setComment("")
                }
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

    const handleDelete = async (task: VerificationTask) => {
        if (!confirm("Вы уверены, что хотите удалить этот отчет? Это действие нельзя отменить.")) return

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${task.id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                setTasks(prev => prev.filter(t => t.id !== task.id))
                if (expandedTaskId === task.id) {
                    setExpandedTaskId(null)
                }
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

    const openImage = (src: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setViewerImage(src)
        setViewerOpen(true)
    }

    const toggleExpand = (taskId: string) => {
        if (expandedTaskId === taskId) {
            setExpandedTaskId(null)
            setComment("")
        } else {
            setExpandedTaskId(taskId)
            setComment("")
        }
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
        <div className="p-8 space-y-8 max-w-5xl mx-auto">
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
                        <div key={zoneName} className="space-y-3">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <Layers className="h-5 w-5 text-slate-500" />
                                <h2 className="text-xl font-semibold text-slate-800">{zoneName}</h2>
                                <Badge variant="secondary" className="ml-2">{zoneTasks.length}</Badge>
                            </div>
                            
                            <div className="flex flex-col gap-3">
                                {zoneTasks.map((task) => {
                                    const isExpanded = expandedTaskId === task.id
                                    return (
                                        <div 
                                            key={task.id} 
                                            className={cn(
                                                "bg-white border rounded-xl overflow-hidden transition-all shadow-sm",
                                                isExpanded ? "ring-2 ring-primary/20 border-primary/30" : "hover:border-slate-300"
                                            )}
                                        >
                                            {/* Summary Row */}
                                            <div 
                                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                                onClick={() => toggleExpand(task.id)}
                                            >
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                                        isExpanded ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500"
                                                    )}>
                                                        {getEquipmentIcon(task.equipment_type)}
                                                    </div>
                                                    
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="font-semibold text-sm truncate">{task.equipment_name}</span>
                                                            {task.workstation_name && (
                                                                <span className="text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">
                                                                    {task.workstation_name}
                                                                </span>
                                                            )}
                                                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal ml-auto sm:ml-0">
                                                                {task.task_type}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                            <div className="flex items-center gap-1">
                                                                <User className="h-3 w-3" />
                                                                {task.completed_by_name?.split(' ')[0]}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {task.completed_at ? format(new Date(task.completed_at), 'HH:mm', { locale: ru }) : '-'}
                                                            </div>
                                                            {task.photos && task.photos.length > 0 && (
                                                                <div className="flex items-center gap-1 text-blue-600 font-medium">
                                                                    <Eye className="h-3 w-3" />
                                                                    {task.photos.length} фото
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 pl-4 border-l ml-4">
                                                    {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <div className="border-t bg-slate-50/50 p-6 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        {/* Photos */}
                                                        <div>
                                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                                                <Eye className="h-3 w-3" /> Фотоотчет
                                                            </h4>
                                                            {task.photos && task.photos.length > 0 ? (
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                    {task.photos.map((photo, i) => (
                                                                        <div 
                                                                            key={i} 
                                                                            className="group relative aspect-video bg-white rounded-lg overflow-hidden border shadow-sm cursor-zoom-in hover:ring-2 ring-primary/50 transition-all"
                                                                            onClick={(e) => openImage(photo, e)}
                                                                        >
                                                                            <img 
                                                                                src={photo} 
                                                                                alt={`Фото ${i+1}`} 
                                                                                className="w-full h-full object-cover" 
                                                                            />
                                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                                                <Eye className="text-white drop-shadow-md h-6 w-6" />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg text-muted-foreground text-sm">
                                                                    Нет фото
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Actions & Comments */}
                                                        <div className="space-y-4">
                                                            {task.notes && (
                                                                <div className="bg-white p-3 rounded-lg border shadow-sm">
                                                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Комментарий сотрудника</div>
                                                                    <p className="text-sm text-slate-700 italic">"{task.notes}"</p>
                                                                </div>
                                                            )}

                                                            <div className="space-y-2">
                                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Ваше решение</div>
                                                                <Textarea 
                                                                    placeholder="Комментарий (обязательно для возврата)..." 
                                                                    value={comment}
                                                                    onChange={(e) => setComment(e.target.value)}
                                                                    className="bg-white min-h-[80px] resize-none text-sm"
                                                                />
                                                            </div>

                                                            <div className="flex gap-2 pt-2">
                                                                <Button 
                                                                    variant="outline" 
                                                                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                    onClick={() => handleVerify(task, 'REJECT')}
                                                                    disabled={isSubmitting || !comment.trim()}
                                                                >
                                                                    <XCircle className="mr-2 h-4 w-4" />
                                                                    На доработку
                                                                </Button>
                                                                <Button 
                                                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-sm" 
                                                                    onClick={() => handleVerify(task, 'APPROVE')}
                                                                    disabled={isSubmitting}
                                                                >
                                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                                    Одобрить
                                                                </Button>
                                                            </div>
                                                            
                                                            <div className="flex justify-center pt-2">
                                                                <button 
                                                                    onClick={() => handleDelete(task)}
                                                                    className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                                                                    disabled={isSubmitting}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                    Удалить отчет
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ImageViewer 
                src={viewerImage} 
                isOpen={viewerOpen} 
                onClose={() => setViewerOpen(false)} 
            />
        </div>
    )
}
