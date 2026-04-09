"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ImageViewer } from "@/components/ui/image-viewer"
import { PageShell } from "@/components/layout/PageShell"
import { Loader2, ArrowLeft, Check } from "lucide-react"

const CANDIDATE_PHOTO_ANSWER_KEY = "_candidate_photo_url"

type ApplicationDetails = {
    id: number
    template_id: number
    candidate_name: string | null
    candidate_phone: string | null
    candidate_email: string | null
    answers: any
    auto_score: number | null
    manual_score: number | null
    status: string
    created_at: string
    reviewed_at: string | null
    template_name: string
    template_position: string | null
    template_schema: any
    template_tests?: any[]
    application_tests?: any[]
}

function normalizeTemplateSections(schema: any) {
    if (Array.isArray(schema?.sections)) {
        return schema.sections.map((section: any) => ({
            ...section,
            kind: "default",
            questions: section?.kind === "repeatable"
                ? [{
                    id: `${String(section?.id || "section")}_list`,
                    type: "repeatable_list",
                    label: String(section?.title || "Список"),
                    description: section?.description || "",
                    item_label: section?.item_label || "запись",
                    fields: Array.isArray(section?.questions)
                        ? section.questions.map((question: any) => ({
                            id: question.id,
                            label: question.label,
                            type: question.type === "phone" || question.type === "email" ? question.type : "text",
                            required: question.required
                        }))
                        : []
                }]
                : (Array.isArray(section?.questions) ? section.questions : [])
        }))
    }
    if (Array.isArray(schema?.questions)) {
        return [{
            id: "main",
            title: "Основное",
            kind: "default",
            questions: schema.questions
        }]
    }
    return []
}

function formatRepeatableTitle(question: any, index: number) {
    const itemLabel = String(question?.item_label || "").trim()
    const questionLabel = String(question?.label || "").trim()
    const base = itemLabel && itemLabel.toLowerCase() !== "запись" ? itemLabel : (questionLabel || "Запись")
    return `${base.charAt(0).toUpperCase()}${base.slice(1)} ${index + 1}`
}

function formatAnswerValue(question: any, answer: unknown) {
    const type = String(question?.type || "")

    if (type === "boolean") {
        if (answer === true || answer === "true") return "Да"
        if (answer === false || answer === "false") return "Нет"
        return ""
    }

    if (type === "choice") {
        const options = Array.isArray(question?.options) ? question.options : []
        const selected = options.find((option: any) => option?.id === answer)
        return selected?.label || (answer === null || answer === undefined ? "" : String(answer))
    }

    if (type === "multi_choice") {
        const options = Array.isArray(question?.options) ? question.options : []
        const values = Array.isArray(answer) ? answer : []
        return values
            .map((value) => options.find((option: any) => option?.id === value)?.label || String(value))
            .join(", ")
    }

    if (Array.isArray(answer)) return answer.join(", ")
    if (answer === null || answer === undefined) return ""
    return String(answer)
}

function getAnswerPoints(question: any, answer: unknown) {
    const type = String(question?.type || "")

    if (type === "choice") {
        const options = Array.isArray(question?.options) ? question.options : []
        const selected = options.find((option: any) => option?.id === answer)
        return typeof selected?.points === "number" ? selected.points : null
    }

    if (type === "multi_choice") {
        const options = Array.isArray(question?.options) ? question.options : []
        const values = Array.isArray(answer) ? answer : []
        return values.reduce((sum, value) => {
            const selected = options.find((option: any) => option?.id === value)
            return sum + (typeof selected?.points === "number" ? selected.points : 0)
        }, 0)
    }

    if (type === "boolean") {
        if (answer === true || answer === "true") return typeof question?.truePoints === "number" ? question.truePoints : null
        if (answer === false || answer === "false") return typeof question?.falsePoints === "number" ? question.falsePoints : 0
    }

    if (type === "scale" && typeof question?.points === "number") {
        return question.points
    }

    return null
}

function getTestResultSummary(result: any) {
    const label = String(result?.label || "").trim()
    const decision = String(result?.decision || "").trim()
    if (!label && !decision) return ""
    if (label && decision) return `${label} - ${decision}`
    return label || decision
}

const STATUS_OPTIONS = [
    { value: "new", label: "Новая" },
    { value: "reviewed", label: "Просмотрена" },
    { value: "interview", label: "Собеседование" },
    { value: "internship", label: "Стажировка" },
    { value: "rejected", label: "Отказ" },
    { value: "hired", label: "Нанят" }
]

function getStatusLabel(status: string) {
    return STATUS_OPTIONS.find((option) => option.value === status)?.label || status
}

