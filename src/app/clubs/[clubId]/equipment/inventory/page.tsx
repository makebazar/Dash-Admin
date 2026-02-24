"use client"

import { useEffect, useState, useCallback, useMemo, Fragment } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
    Monitor,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Pencil,
    Trash2,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    Clock,
    LayoutGrid,
    List,
    ChevronLeft,
    Loader2,
    Calendar,
    Tag,
    Info,
    Move,
    Wrench,
    Archive,
    History,
    FileText,
    Download,
    RefreshCw,
    Box,
    MousePointer2,
    Keyboard,
    Headphones,
    Gamepad2,
    Gamepad,
    Tv,
    Glasses,
    Square,
    Sofa,
    ChevronDown,
    ChevronRight
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
    TableRow
} from "@/components/ui/table"
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { InstructionsTab } from "./InstructionsTab"

// --- Types ---

type EquipmentStatus = 'ACTIVE' | 'REPAIR' | 'STORAGE' | 'WRITTEN_OFF'

interface Equipment {
    id: string
    name: string
    type: string
    type_name: string
    type_icon: string
    identifier: string | null
    brand: string | null
    model: string | null
    workstation_id: string | null
    workstation_name: string | null
    workstation_zone: string | null
    warranty_expires: string | null
    warranty_status: 'ACTIVE' | 'EXPIRED' | 'EXPIRING_SOON' | null
    last_cleaned_at: string | null
    cleaning_interval_days?: number
    is_active: boolean
    notes: string | null
    maintenance_enabled?: boolean
    assigned_user_id?: string | null
    // Extended fields for prototype
    status?: EquipmentStatus
    purchase_date?: string
    price?: number
}

interface EquipmentType {
    code: string
    name_ru: string
    icon: string
}

interface Workstation {
    id: string
    name: string
    zone: string
}

interface Employee {
    id: string
    full_name: string
}

