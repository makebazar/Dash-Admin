"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
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
    Box
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
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

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

// --- Mock History Data (Prototype) ---
const MOCK_HISTORY = [
    { id: 1, date: '2023-10-15', action: 'Покупка', user: 'Admin', details: 'Поставлено на учет' },
    { id: 2, date: '2023-11-01', action: 'Перемещение', user: 'Tech', details: 'Назначено на PC-01' },
    { id: 3, date: '2024-01-10', action: 'Обслуживание', user: 'Cleaner', details: 'Плановая чистка от пыли' },
]

export default function EquipmentInventory() {
    const { clubId } = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [types, setTypes] = useState<EquipmentType[]>([])
    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Filters
    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState("all")
    const [workstationFilter, setWorkstationFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingEquipment, setEditingEquipment] = useState<Partial<Equipment> | null>(null)
    const [activeTab, setActiveTab] = useState("details")

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [eqRes, typeRes, wsRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/equipment?include_inactive=true`),
                fetch(`/api/equipment-types`),
                fetch(`/api/clubs/${clubId}/workstations`)
            ])

            const eqData = await eqRes.json()
            const typeData = await typeRes.json()
            const wsData = await wsRes.json()

            if (eqRes.ok) {
                // Enrich data with status logic for prototype
                const enriched = (eqData.equipment || []).map((e: any) => ({
                    ...e,
                    status: e.is_active ? 'ACTIVE' : 'WRITTEN_OFF' // Simplified mapping
                }))
                setEquipment(enriched)
            }
            if (typeRes.ok) setTypes(typeData || [])
            if (wsRes.ok) setWorkstations(wsData || [])

        } catch (error) {
            console.error("Error fetching inventory data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            handleCreate()
        }
    }, [searchParams])

    const filteredEquipment = useMemo(() => {
        return equipment.filter(item => {
            const matchesSearch =
                item.name.toLowerCase().includes(search.toLowerCase()) ||
                (item.identifier?.toLowerCase().includes(search.toLowerCase())) ||
                (item.brand?.toLowerCase().includes(search.toLowerCase())) ||
                (item.model?.toLowerCase().includes(search.toLowerCase()))

            const matchesType = typeFilter === "all" || item.type === typeFilter
            const matchesWorkstation =
                workstationFilter === "all" ||
                (workstationFilter === "unassigned" ? !item.workstation_id : item.workstation_id === workstationFilter)
            
            const matchesStatus = statusFilter === "all" 
                ? true 
                : statusFilter === 'active' ? item.is_active 
                : !item.is_active

            return matchesSearch && matchesType && matchesWorkstation && matchesStatus
        })
    }, [equipment, search, typeFilter, workstationFilter, statusFilter])

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

    // --- Render Helpers ---

    const getStatusBadge = (item: Equipment) => {
        if (!item.is_active) return <Badge variant="secondary" className="bg-slate-100 text-slate-500">Списано</Badge>
        if (item.workstation_id) return <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 shadow-none border-none">Активно</Badge>
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">На складе</Badge>
    }

    // --- Stats Calculation ---
    const stats = useMemo(() => {
        const total = equipment.length
        const active = equipment.filter(e => e.is_active).length
        const repair = 0 // Mock
        const value = equipment.length * 15000 // Mock avg value
        return { total, active, repair, value }
    }, [equipment])

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
                        <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" /> Экспорт
                        </Button>
                        <Button onClick={handleCreate} className="bg-primary text-primary-foreground shadow-md hover:bg-primary/90">
                            <Plus className="mr-2 h-4 w-4" />
                            Новая позиция
                        </Button>
                    </div>
                </div>
            </div>

            {/* Dashboard Stats (New) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Всего единиц</p>
                            <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
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
                            <h3 className="text-2xl font-bold mt-1 text-green-600">{stats.active}</h3>
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
                            <h3 className="text-2xl font-bold mt-1 text-orange-600">{stats.repair}</h3>
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
                            <h3 className="text-2xl font-bold mt-1">≈ {stats.value.toLocaleString()} ₽</h3>
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
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
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

                        <Select value={workstationFilter} onValueChange={setWorkstationFilter}>
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

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Статус" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Любой статус</SelectItem>
                                <SelectItem value="active">Активно</SelectItem>
                                <SelectItem value="inactive">Списано / Архив</SelectItem>
                            </SelectContent>
                        </Select>
                        
                        <Button variant="ghost" size="icon" onClick={() => {
                            setSearch("")
                            setTypeFilter("all")
                            setWorkstationFilter("all")
                            setStatusFilter("all")
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
                        <Button size="sm" variant="ghost" className="hover:bg-blue-100 hover:text-blue-800">
                            <Wrench className="h-3.5 w-3.5 mr-2" /> Отправить в ремонт
                        </Button>
                        <Button size="sm" variant="ghost" className="hover:bg-blue-100 hover:text-blue-800">
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
                                            // Prevent row click if clicking checkbox or button
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
                                                    <Monitor className="h-5 w-5" />
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
                                        <TableCell className="text-right">
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
                                                    <DropdownMenuItem onClick={() => {}}>
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
            </Card>

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
                                            <Label>Статус</Label>
                                            <Select
                                                value={editingEquipment?.is_active ? 'active' : 'inactive'}
                                                onValueChange={(val) => setEditingEquipment(prev => ({ ...prev, is_active: val === 'active' }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2 w-2 rounded-full bg-green-500" /> Активно
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="inactive">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2 w-2 rounded-full bg-slate-400" /> Списано / Архив
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Бренд</Label>
                                            <Input
                                                value={editingEquipment?.brand || ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, brand: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Модель</Label>
                                            <Input
                                                value={editingEquipment?.model || ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, model: e.target.value }))}
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <Label>Идентификатор (S/N)</Label>
                                            <Input
                                                className="font-mono bg-slate-50"
                                                value={editingEquipment?.identifier || ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, identifier: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    
                                    <Separator />
                                    
                                    <div className="space-y-2">
                                        <Label>Локация</Label>
                                        <Select
                                            value={editingEquipment?.workstation_id || "none"}
                                            onValueChange={(val) => setEditingEquipment(prev => ({ ...prev, workstation_id: val === "none" ? null : val }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Не назначено (Склад)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">📦 Склад</SelectItem>
                                                {workstations.map(w => (
                                                    <SelectItem key={w.id} value={w.id}>🖥 {w.name} ({w.zone})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Заметки</Label>
                                        <Textarea
                                            value={editingEquipment?.notes || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, notes: e.target.value }))}
                                            className="min-h-[100px]"
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="maintenance" className="mt-0 space-y-6">
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                                        <div>
                                            <h4 className="font-medium text-amber-900">Регламент обслуживания</h4>
                                            <p className="text-sm text-amber-700 mt-1">Настройте периодичность чистки и проверок для автоматического создания задач персоналу.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>Интервал чистки (дней)</Label>
                                            <Input
                                                type="number"
                                                value={editingEquipment?.cleaning_interval_days || 30}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, cleaning_interval_days: parseInt(e.target.value) }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Окончание гарантии</Label>
                                            <Input
                                                type="date"
                                                value={editingEquipment?.warranty_expires ? editingEquipment.warranty_expires.split('T')[0] : ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, warranty_expires: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Последняя чистка</Label>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-slate-50 p-3 rounded-md border">
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            {editingEquipment?.last_cleaned_at 
                                                ? new Date(editingEquipment.last_cleaned_at).toLocaleDateString() 
                                                : "Данных нет"}
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="history" className="mt-0">
                                    <div className="space-y-4">
                                        {MOCK_HISTORY.map((log) => (
                                            <div key={log.id} className="flex gap-4 pb-4 border-b last:border-0 last:pb-0 relative">
                                                <div className="flex flex-col items-center">
                                                    <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                                                    <div className="w-px h-full bg-slate-200 mt-1 absolute left-[3.5px] top-4 -z-10" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <p className="font-medium text-sm">{log.action}</p>
                                                        <span className="text-xs text-muted-foreground">{log.date}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 mt-0.5">{log.details}</p>
                                                    <p className="text-xs text-slate-400 mt-1">Автор: {log.user}</p>
                                                </div>
                                            </div>
                                        ))}
                                        <Button variant="ghost" className="w-full text-xs text-muted-foreground">
                                            Загрузить еще...
                                        </Button>
                                    </div>
                                </TabsContent>
                            </form>
                        </div>
                    </Tabs>

                    <DialogFooter className="p-4 border-t bg-white">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                        <Button form="eq-form" type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Сохранить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