export default function RecruitmentApplicationDetailsPage() {
    const params = useParams<{ clubId: string; applicationId: string }>()
    const router = useRouter()
    const clubId = params.clubId
    const applicationId = params.applicationId

    const [details, setDetails] = useState<ApplicationDetails | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [manualScore, setManualScore] = useState("")
    const [status, setStatus] = useState("new")
    const [isCandidatePhotoOpen, setIsCandidatePhotoOpen] = useState(false)

    const load = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/recruitment/applications/${applicationId}`)
            const data = await res.json()
            if (res.ok) {
                setDetails(data)
                setManualScore(data.manual_score === null || data.manual_score === undefined ? "" : String(data.manual_score))
                setStatus(data.status || "new")
            }
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [clubId, applicationId])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const ms = manualScore.trim() === "" ? null : Number(manualScore)
            const res = await fetch(`/api/clubs/${clubId}/recruitment/applications/${applicationId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status,
                    manual_score: Number.isFinite(ms as any) ? ms : null
                })
            })
            if (res.ok) await load()
        } finally {
            setIsSaving(false)
        }
    }

    const formSections = useMemo(() => normalizeTemplateSections(details?.template_schema), [details?.template_schema])

    const testsById = useMemo(() => {
        const list = Array.isArray(details?.template_tests) ? details.template_tests : []
        const map = new Map<number, any>()
        for (const t of list) map.set(Number(t.id), t)
        return map
    }, [details?.template_tests])

    const applicationTestsList = useMemo(() => (
        Array.isArray(details?.application_tests) ? details.application_tests : []
    ), [details?.application_tests])

    const testsAutoScore = useMemo(
        () => applicationTestsList.reduce((sum: number, test: any) => sum + Number(test?.auto_score || 0), 0),
        [applicationTestsList]
    )

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    <p className="text-sm font-medium text-slate-500 animate-pulse">Загрузка анкеты...</p>
                </div>
            </div>
        )
    }

    if (!details) {
        return (
            <PageShell maxWidth="5xl">
                <Button variant="outline" asChild className="mb-6 rounded-xl border-slate-200">
                    <Link href={`/clubs/${clubId}/employees/recruitment/applications`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Назад к анкетам
                    </Link>
                </Button>
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 font-medium">
                    Анкета не найдена
                </div>
            </PageShell>
        )
    }

    return (
        <PageShell maxWidth="5xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-12">
                <div className="space-y-3">
                    <div className="mb-4 hidden sm:block">
                        <Button variant="ghost" className="h-9 px-3 -ml-3 text-slate-500 hover:text-slate-900 rounded-lg" onClick={() => router.push(`/clubs/${clubId}/employees/recruitment/applications`)}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            К анкетам
                        </Button>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">Анкета</h1>
                    <p className="text-slate-500 text-lg">{details.template_name}</p>
                </div>
                <div className="hidden sm:flex lg:justify-end">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto bg-slate-900 text-white hover:bg-slate-800 rounded-xl h-12 px-8 font-medium shadow-sm">
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="mr-2 h-5 w-5" />Сохранить</>}
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 mb-8">
                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Кандидат</p>
                    <div className="mt-4 flex items-center gap-4">
                        {details.answers?.[CANDIDATE_PHOTO_ANSWER_KEY] ? (
                            <button
                                type="button"
                                onClick={() => setIsCandidatePhotoOpen(true)}
                                className="shrink-0 h-16 w-16 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 transition-opacity hover:opacity-90"
                            >
                                <img
                                    src={details.answers[CANDIDATE_PHOTO_ANSWER_KEY]}
                                    alt={details.candidate_name || "Кандидат"}
                                    className="h-full w-full object-cover"
                                />
                            </button>
                        ) : null}
                        <div className="min-w-0">
                            <p className="text-lg font-bold text-slate-900 truncate">{details.candidate_name || "—"}</p>
                            <p className="text-sm text-slate-500 mt-0.5">{details.candidate_phone || details.candidate_email || ""}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Шаблон</p>
                    <p className="mt-4 text-lg font-bold text-slate-900">{details.template_name}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{details.template_position || "Без позиции"}</p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Оценка</p>
                    <div className="inline-flex px-3 py-1.5 rounded-lg bg-slate-100 text-slate-900 text-sm font-bold mb-4">
                        Баллы тестов: {testsAutoScore}
                    </div>
                    {applicationTestsList.length > 0 ? (
                        <div className="space-y-2">
                            {applicationTestsList.map((t: any) => {
                                const meta = testsById.get(Number(t.test_id))
                                const summary = getTestResultSummary(t.result)
                                return (
                                    <div key={t.test_id} className="rounded-xl bg-slate-50 px-3 py-2.5 space-y-0.5">
                                        <p className="text-xs font-bold text-slate-900 leading-tight">{meta?.name || `Тест #${t.test_id}`}</p>
                                        {summary ? <p className="text-[11px] text-slate-500 leading-tight">{summary}</p> : null}
                                    </div>
                                )
                            })}
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="space-y-8">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8">
                    <div className="max-w-sm space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Статус кандидата</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="h-12 bg-slate-50/50 border-slate-200 hover:border-slate-300 transition-colors rounded-xl font-medium">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 font-medium pt-1">Текущий статус: {getStatusLabel(status)}</p>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-8">
                    <h2 className="text-2xl font-bold text-slate-900">Анкета</h2>
                    
                    <div className="space-y-8">
                        {formSections.map((section: any) => (
                            <div key={section.id || section.title} className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{section.title || "Раздел"}</h3>
                                    {section.description ? <p className="text-sm text-slate-500 mt-1">{section.description}</p> : null}
                                </div>
                                <div className="space-y-6">
                                    {(section.questions || []).map((q: any) => {
                                        const ans = details.answers?.[q.id]
                                        const text = formatAnswerValue(q, ans)
                                        return (
                                            <div key={q.id} className="space-y-2">
                                                <p className="text-sm font-bold text-slate-900">{q.label || q.id}</p>
                                                {q.type === "repeatable_list" ? (
                                                    <div className="space-y-3">
                                                        {(Array.isArray(ans) ? ans : []).length > 0 ? (
                                                            (ans as any[]).map((item: any, itemIndex: number) => (
                                                                <div key={`${q.id}-${itemIndex}`} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 space-y-4">
                                                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{formatRepeatableTitle(q, itemIndex)}</p>
                                                                    <div className="space-y-3">
                                                                        {(q.fields || []).map((field: any) => {
                                                                            const fieldValue = item?.[field.id]
                                                                            const fieldText = Array.isArray(fieldValue) ? fieldValue.join(", ") : (fieldValue === null || fieldValue === undefined ? "" : String(fieldValue))
                                                                            return (
                                                                                <div key={field.id} className="space-y-1">
                                                                                    <p className="text-sm font-medium text-slate-700">{field.label || field.id}</p>
                                                                                    <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">{fieldText || "—"}</p>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-sm text-slate-500 italic">Нет записей</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-600 whitespace-pre-wrap break-words bg-slate-50/50 rounded-xl p-4 border border-slate-100">{text || "—"}</p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="h-px bg-slate-100 last:hidden" />
                            </div>
                        ))}
                    </div>
                </div>

            {applicationTestsList.length > 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900">Тесты</h2>
                    <div className="space-y-4">
                        {applicationTestsList.map((t: any) => {
                            const meta = testsById.get(Number(t.test_id))
                            const qs = meta?.schema?.questions
                            const qList = Array.isArray(qs) ? qs : []
                            const pct = t.score_percent === null || t.score_percent === undefined ? null : Number(t.score_percent)
                            const bandLabel = t.result?.label ? String(t.result.label) : ""
                            const decision = t.result?.decision ? String(t.result.decision) : ""
                            return (
                                <div key={t.test_id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-lg font-bold text-slate-900">{meta?.name || `Тест #${t.test_id}`}</p>
                                            {meta?.description ? <p className="text-sm text-slate-500 mt-1">{meta.description}</p> : null}
                                        </div>
                                        {pct !== null ? (
                                            <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-100 text-slate-900 text-sm font-bold shrink-0">
                                                {t.auto_score ?? 0} баллов ({pct}%)
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">Результат</p>
                                        <p className="mt-2 text-base font-bold text-emerald-950">{bandLabel || "Без диапазона"}</p>
                                        {decision ? <p className="mt-1 text-sm text-emerald-800">{decision}</p> : null}
                                    </div>
                                    <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 group [&_summary::-webkit-details-marker]:hidden">
                                        <summary className="flex items-center justify-between cursor-pointer list-none text-xs font-bold uppercase tracking-widest text-slate-500">
                                            <span>Вопросы и ответы</span>
                                            <span className="transition group-open:rotate-180">
                                                <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                                            </span>
                                        </summary>
                                        <div className="mt-4 space-y-3">
                                            {qList.map((q: any) => {
                                                const ans = t.answers?.[q.id]
                                                const text = formatAnswerValue(q, ans)
                                                const points = getAnswerPoints(q, ans)
                                                return (
                                                    <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
                                                        <p className="text-sm font-bold text-slate-900">{q.label || q.id}</p>
                                                        <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap break-words">
                                                            {text || "—"}
                                                        </p>
                                                        {points !== null ? (
                                                            <div className="mt-2 inline-flex px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-700">
                                                                {points} б.
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </details>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : null}
            </div>

            {details.answers?.[CANDIDATE_PHOTO_ANSWER_KEY] ? (
                <ImageViewer
                    src={details.answers[CANDIDATE_PHOTO_ANSWER_KEY]}
                    alt={details.candidate_name || "Кандидат"}
                    isOpen={isCandidatePhotoOpen}
                    onClose={() => setIsCandidatePhotoOpen(false)}
                />
            ) : null}

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl sm:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="mx-auto flex max-w-5xl gap-2">
                    <Button variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 bg-white font-medium" onClick={() => router.push(`/clubs/${clubId}/employees/recruitment/applications`)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Назад
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="flex-1 h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-medium shadow-sm">
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="mr-2 h-5 w-5" />Сохранить</>}
                    </Button>
                </div>
            </div>
        </PageShell>
    )
}
