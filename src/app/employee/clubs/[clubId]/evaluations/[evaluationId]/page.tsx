"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, Calendar, User, Clock, CheckCircle2, XCircle } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { ImageViewer } from "@/components/ui/image-viewer"

interface EvaluationResponse {
    id: number
    item_content: string
    description?: string
    score: number
    max_score: number
    comment?: string
    photo_url?: string
    photo_urls?: string[]
    admin_comment?: string
    weight?: number
    options?: { label: string; score: number }[]
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
    comments?: string
}

export default function EmployeeEvaluationDetailPage() {
    const router = useRouter()
    const params = useParams()
    const clubId = params.clubId as string
    const evaluationId = params.evaluationId as string

    const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null)
    const [isLoading, setIsLoading] = useState(true)
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

    useEffect(() => {
        fetchEvaluation()
    }, [clubId, evaluationId])

    const fetchEvaluation = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/evaluations/${evaluationId}`)
            const data = await res.json()
            if (res.ok) {
                setEvaluation(data)
            } else {
                alert('Не удалось загрузить проверку')
                router.push(`/employee/clubs/${clubId}/evaluations`)
            }
        } catch (error) {
            console.error(error)
            alert('Ошибка сервера')
            router.push(`/employee/clubs/${clubId}/evaluations`)
        } finally {
            setIsLoading(false)
        }
    }

    const parseIssuesFromComment = (comment?: string) => {
        if (!comment) return []
        const prefix = comment.startsWith('Проблемы: ')
            ? 'Проблемы: '
            : comment.startsWith('Проблемные: ')
                ? 'Проблемные: '
                : null
        if (!prefix) return []
        return comment
            .slice(prefix.length)
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
    }

    const getWorkstationIssues = (response: EvaluationResponse) => {
        if (Array.isArray(response.selected_workstations) && response.selected_workstations.length > 0) {
            return response.selected_workstations
        }
        return parseIssuesFromComment(response.comment)
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!evaluation) {
        return (
            <div className="min-h-screen bg-background p-4 md:p-6">
                <div className="mx-auto max-w-2xl text-center py-12">
                    <h2 className="text-xl font-semibold mb-4 text-foreground">Проверка не найдена</h2>
                    <Button onClick={() => router.push(`/employee/clubs/${clubId}/evaluations`)}>
                        Назад к списку
                    </Button>
                </div>
            </div>
        )
    }

    const maxScoreValue = Number(evaluation.max_score) || 0
    const totalScoreValue = Number(evaluation.total_score) || 0
    const scorePercentage = maxScoreValue > 0 ? Math.round((totalScoreValue / maxScoreValue) * 100) : 0

    const formatScore = (value: number) => {
        if (!Number.isFinite(value)) return '0'
        const rounded = Math.round(value * 10) / 10
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
    }

    const getStatusBadge = (status?: string) => {
        switch (status) {
            case 'approved':
                return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold uppercase tracking-wider text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" /> Принято</Badge>
            case 'rejected':
                return <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 font-bold uppercase tracking-wider text-[10px]"><XCircle className="w-3 h-3 mr-1" /> Замечания</Badge>
            default:
                return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold uppercase tracking-wider text-[10px]">На проверке</Badge>
        }
    }

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* Mobile Sticky Header */}
            <div className="sticky top-0 left-0 right-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3 md:hidden">
                <Button
                    variant="ghost"
                    size="icon"
                    className="-ml-2 h-9 w-9 shrink-0"
                    onClick={() => router.push(`/employee/clubs/${clubId}/evaluations`)}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-base font-semibold truncate leading-tight">{evaluation.template_name}</h1>
                    <div className="mt-1 flex items-center gap-2">
                        {getStatusBadge(evaluation.status)}
                    </div>
                </div>
                <div className="shrink-0 flex flex-col items-end bg-accent/30 px-2 py-1 rounded border border-border/50">
                    <div className="text-sm font-bold leading-none text-foreground">
                        {formatScore(totalScoreValue)}
                        <span className="text-muted-foreground/70 text-[10px] font-normal ml-0.5">/ {formatScore(maxScoreValue)}</span>
                    </div>
                    <div className={cn("text-[9px] font-bold mt-0.5", scorePercentage >= 80 ? "text-emerald-500" : scorePercentage >= 50 ? "text-amber-500" : "text-rose-500")}>
                        {scorePercentage}%
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
                {/* Desktop Header */}
                <div className="mb-6 space-y-4">
                    <div className="hidden md:flex items-start gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="-ml-2 h-8 w-8 shrink-0 mt-0.5"
                            onClick={() => router.push(`/employee/clubs/${clubId}/evaluations`)}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-xl font-bold leading-tight text-foreground">{evaluation.template_name}</h1>
                                {getStatusBadge(evaluation.status)}
                            </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 bg-accent/30 px-2.5 py-1.5 rounded-lg border border-border/50">
                            <div className="text-xl font-bold leading-none text-foreground">
                                {formatScore(totalScoreValue)}
                                <span className="text-muted-foreground/70 text-xs font-normal ml-0.5">/ {formatScore(maxScoreValue)}</span>
                            </div>
                            <div className={cn("text-[10px] font-bold mt-0.5", scorePercentage >= 80 ? "text-emerald-500" : scorePercentage >= 50 ? "text-amber-500" : "text-rose-500")}>
                                {scorePercentage}%
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground px-1 md:px-0 md:pl-11">
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span className="font-medium text-foreground">
                                {evaluation.reviewer_name || evaluation.evaluator_name || evaluation.employee_name}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(evaluation.evaluation_date), 'd MMM yyyy', { locale: ru })}</span>
                            <span className="text-muted-foreground/30">|</span>
                            <Clock className="h-4 w-4" />
                            <span>{format(new Date(evaluation.created_at), 'HH:mm')}</span>
                        </div>
                    </div>
                </div>

                {/* Score Summary */}
                <Card className="mb-6 border border-border bg-card shadow-sm">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Итоговый результат</div>
                            <div className={cn("text-3xl font-black", scorePercentage >= 80 ? "text-emerald-500" : scorePercentage >= 50 ? "text-amber-500" : "text-rose-500")}>
                                {scorePercentage}%
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Баллы</div>
                            <div className="text-xl font-bold text-foreground">
                                {formatScore(totalScoreValue)} <span className="text-muted-foreground/70 text-sm font-medium">/ {formatScore(maxScoreValue)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Reviewer Note */}
                {evaluation.reviewer_note && (
                    <Card className="mb-6 border border-amber-500/20 bg-amber-500/5 shadow-sm">
                        <CardContent className="p-4">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1">Комментарий проверяющего</div>
                            <div className="text-sm text-foreground">{evaluation.reviewer_note}</div>
                        </CardContent>
                    </Card>
                )}

                {/* Comments */}
                {evaluation.comments && (
                    <Card className="mb-6 border border-border bg-accent/10 shadow-sm">
                        <CardContent className="p-4">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Комментарий</div>
                            <div className="text-sm text-foreground">{evaluation.comments}</div>
                        </CardContent>
                    </Card>
                )}

                {/* Responses */}
                <div className="space-y-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Детализация по пунктам</div>
                    {evaluation.responses.map((response, index) => {
                        const maxScore = Number(response.max_score ?? 1)
                        const scoreValue = Number(response.score)
                        const hasOptions = Array.isArray(response.options) && response.options.length > 0
                        const workstationIssues = getWorkstationIssues(response)

                        return (
                            <Card key={response.id} className="border border-border bg-card shadow-sm overflow-hidden">
                                <CardContent className="p-4 space-y-4">
                                    {/* Header */}
                                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        <span>Пункт {index + 1}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-foreground font-bold">{scoreValue.toFixed(1).replace(/\.0$/, '')}</span>
                                            <span className="text-muted-foreground/30">/</span>
                                            <span>{maxScore}</span>
                                        </div>
                                    </div>

                                    {/* Question */}
                                    <div className="space-y-2">
                                        <div className="text-sm font-semibold">{response.item_content}</div>
                                        {response.description && (
                                            <div className="text-xs text-muted-foreground">{response.description}</div>
                                        )}
                                    </div>

                                    {/* Options */}
                                    {hasOptions && (
                                        <div className="flex flex-col gap-2">
                                            {response.options!.map((opt, i) => {
                                                const isSelected = Number(opt.score) === Number(response.score)
                                                return (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            "w-full px-4 py-3 rounded-xl text-sm font-medium border flex items-center justify-between",
                                                            isSelected
                                                                ? "bg-primary/10 text-primary border-primary/30"
                                                                : "bg-accent/10 text-muted-foreground border-border"
                                                        )}
                                                    >
                                                        <span>{opt.label}</span>
                                                        <span className={cn("text-xs font-semibold", isSelected ? "opacity-100" : "opacity-70")}>
                                                            {opt.score}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {/* Photos */}
                                    {(response.photo_urls && response.photo_urls.length > 0) || response.photo_url ? (
                                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible no-scrollbar">
                                            {((response.photo_urls && response.photo_urls.length > 0) ? response.photo_urls : [response.photo_url])
                                                .filter((url): url is string => Boolean(url))
                                                .map((url, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => openImage(
                                                        url,
                                                        (response.photo_urls && response.photo_urls.length > 0 ? response.photo_urls : [response.photo_url]).filter((img): img is string => Boolean(img))
                                                    )}
                                                    className="shrink-0 w-32 h-32 sm:w-auto sm:h-auto sm:aspect-video relative rounded-xl overflow-hidden border border-border bg-accent/30 cursor-zoom-in"
                                                >
                                                    <img src={url} alt={`Фото ${i + 1}`} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}

                                    {/* Issues / Comment */}
                                    {(response.comment || workstationIssues.length > 0) && (
                                        <div className="bg-accent/30 p-3 rounded-xl border border-border/50 space-y-2">
                                            {workstationIssues.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Проблемные места</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {workstationIssues.map((ws, idx) => (
                                                            <Badge key={idx} variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 font-bold text-[10px] uppercase tracking-wider">
                                                                {ws}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {response.comment && workstationIssues.length === 0 && (
                                                <p className="text-sm italic text-muted-foreground">"{response.comment}"</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Admin Comment */}
                                    {response.admin_comment && (
                                        <div className="text-xs text-amber-500 bg-amber-500/5 border border-amber-500/20 rounded-md p-2">
                                            {response.admin_comment}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>

            {/* Image Viewer */}
            <ImageViewer
                src={viewerImage}
                isOpen={viewerOpen}
                onClose={() => setViewerOpen(false)}
                images={currentImages}
                onNext={handleNextImage}
                onPrev={handlePrevImage}
                hasNext={currentImages.indexOf(viewerImage) < currentImages.length - 1}
                hasPrev={currentImages.indexOf(viewerImage) > 0}
            />
        </div>
    )
}
