"use client"

import { type ChangeEvent, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Send, CheckCircle2, Upload, Trash2 } from "lucide-react"
import type { RecruitmentQuestionType } from "@/lib/recruitment"
import { optimizeFileBeforeUpload } from "@/lib/utils"

type PublicTemplate = {
    id: number
    club_id: number
    name: string
    description: string | null
    position: string | null
    schema: any
}

type PublicTest = {
    id: number
    name: string
    description: string | null
    schema: any
    sort_order: number
}

type PublicFormSection = {
    id: string
    title: string
    description?: string
    kind?: "default" | "repeatable"
    item_label?: string
    questions: any[]
}

const CANDIDATE_PHOTO_ANSWER_KEY = "_candidate_photo_url"

function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(new Error("file_read_failed"))
        reader.readAsDataURL(file)
    })
}

const SYSTEM_QUESTION_IDS = new Set([
    "full_name",
    "fio",
    "name",
    "candidate_name",
    "phone",
    "candidate_phone",
    "email",
    "candidate_email",
])

function normalizeLabel(value: unknown) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
}

function formatItemLabel(value: unknown) {
    const text = String(value || "").trim()
    if (!text) return "Запись"
    return text.charAt(0).toUpperCase() + text.slice(1)
}

function getRepeatableItemTitle(question: any, index: number) {
    const rawItemLabel = String(question?.item_label || "").trim()
    const rawQuestionLabel = String(question?.label || "").trim()
    const baseLabel = !rawItemLabel || rawItemLabel.toLowerCase() === "запись"
        ? (rawQuestionLabel || "Запись")
        : rawItemLabel

    return `${formatItemLabel(baseLabel)} ${index + 1}`
}

function isSystemCandidateQuestion(question: any) {
    const id = String(question?.id || "").trim().toLowerCase()
    const type = String(question?.type || "").trim().toLowerCase()
    const label = normalizeLabel(question?.label)

    if (type === "repeatable_list") return false
    if (type !== "text" && type !== "phone" && type !== "email") return false

    if (SYSTEM_QUESTION_IDS.has(id)) return true
    if (type === "phone" && label.includes("телефон")) return true
    if (type === "email" && label.includes("email")) return true
    if (label === "фио" || label === "имя" || label === "полное имя") return true

    return false
}

function buildSystemCandidateAnswers(questions: any[], values: { name: string; phone: string; email: string }) {
    const answers: Record<string, string> = {}

    for (const q of questions) {
        if (!isSystemCandidateQuestion(q)) continue
        const id = String(q?.id || "").trim()
        const type = String(q?.type || "").trim().toLowerCase()
        const label = normalizeLabel(q?.label)

        if (type === "phone" || label.includes("телефон") || id === "phone" || id === "candidate_phone") {
            answers[id] = values.phone
            continue
        }
        if (type === "email" || label.includes("email") || id === "email" || id === "candidate_email") {
            answers[id] = values.email
            continue
        }
        answers[id] = values.name
    }

    return answers
}

