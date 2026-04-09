"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { PageShell } from "@/components/layout/PageShell"
import { Clipboard, Loader2, Plus, RotateCcw, Trash2, ArrowUp, ArrowDown, Link2, ArrowLeft } from "lucide-react"
import type { RecruitmentFormSection, RecruitmentQuestionType, RecruitmentRepeatableFieldType, RecruitmentTemplateSchemaV1 } from "@/lib/recruitment"
import { QRCode } from "@/components/qr/QRCode"

type Template = {
    id: number
    club_id: number
    name: string
    description: string | null
    position: string | null
    schema: any
    tests?: any[]
    public_token: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

type QuestionDraft = {
    id: string
    type: RecruitmentQuestionType
    label: string
    description?: string
    image_url?: string
    required?: boolean
    points?: number
    options?: { id: string; label: string; points?: number }[]
    item_label?: string
    fields?: { id: string; label: string; type: RecruitmentRepeatableFieldType; required?: boolean }[]
    min?: number
    max?: number
    truePoints?: number
    falsePoints?: number
}

type SectionDraft = {
    id: string
    title: string
    description?: string
    questions: QuestionDraft[]
}

function safeSchema(raw: any): RecruitmentTemplateSchemaV1 {
    if (raw && typeof raw === "object" && Array.isArray(raw.sections)) {
        return {
            version: 1,
            candidate_photo_mode: raw.candidate_photo_mode === "required" || raw.candidate_photo_mode === "optional" ? raw.candidate_photo_mode : "off",
            sections: raw.sections.map((section: any) => {
                if (section?.kind === "repeatable") {
                    return {
                        id: section.id,
                        title: section.title,
                        description: section.description,
                        questions: [
                            {
                                id: `${section.id}_list`,
                                type: "repeatable_list",
                                label: section.title || "Список",
                                description: section.description || "",
                                item_label: section.item_label || "запись",
                                fields: Array.isArray(section.questions)
                                    ? section.questions.map((q: any) => ({
                                        id: q.id,
                                        label: q.label,
                                        type: q.type === "phone" || q.type === "email" ? q.type : "text",
                                        required: q.required
                                    }))
                                    : []
                            }
                        ]
                    }
                }
                return {
                    id: section.id,
                    title: section.title,
                    description: section.description,
                    questions: Array.isArray(section.questions) ? section.questions : []
                }
            }) as any
        }
    }
    if (raw && typeof raw === "object" && Array.isArray(raw.questions)) {
        return {
            version: 1,
            candidate_photo_mode: raw.candidate_photo_mode === "required" || raw.candidate_photo_mode === "optional" ? raw.candidate_photo_mode : "off",
            sections: [
                {
                    id: "main",
                    title: "Основное",
                    kind: "default",
                    questions: raw.questions as any
                }
            ]
        }
    }
    return { version: 1, candidate_photo_mode: "off", sections: [] }
}

function makeId(prefix: string) {
    return `${prefix}_${Math.random().toString(16).slice(2, 10)}`
}

export default function RecruitmentTemplateEditPage() {
    const params = useParams<{ clubId: string; templateId: string }>()
    const router = useRouter()
    const clubId = params.clubId
    const templateId = params.templateId

    const [origin, setOrigin] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [template, setTemplate] = useState<Template | null>(null)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [position, setPosition] = useState("")
    const [isActive, setIsActive] = useState(true)
    const [schema, setSchema] = useState<RecruitmentTemplateSchemaV1>({ version: 1, candidate_photo_mode: "off", sections: [] })
    const [rawMode, setRawMode] = useState(false)
    const [rawSchemaText, setRawSchemaText] = useState("")
    const [allTests, setAllTests] = useState<any[]>([])
    const [attachedTests, setAttachedTests] = useState<any[]>([])
    const [attachTestId, setAttachTestId] = useState<string>("")
    const [lastSavedPayload, setLastSavedPayload] = useState("")

    const publicUrl = useMemo(() => {
        if (!origin || !template?.public_token) return ""
        return `${origin}/apply/${template.public_token}`
    }, [origin, template?.public_token])

    const currentSavePayload = useMemo(() => JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        position: position || null,
        is_active: isActive,
        schema,
        tests: attachedTests.map(t => t.id)
    }), [name, description, position, isActive, schema, attachedTests])

    const load = async () => {
        setIsLoading(true)
        try {
            const [tRes, testsRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/recruitment/templates/${templateId}`),
                fetch(`/api/clubs/${clubId}/recruitment/tests`)
            ])
            const [data, testsData] = await Promise.all([tRes.json(), testsRes.json()])
            if (tRes.ok) {
                setTemplate(data)
                setName(data.name || "")
                setDescription(data.description || "")
                setPosition(data.position || "")
                setIsActive(Boolean(data.is_active))
                const s = safeSchema(data.schema)
                setSchema(s)
                setRawSchemaText(JSON.stringify(s, null, 2))
                setAttachedTests(Array.isArray(data.tests) ? data.tests : [])
                setLastSavedPayload(JSON.stringify({
                    name: (data.name || "").trim(),
                    description: data.description || null,
                    position: data.position || null,
                    is_active: Boolean(data.is_active),
                    schema: s,
                    tests: Array.isArray(data.tests) ? data.tests.map((t: any) => t.id) : []
                }))
            }
            if (testsRes.ok) setAllTests(Array.isArray(testsData) ? testsData : [])
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (typeof window !== "undefined") setOrigin(window.location.origin)
        load()
    }, [clubId, templateId])

    const updateSection = (sectionId: string, patch: Partial<SectionDraft>) => {
        setSchema(prev => ({
            ...prev,
            sections: (prev.sections || []).map((section: any) => section.id === sectionId ? { ...section, ...patch } : section)
        }))
    }

    const addSection = () => {
        const section: SectionDraft = {
            id: makeId("section"),
            title: "Новый раздел",
            description: "",
            questions: []
        }
        setSchema(prev => ({ ...prev, sections: [...(prev.sections || []), section as RecruitmentFormSection] }))
    }

    const deleteSection = (sectionId: string) => {
        setSchema(prev => ({ ...prev, sections: (prev.sections || []).filter((section: any) => section.id !== sectionId) }))
    }

    const moveSection = (sectionId: string, direction: -1 | 1) => {
        setSchema(prev => {
            const sections = [...(prev.sections || [])]
            const index = sections.findIndex((item: any) => item.id === sectionId)
            const target = index + direction
            if (index === -1 || target < 0 || target >= sections.length) return prev
            const next = [...sections]
            const current = next[index]
            next[index] = next[target]
            next[target] = current
            return { ...prev, sections: next }
        })
    }

    const updateQuestion = (sectionId: string, id: string, patch: Partial<QuestionDraft>) => {
        setSchema(prev => ({
            ...prev,
            sections: (prev.sections || []).map((section: any) => {
                if (section.id !== sectionId) return section
                return {
                    ...section,
                    questions: (section.questions || []).map((q: any) => (q.id === id ? { ...q, ...patch } : q))
                }
            })
        }))
    }

    const deleteQuestion = (sectionId: string, id: string) => {
        setSchema(prev => ({
            ...prev,
            sections: (prev.sections || []).map((section: any) => {
                if (section.id !== sectionId) return section
                return { ...section, questions: (section.questions || []).filter((q: any) => q.id !== id) }
            })
        }))
    }

    const moveQuestion = (sectionId: string, id: string, direction: -1 | 1) => {
        setSchema(prev => ({
            ...prev,
            sections: (prev.sections || []).map((section: any) => {
                if (section.id !== sectionId) return section
                const questions = [...(section.questions || [])]
                const index = questions.findIndex((item: any) => item.id === id)
                const target = index + direction
                if (index === -1 || target < 0 || target >= questions.length) return section
                const next = [...questions]
                const current = next[index]
                next[index] = next[target]
                next[target] = current
                return { ...section, questions: next }
            })
        }))
    }

    const addQuestion = (sectionId: string, type: RecruitmentQuestionType) => {
        const q: QuestionDraft = {
            id: makeId("q"),
            type,
            label: "Новый вопрос",
            required: false
        }
        if (type === "choice" || type === "multi_choice") {
            q.options = [
                { id: makeId("opt"), label: "Вариант 1", points: 0 },
                { id: makeId("opt"), label: "Вариант 2", points: 0 }
            ]
        }
        if (type === "scale") {
            q.min = 1
            q.max = 5
        }
        if (type === "boolean") {
            q.truePoints = 1
            q.falsePoints = 0
        }
        if (type === "repeatable_list") {
            q.item_label = "запись"
            q.fields = [
                { id: makeId("field"), label: "Период / год", type: "text", required: false },
                { id: makeId("field"), label: "Описание", type: "text", required: false }
            ]
        }
        setSchema(prev => ({
            ...prev,
            sections: (prev.sections || []).map((section: any) => {
                if (section.id !== sectionId) return section
                return { ...section, questions: [...(section.questions || []), q as any] }
            })
        }))
    }

    const changeQuestionType = (sectionId: string, questionId: string, type: RecruitmentQuestionType) => {
        const patch: Partial<QuestionDraft> = { type }
        if (type === "choice" || type === "multi_choice") {
            patch.options = [
                { id: makeId("opt"), label: "Вариант 1", points: 0 },
                { id: makeId("opt"), label: "Вариант 2", points: 0 }
            ]
        }
        if (type === "boolean") {
            patch.truePoints = 1
            patch.falsePoints = 0
        }
        if (type === "repeatable_list") {
            patch.item_label = "запись"
            patch.fields = [
                { id: makeId("field"), label: "Период / год", type: "text", required: false },
                { id: makeId("field"), label: "Описание", type: "text", required: false }
            ]
        }
        updateQuestion(sectionId, questionId, patch)
    }

    const handleSave = async () => {
        const finalSchema = rawMode ? (() => {
            try {
                return JSON.parse(rawSchemaText)
            } catch {
                return schema
            }
        })() : schema

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/recruitment/templates/${templateId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                    position: position || null,
                    is_active: isActive,
                    schema: finalSchema,
                    tests: attachedTests.map(t => t.id)
                })
            })
            const data = await res.json()
            if (res.ok) {
                setTemplate(data)
                setDescription(data.description || "")
                const s = safeSchema(data.schema)
                setSchema(s)
                setRawSchemaText(JSON.stringify(s, null, 2))
                setAttachedTests(Array.isArray(data.tests) ? data.tests : attachedTests)
                setLastSavedPayload(JSON.stringify({
                    name: String(data.name || "").trim(),
                    description: data.description || null,
                    position: data.position || null,
                    is_active: Boolean(data.is_active),
                    schema: s,
                    tests: Array.isArray(data.tests) ? data.tests.map((t: any) => t.id) : attachedTests.map(t => t.id)
                }))
            }
        } finally {
            setIsSaving(false)
        }
    }

    useEffect(() => {
        if (isLoading || rawMode || isSaving || !lastSavedPayload) return
        if (currentSavePayload === lastSavedPayload) return

        const timer = window.setTimeout(() => {
            handleSave()
        }, 700)

        return () => window.clearTimeout(timer)
    }, [currentSavePayload, lastSavedPayload, isLoading, rawMode, isSaving])

    const handleRotateToken = async () => {
        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/recruitment/templates/${templateId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rotate_token: true })
            })
            const data = await res.json()
            if (res.ok) setTemplate(data)
        } finally {
            setIsSaving(false)
        }
    }

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
        } catch {}
    }

    const handleAttach = () => {
        const id = Number(attachTestId)
        if (!Number.isFinite(id)) return
        if (attachedTests.some(t => Number(t.id) === id)) return
        const test = allTests.find(t => Number(t.id) === id)
        if (!test) return
        setAttachedTests(prev => [...prev, test])
        setAttachTestId("")
    }

    const moveAttached = (index: number, dir: -1 | 1) => {
        setAttachedTests(prev => {
            const next = [...prev]
            const j = index + dir
            if (j < 0 || j >= next.length) return prev
            const tmp = next[index]
            next[index] = next[j]
            next[j] = tmp
            return next
        })
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!template) {
        return (
            <div className="mx-auto max-w-3xl p-6">
                <p className="text-sm text-muted-foreground">Шаблон не найден</p>
                <Button variant="outline" onClick={() => router.back()} className="mt-4">Назад</Button>
            </div>
        )
    }

    return (
        <PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">{template.name}</h1>
                        {!isActive && <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Неактивен</Badge>}
                    </div>
                    <p className="text-slate-500 text-lg mt-2">Здесь настраивается анкета кандидата: разделы, вопросы и тесты, которые он проходит</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                    <Button asChild variant="outline" className="hidden sm:inline-flex sm:w-auto">
                        <Link href={`/clubs/${clubId}/employees/recruitment/templates`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="hidden w-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 rounded-xl h-11 px-6 font-medium sm:inline-flex sm:w-auto">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Сохранить
                    </Button>
                </div>
            </div>

            <div className="grid min-w-0 gap-4 lg:grid-cols-3">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 lg:col-span-1 flex flex-col gap-6">
                    <div className="space-y-6">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Название</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Описание</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="min-h-[96px] resize-y bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white p-3"
                                placeholder="Короткое описание анкеты"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Позиция</Label>
                            <Input value={position} onChange={(e) => setPosition(e.target.value)} className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white" />
                        </div>
                        <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900">Активен</p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Если выключить — ссылка перестанет работать</p>
                            </div>
                            <Switch checked={isActive} onCheckedChange={setIsActive} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Фото кандидата</Label>
                            <Select
                                value={schema.candidate_photo_mode || "off"}
                                onValueChange={(value) => setSchema(prev => ({ ...prev, candidate_photo_mode: value as "off" | "optional" | "required" }))}
                            >
                                <SelectTrigger className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="off" className="text-xs">Не запрашивать</SelectItem>
                                    <SelectItem value="optional" className="text-xs">Запрашивать по желанию</SelectItem>
                                    <SelectItem value="required" className="text-xs">Запрашивать обязательно</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">Фото будет отображаться отдельным блоком в начале публичной анкеты</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ссылка</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Input value={publicUrl} readOnly className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white" />
                                <Button variant="outline" className="w-full sm:w-auto" onClick={() => publicUrl && handleCopy(publicUrl)} disabled={!publicUrl}>
                                    <Clipboard className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" className="w-full" onClick={handleRotateToken} disabled={isSaving}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Ротировать ссылку
                                </Button>
                            </div>
                            {publicUrl ? (
                                <div className="flex justify-center pt-2">
                                    <QRCode value={publicUrl} downloadable filename={`${name || "recruitment-form"}-qr`} />
                                </div>
                            ) : null}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Тесты после анкеты</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Select value={attachTestId} onValueChange={setAttachTestId}>
                                    <SelectTrigger className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white">
                                        <SelectValue placeholder="Выбрать тест" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allTests.map(t => (
                                            <SelectItem key={t.id} value={String(t.id)} className="text-xs">{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" className="w-full shrink-0 sm:w-auto" onClick={handleAttach} disabled={!attachTestId}>
                                    <Link2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {attachedTests.length === 0 ? (
                                    <div className="text-xs text-slate-500 font-medium mt-0.5">Нет тестов</div>
                                ) : attachedTests.map((t, i) => (
                                    <div key={t.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-slate-900 truncate">{t.name}</div>
                                            <div className="text-xs text-slate-500 font-medium mt-0.5 truncate">{t.description || ""}</div>
                                        </div>
                                        <div className="flex gap-1 self-end sm:self-auto">
                                            <Button variant="outline" size="icon" onClick={() => moveAttached(i, -1)} disabled={i === 0}>
                                                <ArrowUp className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={() => moveAttached(i, 1)} disabled={i === attachedTests.length - 1}>
                                                <ArrowDown className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={() => setAttachedTests(prev => prev.filter(x => x.id !== t.id))}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900">RAW JSON</p>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Для быстрых правок схемы</p>
                            </div>
                            <Switch checked={rawMode} onCheckedChange={setRawMode} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6 lg:col-span-2">
                    <div className="space-y-6">
                        {rawMode ? (
                            <Textarea
                                value={rawSchemaText}
                                onChange={(e) => setRawSchemaText(e.target.value)}
                                className="min-h-[520px] font-mono text-xs bg-muted/30 border-muted-foreground/10"
                            />
                        ) : (
                            <div className="space-y-3">
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                                    <span className="font-bold">Системные поля анкеты:</span> ФИО, телефон и email уже собираются автоматически в начале формы.
                                    Не добавляй их повторно в шаблон анкеты, иначе будет дублирование.
                                </div>
                                <div className="rounded-xl border border-muted-foreground/10 bg-muted/20 p-3 text-xs text-slate-500 font-medium mt-0.5">
                                    Анкета должна собирать информацию о кандидате. Оценка и баллы должны жить в тестах, а не в анкете.
                                </div>
                                <div className="space-y-4">
                                    {(schema.sections || []).map((section: any, sectionIndex: number) => (
                                        <div key={section.id} className="rounded-2xl border border-muted-foreground/10 p-4 space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1 space-y-3">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Название раздела</Label>
                                                        <Input
                                                            value={section.title || ""}
                                                            onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                                            className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"
                                                            placeholder="Напр: Опыт работы"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Описание раздела</Label>
                                                        <Textarea
                                                            value={section.description || ""}
                                                            onChange={(e) => updateSection(section.id, { description: e.target.value })}
                                                            className="min-h-[72px] resize-y bg-muted/30 border-muted-foreground/10"
                                                            placeholder="Краткое описание раздела"
                                                        />
                                                    </div>
                                                    <div className="rounded-xl border border-muted-foreground/10 bg-muted/20 p-3 text-xs text-slate-500 font-medium mt-0.5">
                                                        Раздел содержит обычные вопросы. Если нужен список записей вроде "опыт работы", используй тип вопроса "Список записей" внутри этого раздела.
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => moveSection(section.id, -1)} disabled={sectionIndex === 0}>
                                                        <ArrowUp className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="outline" size="icon" onClick={() => moveSection(section.id, 1)} disabled={sectionIndex === (schema.sections || []).length - 1}>
                                                        <ArrowDown className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="outline" size="icon" onClick={() => deleteSection(section.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {(section.questions || []).map((q: any, index: number) => (
                                                    <div key={q.id} className="space-y-3 rounded-2xl border border-muted-foreground/10 p-3 sm:p-4">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="min-w-0 flex-1 space-y-2">
                                                                <div className="space-y-1.5">
                                                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Текст вопроса</Label>
                                                                    <Textarea
                                                                        value={q.label || ""}
                                                                        onChange={(e) => updateQuestion(section.id, q.id, { label: e.target.value })}
                                                                        className="min-h-[88px] resize-y bg-muted/30 border-muted-foreground/10"
                                                                        placeholder="Введите вопрос"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Описание</Label>
                                                                    <Textarea
                                                                        value={q.description || ""}
                                                                        onChange={(e) => updateQuestion(section.id, q.id, { description: e.target.value })}
                                                                        className="min-h-[88px] resize-y bg-muted/30 border-muted-foreground/10"
                                                                        placeholder="Описание вопроса"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                                    <div className="space-y-1.5 sm:w-[220px]">
                                                                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Тип вопроса</Label>
                                                                        <Select value={q.type} onValueChange={(v) => changeQuestionType(section.id, q.id, v as RecruitmentQuestionType)}>
                                                                            <SelectTrigger className="h-10 bg-muted/30 border-muted-foreground/10">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="text" className="text-xs">Текст</SelectItem>
                                                                                <SelectItem value="phone" className="text-xs">Телефон</SelectItem>
                                                                                <SelectItem value="email" className="text-xs">Email</SelectItem>
                                                                                <SelectItem value="choice" className="text-xs">Один выбор</SelectItem>
                                                                                <SelectItem value="multi_choice" className="text-xs">Мультивыбор</SelectItem>
                                                                                <SelectItem value="boolean" className="text-xs">Да / Нет</SelectItem>
                                                                                <SelectItem value="repeatable_list" className="text-xs">Список записей</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="flex h-10 w-full items-center justify-between rounded-xl border border-muted-foreground/10 px-3 sm:min-w-[180px] sm:w-auto sm:gap-4">
                                                                        <span className="text-sm">Обязательный</span>
                                                                        <Switch checked={Boolean(q.required)} onCheckedChange={(v) => updateQuestion(section.id, q.id, { required: Boolean(v) })} />
                                                                    </div>
                                                                </div>

                                                                {(q.type === "choice" || q.type === "multi_choice") && (
                                                                    <div className="space-y-4 pt-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <p className="text-sm font-bold text-slate-900">Варианты ответов</p>
                                                                            <Button
                                                                                variant="outline"
                                                                                className="h-9 rounded-lg border-slate-200 text-slate-700 font-medium"
                                                                                onClick={() => updateQuestion(section.id, q.id, { options: [...(q.options || []), { id: makeId("opt"), label: "Новый вариант", points: 0 }] })}
                                                                            >
                                                                                <Plus className="mr-2 h-4 w-4" />
                                                                                Добавить вариант
                                                                            </Button>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {(q.options || []).map((opt: any) => (
                                                                                <div key={opt.id} className="flex gap-2">
                                                                                    <Input
                                                                                        value={opt.label || ""}
                                                                                        onChange={(e) => {
                                                                                            const next = (q.options || []).map((o: any) => o.id === opt.id ? { ...o, label: e.target.value } : o)
                                                                                            updateQuestion(section.id, q.id, { options: next })
                                                                                        }}
                                                                                        className="h-11 bg-white border-slate-200 rounded-xl font-medium"
                                                                                        placeholder="Текст варианта"
                                                                                    />
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        className="h-11 w-11 p-0 shrink-0 rounded-xl border-slate-200 text-rose-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                                                                                        onClick={() => {
                                                                                            const next = (q.options || []).filter((o: any) => o.id !== opt.id)
                                                                                            updateQuestion(section.id, q.id, { options: next })
                                                                                        }}
                                                                                    >
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {q.type === "repeatable_list" && (
                                                                    <div className="space-y-4 pt-2">
                                                                        <div className="space-y-2">
                                                                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Название записи</Label>
                                                                            <Input
                                                                                value={q.item_label || ""}
                                                                                onChange={(e) => updateQuestion(section.id, q.id, { item_label: e.target.value })}
                                                                                className="h-12 bg-white border-slate-200 rounded-xl font-medium"
                                                                                placeholder="Напр: Место работы"
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center justify-between mt-4">
                                                                            <p className="text-sm font-bold text-slate-900">Поля для каждой записи</p>
                                                                            <Button
                                                                                variant="outline"
                                                                                className="h-9 rounded-lg border-slate-200 text-slate-700 font-medium"
                                                                                onClick={() => updateQuestion(section.id, q.id, { fields: [...(q.fields || []), { id: makeId("fld"), label: "Новое поле", type: "text" }] })}
                                                                            >
                                                                                <Plus className="mr-2 h-4 w-4" />
                                                                                Добавить поле
                                                                            </Button>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {(q.fields || []).map((field: any) => (
                                                                                <div key={field.id} className="flex flex-col sm:flex-row gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                                                                    <Input
                                                                                        value={field.label || ""}
                                                                                        onChange={(e) => {
                                                                                            const next = (q.fields || []).map((item: any) => item.id === field.id ? { ...item, label: e.target.value } : item)
                                                                                            updateQuestion(section.id, q.id, { fields: next })
                                                                                        }}
                                                                                        className="flex-1 h-11 bg-white border-slate-200 rounded-lg font-medium"
                                                                                        placeholder="Название поля"
                                                                                    />
                                                                                    <Select
                                                                                        value={field.type || "text"}
                                                                                        onValueChange={(v) => {
                                                                                            const next = (q.fields || []).map((item: any) => item.id === field.id ? { ...item, type: v as RecruitmentRepeatableFieldType } : item)
                                                                                            updateQuestion(section.id, q.id, { fields: next })
                                                                                        }}
                                                                                    >
                                                                                        <SelectTrigger className="w-full sm:w-[160px] h-11 bg-white border-slate-200 rounded-lg font-medium shrink-0">
                                                                                            <SelectValue />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent>
                                                                                            <SelectItem value="text" className="text-sm">Текст</SelectItem>
                                                                                            <SelectItem value="phone" className="text-sm">Телефон</SelectItem>
                                                                                            <SelectItem value="email" className="text-sm">Email</SelectItem>
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        className="h-11 w-11 p-0 shrink-0 rounded-lg border-slate-200 bg-white text-rose-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                                                                                        onClick={() => {
                                                                                            const next = (q.fields || []).filter((item: any) => item.id !== field.id)
                                                                                            updateQuestion(section.id, q.id, { fields: next })
                                                                                        }}
                                                                                    >
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-row gap-2 self-end sm:flex-col sm:self-auto shrink-0">
                                                                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200 bg-white" onClick={() => moveQuestion(section.id, q.id, -1)} disabled={index === 0}>
                                                                    <ArrowUp className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200 bg-white" onClick={() => moveQuestion(section.id, q.id, 1)} disabled={index === (section.questions || []).length - 1}>
                                                                    <ArrowDown className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200 bg-white text-rose-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200" onClick={() => deleteQuestion(section.id, q.id)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                <Button variant="outline" className="w-full h-12 rounded-xl border-slate-200 border-dashed text-slate-600 hover:bg-slate-50 font-medium" onClick={() => addQuestion(section.id, "text")}>
                                                    <Plus className="mr-2 h-5 w-5" />
                                                    Добавить вопрос в раздел
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-6 border-t border-slate-100">
                                    <Button className="w-full bg-slate-900 text-white hover:bg-slate-800 h-14 rounded-2xl font-medium shadow-sm" onClick={addSection}>
                                        <Plus className="mr-2 h-5 w-5" />
                                        Добавить новый раздел
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl sm:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="mx-auto flex max-w-[1600px] gap-2">
                    <Button asChild variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 bg-white font-medium">
                        <Link href={`/clubs/${clubId}/employees/recruitment/templates`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="flex-1 h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-medium shadow-sm">
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>Сохранить</span></>}
                    </Button>
                </div>
            </div>
        </div>
        </PageShell>
    )
}
