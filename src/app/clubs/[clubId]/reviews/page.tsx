"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, History, Camera, CheckCircle, XCircle, Filter, CheckCircle2, Eye, User, Layers, Calendar, ChevronDown, ChevronUp, Trash2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { ImageViewer } from "@/components/ui/image-viewer"
import { cn, isLaundryEquipmentType } from "@/lib/utils"
import { PageShell, PageHeader, PageToolbar, ToolbarGroup } from "@/components/layout/PageShell"

interface Evaluation {
    id: number
    template_name: string
    employee_name: string
    evaluator_name: string
    reviewer_name?: string
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
    reviewed_by?: string
    reviewer_name?: string
    reviewed_at?: string
}

interface VerificationTask {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type: string
    equipment_type_name?: string | null
    workstation_name: string | null
    zone_name: string | null
    task_type: string
    status: string
    verification_status: string
    due_date: string
    completed_at: string | null
    verified_at?: string | null
    rework_days?: number
    completed_by_name: string | null
    verified_by_name?: string | null
    photos: string[] | null
    notes: string | null
    verification_note?: string | null
    rejection_reason?: string | null
    bonus_earned: number
    kpi_points: number
    laundry_request_id?: string | null
    laundry_status?: string | null
    history?: VerificationTaskEvent[]
}

interface VerificationTaskEvent {
    id: number
    task_id: string
    cycle_no: number
    event_type: 'SUBMITTED' | 'RESUBMITTED' | 'REJECTED' | 'APPROVED'
    note?: string | null
    task_notes?: string | null
    photos?: string[] | null
    created_at: string
    actor_name?: string | null
}

interface ShiftReviewItem {
    id: string
    user_id: string
    employee_name: string
    check_in: string
    check_out: string | null
    total_hours: number | string | null
    cash_income: number | string | null
    card_income: number | string | null
    expenses: number | string | null
    report_comment: string | null
    report_data?: Record<string, any> | null
    has_owner_corrections?: boolean
    owner_correction_changes?: OwnerCorrectionChange[] | null
    owner_notes?: string | null
    status: string
    shift_type: string | null
}

interface OwnerCorrectionChange {
    field: string
    label: string
    before: any
    after: any
}

interface ShiftReportField {
    metric_key: string
    custom_label: string
    field_type: 'INCOME' | 'EXPENSE' | 'EXPENSE_LIST' | 'OTHER'
}

const getLaundryStatusLabel = (status?: string | null) => {
    switch (status) {
        case 'NEW': return 'Ожидает стирки'
        case 'SENT_TO_LAUNDRY': return 'В стирке'
        case 'READY_FOR_RETURN': return 'Готов к возврату'
        case 'RETURNED': return 'Возвращен'
        case 'CANCELLED': return 'Отменен'
        default: return 'Стирка'
    }
}

const getTaskHistoryEvents = (task: VerificationTask) => task.history || []

const getTaskSubmissionEvents = (task: VerificationTask) =>
    getTaskHistoryEvents(task).filter((event) => event.event_type === 'SUBMITTED' || event.event_type === 'RESUBMITTED')

const getLatestTaskSubmission = (task: VerificationTask) => {
    const submissions = getTaskSubmissionEvents(task)
    if (submissions.length > 0) return submissions[submissions.length - 1]

    if (task.completed_at || task.notes || (task.photos?.length || 0) > 0) {
        return {
            id: -1,
            task_id: task.id,
            cycle_no: 1,
            event_type: 'SUBMITTED' as const,
            task_notes: task.notes,
            photos: task.photos,
            created_at: task.completed_at || '',
            actor_name: task.completed_by_name || null,
        }
    }

    return null
}

const getPreviousTaskSubmission = (task: VerificationTask) => {
    const submissions = getTaskSubmissionEvents(task)
    return submissions.length > 1 ? submissions[submissions.length - 2] : null
}

const getLatestTaskRejection = (task: VerificationTask) => {
    const rejections = getTaskHistoryEvents(task).filter((event) => event.event_type === 'REJECTED')
    return rejections.length > 0 ? rejections[rejections.length - 1] : null
}

const formatTaskMessageStamp = (date?: string | null) => {
    if (!date) return null

    return format(new Date(date), 'dd.MM.yyyy в HH:mm', { locale: ru })
}

