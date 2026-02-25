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
    Info,
    Image as ImageIcon,
    MoreHorizontal,
    FileText
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
    resolution_photos: string[] | null
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
    const [resolutionPhotos, setResolutionPhotos] = useState<File[]>([])
    const [isUploading, setIsUploading] = useState(false)

    // Filter states
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<Issue['status'] | 'ALL'>('ALL')

    const filteredIssues = useMemo(() => {
        return issues.filter(issue => {
            const matchesSearch = 
                issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                issue.equipment_name.toLowerCase().includes(searchTerm.toLowerCase())
            
            const matchesStatus = statusFilter === 'ALL' || issue.status === statusFilter

            return matchesSearch && matchesStatus
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }, [issues, searchTerm, statusFilter])

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

    const getStatusBadge = (status: Issue['status']) => {
        switch (status) {
            case 'OPEN': return <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-300">Открыто</Badge>
            case 'IN_PROGRESS': return <Badge className="bg-blue-500 hover:bg-blue-600">В работе</Badge>
            case 'RESOLVED': return <Badge className="bg-green-500 hover:bg-green-600">Решено</Badge>
            case 'CLOSED': return <Badge variant="outline" className="text-slate-500 border-slate-300">Закрыто</Badge>
        }
    }

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

    const handleUpdateStatus = async (issueId: string, status: string, notes?: string, photos?: string[]) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/issues/${issueId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, resolution_notes: notes, resolution_photos: photos })
            })
            if (res.ok) {
                setSelectedIssue(null)
                fetchData()
            }
        } catch (error) {
            console.error("Error updating issue status:", error)
        }
    }

    const handleResolveWithPhotos = async () => {
        if (!selectedIssue) return
        
        setIsUploading(true)
        try {
            const uploadedUrls: string[] = []
            
            // Upload photos one by one
            for (const file of resolutionPhotos) {
                const formData = new FormData()
                formData.append('file', file)
                
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                })
                
                if (res.ok) {
                    const data = await res.json()
                    if (data.url) uploadedUrls.push(data.url)
                }
            }
            
            await handleUpdateStatus(selectedIssue.id, 'RESOLVED', resolutionNotes, uploadedUrls)
            
            // Reset state
            setResolutionPhotos([])
            setResolutionNotes("")
        } catch (error) {
            console.error("Error uploading photos:", error)
        } finally {
            setIsUploading(false)
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
            <div className="flex flex-col gap-6">
                <Link href={`/clubs/${clubId}/equipment`} className="flex items-center text-sm text-muted-foreground hover:text-foreground w-fit">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    К обзору
                </Link>
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">🛠 Журнал инцидентов</h1>
                        <p className="text-muted-foreground">Отслеживание проблем и ремонтов оборудования</p>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-rose-600 to-orange-600">
                        <Plus className="mr-2 h-4 w-4" />
                        Сообщить о проблеме
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-xl border shadow-sm">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Поиск по проблеме, оборудованию..."
                            className="pl-9 bg-slate-50 border-slate-200"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
                        <SelectTrigger className="w-full sm:w-[200px] bg-slate-50 border-slate-200">
                            <SelectValue placeholder="Статус" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Все статусы</SelectItem>
                            <SelectItem value="OPEN">Открыто</SelectItem>
                            <SelectItem value="IN_PROGRESS">В работе</SelectItem>
                            <SelectItem value="RESOLVED">Решено</SelectItem>
                            <SelectItem value="CLOSED">Закрыто</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Issues Table */}
            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[100px]">Статус</TableHead>
                            <TableHead className="w-[100px]">Приоритет</TableHead>
                            <TableHead>Оборудование</TableHead>
                            <TableHead className="w-[30%]">Проблема</TableHead>
                            <TableHead>Автор</TableHead>
                            <TableHead>Дата</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    <div className="flex items-center justify-center text-muted-foreground">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Загрузка...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredIssues.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                    Нет инцидентов, соответствующих фильтрам
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredIssues.map((issue) => (
                                <TableRow key={issue.id} className="hover:bg-slate-50/50">
                                    <TableCell>{getStatusBadge(issue.status)}</TableCell>
                                    <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{issue.equipment_name}</span>
                                            <span className="text-xs text-muted-foreground">{issue.equipment_type_name}</span>
                                            {issue.workstation_name && (
                                                <span className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                                    📍 {issue.workstation_name}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-medium">{issue.title}</span>
                                            <span className="text-xs text-muted-foreground line-clamp-1" title={issue.description}>{issue.description}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                <User className="h-3 w-3 text-slate-400" />
                                            </div>
                                            <span className="text-sm">{issue.reported_by_name || "Неизвестно"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(issue.created_at).toLocaleDateString("ru-RU")}
                                        <div className="text-[10px]">{new Date(issue.created_at).toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' })}</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Открыть меню</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Действия</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => setSelectedIssue(issue)}>
                                                    <FileText className="mr-2 h-4 w-4" /> Просмотр
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuLabel>Сменить статус</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleUpdateStatus(issue.id, 'OPEN')}>
                                                    Открыто
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUpdateStatus(issue.id, 'IN_PROGRESS')}>
                                                    В работе
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUpdateStatus(issue.id, 'RESOLVED')}>
                                                    Решено
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleUpdateStatus(issue.id, 'CLOSED')}>
                                                    Закрыто
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
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
                                            
                                            {/* Photo Upload Section */}
                                            <div className="space-y-2">
                                                <Label className="text-xs">Фотоотчет (опционально)</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {resolutionPhotos.map((file, idx) => (
                                                        <div key={idx} className="relative h-16 w-16 rounded border overflow-hidden group">
                                                            <img src={URL.createObjectURL(file)} alt="preview" className="h-full w-full object-cover" />
                                                            <button 
                                                                onClick={() => setResolutionPhotos(prev => prev.filter((_, i) => i !== idx))}
                                                                className="absolute top-0 right-0 bg-black/50 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-bl"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <label className="h-16 w-16 border-2 border-dashed border-slate-200 rounded flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                                                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-[8px] text-muted-foreground mt-1">Фото</span>
                                                        <input 
                                                            type="file" 
                                                            className="hidden" 
                                                            accept="image/*" 
                                                            capture="environment"
                                                            multiple 
                                                            onChange={(e) => {
                                                                if (e.target.files) {
                                                                    setResolutionPhotos(prev => [...prev, ...Array.from(e.target.files!)])
                                                                }
                                                            }} 
                                                        />
                                                    </label>
                                                </div>
                                            </div>

                                            <Button
                                                className="w-full bg-green-600"
                                                disabled={!resolutionNotes || isUploading}
                                                onClick={handleResolveWithPhotos}
                                            >
                                                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                                            
                                            {selectedIssue.resolution_photos && selectedIssue.resolution_photos.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {selectedIssue.resolution_photos.map((url, idx) => (
                                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 rounded border overflow-hidden hover:opacity-80 transition-opacity">
                                                            <img src={url} alt="Resolution" className="h-full w-full object-cover" />
                                                        </a>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pt-2">
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
