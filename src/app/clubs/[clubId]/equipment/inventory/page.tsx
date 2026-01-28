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
    Move
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
    DropdownMenuTrigger,
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
import { cn } from "@/lib/utils"

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

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingEquipment, setEditingEquipment] = useState<Partial<Equipment> | null>(null)

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

            if (eqRes.ok) setEquipment(eqData.equipment || [])
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

            return matchesSearch && matchesType && matchesWorkstation
        })
    }, [equipment, search, typeFilter, workstationFilter])

    const handleCreate = () => {
        setEditingEquipment({
            type: 'PC',
            name: '',
            is_active: true,
            cleaning_interval_days: 30
        })
        setIsDialogOpen(true)
    }

    const handleEdit = (item: Equipment) => {
        setEditingEquipment(item)
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

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            {/* Breadcrumbs & Header */}
            <div className="flex flex-col gap-4">
                <Link href={`/clubs/${clubId}/equipment`} className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    К обзору
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">📦 Инвентаризация</h1>
                        <p className="text-muted-foreground mt-1">Реестр всех технических средств и периферии клуба</p>
                    </div>
                    <Button onClick={handleCreate} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить позицию
                    </Button>
                </div>
            </div>

            {/* Filters Bar */}
            <Card className="border-none shadow-sm bg-slate-50/50">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Поиск по названию, IMEI, бренду..."
                                className="pl-9 bg-white"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-[180px] bg-white">
                                    <div className="flex items-center gap-2">
                                        <Tag className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="Тип" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все типы</SelectItem>
                                    {types.map(t => (
                                        <SelectItem key={t.code} value={t.code}>{t.name_ru}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={workstationFilter} onValueChange={setWorkstationFilter}>
                                <SelectTrigger className="w-[180px] bg-white">
                                    <div className="flex items-center gap-2">
                                        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="Рабочее место" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все места</SelectItem>
                                    <SelectItem value="unassigned">Свободный пул</SelectItem>
                                    {workstations.map(w => (
                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Content Table */}
            <Card className="border-none shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="w-[300px]">Оборудование</TableHead>
                                <TableHead>ID / Серийник</TableHead>
                                <TableHead>Местоположение</TableHead>
                                <TableHead>Гарантия</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 opacity-50" />
                                        Загрузка данных...
                                    </TableCell>
                                </TableRow>
                            ) : filteredEquipment.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-3 bg-slate-100 rounded-full">
                                                <Search className="h-6 w-6 opacity-20" />
                                            </div>
                                            <p className="font-semibold">Ничего не найдено</p>
                                            <p className="text-xs">Попробуйте изменить параметры фильтрации</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredEquipment.map((item) => (
                                    <TableRow key={item.id} className="group hover:bg-slate-50/50">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-200">
                                                    <Monitor className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm">{item.name}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{item.type_name || item.type}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{item.identifier || "—"}</code>
                                                <p className="text-[10px] text-muted-foreground">{item.brand} {item.model}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {item.workstation_name ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-semibold">{item.workstation_name}</span>
                                                    <span className="text-[10px] text-muted-foreground">{item.workstation_zone}</span>
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] border-dashed">Склад</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.warranty_expires ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[11px] font-medium">
                                                        {new Date(item.warranty_expires).toLocaleDateString("ru-RU")}
                                                    </span>
                                                    {item.warranty_status === 'EXPIRED' && <span className="text-[9px] text-rose-600 font-bold uppercase">Истекла</span>}
                                                    {item.warranty_status === 'EXPIRING_SOON' && <span className="text-[9px] text-amber-600 font-bold uppercase">Скоро истечет</span>}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.is_active ? (
                                                <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 shadow-none border-none">В строю</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 shadow-none border-none">Списано/В ремонте</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-[200px]">
                                                    <DropdownMenuLabel>Действия</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleEdit(item)}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Изменить
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => router.push(`/clubs/${clubId}/equipment/${item.id}`)}>
                                                        <Info className="mr-2 h-4 w-4" /> Информация
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-rose-600" onClick={() => handleDelete(item.id)}>
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

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden max-h-[90vh] flex flex-col">
                    <DialogHeader className="p-6 bg-slate-50 border-b">
                        <DialogTitle>{editingEquipment?.id ? "Редактировать оборудование" : "Добавить оборудование"}</DialogTitle>
                        <DialogDescription>Введите основные данные о технике для постановки на учет.</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSave} className="flex-1 overflow-auto">
                        <div className="p-6 space-y-6">
                            {/* General Info Section */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Tag className="h-3 w-3" /> Основная информация
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 space-y-2">
                                        <Label htmlFor="name">Название оборудования <span className="text-rose-500">*</span></Label>
                                        <Input
                                            id="name"
                                            placeholder="например, ПК-01 или Мышь Logitech G Pro"
                                            value={editingEquipment?.name || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, name: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="type">Тип <span className="text-rose-500">*</span></Label>
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
                                        <Label htmlFor="workstation">Рабочее место</Label>
                                        <Select
                                            value={editingEquipment?.workstation_id || "none"}
                                            onValueChange={(val) => setEditingEquipment(prev => ({ ...prev, workstation_id: val === "none" ? null : val }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Не назначено" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Свободный пул</SelectItem>
                                                {workstations.map(w => (
                                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Identification & Marketing Section */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Search className="h-3 w-3" /> Идентификация
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="identifier">IMEI / SN / Инвентарный №</Label>
                                        <Input
                                            id="identifier"
                                            placeholder="XXXX-XXXX-XXXX"
                                            value={editingEquipment?.identifier || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, identifier: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="brand">Бренд</Label>
                                        <Input
                                            id="brand"
                                            placeholder="Logitech, LG, и т.д."
                                            value={editingEquipment?.brand || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, brand: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <Label htmlFor="model">Модель</Label>
                                        <Input
                                            id="model"
                                            placeholder="G Pro X Superlight"
                                            value={editingEquipment?.model || ""}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, model: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Warranty & Maintenance Section */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Clock className="h-3 w-3" /> Гарантия и регламент
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="warranty">Дата окончания гарантии</Label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="warranty"
                                                type="date"
                                                className="pl-9"
                                                value={editingEquipment?.warranty_expires ? editingEquipment.warranty_expires.split('T')[0] : ""}
                                                onChange={(e) => setEditingEquipment(prev => ({ ...prev, warranty_expires: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="interval">Чистка (раз в N дней)</Label>
                                        <Input
                                            id="interval"
                                            type="number"
                                            min="1"
                                            value={editingEquipment?.cleaning_interval_days || 30}
                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, cleaning_interval_days: parseInt(e.target.value) }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label htmlFor="notes">Заметки</Label>
                                <textarea
                                    id="notes"
                                    className="w-full min-h-[80px] rounded-lg border bg-white p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="Дополнительная информация, комплектация и т.д."
                                    value={editingEquipment?.notes || ""}
                                    onChange={(e) => setEditingEquipment(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                        </div>

                        <DialogFooter className="p-6 bg-slate-50 border-t sticky bottom-0 z-10">
                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                            <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 min-w-[120px]" disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {editingEquipment?.id ? "Сохранить изменения" : "Добавить в базу"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
