"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import {
    LayoutGrid,
    Plus,
    ChevronLeft,
    MoreVertical,
    Pencil,
    Trash2,
    Loader2,
    MapPin,
    Monitor,
    Layers,
    Save,
    X,
    FolderPlus,
    MousePointer2,
    Headphones,
    Keyboard,
    Wrench,
    Search
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import Link from "next/link"

// --- Types ---

interface Workstation {
    id: string
    name: string
    zone: string
    equipment_count?: number
}

interface Equipment {
    id: string
    name: string
    type: string
    type_name: string
    type_icon: string
    brand: string | null
    model: string | null
    workstation_id: string | null
    is_active: boolean
}

interface EquipmentType {
    code: string
    name_ru: string
    icon: string
}

export default function WorkplacesManager() {
    const { clubId } = useParams()
    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isNewZoneDialogOpen, setIsNewZoneDialogOpen] = useState(false)
    const [newZoneName, setNewZoneName] = useState("")
    const [editingWorkplace, setEditingWorkplace] = useState<Partial<Workstation> | null>(null)
    
    // Equipment Assignment Dialog
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
    const [selectedWorkstationId, setSelectedWorkstationId] = useState<string | null>(null)
    const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>("all")
    const [searchEquipment, setSearchEquipment] = useState("")

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [wsRes, eqRes, typesRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/workstations`),
                fetch(`/api/clubs/${clubId}/equipment`),
                fetch(`/api/equipment-types`)
            ])

            const wsData = await wsRes.json()
            const eqData = await eqRes.json()
            const typesData = await typesRes.json()

            if (wsRes.ok && eqRes.ok) {
                const allEquipment = eqData.equipment || []
                setEquipment(allEquipment)
                
                const enhancedWs = wsData.map((ws: Workstation) => ({
                    ...ws,
                    equipment_count: allEquipment.filter((e: any) => e.workstation_id === ws.id).length
                }))
                setWorkstations(enhancedWs)
            }
            if (typesRes.ok) {
                setEquipmentTypes(typesData)
            }
        } catch (error) {
            console.error("Error fetching workplaces:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const zones = useMemo(() => {
        const z = new Set(workstations.map(w => w.zone))
        return Array.from(z).sort()
    }, [workstations])

    // --- Actions ---

    const handleCreate = () => {
        setEditingWorkplace({
            name: '',
            zone: zones[0] || 'General'
        })
        setIsDialogOpen(true)
    }

    const handleEdit = (ws: Workstation) => {
        setEditingWorkplace(ws)
        setIsDialogOpen(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingWorkplace?.name || !editingWorkplace?.zone) return

        setIsSaving(true)
        try {
            const isNew = !editingWorkplace.id
            const url = isNew
                ? `/api/clubs/${clubId}/workstations`
                : `/api/clubs/${clubId}/workstations/${editingWorkplace.id}`

            const res = await fetch(url, {
                method: isNew ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingWorkplace)
            })

            if (res.ok) {
                setIsDialogOpen(false)
                fetchData()
            }
        } catch (error) {
            console.error("Error saving workplace:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        const ws = workstations.find(w => w.id === id)
        if (ws && ws.equipment_count && ws.equipment_count > 0) {
            alert("Нельзя удалить рабочее место, к которому привязано оборудование. Сначала переместите оборудование на склад.")
            return
        }

        if (!confirm("Вы уверены, что хотите удалить это рабочее место?")) return

        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations/${id}`, {
                method: "DELETE"
            })
            if (res.ok) fetchData()
        } catch (error) {
            console.error("Error deleting workplace:", error)
        }
    }

    // --- Equipment Assignment Logic ---

    const handleOpenAssignDialog = (wsId: string) => {
        setSelectedWorkstationId(wsId)
        setIsAssignDialogOpen(true)
    }

    const handleAssignEquipment = async (equipmentId: string) => {
        if (!selectedWorkstationId) return
        
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workstation_id: selectedWorkstationId })
            })
            if (res.ok) {
                fetchData() // Refresh to show updated assignment
            }
        } catch (error) {
            console.error("Error assigning equipment:", error)
        }
    }

    const handleUnassignEquipment = async (equipmentId: string) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workstation_id: null }) // Set to null (Storage)
            })
            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            console.error("Error unassigning equipment:", error)
        }
    }

    // Filter available equipment for assignment (items on storage or unassigned)
    const availableEquipment = useMemo(() => {
        return equipment.filter(item => 
            !item.workstation_id && // Only unassigned items
            item.is_active && // Only active items
            (selectedEquipmentType === "all" || item.type === selectedEquipmentType) &&
            (item.name.toLowerCase().includes(searchEquipment.toLowerCase()) || 
             item.brand?.toLowerCase().includes(searchEquipment.toLowerCase()))
        )
    }, [equipment, selectedEquipmentType, searchEquipment])

    // Helper to get icon for equipment type
    const getEquipmentIcon = (type: string) => {
        switch(type) {
            case 'PC': return <Monitor className="h-4 w-4" />
            case 'MOUSE': return <MousePointer2 className="h-4 w-4" />
            case 'KEYBOARD': return <Keyboard className="h-4 w-4" />
            case 'HEADSET': return <Headphones className="h-4 w-4" />
            default: return <Wrench className="h-4 w-4" />
        }
    }

    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href={`/clubs/${clubId}/equipment`} className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <div className="p-2 rounded-full hover:bg-slate-100">
                        <ChevronLeft className="h-5 w-5" />
                    </div>
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">🗺 Управление местами</h1>
                        <p className="text-muted-foreground mt-1">Визуальная схема рабочих мест и подключенного оборудования</p>
                    </div>
                    <Button onClick={handleCreate} className="bg-primary shadow-md hover:bg-primary/90">
                        <Plus className="mr-2 h-4 w-4" />
                        Создать место
                    </Button>
                </div>
            </div>

            {/* Zones Grid */}
            <div className="space-y-12">
                {zones.length === 0 && !isLoading ? (
                    <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                        <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <MapPin className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold">Зоны не созданы</h3>
                        <p className="text-sm text-muted-foreground mb-6">Создайте первое рабочее место, чтобы организовать пространство клуба</p>
                        <Button onClick={handleCreate} variant="outline">Создать первое место</Button>
                    </div>
                ) : (
                    zones.map(zone => (
                        <section key={zone} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between px-2 sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b">
                                <h2 className="text-lg font-black uppercase tracking-widest text-slate-500 flex items-center gap-3">
                                    <Layers className="h-5 w-5 text-primary" />
                                    {zone}
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none px-2">{workstations.filter(w => w.zone === zone).length}</Badge>
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {workstations.filter(w => w.zone === zone).map(ws => {
                                    const wsEquipment = equipment.filter(e => e.workstation_id === ws.id)
                                    
                                    return (
                                        <Card key={ws.id} className="group hover:border-primary/50 transition-all border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 bg-slate-50/50 border-b border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 bg-white rounded-xl border flex items-center justify-center text-slate-400 font-bold shadow-sm">
                                                        {ws.name.replace(/[^0-9]/g, '') || <Monitor className="h-5 w-5" />}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 leading-tight">{ws.name}</h4>
                                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{wsEquipment.length} устройств</p>
                                                    </div>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Действия</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEdit(ws)}>
                                                            <Pencil className="mr-2 h-4 w-4" /> Изменить название
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-rose-600" onClick={() => handleDelete(ws.id)}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Удалить место
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </CardHeader>
                                            
                                            <CardContent className="p-4 flex-1 bg-white">
                                                {wsEquipment.length === 0 ? (
                                                    <div className="h-full min-h-[100px] flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-100 rounded-lg p-4">
                                                        <Monitor className="h-8 w-8 text-slate-200 mb-2" />
                                                        <p className="text-xs text-muted-foreground font-medium">Оборудование не назначено</p>
                                                        <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1 text-primary" onClick={() => handleOpenAssignDialog(ws.id)}>
                                                            Назначить сейчас
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {wsEquipment.map(item => (
                                                            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 group/item hover:border-primary/20 hover:bg-primary/5 transition-colors">
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className="h-8 w-8 rounded-md bg-white border flex items-center justify-center text-slate-500 shrink-0">
                                                                        {getEquipmentIcon(item.type)}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-semibold truncate text-slate-700 group-hover/item:text-primary">{item.name}</p>
                                                                        <p className="text-[10px] text-muted-foreground truncate">{item.brand} {item.model}</p>
                                                                    </div>
                                                                </div>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-6 w-6 opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                                                    title="Убрать с места (на склад)"
                                                                    onClick={() => handleUnassignEquipment(item.id)}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                            
                                            <CardFooter className="p-3 bg-slate-50 border-t border-slate-100">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="w-full text-xs h-8 bg-white hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-sm"
                                                    onClick={() => handleOpenAssignDialog(ws.id)}
                                                >
                                                    <Plus className="h-3 w-3 mr-1.5" /> Добавить оборудование
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    )
                                })}
                                
                                {/* Add New Workstation Button (Card Style) */}
                                <button
                                    onClick={handleCreate}
                                    className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all group min-h-[250px]"
                                >
                                    <div className="h-12 w-12 rounded-full bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                                        <Plus className="h-6 w-6" />
                                    </div>
                                    <span className="text-sm font-bold uppercase tracking-widest">Новое место в {zone}</span>
                                </button>
                            </div>
                        </section>
                    ))
                )}
            </div>

            {/* Workplace Edit/Create Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingWorkplace?.id ? "Редактировать место" : "Новое рабочее место"}</DialogTitle>
                        <DialogDescription>
                            Укажите название (например, PC-01) и зону (Vip, Standard, Boot-camp).
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="ws-name">Название места</Label>
                            <Input
                                id="ws-name"
                                placeholder="PC-01"
                                value={editingWorkplace?.name || ""}
                                onChange={(e) => setEditingWorkplace(prev => ({ ...prev, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ws-zone">Игровая зона</Label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Select
                                        value={editingWorkplace?.zone}
                                        onValueChange={(val) => setEditingWorkplace(prev => ({ ...prev, zone: val }))}
                                    >
                                        <SelectTrigger id="ws-zone">
                                            <SelectValue placeholder="Выберите зону" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {zones.length > 0 ? zones.map(z => (
                                                <SelectItem key={z} value={z}>{z}</SelectItem>
                                            )) : (
                                                <SelectItem value="General">General</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Dialog open={isNewZoneDialogOpen} onOpenChange={setIsNewZoneDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="outline" size="icon" title="Новая зона">
                                            <FolderPlus className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Добавить новую зону</DialogTitle>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <Input
                                                id="new-zone"
                                                placeholder="Название зоны (например, PS5 Zone)"
                                                value={newZoneName}
                                                onChange={(e) => setNewZoneName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (newZoneName) {
                                                            setEditingWorkplace(prev => ({ ...prev, zone: newZoneName }));
                                                            setIsNewZoneDialogOpen(false);
                                                            setNewZoneName("");
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button type="button" variant="ghost" onClick={() => setIsNewZoneDialogOpen(false)}>Отмена</Button>
                                            <Button type="button" className="bg-primary text-primary-foreground" onClick={() => {
                                                if (newZoneName) {
                                                    setEditingWorkplace(prev => ({ ...prev, zone: newZoneName }));
                                                    setIsNewZoneDialogOpen(false);
                                                    setNewZoneName("");
                                                }
                                            }}>Сохранить</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground">
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Сохранить
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Equipment Assignment Dialog */}
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0">
                    <DialogHeader className="p-6 border-b bg-slate-50">
                        <DialogTitle>Назначить оборудование</DialogTitle>
                        <DialogDescription>
                            Выберите устройство со склада для привязки к рабочему месту.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-4 border-b bg-white space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <Input 
                                    placeholder="Поиск по названию или бренду..." 
                                    value={searchEquipment}
                                    onChange={(e) => setSearchEquipment(e.target.value)}
                                />
                            </div>
                            <Select value={selectedEquipmentType} onValueChange={setSelectedEquipmentType}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Тип" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все типы</SelectItem>
                                    {equipmentTypes.map(t => (
                                        <SelectItem key={t.code} value={t.code}>{t.name_ru}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                        {availableEquipment.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                <Search className="h-10 w-10 mb-2 opacity-20" />
                                <p>Подходящее оборудование не найдено на складе.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {availableEquipment.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm hover:border-primary/50 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                                                {getEquipmentIcon(item.type)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm">{item.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px] h-5 px-1">{item.type_name || item.type}</Badge>
                                                    <span className="text-xs text-muted-foreground">{item.brand} {item.model}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button size="sm" onClick={() => {
                                            handleAssignEquipment(item.id)
                                            // Don't close dialog to allow assigning multiple items
                                        }}>
                                            <Plus className="h-4 w-4 mr-1" /> Добавить
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <DialogFooter className="p-4 border-t bg-white">
                        <Button onClick={() => setIsAssignDialogOpen(false)}>Готово</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
