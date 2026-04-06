"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText, Trash2 } from "lucide-react"

type ApplicationRow = {
    id: number
    template_id: number
    template_name: string
    template_position: string | null
    candidate_name: string | null
    candidate_phone: string | null
    candidate_email: string | null
    auto_score: number | null
    manual_score: number | null
    total_score: number
    test_summaries?: Array<{
        test_id: number
        name: string
        label: string
        decision: string
        score: number
        percent: number
    }>
    status: string
    created_at: string
    reviewed_at: string | null
}

const STATUS_LABELS: Record<string, string> = {
    in_progress: "В процессе",
    new: "Новая",
    reviewed: "Просмотрена",
    interview: "Собеседование",
    internship: "Стажировка",
    rejected: "Отказ",
    hired: "Нанят"
}

function formatApplicationDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date)
}

function getTestSummaryText(summary: { label: string; decision: string }) {
    if (summary.label && summary.decision) return `${summary.label} - ${summary.decision}`
    return summary.label || summary.decision || ""
}

export default function RecruitmentApplicationsPage() {
    const params = useParams<{ clubId: string }>()
    const clubId = params.clubId

    const [apps, setApps] = useState<ApplicationRow[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<ApplicationRow | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const load = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/recruitment/applications`)
            const data = await res.json()
            if (res.ok) setApps(data)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [clubId])

    const requestDelete = (application: ApplicationRow) => {
        setDeleteTarget(application)
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/recruitment/applications/${deleteTarget.id}`, {
                method: "DELETE"
            })
            if (res.ok) {
                setDeleteTarget(null)
                await load()
            }
        } finally {
            setIsDeleting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-[1600px] space-y-5 p-4 pb-28 sm:space-y-6 sm:p-6 sm:pb-6 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Анкеты кандидатов</h1>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">Все анкеты кандидатов, включая тех, кто еще не завершил тесты</p>
                </div>
                <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:gap-2 lg:justify-end">
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                        <Link href={`/clubs/${clubId}/employees`}>К сотрудникам</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                        <Link href={`/clubs/${clubId}/employees/recruitment/templates`}>Настройки</Link>
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardContent className="p-0">
                    {apps.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">Пока нет анкет</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3 p-3 sm:hidden">
                                {apps.map((a) => (
                                    <div key={a.id} className="rounded-xl border border-muted-foreground/10 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 space-y-1">
                                                <p className="text-sm font-bold tracking-tight">{a.candidate_name || "—"}</p>
                                                <p className="text-xs text-muted-foreground">{a.candidate_phone || a.candidate_email || ""}</p>
                                            </div>
                                            <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wider">{STATUS_LABELS[a.status] || a.status}</Badge>
                                        </div>
                                        <div className="mt-4 grid gap-3">
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Шаблон</p>
                                                <p className="text-xs font-bold">{a.template_name}</p>
                                                <p className="text-[11px] text-muted-foreground">{a.template_position || ""}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Оценка</p>
                                                <Badge className="bg-muted text-foreground">{a.total_score} баллов</Badge>
                                                {(a.test_summaries || []).length > 0 ? (
                                                    <div className="space-y-0.5">
                                                        {(a.test_summaries || []).slice(0, 3).map((summary) => {
                                                            const text = getTestSummaryText(summary)
                                                            return (
                                                                <div key={summary.test_id} className="text-[11px] text-muted-foreground">
                                                                    <span className="font-semibold text-foreground">{summary.name}:</span>{" "}
                                                                    {text || `${summary.score} б.`}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="text-[11px] text-muted-foreground">Без тестов</div>
                                                )}
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Дата</p>
                                                <p className="text-xs text-muted-foreground">{formatApplicationDate(a.created_at)}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <div className="flex gap-2">
                                                <Button asChild variant="outline" className="flex-1">
                                                    <Link href={`/clubs/${clubId}/employees/recruitment/applications/${a.id}`}>Открыть</Link>
                                                </Button>
                                                <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => requestDelete(a)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="hidden sm:block">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="border-muted-foreground/5 hover:bg-transparent">
                                            <TableHead className="py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Кандидат</TableHead>
                                            <TableHead className="py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Шаблон</TableHead>
                                            <TableHead className="py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Оценка</TableHead>
                                            <TableHead className="py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Дата</TableHead>
                                            <TableHead className="py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Статус</TableHead>
                                            <TableHead className="py-4 text-right text-xs font-bold uppercase tracking-widest text-muted-foreground">Действия</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="bg-white">
                                        {apps.map((a) => (
                                            <TableRow key={a.id} className="border-muted-foreground/5 hover:bg-muted/20">
                                                <TableCell className="py-4">
                                                    <div className="space-y-0.5">
                                                        <div className="text-sm font-bold tracking-tight">{a.candidate_name || "—"}</div>
                                                        <div className="text-xs text-muted-foreground">{a.candidate_phone || a.candidate_email || ""}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        <div className="text-xs font-bold">{a.template_name}</div>
                                                        <div className="text-[11px] text-muted-foreground">{a.template_position || ""}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <Badge className="bg-muted text-foreground">{a.total_score} баллов</Badge>
                                                        {(a.test_summaries || []).length > 0 ? (
                                                            <div className="space-y-0.5">
                                                                {(a.test_summaries || []).slice(0, 3).map((summary) => {
                                                                    const text = getTestSummaryText(summary)
                                                                    return (
                                                                        <div key={summary.test_id} className="text-[11px] text-muted-foreground">
                                                                            <span className="font-semibold text-foreground">{summary.name}:</span>{" "}
                                                                            {text || `${summary.score} б.`}
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[11px] text-muted-foreground">Без тестов</div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-xs text-muted-foreground">{formatApplicationDate(a.created_at)}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{STATUS_LABELS[a.status] || a.status}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button asChild variant="outline" size="sm">
                                                            <Link href={`/clubs/${clubId}/employees/recruitment/applications/${a.id}`}>Открыть</Link>
                                                        </Button>
                                                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => requestDelete(a)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-muted-foreground/10 bg-background/95 p-4 backdrop-blur sm:hidden">
                <div className="mx-auto flex max-w-[1600px] gap-3">
                    <Button asChild variant="outline" className="flex-1">
                        <Link href={`/clubs/${clubId}/employees`}>Сотрудники</Link>
                    </Button>
                    <Button asChild className="flex-1 bg-primary text-primary-foreground shadow-lg">
                        <Link href={`/clubs/${clubId}/employees/recruitment/templates`}>Настройки</Link>
                    </Button>
                </div>
            </div>

            <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-[480px] rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="text-xl font-bold">Удалить анкету?</DialogTitle>
                        <DialogDescription className="text-xs font-medium">
                            Анкета кандидата и все ответы по тестам будут удалены без возможности восстановления.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="text-sm font-bold">{deleteTarget?.candidate_name || "Без имени"}</div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="flex-1 text-xs font-bold uppercase tracking-widest">
                            Отмена
                        </Button>
                        <Button onClick={confirmDelete} disabled={isDeleting} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest shadow-lg">
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Удалить"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
