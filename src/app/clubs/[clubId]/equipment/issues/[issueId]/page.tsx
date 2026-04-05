"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
    ChevronLeft,
    Monitor,
    MapPin,
    User,
    Image as ImageIcon,
    MessageSquare,
    MessageCircle,
    Send,
    PlayCircle,
    CheckCircle2,
    Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { optimizeFileBeforeUpload } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface Issue {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type_name: string
    equipment_identifier?: string
    workstation_name: string | null
    workstation_zone: string | null
    reported_by: string
    reported_by_name: string
    title: string
    description: string
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
    created_at: string
    resolved_at: string | null
    resolved_by_name: string | null
    assigned_to: string | null
    assigned_to_name: string | null
    maintenance_task_id?: string | null
    source_photos?: string[] | null
    resolution_notes: string | null
    resolution_photos: string[] | null
}

interface Employee {
    id: string
    full_name: string
    role: string
}

interface Comment {
    id: string
    content: string
    author_name: string
    author_role: string
    is_system_message: boolean
    created_at: string
}

export default function IssueDetailsPage() {
    const router = useRouter()
    const params = useParams()
    const clubId = params.clubId as string
    const issueId = params.issueId as string

    const [issue, setIssue] = useState<Issue | null>(null)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [comments, setComments] = useState<Comment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUploading, setIsUploading] = useState(false)
    const [isSendingComment, setIsSendingComment] = useState(false)
    const [resolutionNotes, setResolutionNotes] = useState("")
    const [resolutionPhotos, setResolutionPhotos] = useState<File[]>([])
    const [newComment, setNewComment] = useState("")

    const getIssueUrl = useCallback(
        () => `/api/clubs/${clubId}/equipment/issues/${issueId}`,
        [clubId, issueId]
    )

    const getCommentsUrl = useCallback(
        () => `/api/clubs/${clubId}/equipment/issues/${issueId}/comments`,
        [clubId, issueId]
    )

    const fetchComments = useCallback(async () => {
        try {
            const res = await fetch(getCommentsUrl())
            if (!res.ok) return

            const data = await res.json()
            setComments(data.comments || [])
        } catch (error) {
            console.error("Error fetching comments:", error)
        }
    }, [getCommentsUrl])

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [issueRes, employeesRes] = await Promise.all([
                fetch(getIssueUrl()),
                fetch(`/api/clubs/${clubId}/employees`),
            ])

            if (!issueRes.ok) {
                alert("Не удалось загрузить инцидент")
                router.push(`/clubs/${clubId}/equipment/issues`)
                return
            }

            const issueData = await issueRes.json()
            setIssue(issueData)

            if (employeesRes.ok) {
                const employeesData = await employeesRes.json()
                setEmployees(employeesData.employees || [])
            }

            await fetchComments()
        } catch (error) {
            console.error("Error fetching issue details:", error)
            alert("Не удалось загрузить инцидент")
            router.push(`/clubs/${clubId}/equipment/issues`)
        } finally {
            setIsLoading(false)
        }
    }, [clubId, fetchComments, getIssueUrl, router])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const getStatusBadge = (status: Issue["status"]) => {
        switch (status) {
            case "OPEN":
                return <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-200">Открыто</Badge>
            case "IN_PROGRESS":
                return <Badge className="bg-blue-500 hover:bg-blue-500">В работе</Badge>
            case "RESOLVED":
                return <Badge className="bg-green-500 hover:bg-green-500">Решено</Badge>
            case "CLOSED":
                return <Badge variant="outline" className="border-slate-300 text-slate-500">Закрыто</Badge>
        }
    }

    const getStatusLabel = (status: Issue["status"]) => {
        switch (status) {
            case "OPEN":
                return "Открыто"
            case "IN_PROGRESS":
                return "В работе"
            case "RESOLVED":
                return "Решено"
            case "CLOSED":
                return "Закрыто"
        }
    }

    const getSeverityBadge = (severity: Issue["severity"]) => {
        switch (severity) {
            case "CRITICAL":
                return <Badge className="bg-rose-600">КРИТИЧНО</Badge>
            case "HIGH":
                return <Badge className="bg-orange-500">ВЫСОКИЙ</Badge>
            case "MEDIUM":
                return <Badge className="bg-amber-400">СРЕДНИЙ</Badge>
            case "LOW":
                return <Badge className="bg-blue-400">НИЗКИЙ</Badge>
        }
    }

    const handleUpdateStatus = async (status: Issue["status"], notes?: string, photos?: string[]) => {
        if (!issue) return

        try {
            const res = await fetch(getIssueUrl(), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status,
                    resolution_notes: notes,
                    resolution_photos: photos,
                }),
            })

            if (!res.ok) {
                const error = await res.json()
                alert(`Ошибка при обновлении статуса: ${error.error || "Неизвестная ошибка"}`)
                return
            }

            const updatedIssue = await res.json()
            setIssue(prev => (prev ? { ...prev, ...updatedIssue } : prev))

            await fetch(getCommentsUrl(), {
                method: "POST",
                body: JSON.stringify({
                    content: `Статус изменен на: ${getStatusLabel(status)}`,
                    is_system_message: true,
                }),
            })

            await fetchComments()
        } catch (error) {
            console.error("Error updating issue status:", error)
            alert("Произошла ошибка при обновлении статуса")
        }
    }

    const handleAssign = async (userId: string | null) => {
        if (!issue) return

        try {
            const res = await fetch(getIssueUrl(), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigned_to: userId }),
            })

            if (!res.ok) return

            const updatedIssue = await res.json()
            const assigneeName = userId ? employees.find(e => e.id === userId)?.full_name : null
            setIssue(prev => prev ? { ...prev, ...updatedIssue, assigned_to_name: assigneeName } : prev)

            await fetch(getCommentsUrl(), {
                method: "POST",
                body: JSON.stringify({
                    content: userId ? `Назначен ответственный: ${assigneeName}` : "Ответственный снят",
                    is_system_message: true,
                }),
            })

            await fetchComments()
        } catch (error) {
            console.error("Error assigning user:", error)
        }
    }

    const handleChangeSeverity = async (severity: Issue["severity"]) => {
        if (!issue) return

        try {
            const res = await fetch(getIssueUrl(), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ severity }),
            })

            if (!res.ok) return

            const updatedIssue = await res.json()
            setIssue(prev => prev ? { ...prev, ...updatedIssue } : prev)

            const sevLabel =
                severity === "LOW"
                    ? "Низкий"
                    : severity === "MEDIUM"
                      ? "Средний"
                      : severity === "HIGH"
                        ? "Высокий"
                        : "Критический"

            await fetch(getCommentsUrl(), {
                method: "POST",
                body: JSON.stringify({
                    content: `Приоритет изменен на: ${sevLabel}`,
                    is_system_message: true,
                }),
            })

            await fetchComments()
        } catch (error) {
            console.error("Error updating severity:", error)
        }
    }

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim()) return

        setIsSendingComment(true)
        try {
            const res = await fetch(getCommentsUrl(), {
                method: "POST",
                body: JSON.stringify({ content: newComment }),
            })

            if (res.ok) {
                setNewComment("")
                await fetchComments()
            }
        } catch (error) {
            console.error("Error adding comment:", error)
        } finally {
            setIsSendingComment(false)
        }
    }

    const handleResolveWithPhotos = async () => {
        if (!issue) return

        setIsUploading(true)
        try {
            const uploadedUrls: string[] = []

            for (const file of resolutionPhotos) {
                const optimizedFile = await optimizeFileBeforeUpload(file)
                const formData = new FormData()
                formData.append("file", optimizedFile)

                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                })

                if (!res.ok) continue

                const data = await res.json()
                if (data.url) uploadedUrls.push(data.url)
            }

            await handleUpdateStatus("RESOLVED", resolutionNotes, uploadedUrls)
            setResolutionPhotos([])
            setResolutionNotes("")
        } catch (error) {
            console.error("Error uploading photos:", error)
        } finally {
            setIsUploading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!issue) {
        return null
    }

    return (
        <div className="mx-auto max-w-[1600px] space-y-6 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-8 sm:p-6 sm:pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-8 lg:p-8">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="mb-3">
                            <Button asChild variant="outline" className="hidden md:inline-flex">
                                <Link href={`/clubs/${clubId}/equipment/issues`}>
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Назад к инцидентам
                                </Link>
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {getStatusBadge(issue.status)}
                            {getSeverityBadge(issue.severity)}
                        </div>
                        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{issue.title}</h1>
                        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                            Детали инцидента, ответственный, история и обсуждение по оборудованию
                        </p>
                    </div>
                    <div className="w-full lg:w-auto">
                        <Select value={issue.severity} onValueChange={(value) => handleChangeSeverity(value as Issue["severity"])}>
                            <SelectTrigger className="w-full bg-white sm:w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LOW">Низкий</SelectItem>
                                <SelectItem value="MEDIUM">Средний</SelectItem>
                                <SelectItem value="HIGH">Высокий</SelectItem>
                                <SelectItem value="CRITICAL">Критический</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="space-y-4">
                    <Card className="border-none shadow-sm">
                        <CardContent className="space-y-4 p-5">
                            <div className="rounded-xl border bg-slate-50/70 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-xl border bg-white p-2.5 text-slate-500">
                                        <Monitor className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="truncate text-lg font-semibold text-slate-900">{issue.equipment_name}</div>
                                            <Badge variant="outline" className="text-[10px] font-normal text-slate-500">
                                                {issue.equipment_type_name}
                                            </Badge>
                                        </div>
                                        {issue.equipment_identifier ? (
                                            <div className="mt-1 font-mono text-xs text-slate-500">ID: {issue.equipment_identifier}</div>
                                        ) : null}
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                            <MapPin className="h-3.5 w-3.5" />
                                            <span>{issue.workstation_zone || "Зона не указана"}</span>
                                            <span>•</span>
                                            <span>{issue.workstation_name || "Склад"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <section className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Описание</h2>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                        <User className="h-3 w-3" />
                                        <span className="font-medium text-slate-700">{issue.reported_by_name}</span>
                                        <span className="text-slate-300">•</span>
                                        <span>{new Date(issue.created_at).toLocaleString("ru-RU")}</span>
                                    </div>
                                </div>
                                <div className="rounded-xl border bg-white p-4 text-sm leading-relaxed shadow-sm">
                                    {issue.description || "Нет описания"}
                                </div>
                            </section>

                            <section className="space-y-2">
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Ответственный</h2>
                                <Select
                                    value={issue.assigned_to || "unassigned"}
                                    onValueChange={(value) => handleAssign(value === "unassigned" ? null : value)}
                                >
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Назначить сотрудника" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Не назначен</SelectItem>
                                        {employees.map(employee => (
                                            <SelectItem key={employee.id} value={employee.id}>
                                                {employee.full_name} ({employee.role})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </section>

                            <Separator />

                            <section className="space-y-4">
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Управление статусом</h2>

                                {issue.status === "OPEN" ? (
                                    <Button className="h-12 w-full text-base shadow-sm" onClick={() => handleUpdateStatus("IN_PROGRESS")}>
                                        <PlayCircle className="mr-2 h-5 w-5" />
                                        Взять в работу
                                    </Button>
                                ) : null}

                                {issue.status === "IN_PROGRESS" ? (
                                    <div className="space-y-4">
                                        <div className="space-y-3 rounded-xl border border-green-100 bg-green-50/50 p-4">
                                            <Label className="font-medium text-green-800">Решение проблемы</Label>
                                            <textarea
                                                className="h-24 w-full rounded-lg border bg-white p-3 text-sm outline-none transition-all focus:ring-2 focus:ring-green-500/20"
                                                placeholder="Опишите выполненные работы..."
                                                value={resolutionNotes}
                                                onChange={(e) => setResolutionNotes(e.target.value)}
                                            />
                                            <Input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={(e) => setResolutionPhotos(Array.from(e.target.files || []))}
                                            />
                                            <Button className="w-full bg-green-600 hover:bg-green-700" disabled={isUploading} onClick={handleResolveWithPhotos}>
                                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                Завершить ремонт
                                            </Button>
                                        </div>
                                        <Button variant="outline" className="w-full text-slate-500" onClick={() => handleUpdateStatus("OPEN")}>
                                            Вернуть статус "Открыто"
                                        </Button>
                                    </div>
                                ) : null}

                                {issue.status === "RESOLVED" ? (
                                    <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                                        <div className="flex items-center justify-center gap-2 font-medium text-green-700">
                                            <CheckCircle2 className="h-5 w-5" />
                                            Проблема решена
                                        </div>
                                        <Button variant="outline" className="w-full bg-white" onClick={() => handleUpdateStatus("CLOSED")}>
                                            <ShieldCheck className="mr-2 h-4 w-4" />
                                            Закрыть тикет
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" onClick={() => handleUpdateStatus("IN_PROGRESS")}>
                                            Вернуть в работу
                                        </Button>
                                    </div>
                                ) : null}

                                {issue.status === "CLOSED" ? (
                                    <div className="rounded-xl border bg-slate-50 p-4 text-center">
                                        <div className="mb-3 flex items-center justify-center gap-2 font-medium text-slate-500">
                                            <ShieldCheck className="h-5 w-5" />
                                            Тикет закрыт
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus("OPEN")}>
                                            Переоткрыть
                                        </Button>
                                    </div>
                                ) : null}
                            </section>

                            {issue.resolution_notes ? (
                                <section className="space-y-2">
                                    <h2 className="text-xs font-black uppercase tracking-widest text-green-600">Результат решения</h2>
                                    <div className="rounded-xl border border-green-100 bg-green-50 p-4 text-sm italic text-green-800">
                                        {issue.resolution_notes}
                                    </div>
                                </section>
                            ) : null}

                            {issue.source_photos && issue.source_photos.length > 0 ? (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4 text-slate-500" />
                                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
                                            Фото при создании
                                        </h2>
                                        <Badge variant="outline" className="text-[10px] font-normal text-slate-500">
                                            {issue.source_photos.length}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {issue.source_photos.map((photoUrl, index) => (
                                            <a
                                                key={`${photoUrl}-${index}`}
                                                href={photoUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
                                            >
                                                <div className="aspect-square bg-slate-100">
                                                    <img
                                                        src={photoUrl}
                                                        alt={`Фото при создании инцидента ${index + 1}`}
                                                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                                                        loading="lazy"
                                                    />
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </section>
                            ) : null}

                            {issue.resolution_photos && issue.resolution_photos.length > 0 ? (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4 text-slate-500" />
                                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
                                            Фото решения
                                        </h2>
                                        <Badge variant="outline" className="text-[10px] font-normal text-slate-500">
                                            {issue.resolution_photos.length}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {issue.resolution_photos.map((photoUrl, index) => (
                                            <a
                                                key={`${photoUrl}-${index}`}
                                                href={photoUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
                                            >
                                                <div className="aspect-square bg-slate-100">
                                                    <img
                                                        src={photoUrl}
                                                        alt={`Фото инцидента ${index + 1}`}
                                                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                                                        loading="lazy"
                                                    />
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </section>
                            ) : null}
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-none shadow-sm">
                    <CardContent className="flex h-full min-h-[540px] flex-col p-0">
                        <div className="flex items-center justify-between border-b bg-white p-4">
                            <h2 className="font-semibold">
                                <span className="inline-flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    Обсуждение
                                </span>
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {comments.length === 0 ? (
                                <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-muted-foreground opacity-50">
                                    <MessageCircle className="mb-2 h-8 w-8" />
                                    <p className="text-sm">Нет комментариев</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {comments.map(comment => (
                                        <div key={comment.id} className={cn("flex flex-col gap-1", comment.is_system_message ? "items-center my-4" : "items-start")}>
                                            {comment.is_system_message ? (
                                                <Badge variant="outline" className="border-slate-200 bg-slate-100 text-xs font-normal text-slate-500">
                                                    {comment.content} • {new Date(comment.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </Badge>
                                            ) : (
                                                <div className="max-w-[90%] rounded-lg border bg-white p-3 shadow-sm">
                                                    <div className="mb-1 flex items-center gap-2">
                                                        <span className="text-xs font-bold">{comment.author_name}</span>
                                                        <span className="text-[10px] text-muted-foreground">{new Date(comment.created_at).toLocaleString()}</span>
                                                    </div>
                                                    <p className="whitespace-pre-wrap text-sm text-slate-700">{comment.content}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t bg-white p-4">
                            <form onSubmit={handleAddComment} className="flex gap-2">
                                <Input
                                    placeholder="Написать комментарий..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    className="flex-1"
                                />
                                <Button type="submit" size="icon" disabled={!newComment.trim() || isSendingComment}>
                                    {isSendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </form>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
                <div className="mx-auto flex max-w-7xl gap-2">
                    <Button asChild variant="outline" className="h-11 flex-1">
                        <Link href={`/clubs/${clubId}/equipment/issues`}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}

function Separator() {
    return <div className="h-px w-full bg-slate-100" />
}

function ShieldCheck({ className, ...props }: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    )
}
