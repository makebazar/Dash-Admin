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
    Search,
    Gamepad2,
    Gamepad,
    Tv,
    Glasses,
    Square,
    User,
    Sofa
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

import { ManageZonesDialog } from "./ManageZonesDialog"

// --- Types ---

interface Workstation {
    id: string
    name: string
    zone: string
    assigned_user_id?: string | null
    assigned_user_name?: string | null
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
    maintenance_enabled: boolean
    cleaning_interval_days?: number
    last_cleaned_at?: string | null
    thermal_paste_last_changed_at?: string | null
    thermal_paste_interval_days?: number | null
    thermal_paste_type?: string | null
    thermal_paste_note?: string | null
}

interface EquipmentType {
    code: string
    name_ru: string
    icon: string
}

interface Employee {
    id: string
    full_name: string
}

export default function WorkplacesPage() {
    const { clubId } = useParams()
    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [zoneList, setZoneList] = useState<any[]>([])
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

    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [detailsWorkstationId, setDetailsWorkstationId] = useState<string | null>(null)
    const [intervalDrafts, setIntervalDrafts] = useState<Record<string, string>>({})
    const [lastCleanedDrafts, setLastCleanedDrafts] = useState<Record<string, string>>({})
    const [savingIntervalId, setSavingIntervalId] = useState<string | null>(null)
    const [thermalPasteDateDrafts, setThermalPasteDateDrafts] = useState<Record<string, string>>({})
    const [thermalPasteIntervalDrafts, setThermalPasteIntervalDrafts] = useState<Record<string, string>>({})
    const [thermalPasteTypeDrafts, setThermalPasteTypeDrafts] = useState<Record<string, string>>({})
    const [thermalPasteNoteDrafts, setThermalPasteNoteDrafts] = useState<Record<string, string>>({})
    const [savingThermalId, setSavingThermalId] = useState<string | null>(null)
    const [isAssigningWorkstationId, setIsAssigningWorkstationId] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [wsRes, eqRes, typesRes, empRes, zonesRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/workstations`),
                fetch(`/api/clubs/${clubId}/equipment?limit=1000`),
                fetch(`/api/equipment-types`),
                fetch(`/api/clubs/${clubId}/employees`),
                fetch(`/api/clubs/${clubId}/zones`)
            ])

            const wsData = await wsRes.json()
            const eqData = await eqRes.json()
            const typesData = await typesRes.json()
            const empData = await empRes.json()

            if (zonesRes.ok) {
                const zonesData = await zonesRes.json()
                setZoneList(zonesData)
            }

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
            if (empRes.ok) {
                setEmployees(empData.employees || [])
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
        const fromList = zoneList.map(z => z.name)
        const fromWorkstations = workstations.map(w => w.zone)
        return Array.from(new Set([...fromList, ...fromWorkstations])).sort()
    }, [zoneList, workstations])

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

    const handleToggleMaintenance = async (equipmentId: string, enabled: boolean) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ maintenance_enabled: enabled })
            })
            if (res.ok) {
                fetchData() // Refresh
            }
        } catch (error) {
            console.error("Error toggling maintenance:", error)
        }
    }

    const handleOpenDetails = (wsId: string) => {
        setDetailsWorkstationId(wsId)
        const drafts: Record<string, string> = {}
        const cleanedDrafts: Record<string, string> = {}
        const dateDrafts: Record<string, string> = {}
        const intervalDraftsMap: Record<string, string> = {}
        const typeDrafts: Record<string, string> = {}
        const noteDrafts: Record<string, string> = {}

        equipment
            .filter(item => item.workstation_id === wsId)
            .forEach(item => {
                drafts[item.id] = String(item.cleaning_interval_days ?? 30)
                
                let cleanedValue = ""
                if (item.last_cleaned_at) {
                    const d = new Date(item.last_cleaned_at)
                    cleanedValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                }
                cleanedDrafts[item.id] = cleanedValue

                let dateValue = ""
                if (item.thermal_paste_last_changed_at) {
                    const d = new Date(item.thermal_paste_last_changed_at)
                    dateValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                }
                dateDrafts[item.id] = dateValue
                intervalDraftsMap[item.id] = String(item.thermal_paste_interval_days ?? 365)
                typeDrafts[item.id] = item.thermal_paste_type ?? ""
                noteDrafts[item.id] = item.thermal_paste_note ?? ""
            })
        setIntervalDrafts(drafts)
        setLastCleanedDrafts(cleanedDrafts)
        setThermalPasteDateDrafts(dateDrafts)
        setThermalPasteIntervalDrafts(intervalDraftsMap)
        setThermalPasteTypeDrafts(typeDrafts)
        setThermalPasteNoteDrafts(noteDrafts)
        setIsDetailsOpen(true)
    }

    const handleIntervalChange = (equipmentId: string, value: string) => {
        setIntervalDrafts(prev => ({ ...prev, [equipmentId]: value }))
    }

    const handleLastCleanedChange = (equipmentId: string, value: string) => {
        setLastCleanedDrafts(prev => ({ ...prev, [equipmentId]: value }))
    }

    const handleSaveInterval = async (equipmentId: string) => {
        const raw = intervalDrafts[equipmentId]
        const value = parseInt(raw, 10)
        if (!value || value < 1) return

        setSavingIntervalId(equipmentId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    cleaning_interval_days: value,
                    last_cleaned_at: lastCleanedDrafts[equipmentId] || null
                })
            })
            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            console.error("Error updating interval:", error)
        } finally {
            setSavingIntervalId(null)
        }
    }

    const handleThermalSave = async (equipmentId: string) => {
        const intervalRaw = thermalPasteIntervalDrafts[equipmentId]
        const intervalValue = intervalRaw ? parseInt(intervalRaw, 10) : null
        if (intervalValue !== null && intervalValue < 1) return

        setSavingThermalId(equipmentId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    thermal_paste_last_changed_at: thermalPasteDateDrafts[equipmentId] || null,
                    thermal_paste_interval_days: intervalValue,
                    thermal_paste_type: thermalPasteTypeDrafts[equipmentId] || null,
                    thermal_paste_note: thermalPasteNoteDrafts[equipmentId] || null
                })
            })
            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            console.error("Error updating thermal paste:", error)
        } finally {
            setSavingThermalId(null)
        }
    }

    const handleAssignWorkstation = async (userId: string | null) => {
        if (!detailsWorkstationId) return

        setIsAssigningWorkstationId(detailsWorkstationId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations/${detailsWorkstationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigned_user_id: userId })
            })
            
            if (res.ok && userId) {
                // Если назначен ответственный (пользователь или свободный пул), 
                // автоматически включаем обслуживание для всего оборудования на этом месте
                await Promise.all(activeEquipment.map(item => 
                    fetch(`/api/clubs/${clubId}/equipment/${item.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ maintenance_enabled: true })
                    })
                ))
            }

            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            console.error("Error assigning workstation:", error)
        } finally {
            setIsAssigningWorkstationId(null)
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

    const activeWorkstation = useMemo(() => {
        return workstations.find(w => w.id === detailsWorkstationId) || null
    }, [workstations, detailsWorkstationId])

    const activeEquipment = useMemo(() => {
        return equipment.filter(item => item.workstation_id === detailsWorkstationId)
    }, [equipment, detailsWorkstationId])

    const primaryEquipment = useMemo(() => {
        const priority = ["PC", "CONSOLE", "TV"]
        for (const type of priority) {
            const found = activeEquipment.find(item => item.type === type)
            if (found) return found
        }
        return activeEquipment[0] || null
    }, [activeEquipment])

    const primaryLabel = useMemo(() => {
        if (!primaryEquipment) return "Основное устройство"
        if (primaryEquipment.type === "CONSOLE") return "Основная консоль"
        if (primaryEquipment.type === "TV") return "Основной дисплей"
        return "Основной ПК"
    }, [primaryEquipment])

    const primaryDescription = useMemo(() => {
        if (!primaryEquipment) return "Регулярность чистки"
        if (primaryEquipment.type === "CONSOLE") return "Регулярность чистки консоли"
        if (primaryEquipment.type === "TV") return "Регулярность чистки дисплея"
        return "Регулярность чистки рабочего места"
    }, [primaryEquipment])

    const thermalEligible = useMemo(() => {
        return primaryEquipment ? ["PC", "CONSOLE"].includes(primaryEquipment.type) : false
    }, [primaryEquipment])

    const peripheralEquipment = useMemo(() => {
        if (!primaryEquipment) return activeEquipment
        return activeEquipment.filter(item => item.id !== primaryEquipment.id)
    }, [activeEquipment, primaryEquipment])

    // Helper to get icon for equipment type
    const getEquipmentIcon = (type: string) => {
        switch(type) {
            case 'PC': return <Monitor className="h-4 w-4" />
            case 'MOUSE': return <MousePointer2 className="h-4 w-4" />
            case 'KEYBOARD': return <Keyboard className="h-4 w-4" />
            case 'HEADSET': return <Headphones className="h-4 w-4" />
            case 'CONSOLE': return <Gamepad2 className="h-4 w-4" />
            case 'GAMEPAD': return <Gamepad className="h-4 w-4" />
            case 'TV': return <Tv className="h-4 w-4" />
            case 'VR_HEADSET': return <Glasses className="h-4 w-4" />
            case 'MOUSEPAD': return <Square className="h-4 w-4" />
            case 'CHAIR': return <Sofa className="h-4 w-4" />
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
                    <div className="flex gap-2">
                        <ManageZonesDialog
                            clubId={clubId as string}
                            zones={zoneList}
                            employees={employees}
                            onZonesChange={fetchData}
                        />
                        <Button onClick={handleCreate} className="bg-primary shadow-md hover:bg-primary/90">
                            <Plus className="mr-2 h-4 w-4" />
                            Создать место
                        </Button>
                    </div>
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
                            <div className="group flex items-center justify-between px-2 sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b">
                                <h2 className="text-lg font-black uppercase tracking-widest text-slate-500 flex items-center gap-3">
                                    <Layers className="h-5 w-5 text-primary" />
                                    {zone}
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none px-2">{workstations.filter(w => w.zone === zone).length}</Badge>
                                    {(() => {
                                        const zoneInfo = zoneList.find(z => z.name === zone)
                                        if (zoneInfo?.assigned_user_name) {
                                            return (
                                                <Badge variant="outline" className="ml-2 text-xs font-normal bg-green-50 text-green-700 border-green-200 gap-1 flex items-center">
                                                    <User className="h-3 w-3" />
                                                    {zoneInfo.assigned_user_name}
                                                </Badge>
                                            )
                                        }
                                        return null
                                    })()}
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {workstations.filter(w => w.zone === zone).map(ws => {
                                    const wsEquipment = equipment.filter(e => e.workstation_id === ws.id)
                                    
                                    return (
                                        <Card key={ws.id} className="group hover:border-primary/50 transition-all border-slate-200 shadow-sm overflow-hidden flex flex-col h-full cursor-pointer" onClick={() => handleOpenDetails(ws.id)}>
                                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 bg-slate-50/50 border-b border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 bg-white rounded-xl border flex items-center justify-center text-slate-400 font-bold shadow-sm">
                                                        {ws.name.replace(/[^0-9]/g, '') || <Monitor className="h-5 w-5" />}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 leading-tight">{ws.name}</h4>
                                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{wsEquipment.length} устройств</p>
                                                            <div className="flex items-center gap-1.5" title={ws.assigned_user_name || "Не назначено"}>
                                                                <User className={cn("h-3 w-3", ws.assigned_user_name ? "text-primary" : "text-slate-400")} />
                                                                <span className={cn("text-[10px] font-medium truncate max-w-[100px]", ws.assigned_user_name || ws.assigned_user_id === '00000000-0000-0000-0000-000000000001' ? "text-primary" : "text-slate-400")}>
                                                                    {ws.assigned_user_id === '00000000-0000-0000-0000-000000000001' ? "🤝 Свободный пул" : (ws.assigned_user_name || "Не назначено")}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={(e) => e.stopPropagation()}>
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
                                                        <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1 text-primary" onClick={(e) => { e.stopPropagation(); handleOpenAssignDialog(ws.id) }}>
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
                                                                    onClick={(e) => { e.stopPropagation(); handleUnassignEquipment(item.id) }}
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
                                                    onClick={(e) => { e.stopPropagation(); handleOpenAssignDialog(ws.id) }}
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

            <Dialog
                open={isDetailsOpen}
                onOpenChange={(open) => {
                    setIsDetailsOpen(open)
                    if (!open) setDetailsWorkstationId(null)
                }}
            >
                <DialogContent className="sm:max-w-[900px]">
                    <DialogHeader>
                        <DialogTitle>{activeWorkstation ? `Место ${activeWorkstation.name}` : "Место"}</DialogTitle>
                        <DialogDescription>
                            {activeWorkstation ? `${activeWorkstation.zone} • ${activeEquipment.length} устройств` : ""}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <Label className="text-xs text-muted-foreground">Ответственный</Label>
                        <Select
                            value={activeWorkstation?.assigned_user_id || "none"}
                            onValueChange={(val) => handleAssignWorkstation(val === "none" ? null : val)}
                            disabled={isAssigningWorkstationId === detailsWorkstationId}
                        >
                            <SelectTrigger className="w-full sm:w-[260px]">
                                <SelectValue placeholder="Не назначено" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">⛔ Не требует обслуживания</SelectItem>
                                <SelectItem value="00000000-0000-0000-0000-000000000001">🤝 Свободный пул</SelectItem>
                                {employees.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                        <div className="space-y-4">
                            <Card className="border-slate-200">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">{primaryLabel}</CardTitle>
                                    <CardDescription>{primaryDescription}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {!primaryEquipment ? (
                                        <div className="text-sm text-muted-foreground">Основное устройство не назначено</div>
                                    ) : (
                                        <div className="flex flex-col gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                                            <div className="flex items-center gap-3 w-full">
                                                <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center text-slate-500 shrink-0 shadow-sm">
                                                    {getEquipmentIcon(primaryEquipment.type)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold truncate">{primaryEquipment.name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[10px] h-5 px-1 bg-white text-slate-500 border-slate-200 font-normal">{primaryEquipment.type_name || primaryEquipment.type}</Badge>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Label htmlFor={`maintenance-${primaryEquipment.id}`} className="text-xs text-muted-foreground cursor-pointer">Обслуживание</Label>
                                                    <input
                                                        type="checkbox"
                                                        id={`maintenance-${primaryEquipment.id}`}
                                                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                        checked={primaryEquipment.maintenance_enabled !== false}
                                                        onChange={(e) => handleToggleMaintenance(primaryEquipment.id, e.target.checked)}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3 items-end">
                                                <div className="flex flex-col gap-1.5 col-span-2">
                                                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Посл. чистка</Label>
                                                    <Input
                                                        type="date"
                                                        className="w-full h-9 text-xs bg-white"
                                                        value={lastCleanedDrafts[primaryEquipment.id] ?? ""}
                                                        onChange={(e) => handleLastCleanedChange(primaryEquipment.id, e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Интервал (дн.)</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        className="w-full h-9 text-xs bg-white"
                                                        value={intervalDrafts[primaryEquipment.id] ?? String(primaryEquipment.cleaning_interval_days ?? 30)}
                                                        onChange={(e) => handleIntervalChange(primaryEquipment.id, e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex flex-col justify-end">
                                                    <Button
                                                        size="sm"
                                                        className="h-9 w-full bg-slate-900 text-white hover:bg-slate-800"
                                                        disabled={savingIntervalId === primaryEquipment.id}
                                                        onClick={() => handleSaveInterval(primaryEquipment.id)}
                                                    >
                                                        {savingIntervalId === primaryEquipment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Сохранить"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Термопаста</CardTitle>
                                    <CardDescription>Данные по замене и обслуживанию</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {!primaryEquipment ? (
                                        <div className="text-sm text-muted-foreground">Основное устройство не назначено</div>
                                    ) : !thermalEligible ? (
                                        <div className="text-sm text-muted-foreground">Доступно для ПК и консолей</div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Дата замены</Label>
                                                    <Input
                                                        type="date"
                                                        value={thermalPasteDateDrafts[primaryEquipment.id] ?? ""}
                                                        onChange={(e) => setThermalPasteDateDrafts(prev => ({ ...prev, [primaryEquipment.id]: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Интервал (дней)</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={thermalPasteIntervalDrafts[primaryEquipment.id] ?? ""}
                                                        onChange={(e) => setThermalPasteIntervalDrafts(prev => ({ ...prev, [primaryEquipment.id]: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Тип пасты</Label>
                                                    <Input
                                                        placeholder="Arctic MX-4"
                                                        value={thermalPasteTypeDrafts[primaryEquipment.id] ?? ""}
                                                        onChange={(e) => setThermalPasteTypeDrafts(prev => ({ ...prev, [primaryEquipment.id]: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Заметка</Label>
                                                    <Input
                                                        placeholder="Например, жидкий металл"
                                                        value={thermalPasteNoteDrafts[primaryEquipment.id] ?? ""}
                                                        onChange={(e) => setThermalPasteNoteDrafts(prev => ({ ...prev, [primaryEquipment.id]: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="h-8"
                                                disabled={savingThermalId === primaryEquipment.id}
                                                onClick={() => handleThermalSave(primaryEquipment.id)}
                                            >
                                                {savingThermalId === primaryEquipment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Сохранить данные"}
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border-slate-200 lg:col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Периферия</CardTitle>
                                <CardDescription>Настройка регулярности чистки для устройств на месте</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {peripheralEquipment.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">Периферия не назначена</div>
                                ) : (
                                    peripheralEquipment.map(item => (
                                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-slate-100 bg-white p-3">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className="h-10 w-10 rounded-lg bg-slate-50 border flex items-center justify-center text-slate-500 shrink-0">
                                                    {getEquipmentIcon(item.type)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate text-slate-900">{item.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-slate-100 text-slate-600 hover:bg-slate-200">{item.type_name || item.type}</Badge>
                                                        <span className="text-[10px] text-muted-foreground truncate">{item.brand} {item.model}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                        checked={item.maintenance_enabled !== false}
                                                        onChange={(e) => handleToggleMaintenance(item.id, e.target.checked)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
                                                <div className="flex flex-col gap-1.5 flex-1 sm:flex-none sm:w-[140px]">
                                                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Посл. чистка</Label>
                                                    <Input
                                                        type="date"
                                                        className="h-9 text-xs"
                                                        value={lastCleanedDrafts[item.id] ?? ""}
                                                        onChange={(e) => handleLastCleanedChange(item.id, e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5 w-[80px]">
                                                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Интервал</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        className="h-9 text-xs text-center"
                                                        value={intervalDrafts[item.id] ?? String(item.cleaning_interval_days ?? 30)}
                                                        onChange={(e) => handleIntervalChange(item.id, e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex flex-col justify-end">
                                                    <Button
                                                        size="sm"
                                                        className="h-9 w-12 bg-slate-900 text-white hover:bg-slate-800"
                                                        disabled={savingIntervalId === item.id}
                                                        onClick={() => handleSaveInterval(item.id)}
                                                    >
                                                        {savingIntervalId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </DialogContent>
            </Dialog>

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
                                        {/* Add custom zone if it's set and not in the list */}
                                        {editingWorkplace?.zone && !zones.includes(editingWorkplace.zone) && (
                                            <SelectItem value={editingWorkplace.zone}>{editingWorkplace.zone}</SelectItem>
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
