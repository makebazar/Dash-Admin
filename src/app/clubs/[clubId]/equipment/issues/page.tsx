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
    FileText,
    Send,
    UserPlus,
    Check,
    MapPin,
    PlayCircle
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import Link from "next/link"

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
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
    created_at: string
    resolved_at: string | null
    resolved_by_name: string | null
    assigned_to: string | null
    assigned_to_name: string | null
    resolution_notes: string | null
    resolution_photos: string[] | null
}

interface Equipment {
    id: string
    name: string
    type_name: string
    identifier?: string
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

export default function IssuesBoard() {
    const { clubId } = useParams()
    const [issues, setIssues] = useState<Issue[]>([])
    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Dialog states
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
    
    // New Issue Form
    const [newIssue, setNewIssue] = useState({
        equipment_id: '',
        title: '',
        description: '',
        severity: 'MEDIUM' as const
    })
    const [equipmentSearchOpen, setEquipmentSearchOpen] = useState(false)

    // Resolution
    const [resolutionNotes, setResolutionNotes] = useState("")
    const [resolutionPhotos, setResolutionPhotos] = useState<File[]>([])
    const [isUploading, setIsUploading] = useState(false)

    // Comments & Assignment
    const [comments, setComments] = useState<Comment[]>([])
    const [newComment, setNewComment] = useState("")
    const [isSendingComment, setIsSendingComment] = useState(false)

    // Filter states
    const [searchTerm, setSearchTerm] = useState("")
    const [activeTab, setActiveTab] = useState("OPEN")
    const [assigneeFilter, setAssigneeFilter] = useState<'ALL' | 'ME' | 'UNASSIGNED'>('ALL')

    const filteredIssues = useMemo(() => {
        return issues.filter(issue => {
            const matchesSearch = 
                issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                issue.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                issue.equipment_name.toLowerCase().includes(searchTerm.toLowerCase())
            
            let matchesTab = true
            if (activeTab === 'OPEN') {
                matchesTab = issue.status === 'OPEN'
            } else if (activeTab === 'IN_PROGRESS') {
                matchesTab = issue.status === 'IN_PROGRESS'
            } else if (activeTab === 'CLOSED') {
                matchesTab = issue.status === 'RESOLVED' || issue.status === 'CLOSED'
            }

            let matchesAssignee = true
            // Note: In a real app we'd need current user ID to filter by "ME"
            // For now, we'll just check if assigned_to is present for UNASSIGNED
            if (assigneeFilter === 'UNASSIGNED') {
                matchesAssignee = !issue.assigned_to
            }
            // 'ME' logic would require current user context, skipping for simplicity or need to fetch "me"

            return matchesSearch && matchesTab && matchesAssignee
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }, [issues, searchTerm, activeTab, assigneeFilter])

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [issuesRes, eqRes, empRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/equipment/issues`),
                fetch(`/api/clubs/${clubId}/equipment`),
                fetch(`/api/clubs/${clubId}/employees`) // Assuming this endpoint exists
            ])

            if (issuesRes.ok) {
                const data = await issuesRes.json()
                setIssues(data.issues || [])
            }
            if (eqRes.ok) {
                const data = await eqRes.json()
                setEquipment(data.equipment || [])
            }
            if (empRes.ok) {
                const data = await empRes.json()
                setEmployees(data.employees || [])
            }
        } catch (error) {
            console.error("Error fetching data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    const fetchComments = useCallback(async (issueId: string) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/issues/${issueId}/comments`)
            if (res.ok) {
                const data = await res.json()
                setComments(data.comments || [])
            }
        } catch (error) {
            console.error("Error fetching comments:", error)
        }
    }, [clubId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (selectedIssue) {
            fetchComments(selectedIssue.id)
        } else {
            setComments([])
        }
    }, [selectedIssue, fetchComments])

    const getStatusBadge = (status: Issue['status']) => {
        switch (status) {
            case 'OPEN': return <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-300">Открыто</Badge>
            case 'IN_PROGRESS': return <Badge className="bg-blue-500 hover:bg-blue-600">В работе</Badge>
            case 'RESOLVED': return <Badge className="bg-green-500 hover:bg-green-600">Решено</Badge>
            case 'CLOSED': return <Badge variant="outline" className="text-slate-500 border-slate-300">Закрыто</Badge>
        }
    }

