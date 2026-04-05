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
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-[1600px] space-y-5 p-4 pb-28 sm:space-y-6 sm:p-6 sm:pb-6 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Настройки подбора</h1>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">Шаблоны анкет + шаблоны тестов</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                    <Button asChild variant="outline" className="hidden sm:inline-flex sm:w-auto">
                        <Link href={`/clubs/${clubId}/employees`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold tracking-tight">Шаблоны анкет</h2>
                    <p className="text-xs text-muted-foreground mt-1">Анкета → после неё привязанные тесты</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} className="bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Создать анкету</span>
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {templates.map(t => {
                    const publicUrl = origin && t.public_token ? `${origin}/apply/${t.public_token}` : ""
                    return (
                        <Card key={t.id} className="border-none shadow-sm bg-white">
                            <CardContent className="p-5 space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold truncate">{t.name}</h3>
                                            {!t.is_active && (
                                                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Неактивен</Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.position || "—"}</p>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description || ""}</p>
                                    </div>
                                    <Badge className="bg-muted text-foreground">{t.applications_count}</Badge>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={`/clubs/${clubId}/employees/recruitment/templates/${t.id}`}>
                                            <Edit2 className="mr-2 h-4 w-4" />
                                            Редактировать
                                        </Link>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700"
                                        onClick={() => requestDelete("template", t.id, t.name)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Удалить
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => publicUrl && handleCopy(publicUrl)}
                                        disabled={!publicUrl}
                                    >
                                        <Clipboard className="mr-2 h-4 w-4" />
                                        <span className="hidden md:inline">Скопировать ссылку</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => publicUrl && setQrValue(publicUrl)}
                                        disabled={!publicUrl}
                                    >
                                        <QrCode className="mr-2 h-4 w-4" />
                                        <span className="hidden md:inline">QR</span>
                                    </Button>
                                    <Button asChild variant="outline" size="sm" disabled={!publicUrl}>
                                        <a href={publicUrl || "#"} target="_blank" rel="noreferrer">
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            <span className="hidden md:inline">Открыть</span>
                                        </a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <div className="flex items-start justify-between gap-4 pt-2">
                <div>
                    <h2 className="text-lg font-bold tracking-tight">Шаблоны тестов</h2>
                    <p className="text-xs text-muted-foreground mt-1">Отдельные тесты, которые можно привязать к анкете</p>
                </div>
                <Button onClick={() => setIsCreateTestOpen(true)} variant="outline">
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Создать тест</span>
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tests.map(t => (
                    <Card key={t.id} className="border-none shadow-sm bg-white">
                        <CardContent className="p-5 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold truncate">{t.name}</h3>
                                        {!t.is_active && (
                                            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Неактивен</Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description || ""}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button asChild variant="outline" size="sm" className="w-full">
                                    <Link href={`/clubs/${clubId}/employees/recruitment/tests/${t.id}`}>
                                        <Edit2 className="mr-2 h-4 w-4" />
                                        Редактировать
                                    </Link>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-red-600 hover:text-red-700"
                                    onClick={() => requestDelete("test", t.id, t.name)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Удалить
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={Boolean(qrValue)} onOpenChange={(o) => !o && setQrValue("")}>
                <DialogContent className="sm:max-w-[420px] rounded-2xl border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">QR</DialogTitle>
                    </DialogHeader>
                    <div className="flex justify-center">
                        {qrValue ? <QRCode value={qrValue} downloadable filename="recruitment-form-qr" /> : null}
                    </div>
                    <div className="text-xs text-muted-foreground break-all">{qrValue}</div>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="sm:max-w-[520px] rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="text-xl font-bold">Удалить?</DialogTitle>
                        <DialogDescription className="text-xs font-medium">
                            {deleteTarget?.kind === "template"
                                ? "Удаление анкеты удалит связанные ответы/анкеты кандидатов."
                                : "Удаление теста удалит его из всех анкет и удалит ответы кандидатов по этому тесту."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="text-sm font-bold">{deleteTarget?.name}</div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setDeleteOpen(false)} className="flex-1 text-xs font-bold uppercase tracking-widest">
                            Отмена
                        </Button>
                        <Button onClick={confirmDelete} disabled={isDeleting} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest shadow-lg">
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Удалить"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[520px] rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="text-xl font-bold">Создать анкету</DialogTitle>
                        <DialogDescription className="text-xs font-medium">Новая анкета создается пустой, потом ее можно настроить вручную</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="bg-muted/30 border-muted-foreground/10"
                                placeholder="Напр: Администратор (анкета)"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Позиция</Label>
                            <Input
                                value={position}
                                onChange={(e) => setPosition(e.target.value)}
                                className="bg-muted/30 border-muted-foreground/10"
                                placeholder="Напр: Администратор"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="flex-1 text-xs font-bold uppercase tracking-widest">
                            Отмена
                        </Button>
                        <Button onClick={handleCreate} disabled={isSubmitting} className="flex-1 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest shadow-lg">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateTestOpen} onOpenChange={setIsCreateTestOpen}>
                <DialogContent className="sm:max-w-[520px] rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="text-xl font-bold">Создать тест</DialogTitle>
                        <DialogDescription className="text-xs font-medium">Создаётся пустая схема; редактировать вопросы можно будет через JSON/расширение позже</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название</Label>
                            <Input
                                value={testName}
                                onChange={(e) => setTestName(e.target.value)}
                                className="bg-muted/30 border-muted-foreground/10"
                                placeholder="Напр: IQ мини"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Описание</Label>
                            <Input
                                value={testDescription}
                                onChange={(e) => setTestDescription(e.target.value)}
                                className="bg-muted/30 border-muted-foreground/10"
                                placeholder="Опционально"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsCreateTestOpen(false)} className="flex-1 text-xs font-bold uppercase tracking-widest">
                            Отмена
                        </Button>
                        <Button onClick={handleCreateTest} disabled={isSubmitting} className="flex-1 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest shadow-lg">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-muted-foreground/10 bg-background/95 p-4 backdrop-blur sm:hidden">
                <div className="mx-auto max-w-[1600px]">
                    <Button asChild variant="outline" className="w-full">
                        <Link href={`/clubs/${clubId}/employees`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
