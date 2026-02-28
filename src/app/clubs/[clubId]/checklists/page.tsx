"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, History, Camera, CheckCircle, XCircle, AlertTriangle, BarChart3, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

export default function ChecklistsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const router = useRouter()
    const [clubId, setClubId] = useState('')
    const [history, setHistory] = useState<Evaluation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    
    // Detail & Review State
    const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationDetail | null>(null)
    const [isDetailLoading, setIsDetailLoading] = useState(false)
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
    
    // Review Logic
    const [isReviewMode, setIsReviewMode] = useState(false)
    const [reviewItems, setReviewItems] = useState<Record<number, { is_accepted: boolean, admin_comment: string }>>({})
    const [reviewerNote, setReviewerNote] = useState('')
    const [isSubmittingReview, setIsSubmittingReview] = useState(false)

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchHistory(p.clubId)
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

    const handleViewEvaluation = async (evaluationId: number) => {
        // Reset review state
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
                // Initialize review state from existing data
                const initialReviewState: Record<number, any> = {}
                data.responses.forEach((r: EvaluationResponse) => {
                    initialReviewState[r.id] = {
                        is_accepted: r.is_accepted !== false, // default true if undefined
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
                // Update local list
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

    // Statistics Calculation
    const totalEvaluations = history.length
    const pendingEvaluations = history.filter(h => h.status === 'pending' || !h.status).length
    const avgScore = totalEvaluations > 0 
        ? history.reduce((acc, curr) => acc + curr.total_score, 0) / totalEvaluations 
        : 0

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Чеклисты</h1>
                        <p className="text-muted-foreground">Контроль качества и история проверок</p>
                    </div>
                    <div className="flex gap-3">
                         <div className="flex flex-col items-end px-4 py-2 bg-muted/30 rounded-lg border">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Ожидают проверки</span>
                            <span className="text-xl font-bold text-yellow-600">{pendingEvaluations}</span>
                        </div>
                        <div className="flex flex-col items-end px-4 py-2 bg-muted/30 rounded-lg border">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Средний балл</span>
                            <span className={`text-xl font-bold ${avgScore >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
                                {avgScore.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="history" className="w-full">
                    <TabsList className="mb-6">
                        <TabsTrigger value="history" className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            История проверок
                        </TabsTrigger>
                        <TabsTrigger value="stats" className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Статистика
                        </TabsTrigger>
                    </TabsList>

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
                                                <TableHead>Сотрудник</TableHead>
                                                <TableHead className="text-right">Баллы</TableHead>
                                                <TableHead className="w-12"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {history.map(evaluation => (
                                                <TableRow key={evaluation.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewEvaluation(evaluation.id)}>
                                                    <TableCell>{getStatusBadge(evaluation.status)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{new Date(evaluation.evaluation_date || evaluation.created_at).toLocaleDateString()}</span>
                                                            <span className="text-xs text-muted-foreground">{new Date(evaluation.evaluation_date || evaluation.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{evaluation.template_name}</TableCell>
                                                    <TableCell>{evaluation.employee_name}</TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={`font-bold ${evaluation.total_score >= 80 ? 'text-green-600' : evaluation.total_score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                            {Math.round(evaluation.total_score)}%
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="sm">Details</Button>
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
                            <CardContent className="pt-6">
                                <div className="text-center text-muted-foreground py-12">
                                    <BarChart3 className="mx-auto h-12 w-12 opacity-20 mb-4" />
                                    <p>Раздел статистики в разработке</p>
                                    <p className="text-sm">Здесь будут графики успеваемости сотрудников и динамика по чеклистам</p>
                                </div>
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

                {/* Photo Preview Overlay */}
                {photoPreviewUrl && (
                    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setPhotoPreviewUrl(null)}>
                        <img src={photoPreviewUrl} className="max-w-full max-h-full object-contain rounded" />
                        <button className="absolute top-4 right-4 text-white hover:text-gray-300">
                            <XCircle className="h-8 w-8" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
