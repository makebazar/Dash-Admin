"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
        <div className="mx-auto max-w-[1600px] overflow-x-hidden space-y-5 p-4 pb-28 sm:space-y-6 sm:p-6 sm:pb-6 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight sm:text-3xl">{template.name}</h1>
                        {!isActive && <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Неактивен</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">Здесь настраивается анкета кандидата: разделы, вопросы и тесты, которые он проходит</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                    <Button asChild variant="outline" className="hidden sm:inline-flex sm:w-auto">
                        <Link href={`/clubs/${clubId}/employees/recruitment/templates`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="hidden w-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 sm:inline-flex sm:w-auto">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Сохранить
                    </Button>
                </div>
            </div>

            <div className="grid min-w-0 gap-4 lg:grid-cols-3">
                <Card className="min-w-0 border-none bg-white shadow-sm lg:col-span-1">
                    <CardContent className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-muted/30 border-muted-foreground/10" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Описание</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="min-h-[96px] resize-y bg-muted/30 border-muted-foreground/10"
                                placeholder="Короткое описание анкеты"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Позиция</Label>
                            <Input value={position} onChange={(e) => setPosition(e.target.value)} className="bg-muted/30 border-muted-foreground/10" />
                        </div>
                        <div className="flex items-start justify-between gap-3 rounded-xl border border-muted-foreground/10 p-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Активен</p>
                                <p className="text-xs text-muted-foreground">Если выключить — ссылка перестанет работать</p>
                            </div>
                            <Switch checked={isActive} onCheckedChange={setIsActive} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Фото кандидата</Label>
                            <Select
                                value={schema.candidate_photo_mode || "off"}
                                onValueChange={(value) => setSchema(prev => ({ ...prev, candidate_photo_mode: value as "off" | "optional" | "required" }))}
                            >
                                <SelectTrigger className="min-w-0 bg-muted/30 border-muted-foreground/10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="off" className="text-xs">Не запрашивать</SelectItem>
                                    <SelectItem value="optional" className="text-xs">Запрашивать по желанию</SelectItem>
                                    <SelectItem value="required" className="text-xs">Запрашивать обязательно</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Фото будет отображаться отдельным блоком в начале публичной анкеты</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ссылка</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Input value={publicUrl} readOnly className="min-w-0 bg-muted/30 border-muted-foreground/10" />
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
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Тесты после анкеты</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Select value={attachTestId} onValueChange={setAttachTestId}>
                                    <SelectTrigger className="min-w-0 bg-muted/30 border-muted-foreground/10">
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
                                    <div className="text-xs text-muted-foreground">Нет тестов</div>
                                ) : attachedTests.map((t, i) => (
                                    <div key={t.id} className="flex flex-col gap-3 rounded-xl border border-muted-foreground/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium truncate">{t.name}</div>
                                            <div className="text-xs text-muted-foreground truncate">{t.description || ""}</div>
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

                        <div className="flex items-start justify-between gap-3 rounded-xl border border-muted-foreground/10 p-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">RAW JSON</p>
                                <p className="text-xs text-muted-foreground">Для быстрых правок схемы</p>
                            </div>
                            <Switch checked={rawMode} onCheckedChange={setRawMode} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="min-w-0 border-none bg-white shadow-sm lg:col-span-2">
                    <CardContent className="p-5 space-y-4">
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
                                <div className="rounded-xl border border-muted-foreground/10 bg-muted/20 p-3 text-xs text-muted-foreground">
                                    Анкета должна собирать информацию о кандидате. Оценка и баллы должны жить в тестах, а не в анкете.
                                </div>
                                <div className="space-y-4">
                                    {(schema.sections || []).map((section: any, sectionIndex: number) => (
                                        <div key={section.id} className="rounded-2xl border border-muted-foreground/10 p-4 space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1 space-y-3">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название раздела</Label>
                                                        <Input
                                                            value={section.title || ""}
                                                            onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                                            className="bg-muted/30 border-muted-foreground/10"
                                                            placeholder="Напр: Опыт работы"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Описание раздела</Label>
                                                        <Textarea
                                                            value={section.description || ""}
                                                            onChange={(e) => updateSection(section.id, { description: e.target.value })}
                                                            className="min-h-[72px] resize-y bg-muted/30 border-muted-foreground/10"
                                                            placeholder="Краткое описание раздела"
                                                        />
                                                    </div>
                                                    <div className="rounded-xl border border-muted-foreground/10 bg-muted/20 p-3 text-xs text-muted-foreground">
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
                                                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Текст вопроса</Label>
                                                                    <Textarea
                                                                        value={q.label || ""}
                                                                        onChange={(e) => updateQuestion(section.id, q.id, { label: e.target.value })}
                                                                        className="min-h-[88px] resize-y bg-muted/30 border-muted-foreground/10"
                                                                        placeholder="Введите вопрос"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Описание</Label>
                                                                    <Textarea
                                                                        value={q.description || ""}
                                                                        onChange={(e) => updateQuestion(section.id, q.id, { description: e.target.value })}
                                                                        className="min-h-[88px] resize-y bg-muted/30 border-muted-foreground/10"
                                                                        placeholder="Описание вопроса"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                                    <div className="space-y-1.5 sm:w-[220px]">
                                                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Тип вопроса</Label>
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
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <p className="text-sm font-medium">Варианты</p>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => updateQuestion(section.id, q.id, { options: [...(q.options || []), { id: makeId("opt"), label: "Новый вариант", points: 0 }] })}
                                                                            >
                                                                                <Plus className="mr-2 h-4 w-4" />
                                                                                Добавить
                                                                            </Button>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {(q.options || []).map((opt: any) => (
                                                                                <div key={opt.id} className="rounded-xl border border-muted-foreground/10 p-3">
                                                                                    <div className="grid gap-2 sm:grid-cols-[1fr_40px]">
                                                                                        <Input
                                                                                            value={opt.label || ""}
                                                                                            onChange={(e) => {
                                                                                                const next = (q.options || []).map((o: any) => o.id === opt.id ? { ...o, label: e.target.value } : o)
                                                                                                updateQuestion(section.id, q.id, { options: next })
                                                                                            }}
                                                                                            className="bg-muted/30 border-muted-foreground/10"
                                                                                            placeholder="Текст варианта"
                                                                                        />
                                                                                        <div className="flex justify-end sm:justify-center">
                                                                                            <Button
                                                                                                variant="outline"
                                                                                                size="icon"
                                                                                                onClick={() => {
                                                                                                    const next = (q.options || []).filter((o: any) => o.id !== opt.id)
                                                                                                    updateQuestion(section.id, q.id, { options: next })
                                                                                                }}
                                                                                            >
                                                                                                <Trash2 className="h-4 w-4" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {q.type === "repeatable_list" && (
                                                                    <div className="space-y-3">
                                                                        <div className="space-y-1.5">
                                                                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название записи</Label>
                                                                            <Input
                                                                                value={q.item_label || ""}
                                                                                onChange={(e) => updateQuestion(section.id, q.id, { item_label: e.target.value })}
                                                                                className="bg-muted/30 border-muted-foreground/10"
                                                                                placeholder="Напр: место работы"
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <p className="text-sm font-medium">Поля внутри записи</p>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => updateQuestion(section.id, q.id, { fields: [...(q.fields || []), { id: makeId("field"), label: "Новое поле", type: "text", required: false }] })}
                                                                            >
                                                                                <Plus className="mr-2 h-4 w-4" />
                                                                                Добавить поле
                                                                            </Button>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {(q.fields || []).map((field: any) => (
                                                                                <div key={field.id} className="rounded-xl border border-muted-foreground/10 p-3 space-y-2">
                                                                                    <div className="grid gap-2 sm:grid-cols-[1fr_180px_40px]">
                                                                                        <Input
                                                                                            value={field.label || ""}
                                                                                            onChange={(e) => {
                                                                                                const next = (q.fields || []).map((item: any) => item.id === field.id ? { ...item, label: e.target.value } : item)
                                                                                                updateQuestion(section.id, q.id, { fields: next })
                                                                                            }}
                                                                                            className="bg-muted/30 border-muted-foreground/10"
                                                                                            placeholder="Название поля"
                                                                                        />
                                                                                        <Select
                                                                                            value={field.type || "text"}
                                                                                            onValueChange={(v) => {
                                                                                                const next = (q.fields || []).map((item: any) => item.id === field.id ? { ...item, type: v as RecruitmentRepeatableFieldType } : item)
                                                                                                updateQuestion(section.id, q.id, { fields: next })
                                                                                            }}
                                                                                        >
                                                                                            <SelectTrigger className="bg-muted/30 border-muted-foreground/10">
                                                                                                <SelectValue />
                                                                                            </SelectTrigger>
                                                                                            <SelectContent>
                                                                                                <SelectItem value="text" className="text-xs">Текст</SelectItem>
                                                                                                <SelectItem value="phone" className="text-xs">Телефон</SelectItem>
                                                                                                <SelectItem value="email" className="text-xs">Email</SelectItem>
                                                                                            </SelectContent>
                                                                                        </Select>
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="icon"
                                                                                            onClick={() => {
                                                                                                const next = (q.fields || []).filter((item: any) => item.id !== field.id)
                                                                                                updateQuestion(section.id, q.id, { fields: next })
                                                                                            }}
                                                                                        >
                                                                                            <Trash2 className="h-4 w-4" />
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-row gap-2 self-end sm:flex-col sm:self-auto">
                                                                <Button variant="outline" size="icon" onClick={() => moveQuestion(section.id, q.id, -1)} disabled={index === 0}>
                                                                    <ArrowUp className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="outline" size="icon" onClick={() => moveQuestion(section.id, q.id, 1)} disabled={index === (section.questions || []).length - 1}>
                                                                    <ArrowDown className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="outline" size="icon" onClick={() => deleteQuestion(section.id, q.id)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                <Button variant="outline" className="w-full" onClick={() => addQuestion(section.id, "text")}>
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Создать вопрос в разделе
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-2">
                                    <Button variant="outline" className="w-full" onClick={addSection}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Создать раздел
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-muted-foreground/10 bg-background/95 p-4 backdrop-blur sm:hidden">
                <div className="mx-auto flex max-w-[1600px] gap-3">
                    <Button asChild variant="outline" className="flex-1">
                        <Link href={`/clubs/${clubId}/employees/recruitment/templates`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="flex-1 bg-primary text-primary-foreground shadow-lg">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Сохранить</span></>}
                    </Button>
                </div>
            </div>
        </div>
    )
}
