"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, ClipboardCheck, ArrowLeft, User, Clock } from "lucide-react"
import Link from "next/link"

interface Evaluation {
    id: number
    template_name: string
    evaluator_name: string
    reviewer_name?: string
    total_score: number
    max_score: number
    evaluation_date: string
    created_at: string
    comments?: string
    reviewer_note?: string
    status?: 'pending' | 'approved' | 'rejected'
}

export default function EmployeeEvaluationsPage() {
    const params = useParams()
    const clubId = params.clubId as string
    const router = useRouter()

    const [evaluations, setEvaluations] = useState<Evaluation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [currentUserId, setCurrentUserId] = useState<string>('')

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
                    {evaluations.map(evaluation => {
                            const total = Number(evaluation.total_score || 0)
                            const max = Number(evaluation.max_score || 0)
                            const scoreValue = max > 0 ? Math.round((total / max) * 100) : 0
                            const scoreClass = scoreValue >= 80 ? "text-green-600" : scoreValue >= 50 ? "text-amber-600" : "text-red-600"
                            const statusLabel = evaluation.status === 'approved' ? 'Проверено' : evaluation.status === 'rejected' ? 'Отклонено' : 'Ожидает'
                            const statusClass = evaluation.status === 'approved'
                                ? "bg-green-100 text-green-700 border-green-200"
                                : evaluation.status === 'rejected'
                                    ? "bg-red-100 text-red-700 border-red-200"
                                    : "bg-amber-100 text-amber-700 border-amber-200"
                            return (
                                <Card
                                    key={evaluation.id}
                                    className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                                    onClick={() => router.push(`/employee/clubs/${clubId}/evaluations/${evaluation.id}`)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-2">
                                                <div className="font-semibold">{evaluation.template_name}</div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(evaluation.evaluation_date || evaluation.created_at).toLocaleDateString()}
                                                    <Clock className="h-3 w-3 ml-2" />
                                                    {new Date(evaluation.created_at || evaluation.evaluation_date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <User className="h-3 w-3" />
                                                    {evaluation.reviewer_name || evaluation.evaluator_name || '—'}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <Badge variant="outline" className={`text-[10px] h-5 px-2 ${statusClass}`}>
                                                    {statusLabel}
                                                </Badge>
                                                <div className={`text-xl font-black ${scoreClass}`}>
                                                    {scoreValue}%
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