function normalizeFormSections(schema: any): PublicFormSection[] {
    if (Array.isArray(schema?.sections)) {
        return schema.sections.map((section: any) => ({
            id: String(section?.id || crypto.randomUUID?.() || Math.random().toString(16).slice(2)),
            title: String(section?.title || "Раздел"),
            description: section?.description || "",
            kind: "default",
            item_label: "",
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

    const questions = Array.isArray(schema?.questions) ? schema.questions : []
    return [{
        id: "main",
        title: "Основное",
        kind: "default",
        item_label: "",
        questions
    }]
}

export default function ApplyPage() {
    const params = useParams<{ token: string }>()
    const token = params.token

    const [template, setTemplate] = useState<PublicTemplate | null>(null)
    const [tests, setTests] = useState<PublicTest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [step, setStep] = useState(0)
    const [applicationId, setApplicationId] = useState<number | null>(null)

    const [candidateName, setCandidateName] = useState("")
    const [candidatePhone, setCandidatePhone] = useState("")
    const [candidateEmail, setCandidateEmail] = useState("")
    const [candidatePhotoUrl, setCandidatePhotoUrl] = useState("")
    const [isPhotoUploading, setIsPhotoUploading] = useState(false)
    const [formAnswers, setFormAnswers] = useState<Record<string, any>>({})
    const [testAnswersByTestId, setTestAnswersByTestId] = useState<Record<number, Record<string, any>>>({})

    const formSections = useMemo(() => normalizeFormSections(template?.schema), [template?.schema])
    const questions = useMemo(() => formSections.flatMap((section) => section.questions), [formSections])

    const visibleFormSections = useMemo(
        () => formSections
            .map((section) => ({
                ...section,
                questions: section.questions.filter((question: any) => !isSystemCandidateQuestion(question))
            }))
            .filter((section) => section.questions.length > 0),
        [formSections]
    )
    const candidatePhotoMode = useMemo(() => {
        const mode = String(template?.schema?.candidate_photo_mode || "off")
        return mode === "required" || mode === "optional" ? mode : "off"
    }, [template?.schema])

    useEffect(() => {
        const load = async () => {
            setIsLoading(true)
            try {
                const res = await fetch(`/api/public/recruitment/${token}`)
                const data = await res.json()
                if (res.ok) {
                    setTemplate(data.template)
                    setTests(Array.isArray(data.tests) ? data.tests : [])
                }
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [token])

    const setAnswer = (id: string, value: any) => {
        if (step === 0) {
            setFormAnswers(prev => ({ ...prev, [id]: value }))
            return
        }
        if (!currentTest) return
        setTestAnswersByTestId(prev => ({
            ...prev,
            [currentTest.id]: {
                ...(prev[currentTest.id] || {}),
                [id]: value
            }
        }))
    }

    const toggleMulti = (id: string, optionId: string, checked: boolean) => {
        const cur = Array.isArray(currentAnswers[id]) ? (currentAnswers[id] as string[]) : []
        const next = checked ? Array.from(new Set([...cur, optionId])) : cur.filter(v => v !== optionId)
        setAnswer(id, next)
    }

    const setRepeatableAnswer = (questionId: string, itemIndex: number, fieldId: string, value: any) => {
        setFormAnswers(prev => {
            const current = Array.isArray(prev[questionId]) ? ([...prev[questionId]] as Record<string, any>[]) : []
            const row = { ...(current[itemIndex] || {}) }
            row[fieldId] = value
            current[itemIndex] = row
            return { ...prev, [questionId]: current }
        })
    }

    const addRepeatableItem = (questionId: string) => {
        setFormAnswers(prev => {
            const current = Array.isArray(prev[questionId]) ? ([...prev[questionId]] as Record<string, any>[]) : []
            return { ...prev, [questionId]: [...current, {}] }
        })
    }

    const removeRepeatableItem = (questionId: string, itemIndex: number) => {
        setFormAnswers(prev => {
            const current = Array.isArray(prev[questionId]) ? ([...prev[questionId]] as Record<string, any>[]) : []
            current.splice(itemIndex, 1)
            return { ...prev, [questionId]: current }
        })
    }

    const handleCandidatePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsPhotoUploading(true)
        e.target.value = ""

        try {
            const optimizedFile = await optimizeFileBeforeUpload(file, { maxDimension: 1200, quality: 0.8 })
            const dataUrl = await readFileAsDataUrl(optimizedFile)
            setCandidatePhotoUrl(dataUrl)
        } finally {
            setIsPhotoUploading(false)
        }
    }

    const handleSubmit = async () => {
        if (!candidateName.trim() || !candidatePhone.trim()) return
        if (candidatePhotoMode === "required" && !candidatePhotoUrl) return
        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/public/recruitment/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_name: candidateName.trim(),
                    candidate_phone: candidatePhone.trim(),
                    candidate_email: candidateEmail.trim() || null,
                    answers: {
                        ...(candidatePhotoUrl ? { [CANDIDATE_PHOTO_ANSWER_KEY]: candidatePhotoUrl } : {}),
                        ...formAnswers,
                        ...buildSystemCandidateAnswers(questions, {
                            name: candidateName.trim(),
                            phone: candidatePhone.trim(),
                            email: candidateEmail.trim() || ""
                        })
                    }
                })
            })
            const data = await res.json()
            if (res.ok) {
                setApplicationId(data.id)
                if (Array.isArray(data.tests)) setTests(data.tests)
                if (Array.isArray(data.tests) && data.tests.length > 0) {
                    setStep(1)
                } else {
                    setIsSubmitted(true)
                }
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const currentTest = step >= 1 ? tests[step - 1] : null
    const testQuestions = useMemo(() => {
        const qs = currentTest?.schema?.questions
        return Array.isArray(qs) ? qs : []
    }, [currentTest?.schema])

    const currentAnswers = useMemo(() => {
        if (step === 0) return formAnswers
        if (!currentTest) return {}
        return testAnswersByTestId[currentTest.id] || {}
    }, [step, formAnswers, currentTest, testAnswersByTestId])

    const handleSubmitTest = async () => {
        if (!applicationId || !currentTest) return
        setIsSubmitting(true)
        try {
            const isLast = step >= tests.length
            const res = await fetch(`/api/public/recruitment/application/${applicationId}/tests`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    test_id: currentTest.id,
                    answers: currentAnswers,
                    complete: isLast
                })
            })
            if (res.ok) {
                if (isLast) {
                    setIsSubmitted(true)
                } else {
                    setStep(s => s + 1)
                }
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleBack = () => {
        if (step > 0) setStep(s => s - 1)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] dark:bg-background">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!template) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] dark:bg-background p-6">
                <Card className="max-w-lg w-full border-none shadow-sm bg-white">
                    <CardContent className="p-6">
                        <p className="text-sm text-muted-foreground">Ссылка недействительна или анкета отключена</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] dark:bg-background">
            <div className="mx-auto max-w-2xl space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{template.name}</h1>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">{template.description || template.position || ""}</p>
                </div>

                {isSubmitted ? (
                    <Card className="border-none shadow-sm bg-white">
                        <CardContent className="p-8 flex flex-col items-center text-center gap-3">
                            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                            <p className="text-lg font-bold">Спасибо! Анкета отправлена</p>
                            <p className="text-sm text-muted-foreground">Если вы подойдёте — с вами свяжутся</p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-none shadow-sm bg-white">
                        <CardContent className="p-6 space-y-5">
                            {step === 0 ? (
                                <>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ФИО</Label>
                                            <Input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} className="bg-muted/30 border-muted-foreground/10" placeholder="Иван Иванов" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Телефон</Label>
                                            <PhoneInput value={candidatePhone} onChange={setCandidatePhone} placeholder="+7 (___) ___-__-__" className="bg-muted/30 border-muted-foreground/10" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email (опционально)</Label>
                                        <Input value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} className="bg-muted/30 border-muted-foreground/10" placeholder="name@example.com" />
                                    </div>
                                    {candidatePhotoMode !== "off" ? (
                                        <div className="space-y-2 rounded-xl border border-muted-foreground/10 p-4">
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold">
                                                    Фото кандидата
                                                    {candidatePhotoMode === "required" ? <span className="text-rose-600"> *</span> : null}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {candidatePhotoMode === "required" ? "Фото обязательно для отправки анкеты" : "Можно прикрепить фото по желанию"}
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                                                    {isPhotoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                    {isPhotoUploading ? "Загрузка..." : (candidatePhotoUrl ? "Заменить фото" : "Загрузить фото")}
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleCandidatePhotoUpload} />
                                                </label>
                                                {candidatePhotoUrl ? (
                                                    <Button variant="outline" type="button" onClick={() => setCandidatePhotoUrl("")}>
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Удалить фото
                                                    </Button>
                                                ) : null}
                                            </div>
                                            {candidatePhotoUrl ? (
                                                <div className="overflow-hidden rounded-xl border border-muted-foreground/10 bg-muted/20">
                                                    <img src={candidatePhotoUrl} alt="Фото кандидата" className="max-h-80 w-full object-contain" />
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <div className="space-y-5">
                                        {visibleFormSections.map((section) => {
                                            return (
                                                <div key={section.id} className="space-y-3">
                                                    <div className="space-y-1">
                                                        <h2 className="text-base font-bold tracking-tight">{section.title}</h2>
                                                        {section.description ? <p className="text-xs text-muted-foreground">{section.description}</p> : null}
                                                    </div>

                                                    <div className="space-y-4">
                                                            {section.questions.map((q: any) => {
                                                                const type = q.type as RecruitmentQuestionType
                                                                const val = currentAnswers[q.id]
                                                                return (
                                                                    <div key={q.id} className="space-y-2 rounded-xl border border-muted-foreground/10 p-4">
                                                                        <div className="space-y-1">
                                                                            <p className="text-sm font-bold">
                                                                                {q.label || q.id}
                                                                                {q.required ? <span className="text-rose-600"> *</span> : null}
                                                                            </p>
                                                                            {q.description ? <p className="text-xs text-muted-foreground">{q.description}</p> : null}
                                                                        </div>
                                                                        {q.image_url ? (
                                                                            <div className="overflow-hidden rounded-xl border border-muted-foreground/10 bg-muted/20">
                                                                                <img src={q.image_url} alt={q.label || "Вопрос"} className="max-h-72 w-full object-contain" />
                                                                            </div>
                                                                        ) : null}
                                                                        {type === "text" && <Textarea value={val || ""} onChange={(e) => setAnswer(q.id, e.target.value)} className="bg-muted/30 border-muted-foreground/10" />}
                                                                        {type === "phone" && <PhoneInput value={val || ""} onChange={(v) => setAnswer(q.id, v)} placeholder="+7 (___) ___-__-__" className="bg-muted/30 border-muted-foreground/10" />}
                                                                        {type === "email" && <Input value={val || ""} onChange={(e) => setAnswer(q.id, e.target.value)} className="bg-muted/30 border-muted-foreground/10" placeholder="name@example.com" />}
                                                                        {type === "choice" && (
                                                                            <div className="space-y-2">
                                                                                {(q.options || []).map((o: any) => {
                                                                                    const checked = val === o.id
                                                                                    return (
                                                                                        <button key={o.id} type="button" onClick={() => setAnswer(q.id, o.id)} className="flex w-full items-center gap-2 rounded-lg border border-muted-foreground/10 p-2 text-left cursor-pointer">
                                                                                            <span className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${checked ? "border-primary" : "border-muted-foreground/30"}`}>
                                                                                                <span className={`h-2.5 w-2.5 rounded-full ${checked ? "bg-primary" : "bg-transparent"}`} />
                                                                                            </span>
                                                                                            <span className="text-sm">{o.label}</span>
                                                                                        </button>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                        {type === "multi_choice" && (
                                                                            <div className="space-y-2">
                                                                                {(q.options || []).map((o: any) => {
                                                                                    const checked = Array.isArray(val) ? val.includes(o.id) : false
                                                                                    return (
                                                                                        <label key={o.id} className="flex items-center gap-2 rounded-lg border border-muted-foreground/10 p-2 cursor-pointer">
                                                                                            <Checkbox checked={checked} onCheckedChange={(v) => toggleMulti(q.id, o.id, Boolean(v))} />
                                                                                            <span className="text-sm">{o.label}</span>
                                                                                        </label>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                        {type === "boolean" && (
                                                                            <Select value={val === true ? "true" : val === false ? "false" : ""} onValueChange={(v) => setAnswer(q.id, v === "true")}>
                                                                                <SelectTrigger className="bg-muted/30 border-muted-foreground/10">
                                                                                    <SelectValue placeholder="Выберите" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="true" className="text-xs">Да</SelectItem>
                                                                                    <SelectItem value="false" className="text-xs">Нет</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        )}
                                                                        {type === "repeatable_list" && (
                                                                            <div className="space-y-3">
                                                                                {(Array.isArray(val) ? (val as Record<string, any>[]) : []).map((item, itemIndex) => (
                                                                                    <div key={`${q.id}-${itemIndex}`} className="space-y-4 rounded-xl border border-muted-foreground/10 p-4">
                                                                                        <div className="flex items-center justify-between gap-3 border-b border-muted-foreground/10 pb-3">
                                                                                            <p className="text-sm font-semibold tracking-tight">
                                                                                                {getRepeatableItemTitle(q, itemIndex)}
                                                                                            </p>
                                                                                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => removeRepeatableItem(q.id, itemIndex)}>
                                                                                                Удалить
                                                                                            </Button>
                                                                                        </div>
                                                                                        {(q.fields || []).map((field: any) => {
                                                                                            const fieldVal = item?.[field.id]
                                                                                            return (
                                                                                                <div key={field.id} className="space-y-1.5">
                                                                                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                                                                        {field.label}
                                                                                                        {field.required ? <span className="text-rose-600"> *</span> : null}
                                                                                                    </Label>
                                                                                                    {field.type === "text" && (
                                                                                                        <Input value={fieldVal || ""} onChange={(e) => setRepeatableAnswer(q.id, itemIndex, field.id, e.target.value)} className="bg-muted/30 border-muted-foreground/10" />
                                                                                                    )}
                                                                                                    {field.type === "phone" && (
                                                                                                        <PhoneInput value={fieldVal || ""} onChange={(v) => setRepeatableAnswer(q.id, itemIndex, field.id, v)} placeholder="+7 (___) ___-__-__" className="bg-muted/30 border-muted-foreground/10" />
                                                                                                    )}
                                                                                                    {field.type === "email" && (
                                                                                                        <Input value={fieldVal || ""} onChange={(e) => setRepeatableAnswer(q.id, itemIndex, field.id, e.target.value)} className="bg-muted/30 border-muted-foreground/10" placeholder="name@example.com" />
                                                                                                    )}
                                                                                                </div>
                                                                                            )
                                                                                        })}
                                                                                    </div>
                                                                                ))}
                                                                                {!Array.isArray(val) || val.length === 0 ? (
                                                                                    <div className="rounded-xl border border-dashed border-muted-foreground/20 p-4 text-sm text-muted-foreground">
                                                                                        Пока нет записей
                                                                                    </div>
                                                                                ) : null}
                                                                                <Button variant="outline" className="w-full" onClick={() => addRepeatableItem(q.id)}>
                                                                                    Добавить {q.item_label || "запись"}
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <Button onClick={handleSubmit} disabled={isSubmitting || (candidatePhotoMode === "required" && !candidatePhotoUrl)} className="w-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                        Дальше
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold">
                                            Тест {step} / {tests.length}: {currentTest?.name}
                                        </p>
                                        {currentTest?.description ? <p className="text-xs text-muted-foreground">{currentTest.description}</p> : null}
                                    </div>

                                    <div className="space-y-4">
                                        {testQuestions.map((q: any) => {
                                            const type = q.type as RecruitmentQuestionType
                                            const val = currentAnswers[q.id]
                                            return (
                                                <div key={q.id} className="space-y-2 rounded-xl border border-muted-foreground/10 p-4">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-bold">
                                                            {q.label || q.id}
                                                            {q.required ? <span className="text-rose-600"> *</span> : null}
                                                        </p>
                                                        {q.description ? <p className="text-xs text-muted-foreground">{q.description}</p> : null}
                                                    </div>
                                                    {q.image_url ? (
                                                        <div className="overflow-hidden rounded-xl border border-muted-foreground/10 bg-muted/20">
                                                            <img src={q.image_url} alt={q.label || "Вопрос"} className="max-h-72 w-full object-contain" />
                                                        </div>
                                                    ) : null}

                                                    {type === "text" && (
                                                        <Textarea value={val || ""} onChange={(e) => setAnswer(q.id, e.target.value)} className="bg-muted/30 border-muted-foreground/10" />
                                                    )}

                                                    {type === "phone" && (
                                                        <PhoneInput value={val || ""} onChange={(v) => setAnswer(q.id, v)} placeholder="+7 (___) ___-__-__" className="bg-muted/30 border-muted-foreground/10" />
                                                    )}

                                                    {type === "email" && (
                                                        <Input value={val || ""} onChange={(e) => setAnswer(q.id, e.target.value)} className="bg-muted/30 border-muted-foreground/10" placeholder="name@example.com" />
                                                    )}

                                                    {type === "choice" && (
                                                        <div className="space-y-2">
                                                            {(q.options || []).map((o: any) => {
                                                                const checked = val === o.id
                                                                return (
                                                                    <button
                                                                        key={o.id}
                                                                        type="button"
                                                                        onClick={() => setAnswer(q.id, o.id)}
                                                                        className="flex w-full items-center gap-2 rounded-lg border border-muted-foreground/10 p-2 text-left cursor-pointer"
                                                                    >
                                                                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${checked ? "border-primary" : "border-muted-foreground/30"}`}>
                                                                            <span className={`h-2.5 w-2.5 rounded-full ${checked ? "bg-primary" : "bg-transparent"}`} />
                                                                        </span>
                                                                        <span className="text-sm">{o.label}</span>
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    )}

                                                    {type === "multi_choice" && (
                                                        <div className="space-y-2">
                                                            {(q.options || []).map((o: any) => {
                                                                const checked = Array.isArray(val) ? val.includes(o.id) : false
                                                                return (
                                                                    <label key={o.id} className="flex items-center gap-2 rounded-lg border border-muted-foreground/10 p-2 cursor-pointer">
                                                                        <Checkbox checked={checked} onCheckedChange={(v) => toggleMulti(q.id, o.id, Boolean(v))} />
                                                                        <span className="text-sm">{o.label}</span>
                                                                    </label>
                                                                )
                                                            })}
                                                        </div>
                                                    )}

                                                    {type === "scale" && (
                                                        <Select value={val === null || val === undefined ? "" : String(val)} onValueChange={(v) => setAnswer(q.id, Number(v))}>
                                                            <SelectTrigger className="bg-muted/30 border-muted-foreground/10">
                                                                <SelectValue placeholder="Выберите" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {Array.from({ length: (Number(q.max ?? 5) - Number(q.min ?? 1) + 1) }, (_, i) => Number(q.min ?? 1) + i).map(n => (
                                                                    <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}

                                                    {type === "boolean" && (
                                                        <Select value={val === true ? "true" : val === false ? "false" : ""} onValueChange={(v) => setAnswer(q.id, v === "true")}>
                                                            <SelectTrigger className="bg-muted/30 border-muted-foreground/10">
                                                                <SelectValue placeholder="Выберите" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="true" className="text-xs">Да</SelectItem>
                                                                <SelectItem value="false" className="text-xs">Нет</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <Button variant="outline" onClick={handleBack} disabled={isSubmitting} className="w-full sm:w-auto">
                                            Назад
                                        </Button>
                                        <Button onClick={handleSubmitTest} disabled={isSubmitting} className="w-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                            {step >= tests.length ? "Завершить" : "Следующий тест"}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
