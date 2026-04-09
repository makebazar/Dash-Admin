"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PageShell } from "@/components/layout/PageShell"
import { Clipboard, Plus, ExternalLink, Edit2, Loader2, QrCode, Trash2, ArrowLeft } from "lucide-react"
import { QRCode } from "@/components/qr/QRCode"

type TemplateRow = {
    id: number
    name: string
    description: string | null
    position: string | null
    public_token: string | null
    is_active: boolean
    applications_count: number
    created_at: string
}

type TestRow = {
    id: number
    name: string
    description: string | null
    is_active: boolean
    created_at: string
}

export default function RecruitmentTemplatesPage() {
    const params = useParams<{ clubId: string }>()
    const clubId = params.clubId

    const [templates, setTemplates] = useState<TemplateRow[]>([])
    const [tests, setTests] = useState<TestRow[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [origin, setOrigin] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isCreateTestOpen, setIsCreateTestOpen] = useState(false)
    const [qrValue, setQrValue] = useState<string>("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const [name, setName] = useState("")
    const [position, setPosition] = useState("")

    const [testName, setTestName] = useState("")
    const [testDescription, setTestDescription] = useState("")

    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ kind: "template" | "test"; id: number; name: string } | null>(null)

    const load = async () => {
        setIsLoading(true)
        try {
            const [tRes, testsRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/recruitment/templates`),
                fetch(`/api/clubs/${clubId}/recruitment/tests`)
            ])
            const [tData, testsData] = await Promise.all([tRes.json(), testsRes.json()])
            if (tRes.ok) setTemplates(Array.isArray(tData) ? tData : [])
            if (testsRes.ok) setTests(Array.isArray(testsData) ? testsData : [])
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (typeof window !== "undefined") setOrigin(window.location.origin)
        load()
    }, [clubId])

    const handleCopy = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url)
        } catch {}
    }

    const handleCreate = async () => {
        const finalName = name.trim()
        if (!finalName) return

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/recruitment/templates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: finalName,
                    position: position || null
                })
            })
            if (res.ok) {
                setIsCreateOpen(false)
                setName("")
                setPosition("")
                await load()
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCreateTest = async () => {
        const finalName = testName.trim()
        if (!finalName) return

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/recruitment/tests`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: finalName,
                    description: testDescription.trim() || null,
                    schema: {
                        version: 1,
                        questions: [],
                        score_bands: []
                    }
                })
            })
            if (res.ok) {
                setIsCreateTestOpen(false)
                setTestName("")
                setTestDescription("")
                await load()
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const requestDelete = (kind: "template" | "test", id: number, itemName: string) => {
        setDeleteTarget({ kind, id, name: itemName })
        setDeleteOpen(true)
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const url = deleteTarget.kind === "template"
                ? `/api/clubs/${clubId}/recruitment/templates/${deleteTarget.id}`
                : `/api/clubs/${clubId}/recruitment/tests/${deleteTarget.id}`
            const res = await fetch(url, { method: "DELETE" })
            if (res.ok) {
                setDeleteOpen(false)
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
                    <p className="text-sm font-medium text-slate-500 animate-pulse">Загрузка шаблонов...</p>
                </div>
            </div>
        )
    }

    return (
        <PageShell maxWidth="5xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-12">
                <div className="space-y-3">
                    <div className="mb-4 hidden sm:block">
                        <Button variant="ghost" asChild className="h-9 px-3 -ml-3 text-slate-500 hover:text-slate-900 rounded-lg">
                            <Link href={`/clubs/${clubId}/employees`}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                К сотрудникам
                            </Link>
                        </Button>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">Настройки подбора</h1>
                    <p className="text-slate-500 text-lg">Шаблоны анкет + шаблоны тестов</p>
                </div>
            </div>

            <div className="space-y-12">
                {/* Шаблоны анкет */}
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Шаблоны анкет</h2>
                            <p className="text-sm text-slate-500">Анкета → после неё привязанные тесты</p>
                        </div>
                        <Button onClick={() => setIsCreateOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl h-11 px-6 font-medium shadow-sm w-full sm:w-auto">
                            <Plus className="h-5 w-5 mr-2" />
                            Создать анкету
                        </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {templates.map(t => {
                            const publicUrl = origin && t.public_token ? `${origin}/apply/${t.public_token}` : ""
                            return (
                                <div key={t.id} className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col h-full">
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-bold text-slate-900 truncate">{t.name}</h3>
                                                {!t.is_active && (
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider font-bold shrink-0">Неактивен</Badge>
                                                )}
                                            </div>
                                            {t.position && <p className="text-sm font-medium text-slate-700 truncate">{t.position}</p>}
                                            {t.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{t.description}</p>}
                                        </div>
                                        <div className="shrink-0 flex flex-col items-center justify-center h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100" title="Количество анкет">
                                            <span className="text-lg font-bold text-slate-900">{t.applications_count}</span>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 flex flex-wrap gap-2">
                                        <Button asChild variant="outline" className="flex-1 h-10 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black">
                                            <Link href={`/clubs/${clubId}/employees/recruitment/templates/${t.id}`}>
                                                <Edit2 className="mr-2 h-4 w-4" />
                                                Настроить
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-10 w-10 p-0 rounded-xl border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 shrink-0"
                                            onClick={() => requestDelete("template", t.id, t.name)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    
                                    <div className="flex gap-2 mt-2">
                                        <Button
                                            variant="outline"
                                            className="flex-1 h-10 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                                            onClick={() => publicUrl && handleCopy(publicUrl)}
                                            disabled={!publicUrl}
                                        >
                                            <Clipboard className="mr-2 h-4 w-4" />
                                            Копировать
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-10 w-10 p-0 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
                                            onClick={() => publicUrl && setQrValue(publicUrl)}
                                            disabled={!publicUrl}
                                            title="QR код"
                                        >
                                            <QrCode className="h-4 w-4" />
                                        </Button>
                                        <Button asChild variant="outline" className="h-10 w-10 p-0 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0" disabled={!publicUrl}>
                                            <a href={publicUrl || "#"} target="_blank" rel="noreferrer" title="Открыть публичную ссылку">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                        {templates.length === 0 && (
                            <div className="sm:col-span-2 flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
                                <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                    <Clipboard className="h-8 w-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">Нет шаблонов анкет</h3>
                                <p className="text-sm text-slate-500 mt-1">Создайте первый шаблон для сбора откликов</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Шаблоны тестов */}
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Шаблоны тестов</h2>
                            <p className="text-sm text-slate-500">Отдельные тесты, которые можно привязать к анкете</p>
                        </div>
                        <Button onClick={() => setIsCreateTestOpen(true)} variant="outline" className="rounded-xl h-11 px-6 font-medium text-slate-700 hover:bg-slate-50 hover:text-black border-slate-200 w-full sm:w-auto">
                            <Plus className="h-5 w-5 mr-2" />
                            Создать тест
                        </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {tests.map(t => (
                            <div key={t.id} className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col h-full">
                                <div className="min-w-0 mb-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-slate-900 truncate">{t.name}</h3>
                                        {!t.is_active && (
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider font-bold shrink-0">Неактивен</Badge>
                                        )}
                                    </div>
                                    {t.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{t.description}</p>}
                                </div>
                                <div className="mt-auto flex gap-2">
                                    <Button asChild variant="outline" className="flex-1 h-10 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black">
                                        <Link href={`/clubs/${clubId}/employees/recruitment/tests/${t.id}`}>
                                            <Edit2 className="mr-2 h-4 w-4" />
                                            Настроить
                                        </Link>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-10 w-10 p-0 rounded-xl border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 shrink-0"
                                        onClick={() => requestDelete("test", t.id, t.name)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {tests.length === 0 && (
                            <div className="sm:col-span-2 xl:col-span-3 flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-200 border-dashed">
                                <p className="text-sm text-slate-500 font-medium">Тестов пока нет</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={Boolean(qrValue)} onOpenChange={(o) => !o && setQrValue("")}>
                <DialogContent className="sm:max-w-[400px] rounded-3xl border border-slate-200 shadow-2xl bg-white p-8">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-2xl font-bold text-center text-slate-900">QR-код анкеты</DialogTitle>
                    </DialogHeader>
                    <div className="flex justify-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        {qrValue ? <QRCode value={qrValue} downloadable filename="recruitment-form-qr" /> : null}
                    </div>
                    <div className="mt-6 text-xs text-slate-500 break-all text-center bg-slate-50 p-3 rounded-xl">
                        {qrValue}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="sm:max-w-[400px] rounded-3xl border border-slate-200 shadow-2xl bg-white p-6">
                    <DialogHeader className="space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                            <Trash2 className="h-6 w-6 text-rose-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">Удалить?</DialogTitle>
                            <DialogDescription className="text-sm font-medium text-slate-500 mt-1">
                                {deleteTarget?.kind === "template"
                                    ? "Удаление анкеты удалит связанные ответы и анкеты кандидатов."
                                    : "Удаление теста удалит его из всех анкет и сотрет ответы кандидатов."}
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                            <p className="text-sm font-bold text-slate-900">{deleteTarget?.name}</p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setDeleteOpen(false)} className="flex-1 text-xs font-bold uppercase tracking-widest rounded-xl h-11">
                            Отмена
                        </Button>
                        <Button onClick={confirmDelete} disabled={isDeleting} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-rose-200 rounded-xl h-11">
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Удалить"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[440px] rounded-3xl border border-slate-200 shadow-2xl bg-white p-6">
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="text-2xl font-bold text-slate-900">Новая анкета</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-slate-500">
                            Анкета создается пустой. Вопросы можно будет настроить на следующем шаге.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Название анкеты</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-12 bg-slate-50/50 border-slate-200 hover:border-slate-300 transition-colors rounded-xl font-medium"
                                placeholder="Напр: Администратор рецепции"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Должность (для кандидата)</Label>
                            <Input
                                value={position}
                                onChange={(e) => setPosition(e.target.value)}
                                className="h-12 bg-slate-50/50 border-slate-200 hover:border-slate-300 transition-colors rounded-xl font-medium"
                                placeholder="Напр: Администратор"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="flex-1 text-xs font-bold uppercase tracking-widest rounded-xl h-12">
                            Отмена
                        </Button>
                        <Button onClick={handleCreate} disabled={isSubmitting} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest rounded-xl h-12 shadow-sm">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateTestOpen} onOpenChange={setIsCreateTestOpen}>
                <DialogContent className="sm:max-w-[440px] rounded-3xl border border-slate-200 shadow-2xl bg-white p-6">
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="text-2xl font-bold text-slate-900">Новый тест</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-slate-500">
                            Создаётся пустая схема. Вопросы настраиваются позже.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Название теста</Label>
                            <Input
                                value={testName}
                                onChange={(e) => setTestName(e.target.value)}
                                className="h-12 bg-slate-50/50 border-slate-200 hover:border-slate-300 transition-colors rounded-xl font-medium"
                                placeholder="Напр: IQ мини"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Описание (опционально)</Label>
                            <Input
                                value={testDescription}
                                onChange={(e) => setTestDescription(e.target.value)}
                                className="h-12 bg-slate-50/50 border-slate-200 hover:border-slate-300 transition-colors rounded-xl font-medium"
                                placeholder="Краткая суть теста"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                        <Button variant="ghost" onClick={() => setIsCreateTestOpen(false)} className="flex-1 text-xs font-bold uppercase tracking-widest rounded-xl h-12">
                            Отмена
                        </Button>
                        <Button onClick={handleCreateTest} disabled={isSubmitting} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest rounded-xl h-12 shadow-sm">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl sm:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button asChild variant="outline" className="w-full h-12 rounded-xl border-slate-200 text-slate-700 bg-white font-medium">
                    <Link href={`/clubs/${clubId}/employees`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        К сотрудникам
                    </Link>
                </Button>
            </div>
        </PageShell>
    )
}