export default function ChecklistsPage({ params, searchParams }: { params: Promise<{ clubId: string }>, searchParams: Promise<{ tab?: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    
    // Checklists State
    const [history, setHistory] = useState<Evaluation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationDetail | null>(null)
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
    const [isReviewMode, setIsReviewMode] = useState(false)
    const [reviewItems, setReviewItems] = useState<Record<number, { is_accepted: boolean, admin_comment: string }>>({})
    const [reviewerNote, setReviewerNote] = useState('')
    const [isSubmittingReview, setIsSubmittingReview] = useState(false)
    const [deletingChecklistId, setDeletingChecklistId] = useState<number | null>(null)
    const [deleteChecklistTarget, setDeleteChecklistTarget] = useState<Evaluation | null>(null)
    const [restoringChecklistId, setRestoringChecklistId] = useState<number | null>(null)
    const [restoreChecklistTarget, setRestoreChecklistTarget] = useState<Evaluation | null>(null)

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
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [filterMonth, setFilterMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'))
    const [equipmentTab, setEquipmentTab] = useState<'active' | 'history'>('active')
    const [checklistsTab, setChecklistsTab] = useState<'active' | 'history'>('active')
    const [shifts, setShifts] = useState<ShiftReviewItem[]>([])
    const [isShiftsLoading, setIsShiftsLoading] = useState(true)
    const [isSubmittingShift, setIsSubmittingShift] = useState<string | null>(null)
    const [shiftsTab, setShiftsTab] = useState<'active' | 'history'>('active')
    const [filterShiftMonth, setFilterShiftMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'))
    const [shiftReportFields, setShiftReportFields] = useState<ShiftReportField[]>([])
    
    // Checklist Filters
    const [filterChecklistEmployee, setFilterChecklistEmployee] = useState<string>("all")
    const [filterChecklistStatus, setFilterChecklistStatus] = useState<string>("all")
    const [filterChecklistMonth, setFilterChecklistMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'))

    // Active Tab State (synced with URL)
    const [activeTab, setActiveTab] = useState("equipment")

    useEffect(() => {
        Promise.all([params, searchParams]).then(([p, sp]) => {
            setClubId(p.clubId)
            // Initial fetch based on default tabs
            fetchTasks(p.clubId, equipmentTab)
            fetchChecklists(p.clubId, checklistsTab)
            
            fetchShiftsForReview(p.clubId)

            if (sp.tab === 'equipment' || sp.tab === 'checklists' || sp.tab === 'shifts') {
                setActiveTab(sp.tab)
            }
        })
    }, [params, searchParams])

    useEffect(() => {
        setFilterStatus("all")
        setFilterZone("all")
        setFilterEmployee("all")
    }, [equipmentTab])

    const handleTabChange = (value: string) => {
        setActiveTab(value)
        // Update URL without refreshing
        const url = new URL(window.location.href)
        url.searchParams.set('tab', value)
        window.history.pushState({}, '', url.toString())
    }

    const fetchChecklists = async (id: string, status: 'active' | 'history' = 'active') => {
        setIsLoading(true)
        try {
            const query = status === 'history' ? '?status=history' : '?status=active'
            const res = await fetch(`/api/clubs/${id}/evaluations${query}`)
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

    const fetchTasks = async (id: string, status: 'active' | 'history' = 'active') => {
        setIsTasksLoading(true)
        try {
            const query = status === 'history' ? '?status=history' : ''
            const res = await fetch(`/api/clubs/${id}/equipment/verification/list${query}`)
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

    useEffect(() => {
        if (clubId) {
            fetchTasks(clubId, equipmentTab)
        }
    }, [equipmentTab, clubId])

    useEffect(() => {
        if (clubId) {
            fetchChecklists(clubId, checklistsTab)
        }
    }, [checklistsTab, clubId])

    const fetchShiftsForReview = async (id: string) => {
        setIsShiftsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${id}/shifts`)
            const data = await res.json()
            if (res.ok && Array.isArray(data?.shifts)) {
                setShifts(data.shifts)
            }
        } catch (error) {
            console.error("Error fetching shifts:", error)
        } finally {
            setIsShiftsLoading(false)
        }
    }

    const fetchShiftReportTemplate = async (id: string) => {
        try {
            const res = await fetch(`/api/clubs/${id}/settings/reports`)
            const data = await res.json()
            if (res.ok && data.currentTemplate) {
                const standardKeys = ['cash_income', 'card_income', 'expenses_cash', 'shift_comment', 'expenses']
                const customFields = data.currentTemplate.schema.filter((field: ShiftReportField) =>
                    !standardKeys.includes(field.metric_key) &&
                    !standardKeys.some(key => field.metric_key.includes(key))
                )
                setShiftReportFields(customFields)
            }
        } catch (error) {
            console.error("Error fetching shift report template:", error)
        }
    }

    useEffect(() => {
        if (clubId) {
            fetchShiftsForReview(clubId)
            fetchShiftReportTemplate(clubId)
        }
    }, [clubId])

    const handleVerifyShiftForReview = async (shift: ShiftReviewItem) => {
        setIsSubmittingShift(shift.id)
        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts/${shift.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'VERIFIED' })
            })

            if (res.ok) {
                await fetchShiftsForReview(clubId)
            } else {
                const data = await res.json()
                alert(data.error || 'Ошибка подтверждения смены')
            }
        } catch (error) {
            console.error("Error verifying shift:", error)
            alert('Ошибка подтверждения смены')
        } finally {
            setIsSubmittingShift(null)
        }
    }

    // --- Checklists Handlers ---

    const handleViewEvaluation = (evaluationId: number) => {
        router.push(`/clubs/${clubId}/reviews/${evaluationId}`)
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

    const handleDeleteChecklist = (evaluation: Evaluation, e?: React.MouseEvent) => {
        e?.stopPropagation()
        setDeleteChecklistTarget(evaluation)
    }

    const handleRestoreChecklist = (evaluation: Evaluation, e?: React.MouseEvent) => {
        e?.stopPropagation()
        setRestoreChecklistTarget(evaluation)
    }

    const confirmDeleteChecklist = async () => {
        if (!deleteChecklistTarget) return
        setDeletingChecklistId(deleteChecklistTarget.id)
        try {
            const res = await fetch(`/api/clubs/${clubId}/evaluations/${deleteChecklistTarget.id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                setHistory(prev => prev.filter(item => item.id !== deleteChecklistTarget.id))
                if (selectedEvaluation?.id === deleteChecklistTarget.id) {
                    setSelectedEvaluation(null)
                    setIsReviewMode(false)
                }
                setDeleteChecklistTarget(null)
            } else {
                alert("Ошибка при удалении")
            }
        } catch (error) {
            console.error("Error deleting checklist:", error)
            alert("Произошла ошибка")
        } finally {
            setDeletingChecklistId(null)
        }
    }

    const confirmRestoreChecklist = async () => {
        if (!restoreChecklistTarget) return
        setRestoringChecklistId(restoreChecklistTarget.id)
        try {
            const res = await fetch(`/api/clubs/${clubId}/evaluations/${restoreChecklistTarget.id}/restore`, {
                method: 'POST'
            })
            if (res.ok) {
                setHistory(prev => prev.filter(item => item.id !== restoreChecklistTarget.id))
                if (selectedEvaluation?.id === restoreChecklistTarget.id) {
                    setSelectedEvaluation(null)
                    setIsReviewMode(false)
                }
                setRestoreChecklistTarget(null)
            } else {
                alert("Ошибка при возврате")
            }
        } catch (error) {
            console.error("Error restoring checklist:", error)
            alert("Произошла ошибка")
        } finally {
            setRestoringChecklistId(null)
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

    const handleSendToLaundry = async (task: VerificationTask) => {
        setIsSubmittingTask(true)
        try {
            const decisionComment = comment.trim() || "Направлено в стирку"
            const laundryRes = await fetch(`/api/clubs/${clubId}/laundry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    equipment_id: task.equipment_id,
                    maintenance_task_id: task.id,
                    title: comment.trim() || 'Требует стирки',
                    description: decisionComment,
                    photos: task.photos || [],
                    source: 'INSPECTION_CENTER'
                })
            })

            if (!laundryRes.ok) {
                alert("Не удалось отправить коврик в стирку")
                return
            }

            const verifyRes = await fetch(`/api/clubs/${clubId}/equipment/maintenance/${task.id}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'APPROVE',
                    comment: decisionComment
                })
            })

            if (!verifyRes.ok) {
                alert("Стирка создана, но не удалось закрыть проверку")
                fetchTasks(clubId, equipmentTab)
                return
            }

            setTasks(prev => prev.filter(t => t.id !== task.id))
            if (expandedTaskId === task.id) {
                setExpandedTaskId(null)
                setComment("")
            }
        } catch (error) {
            console.error("Error sending to laundry:", error)
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
        const unique = new Set(tasks.map(t => {
            const name = t.completed_by_name || (t.verification_status === 'REJECTED' ? 'На доработке' : 'Неизвестный')
            return name
        }))
        return Array.from(unique).sort()
    }, [tasks])

    const months = useMemo(() => {
        const currentMonth = format(new Date(), 'yyyy-MM')
        const unique = new Set(
            tasks
                .map(t => t.completed_at || t.due_date)
                .filter(Boolean)
                .map(date => format(new Date(date), 'yyyy-MM'))
        )
        unique.add(currentMonth)
        return Array.from(unique).sort((a, b) => b.localeCompare(a))
    }, [tasks])

    const currentMonthIndex = useMemo(() => {
        return months.findIndex(m => m === filterMonth)
    }, [months, filterMonth])

    useEffect(() => {
        if (equipmentTab !== 'history') return
        if (!months.includes(filterMonth)) {
            const currentMonth = format(new Date(), 'yyyy-MM')
            setFilterMonth(months.includes(currentMonth) ? currentMonth : (months[0] || 'all'))
        }
    }, [equipmentTab, months, filterMonth])

    const groupedTasks = useMemo(() => {
        const filtered = tasks.filter(t => {
            if (filterZone !== "all" && (t.zone_name || 'Без зоны') !== filterZone) return false
            if (filterEmployee !== "all" && (t.completed_by_name || 'Неизвестный') !== filterEmployee) return false
            if (filterStatus !== "all" && t.verification_status !== filterStatus) return false
            if (equipmentTab === 'history' && filterMonth !== "all") {
                const dateValue = t.completed_at || t.due_date
                if (!dateValue) return false
                const monthKey = format(new Date(dateValue), 'yyyy-MM')
                if (monthKey !== filterMonth) return false
            }
            return true
        })

        const groups: Record<string, VerificationTask[]> = {}
        
        filtered.forEach(task => {
            const zone = task.zone_name || 'Общая зона'
            if (!groups[zone]) groups[zone] = []
            groups[zone].push(task)
        })

        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
    }, [tasks, filterZone, filterEmployee, filterStatus, filterMonth])

    // Stats
    const pendingEvaluations = history.filter(h => h.status === 'pending' || !h.status).length
    const pendingTasks = tasks.length

    // Filter checklists
    const filteredChecklists = useMemo(() => {
        return history.filter(item => {
            // Status filter
            if (filterChecklistStatus !== 'all') {
                if (filterChecklistStatus === 'approved' && item.status !== 'approved') return false
                if (filterChecklistStatus === 'rejected' && item.status !== 'rejected') return false
                if (filterChecklistStatus === 'pending' && item.status !== 'pending') return false
            }
    
            // Employee filter
            if (filterChecklistEmployee !== 'all') {
                if (item.employee_name !== filterChecklistEmployee) return false
            }
    
            // Month filter (only for history tab)
            if (checklistsTab === 'history' && filterChecklistMonth !== 'all') {
                const date = item.evaluation_date || item.created_at
                if (!date) return false
                const itemMonth = format(new Date(date), 'yyyy-MM')
                if (itemMonth !== filterChecklistMonth) return false
            }
    
            return true
        })
    }, [history, filterChecklistStatus, filterChecklistEmployee, filterChecklistMonth, checklistsTab])

    // Get available months for checklists
    const checklistMonths = useMemo(() => {
        // Collect months from history
        const months = Array.from(new Set(history
            .map(t => {
                const date = t.evaluation_date || t.created_at
                return date ? format(new Date(date), 'yyyy-MM') : null
            })
            .filter(Boolean) as string[]
        ))

        // Ensure current month is in the list
        const currentMonth = format(new Date(), 'yyyy-MM')
        if (!months.includes(currentMonth)) {
            months.push(currentMonth)
        }

        // Sort descending (newest first)
        return months.sort((a, b) => b.localeCompare(a))
    }, [history])

    // Update checklistMonthIndex when filter or list changes
    const checklistMonthIndex = checklistMonths.indexOf(filterChecklistMonth)

    // Ensure filterChecklistMonth is valid, otherwise set to first available (current/newest)
    useEffect(() => {
        if (checklistsTab === 'history' && checklistMonths.length > 0 && !checklistMonths.includes(filterChecklistMonth)) {
            setFilterChecklistMonth(checklistMonths[0])
        }
    }, [checklistMonths, filterChecklistMonth, checklistsTab])

    const filteredShifts = useMemo(() => {
        return shifts.filter((shift) => {
            const isIncoming = Boolean(shift.check_out) && shift.status !== 'VERIFIED'
            const isHistoryItem = shift.status === 'VERIFIED'

            if (shiftsTab === 'active' && !isIncoming) return false
            if (shiftsTab === 'history' && !isHistoryItem) return false

            if (filterShiftMonth !== 'all') {
                const monthKey = format(new Date(shift.check_in), 'yyyy-MM')
                if (monthKey !== filterShiftMonth) return false
            }

            return true
        })
    }, [shifts, shiftsTab, filterShiftMonth])

    const pendingShifts = useMemo(() => {
        return shifts.filter((shift) => {
            if (!shift.check_out || shift.status === 'VERIFIED') return false
            if (filterShiftMonth !== 'all') {
                const monthKey = format(new Date(shift.check_in), 'yyyy-MM')
                if (monthKey !== filterShiftMonth) return false
            }
            return true
        }).length
    }, [shifts, filterShiftMonth])

    const getShiftMetricValue = (shift: ShiftReviewItem, field: string) => {
        if (field === 'expenses' || field === 'cash_income' || field === 'card_income') {
            const keyMap: Record<string, string> = {
                expenses: 'expenses_cash',
                cash_income: 'cash_income',
                card_income: 'card_income',
            }

            const reportKey = keyMap[field]
            const reportVal = shift.report_data?.[reportKey]

            if (reportVal !== undefined) {
                if (Array.isArray(reportVal)) {
                    return reportVal.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0)
                }
                return parseFloat(String(reportVal)) || 0
            }

            return Number((shift as any)[field]) || 0
        }

        const val = shift.report_data?.[field]
        if (Array.isArray(val)) {
            return val.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0)
        }
        return parseFloat(String(val)) || 0
    }

    const formatShiftMoney = (amount: number | string | any[] | null | undefined) => {
        if (amount === null || amount === undefined) return '0 ₽'

        let num: number
        if (Array.isArray(amount)) {
            num = amount.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0)
        } else {
            num = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
        }

        if (Number.isNaN(num) || num === 0) return '0 ₽'
        return `${num.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`
    }

    const formatShiftCorrectionValue = (change: OwnerCorrectionChange, value: any) => {
        if (value === null || value === undefined || value === '') return '—'

        if (change.field === 'check_in' || change.field === 'check_out') {
            return format(new Date(value), 'dd.MM.yyyy HH:mm', { locale: ru })
        }

        if (change.field === 'shift_type') {
            return value === 'NIGHT' ? 'Ночная' : value === 'DAY' ? 'Дневная' : String(value)
        }

        if (change.field === 'total_hours') {
            const numericValue = Number(value)
            return Number.isNaN(numericValue) ? String(value) : `${numericValue.toFixed(1)} ч`
        }

        if (change.field === 'cash_income' || change.field === 'card_income' || change.field === 'expenses') {
            return formatShiftMoney(value)
        }

        if (Array.isArray(value)) {
            const total = value.reduce((sum, item: any) => sum + (Number(item?.amount) || 0), 0)
            const details = value
                .map((item: any) => item?.comment ? `${item.amount} ₽ (${item.comment})` : `${item?.amount ?? 0} ₽`)
                .join(', ')
            return details ? `${formatShiftMoney(total)}: ${details}` : formatShiftMoney(total)
        }

        if (typeof value === 'object') {
            return JSON.stringify(value)
        }

        return String(value)
    }

    const shiftMonths = useMemo(() => {
        const months = Array.from(new Set(
            shifts
                .map((shift) => format(new Date(shift.check_in), 'yyyy-MM'))
        ))

        const currentMonth = format(new Date(), 'yyyy-MM')
        if (!months.includes(currentMonth)) {
            months.push(currentMonth)
        }

        return months.sort((a, b) => b.localeCompare(a))
    }, [shifts])

    const currentShiftMonthIndex = shiftMonths.indexOf(filterShiftMonth)

    useEffect(() => {
        if (shiftsTab === 'history' && shiftMonths.length > 0 && !shiftMonths.includes(filterShiftMonth)) {
            setFilterShiftMonth(shiftMonths[0])
        }
    }, [shiftMonths, filterShiftMonth, shiftsTab])

    return (
        <PageShell maxWidth="6xl">
            <PageHeader 
                title="Центр проверок" 
                description="Единый центр контроля качества и выполненных работ"
            />

            <Tabs defaultValue="equipment" value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="border-b mb-6 overflow-x-auto">
                    <TabsList className="bg-transparent h-auto p-0 space-x-6 min-w-max">
                        <TabsTrigger value="equipment" variant="underline" className="pb-3 rounded-none">
                            Оборудование
                            {pendingTasks > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-slate-100">{pendingTasks}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="checklists" variant="underline" className="pb-3 rounded-none">
                            Чеклист
                            {pendingEvaluations > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-slate-100">{pendingEvaluations}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="shifts" variant="underline" className="pb-3 rounded-none">
                            Смены
                            {pendingShifts > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-slate-100">{pendingShifts}</Badge>}
                        </TabsTrigger>
                    </TabsList>
                </div>

                    {/* EQUIPMENT TAB */}
                    <TabsContent value="equipment">
                        <div className="space-y-6">
                            <Tabs value={equipmentTab} onValueChange={(v) => setEquipmentTab(v as 'active' | 'history')} className="w-full">
                                <TabsList className="w-full sm:w-auto grid grid-cols-2">
                                    <TabsTrigger value="active">Входящие</TabsTrigger>
                                    <TabsTrigger value="history">История</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            {/* Filters */}
                            {tasks.length > 0 && (
                                <PageToolbar>
                                    <ToolbarGroup className="w-full sm:w-auto">
                                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                                    <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-muted/50 border-transparent hover:bg-muted transition-colors flex-1 min-w-0">
                                                        <div className="flex items-center truncate">
                                                            <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                            <SelectValue placeholder="Статус" />
                                                        </div>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">Все статусы</SelectItem>
                                                        {equipmentTab === 'active' ? (
                                                            <>
                                                                <SelectItem value="PENDING">Ожидает</SelectItem>
                                                                <SelectItem value="REJECTED">На доработке</SelectItem>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <SelectItem value="APPROVED">Одобрено</SelectItem>
                                                            </>
                                                        )}
                                                    </SelectContent>
                                                </Select>

                                                {equipmentTab === 'active' && (
                                                    <Select value={filterZone} onValueChange={setFilterZone}>
                                                        <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-muted/50 border-transparent hover:bg-muted transition-colors flex-1 min-w-0">
                                                            <div className="flex items-center truncate">
                                                                <Layers className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                                <SelectValue placeholder="Зона" />
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">Все зоны</SelectItem>
                                                            {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                )}

                                                <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                                                    <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-muted/50 border-transparent hover:bg-muted transition-colors flex-1 min-w-0">
                                                        <div className="flex items-center truncate">
                                                            <User className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                            <SelectValue placeholder="Сотрудник" />
                                                        </div>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">Все сотрудники</SelectItem>
                                                        {employees.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {equipmentTab === 'history' && (
                                                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 h-9 border border-transparent w-full sm:w-[280px]">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => {
                                                            const nextIndex = currentMonthIndex + 1
                                                            if (nextIndex < months.length) {
                                                                setFilterMonth(months[nextIndex])
                                                            }
                                                        }}
                                                        disabled={currentMonthIndex === -1 || currentMonthIndex >= months.length - 1}
                                                    >
                                                        <ChevronLeft className="h-4 w-4" />
                                                    </Button>
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        <span className="text-sm font-medium truncate">
                                                            {filterMonth === 'all' ? 'Все месяцы' : format(new Date(`${filterMonth}-01`), 'MMMM yyyy', { locale: ru })}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => {
                                                            const nextIndex = currentMonthIndex - 1
                                                            if (nextIndex >= 0) {
                                                                setFilterMonth(months[nextIndex])
                                                            }
                                                        }}
                                                        disabled={currentMonthIndex <= 0}
                                                    >
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </ToolbarGroup>
                                    <ToolbarGroup align="end" className="gap-2">
                                        <div className="text-sm text-muted-foreground">
                                            Показано: <span className="font-medium text-foreground">{groupedTasks.reduce((acc, [_, tasks]) => acc + tasks.length, 0)}</span> задач
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => fetchTasks(clubId, equipmentTab)} 
                                            disabled={isTasksLoading}
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        >
                                            <RotateCcw className={cn("h-4 w-4", isTasksLoading && "animate-spin")} />
                                        </Button>
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
                                        <div key={zoneName} className="space-y-3 pb-24">
                                            <div className="flex items-center gap-2 pb-2 border-b">
                                                <Layers className="h-5 w-5 text-slate-500" />
                                                <h2 className="text-xl font-semibold text-slate-800">{zoneName}</h2>
                                                <Badge variant="secondary" className="ml-2">{zoneTasks.length}</Badge>
                                            </div>
                                            
                                            <div className="flex flex-col gap-0 sm:gap-3 -mx-4 sm:mx-0">
                                                {zoneTasks.map((task) => {
                                                    const isExpanded = expandedTaskId === task.id
                                                    const isLaundryItem = isLaundryEquipmentType(task.equipment_type)
                                                    const latestSubmission = getLatestTaskSubmission(task)
                                                    const previousSubmission = getPreviousTaskSubmission(task)
                                                    const latestRejection = getLatestTaskRejection(task)
                                                    return (
                                                        <div 
                                                            key={task.id} 
                                                            className={cn(
                                                                "bg-white transition-all",
                                                                // Mobile: flat list style
                                                                "border-b last:border-0",
                                                                // Desktop: card style
                                                                "sm:border sm:rounded-xl sm:shadow-sm sm:overflow-hidden sm:mb-3",
                                                                isExpanded ? "sm:ring-0 sm:border-slate-300" : "sm:hover:border-slate-300"
                                                            )}
                                                        >
                                                            {/* Summary Row */}
                                                            <div 
                                                                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors gap-4"
                                                                onClick={() => toggleExpand(task.id)}
                                                            >
                                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                                    
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="font-semibold text-base truncate">{task.equipment_name}</span>
                                                                            {isLaundryItem && (
                                                                                <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                                                                                    Коврик
                                                                                </Badge>
                                                                            )}
                                                                            {task.laundry_status && (
                                                                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">
                                                                                    {getLaundryStatusLabel(task.laundry_status)}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                                                            {task.workstation_name && (
                                                                                <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                                                                    {task.workstation_name}
                                                                                </span>
                                                                            )}
                                                                            <span className="text-xs text-slate-400">•</span>
                                                                            <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                                                                                {task.equipment_type_name || task.equipment_type || 'Устройство'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between sm:justify-end gap-6 sm:mr-4 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 mt-1 sm:mt-0">
                                                                        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-0 text-left sm:text-right">
                                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                                <span className="text-sm font-medium text-slate-700">
                                                                                    {task.completed_by_name?.split(' ')[0] || (task.verification_status === 'REJECTED' ? 'На доработке' : '—')}
                                                                                </span>
                                                                            </div>
                                                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                                                            <span>
                                                                                {task.completed_at 
                                                                                    ? format(new Date(task.completed_at), 'dd.MM в HH:mm', { locale: ru }) 
                                                                                    : task.verified_at
                                                                                        ? `Отклонен ${format(new Date(task.verified_at), 'dd.MM в HH:mm', { locale: ru })}`
                                                                                        : '-'}
                                                                            </span>
                                                                        </div>
                                                                        {task.verification_status === 'APPROVED' && (
                                                                            <div className="mt-1">
                                                                                <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 border-0 h-5 px-1.5 text-[10px]">
                                                                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Одобрено
                                                                                </Badge>
                                                                            </div>
                                                                        )}
                                                                        {task.verification_status === 'REJECTED' && (
                                                                            <div className="mt-1">
                                                                                <Badge variant="destructive" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 h-5 px-1.5 text-[10px]">
                                                                                    <RotateCcw className="h-3 w-3 mr-1" /> На доработке {task.rework_days || 0} дн.
                                                                                </Badge>
                                                                            </div>
                                                                        )}
                                                                        {task.verification_status === 'PENDING' && (
                                                                            <div className="mt-1">
                                                                                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 h-5 px-1.5 text-[10px]">
                                                                                    <History className="h-3 w-3 mr-1" /> Ожидает
                                                                                </Badge>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-4">
                                                                        {task.photos && task.photos.length > 0 && (
                                                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                                                                            <Camera className="h-3.5 w-3.5" />
                                                                            <span className="text-xs font-bold">{task.photos.length}</span>
                                                                        </div>
                                                                    )}
                                                                        <div className="sm:hidden text-muted-foreground">
                                                                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="hidden sm:flex items-center gap-3 pl-4 border-l">
                                                                    {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                                                                </div>
                                                            </div>

                                                            {/* Expanded Details */}
                                                            {isExpanded && (
                                                                <div className="border-t bg-white p-6 sm:px-8 pb-8 animate-in slide-in-from-top-2 duration-200">
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                        {/* Photos */}
                                                                        <div className="space-y-5">
                                                                            <div className={cn("grid gap-4", previousSubmission ? "xl:grid-cols-2" : "grid-cols-1")}>
                                                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                                                                                    <div className="flex items-start justify-between gap-3">
                                                                                        <div>
                                                                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                                                                <Eye className="h-3 w-3" /> Текущий фотоотчет
                                                                                            </h4>
                                                                                            <p className="mt-1 text-sm font-medium text-slate-900">
                                                                                                {latestSubmission?.event_type === 'RESUBMITTED' ? 'После доработки' : 'Первая отправка'}
                                                                                            </p>
                                                                                        </div>
                                                                                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                                                                                            {latestSubmission?.photos?.length || 0} фото
                                                                                        </Badge>
                                                                                    </div>

                                                                                    <div className="rounded-xl bg-white p-3 border space-y-3">
                                                                                        {latestSubmission?.photos && latestSubmission.photos.length > 0 ? (
                                                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                                                {latestSubmission.photos.map((photo, i) => (
                                                                                                    <div
                                                                                                        key={i}
                                                                                                        className="group relative aspect-video bg-white rounded-lg overflow-hidden border shadow-sm cursor-zoom-in hover:ring-2 ring-primary/50 transition-all"
                                                                                                        onClick={(e) => openImage(photo, latestSubmission.photos || [], e)}
                                                                                                    >
                                                                                                        <img
                                                                                                            src={photo}
                                                                                                            alt={`Фото ${i + 1}`}
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

                                                                                        {latestSubmission?.task_notes && (
                                                                                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                                                                                <div className="mb-1 flex items-start justify-between gap-3">
                                                                                                    <span className="font-medium">Комментарий сотрудника</span>
                                                                                                    {formatTaskMessageStamp(latestSubmission.created_at) && (
                                                                                                        <span className="shrink-0 text-[11px] text-slate-400">
                                                                                                            {formatTaskMessageStamp(latestSubmission.created_at)}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                                <p>{latestSubmission.task_notes}</p>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                {previousSubmission && (
                                                                                    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-4">
                                                                                        <div className="flex items-start justify-between gap-3">
                                                                                            <div>
                                                                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-2">
                                                                                                    <History className="h-3 w-3" /> До доработки
                                                                                                </h4>
                                                                                                <p className="mt-1 text-sm font-medium text-amber-900">
                                                                                                    Предыдущая отправка на проверку
                                                                                                </p>
                                                                                            </div>
                                                                                            <Badge variant="outline" className="border-amber-200 bg-white text-amber-700">
                                                                                                {previousSubmission.photos?.length || 0} фото
                                                                                            </Badge>
                                                                                        </div>

                                                                                        <div className="rounded-xl bg-white/80 p-3 border border-amber-200 space-y-3">
                                                                                            {previousSubmission.photos && previousSubmission.photos.length > 0 ? (
                                                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                                                    {previousSubmission.photos.map((photo, i) => (
                                                                                                        <div
                                                                                                            key={i}
                                                                                                            className="group relative aspect-video bg-white rounded-lg overflow-hidden border shadow-sm cursor-zoom-in hover:ring-2 ring-amber-300 transition-all"
                                                                                                            onClick={(e) => openImage(photo, previousSubmission.photos || [], e)}
                                                                                                        >
                                                                                                            <img
                                                                                                                src={photo}
                                                                                                                alt={`Фото до доработки ${i + 1}`}
                                                                                                                className="w-full h-full object-cover"
                                                                                                            />
                                                                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                                                                                <Eye className="text-white drop-shadow-md h-6 w-6" />
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="h-20 flex items-center justify-center border border-dashed border-amber-200 rounded-lg text-amber-700/70 text-sm">
                                                                                                    Ранее фото не были приложены
                                                                                                </div>
                                                                                            )}

                                                                                            {previousSubmission.task_notes && (
                                                                                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                                                                                    <div className="mb-1 flex items-start justify-between gap-3">
                                                                                                        <span className="font-medium">Комментарий до доработки</span>
                                                                                                        {formatTaskMessageStamp(previousSubmission.created_at) && (
                                                                                                            <span className="shrink-0 text-[11px] text-amber-700/60">
                                                                                                                {formatTaskMessageStamp(previousSubmission.created_at)}
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <p>{previousSubmission.task_notes}</p>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Actions & Comments */}
                                                                        <div className="space-y-4">
                                                                            {latestRejection?.note && (
                                                                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 shadow-sm">
                                                                                    <div className="mb-2 flex items-start justify-between gap-3">
                                                                                        <div className="text-[10px] text-amber-600 uppercase tracking-wider font-bold">Ранее отправлено на доработку</div>
                                                                                        {formatTaskMessageStamp(latestRejection.created_at) && (
                                                                                            <span className="shrink-0 text-[11px] text-amber-700/60">
                                                                                                {formatTaskMessageStamp(latestRejection.created_at)}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <p className="text-sm text-amber-800 italic">"{latestRejection.note}"</p>
                                                                                </div>
                                                                            )}

                                                                            <div className="space-y-2">
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                                                        {equipmentTab === 'active' ? 'Причина возврата' : 'Комментарий к решению'}
                                                                                    </div>
                                                                                    {task.verified_by_name && (
                                                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-slate-50 px-1.5 py-0.5 rounded">
                                                                                            <User className="h-3 w-3" />
                                                                                            <span>{task.verified_by_name}</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <Textarea 
                                                                                    placeholder={equipmentTab === 'active' ? "Опишите, что нужно исправить..." : "Комментарий отсутствует"} 
                                                                                    value={equipmentTab === 'active' ? comment : (latestRejection?.note || task.verification_note || '')}
                                                                                    onChange={(e) => setComment(e.target.value)}
                                                                                    className="bg-white min-h-[80px] resize-none text-sm"
                                                                                    disabled={equipmentTab === 'history'}
                                                                                />
                                                                            </div>

                                                                            {equipmentTab === 'active' && (
                                                                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                                                                    {isLaundryItem && (
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            className="w-full sm:flex-1 border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 h-12 md:h-9 font-semibold"
                                                                                            onClick={() => handleSendToLaundry(task)}
                                                                                            disabled={isSubmittingTask || Boolean(task.laundry_request_id)}
                                                                                        >
                                                                                            {task.laundry_request_id ? getLaundryStatusLabel(task.laundry_status) : 'Отправить в стирку'}
                                                                                        </Button>
                                                                                    )}
                                                                                    <Button 
                                                                                        variant="outline" 
                                                                                        className="w-full sm:flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-12 md:h-9 font-semibold"
                                                                                        onClick={() => handleVerifyTask(task, 'REJECT')}
                                                                                        disabled={isSubmittingTask || !comment.trim()}
                                                                                    >
                                                                                        На доработку
                                                                                    </Button>
                                                                                    <Button 
                                                                                        className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 text-white shadow-sm h-12 md:h-9 font-semibold" 
                                                                                        onClick={() => handleVerifyTask(task, 'APPROVE')}
                                                                                        disabled={isSubmittingTask || Boolean(comment.trim())}
                                                                                    >
                                                                                        Одобрить
                                                                                    </Button>
                                                                                </div>
                                                                            )}
                                                                            
                                                                            <div className="flex justify-center pt-2 pb-2">
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

                    <TabsContent value="shifts">
                        <div className="space-y-6">
                            <Tabs value={shiftsTab} onValueChange={(v) => setShiftsTab(v as 'active' | 'history')} className="w-full">
                                <TabsList className="w-full sm:w-auto grid grid-cols-2">
                                    <TabsTrigger value="active">Входящие</TabsTrigger>
                                    <TabsTrigger value="history">История</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <PageToolbar>
                                <ToolbarGroup className="w-full sm:w-auto">
                                    <div className="flex w-full">
                                        <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 h-9 border border-transparent w-full sm:w-[280px]">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => {
                                                    const nextIndex = currentShiftMonthIndex + 1
                                                    if (nextIndex < shiftMonths.length) {
                                                        setFilterShiftMonth(shiftMonths[nextIndex])
                                                    }
                                                }}
                                                disabled={currentShiftMonthIndex === -1 || currentShiftMonthIndex >= shiftMonths.length - 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                <span className="text-sm font-medium truncate">
                                                    {format(new Date(`${filterShiftMonth}-01`), 'MMMM yyyy', { locale: ru })}
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => {
                                                    const nextIndex = currentShiftMonthIndex - 1
                                                    if (nextIndex >= 0) {
                                                        setFilterShiftMonth(shiftMonths[nextIndex])
                                                    }
                                                }}
                                                disabled={currentShiftMonthIndex <= 0}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </ToolbarGroup>
                                <ToolbarGroup align="end" className="gap-2">
                                    <div className="text-sm text-muted-foreground">
                                        Показано: <span className="font-medium text-foreground">{filteredShifts.length}</span> смен
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => fetchShiftsForReview(clubId)}
                                        disabled={isShiftsLoading}
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    >
                                        <RotateCcw className={cn("h-4 w-4", isShiftsLoading && "animate-spin")} />
                                    </Button>
                                </ToolbarGroup>
                            </PageToolbar>

                            {isShiftsLoading ? (
                                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
                            ) : filteredShifts.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                                    <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4 opacity-50" />
                                    <h3 className="text-lg font-medium text-foreground">
                                        {shiftsTab === 'active' ? 'Нет смен на подтверждение' : 'Нет подтвержденных смен'}
                                    </h3>
                                    <p>
                                        {shiftsTab === 'active'
                                            ? 'Все закрытые смены уже подтверждены или еще не завершены.'
                                            : 'В выбранном месяце пока нет подтвержденных смен.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3 pb-24">
                                    {filteredShifts.map((shift) => {
                                        const cashIncome = getShiftMetricValue(shift, 'cash_income')
                                        const cardIncome = getShiftMetricValue(shift, 'card_income')
                                        const expenses = getShiftMetricValue(shift, 'expenses')
                                        const customIncome = shiftReportFields
                                            .filter((field) => field.field_type === 'INCOME')
                                            .reduce((sum, field) => sum + getShiftMetricValue(shift, field.metric_key), 0)
                                        const totalIncome = cashIncome + cardIncome + customIncome

                                        return (
                                            <Card key={shift.id} className="shadow-sm">
                                                <CardContent className="p-4 sm:p-5">
                                                    <div className="space-y-4">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-semibold text-base">{shift.employee_name}</span>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {shift.shift_type === 'NIGHT' ? 'Ночная' : 'Дневная'}
                                                                    </Badge>
                                                                    {shift.status === 'VERIFIED' ? (
                                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">Подтверждена</Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Ожидает подтверждения</Badge>
                                                                    )}
                                                                    {shift.has_owner_corrections && (
                                                                        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-0">
                                                                            Есть правки владельца
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                                                    <span>{format(new Date(shift.check_in), 'dd.MM.yyyy', { locale: ru })}</span>
                                                                    <span>
                                                                        {format(new Date(shift.check_in), 'HH:mm')} - {shift.check_out ? format(new Date(shift.check_out), 'HH:mm') : '...'}
                                                                    </span>
                                                                    <span>{Number(shift.total_hours || 0).toFixed(1)} ч</span>
                                                                </div>
                                                            </div>
                                                            <div className="shrink-0 rounded-lg border bg-muted/20 px-3 py-2 text-right">
                                                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Итого</div>
                                                                <div className="text-lg font-bold text-green-600 tabular-nums">{formatShiftMoney(totalIncome)}</div>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                                                <div className="rounded-md bg-muted/20 p-2">
                                                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Наличные</div>
                                                                    <div className="text-sm font-medium tabular-nums">{formatShiftMoney(cashIncome)}</div>
                                                                </div>
                                                                <div className="rounded-md bg-muted/20 p-2">
                                                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Безнал</div>
                                                                    <div className="text-sm font-medium tabular-nums">{formatShiftMoney(cardIncome)}</div>
                                                                </div>
                                                                <div className="rounded-md bg-muted/20 p-2">
                                                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Расходы</div>
                                                                    <div className="text-sm font-medium text-orange-600 tabular-nums">{formatShiftMoney(expenses)}</div>
                                                                </div>
                                                                <div className="rounded-md bg-muted/20 p-2">
                                                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Часы</div>
                                                                    <div className="text-sm font-medium tabular-nums">
                                                                        {shift.total_hours && !Number.isNaN(Number(shift.total_hours))
                                                                            ? `${Number(shift.total_hours).toFixed(1)}ч`
                                                                            : '-'}
                                                                    </div>
                                                                </div>
                                                                {shiftReportFields.map((field) => {
                                                                    const raw = shift.report_data?.[field.metric_key]
                                                                    const parsed = parseFloat(String(raw))
                                                                    const value = raw === null || raw === undefined || raw === ''
                                                                        ? '-'
                                                                        : (!Number.isNaN(parsed) ? formatShiftMoney(parsed) : String(raw))

                                                                    return (
                                                                        <div key={field.metric_key} className="rounded-md bg-muted/20 p-2">
                                                                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                                                                                {field.custom_label}
                                                                            </div>
                                                                            <div className="text-sm font-medium tabular-nums">{value}</div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>

                                                        {shift.report_comment && (
                                                                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 border">
                                                                    {shift.report_comment}
                                                                </div>
                                                            )}
                                                            {shift.owner_notes && (
                                                                <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                                                                    <span className="font-medium">Заметка владельца:</span> {shift.owner_notes}
                                                                </div>
                                                            )}
                                                            {shift.has_owner_corrections && (
                                                                shift.owner_correction_changes && shift.owner_correction_changes.length > 0 ? (
                                                                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-3 text-sm text-orange-900">
                                                                        <div className="mb-2 font-medium">Правки владельца</div>
                                                                        <div className="space-y-2">
                                                                            {shift.owner_correction_changes.slice(0, 3).map((change, index) => (
                                                                                <div key={`${change.field}-${index}`} className="rounded-md bg-white/80 px-2.5 py-2">
                                                                                    <div className="text-xs font-medium uppercase tracking-wide text-orange-700">{change.label}</div>
                                                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                                                        Было: <span className="text-foreground">{formatShiftCorrectionValue(change, change.before)}</span>
                                                                                    </div>
                                                                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                                                                        Стало: <span className="text-foreground">{formatShiftCorrectionValue(change, change.after)}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        {shift.owner_correction_changes.length > 3 && (
                                                                            <div className="mt-2 text-xs text-orange-700">
                                                                                И еще {shift.owner_correction_changes.length - 3} правки в карточке смены
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                                                                        Детализация правок для этой смены не сохранена, потому что она была изменена до добавления diff.
                                                                    </div>
                                                                )
                                                            )}

                                                        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                                                            <Button
                                                                variant="outline"
                                                                className="w-full sm:w-auto sm:min-w-[170px]"
                                                                onClick={() => router.push(`/clubs/${clubId}/shifts/${shift.id}?from=reviews`)}
                                                            >
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                Открыть смену
                                                            </Button>
                                                            {shift.status !== 'VERIFIED' && (
                                                                <Button
                                                                    className="w-full bg-green-600 text-white hover:bg-green-700 sm:w-auto sm:min-w-[170px]"
                                                                    onClick={() => handleVerifyShiftForReview(shift)}
                                                                    disabled={isSubmittingShift === shift.id}
                                                                >
                                                                    {isSubmittingShift === shift.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                                                    Подтвердить
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* HISTORY TAB (Checklists) */}
                    <TabsContent value="checklists">
                        <div className="space-y-6">
                            <Tabs value={checklistsTab} onValueChange={(v) => setChecklistsTab(v as 'active' | 'history')} className="w-full">
                                <TabsList className="w-full sm:w-auto grid grid-cols-2">
                                    <TabsTrigger value="active">Входящие</TabsTrigger>
                                    <TabsTrigger value="history">История</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            {/* Filters */}
                            <PageToolbar>
                                <ToolbarGroup className="w-full sm:w-auto">
                                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                                        
                                        {/* Month Filter for History */}
                                        {checklistsTab === 'history' && (
                                            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 h-9 border border-transparent w-full sm:w-[280px]">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => {
                                                        const nextIndex = checklistMonthIndex + 1
                                                        if (nextIndex < checklistMonths.length) {
                                                            setFilterChecklistMonth(checklistMonths[nextIndex])
                                                        }
                                                    }}
                                                    disabled={checklistMonthIndex === -1 || checklistMonthIndex >= checklistMonths.length - 1}
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                    <span className="text-sm font-medium truncate">
                                                        {filterChecklistMonth === 'all' ? 'Все месяцы' : format(new Date(`${filterChecklistMonth}-01`), 'MMMM yyyy', { locale: ru })}
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => {
                                                        const nextIndex = checklistMonthIndex - 1
                                                        if (nextIndex >= 0) {
                                                            setFilterChecklistMonth(checklistMonths[nextIndex])
                                                        }
                                                    }}
                                                    disabled={checklistMonthIndex <= 0}
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </ToolbarGroup>
                            </PageToolbar>

                            {/* Month Filter for History (Removed from separate block) */}

                            {/* Mobile Cards */}
                            <div className="sm:hidden flex flex-col gap-0 -mx-4">
                                {isLoading ? (
                                    <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
                                ) : filteredChecklists.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed mx-4">
                                        <History className="mx-auto h-12 w-12 opacity-20 mb-4" />
                                        <p>{checklistsTab === 'active' ? 'Нет проверок на рассмотрении' : 'История проверок пуста'}</p>
                                    </div>
                                ) : (
                                    filteredChecklists.map(evaluation => {
                                        const percent = Math.round((evaluation.total_score / (evaluation.max_score || 100)) * 100)
                                        return (
                                            <div key={evaluation.id} className="bg-white border-b last:border-0 p-4 active:bg-muted/50 transition-colors" onClick={() => handleViewEvaluation(evaluation.id)}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex flex-col">
                                                        <div className="font-semibold text-base">{evaluation.employee_name}</div>
                                                        <div className="text-xs text-muted-foreground">{evaluation.template_name}</div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <div className="flex items-center gap-2">
                                                            {getStatusBadge(evaluation.status)}
                                                            {checklistsTab === 'history' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-blue-500 hover:text-blue-600"
                                                                    onClick={(e) => handleRestoreChecklist(evaluation, e)}
                                                                    disabled={restoringChecklistId === evaluation.id}
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-red-500 hover:text-red-600"
                                                                onClick={(e) => handleDeleteChecklist(evaluation, e)}
                                                                disabled={deletingChecklistId === evaluation.id}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(evaluation.evaluation_date || evaluation.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/50">
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <User className="h-3.5 w-3.5" />
                                                        <span>{evaluation.reviewer_name || evaluation.evaluator_name || '—'}</span>
                                                    </div>
                                                    <div className={`font-bold text-lg ${percent >= 80 ? 'text-green-600' : percent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                        {percent}%
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            <Card className="hidden sm:block">
                                <CardContent className="p-0">
                                    {isLoading ? (
                                        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
                                    ) : filteredChecklists.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <History className="mx-auto h-12 w-12 opacity-20 mb-4" />
                                            <p>{checklistsTab === 'active' ? 'Нет проверок на рассмотрении' : 'История проверок пуста'}</p>
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
                                                    <TableHead className="text-right">Действия</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredChecklists.map(evaluation => (
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
                                                        <TableCell>{evaluation.reviewer_name || evaluation.evaluator_name || '—'}</TableCell>
                                                        <TableCell className="text-right">
                                                            <span className={`font-bold ${((evaluation.total_score / (evaluation.max_score || 100)) * 100) >= 80 ? 'text-green-600' : ((evaluation.total_score / (evaluation.max_score || 100)) * 100) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                                {Math.round((evaluation.total_score / (evaluation.max_score || 100)) * 100)}%
                                                            </span>
                                                        </TableCell>
                                                    <TableCell className="text-right">
                                                        {checklistsTab === 'history' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-blue-500 hover:text-blue-600"
                                                                onClick={(e) => handleRestoreChecklist(evaluation, e)}
                                                                disabled={restoringChecklistId === evaluation.id}
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-600"
                                                            onClick={(e) => handleDeleteChecklist(evaluation, e)}
                                                            disabled={deletingChecklistId === evaluation.id}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                </Tabs>

            <Dialog open={!!deleteChecklistTarget} onOpenChange={(open) => !open && setDeleteChecklistTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Удаление чеклиста</DialogTitle>
                        <DialogDescription>
                            Вы уверены, что хотите удалить этот чеклист? Это действие нельзя отменить.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteChecklistTarget(null)}>Отмена</Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteChecklist}
                            disabled={!!deletingChecklistId}
                        >
                            {deletingChecklistId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Удалить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!restoreChecklistTarget} onOpenChange={(open) => !open && setRestoreChecklistTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Вернуть чеклист</DialogTitle>
                        <DialogDescription>
                            Вернуть чеклист в активные? Он появится в разделе проверок.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRestoreChecklistTarget(null)}>Отмена</Button>
                        <Button
                            onClick={confirmRestoreChecklist}
                            disabled={!!restoringChecklistId}
                        >
                            {restoringChecklistId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Вернуть
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                        
                        {selectedEvaluation ? (
                            <div className="space-y-6">
                                {/* Header Info */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-xl border">
                                    <div>
                                        <p className="text-muted-foreground text-xs uppercase font-bold">Сотрудник</p>
                                        <p className="font-medium">{selectedEvaluation.employee_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs uppercase font-bold">Подтвердил</p>
                                        <p className="font-medium">{selectedEvaluation.reviewer_name || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs uppercase font-bold">Дата проверки</p>
                                        <p className="font-medium">{selectedEvaluation.reviewed_at ? new Date(selectedEvaluation.reviewed_at).toLocaleDateString() : '—'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-muted-foreground text-xs uppercase font-bold">Итоговый балл</p>
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-lg text-muted-foreground">
                                                {Math.round(selectedEvaluation.total_score)} <span className="text-sm">/ {Math.round(selectedEvaluation.max_score || 100)}</span>
                                            </span>
                                            <span className={`text-xl font-black ${((selectedEvaluation.total_score / (selectedEvaluation.max_score || 100)) * 100) >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
                                                {Math.round((selectedEvaluation.total_score / (selectedEvaluation.max_score || 100)) * 100)}%
                                            </span>
                                        </div>
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
                                                                    alt="Фото"
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
                        <img src={photoPreviewUrl} alt="Фото крупно" className="max-w-full max-h-full object-contain rounded" />
                        <button className="absolute top-4 right-4 text-white hover:text-gray-300">
                            <XCircle className="h-8 w-8" />
                        </button>
                    </div>
                )}
        </PageShell>
    )
}
