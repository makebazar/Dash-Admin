"use client"

import { type ChangeEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Upload } from "lucide-react"
import type { RecruitmentQuestionType, RecruitmentTemplateSchemaV1 } from "@/lib/recruitment"
import { calculateRecruitmentMaxScore, validateRecruitmentTestSchema } from "@/lib/recruitment"
import { optimizeFileBeforeUpload } from "@/lib/utils"

type TestTemplate = {
    id: number
    club_id: number
    name: string
    description: string | null
    schema: any
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
    min?: number
    max?: number
    truePoints?: number
    falsePoints?: number
}

function safeSchema(raw: any): RecruitmentTemplateSchemaV1 {
    if (raw && typeof raw === "object" && Array.isArray(raw.questions)) {
        return { version: 1, questions: raw.questions as any, score_bands: Array.isArray(raw.score_bands) ? raw.score_bands : [] }
    }
    return { version: 1, questions: [], score_bands: [] }
}

function makeId(prefix: string) {
    return `${prefix}_${Math.random().toString(16).slice(2, 10)}`
}

function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(new Error("file_read_failed"))
        reader.readAsDataURL(file)
    })
}

export default function RecruitmentTestEditPage() {
    const params = useParams<{ clubId: string; testId: string }>()
    const router = useRouter()
    const clubId = params.clubId
    const testId = params.testId

    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [test, setTest] = useState<TestTemplate | null>(null)

    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [isActive, setIsActive] = useState(true)

    const [schema, setSchema] = useState<RecruitmentTemplateSchemaV1>({ version: 1, questions: [] })
    const [saveError, setSaveError] = useState("")
    const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({})

    const maxScore = useMemo(() => calculateRecruitmentMaxScore(schema), [schema])
    const schemaValidationError = useMemo(() => validateRecruitmentTestSchema(schema), [schema])

    const load = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/recruitment/tests/${testId}`)
            const data = await res.json()
            if (res.ok) {
                setTest(data)
                setName(data.name || "")
                setDescription(data.description || "")
                setIsActive(Boolean(data.is_active))
                const s = safeSchema(data.schema)
                setSchema(s)
            }
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [clubId, testId])

    const updateQuestion = (id: string, patch: Partial<QuestionDraft>) => {
        setSchema(prev => ({
            ...prev,
            questions: prev.questions.map((q: any) => (q.id === id ? { ...q, ...patch } : q))
        }))
    }

    const deleteQuestion = (id: string) => {
        setSchema(prev => ({ ...prev, questions: prev.questions.filter((q: any) => q.id !== id) as any }))
    }

    const moveQuestion = (id: string, direction: -1 | 1) => {
        setSchema(prev => {
            const index = prev.questions.findIndex((item: any) => item.id === id)
            const target = index + direction
            if (index === -1 || target < 0 || target >= prev.questions.length) return prev
            const next = [...prev.questions]
            const current = next[index]
            next[index] = next[target]
            next[target] = current
            return { ...prev, questions: next }
        })
    }

    const addQuestion = (type: RecruitmentQuestionType) => {
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
        setSchema(prev => ({ ...prev, questions: [...prev.questions, q as any] }))
    }

    const addBand = () => {
        setSchema(prev => {
            const bands = Array.isArray((prev as any).score_bands) ? ([...(prev as any).score_bands] as any[]) : []
            const nextMaxScore = calculateRecruitmentMaxScore(prev)
            bands.push({
                id: makeId("band"),
                min_score: 0,
                max_score: nextMaxScore > 0 ? nextMaxScore : 0,
                label: "Результат",
                decision: ""
            })
            return { ...(prev as any), score_bands: bands }
        })
    }

    const updateBand = (id: string, patch: any) => {
        setSchema(prev => {
            const bands = Array.isArray((prev as any).score_bands) ? ([...(prev as any).score_bands] as any[]) : []
            const next = bands.map(b => b?.id === id ? { ...b, ...patch } : b)
            return { ...(prev as any), score_bands: next }
        })
    }

    const deleteBand = (id: string) => {
        setSchema(prev => {
            const bands = Array.isArray((prev as any).score_bands) ? ([...(prev as any).score_bands] as any[]) : []
            const next = bands.filter(b => b?.id !== id)
            return { ...(prev as any), score_bands: next }
        })
    }

    const handleSave = async () => {
        const finalSchema = schema
        const validationError = validateRecruitmentTestSchema(finalSchema)
        if (validationError) {
            setSaveError(validationError)
            return
        }

        setIsSaving(true)
        setSaveError("")
        try {
            const res = await fetch(`/api/clubs/${clubId}/recruitment/tests/${testId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                    is_active: isActive,
                    schema: finalSchema
                })
            })
            const data = await res.json()
            if (res.ok) {
                setTest(data)
                const s = safeSchema(data.schema)
                setSchema(s)
                setSaveError("")
            } else {
                setSaveError(data?.error || "Не удалось сохранить тест")
            }
        } finally {
            setIsSaving(false)
        }
    }

    const handleQuestionImageUpload = async (questionId: string, e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingState(prev => ({ ...prev, [questionId]: true }))
        e.target.value = ""

        try {
            const optimizedFile = await optimizeFileBeforeUpload(file)
            const dataUrl = await readFileAsDataUrl(optimizedFile)
            updateQuestion(questionId, { image_url: dataUrl })
            setSaveError("")
        } catch (error) {
            console.error("Failed to upload question image:", error)
            setSaveError("Не удалось загрузить фото вопроса")
        } finally {
            setUploadingState(prev => ({ ...prev, [questionId]: false }))
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!test) {
        return (
            <div className="mx-auto max-w-3xl p-6">
                <p className="text-sm text-muted-foreground">Тест не найден</p>
                <Button variant="outline" onClick={() => router.back()} className="mt-4">Назад</Button>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl truncate">{test.name}</h1>
                        {!isActive && <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Неактивен</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">Редактор теста (вопросы + автоскор)</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                        <Link href={`/clubs/${clubId}/employees/recruitment/templates`}>К настройкам</Link>
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || Boolean(schemaValidationError)} className="w-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 sm:w-auto">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Сохранить
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="border-none shadow-sm bg-white lg:col-span-1">
                    <CardContent className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-muted/30 border-muted-foreground/10" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Описание</Label>
                            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-muted/30 border-muted-foreground/10" />
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-muted-foreground/10 p-3">
                            <div>
                                <p className="text-sm font-medium">Активен</p>
                                <p className="text-xs text-muted-foreground">Если выключить — не будет доступен кандидатам</p>
                            </div>
                            <Switch checked={isActive} onCheckedChange={setIsActive} />
                        </div>
                        <div className="rounded-xl border border-muted-foreground/10 p-3">
                            <p className="text-sm font-medium">Максимальный балл</p>
                            <p className="mt-1 text-2xl font-bold tracking-tight">{maxScore}</p>
                            <p className="text-xs text-muted-foreground">Считается автоматически из вопросов и баллов</p>
                        </div>
                        {schemaValidationError ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                <span className="font-bold">Нужно исправить:</span> {schemaValidationError}
                            </div>
                        ) : null}
                        {saveError ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                                <span className="font-bold">Ошибка:</span> {saveError}
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white lg:col-span-2">
                    <CardContent className="p-5 space-y-4">
                        <div className="space-y-3">
                                <div className="rounded-2xl border border-muted-foreground/10 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-bold">Результаты по диапазонам</p>
                                            <p className="text-xs text-muted-foreground">Диапазоны должны полностью покрывать тест от 0 до {maxScore} баллов</p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={addBand}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Добавить диапазон
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        {Array.isArray((schema as any).score_bands) && (schema as any).score_bands.length > 0 ? (
                                            (schema as any).score_bands.map((b: any) => (
                                                <div key={b.id} className="grid gap-2 rounded-xl border border-muted-foreground/10 p-3 sm:grid-cols-[90px_90px_1fr_1fr_40px]">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">МИН. БАЛЛ</p>
                                                        <Input
                                                            value={b.min_score ?? 0}
                                                            onChange={(e) => updateBand(b.id, { min_score: Number(e.target.value) })}
                                                            className="h-9 bg-muted/30 border-muted-foreground/10"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">МАКС. БАЛЛ</p>
                                                        <Input
                                                            value={b.max_score ?? maxScore}
                                                            onChange={(e) => updateBand(b.id, { max_score: Number(e.target.value) })}
                                                            className="h-9 bg-muted/30 border-muted-foreground/10"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">РЕЗУЛЬТАТ</p>
                                                        <Input
                                                            value={b.label || ""}
                                                            onChange={(e) => updateBand(b.id, { label: e.target.value })}
                                                            className="h-9 bg-muted/30 border-muted-foreground/10"
                                                            placeholder="Напр: Подходит"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">РЕШЕНИЕ</p>
                                                        <Input
                                                            value={b.decision || ""}
                                                            onChange={(e) => updateBand(b.id, { decision: e.target.value })}
                                                            className="h-9 bg-muted/30 border-muted-foreground/10"
                                                            placeholder="Напр: звать на собеседование"
                                                        />
                                                    </div>
                                                    <div className="flex items-end">
                                                        <Button variant="outline" size="icon" onClick={() => deleteBand(b.id)} className="h-9 w-9">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-muted-foreground">Нет диапазонов — будет только числовой скор</div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {schema.questions.map((q: any, index: number) => (
                                        <div key={q.id} className="rounded-2xl border border-muted-foreground/10 p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1 space-y-2">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Текст вопроса</Label>
                                                        <Textarea
                                                            value={q.label || ""}
                                                            onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                                                            className="min-h-[88px] resize-y bg-muted/30 border-muted-foreground/10"
                                                            placeholder="Введите вопрос"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Описание</Label>
                                                        <Textarea
                                                            value={q.description || ""}
                                                            onChange={(e) => updateQuestion(q.id, { description: e.target.value })}
                                                            className="min-h-[88px] resize-y bg-muted/30 border-muted-foreground/10"
                                                            placeholder="Описание вопроса"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                                        <div className="space-y-1.5 sm:w-[220px]">
                                                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Тип вопроса</Label>
                                                            <Select value={q.type} onValueChange={(v) => updateQuestion(q.id, { type: v as any })}>
                                                                <SelectTrigger className="h-10 bg-muted/30 border-muted-foreground/10">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="text" className="text-xs">Текст</SelectItem>
                                                                    <SelectItem value="choice" className="text-xs">Один выбор</SelectItem>
                                                                    <SelectItem value="multi_choice" className="text-xs">Мультивыбор</SelectItem>
                                                                    <SelectItem value="scale" className="text-xs">Шкала</SelectItem>
                                                                    <SelectItem value="boolean" className="text-xs">Да / Нет</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="flex h-10 items-center justify-between rounded-xl border border-muted-foreground/10 px-3 sm:min-w-[180px] sm:gap-4">
                                                            <span className="text-sm">Обязательный</span>
                                                            <Switch checked={Boolean(q.required)} onCheckedChange={(v) => updateQuestion(q.id, { required: Boolean(v) })} />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Фото к вопросу</Label>
                                                        <div className="flex flex-col gap-2 sm:flex-row">
                                                            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                                                                {uploadingState[q.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                                {uploadingState[q.id] ? "Загрузка..." : (q.image_url ? "Заменить фото" : "Загрузить фото")}
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={(e) => handleQuestionImageUpload(q.id, e)}
                                                                />
                                                            </label>
                                                            {q.image_url ? (
                                                                <Button variant="outline" type="button" onClick={() => updateQuestion(q.id, { image_url: "" })}>
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Удалить фото
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                        {q.image_url ? (
                                                            <div className="overflow-hidden rounded-xl border border-muted-foreground/10 bg-muted/20">
                                                                <img src={q.image_url} alt={q.label || "Вопрос"} className="max-h-64 w-full object-contain" />
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    {(q.type === "choice" || q.type === "multi_choice") && (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-sm font-medium">Варианты</p>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => updateQuestion(q.id, { options: [...(q.options || []), { id: makeId("opt"), label: "Новый вариант", points: 0 }] })}
                                                                >
                                                                    <Plus className="mr-2 h-4 w-4" />
                                                                    Добавить
                                                                </Button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(q.options || []).map((opt: any) => (
                                                                    <div key={opt.id} className="rounded-xl border border-muted-foreground/10 p-3">
                                                                        <div className="grid gap-2 sm:grid-cols-[1fr_120px_40px]">
                                                                            <Input
                                                                                value={opt.label || ""}
                                                                                onChange={(e) => {
                                                                                    const next = (q.options || []).map((o: any) => o.id === opt.id ? { ...o, label: e.target.value } : o)
                                                                                    updateQuestion(q.id, { options: next })
                                                                                }}
                                                                                className="bg-muted/30 border-muted-foreground/10"
                                                                                placeholder="Текст варианта"
                                                                            />
                                                                            <Input
                                                                                value={typeof opt.points === "number" ? String(opt.points) : ""}
                                                                                onChange={(e) => {
                                                                                    const n = Number(e.target.value)
                                                                                    const next = (q.options || []).map((o: any) => o.id === opt.id ? { ...o, points: Number.isFinite(n) ? n : 0 } : o)
                                                                                    updateQuestion(q.id, { options: next })
                                                                                }}
                                                                                className="bg-muted/30 border-muted-foreground/10"
                                                                                placeholder="баллы"
                                                                            />
                                                                            <Button
                                                                                variant="outline"
                                                                                size="icon"
                                                                                onClick={() => {
                                                                                    const next = (q.options || []).filter((o: any) => o.id !== opt.id)
                                                                                    updateQuestion(q.id, { options: next })
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

                                                    {q.type === "scale" && (
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Мин. значение</Label>
                                                                <Input
                                                                    value={q.min ?? 1}
                                                                    onChange={(e) => updateQuestion(q.id, { min: Number(e.target.value) })}
                                                                    className="bg-muted/30 border-muted-foreground/10"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Макс. значение</Label>
                                                                <Input
                                                                    value={q.max ?? 5}
                                                                    onChange={(e) => updateQuestion(q.id, { max: Number(e.target.value) })}
                                                                    className="bg-muted/30 border-muted-foreground/10"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {q.type === "boolean" && (
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Баллы за Да</Label>
                                                                <Input
                                                                    value={q.truePoints ?? 1}
                                                                    onChange={(e) => updateQuestion(q.id, { truePoints: Number(e.target.value) })}
                                                                    className="bg-muted/30 border-muted-foreground/10"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Баллы за Нет</Label>
                                                                <Input
                                                                    value={q.falsePoints ?? 0}
                                                                    onChange={(e) => updateQuestion(q.id, { falsePoints: Number(e.target.value) })}
                                                                    className="bg-muted/30 border-muted-foreground/10"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => moveQuestion(q.id, -1)} disabled={index === 0}>
                                                        <ArrowUp className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="outline" size="icon" onClick={() => moveQuestion(q.id, 1)} disabled={index === schema.questions.length - 1}>
                                                        <ArrowDown className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="outline" size="icon" onClick={() => deleteQuestion(q.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-2">
                                    <Button variant="outline" className="w-full" onClick={() => addQuestion("choice")}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Создать вопрос
                                    </Button>
                                </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
