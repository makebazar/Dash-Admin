"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, History, Camera, CheckCircle, XCircle, AlertTriangle, BarChart3, Search, Filter, Monitor, CheckCircle2, Eye, Clock, User, Layers, Calendar, ChevronDown, ChevronUp, Box, Keyboard, Mouse, Headphones, Gamepad2, Tv, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { ImageViewer } from "@/components/ui/image-viewer"
import { cn } from "@/lib/utils"
import { PageShell, PageHeader, PageToolbar, ToolbarGroup } from "@/components/layout/PageShell"

interface Evaluation {
    id: number
    template_name: string
    employee_name: string
    evaluator_name: string
    total_score: number
    max_score: number
    evaluation_date: string
    created_at: string
    status?: 'pending' | 'approved' | 'rejected'
    reviewer_note?: string
}

interface EvaluationResponse {
    id: number
    item_content: string
    score: number
    comment?: string
    photo_url?: string
    photo_urls?: string[]
    is_accepted?: boolean
    admin_comment?: string
}

interface EvaluationDetail extends Evaluation {
    comments?: string
    responses: EvaluationResponse[]
}

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
        case 'CLEANING': return <div className="inline-flex items-center rounded-full border py-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-[10px] h-5 px-1.5 font-normal ml-auto sm:ml-0 bg-blue-50 text-blue-700 border-blue-200">Уборка</div>;
        default: return <Box className="h-4 w-4" />;
    }
}

const getTaskTypeLabel = (type: string) => {
    switch (type) {
        case 'CLEANING': return 'ЧИСТКА';
        case 'MAINTENANCE': return 'ОБСЛУЖИВАНИЕ';
        case 'REPAIR': return 'РЕМОНТ';
        case 'CHECK': return 'ПРОВЕРКА';
        default: return type;
    }
}

