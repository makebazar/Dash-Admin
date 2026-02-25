"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import {
    AlertTriangle,
    Plus,
    Search,
    MoreVertical,
    CheckCircle2,
    Clock,
    Loader2,
    ChevronLeft,
    Monitor,
    User,
    MessageSquare,
    ArrowRight,
    Filter,
    X,
    MessageCircle,
    Info
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Issue {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type_name: string
    workstation_name: string | null
    reported_by: string
    reported_by_name: string
    title: string
    description: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
    created_at: string
    resolved_at: string | null
    resolved_by_name: string | null
    resolution_notes: string | null
}

interface Equipment {
    id: string
    name: string
    type_name: string
}

export default function IssuesBoard() {
    const { clubId } = useParams()
    const [issues, setIssues] = useState<Issue[]>([])
    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Dialog states
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
    const [newIssue, setNewIssue] = useState({
        equipment_id: '',
        title: '',
        description: '',
        severity: 'MEDIUM' as const
    })
    const [resolutionNotes, setResolutionNotes] = useState("")

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [issuesRes, eqRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/equipment/issues`),
                fetch(`/api/clubs/${clubId}/equipment`)
            ])

            if (issuesRes.ok) {
                const data = await issuesRes.json()
                setIssues(data.issues || [])
            }
            if (eqRes.ok) {
                const data = await eqRes.json()
                setEquipment(data.equipment || [])
            }
        } catch (error) {
            console.error("Error fetching issues:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const columns = [
        { id: 'OPEN', title: 'Открыто', bg: 'bg-slate-100/50', border: 'border-slate-200' },
        { id: 'IN_PROGRESS', title: 'В работе', bg: 'bg-blue-50/50', border: 'border-blue-200' },
        { id: 'RESOLVED', title: 'Решено', bg: 'bg-green-50/50', border: 'border-green-200' },
        { id: 'CLOSED', title: 'Закрыто', bg: 'bg-slate-200/50', border: 'border-slate-300' }
    ]

    const handleCreateIssue = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/issues`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newIssue)
            })
            if (res.ok) {
                setIsCreateOpen(false)
                setNewIssue({ equipment_id: '', title: '', description: '', severity: 'MEDIUM' })
                fetchData()
            }
        } catch (error) {
            console.error("Error creating issue:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleUpdateStatus = async (issueId: string, status: string, notes?: string) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/issues/${issueId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, resolution_notes: notes })
            })
            if (res.ok) {
                setSelectedIssue(null)
                fetchData()
            }
        } catch (error) {
            console.error("Error updating issue status:", error)
        }
    }

    const getSeverityBadge = (sev: string) => {
        switch (sev) {
            case 'CRITICAL': return <Badge className="bg-rose-600">КРИТИЧНО</Badge>
            case 'HIGH': return <Badge className="bg-orange-500">ВЫСОКИЙ</Badge>
            case 'MEDIUM': return <Badge className="bg-amber-400">СРЕДНИЙ</Badge>
            case 'LOW': return <Badge className="bg-blue-400">НИЗКИЙ</Badge>
            default: return null
        }
    }

    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen flex flex-col">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href={`/clubs/${clubId}/equipment`} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    К обзору
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">🛠 Доска инцидентов</h1>
                        <p className="text-muted-foreground mt-1">Отслеживание проблем и ремонтов оборудования</p>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-rose-600 to-orange-600">
                        <Plus className="mr-2 h-4 w-4" />
                        Сообщить о проблеме
                    </Button>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                {columns.map(col => (
                    <div key={col.id} className={cn("flex flex-col gap-4 rounded-3xl p-4 min-h-[600px] border-2 border-dashed", col.bg, col.border)}>
                        <div className="flex items-center justify-between px-2 pt-2 pb-1">
                            <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <div className={cn("h-2 w-2 rounded-full", col.id === 'OPEN' ? 'bg-slate-400' : col.id === 'IN_PROGRESS' ? 'bg-blue-500' : col.id === 'RESOLVED' ? 'bg-green-500' : 'bg-slate-600')}></div>
                                {col.title}
                            </h3>
                            <Badge variant="outline" className="text-xs bg-white/50">{issues.filter(i => i.status === col.id).length}</Badge>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center h-32 opacity-20"><Loader2 className="animate-spin" /></div>
                        ) : (
                            issues.filter(i => i.status === col.id).map(issue => (
                                <Card
                                    key={issue.id}
                                    className="group shadow-sm hover:shadow-md transition-all cursor-pointer border-none"
                                    onClick={() => setSelectedIssue(issue)}
                                >
                                    <CardContent className="p-3 space-y-3">
                                        {/* Header: Severity & Equipment Type */}
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {getSeverityBadge(issue.severity)}
                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight truncate max-w-[120px]" title={issue.equipment_type_name}>
                                                    {issue.equipment_type_name}
                                                </span>
                                            </div>
                                            {/* Equipment Icon */}
                                            <div className="h-6 w-6 bg-slate-50 rounded flex items-center justify-center shrink-0">
                                                <Monitor className="h-3 w-3 text-slate-400" />
                                            </div>
                                        </div>

                                        {/* Title & Location */}
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2" title={issue.title}>
                                                {issue.title}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 font-medium">
                                                {issue.workstation_name ? `📍 ${issue.workstation_name}` : "📦 Склад"}
                                            </p>
                                        </div>

                                        {/* Description */}
                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic bg-slate-50/50 p-2 rounded">
                                            "{issue.description}"
                                        </p>

                                        {/* Footer: Reporter & Date */}
                                        <div className="pt-2 border-t border-slate-50 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                    <User className="h-3 w-3 text-slate-400" />
                                                </div>
                                                <span className="text-[10px] font-medium text-slate-600 truncate" title={issue.reported_by_name}>
                                                    {issue.reported_by_name || "Неизвестно"}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                                                {new Date(issue.created_at).toLocaleDateString("ru-RU", { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}

                        {!isLoading && issues.filter(i => i.status === col.id).length === 0 && (
                            <div className="flex-1 flex items-center justify-center p-8 opacity-20 select-none">
                                <p className="text-xs font-bold uppercase tracking-widest italic text-center">Пусто</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Create Issue Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Сообщить о неисправности</DialogTitle>
                        <DialogDescription>Опишите проблему, и технический персонал возьмет её в работу.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateIssue} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Оборудование <span className="text-rose-500">*</span></Label>
                            <Select
                                value={newIssue.equipment_id}
                                onValueChange={(val) => setNewIssue(prev => ({ ...prev, equipment_id: val }))}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите устройство из списка" />
                                </SelectTrigger>
                                <SelectContent>
                                    {equipment.map(e => (
                                        <SelectItem key={e.id} value={e.id}>{e.name} ({e.type_name})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Что случилось? <span className="text-rose-500">*</span></Label>
                            <Input
                                placeholder="Краткое название проблемы"
                                value={newIssue.title}
                                onChange={(e) => setNewIssue(prev => ({ ...prev, title: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Подробности</Label>
                            <textarea
                                className="w-full min-h-[100px] rounded-lg border bg-white p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder="Опишите симптомы, когда проявилось и что уже пробовали сделать..."
                                value={newIssue.description}
                                onChange={(e) => setNewIssue(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Приоритет</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                                    <Button
                                        key={s}
                                        type="button"
                                        variant={newIssue.severity === s ? "default" : "outline"}
                                        size="sm"
                                        className="text-[10px]"
                                        onClick={() => setNewIssue(prev => ({ ...prev, severity: s as any }))}
                                    >
                                        {s === 'LOW' ? 'Низкий' : s === 'MEDIUM' ? 'Средний' : s === 'HIGH' ? 'Высокий' : 'Критико'}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={isSaving || !newIssue.equipment_id} className="bg-rose-600 hover:bg-rose-700">
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Отправить отчет
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Issue Details / Action Dialog */}
            <Dialog open={!!selectedIssue} onOpenChange={(open) => !open && setSelectedIssue(null)}>
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
                    {selectedIssue && (
                        <div className="flex flex-col h-full max-h-[80vh]">
                            <div className="p-6 bg-slate-50 border-b relative">
                                <div className="flex items-center gap-3 mb-2">
                                    {getSeverityBadge(selectedIssue.severity)}
                                    <Badge variant="outline">{selectedIssue.status}</Badge>
                                </div>
                                <h2 className="text-xl font-bold">{selectedIssue.title}</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {selectedIssue.equipment_name} — {selectedIssue.workstation_name || "Не назначено"}
                                </p>
                            </div>

                            <div className="p-6 overflow-auto space-y-6">
                                <section className="space-y-2">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Описание</h4>
                                    <p className="text-sm leading-relaxed">{selectedIssue.description || "Нет описания"}</p>
                                </section>

                                <Separator />

                                <section className="space-y-4">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Управление статусом</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedIssue.status === 'OPEN' && (
                                            <Button className="w-full bg-blue-600" onClick={() => handleUpdateStatus(selectedIssue.id, 'IN_PROGRESS')}>
                                                <Clock className="mr-2 h-4 w-4" /> Принять в работу
                                            </Button>
                                        )}
                                        {(selectedIssue.status === 'OPEN' || selectedIssue.status === 'IN_PROGRESS') && (
                                            <DialogTrigger asChild>
                                                <Button variant="outline" className="w-full border-green-200 text-green-700 hover:bg-green-50" onClick={() => { }}>
                                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Пометить решенным
                                                </Button>
                                            </DialogTrigger>
                                        )}
                                        {selectedIssue.status === 'RESOLVED' && (
                                            <Button className="w-full bg-slate-700 col-span-2" onClick={() => handleUpdateStatus(selectedIssue.id, 'CLOSED')}>
                                                <ShieldCheck className="mr-2 h-4 w-4" /> Закрыть тикет
                                            </Button>
                                        )}
                                    </div>

                                    {/* Inline Resolution Notes (simplified for this view) */}
                                    {(selectedIssue.status === 'OPEN' || selectedIssue.status === 'IN_PROGRESS') && (
                                        <div className="pt-4 space-y-3">
                                            <Label className="text-xs">Заметки о решении (обязательно для закрытия)</Label>
                                            <textarea
                                                className="w-full h-24 rounded-lg border p-3 text-sm"
                                                placeholder="Что было сделано? Замена детали, настройка софта..."
                                                value={resolutionNotes}
                                                onChange={(e) => setResolutionNotes(e.target.value)}
                                            />
                                            <Button
                                                className="w-full bg-green-600"
                                                disabled={!resolutionNotes}
                                                onClick={() => handleUpdateStatus(selectedIssue.id, 'RESOLVED', resolutionNotes)}
                                            >
                                                Завершить ремонт
                                            </Button>
                                        </div>
                                    )}
                                </section>

                                {selectedIssue.resolution_notes && (
                                    <>
                                        <Separator />
                                        <section className="space-y-2">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-green-600">Результат решения</h4>
                                            <div className="p-4 bg-green-50 rounded-xl border border-green-100 italic text-sm text-green-800">
                                                {selectedIssue.resolution_notes}
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                                                <span>Решил: {selectedIssue.resolved_by_name}</span>
                                                <span>{selectedIssue.resolved_at && new Date(selectedIssue.resolved_at).toLocaleString()}</span>
                                            </div>
                                        </section>
                                    </>
                                )}
                            </div>

                            <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1"><User className="h-3 w-3" /> Автор: {selectedIssue.reported_by_name}</span>
                                <span>Создано: {new Date(selectedIssue.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

function Separator() {
    return <div className="h-px bg-slate-100 w-full" />
}

function ShieldCheck({ className, ...props }: any) {
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
