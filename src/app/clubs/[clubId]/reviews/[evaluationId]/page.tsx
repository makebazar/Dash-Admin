"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, User, Calendar, Clock, Star } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { PageShell, PageHeader } from "@/components/layout/PageShell"
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
}

interface EvaluationDetail {
    id: number
    template_name: string
    employee_name: string
    evaluator_name?: string
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
    const [reviewItems, setReviewItems] = useState<Record<number, { is_accepted: boolean, admin_comment: string, adjusted_score?: number }>>({})
    const [adjustedTotalScore, setAdjustedTotalScore] = useState(0)

    useEffect(() => {
        if (evaluation) {
            let total = 0
            evaluation.responses.forEach(r => {
                const itemScore = reviewItems[r.id]?.adjusted_score ?? r.score
                total += itemScore
            })
            setAdjustedTotalScore(total)
        }
    }, [reviewItems, evaluation])
    const [reviewerNote, setReviewerNote] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    const [viewerOpen, setViewerOpen] = useState(false)
    const [viewerImage, setViewerImage] = useState("")
    const [viewerImages, setViewerImages] = useState<string[]>([])

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            setEvaluationId(p.evaluationId)
            fetchEvaluation(p.clubId, p.evaluationId)
        })
    }, [params])

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

    const handleScoreChange = (responseId: number, newScore: number) => {
        setReviewItems(prev => ({
            ...prev,
            [responseId]: {
                ...prev[responseId],
                adjusted_score: newScore,
                // If score is changed, force admin comment requirement (can be handled in UI)
            }
        }))
    }

    const handleSubmitReview = async (status: 'approved' | 'rejected') => {
        if (!evaluation) return
        setIsSubmitting(true)
        try {
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
                    total_score: adjustedTotalScore // Send new total score
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

    const openImage = (url: string, allUrls: string[] = []) => {
        setViewerImage(url)
        setViewerImages(allUrls.length > 0 ? allUrls : [url])
        setViewerOpen(true)
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
            case 'rejected': return <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 border-0"><XCircle className="w-3 h-3 mr-1" /> Отклонено</Badge>
            default: return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-0"><Clock className="w-3 h-3 mr-1" /> На проверке</Badge>
        }
    }

    const scorePercentage = Math.round((evaluation.total_score / evaluation.max_score) * 100) || 0
    const isCompleted = evaluation.status === 'approved' || evaluation.status === 'rejected'

    return (
        <PageShell maxWidth="4xl">
            <div className="mb-6">
                <Button variant="ghost" className="pl-0 hover:pl-0 hover:bg-transparent -ml-2" onClick={() => router.push(`/clubs/${clubId}/reviews?tab=checklists`)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Назад к списку
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-2">{evaluation.template_name}</h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        {/* Evaluator (Checker) */}
                        <div className="flex items-center gap-1.5" title="Проверяющий">
                            <User className="h-4 w-4" />
                            <span className="font-medium text-foreground">
                                {evaluation.evaluator_name || evaluation.employee_name} 
                            </span>
                            {(!evaluation.evaluator_name || evaluation.evaluator_name === evaluation.employee_name) && 
                                <span className="text-xs text-muted-foreground ml-1">(Самопроверка)</span>
                            }
                        </div>
                        
                        {/* Target (Checked) - Show only if different from Evaluator */}
                        {evaluation.evaluator_name && evaluation.employee_name !== evaluation.evaluator_name && (
                            <div className="flex items-center gap-1.5 pl-4 border-l" title="Проверяемый (Кого оценивали)">
                                <span className="text-muted-foreground">Проверяемый:</span>
                                <span className="font-medium text-foreground">{evaluation.employee_name}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-1.5 pl-4 border-l md:border-l-0 lg:border-l">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(evaluation.evaluation_date), 'dd MMMM yyyy', { locale: ru })}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>{format(new Date(evaluation.created_at), 'HH:mm')}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-2">
                            <div className="text-2xl font-bold text-primary">
                                {adjustedTotalScore || evaluation.total_score} 
                                <span className="text-muted-foreground text-sm font-normal"> / {evaluation.max_score}</span>
                            </div>
                        </div>
                        <div className={cn("text-xs font-medium", scorePercentage >= 80 ? "text-green-600" : scorePercentage >= 50 ? "text-amber-600" : "text-red-600")}>
                            {Math.round(((adjustedTotalScore || evaluation.total_score) / evaluation.max_score) * 100)}% эффективности
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6 pb-24">
                {evaluation.responses.map((response, index) => {
                    const isAccepted = reviewItems[response.id]?.is_accepted
                    
                    return (
                        <Card key={response.id} className={cn("overflow-hidden transition-all", !isAccepted && "border-red-200 ring-1 ring-red-100")}>
                            <CardHeader className="bg-muted/30 pb-3">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="font-medium text-base">
                                        <span className="text-muted-foreground mr-2">#{index + 1}</span>
                                        {response.item_content}
                                        {response.description && (
                                            <div className="text-sm text-muted-foreground mt-1 font-normal">
                                                {response.description}
                                            </div>
                                        )}
                                    </div>
                                    <Badge variant={response.score > 0 ? "default" : "outline"} className={cn(response.score > 0 ? "bg-green-600" : "")}>
                                        {response.score} баллов
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                {/* Photos */}
                                {(response.photo_urls && response.photo_urls.length > 0) || response.photo_url ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {(response.photo_urls || [response.photo_url]).filter(Boolean).map((url, i) => (
                                            <div 
                                                key={i} 
                                                className="aspect-video relative rounded-md overflow-hidden border bg-muted cursor-zoom-in group"
                                                onClick={() => openImage(url!, response.photo_urls || [response.photo_url!])}
                                            >
                                                <img src={url} alt="Фото отчета" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                {/* Comment */}
                                {response.comment && (
                                    <div className="bg-slate-50 p-3 rounded-md text-sm italic text-slate-700 border border-slate-100">
                                        "{response.comment}"
                                    </div>
                                )}

                                {/* Admin Review Controls - Audit Mode */}
                                {!isCompleted && (
                                    <div className="pt-2 border-t mt-4">
                                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="text-sm font-medium text-muted-foreground">Оценка админа:</div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => handleScoreChange(response.id, Math.max(0, (reviewItems[response.id]?.adjusted_score ?? response.score) - 1))}
                                                        disabled={(reviewItems[response.id]?.adjusted_score ?? response.score) <= 0}
                                                    >
                                                        -
                                                    </Button>
                                                    <div className="w-8 text-center font-bold">
                                                        {reviewItems[response.id]?.adjusted_score ?? response.score} <span className="text-muted-foreground text-[10px] font-normal">/ {response.max_score}</span>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => handleScoreChange(response.id, Math.min(response.max_score, (reviewItems[response.id]?.adjusted_score ?? response.score) + 1))}
                                                        disabled={(reviewItems[response.id]?.adjusted_score ?? response.score) >= response.max_score}
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            {(reviewItems[response.id]?.adjusted_score !== undefined && reviewItems[response.id]?.adjusted_score !== response.score) && (
                                                <div className="w-full sm:w-auto sm:flex-1 sm:max-w-md">
                                                    <Textarea 
                                                        placeholder="Почему изменили оценку? (Обязательно)" 
                                                        className={cn("h-9 min-h-[36px] py-1.5 text-sm resize-none", !reviewItems[response.id]?.admin_comment && "border-red-300 ring-1 ring-red-100")}
                                                        value={reviewItems[response.id]?.admin_comment || ''}
                                                        onChange={(e) => handleReviewItemChange(response.id, 'admin_comment', e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Admin Comment View - If completed */}
                                {isCompleted && response.admin_comment && (
                                    <div className="pt-2 border-t mt-4 text-sm">
                                        <span className="font-semibold text-red-600">Замечание:</span> {response.admin_comment}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
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
                                className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                                onClick={() => handleSubmitReview('approved')}
                                disabled={isSubmitting}
                            >
                                Завершить проверку
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ImageViewer 
                open={viewerOpen} 
                onOpenChange={setViewerOpen} 
                src={viewerImage}
                images={viewerImages}
            />
        </PageShell>
    )
}