export default function ChecklistsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    
    // Checklists State
    const [history, setHistory] = useState<Evaluation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationDetail | null>(null)
    const [isDetailLoading, setIsDetailLoading] = useState(false)
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
    const [isReviewMode, setIsReviewMode] = useState(false)
    const [reviewItems, setReviewItems] = useState<Record<number, { is_accepted: boolean, admin_comment: string }>>({})
    const [reviewerNote, setReviewerNote] = useState('')
    const [isSubmittingReview, setIsSubmittingReview] = useState(false)

    // Equipment Verification State
    const [tasks, setTasks] = useState<VerificationTask[]>([])
    const [isTasksLoading, setIsTasksLoading] = useState(true)
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    const [comment, setComment] = useState("")
    const [isSubmittingTask, setIsSubmittingTask] = useState(false)
    const [viewerOpen, setViewerOpen] = useState(false)
    const [viewerImage, setViewerImage] = useState("")
    const [currentTaskPhotos, setCurrentTaskPhotos] = useState<string[]>([])
    const [filterZone, setFilterZone] = useState<string>("all")
    const [filterEmployee, setFilterEmployee] = useState<string>("all")

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchHistory(p.clubId)
            fetchTasks(p.clubId)
        })
    }, [params])

    const fetchHistory = async (id: string) => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${id}/evaluations`)
            const data = await res.json()
            if (res.ok && Array.isArray(data)) {
                setHistory(data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchTasks = async (id: string) => {
        setIsTasksLoading(true)
        try {
            const res = await fetch(`/api/clubs/${id}/equipment/verification/list`)
            if (res.ok) {
                const data = await res.json()
                setTasks(data)
            }
        } catch (error) {
            console.error("Error fetching tasks:", error)
        } finally {
            setIsTasksLoading(false)
        }
    }

    // --- Checklists Handlers ---

    const handleViewEvaluation = async (evaluationId: number) => {
        setIsReviewMode(false)
        setReviewItems({})
        setReviewerNote('')
        setPhotoPreviewUrl(null)

        const basicInfo = history.find(h => h.id === evaluationId)
        if (basicInfo) {
            // @ts-ignore
            setSelectedEvaluation({ ...basicInfo, responses: [] })
        }
        
        setIsDetailLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/evaluations/${evaluationId}`)
            const data = await res.json()
            if (res.ok) {
                setSelectedEvaluation(data)
                const initialReviewState: Record<number, any> = {}
                data.responses.forEach((r: EvaluationResponse) => {
                    initialReviewState[r.id] = {
                        is_accepted: r.is_accepted !== false,
                        admin_comment: r.admin_comment || ''
                    }
                })
                setReviewItems(initialReviewState)
                setReviewerNote(data.reviewer_note || '')
            } else {
                alert('Не удалось загрузить детали')
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsDetailLoading(false)
        }
    }

    const handleReviewItemChange = (responseId: number, field: 'is_accepted' | 'admin_comment', value: any) => {
        setReviewItems(prev => ({
            ...prev,
            [responseId]: {
                ...prev[responseId],
                [field]: value
            }
        }))
    }

    const submitReview = async (status: 'approved' | 'rejected') => {
        if (!selectedEvaluation) return
        
        setIsSubmittingReview(true)
        try {
            const itemsToUpdate = Object.entries(reviewItems).map(([id, data]) => ({
                response_id: parseInt(id),
                is_accepted: data.is_accepted,
                admin_comment: data.admin_comment
            }))

            const res = await fetch(`/api/clubs/${clubId}/evaluations/${selectedEvaluation.id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    reviewer_note: reviewerNote,
                    items: itemsToUpdate
                })
            })

            if (res.ok) {
                const result = await res.json()
                setHistory(prev => prev.map(item => 
                    item.id === selectedEvaluation.id 
                        ? { ...item, status, total_score: result.new_score, reviewer_note: reviewerNote } 
                        : item
                ))
                setSelectedEvaluation(null)
                setIsReviewMode(false)
            } else {
                alert('Ошибка сохранения проверки')
            }
        } catch (error) {
            console.error(error)
            alert('Ошибка сервера')
        } finally {
            setIsSubmittingReview(false)
        }
    }

    const getStatusBadge = (status?: string) => {
        switch(status) {
            case 'approved': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Принят</Badge>
            case 'rejected': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Замечания</Badge>
            default: return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">На проверке</Badge>
        }
    }

    // --- Equipment Verification Handlers ---

    const handleVerifyTask = async (task: VerificationTask, action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !comment.trim()) {
            alert("Пожалуйста, укажите причину возврата на доработку")
            return
        }

        setIsSubmittingTask(true)
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
            setIsSubmittingTask(false)
        }
    }

    const handleDeleteTask = async (task: VerificationTask) => {
        if (!confirm("Вы уверены, что хотите удалить этот отчет? Это действие нельзя отменить.")) return

        setIsSubmittingTask(true)
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
            setIsSubmittingTask(false)
        }
    }

    const openImage = (src: string, photos: string[], e: React.MouseEvent) => {
        e.stopPropagation()
        setViewerImage(src)
        setCurrentTaskPhotos(photos)
        setViewerOpen(true)
    }

    const handleNextImage = () => {
        const currentIndex = currentTaskPhotos.indexOf(viewerImage)
        if (currentIndex < currentTaskPhotos.length - 1) {
            setViewerImage(currentTaskPhotos[currentIndex + 1])
        }
    }

    const handlePrevImage = () => {
        const currentIndex = currentTaskPhotos.indexOf(viewerImage)
        if (currentIndex > 0) {
            setViewerImage(currentTaskPhotos[currentIndex - 1])
        }
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

    // Equipment Filters
    const zones = useMemo(() => {
        const unique = new Set(tasks.map(t => t.zone_name || 'Без зоны'))
        return Array.from(unique).sort()
    }, [tasks])

    const employees = useMemo(() => {
        const unique = new Set(tasks.map(t => t.completed_by_name || 'Неизвестный'))
        return Array.from(unique).sort()
    }, [tasks])

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

    // Stats
    const totalEvaluations = history.length
    const pendingEvaluations = history.filter(h => h.status === 'pending' || !h.status).length
    const pendingTasks = tasks.length
    const totalPending = pendingEvaluations + pendingTasks

    return (
        <PageShell maxWidth="6xl">
            <PageHeader 
                title="Центр проверок" 
                description="Единый центр контроля качества и выполненных работ"
            >
                <div className="flex flex-col items-end px-4 py-2 bg-muted/30 rounded-lg border">
                    <span className="text-xs text-muted-foreground uppercase font-bold">Ожидают проверки</span>
                    <span className="text-xl font-bold text-yellow-600">{totalPending}</span>
                </div>
            </PageHeader>

            <Tabs defaultValue="equipment" className="w-full">
                <div className="border-b mb-6 overflow-x-auto">
                    <TabsList className="bg-transparent h-auto p-0 space-x-6 min-w-max">
                        <TabsTrigger value="equipment" variant="underline" className="pb-3 rounded-none">
                            <Monitor className="h-4 w-4 mr-2" />
                            Оборудование
                            {pendingTasks > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-slate-100">{pendingTasks}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="history" variant="underline" className="pb-3 rounded-none">
                            <History className="h-4 w-4 mr-2" />
                            Чеклисты персонала
                            {pendingEvaluations > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-slate-100">{pendingEvaluations}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="stats" variant="underline" className="pb-3 rounded-none">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Статистика
                        </TabsTrigger>
                    </TabsList>
                </div>

                    {/* EQUIPMENT TAB */}
                    <TabsContent value="equipment">
                        <div className="space-y-6">
                            {/* Filters */}
                            {tasks.length > 0 && (
                                <PageToolbar>
                                    <ToolbarGroup>
                                        <Select value={filterZone} onValueChange={setFilterZone}>
                                            <SelectTrigger className="w-[180px] h-9 text-sm">
                                                <Layers className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                                <SelectValue placeholder="Зона" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Все зоны</SelectItem>
                                                {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                                            </SelectContent>
                                        </Select>

                                        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                                            <SelectTrigger className="w-[180px] h-9 text-sm">
                                                <User className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                                <SelectValue placeholder="Сотрудник" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Все сотрудники</SelectItem>
                                                {employees.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </ToolbarGroup>
                                    <ToolbarGroup align="end">
                                        <div className="text-sm text-muted-foreground">
                                            Показано: <span className="font-medium text-foreground">{Object.values(groupedTasks).reduce((acc, tasks) => acc + tasks.length, 0)}</span> задач
                                        </div>
                                    </ToolbarGroup>
                                </PageToolbar>
                            )}

                            {isTasksLoading ? (
                                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
                            ) : tasks.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                                    <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4 opacity-50" />
                                    <h3 className="text-lg font-medium text-foreground">Все проверено!</h3>
                                    <p>Нет задач по оборудованию, ожидающих проверки.</p>
                                </div>
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
                                                                        isExpanded ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500",
                                                                        task.equipment_type === 'CLEANING' && "w-auto px-0 bg-transparent"
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
                                                                                {getTaskTypeLabel(task.task_type)}
                                                                            </Badge>
                                                                        </div>
                                                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                                            <div className="flex items-center gap-1">
                                                                                <User className="h-3 w-3" />
                                                                                {task.completed_by_name?.split(' ')[0]}
                                                                            </div>
                                                                            <div className="flex items-center gap-1">
                                                                                <Calendar className="h-3 w-3" />
                                                                                {task.completed_at ? format(new Date(task.completed_at), 'dd.MM', { locale: ru }) : '-'}
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
                                                                                                onClick={(e) => openImage(photo, task.photos || [], e)}
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
                                                                                    onClick={() => handleVerifyTask(task, 'REJECT')}
                                                                                    disabled={isSubmittingTask || !comment.trim()}
                                                                                >
                                                                                    <XCircle className="mr-2 h-4 w-4" />
                                                                                    На доработку
                                                                                </Button>
                                                                                <Button 
                                                                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-sm" 
                                                                                    onClick={() => handleVerifyTask(task, 'APPROVE')}
                                                                                    disabled={isSubmittingTask}
                                                                                >
                                                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                                                    Одобрить
                                                                                </Button>
                                                                            </div>
                                                                            
                                                                            <div className="flex justify-center pt-2">
                                                                                <button 
                                                                                    onClick={() => handleDeleteTask(task)}
                                                                                    className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                                                                                    disabled={isSubmittingTask}
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
                        </div>
                    </TabsContent>

                    {/* HISTORY TAB (Original Checklists) */}
                    <TabsContent value="history">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Все проверки</CardTitle>
                                    <CardDescription>Список отчетов сотрудников</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => fetchHistory(clubId)}>
                                        Обновить
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
                                ) : history.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <History className="mx-auto h-12 w-12 opacity-20 mb-4" />
                                        <p>Проверок еще не проводилось</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Статус</TableHead>
                                                <TableHead>Дата</TableHead>
                                                <TableHead>Шаблон</TableHead>
                                                <TableHead>Кого проверяли</TableHead>
                                                <TableHead>Кто проверял</TableHead>
                                                <TableHead className="text-right">Баллы</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {history.map(evaluation => (
                                                <TableRow key={evaluation.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewEvaluation(evaluation.id)}>
                                                    <TableCell>{getStatusBadge(evaluation.status)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{new Date(evaluation.evaluation_date || evaluation.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                            <span className="text-xs text-muted-foreground">{new Date(evaluation.evaluation_date || evaluation.created_at).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{evaluation.template_name}</TableCell>
                                                    <TableCell>{evaluation.employee_name}</TableCell>
                                                    <TableCell>{evaluation.evaluator_name || '—'}</TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={`font-bold ${evaluation.total_score >= 80 ? 'text-green-600' : evaluation.total_score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                            {Math.round(evaluation.total_score)}%
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="stats">
                        <Card>
                            <CardHeader>
                                <CardTitle>Рейтинг сотрудников</CardTitle>
                                <CardDescription>Средний балл по результатам всех проверок</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {history.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <BarChart3 className="mx-auto h-12 w-12 opacity-20 mb-4" />
                                        <p>Недостаточно данных для статистики</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Сотрудник</TableHead>
                                                <TableHead className="text-right">Проверок</TableHead>
                                                <TableHead className="text-right">Средний балл</TableHead>
                                                <TableHead className="text-right">Статус</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(() => {
                                                const stats = history.reduce((acc, curr) => {
                                                    if (!acc[curr.employee_name]) {
                                                        acc[curr.employee_name] = { total: 0, count: 0, name: curr.employee_name };
                                                    }
                                                    acc[curr.employee_name].total += curr.total_score;
                                                    acc[curr.employee_name].count += 1;
                                                    return acc;
                                                }, {} as Record<string, { total: number, count: number, name: string }>);

                                                return Object.values(stats)
                                                    .sort((a, b) => (b.total / b.count) - (a.total / a.count))
                                                    .map((stat, idx) => {
                                                        const avg = stat.total / stat.count;
                                                        return (
                                                            <TableRow key={idx}>
                                                                <TableCell className="font-medium">{stat.name}</TableCell>
                                                                <TableCell className="text-right">{stat.count}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <span className={`font-bold ${avg >= 80 ? 'text-green-600' : avg >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                                        {Math.round(avg)}%
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {avg >= 90 ? '🏆 Отлично' : avg >= 75 ? '✅ Хорошо' : '⚠️ Требует внимания'}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    });
                                            })()}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

            {/* DETAIL & REVIEW DIALOG */}
            <Dialog
                open={!!selectedEvaluation}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedEvaluation(null)
                        setIsReviewMode(false)
                    }
                }}
            >
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <div className="flex items-center justify-between mr-8">
                                <DialogTitle>Результаты проверки</DialogTitle>
                                {selectedEvaluation && getStatusBadge(selectedEvaluation.status)}
                            </div>
                            <DialogDescription>
                                {selectedEvaluation?.template_name} • {selectedEvaluation && new Date(selectedEvaluation.evaluation_date || selectedEvaluation.created_at).toLocaleDateString()}
                            </DialogDescription>
                        </DialogHeader>
                        
                        {isDetailLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : selectedEvaluation ? (
                            <div className="space-y-6">
                                {/* Header Info */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-xl border">
                                    <div>
                                        <p className="text-muted-foreground text-xs uppercase font-bold">Сотрудник</p>
                                        <p className="font-medium">{selectedEvaluation.employee_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs uppercase font-bold">Проверяющий</p>
                                        <p className="font-medium">{selectedEvaluation.reviewed_by ? 'Администратор' : (selectedEvaluation.evaluator_name || '—')}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs uppercase font-bold">Дата проверки</p>
                                        <p className="font-medium">{selectedEvaluation.reviewed_at ? new Date(selectedEvaluation.reviewed_at).toLocaleDateString() : '—'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-muted-foreground text-xs uppercase font-bold">Итоговый балл</p>
                                        <span className={`text-xl font-black ${selectedEvaluation.total_score >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
                                            {Math.round(selectedEvaluation.total_score)}%
                                        </span>
                                    </div>
                                </div>

                                {selectedEvaluation.comments && (
                                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-100 text-sm">
                                        <span className="font-bold mr-2">Комментарий сотрудника:</span>
                                        {selectedEvaluation.comments}
                                    </div>
                                )}

                                {selectedEvaluation.reviewer_note && !isReviewMode && (
                                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg border border-yellow-100 text-sm">
                                        <span className="font-bold mr-2">Заметка проверяющего:</span>
                                        {selectedEvaluation.reviewer_note}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                {!isReviewMode && (
                                    <div className="flex justify-end gap-2">
                                        <Button onClick={() => setIsReviewMode(true)} variant="outline">
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                            Начать проверку
                                        </Button>
                                    </div>
                                )}

                                {/* Items List */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        Детализация пунктов
                                        {isReviewMode && <Badge className="bg-purple-100 text-purple-700">Режим ревью</Badge>}
                                    </h3>
                                    
                                    <div className="space-y-3">
                                        {selectedEvaluation.responses?.map((response, index) => {
                                            const photos = response.photo_urls && response.photo_urls.length > 0
                                                ? response.photo_urls
                                                : response.photo_url
                                                    ? [response.photo_url]
                                                    : []
                                            
                                            // Review state for this item
                                            const reviewState = reviewItems[response.id] || { is_accepted: true, admin_comment: '' }
                                            const isAccepted = isReviewMode ? reviewState.is_accepted : (response.is_accepted !== false)
                                            const adminComment = isReviewMode ? reviewState.admin_comment : response.admin_comment

                                            return (
                                            <div key={index} className={`border rounded-xl p-4 transition-all ${!isAccepted ? 'bg-red-50 border-red-200' : 'bg-card'}`}>
                                                <div className="flex justify-between items-start mb-2 gap-4">
                                                    <div className="flex-1">
                                                        <p className={`font-medium ${!isAccepted ? 'text-red-700' : ''}`}>{response.item_content}</p>
                                                        {response.comment && (
                                                            <p className="text-sm text-muted-foreground mt-1 bg-muted/50 p-2 rounded inline-block">
                                                                💬 {response.comment}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        {response.score > 0 ? (
                                                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Выполнено</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Не выполнено</Badge>
                                                        )}
                                                        
                                                        {isReviewMode && (
                                                            <div className="flex items-center gap-1 mt-1 bg-white p-1 rounded border shadow-sm">
                                                                <Button 
                                                                    size="sm" 
                                                                    variant={isAccepted ? "default" : "ghost"} 
                                                                    className={`h-7 px-2 ${isAccepted ? 'bg-green-600 hover:bg-green-700' : 'text-muted-foreground'}`}
                                                                    onClick={() => handleReviewItemChange(response.id, 'is_accepted', true)}
                                                                >
                                                                    <CheckCircle className="h-3 w-3 mr-1" /> OK
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant={!isAccepted ? "destructive" : "ghost"} 
                                                                    className={`h-7 px-2 ${!isAccepted ? '' : 'text-muted-foreground'}`}
                                                                    onClick={() => handleReviewItemChange(response.id, 'is_accepted', false)}
                                                                >
                                                                    <XCircle className="h-3 w-3 mr-1" /> Нет
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Photos */}
                                                {photos.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {photos.map((url, photoIndex) => (
                                                            <div key={photoIndex} className="relative group">
                                                                <img 
                                                                    src={url} 
                                                                    className="h-16 w-16 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity" 
                                                                    onClick={() => setPhotoPreviewUrl(url)}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Admin Comment Section */}
                                                {(isReviewMode && !isAccepted) || (!isReviewMode && adminComment) ? (
                                                    <div className="mt-3 pt-3 border-t border-red-100">
                                                        <Label className="text-xs text-red-600 mb-1 block font-bold">Причина отклонения:</Label>
                                                        {isReviewMode ? (
                                                            <Input 
                                                                value={reviewState.admin_comment} 
                                                                onChange={(e) => handleReviewItemChange(response.id, 'admin_comment', e.target.value)}
                                                                placeholder="Почему пункт отклонен?"
                                                                className="h-8 text-sm bg-white"
                                                            />
                                                        ) : (
                                                            <p className="text-sm text-red-800 bg-white/50 p-2 rounded border border-red-100">
                                                                {adminComment}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : null}
                                            </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Review Footer */}
                                {isReviewMode && (
                                    <div className="sticky bottom-0 bg-background pt-4 border-t mt-6 space-y-4">
                                        <div>
                                            <Label>Общий комментарий к проверке</Label>
                                            <Textarea 
                                                value={reviewerNote} 
                                                onChange={(e) => setReviewerNote(e.target.value)}
                                                placeholder="Итог проверки, рекомендации..."
                                                className="mt-1"
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <Button variant="outline" className="flex-1" onClick={() => setIsReviewMode(false)}>
                                                Отмена
                                            </Button>
                                            <Button 
                                                className="flex-1 bg-red-600 hover:bg-red-700" 
                                                onClick={() => submitReview('rejected')}
                                                disabled={isSubmittingReview}
                                            >
                                                С замечаниями
                                            </Button>
                                            <Button 
                                                className="flex-1 bg-green-600 hover:bg-green-700" 
                                                onClick={() => submitReview('approved')}
                                                disabled={isSubmittingReview}
                                            >
                                                Принять (ОК)
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </DialogContent>
                </Dialog>

                <ImageViewer 
                    src={viewerImage} 
                    isOpen={viewerOpen} 
                    onClose={() => setViewerOpen(false)} 
                    images={currentTaskPhotos}
                    onNext={handleNextImage}
                    onPrev={handlePrevImage}
                />
                
                {photoPreviewUrl && (
                    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setPhotoPreviewUrl(null)}>
                        <img src={photoPreviewUrl} className="max-w-full max-h-full object-contain rounded" />
                        <button className="absolute top-4 right-4 text-white hover:text-gray-300">
                            <XCircle className="h-8 w-8" />
                        </button>
                    </div>
                )}
        </PageShell>
    )
}
