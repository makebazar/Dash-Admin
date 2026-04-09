"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageShell } from "@/components/layout/PageShell"
import { cn } from "@/lib/utils"
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
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    <p className="text-sm font-medium text-slate-500 animate-pulse">Загрузка анкет...</p>
                </div>
            </div>
        )
    }

    return (
        <PageShell maxWidth="5xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-12">
                <div className="space-y-3">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">Анкеты кандидатов</h1>
                    <p className="text-slate-500 text-lg">Все анкеты кандидатов, включая тех, кто еще не завершил тесты</p>
                </div>
                <div className="hidden md:flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                    <Button asChild variant="outline" className="w-full sm:w-auto rounded-xl h-12 border-slate-200 px-6 font-medium text-slate-700 hover:bg-slate-50 hover:text-black">
                        <Link href={`/clubs/${clubId}/employees`}>К сотрудникам</Link>
                    </Button>
                    <Button asChild className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto rounded-xl h-12 px-6 font-medium shadow-sm">
                        <Link href={`/clubs/${clubId}/employees/recruitment/templates`}>Настройки</Link>
                    </Button>
                </div>
            </div>

            <div className="space-y-8">
                {apps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border border-slate-200 border-dashed">
                        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                            <FileText className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Пока нет анкет</h3>
                        <p className="text-sm text-slate-500 mt-1">Отправьте ссылку на вакансию, чтобы получать отклики</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3 md:hidden">
                            {apps.map((a) => (
                                <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 space-y-1">
                                            <p className="text-lg font-bold tracking-tight text-slate-900">{a.candidate_name || "—"}</p>
                                            <p className="text-sm text-slate-500">{a.candidate_phone || a.candidate_email || ""}</p>
                                        </div>
                                        <div className={cn(
                                            "shrink-0 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                            a.status === 'hired' ? 'bg-emerald-50 text-emerald-700' :
                                            a.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                                            a.status === 'new' ? 'bg-blue-50 text-blue-700' :
                                            'bg-slate-100 text-slate-600'
                                        )}>
                                            {STATUS_LABELS[a.status] || a.status}
                                        </div>
                                    </div>
                                    <div className="grid gap-3 pt-3 border-t border-slate-100">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Шаблон</p>
                                            <p className="text-sm font-medium text-slate-900">{a.template_name}</p>
                                            {a.template_position && <p className="text-xs text-slate-500 mt-0.5">{a.template_position}</p>}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Оценка</p>
                                            <div className="inline-flex px-2 py-1 rounded-md bg-slate-50 text-slate-900 text-xs font-bold mb-3">
                                                {a.total_score} баллов
                                            </div>
                                            {(a.test_summaries || []).length > 0 ? (
                                                <div className="space-y-3">
                                                    {(a.test_summaries || []).slice(0, 3).map((summary) => {
                                                        const text = getTestSummaryText(summary)
                                                        return (
                                                            <div key={summary.test_id} className="space-y-0.5">
                                                                <div className="text-xs font-semibold text-slate-900 leading-tight">
                                                                    {summary.name}
                                                                </div>
                                                                <div className="text-xs text-slate-500 leading-snug">
                                                                    {text || `${summary.score} б.`}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-400 italic">Без тестов</div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Дата</p>
                                            <p className="text-sm text-slate-600">{formatApplicationDate(a.created_at)}</p>
                                        </div>
                                    </div>
                                    <div className="pt-4 flex gap-2">
                                        <Button asChild variant="outline" className="flex-1 h-10 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black">
                                            <Link href={`/clubs/${clubId}/employees/recruitment/applications/${a.id}`}>Открыть анкету</Link>
                                        </Button>
                                        <Button variant="outline" className="h-10 w-10 p-0 rounded-xl border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200" onClick={() => requestDelete(a)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="hidden md:block bg-white rounded-3xl border border-slate-200 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-slate-100 hover:bg-transparent">
                                        <TableHead className="py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Кандидат</TableHead>
                                        <TableHead className="py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Шаблон</TableHead>
                                        <TableHead className="py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Оценка</TableHead>
                                        <TableHead className="py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Дата</TableHead>
                                        <TableHead className="py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Статус</TableHead>
                                        <TableHead className="py-4 text-right text-xs font-bold uppercase tracking-widest text-slate-500">Действия</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {apps.map((a) => (
                                        <TableRow key={a.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="py-4">
                                                <div className="space-y-0.5">
                                                    <div className="text-sm font-bold tracking-tight text-slate-900">{a.candidate_name || "—"}</div>
                                                    <div className="text-xs text-slate-500">{a.candidate_phone || a.candidate_email || ""}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-0.5">
                                                    <div className="text-sm font-medium text-slate-900">{a.template_name}</div>
                                                    {a.template_position && <div className="text-xs text-slate-500">{a.template_position}</div>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-3 max-w-[280px]">
                                                    <div className="inline-flex px-2 py-1 rounded-md bg-slate-100 text-slate-900 text-xs font-bold">
                                                        {a.total_score} баллов
                                                    </div>
                                                    {(a.test_summaries || []).length > 0 ? (
                                                        <div className="space-y-2">
                                                            {(a.test_summaries || []).slice(0, 3).map((summary) => {
                                                                const text = getTestSummaryText(summary)
                                                                return (
                                                                    <div key={summary.test_id} className="space-y-0.5">
                                                                        <div className="text-[11px] font-semibold text-slate-900 truncate" title={summary.name}>
                                                                            {summary.name}
                                                                        </div>
                                                                        <div className="text-[11px] text-slate-500 leading-tight line-clamp-2" title={text || `${summary.score} б.`}>
                                                                            {text || `${summary.score} б.`}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-400 italic">Без тестов</div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-slate-600">{formatApplicationDate(a.created_at)}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className={cn(
                                                    "inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                                    a.status === 'hired' ? 'bg-emerald-50 text-emerald-700' :
                                                    a.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                                                    a.status === 'new' ? 'bg-blue-50 text-blue-700' :
                                                    'bg-slate-100 text-slate-600'
                                                )}>
                                                    {STATUS_LABELS[a.status] || a.status}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button asChild variant="outline" className="h-9 rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black">
                                                        <Link href={`/clubs/${clubId}/employees/recruitment/applications/${a.id}`}>Открыть</Link>
                                                    </Button>
                                                    <Button variant="ghost" className="h-9 w-9 p-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => requestDelete(a)}>
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
            </div>

            {/* Mobile Sticky Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200 md:hidden z-50 flex gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button asChild variant="outline" className="flex-1 bg-white border-slate-200 text-slate-700 h-12 rounded-xl font-medium">
                    <Link href={`/clubs/${clubId}/employees`}>
                        Сотрудники
                    </Link>
                </Button>
                <Button asChild className="flex-1 bg-slate-900 text-white hover:bg-slate-800 h-12 rounded-xl font-medium shadow-sm">
                    <Link href={`/clubs/${clubId}/employees/recruitment/templates`}>
                        Настройки
                    </Link>
                </Button>
            </div>

            <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-[400px] rounded-3xl border border-slate-200 shadow-2xl bg-white p-6">
                    <DialogHeader className="space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                            <Trash2 className="h-6 w-6 text-rose-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">Удалить анкету?</DialogTitle>
                            <DialogDescription className="text-sm font-medium text-slate-500 mt-1">
                                Анкета кандидата и все ответы по тестам будут удалены без возможности восстановления.
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                            <p className="text-sm font-bold text-slate-900">{deleteTarget?.candidate_name || "Без имени"}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{deleteTarget?.candidate_phone || "Без телефона"}</p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="flex-1 text-xs font-bold uppercase tracking-widest rounded-xl h-11">
                            Отмена
                        </Button>
                        <Button onClick={confirmDelete} disabled={isDeleting} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-rose-200 rounded-xl h-11">
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Удалить"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    )
}
