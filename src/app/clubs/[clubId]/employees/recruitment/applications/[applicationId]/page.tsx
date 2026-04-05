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
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!details) {
        return (
            <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
                <Button variant="outline" asChild>
                    <Link href={`/clubs/${clubId}/employees/recruitment/applications`}>Назад к анкетам</Link>
                </Button>
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-8 text-sm text-muted-foreground">Анкета не найдена</CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-5xl space-y-5 p-4 pb-28 sm:space-y-6 sm:p-6 sm:pb-6 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="mb-3 hidden sm:block">
                        <Button variant="outline" onClick={() => router.push(`/clubs/${clubId}/employees/recruitment/applications`)}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            К анкетам
                        </Button>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Анкета</h1>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">{details.template_name}</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="hidden w-full bg-primary text-primary-foreground shadow-lg sm:inline-flex sm:w-auto">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" />Сохранить</>}
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Кандидат</p>
                        <div className="mt-2 flex items-center gap-3">
                            {details.answers?.[CANDIDATE_PHOTO_ANSWER_KEY] ? (
                                <button
                                    type="button"
                                    onClick={() => setIsCandidatePhotoOpen(true)}
                                    className="block h-14 w-14 overflow-hidden rounded-full border border-muted-foreground/10 bg-muted/20 transition-opacity hover:opacity-90"
                                >
                                    <img
                                        src={details.answers[CANDIDATE_PHOTO_ANSWER_KEY]}
                                        alt={details.candidate_name || "Кандидат"}
                                        className="h-full w-full object-cover"
                                    />
                                </button>
                            ) : null}
                            <div className="min-w-0">
                                <p className="text-sm font-bold">{details.candidate_name || "—"}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{details.candidate_phone || details.candidate_email || ""}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Шаблон</p>
                        <p className="mt-1 text-sm font-bold">{details.template_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{details.template_position || ""}</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Оценка</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                            <Badge className="bg-muted text-foreground">Баллы тестов: {testsAutoScore}</Badge>
                        </div>
                        {applicationTestsList.length > 0 ? (
                            <div className="mt-3 space-y-2">
                                {applicationTestsList.map((t: any) => {
                                    const meta = testsById.get(Number(t.test_id))
                                    const summary = getTestResultSummary(t.result)
                                    return (
                                        <div key={t.test_id} className="rounded-lg border border-muted-foreground/10 bg-muted/20 px-2.5 py-2">
                                            <p className="text-[11px] font-bold leading-tight">{meta?.name || `Тест #${t.test_id}`}</p>
                                            {summary ? <p className="mt-1 text-[11px] text-muted-foreground leading-tight">{summary}</p> : null}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Статус</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="bg-muted/30 border-muted-foreground/10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Текущий статус: {getStatusLabel(status)}</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-5 space-y-4">
                    <p className="text-sm font-bold">Анкета</p>
                    {formSections.map((section: any) => (
                        <div key={section.id || section.title} className="space-y-2 rounded-xl border border-muted-foreground/10 p-4">
                            <p className="text-sm font-bold">{section.title || "Раздел"}</p>
                            {section.description ? <p className="text-xs text-muted-foreground">{section.description}</p> : null}
                            <div className="space-y-3">
                                {(section.questions || []).map((q: any) => {
                                    const ans = details.answers?.[q.id]
                                    const text = formatAnswerValue(q, ans)
                                    return (
                                        <div key={q.id} className="space-y-1">
                                            <p className="text-xs font-bold">{q.label || q.id}</p>
                                            {q.type === "repeatable_list" ? (
                                                <div className="space-y-3">
                                                    {(Array.isArray(ans) ? ans : []).length > 0 ? (
                                                        (ans as any[]).map((item: any, itemIndex: number) => (
                                                            <div key={`${q.id}-${itemIndex}`} className="rounded-xl border border-muted-foreground/10 p-3 space-y-2">
                                                                <p className="text-xs font-bold">{formatRepeatableTitle(q, itemIndex)}</p>
                                                                {(q.fields || []).map((field: any) => {
                                                                    const fieldValue = item?.[field.id]
                                                                    const fieldText = Array.isArray(fieldValue) ? fieldValue.join(", ") : (fieldValue === null || fieldValue === undefined ? "" : String(fieldValue))
                                                                    return (
                                                                        <div key={field.id} className="space-y-0.5">
                                                                            <p className="text-xs font-bold">{field.label || field.id}</p>
                                                                            <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{fieldText || "—"}</p>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">Нет записей</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{text || "—"}</p>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {applicationTestsList.length > 0 ? (
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-5 space-y-3">
                        <p className="text-sm font-bold">Тесты</p>
                        {applicationTestsList.map((t: any) => {
                            const meta = testsById.get(Number(t.test_id))
                            const qs = meta?.schema?.questions
                            const qList = Array.isArray(qs) ? qs : []
                            const pct = t.score_percent === null || t.score_percent === undefined ? null : Number(t.score_percent)
                            const bandLabel = t.result?.label ? String(t.result.label) : ""
                            const decision = t.result?.decision ? String(t.result.decision) : ""
                            return (
                                <div key={t.test_id} className="space-y-3 rounded-xl border border-muted-foreground/10 p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold">{meta?.name || `Тест #${t.test_id}`}</p>
                                            <p className="truncate text-xs text-muted-foreground">{meta?.description || ""}</p>
                                        </div>
                                        {pct !== null ? <Badge className="bg-muted text-foreground">{t.auto_score ?? 0} баллов ({pct}%)</Badge> : null}
                                    </div>
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Результат</p>
                                        <p className="mt-1 text-sm font-bold text-emerald-950">{bandLabel || "Без диапазона"}</p>
                                        {decision ? <p className="mt-1 text-xs text-emerald-800">{decision}</p> : null}
                                    </div>
                                    <details className="rounded-xl border border-muted-foreground/10 bg-muted/10 px-3 py-2">
                                        <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Вопросы и ответы
                                        </summary>
                                        <div className="mt-3 space-y-3">
                                            {qList.map((q: any) => {
                                                const ans = t.answers?.[q.id]
                                                const text = formatAnswerValue(q, ans)
                                                const points = getAnswerPoints(q, ans)
                                                return (
                                                    <div key={q.id} className="rounded-lg border border-muted-foreground/10 p-3">
                                                        <p className="text-xs font-bold">{q.label || q.id}</p>
                                                        <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                                            {text || "—"}
                                                        </p>
                                                        {points !== null ? (
                                                            <p className="mt-1 text-[11px] font-bold text-foreground">{points} б.</p>
                                                        ) : null}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </details>
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>
            ) : null}

            {details.answers?.[CANDIDATE_PHOTO_ANSWER_KEY] ? (
                <ImageViewer
                    src={details.answers[CANDIDATE_PHOTO_ANSWER_KEY]}
                    alt={details.candidate_name || "Кандидат"}
                    isOpen={isCandidatePhotoOpen}
                    onClose={() => setIsCandidatePhotoOpen(false)}
                />
            ) : null}

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-muted-foreground/10 bg-background/95 p-4 backdrop-blur sm:hidden">
                <div className="mx-auto flex max-w-5xl gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => router.push(`/clubs/${clubId}/employees/recruitment/applications`)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Назад
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="flex-1 bg-primary text-primary-foreground shadow-lg">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" />Сохранить</>}
                    </Button>
                </div>
            </div>
        </div>
    )
}
