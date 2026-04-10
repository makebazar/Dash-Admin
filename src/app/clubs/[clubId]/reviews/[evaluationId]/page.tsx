"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, User, Calendar, Clock, Star } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { PageShell } from "@/components/layout/PageShell"
import { cn } from "@/lib/utils"
import { ImageViewer } from "@/components/ui/image-viewer"
import { Textarea } from "@/components/ui/textarea"

interface EvaluationResponse {
    id: number
    item_content: string
    description?: string
    score: number
    max_score: number
    comment?: string
    photo_url?: string
    photo_urls?: string[]
    is_accepted?: boolean
    admin_comment?: string
    weight?: number // Added for template weight
    options?: { label: string; score: number }[]
    related_entity_type?: string
    target_zone?: string
    selected_workstations?: string[]
}

interface EvaluationDetail {
    id: number
    template_name: string
    employee_name: string
    evaluator_name?: string
    reviewer_name?: string
    status: 'pending' | 'approved' | 'rejected'
    total_score: number
    max_score: number
    evaluation_date: string
    created_at: string
    responses: EvaluationResponse[]
    reviewer_note?: string
    employee_id: string
    evaluator_id?: string
}

export default function EvaluationDetailPage({ params }: { params: Promise<{ clubId: string; evaluationId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [evaluationId, setEvaluationId] = useState('')
    
    const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [reviewItems, setReviewItems] = useState<Record<number, { is_accepted: boolean, admin_comment: string, adjusted_score?: number, selected_issues?: string[] }>>({})
    const computedTotalScore = useMemo(() => {
        if (!evaluation) return 0
        return evaluation.responses.reduce((total, response) => {
            const itemScore = reviewItems[response.id]?.adjusted_score ?? response.score ?? 0
            return total + Number(itemScore || 0)
        }, 0)
    }, [evaluation, reviewItems])
    const [reviewerNote, setReviewerNote] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    const [viewerOpen, setViewerOpen] = useState(false)
    const [viewerImage, setViewerImage] = useState("")
    const [currentImages, setCurrentImages] = useState<string[]>([])

    const openImage = (src: string, images: string[]) => {
        setViewerImage(src)
        setCurrentImages(images)
        setViewerOpen(true)
    }

    const handleNextImage = () => {
        const currentIndex = currentImages.indexOf(viewerImage)
        if (currentIndex < currentImages.length - 1) {
            setViewerImage(currentImages[currentIndex + 1])
        }
    }

    const handlePrevImage = () => {
        const currentIndex = currentImages.indexOf(viewerImage)
        if (currentIndex > 0) {
            setViewerImage(currentImages[currentIndex - 1])
        }
    }

    const [workstations, setWorkstations] = useState<any[]>([])

    const parseIssuesFromComment = (comment?: string) => {
        if (!comment) return []
        if (comment.startsWith('Проблемы: ')) {
            return comment.replace('Проблемы: ', '').split(', ')
        }
        if (comment.startsWith('Проблемные: ')) {
            return comment.replace('Проблемные: ', '').split(', ')
        }
        return []
    }

    useEffect(() => {
        if (!evaluation || workstations.length === 0) return

        setReviewItems(prev => {
            const next = { ...prev }
            let hasChanges = false

            evaluation.responses.forEach(r => {
                const responseIssues = (Array.isArray(r.selected_workstations) && r.selected_workstations.length > 0)
                    ? r.selected_workstations
                    : parseIssuesFromComment(r.comment)
                if (r.related_entity_type === 'workstations' && responseIssues.length > 0) {
                    const currentAdjusted = next[r.id]?.adjusted_score
                    if (currentAdjusted !== undefined && currentAdjusted > 0) return

                    const issues = responseIssues
                    const targetZone = r.target_zone || 'all'
                    const totalWs = workstations.filter(w => !targetZone || targetZone === 'all' || w.zone === targetZone).length
                    const maxScore = r.max_score || 10
                    
                    if (totalWs > 0 && issues.length > 0) {
                        const penalty = maxScore / totalWs
                        const rawScore = maxScore - (issues.length * penalty)
                        const calculatedScore = Math.max(0, Math.round(rawScore * 10) / 10)
                        
                        // If the calculated score is different from what we have (undefined or 0), update it
                        if (currentAdjusted !== calculatedScore) {
                            next[r.id] = {
                                ...next[r.id],
                                adjusted_score: calculatedScore,
                                selected_issues: issues
                            }
                            hasChanges = true
                        }
                    }
                }
            })

            return hasChanges ? next : prev
        })
    }, [evaluation?.id, workstations.length])

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            setEvaluationId(p.evaluationId)
            fetchEvaluation(p.clubId, p.evaluationId)
            fetchWorkstations(p.clubId)
        })
    }, [params])

    const fetchWorkstations = async (cId: string) => {
        try {
            const res = await fetch(`/api/clubs/${cId}/workstations`)
            if (res.ok) {
                const data = await res.json()
                setWorkstations(data)
            }
        } catch (error) {
            console.error('Failed to fetch workstations:', error)
        }
    }

    const fetchEvaluation = async (cId: string, eId: string) => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${cId}/evaluations/${eId}`)
            const data = await res.json()
            if (res.ok) {
                setEvaluation(data)
                
                // Initialize review state
                const initialReviewState: Record<number, any> = {}
                data.responses.forEach((r: EvaluationResponse) => {
                    initialReviewState[r.id] = {
                        is_accepted: r.is_accepted !== false, // Default to true if not set
                        admin_comment: r.admin_comment || ''
                    }
                })
                setReviewItems(initialReviewState)
                setReviewerNote(data.reviewer_note || '')
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
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

    const toggleWorkstationIssue = (responseId: number, workstationName: string, maxScore: number, targetZone: string) => {
        if (isCompleted) return

        const responseData = evaluation?.responses.find(r => r.id === responseId)
        const responseIssues = (responseData && Array.isArray(responseData.selected_workstations) && responseData.selected_workstations.length > 0)
            ? responseData.selected_workstations
            : parseIssuesFromComment(responseData?.comment)
        const currentIssues = reviewItems[responseId]?.selected_issues ||
                            (reviewItems[responseId]?.selected_issues === undefined
                                ? responseIssues
                                : [])

        // 2. Toggle issue
        let newIssues
        if (currentIssues.includes(workstationName)) {
            newIssues = currentIssues.filter((ws: string) => ws !== workstationName)
        } else {
            newIssues = [...currentIssues, workstationName]
        }

        // 3. Calculate new score
        // We need total workstations in this zone to calculate price per error
        const totalWorkstationsInZone = workstations.filter(w => !targetZone || targetZone === 'all' || w.zone === targetZone).length
        const penaltyPerIssue = totalWorkstationsInZone > 0 ? (maxScore / totalWorkstationsInZone) : 0
        
        // If NO issues, score should be MAX. If issues, calculate penalty.
        // We calculate score from scratch based on issues count
        let newScore
        if (newIssues.length === 0) {
            newScore = maxScore
        } else {
            const rawScore = maxScore - (newIssues.length * penaltyPerIssue)
            // Round to 1 decimal place
            newScore = Math.max(0, Math.round(rawScore * 10) / 10)
        }

        // 4. Update state
        // Keep issues in separate field, do not overwrite comment
        setReviewItems(prev => ({
            ...prev,
            [responseId]: {
                ...prev[responseId],
                adjusted_score: newScore,
                selected_issues: newIssues
            }
        }))
    }

    const handleScoreChange = (responseId: number, newScore: number) => {
        // Round to 1 decimal
        const roundedScore = Math.round(newScore * 10) / 10
        setReviewItems(prev => ({
            ...prev,
            [responseId]: {
                ...prev[responseId],
                adjusted_score: roundedScore,
                // If score is changed, force admin comment requirement (can be handled in UI)
            }
        }))
    }

    const getStoredWorkstationIssues = (response: EvaluationResponse) => {
        if (Array.isArray(response.selected_workstations) && response.selected_workstations.length > 0) {
            return response.selected_workstations
        }
        return parseIssuesFromComment(response.comment)
    }

    const getWorkstationIssues = (response: EvaluationResponse) => {
        const selected = reviewItems[response.id]?.selected_issues
        if (selected) return selected
        if (Array.isArray(response.selected_workstations) && response.selected_workstations.length > 0) {
            return response.selected_workstations
        }
        return parseIssuesFromComment(response.comment)
    }

    const getWorkstationExpectedScore = (response: EvaluationResponse) => {
        if (response.related_entity_type !== 'workstations') return null
        if (workstations.length === 0) return null
        const issues = getWorkstationIssues(response)
        const targetZone = response.target_zone || 'all'
        const totalWs = workstations.filter(w => !targetZone || targetZone === 'all' || w.zone === targetZone).length
        if (totalWs <= 0) return null
        const maxScore = Number(response.max_score || 10)
        if (issues.length === 0) return maxScore
        const penalty = maxScore / totalWs
        const rawScore = maxScore - (issues.length * penalty)
        return Math.max(0, Math.round(rawScore * 10) / 10)
    }

    const issuesEqual = (a: string[], b: string[]) => {
        if (a.length !== b.length) return false
        const aSorted = [...a].sort()
        const bSorted = [...b].sort()
        return aSorted.every((value, index) => value === bSorted[index])
    }

    const handleSubmitReview = async (status: 'approved' | 'rejected') => {
        if (!evaluation) return
        setIsSubmitting(true)
        try {
            const hasMissingReason = evaluation.responses.some(r => {
                const adjustedScore = reviewItems[r.id]?.adjusted_score
                const scoreChanged = adjustedScore !== undefined && Number(adjustedScore) !== Number(r.score)
                const selectedIssues = reviewItems[r.id]?.selected_issues
                const issuesChanged = r.related_entity_type === 'workstations' && selectedIssues !== undefined
                    ? !issuesEqual(selectedIssues, getStoredWorkstationIssues(r))
                    : false
                const requiresReason = scoreChanged || issuesChanged
                if (!requiresReason) return false
                const comment = (reviewItems[r.id]?.admin_comment || '').trim()
                return comment.length === 0
            })

            if (hasMissingReason) {
                alert('Укажите причину для измененных пунктов')
                setIsSubmitting(false)
                return
            }

            // Collect all item reviews
            const itemReviews = evaluation.responses.map(r => ({
                response_id: r.id,
                is_accepted: true, // Always accepted in audit mode, but score might change
                admin_comment: reviewItems[r.id]?.admin_comment,
                adjusted_score: reviewItems[r.id]?.adjusted_score
            }))

            const res = await fetch(`/api/clubs/${clubId}/evaluations/${evaluationId}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'approved', // Always approved as "Audit Completed"
                    reviewer_note: reviewerNote,
                    item_reviews: itemReviews,
                    total_score: computedTotalScore
                })
            })

            if (res.ok) {
                router.push(`/clubs/${clubId}/reviews?tab=checklists`)
                router.refresh()
            } else {
                alert('Ошибка при сохранении')
            }
        } catch (error) {
            console.error(error)
            alert('Ошибка при сохранении')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <PageShell>
                <div className="flex justify-center items-center h-[50vh]">
                    <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
                </div>
            </PageShell>
        )
    }

    if (!evaluation) {
        return (
            <PageShell>
                <div className="text-center py-12">
                    <h2 className="text-xl font-semibold">Проверка не найдена</h2>
                    <Button variant="link" onClick={() => router.back()}>Назад</Button>
                </div>
            </PageShell>
        )
    }

    const getStatusBadge = (status?: string) => {
        switch (status) {
            case 'approved': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0"><CheckCircle2 className="w-3 h-3 mr-1" /> Одобрено</Badge>
            case 'rejected': return <Badge variant="outline" className="bg-red-100 text-red-700 hover:bg-red-100 border-0"><XCircle className="w-3 h-3 mr-1" /> Отклонено</Badge>
            default: return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-0"><Clock className="w-3 h-3 mr-1" /> На проверке</Badge>
        }
    }

    const maxScoreValue = Number(evaluation.max_score) || 0
    const totalScoreValue = Number(computedTotalScore || evaluation.total_score) || 0
    const formatScore = (value: number) => {
        if (!Number.isFinite(value)) return '0'
        const rounded = Math.round(value * 10) / 10
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
    }
    const totalScoreLabel = formatScore(totalScoreValue)
    const maxScoreLabel = formatScore(maxScoreValue)
    const scorePercentage = maxScoreValue > 0 ? Math.round((totalScoreValue / maxScoreValue) * 100) : 0
    const isCompleted = evaluation.status === 'approved' || evaluation.status === 'rejected'

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            {/* Mobile Header - Sticky */}
            <div className="sticky top-0 left-0 right-0 z-40 bg-white border-b px-4 py-3 flex items-center gap-3 md:hidden shadow-sm">
                <Button variant="ghost" size="icon" className="-ml-2 h-9 w-9 shrink-0" onClick={() => router.push(`/clubs/${clubId}/reviews?tab=checklists`)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-base font-semibold truncate leading-tight">{evaluation.template_name}</h1>
                </div>
                {/* Score Badge */}
                <div className="shrink-0 flex flex-col items-end bg-slate-50 px-2 py-1 rounded border border-slate-100">
                    <div className="text-sm font-bold leading-none text-slate-900">
                        {totalScoreLabel}
                        <span className="text-slate-400 text-[10px] font-normal ml-0.5">/ {maxScoreLabel}</span>
                    </div>
                    <div className={cn("text-[9px] font-bold mt-0.5", scorePercentage >= 80 ? "text-slate-900" : scorePercentage >= 50 ? "text-amber-600" : "text-red-600")}>
                        {scorePercentage}%
                    </div>
                </div>
            </div>

            <PageShell maxWidth="4xl" className="pt-4 md:pt-8">
                {/* Desktop Header & Meta Info */}
                <div className="mb-6 space-y-4">
                    {/* Desktop Top Row */}
                    <div className="hidden md:flex items-start gap-3">
                        <Button variant="ghost" size="icon" className="-ml-2 h-8 w-8 shrink-0 mt-0.5" onClick={() => router.push(`/clubs/${clubId}/reviews?tab=checklists`)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl font-bold leading-tight mb-1">{evaluation.template_name}</h1>
                        </div>

                        {/* Score Block (Desktop) */}
                        <div className="flex flex-col items-end shrink-0 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                            <div className="text-xl font-bold leading-none text-slate-900">
                                {totalScoreLabel}
                                <span className="text-slate-400 text-xs font-normal ml-0.5">/ {maxScoreLabel}</span>
                            </div>
                            <div className={cn("text-[10px] font-bold mt-0.5", scorePercentage >= 80 ? "text-slate-900" : scorePercentage >= 50 ? "text-amber-600" : "text-red-600")}>
                                {scorePercentage}%
                            </div>
                        </div>
                    </div>

                    {/* Meta Info (Common) */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground px-1 md:px-0 md:pl-11">
                        <div className="flex items-center gap-1.5">
                            <User className="h-4 w-4" />
                            <span className="font-medium text-foreground">
                                {evaluation.reviewer_name || evaluation.evaluator_name || evaluation.employee_name}
                            </span>
                            {evaluation.reviewer_name && (
                                <span className="text-xs text-muted-foreground ml-1">(Подтвердил)</span>
                            )}
                            {(!evaluation.reviewer_name && (!evaluation.evaluator_name || evaluation.evaluator_name === evaluation.employee_name)) && 
                                <span className="text-xs text-muted-foreground ml-1">(Самопроверка)</span>
                            }
                        </div>
                        
                        {/* Target (Checked) - Show only if different from Evaluator */}
                        {evaluation.evaluator_name && evaluation.employee_name !== evaluation.evaluator_name && (
                            <div className="flex items-center gap-1.5 pl-4 border-l">
                                <span className="text-muted-foreground">Проверяемый:</span>
                                <span className="font-medium text-foreground">{evaluation.employee_name}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-1.5 pl-4 border-l">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(evaluation.evaluation_date), 'd MMM yyyy', { locale: ru })}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>{format(new Date(evaluation.created_at), 'HH:mm')}</span>
                        </div>
                    </div>
                </div>

            <div className="space-y-1 sm:space-y-6 pb-24 -mx-4 sm:mx-0">
                {evaluation.responses.map((response, index) => {
                    const isAccepted = reviewItems[response.id]?.is_accepted ?? true
                    const hasOptions = response.options && response.options.length > 0
                    const adjustedScore = reviewItems[response.id]?.adjusted_score
                    const expectedWorkstationScore = getWorkstationExpectedScore(response)
                    const isAutoWorkstationScore = expectedWorkstationScore !== null && adjustedScore !== undefined && Math.abs(adjustedScore - expectedWorkstationScore) < 0.01
                    const isScoreAdjusted = adjustedScore !== undefined && adjustedScore !== Number(response.score) && !isAutoWorkstationScore
                    const workstationIssues = getWorkstationIssues(response)
                    const originalWorkstationIssues = getStoredWorkstationIssues(response)
                    const isWorkstationIssuesChanged = response.related_entity_type === 'workstations'
                        && reviewItems[response.id]?.selected_issues !== undefined
                        && !issuesEqual(reviewItems[response.id]?.selected_issues || [], originalWorkstationIssues)
                    const selectedOptionLabel = hasOptions
                        ? response.options!.find(opt => Number(opt.score) === Number(response.score))?.label
                        : undefined
                    
                    return (
                        <div id={`item-${response.id}`} key={response.id} className={cn(
                            "bg-white sm:rounded-xl sm:border sm:shadow-sm overflow-hidden transition-all py-5 px-4 sm:p-6 space-y-5 border-b sm:border-b-0 last:border-b-0",
                            (!isAccepted || isScoreAdjusted) && "sm:border-amber-200 sm:ring-1 sm:ring-amber-100 bg-amber-50/30 sm:bg-white"
                        )}>
                            {/* Header: Question & Description */}
                            <div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        <div className="flex items-center gap-2">
                                            <span>Пункт {index + 1}</span>
                                            {response.weight && response.weight > 1 && (
                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 border-slate-200 text-slate-500">
                                                    Вес: {response.weight}x
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className={cn("text-sm font-bold", (reviewItems[response.id]?.adjusted_score ?? Number(response.score)) > 0 ? "text-slate-900" : "text-slate-400")}>
                                                {Number(reviewItems[response.id]?.adjusted_score ?? response.score).toFixed(1).replace(/\.0$/, '')}
                                            </span>
                                            <span className="text-slate-300">/</span>
                                            <span>{Number(response.max_score)}</span>
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-lg leading-snug text-slate-900">
                                        {response.item_content}
                                    </h3>
                                    {response.description && (
                                        <p className="text-sm text-slate-500 font-normal leading-relaxed">
                                            {response.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Photos - Moved up */}
                            {(response.photo_urls && response.photo_urls.length > 0) || response.photo_url ? (
                                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible no-scrollbar">
                                    {((response.photo_urls && response.photo_urls.length > 0) ? response.photo_urls : [response.photo_url]).filter(Boolean).map((url, i) => (
                                        <div 
                                            key={i} 
                                            className="shrink-0 w-32 h-32 sm:w-auto sm:h-auto sm:aspect-video relative rounded-xl overflow-hidden border bg-slate-100 cursor-zoom-in group shadow-sm"
                                            onClick={() => openImage(url!, response.photo_urls || [response.photo_url!])}
                                        >
                                            <img src={url} alt={`Фото ${i+1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {/* Options (Variants) - Vertical List */}
                            {hasOptions && (
                                <div className="flex flex-col gap-2 pt-1">
                                    {response.options!.map((opt, i) => {
                                        const isSelected = Number(opt.score) === Number(response.score)
                                        const isAdminSelected = (reviewItems[response.id]?.adjusted_score) === opt.score && opt.score !== response.score
                                        
                                        // Allow admin to click to change score if not completed
                                        const handleClick = () => {
                                            if (!isCompleted) {
                                                // If already selected (adjusted), clear it (revert to original or undefined)
                                                if (reviewItems[response.id]?.adjusted_score === opt.score) {
                                                    // Remove adjusted_score
                                                    setReviewItems(prev => {
                                                        const newItem = { ...prev[response.id] }
                                                        delete newItem.adjusted_score
                                                        return { ...prev, [response.id]: newItem }
                                                    })
                                                } else {
                                                    handleScoreChange(response.id, opt.score)
                                                }
                                            }
                                        }

                                        return (
                                            <div 
                                                key={i}
                                                onClick={handleClick}
                                                className={cn(
                                                    "w-full px-4 py-3 rounded-xl text-sm font-medium border transition-all flex items-center justify-between",
                                                    !isCompleted && "cursor-pointer active:scale-[0.99]",
                                                    isSelected 
                                                        ? "bg-slate-900 text-white border-slate-900 shadow-md ring-1 ring-slate-900" 
                                                        : isAdminSelected
                                                            ? "bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-300 shadow-sm"
                                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                                )}
                                            >
                                                <span>{opt.label}</span>
                                                <span className={cn("text-xs font-semibold opacity-70", isSelected && "opacity-100")}>
                                                    {opt.score}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Employee Comment / Workstations */}
                            {(response.comment || workstationIssues.length > 0) && (
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                                    {workstationIssues.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-semibold uppercase text-slate-500">Проблемные места:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {workstationIssues.map((ws, idx) => (
                                                    <Badge key={idx} variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50">
                                                        {ws}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {response.comment ? (
                                        <p className="text-sm italic text-slate-600">
                                            "{response.comment}"
                                        </p>
                                    ) : null}
                                </div>
                            )}

                            {/* Workstation Selection Grid (Review Mode) */}
                            {response.related_entity_type === 'workstations' && !isCompleted && (
                                <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Корректировка проблемных мест</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                        {workstations
                                            .filter(w => !response.target_zone || response.target_zone === 'all' || w.zone === response.target_zone)
                                            .map(ws => {
                                                const isSelected = workstationIssues.includes(ws.name)
                                                
                                                return (
                                                    <button
                                                        key={ws.id}
                                                        onClick={() => toggleWorkstationIssue(response.id, ws.name, response.max_score, response.target_zone || 'all')}
                                                        className={cn(
                                                            "py-2 px-1 text-[10px] sm:text-xs font-medium rounded-lg border transition-all truncate",
                                                            isSelected
                                                                ? "bg-red-500 border-red-500 text-white shadow-sm"
                                                                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                                                        )}
                                                    >
                                                        {ws.name}
                                                    </button>
                                                )
                                            })}
                                    </div>
                                </div>
                            )}

                            {/* Admin Audit Controls */}
                            {!isCompleted && (
                                <div className={cn("pt-4 border-t border-dashed border-slate-200 mt-2", 
                                    hasOptions && reviewItems[response.id]?.adjusted_score === undefined ? "hidden" : ""
                                )}>
                                    <div className="flex flex-col gap-3">
                                        {!hasOptions && response.related_entity_type !== 'workstations' && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Корректировка оценки</span>
                                            </div>
                                        )}
                                        
                                        <div className="flex flex-col gap-3 w-full">
                                            {/* Score Stepper - Only if NO options AND NO workstation logic (since workstations auto-calculate) */}
                                            {!hasOptions && response.related_entity_type !== 'workstations' && (
                                                <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 p-1 shadow-sm self-start">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-md hover:bg-white hover:shadow-sm"
                                                        onClick={() => handleScoreChange(response.id, Math.max(0, Number(reviewItems[response.id]?.adjusted_score ?? response.score) - 0.5))}
                                                        disabled={Number(reviewItems[response.id]?.adjusted_score ?? response.score) <= 0}
                                                    >
                                                        -
                                                    </Button>
                                                    <div className="w-12 text-center font-bold text-sm">
                                                        {Number(reviewItems[response.id]?.adjusted_score ?? response.score).toFixed(1).replace(/\.0$/, '')}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-md hover:bg-white hover:shadow-sm"
                                                        onClick={() => handleScoreChange(response.id, Math.min(Number(response.max_score), Number(reviewItems[response.id]?.adjusted_score ?? response.score) + 0.5))}
                                                        disabled={Number(reviewItems[response.id]?.adjusted_score ?? response.score) >= Number(response.max_score)}
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                            )}

                                            {(isScoreAdjusted || isWorkstationIssuesChanged) && (
                                                <div className="w-full animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="text-xs font-medium text-amber-600 mb-1.5 flex items-center gap-1">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Укажите причину изменений:
                                                    </div>
                                                    <Textarea 
                                                        placeholder="Опишите причину (обязательно)" 
                                                        className={cn(
                                                            "min-h-[60px] py-2 text-sm resize-none bg-white w-full",
                                                            !reviewItems[response.id]?.admin_comment && "border-amber-300 ring-1 ring-amber-100 focus-visible:ring-amber-400"
                                                        )}
                                                        value={reviewItems[response.id]?.admin_comment || ''}
                                                        onChange={(e) => handleReviewItemChange(response.id, 'admin_comment', e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                                {/* Read-only Admin Comment (for history) */}
                                {isCompleted && response.admin_comment && (
                                    <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-900">
                                        <div className="font-semibold mb-1 flex items-center gap-1.5">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            Комментарий проверяющего{evaluation?.reviewer_name ? ` — ${evaluation.reviewer_name}` : ''}
                                        </div>
                                        {response.admin_comment}
                                    </div>
                                )}
                        </div>
                    )
                })}
            </div>

            {/* Bottom Actions Bar */}
            {!isCompleted && (
                <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-white border-t p-4 shadow-lg z-10">
                    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="w-full sm:w-auto flex-1">
                            <Textarea 
                                placeholder="Общий комментарий к проверке..." 
                                className="h-10 min-h-[40px] resize-none"
                                value={reviewerNote}
                                onChange={(e) => setReviewerNote(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button 
                                className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto"
                                onClick={() => handleSubmitReview('approved')}
                                disabled={isSubmitting}
                            >
                                Завершить проверку
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {viewerOpen && (
                <ImageViewer 
                    isOpen={viewerOpen}
                    onClose={() => setViewerOpen(false)} 
                    src={viewerImage}
                    images={currentImages}
                    onNext={handleNextImage}
                    onPrev={handlePrevImage}
                />
            )}
            </PageShell>
        </div>
    )
}