    const getStatusLabel = (status: Issue['status']) => {
        switch (status) {
            case 'OPEN': return 'Открыто'
            case 'IN_PROGRESS': return 'В работе'
            case 'RESOLVED': return 'Решено'
            case 'CLOSED': return 'Закрыто'
            default: return status
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
                const updatedIssue = await res.json()
                // Update local state
                setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...updatedIssue } : i))
                if (selectedIssue?.id === issueId) {
                    setSelectedIssue(prev => prev ? { ...prev, ...updatedIssue } : null)
                }
                
                // Add system comment
                await fetch(`/api/clubs/${clubId}/equipment/issues/${issueId}/comments`, {
                    method: 'POST',
                    body: JSON.stringify({
                        content: `Статус изменен на: ${getStatusLabel(status as Issue['status'])}`,
                        is_system_message: true
                    })
                })
                fetchComments(issueId)
            }
        } catch (error) {
            console.error("Error updating issue status:", error)
        }
    }

    const handleAssign = async (issueId: string, userId: string | null) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/issues/${issueId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigned_to: userId })
            })
            if (res.ok) {
                const updatedIssue = await res.json()
                // Update local state properly with the new assignee name (which might not be in the response fully populated)
                const assigneeName = userId ? employees.find(e => e.id === userId)?.full_name : null
                
                const fullUpdatedIssue = {
                    ...updatedIssue,
                    assigned_to_name: assigneeName
                }

                setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...fullUpdatedIssue } : i))
                if (selectedIssue?.id === issueId) {
                    setSelectedIssue(prev => prev ? { ...prev, ...fullUpdatedIssue } : null)
                }

                // Add system comment
                const msg = userId ? `Назначен ответственный: ${assigneeName}` : 'Ответственный снят'
                await fetch(`/api/clubs/${clubId}/equipment/issues/${issueId}/comments`, {
                    method: 'POST',
                    body: JSON.stringify({
                        content: msg,
                        is_system_message: true
                    })
                })
                fetchComments(issueId)
            }
        } catch (error) {
            console.error("Error assigning user:", error)
        }
    }

    const handleChangeSeverity = async (issueId: string, severity: string) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/issues/${issueId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ severity })
            })
            if (res.ok) {
                const updatedIssue = await res.json()
                setIssues(prev => prev.map(i => i.id === issueId ? { ...i, ...updatedIssue } : i))
                if (selectedIssue?.id === issueId) {
                    setSelectedIssue(prev => prev ? { ...prev, ...updatedIssue } : null)
                }

                // Add system comment
                const sevLabel = severity === 'LOW' ? 'Низкий' : severity === 'MEDIUM' ? 'Средний' : severity === 'HIGH' ? 'Высокий' : 'Критический';
                await fetch(`/api/clubs/${clubId}/equipment/issues/${issueId}/comments`, {
                    method: 'POST',
                    body: JSON.stringify({
                        content: `Приоритет изменен на: ${sevLabel}`,
                        is_system_message: true
                    })
                })
                fetchComments(issueId)
            }
        } catch (error) {
            console.error("Error updating severity:", error)
        }
    }

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedIssue || !newComment.trim()) return

        setIsSendingComment(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/issues/${selectedIssue.id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ content: newComment })
            })
            if (res.ok) {
                setNewComment("")
                fetchComments(selectedIssue.id)
            }
        } catch (error) {
            console.error("Error adding comment:", error)
        } finally {
            setIsSendingComment(false)
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
                    <Select value={assigneeFilter} onValueChange={(val) => setAssigneeFilter(val as any)}>
                        <SelectTrigger className="w-full sm:w-[200px] bg-slate-50 border-slate-200">
                            <SelectValue placeholder="Ответственный" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Все</SelectItem>
                            <SelectItem value="UNASSIGNED">Не назначено</SelectItem>
                            {/* <SelectItem value="ME">Мои задачи</SelectItem> */}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="OPEN" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="OPEN">Открытые</TabsTrigger>
                    <TabsTrigger value="IN_PROGRESS">В работе</TabsTrigger>
                    <TabsTrigger value="CLOSED">Закрытые</TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Issues Table */}
            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[100px]">Статус</TableHead>
                            <TableHead className="w-[100px]">Приоритет</TableHead>
                            <TableHead>Оборудование</TableHead>
                            <TableHead className="w-[30%]">Проблема</TableHead>
                            <TableHead>Ответственный</TableHead>
                            <TableHead>Дата</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <div className="flex items-center justify-center text-muted-foreground">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Загрузка...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredIssues.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                    Нет инцидентов в этой категории
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredIssues.map((issue) => (
                                <TableRow 
                                    key={issue.id} 
                                    className="hover:bg-slate-50/50 cursor-pointer"
                                    onClick={() => setSelectedIssue(issue)}
                                >
                                    <TableCell>{getStatusBadge(issue.status)}</TableCell>
                                    <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{issue.equipment_name}</span>
                                            <span className="text-xs text-muted-foreground">{issue.equipment_type_name}</span>
                                            {(issue.workstation_name || issue.workstation_zone) && (
                                                <span className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                                    📍 {issue.workstation_zone ? `Зона ${issue.workstation_zone}` : ''}
                                                    {issue.workstation_zone && issue.workstation_name ? ' • ' : ''}
                                                    {issue.workstation_name}
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
                                        {issue.assigned_to_name ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-xs font-bold">
                                                    {issue.assigned_to_name.charAt(0)}
                                                </div>
                                                <span className="text-sm">{issue.assigned_to_name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-slate-400 italic">Не назначен</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(issue.created_at).toLocaleDateString("ru-RU")}
                                        <div className="text-[10px]">{new Date(issue.created_at).toLocaleTimeString("ru-RU", { hour: '2-digit', minute: '2-digit' })}</div>
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
                            <Popover open={equipmentSearchOpen} onOpenChange={setEquipmentSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={equipmentSearchOpen}
                                        className="w-full justify-between"
                                    >
                                        {newIssue.equipment_id
                                            ? equipment.find((e) => e.id === newIssue.equipment_id)?.name
                                            : "Выберите устройство..."}
                                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Поиск оборудования..." />
                                        <CommandList>
                                            <CommandEmpty>Оборудование не найдено.</CommandEmpty>
                                            <CommandGroup>
                                                {equipment.map((e) => (
                                                    <CommandItem
                                                        key={e.id}
                                                        value={e.name + ' ' + e.type_name}
                                                        onSelect={() => {
                                                            setNewIssue(prev => ({ ...prev, equipment_id: e.id }))
                                                            setEquipmentSearchOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                newIssue.equipment_id === e.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {e.name} <span className="ml-2 text-xs text-muted-foreground">({e.type_name})</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
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
                <DialogContent className="sm:max-w-4xl p-0 overflow-hidden h-[80vh] flex flex-col">
                    {selectedIssue && (
                        <div className="flex flex-1 h-full overflow-hidden">
                            {/* Left Side: Details & Actions */}
                            <div className="w-1/2 flex flex-col border-r bg-slate-50/50">
                                <div className="p-6 border-b bg-white space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Badge variant={selectedIssue.status === 'OPEN' ? 'secondary' : selectedIssue.status === 'IN_PROGRESS' ? 'default' : 'outline'} className="text-sm px-3 py-1">
                                            {getStatusLabel(selectedIssue.status)}
                                        </Badge>
                                        {/* Severity Selector */}
                                        <Select 
                                            value={selectedIssue.severity} 
                                            onValueChange={(val) => handleChangeSeverity(selectedIssue.id, val)}
                                        >
                                            <SelectTrigger className="w-[140px] h-8 text-xs">
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

                                    <h2 className="text-2xl font-bold leading-tight">{selectedIssue.title}</h2>
                                    
                                    {/* Equipment Card */}
                                    <div className="bg-slate-50 border rounded-lg p-3 flex items-start gap-3">
                                        <div className="p-2 bg-white rounded-md border text-slate-500">
                                            <Monitor className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="font-semibold text-sm flex items-center gap-2">
                                                {selectedIssue.equipment_name}
                                                <Badge variant="outline" className="text-[10px] font-normal text-slate-500">
                                                    {selectedIssue.equipment_type_name}
                                                </Badge>
                                            </div>
                                            {selectedIssue.equipment_identifier && (
                                                <div className="text-xs text-slate-500 font-mono">
                                                    ID: {selectedIssue.equipment_identifier}
                                                </div>
                                            )}
                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {selectedIssue.workstation_zone ? `Зона: ${selectedIssue.workstation_zone}` : 'Зона не указана'}
                                                {selectedIssue.workstation_name && ` • ${selectedIssue.workstation_name}`}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 flex-1 overflow-auto space-y-6">
                                    <section className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Описание</h4>
                                            {/* Author Info */}
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <User className="h-3 w-3" />
                                                <span className="font-medium text-slate-700">{selectedIssue.reported_by_name}</span>
                                                <span className="text-slate-300">•</span>
                                                <span>{new Date(selectedIssue.created_at).toLocaleString('ru-RU')}</span>
                                            </div>
                                        </div>
                                        <div className="text-sm leading-relaxed bg-white p-4 rounded-lg border shadow-sm">
                                            {selectedIssue.description || "Нет описания"}
                                        </div>
                                    </section>

                                    <section className="space-y-2">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Ответственный</h4>
                                        <div className="flex items-center gap-2">
                                            <Select 
                                                value={selectedIssue.assigned_to || "unassigned"} 
                                                onValueChange={(val) => handleAssign(selectedIssue.id, val === "unassigned" ? null : val)}
                                            >
                                                <SelectTrigger className="w-full bg-white">
                                                    <SelectValue placeholder="Назначить сотрудника" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Не назначен</SelectItem>
                                                    {employees.map(emp => (
                                                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </section>

                                    <Separator />

                                    <section className="space-y-4">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Управление статусом</h4>
                                        
                                        {/* Dynamic Action Buttons */}
                                        {selectedIssue.status === 'OPEN' && (
                                            <Button className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={() => handleUpdateStatus(selectedIssue.id, 'IN_PROGRESS')}>
                                                <PlayCircle className="mr-2 h-5 w-5" />
                                                Взять в работу
                                            </Button>
                                        )}

                                        {selectedIssue.status === 'IN_PROGRESS' && (
                                            <div className="space-y-4">
                                                <div className="bg-green-50/50 border border-green-100 rounded-lg p-4 space-y-3">
                                                    <Label className="text-green-800 font-medium">Решение проблемы</Label>
                                                    <textarea
                                                        className="w-full h-24 rounded-lg border p-3 text-sm focus:ring-2 focus:ring-green-500/20 outline-none"
                                                        placeholder="Опишите выполненные работы..."
                                                        value={resolutionNotes}
                                                        onChange={(e) => setResolutionNotes(e.target.value)}
                                                    />
                                                    <Button
                                                        className="w-full bg-green-600 hover:bg-green-700"
                                                        disabled={!resolutionNotes || isUploading}
                                                        onClick={handleResolveWithPhotos}
                                                    >
                                                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                                        Завершить ремонт
                                                    </Button>
                                                </div>
                                                <Button variant="outline" className="w-full text-slate-500" onClick={() => handleUpdateStatus(selectedIssue.id, 'OPEN')}>
                                                    Вернуть статус "Открыто"
                                                </Button>
                                            </div>
                                        )}

                                        {selectedIssue.status === 'RESOLVED' && (
                                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center space-y-3">
                                                <div className="flex items-center justify-center text-green-700 gap-2 font-medium">
                                                    <CheckCircle2 className="h-5 w-5" />
                                                    Проблема решена
                                                </div>
                                                <Button variant="outline" className="w-full bg-white" onClick={() => handleUpdateStatus(selectedIssue.id, 'CLOSED')}>
                                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                                    Закрыть тикет (Архив)
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" onClick={() => handleUpdateStatus(selectedIssue.id, 'IN_PROGRESS')}>
                                                    Вернуть в работу
                                                </Button>
                                            </div>
                                        )}

                                        {selectedIssue.status === 'CLOSED' && (
                                            <div className="p-4 bg-slate-50 border rounded-lg text-center">
                                                <div className="flex items-center justify-center text-slate-500 gap-2 font-medium mb-3">
                                                    <ShieldCheck className="h-5 w-5" />
                                                    Тикет закрыт
                                                </div>
                                                <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(selectedIssue.id, 'OPEN')}>
                                                    Переоткрыть
                                                </Button>
                                            </div>
                                        )}
                                    </section>

                                    {selectedIssue.resolution_notes && (
                                        <section className="space-y-2 pt-2">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-green-600">Результат решения</h4>
                                            <div className="p-4 bg-green-50 rounded-xl border border-green-100 italic text-sm text-green-800">
                                                {selectedIssue.resolution_notes}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            </div>

                            {/* Right Side: Comments & History */}
                            <div className="w-1/2 flex flex-col bg-slate-50 border-l h-full">
                                <div className="p-4 border-b bg-white flex items-center justify-between">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" /> Обсуждение
                                    </h3>
                                    {/* Removed Badge Counter as requested */}
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {comments.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                            <MessageCircle className="h-8 w-8 mb-2" />
                                            <p className="text-sm">Нет комментариев</p>
                                        </div>
                                    ) : (
                                        comments.map((comment) => (
                                            <div key={comment.id} className={cn("flex flex-col gap-1", comment.is_system_message ? "items-center my-4" : "items-start")}>
                                                {comment.is_system_message ? (
                                                    <Badge variant="outline" className="text-xs text-slate-500 font-normal bg-slate-100 border-slate-200">
                                                        {comment.content} • {new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </Badge>
                                                ) : (
                                                    <div className="bg-white p-3 rounded-lg border shadow-sm max-w-[90%]">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-bold text-xs">{comment.author_name}</span>
                                                            <span className="text-[10px] text-muted-foreground">{new Date(comment.created_at).toLocaleString()}</span>
                                                        </div>
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="p-4 bg-white border-t">
                                    <form onSubmit={handleAddComment} className="flex gap-2">
                                        <Input
                                            placeholder="Написать комментарий..."
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            className="flex-1"
                                        />
                                        <Button type="submit" size="icon" disabled={!newComment.trim() || isSendingComment}>
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </form>
                                </div>
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
