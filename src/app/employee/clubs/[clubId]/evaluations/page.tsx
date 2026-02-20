"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader2, Calendar, ClipboardCheck, ArrowLeft, ExternalLink, Camera, ChevronRight } from "lucide-react"
import Link from "next/link"

interface Evaluation {
    id: number
    template_name: string
    evaluator_name: string
    total_score: number
    max_score: number
    evaluation_date: string
    created_at: string
    comments?: string
}

interface EvaluationDetail extends Evaluation {
    responses: {
        id: number
        item_content: string
        score: number
        comment?: string
        photo_url?: string
    }[]
}

export default function EmployeeEvaluationsPage() {
    const params = useParams()
    const clubId = params.clubId as string
    const router = useRouter()

    const [evaluations, setEvaluations] = useState<Evaluation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationDetail | null>(null)
    const [isDetailLoading, setIsDetailLoading] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string>('')

    useEffect(() => {
        // Fetch current user ID first
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    setCurrentUserId(data.user.id)
                    fetchEvaluations(data.user.id)
                }
            })
            .catch(err => console.error(err))
    }, [clubId])

    const fetchEvaluations = async (userId: string) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/evaluations?employee_id=${userId}`)
            const data = await res.json()
            if (res.ok && Array.isArray(data)) {
                setEvaluations(data)
            }
        } catch (error) {
            console.error('Error fetching evaluations:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleViewEvaluation = async (evaluationId: number) => {
        // Find basic info from history first
        const basicInfo = evaluations.find(h => h.id === evaluationId)
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
            } else {
                alert('Не удалось загрузить детали')
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsDetailLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900/50">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900/50 p-4 md:p-6 pb-24">
            <div className="mx-auto max-w-2xl space-y-6">
                {/* Header */}
                <div>
                    <Link 
                        href={`/employee/clubs/${clubId}`}
                        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="mr-1 h-4 w-4" /> Назад
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight">Мои проверки</h1>
                    <p className="text-muted-foreground">История оценок и чеклистов</p>
                </div>

                {evaluations.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium">Нет проверок</h3>
                            <p className="text-muted-foreground text-sm">Вас еще не оценивали по чеклистам</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {evaluations.map(evaluation => (
                            <Card 
                                key={evaluation.id} 
                                className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                                onClick={() => handleViewEvaluation(evaluation.id)}
                            >
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="font-medium">{evaluation.template_name}</div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(evaluation.evaluation_date || evaluation.created_at).toLocaleDateString()}
                                            {evaluation.evaluator_name && (
                                                <>• {evaluation.evaluator_name}</>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge 
                                            variant={evaluation.total_score >= 80 ? 'default' : evaluation.total_score >= 50 ? 'secondary' : 'destructive'}
                                            className="text-sm font-bold px-2.5 py-0.5"
                                        >
                                            {Math.round(evaluation.total_score)}%
                                        </Badge>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <Dialog open={!!selectedEvaluation} onOpenChange={() => setSelectedEvaluation(null)}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedEvaluation?.template_name}</DialogTitle>
                        <DialogDescription>
                            Проверка от {selectedEvaluation && new Date(selectedEvaluation.evaluation_date || selectedEvaluation.created_at).toLocaleDateString()}
                        </DialogDescription>
                    </DialogHeader>
                    
                    {isDetailLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : selectedEvaluation ? (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
                                <span className="text-sm font-medium">Итоговый результат</span>
                                <Badge 
                                    variant={selectedEvaluation.total_score >= 80 ? 'default' : selectedEvaluation.total_score >= 50 ? 'secondary' : 'destructive'}
                                    className="text-lg"
                                >
                                    {Math.round(selectedEvaluation.total_score)}%
                                </Badge>
                            </div>

                            {selectedEvaluation.comments && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-muted-foreground">Комментарий проверяющего</h4>
                                    <div className="bg-muted p-3 rounded-md text-sm">
                                        {selectedEvaluation.comments}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h4 className="text-sm font-medium text-muted-foreground">Детализация</h4>
                                <div className="space-y-3">
                                    {selectedEvaluation.responses?.map((response, index) => (
                                        <div key={index} className="border rounded-lg p-3">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-sm font-medium flex-1 pr-4">{response.item_content}</p>
                                                {response.score > 0 ? (
                                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 shrink-0">Да</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 shrink-0">Нет</Badge>
                                                )}
                                            </div>
                                            {response.comment && (
                                                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                                                    {response.comment}
                                                </p>
                                            )}
                                            {response.photo_url && (
                                                <div className="mt-2">
                                                    <a 
                                                        href={response.photo_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded-md border border-blue-100"
                                                    >
                                                        <Camera className="h-3 w-3" />
                                                        Фото
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    )
}
