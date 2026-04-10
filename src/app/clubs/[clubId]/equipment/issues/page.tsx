"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    AlertTriangle,
    Plus,
    Search,
    Clock3,
    ChevronRight,
    Loader2,
    ChevronLeft,
    Monitor,
    MessageSquare,
    Check,
    MapPin,
    Wrench,
    UserPlus,
} from "lucide-react"
import Link from "next/link"
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
} from "@/components/ui/dialog"
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
import { PageShell } from "@/components/layout/PageShell"

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
    resolution_notes: string | null
    resolution_photos: string[] | null
}

interface Equipment {
    id: string
    name: string
    type_name: string
    identifier?: string
}

interface NewIssueForm {
    equipment_id: string
    title: string
    description: string
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}

interface IssueGroup {
    key: string
    zone: string
    place: string
    items: Issue[]
    open: number
    inProgress: number
    closed: number
    critical: number
}

const statusTabItems = [
    { value: "OPEN", label: "Открытые" },
    { value: "IN_PROGRESS", label: "В работе" },
    { value: "CLOSED", label: "Закрытые" },
] as const

export default function IssuesBoard() {
    const router = useRouter()
    const { clubId } = useParams()
    const [issues, setIssues] = useState<Issue[]>([])
    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [equipmentSearchOpen, setEquipmentSearchOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [activeTab, setActiveTab] = useState("OPEN")
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([])
    const [newIssue, setNewIssue] = useState<NewIssueForm>({
        equipment_id: "",
        title: "",
        description: "",
        severity: "MEDIUM" as const,
    })

    const filteredIssues = useMemo(() => {
        return issues
            .filter(issue => {
                const matchesSearch =
                    issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    issue.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    issue.equipment_name.toLowerCase().includes(searchTerm.toLowerCase())

                let matchesTab = true
                if (activeTab === "OPEN") {
                    matchesTab = issue.status === "OPEN"
                } else if (activeTab === "IN_PROGRESS") {
                    matchesTab = issue.status === "IN_PROGRESS"
                } else if (activeTab === "CLOSED") {
                    matchesTab = issue.status === "RESOLVED" || issue.status === "CLOSED"
                }

                return matchesSearch && matchesTab
            })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }, [issues, searchTerm, activeTab])

    const issueStats = useMemo(() => {
        const open = issues.filter(issue => issue.status === "OPEN").length
        const inProgress = issues.filter(issue => issue.status === "IN_PROGRESS").length
        const closed = issues.filter(issue => issue.status === "RESOLVED" || issue.status === "CLOSED").length
        const critical = issues.filter(issue => issue.severity === "CRITICAL" || issue.severity === "HIGH").length
        const unassigned = issues.filter(issue => !issue.assigned_to).length

        return { open, inProgress, closed, critical, unassigned, total: issues.length }
    }, [issues])

    const groupedIssues = useMemo(() => {
        const groups = new Map<string, IssueGroup>()

        for (const issue of filteredIssues) {
            const zone = issue.workstation_zone || "Без зоны"
            const place = issue.workstation_name || "Склад"
            const key = `${zone}::${place}`

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    zone,
                    place,
                    items: [],
                    open: 0,
                    inProgress: 0,
                    closed: 0,
                    critical: 0,
                })
            }

            const group = groups.get(key)!
            group.items.push(issue)

            if (issue.status === "OPEN") group.open += 1
            if (issue.status === "IN_PROGRESS") group.inProgress += 1
            if (issue.status === "RESOLVED" || issue.status === "CLOSED") group.closed += 1
            if (issue.severity === "HIGH" || issue.severity === "CRITICAL") group.critical += 1
        }

        return Array.from(groups.values())
            .map(group => ({
                ...group,
                items: [...group.items].sort((a, b) => {
                    const statusWeightA = a.status === "OPEN" ? 0 : a.status === "IN_PROGRESS" ? 1 : 2
                    const statusWeightB = b.status === "OPEN" ? 0 : b.status === "IN_PROGRESS" ? 1 : 2
                    if (statusWeightA !== statusWeightB) return statusWeightA - statusWeightB

                    const severityWeightA = a.severity === "CRITICAL" ? 0 : a.severity === "HIGH" ? 1 : a.severity === "MEDIUM" ? 2 : 3
                    const severityWeightB = b.severity === "CRITICAL" ? 0 : b.severity === "HIGH" ? 1 : b.severity === "MEDIUM" ? 2 : 3
                    if (severityWeightA !== severityWeightB) return severityWeightA - severityWeightB

                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                }),
            }))
            .sort((a, b) => {
                if (b.open !== a.open) return b.open - a.open
                if (b.inProgress !== a.inProgress) return b.inProgress - a.inProgress
                if (b.critical !== a.critical) return b.critical - a.critical
                const zoneCompare = a.zone.localeCompare(b.zone, "ru", { sensitivity: "base" })
                if (zoneCompare !== 0) return zoneCompare
                return a.place.localeCompare(b.place, "ru", { numeric: true, sensitivity: "base" })
            })
    }, [filteredIssues])

    useEffect(() => {
        setExpandedGroupKeys([])
    }, [searchTerm, activeTab])

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [issuesRes, eqRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/equipment/issues`),
                fetch(`/api/clubs/${clubId}/equipment`),
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
            console.error("Error fetching data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const getStatusBadge = (status: Issue["status"]) => {
        switch (status) {
            case "OPEN":
                return <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-300">Открыто</Badge>
            case "IN_PROGRESS":
                return <Badge className="bg-blue-500 hover:bg-blue-600">В работе</Badge>
            case "RESOLVED":
                return <Badge className="bg-green-500 hover:bg-green-600">Решено</Badge>
            case "CLOSED":
                return <Badge variant="outline" className="border-slate-300 text-slate-500">Закрыто</Badge>
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

    const getSeverityRowTone = (severity: Issue["severity"]) => {
        switch (severity) {
            case "CRITICAL":
                return "border-rose-200 bg-rose-50/50"
            case "HIGH":
                return "border-orange-200 bg-orange-50/40"
            case "MEDIUM":
                return "border-amber-200 bg-amber-50/30"
            default:
                return "border-slate-200 bg-white"
        }
    }

    const handleCreateIssue = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/issues`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newIssue),
            })

            if (res.ok) {
                setIsCreateOpen(false)
                setNewIssue({ equipment_id: "", title: "", description: "", severity: "MEDIUM" })
                fetchData()
            }
        } catch (error) {
            console.error("Error creating issue:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const toggleGroup = (groupKey: string) => {
        setExpandedGroupKeys(prev =>
            prev.includes(groupKey) ? prev.filter(key => key !== groupKey) : [...prev, groupKey]
        )
    }

    return (
        <PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                    <div className="min-w-0">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Инциденты</h1>
                        <p className="text-slate-500 text-lg mt-2">Отслеживание проблем, ремонтов и статуса оборудования</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                        <Button asChild variant="outline" className="hidden md:inline-flex md:w-auto rounded-xl h-11 px-6 font-medium">
                            <Link href={`/clubs/${clubId}/equipment`}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Назад
                            </Link>
                        </Button>
                        <Button onClick={() => setIsCreateOpen(true)} className="w-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 sm:w-auto rounded-xl h-11 px-6 font-medium">
                            <Plus className="mr-2 h-4 w-4" />
                            Сообщить о проблеме
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">Всего инцидентов</p>
                        <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700 shrink-0">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-900">{issueStats.total}</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">Открытые</p>
                        <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700 shrink-0">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-900">{issueStats.open}</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">В работе</p>
                        <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-600 shrink-0">
                            <Wrench className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-blue-600">{issueStats.inProgress}</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">Требуют внимания</p>
                        <div className="rounded-2xl bg-rose-50 p-2.5 text-rose-600 shrink-0">
                            <Clock3 className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-rose-600">{issueStats.critical}</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">Без ответственного</p>
                        <div className="rounded-2xl bg-amber-50 p-2.5 text-amber-600 shrink-0">
                            <UserPlus className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-amber-600">{issueStats.unassigned}</h3>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
                <div className="space-y-6">
                    <div className="flex flex-col gap-4">
                        <div className="relative w-full">
                            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="Поиск по проблеме, описанию или оборудованию..."
                                className="h-12 border-slate-200 bg-slate-50/50 pl-10 rounded-xl font-medium text-slate-900 focus:bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-start">
                            <Tabs defaultValue="OPEN" value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="flex h-auto w-full justify-start gap-8 overflow-x-auto rounded-none border-b border-slate-200 bg-transparent p-0 mb-6">
                                    {statusTabItems.map(item => (
                                        <TabsTrigger key={item.value} value={item.value} className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all">
                                            {item.label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Мест: <span className="font-medium text-foreground">{groupedIssues.length}</span>
                        {" · "}
                        Инцидентов: <span className="font-medium text-foreground">{filteredIssues.length}</span>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="space-y-4 p-4 sm:p-6">
                    {isLoading ? (
                        <div className="flex h-40 flex-col items-center justify-center text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="mt-2 text-sm text-muted-foreground">Загрузка инцидентов...</p>
                        </div>
                    ) : groupedIssues.length === 0 ? (
                        <div className="flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-center">
                            <MessageSquare className="h-8 w-8 text-slate-300" />
                            <p className="mt-2 text-sm font-medium">Ничего не найдено</p>
                            <p className="text-xs text-muted-foreground">Измени фильтры или создай новый инцидент</p>
                        </div>
                    ) : (
                        groupedIssues.map(group => {
                            const isExpanded = expandedGroupKeys.includes(group.key)

                            return (
                                <div key={group.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(group.key)}
                                        className="w-full border-b border-slate-100 bg-slate-50/50 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2.5">
                                                    <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", isExpanded && "rotate-90")} />
                                                    <div className="min-w-0">
                                                        <div className="truncate text-base font-semibold text-slate-900">{group.place}</div>
                                                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <MapPin className="h-3 w-3" />
                                                            <span>{group.zone}</span>
                                                            <span>•</span>
                                                            <span>{group.items.length} инцид.</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 pl-6 lg:pl-0">
                                                {group.open > 0 ? <Badge className="h-6 bg-slate-100 text-slate-700 hover:bg-slate-100">{group.open} открыто</Badge> : null}
                                                {group.inProgress > 0 ? <Badge className="h-6 bg-blue-50 text-blue-700 hover:bg-blue-50">{group.inProgress} в работе</Badge> : null}
                                                {group.critical > 0 ? <Badge className="h-6 bg-rose-50 text-rose-700 hover:bg-rose-50">{group.critical} важных</Badge> : null}
                                                {group.closed > 0 ? <Badge className="h-6 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{group.closed} закрыто</Badge> : null}
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded ? (
                                        <div className="space-y-3 p-4">
                                            {group.items.map(issue => (
                                                <button
                                                    type="button"
                                                    key={issue.id}
                                                    className={cn("w-full rounded-xl border p-4 text-left", getSeverityRowTone(issue.severity))}
                                                    onClick={() => router.push(`/clubs/${clubId}/equipment/issues/${issue.id}`)}
                                                >
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {getStatusBadge(issue.status)}
                                                                {getSeverityBadge(issue.severity)}
                                                            </div>
                                                            <div className="mt-2 text-sm font-semibold text-slate-900">{issue.title}</div>
                                                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                                {issue.description || "Без описания"}
                                                            </div>
                                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-700">
                                                                <Monitor className="h-3.5 w-3.5 text-slate-500" />
                                                                <span className="font-medium">{issue.equipment_name}</span>
                                                                <span className="text-muted-foreground">{issue.equipment_type_name}</span>
                                                                {issue.equipment_identifier ? (
                                                                    <span className="font-mono text-muted-foreground">ID: {issue.equipment_identifier}</span>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 flex-col gap-2 text-left lg:min-w-[180px] lg:text-right">
                                                            <div className="text-xs text-muted-foreground">
                                                                {new Date(issue.created_at).toLocaleDateString("ru-RU")}
                                                                <div>{new Date(issue.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
                                                            </div>
                                                            <div className="text-xs text-slate-700">
                                                                Автор: <span className="font-medium">{issue.reported_by_name}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-700">
                                                                Ответственный: <span className={cn("font-medium", !issue.assigned_to_name && "text-slate-400")}>{issue.assigned_to_name || "Не назначен"}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[500px] rounded-3xl p-6 sm:p-8">
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
                                            ? equipment.find(item => item.id === newIssue.equipment_id)?.name
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
                                                {equipment.map(item => (
                                                    <CommandItem
                                                        key={item.id}
                                                        value={`${item.name} ${item.type_name}`}
                                                        onSelect={() => {
                                                            setNewIssue(prev => ({ ...prev, equipment_id: item.id }))
                                                            setEquipmentSearchOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                newIssue.equipment_id === item.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {item.name}
                                                        <span className="ml-2 text-xs text-muted-foreground">({item.type_name})</span>
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
                                className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"
                                placeholder="Краткое название проблемы"
                                value={newIssue.title}
                                onChange={(e) => setNewIssue(prev => ({ ...prev, title: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Подробности</Label>
                            <textarea
                                className="w-full min-h-[100px] resize-y bg-slate-50/50 border-slate-200 border rounded-xl font-medium text-slate-900 focus:bg-white p-4"
                                placeholder="Опишите симптомы, когда проявилось и что уже пробовали сделать..."
                                value={newIssue.description}
                                onChange={(e) => setNewIssue(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Приоритет</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(level => (
                                    <Button
                                        key={level}
                                        type="button"
                                        variant={newIssue.severity === level ? "default" : "outline"}
                                        size="sm"
                                        className={cn("text-[10px] rounded-xl font-bold h-9", newIssue.severity === level ? "bg-slate-900 text-white" : "")}
                                        onClick={() => setNewIssue(prev => ({ ...prev, severity: level as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }))}
                                    >
                                        {level === "LOW" ? "Низкий" : level === "MEDIUM" ? "Средний" : level === "HIGH" ? "Высокий" : "Критич."}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => setIsCreateOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={isSaving || !newIssue.equipment_id} className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Отправить отчет
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Mobile Bottom Back Button */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl md:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="mx-auto flex max-w-[1600px] gap-2">
                    <Button asChild variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 bg-white font-medium">
                        <Link href={`/clubs/${clubId}/equipment`}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                </div>
            </div>
            </div>
        </PageShell>
    )
}