export default function EquipmentInventory() {
    const { clubId } = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [types, setTypes] = useState<EquipmentType[]>([])
    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Pagination
    const [page, setPage] = useState(1)
    const [limit] = useState(50)
    const [totalItems, setTotalItems] = useState(0)
    const totalPages = Math.ceil(totalItems / limit)

    // Stats state
    const [inventoryStats, setInventoryStats] = useState({
        total: 0,
        active: 0,
        repair: 0,
        value: 0
    })

    // Filters
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState("all")
    const [workstationFilter, setWorkstationFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [isGrouped, setIsGrouped] = useState(true)

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Grouping & Expansion
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingEquipment, setEditingEquipment] = useState<Partial<Equipment> | null>(null)
    const [activeTab, setActiveTab] = useState("details")
    const [history, setHistory] = useState<any[]>([])
    const [isHistoryLoading, setIsHistoryLoading] = useState(false)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
            setPage(1) // Reset to first page on search
        }, 500)
        return () => clearTimeout(timer)
    }, [search])

    const fetchHistory = async (id: string) => {
        setIsHistoryLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${id}/history`)
            const data = await res.json()
            if (res.ok) setHistory(data)
        } catch (error) {
            console.error("Error fetching history:", error)
        } finally {
            setIsHistoryLoading(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'history' && editingEquipment?.id) {
            fetchHistory(editingEquipment.id)
        }
    }, [activeTab, editingEquipment?.id])

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const offset = (page - 1) * limit
            const params = new URLSearchParams({
                include_inactive: 'true',
                limit: limit.toString(),
                offset: offset.toString()
            })

            if (debouncedSearch) params.append('search', debouncedSearch)
            if (typeFilter !== 'all') params.append('type', typeFilter)
            if (workstationFilter !== 'all') params.append('workstation_id', workstationFilter)
            if (statusFilter !== 'all') params.append('status', statusFilter)

            const [eqRes, typeRes, wsRes, statsRes, empRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/equipment?${params.toString()}`, { cache: 'no-store' }),
                fetch(`/api/equipment-types`, { cache: 'no-store' }),
                fetch(`/api/clubs/${clubId}/workstations`, { cache: 'no-store' }),
                fetch(`/api/clubs/${clubId}/equipment/stats`, { cache: 'no-store' }),
                fetch(`/api/clubs/${clubId}/employees`, { cache: 'no-store' })
            ])

            const eqData = await eqRes.json()
            const typeData = await typeRes.json()
            const wsData = await wsRes.json()
            const statsData = await statsRes.json()
            const empData = await empRes.json()

            if (eqRes.ok) {
                // Enrich data with status logic for prototype
                const enriched = (eqData.equipment || []).map((e: any) => ({
                    ...e,
                    status: e.is_active ? 'ACTIVE' : 'WRITTEN_OFF' // Simplified mapping
                }))
                setEquipment(enriched)
                setTotalItems(eqData.total || 0)
                
                // Automatically expand groups that have items when data is loaded
                if (enriched.length > 0) {
                    const groupIds = new Set<string>()
                    enriched.forEach((e: any) => {
                        groupIds.add(e.workstation_id || 'unassigned')
                    })
                    setExpandedGroups(prev => {
                        const newSet = new Set(prev)
                        groupIds.forEach(id => newSet.add(id))
                        return newSet
                    })
                }
            }
            if (typeRes.ok) setTypes(typeData || [])
            if (wsRes.ok) setWorkstations(wsData || [])
            if (empRes.ok) setEmployees(empData.employees || [])
            if (statsRes.ok) {
                setInventoryStats({
                    total: statsData.total || 0,
                    active: statsData.active || 0,
                    repair: statsData.repair || 0,
                    value: statsData.value || 0
                })
            }

        } catch (error) {
            console.error("Error fetching inventory data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId, page, limit, debouncedSearch, typeFilter, workstationFilter, statusFilter])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            handleCreate()
        }
    }, [searchParams])

    // Reset page when filters change
    const handleFilterChange = (setter: (val: string) => void) => (val: string) => {
        setter(val)
        setPage(1)
    }

    const filteredEquipment = equipment // Now filtered on server side

    const groupedEquipment = useMemo(() => {
        const groups: Record<string, { name: string, zone?: string, items: Equipment[] }> = {
            'unassigned': { name: 'Склад (Не назначено)', items: [] }
        }

        // Initialize groups for all workstations
        workstations.forEach(ws => {
            groups[ws.id] = { name: ws.name, zone: ws.zone, items: [] }
        })

        // Distribute equipment into groups
        filteredEquipment.forEach(item => {
            const groupId = item.workstation_id || 'unassigned'
            if (!groups[groupId]) {
                groups[groupId] = { 
                    name: item.workstation_name || 'Неизвестная локация', 
                    zone: item.workstation_zone || undefined,
                    items: [] 
                }
            }
            groups[groupId].items.push(item)
        })

        // Filter out empty workstation groups, but keep unassigned if it has items or if we are filtering
        return Object.entries(groups)
            .filter(([id, group]) => group.items.length > 0)
            .sort(([idA, groupA], [idB, groupB]) => {
                if (idA === 'unassigned') return -1
                if (idB === 'unassigned') return 1
                return groupA.name.localeCompare(groupB.name)
            })
    }, [filteredEquipment, workstations])

    const toggleGroup = (groupId: string) => {
        const newSet = new Set(expandedGroups)
        if (newSet.has(groupId)) newSet.delete(groupId)
        else newSet.add(groupId)
        setExpandedGroups(newSet)
    }

    const toggleGroupSelection = (groupId: string, items: Equipment[]) => {
        const allSelected = items.every(item => selectedIds.has(item.id))
        const newSet = new Set(selectedIds)
        if (allSelected) {
            items.forEach(item => newSet.delete(item.id))
        } else {
            items.forEach(item => newSet.add(item.id))
        }
        setSelectedIds(newSet)
    }

    // --- Actions ---

    const handleCreate = () => {
        setEditingEquipment({
            type: 'PC',
            name: '',
            is_active: true,
            cleaning_interval_days: 30,
            status: 'ACTIVE'
        })
        setActiveTab("details")
        setIsDialogOpen(true)
    }

    const handleEdit = (item: Equipment) => {
        setEditingEquipment(item)
        setActiveTab("details")
        setIsDialogOpen(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingEquipment?.name || !editingEquipment?.type) return

        setIsSaving(true)
        try {
            const isNew = !editingEquipment.id
            const url = isNew
                ? `/api/clubs/${clubId}/equipment`
                : `/api/clubs/${clubId}/equipment/${editingEquipment.id}`

            const res = await fetch(url, {
                method: isNew ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingEquipment)
            })

            if (res.ok) {
                setIsDialogOpen(false)
                fetchData()
            }
        } catch (error) {
            console.error("Error saving equipment:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Вы уверены, что хотите удалить это оборудование?")) return

        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${id}`, {
                method: "DELETE"
            })
            if (res.ok) fetchData()
        } catch (error) {
            console.error("Error deleting equipment:", error)
        }
    }

    const handleSelectAll = () => {
        if (selectedIds.size === filteredEquipment.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredEquipment.map(e => e.id)))
        }
    }

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const handleExport = () => {
        // Convert equipment to CSV
        const headers = ["Название", "Тип", "S/N", "Бренд", "Модель", "Локация", "Статус", "Гарантия"]
        const rows = filteredEquipment.map(e => [
            e.name,
            e.type_name || e.type,
            e.identifier || "-",
            e.brand || "-",
            e.model || "-",
            e.workstation_name || "Склад",
            e.is_active ? "Активно" : "Списано",
            e.warranty_expires ? new Date(e.warranty_expires).toLocaleDateString("ru-RU") : "-"
        ])

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n")

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `inventory_export_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleBulkRepair = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`Отправить в ремонт ${selectedIds.size} поз.?`)) return
        
        setIsSaving(true)
        try {
            // Logic for bulk repair (e.g., creating issues or changing status)
            // For now, let's just show an alert since we don't have a bulk API yet
            alert("Функция группового ремонта будет доступна в следующем обновлении")
        } finally {
            setIsSaving(false)
        }
    }

    const handleBulkArchive = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`Списать ${selectedIds.size} поз.?`)) return
        
        setIsSaving(true)
        try {
            const ids = Array.from(selectedIds)
            await Promise.all(ids.map(id => 
                fetch(`/api/clubs/${clubId}/equipment/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ is_active: false })
                })
            ))
            setSelectedIds(new Set())
            fetchData()
        } catch (error) {
            console.error("Bulk archive error:", error)
        } finally {
            setIsSaving(false)
        }
    }

    // --- Render Helpers ---

    const getStatusBadge = (item: Equipment) => {
        if (!item.is_active) return <Badge variant="secondary" className="bg-slate-100 text-slate-500">Списано</Badge>
        if (item.workstation_id) return <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 shadow-none border-none">Активно</Badge>
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">На складе</Badge>
    }

    const getEquipmentIcon = (type: string) => {
        switch(type) {
            case 'PC': return <Monitor className="h-5 w-5" />
            case 'MOUSE': return <MousePointer2 className="h-5 w-5" />
            case 'KEYBOARD': return <Keyboard className="h-5 w-5" />
            case 'HEADSET': return <Headphones className="h-5 w-5" />
            case 'CONSOLE': return <Gamepad2 className="h-5 w-5" />
            case 'GAMEPAD': return <Gamepad className="h-5 w-5" />
            case 'TV': return <Tv className="h-5 w-5" />
            case 'VR_HEADSET': return <Glasses className="h-5 w-5" />
            case 'MOUSEPAD': return <Square className="h-5 w-5" />
            case 'CHAIR': return <Sofa className="h-5 w-5" />
            default: return <Wrench className="h-5 w-5" />
        }
    }

    // --- Stats calculation removed (now from server) ---

    return (
        <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
            {/* Header & Breadcrumbs */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                         <Link href={`/clubs/${clubId}/equipment`} className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <div className="p-2 rounded-full hover:bg-slate-100">
                                <ChevronLeft className="h-5 w-5" />
                            </div>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Инвентаризация</h1>
                            <p className="text-sm text-muted-foreground">База данных оборудования и периферии</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => fetchData()}>
                            <RefreshCw className="h-4 w-4 mr-2" /> Обновить
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="h-4 w-4 mr-2" /> Экспорт
                        </Button>
                        <Button onClick={handleCreate} className="bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
                            <Plus className="mr-2 h-4 w-4" />
                            Новая позиция
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="list" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="list">Список оборудования</TabsTrigger>
                    <TabsTrigger value="instructions">Инструкции</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="space-y-6">

            {/* Dashboard Stats (New) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Всего единиц</p>
                            <h3 className="text-2xl font-bold mt-1">{inventoryStats.total}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <Box className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">В эксплуатации</p>
                            <h3 className="text-2xl font-bold mt-1 text-green-600">{inventoryStats.active}</h3>
                        </div>
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                            <Monitor className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">В ремонте</p>
                            <h3 className="text-2xl font-bold mt-1 text-orange-600">{inventoryStats.repair}</h3>
                        </div>
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                            <Wrench className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Оценочная стоимость</p>
                            <h3 className="text-2xl font-bold mt-1">≈ {inventoryStats.value.toLocaleString()} ₽</h3>
                        </div>
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                            <Tag className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Advanced Filters Bar */}
            <div className="flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border">
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex-1 relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Поиск по названию, серийному номеру..."
                            className="pl-9 bg-slate-50 border-slate-200"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
                            <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Тип оборудования" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Все типы</SelectItem>
                                {types.map(t => (
                                    <SelectItem key={t.code} value={t.code}>{t.name_ru}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={workstationFilter} onValueChange={handleFilterChange(setWorkstationFilter)}>
                            <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Локация" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Все локации</SelectItem>
                                <SelectItem value="unassigned">Склад (Не назначено)</SelectItem>
                                {workstations.map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
                            <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Статус" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Любой статус</SelectItem>
                                <SelectItem value="active">Активно</SelectItem>
                                <SelectItem value="inactive">Списано / Архив</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 h-10">
                            <Label htmlFor="grouping-toggle" className="text-xs font-medium text-slate-500 cursor-pointer">Группировка</Label>
                            <Switch 
                                id="grouping-toggle"
                                checked={isGrouped}
                                onCheckedChange={setIsGrouped}
                            />
                        </div>
                        
                        <Button variant="ghost" size="icon" onClick={() => {
                            setSearch("")
                            setTypeFilter("all")
                            setWorkstationFilter("all")
                            setStatusFilter("all")
                            setPage(1)
                        }}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                
                {/* Bulk Actions Bar (Conditional) */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 text-blue-700 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
                        <span className="font-medium ml-2">Выбрано: {selectedIds.size}</span>
                        <div className="h-4 w-px bg-blue-200 mx-2" />
                        <Button size="sm" variant="ghost" className="hover:bg-blue-100 hover:text-blue-800" onClick={handleBulkRepair}>
                            <Wrench className="h-3.5 w-3.5 mr-2" /> Отправить в ремонт
                        </Button>
                        <Button size="sm" variant="ghost" className="hover:bg-blue-100 hover:text-blue-800" onClick={handleBulkArchive}>
                            <Archive className="h-3.5 w-3.5 mr-2" /> Списать
                        </Button>
                        <Button size="sm" variant="ghost" className="hover:bg-blue-100 hover:text-blue-800 ml-auto" onClick={() => setSelectedIds(new Set())}>
                            Снять выделение
                        </Button>
                    </div>
                )}
            </div>

            {/* Data Table */}
            <Card className="border-none shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-[40px]">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300"
                                        checked={selectedIds.size === filteredEquipment.length && filteredEquipment.length > 0}
                                        onChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead className="w-[300px]">Оборудование</TableHead>
                                <TableHead>Идентификация</TableHead>
                                <TableHead>Расположение</TableHead>
                                <TableHead>Состояние</TableHead>
                                <TableHead>Гарантия</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                                        <p className="text-muted-foreground mt-2">Загрузка реестра...</p>
                                    </TableCell>
                                </TableRow>
                            ) : (isGrouped && groupedEquipment.length > 0) ? (
                                groupedEquipment.map(([groupId, group]) => {
                                    const isExpanded = expandedGroups.has(groupId)
                                    const allGroupSelected = group.items.every(item => selectedIds.has(item.id))
                                    const someGroupSelected = group.items.some(item => selectedIds.has(item.id)) && !allGroupSelected

                                    return (
                                        <Fragment key={groupId}>
                                            {/* Group Header Row */}
                                            <TableRow 
                                                className="bg-slate-100 hover:bg-slate-200 transition-colors border-y-2 border-slate-300 cursor-pointer sticky top-0 z-10"
                                                onClick={() => toggleGroup(groupId)}
                                            >
                                                <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
                                                    <input 
                                                        type="checkbox" 
                                                        className={cn(
                                                            "rounded border-gray-300",
                                                            someGroupSelected && "opacity-50"
                                                        )}
                                                        checked={allGroupSelected}
                                                        onChange={() => toggleGroupSelection(groupId, group.items)}
                                                    />
                                                </TableCell>
                                                <TableCell colSpan={6} className="py-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-slate-500">
                                                                {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {groupId === 'unassigned' ? (
                                                                    <Box className="h-5 w-5 text-amber-600" />
                                                                ) : (
                                                                    <LayoutGrid className="h-5 w-5 text-indigo-600" />
                                                                )}
                                                                <span className="font-black text-sm uppercase tracking-wider text-slate-800">
                                                                    {group.name} 
                                                                    {group.zone && <span className="text-slate-500 font-bold ml-3">| {group.zone}</span>}
                                                                </span>
                                                                <Badge className="ml-3 bg-indigo-600 text-white border-none text-[10px] font-black px-2">
                                                                    {group.items.length}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                                                            <span className="text-green-600">{group.items.filter(i => i.is_active).length} активных</span>
                                                            <div className="h-3 w-px bg-slate-300" />
                                                            <span className="text-rose-600">{group.items.filter(i => !i.is_active).length} списано</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {/* Group Items */}
                                            {isExpanded && group.items.map((item) => (
                                                <TableRow 
                                                    key={item.id} 
                                                    className={cn(
                                                        "group hover:bg-slate-50 transition-colors cursor-pointer border-l-4 border-l-transparent",
                                                        selectedIds.has(item.id) && "bg-indigo-50/50 hover:bg-indigo-50 border-l-indigo-600"
                                                    )}
                                                    onClick={(e) => {
                                                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return
                                                        handleEdit(item)
                                                    }}
                                                >
                                                    <TableCell className="pl-6">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-gray-300"
                                                            checked={selectedIds.has(item.id)}
                                                            onChange={() => toggleSelection(item.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:shadow-md transition-all border border-slate-100 group-hover:border-indigo-100">
                                                                {getEquipmentIcon(item.type)}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-sm text-slate-800">{item.name}</p>
                                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">{item.type_name || item.type}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            {item.identifier ? (
                                                                <code className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-lg text-slate-700 font-mono border border-slate-200 font-bold">{item.identifier}</code>
                                                            ) : <span className="text-xs text-muted-foreground">—</span>}
                                                            <p className="text-[10px] text-slate-400 font-medium tracking-tight">{item.brand} {item.model}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-600">{group.name}</span>
                                                            {group.zone && <span className="text-[10px] text-slate-400 font-medium">{group.zone}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {getStatusBadge(item)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.warranty_expires ? (
                                                            <div className="flex flex-col">
                                                                <span className={cn(
                                                                    "text-xs font-black",
                                                                    item.warranty_status === 'EXPIRED' ? "text-rose-500" : 
                                                                    item.warranty_status === 'EXPIRING_SOON' ? "text-amber-500" : "text-slate-500"
                                                                )}>
                                                                    {new Date(item.warranty_expires).toLocaleDateString("ru-RU")}
                                                                </span>
                                                                {item.warranty_status === 'EXPIRED' && <span className="text-[9px] text-rose-500 font-black uppercase tracking-tighter">Гарантия истекла</span>}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-900">
                                                                    <MoreVertical className="h-5 w-5" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-[200px] rounded-xl shadow-xl border-slate-200">
                                                                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Управление</DropdownMenuLabel>
                                                                <DropdownMenuItem onClick={() => handleEdit(item)} className="rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer">
                                                                    <Pencil className="mr-2 h-4 w-4" /> Редактировать
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => router.push(`/clubs/${clubId}/equipment/${item.id}`)} className="rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer">
                                                                    <FileText className="mr-2 h-4 w-4" /> Карточка товара
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator className="bg-slate-100 mx-1" />
                                                                <DropdownMenuItem onClick={() => handleEdit(item)} className="rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer">
                                                                    <History className="mr-2 h-4 w-4" /> История
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator className="bg-slate-100 mx-1" />
                                                                <DropdownMenuItem className="text-rose-600 focus:text-white focus:bg-rose-500 rounded-lg mx-1 cursor-pointer" onClick={() => handleDelete(item.id)}>
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Удалить
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </Fragment>
                                    )
                                })
                            ) : filteredEquipment.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-4 bg-slate-100 rounded-full">
                                                <Search className="h-8 w-8 opacity-20" />
                                            </div>
                                            <p className="font-semibold text-lg">Ничего не найдено</p>
                                            <p className="text-sm max-w-xs mx-auto">Попробуйте изменить параметры фильтрации или добавить новое оборудование</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredEquipment.map((item) => (
                                    <TableRow 
                                        key={item.id} 
                                        className={cn(
                                            "group hover:bg-slate-50/80 transition-colors cursor-pointer",
                                            selectedIds.has(item.id) && "bg-blue-50/50 hover:bg-blue-50/80"
                                        )}
                                        onClick={(e) => {
                                            if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return
                                            handleEdit(item)
                                        }}
                                    >
                                        <TableCell>
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300"
                                                checked={selectedIds.has(item.id)}
                                                onChange={() => toggleSelection(item.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-200">
                                                    {getEquipmentIcon(item.type)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm">{item.name}</p>
                                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-slate-100 text-slate-500">{item.type_name || item.type}</Badge>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                {item.identifier ? (
                                                    <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono border border-slate-200">{item.identifier}</code>
                                                ) : <span className="text-xs text-muted-foreground">—</span>}
                                                <p className="text-[11px] text-muted-foreground">{item.brand} {item.model}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {item.workstation_name ? (
                                                <div className="flex items-center gap-2">
                                                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-medium">{item.workstation_name}</span>
                                                        <span className="text-[10px] text-muted-foreground">{item.workstation_zone}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Box className="h-3.5 w-3.5 text-amber-500" />
                                                    <span className="text-xs text-amber-600 font-medium">Склад</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(item)}
                                        </TableCell>
                                        <TableCell>
                                            {item.warranty_expires ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className={cn(
                                                        "text-xs font-medium",
                                                        item.warranty_status === 'EXPIRED' ? "text-rose-600" : 
                                                        item.warranty_status === 'EXPIRING_SOON' ? "text-amber-600" : "text-slate-600"
                                                    )}>
                                                        {new Date(item.warranty_expires).toLocaleDateString("ru-RU")}
                                                    </span>
                                                    {item.warranty_status === 'EXPIRED' && <span className="text-[9px] text-rose-600 font-bold uppercase tracking-wide">Истекла</span>}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-200">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-[200px]">
                                                    <DropdownMenuLabel>Управление</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleEdit(item)}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Редактировать
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => router.push(`/clubs/${clubId}/equipment/${item.id}`)}>
                                                        <FileText className="mr-2 h-4 w-4" /> Карточка товара
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleEdit(item)}>
                                                        <History className="mr-2 h-4 w-4" /> История
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-rose-600 focus:text-rose-600 focus:bg-rose-50" onClick={() => handleDelete(item.id)}>
                                                        <Trash2 className="mr-2 h-4 w-4" /> Удалить
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
                
                {/* Pagination Controls */}
                {!isLoading && totalItems > 0 && (
                    <div className="px-6 py-4 bg-slate-50 border-t flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            Показано <span className="font-medium">{Math.min(totalItems, (page - 1) * limit + 1)}</span> - <span className="font-medium">{Math.min(totalItems, page * limit)}</span> из <span className="font-medium">{totalItems}</span> позиций
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-8 bg-white"
                            >
                                Назад
                            </Button>
                            <div className="flex items-center gap-1">
                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    // Logic for showing pages near current page
                                    let pageNum = page;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (page <= 3) pageNum = i + 1;
                                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = page - 2 + i;

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={page === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setPage(pageNum)}
                                            className="h-8 w-8 p-0 bg-white data-[variant=default]:bg-primary"
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                                {totalPages > 5 && page < totalPages - 2 && (
                                    <>
                                        <span className="text-muted-foreground px-1 text-xs">...</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(totalPages)}
                                            className="h-8 w-8 p-0 bg-white"
                                        >
                                            {totalPages}
                                        </Button>
                                    </>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="h-8 bg-white"
                            >
                                Вперед
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

                </TabsContent>

                <TabsContent value="instructions">
                    <InstructionsTab />
                </TabsContent>
            </Tabs>

            {/* Create/Edit Dialog with Tabs */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden max-h-[90vh] flex flex-col gap-0">
                    <DialogHeader className="p-6 pb-2 bg-slate-50 border-b">
                        <DialogTitle className="text-xl">{editingEquipment?.id ? "Карточка оборудования" : "Новое оборудование"}</DialogTitle>
                        <DialogDescription>
                            {editingEquipment?.name || "Заполните данные для регистрации"}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 bg-slate-50 border-b">
                            <TabsList className="bg-transparent p-0 h-auto space-x-6">
                                <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent">
                                    Основные данные
                                </TabsTrigger>
                                <TabsTrigger value="maintenance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent">
                                    Обслуживание
                                </TabsTrigger>
                                <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent">
                                    История
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-white">
                            <form id="eq-form" onSubmit={handleSave} className="p-6">
                                <TabsContent value="details" className="mt-0 space-y-6">
                                    {/* General Info */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="col-span-2 space-y-2">
                                            <Label>Название <span className="text-rose-500">*</span></Label>
                                            <Input
                                                placeholder="Название модели"
                                                value={editingEquipment?.name || ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, name: e.target.value }))}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Тип</Label>
                                            <Select
                                                value={editingEquipment?.type}
                                                onValueChange={(val) => setEditingEquipment(prev => ({ ...prev, type: val }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Выберите тип" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {types.map(t => (
                                                        <SelectItem key={t.code} value={t.code}>{t.name_ru}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Серийный номер / ID</Label>
                                            <Input
                                                placeholder="SN12345678"
                                                value={editingEquipment?.identifier || ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, identifier: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Бренд</Label>
                                            <Input
                                                placeholder="Напр: ASUS, Logitech"
                                                value={editingEquipment?.brand || ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, brand: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Модель</Label>
                                            <Input
                                                placeholder="Напр: G502 Hero"
                                                value={editingEquipment?.model || ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, model: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Локация (Рабочее место)</Label>
                                            <Select
                                                value={editingEquipment?.workstation_id || "unassigned"}
                                                onValueChange={(val) => setEditingEquipment(prev => ({ ...prev, workstation_id: val === 'unassigned' ? null : val }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Склад" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Склад (Не назначено)</SelectItem>
                                                    {workstations.map(w => (
                                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Статус активности</Label>
                                            <div className="flex items-center space-x-2 p-2 rounded-md border bg-slate-50">
                                                <Switch
                                                    id="active-status"
                                                    checked={editingEquipment?.is_active}
                                                    onCheckedChange={(val) => setEditingEquipment(prev => ({ ...prev, is_active: val }))}
                                                />
                                                <Label htmlFor="active-status" className="font-medium">
                                                    {editingEquipment?.is_active ? "Активно" : "Списано / В архиве"}
                                                </Label>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>Дата покупки</Label>
                                            <Input
                                                type="date"
                                                value={editingEquipment?.purchase_date || ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, purchase_date: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Цена (₽)</Label>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                value={editingEquipment?.price || ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, price: Number(e.target.value) }))}
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <Label>Заметки / Примечания</Label>
                                            <Textarea
                                                placeholder="Любая дополнительная информация..."
                                                className="resize-none"
                                                value={editingEquipment?.notes || ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, notes: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="maintenance" className="mt-0 space-y-6">
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                                        <Info className="h-5 w-5 text-blue-500 shrink-0" />
                                        <div className="text-sm text-blue-700">
                                            <p className="font-semibold">Настройка обслуживания</p>
                                            <ul className="list-disc ml-4 mt-1 opacity-80 space-y-1">
                                                <li>Если <strong>Ответственный не назначен</strong> (в настройках единицы, зоны или места) — задачи на чистку создаваться <strong>не будут</strong>.</li>
                                                <li>Вы можете назначить ответственного прямо здесь, либо он будет взят из настроек места/зоны.</li>
                                                <li>Для создания задач, которые может взять любой сотрудник, назначьте <strong>"Свободный пул"</strong>.</li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 rounded-xl border">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-bold">Обслуживание</Label>
                                                <p className="text-xs text-muted-foreground">Включает напоминания о необходимости чистки</p>
                                            </div>
                                            <Switch
                                                checked={editingEquipment?.maintenance_enabled}
                                                onCheckedChange={(val) => setEditingEquipment(prev => ({ 
                                                    ...prev, 
                                                    maintenance_enabled: val,
                                                    // Если выключаем обслуживание, сбрасываем ответственного
                                                    assigned_user_id: val ? prev?.assigned_user_id : null 
                                                }))}
                                            />
                                        </div>

                                        <div className={cn(
                                            "space-y-4 p-4 rounded-xl border transition-all",
                                            editingEquipment?.maintenance_enabled ? "bg-slate-50 border-slate-200" : "bg-slate-50/50 border-dashed border-slate-200 opacity-60"
                                        )}>
                                            <div className="space-y-2">
                                                <Label>Ответственный за обслуживание</Label>
                                                <Select
                                                    value={editingEquipment?.assigned_user_id || "none"}
                                                    onValueChange={(val) => {
                                                        const userId = val === "none" ? null : val;
                                                        setEditingEquipment(prev => ({ 
                                                            ...prev, 
                                                            assigned_user_id: userId,
                                                            // Если выбран ответственный, автоматически включаем обслуживание
                                                            maintenance_enabled: userId ? true : prev?.maintenance_enabled
                                                        }))
                                                    }}
                                                >
                                                    <SelectTrigger className="bg-white">
                                                        <SelectValue placeholder="Наследовать (из зоны/места)" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Наследовать (из зоны/места)</SelectItem>
                                                        <SelectItem value="00000000-0000-0000-0000-000000000001">🤝 Свободный пул</SelectItem>
                                                        {employees.map(emp => (
                                                            <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-[10px] text-muted-foreground italic">
                                                    Если не назначено прямо здесь, система возьмет ответственного из настроек рабочего места или игровой зоны.
                                                </p>
                                            </div>

                                            {editingEquipment?.maintenance_enabled && (
                                                <div className="space-y-2 pt-2 border-t border-slate-200/50 animate-in fade-in slide-in-from-top-1">
                                                    <Label>Интервал обслуживания (дней)</Label>
                                                    <div className="flex items-center gap-4">
                                                        <Input
                                                            type="number"
                                                            className="w-24 bg-white"
                                                            value={editingEquipment?.cleaning_interval_days || 30}
                                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, cleaning_interval_days: Number(e.target.value) }))}
                                                        />
                                                        <span className="text-sm text-muted-foreground">Рекомендуется: 30 дней для ПК, 14 дней для периферии</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Срок гарантии до</Label>
                                            <Input
                                                type="date"
                                                value={editingEquipment?.warranty_expires || ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, warranty_expires: e.target.value }))}
                                            />
                                        </div>

                                        {editingEquipment?.last_cleaned_at && (
                                            <div className="p-4 rounded-xl border bg-slate-50 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                    <span className="text-sm font-medium">Последнее обслуживание</span>
                                                </div>
                                                <span className="text-sm text-muted-foreground">
                                                    {new Date(editingEquipment.last_cleaned_at).toLocaleDateString("ru-RU")}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="history" className="mt-0">
                                    <div className="space-y-4 p-6">
                                        {isHistoryLoading ? (
                                            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
                                        ) : history.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground text-sm italic">История изменений пуста</div>
                                        ) : (
                                            history.map((log) => (
                                                <div key={log.id} className="flex gap-4 pb-4 border-b last:border-0 last:pb-0 relative">
                                                    <div className="flex flex-col items-center">
                                                        <div className={cn(
                                                            "h-2 w-2 rounded-full mt-2",
                                                            log.action_type === 'MAINTENANCE' ? "bg-green-500" :
                                                            log.action_type === 'MOVE' ? "bg-blue-500" : "bg-rose-500"
                                                        )} />
                                                        <div className="w-px h-full bg-slate-100 mt-1 absolute left-[3.5px] top-4 -z-10" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="text-sm font-bold">{log.action}</p>
                                                                <p className="text-xs text-muted-foreground mt-0.5">{log.details || "Без описания"}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[10px] font-medium text-slate-500">{new Date(log.date).toLocaleDateString("ru-RU")}</p>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">{log.user_name || "Система"}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </TabsContent>
                            </form>
                        </div>

                        <DialogFooter className="p-6 bg-slate-50 border-t">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Отмена</Button>
                            {activeTab !== 'history' && (
                                <Button form="eq-form" type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {editingEquipment?.id ? "Сохранить изменения" : "Добавить в реестр"}
                                </Button>
                            )}
                        </DialogFooter>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
    )
}
