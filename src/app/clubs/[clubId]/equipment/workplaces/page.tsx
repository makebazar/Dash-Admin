"use client"

import { memo, useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import {
    Plus,
    ChevronLeft,
    ChevronDown,
    MoreVertical,
    Pencil,
    Trash2,
    Loader2,
    MapPin,
    Monitor,
    Layers,
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
    Sofa,
    AlertTriangle,
    Check
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    cpu_thermal_paste_last_changed_at?: string | null
    cpu_thermal_paste_interval_days?: number | null
    cpu_thermal_paste_type?: string | null
    cpu_thermal_paste_note?: string | null
    gpu_thermal_paste_last_changed_at?: string | null
    gpu_thermal_paste_interval_days?: number | null
    gpu_thermal_paste_type?: string | null
    gpu_thermal_paste_note?: string | null
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

const sortWorkplaceIssues = (a: any, b: any) => {
    const aActive = a.status === 'OPEN' || a.status === 'IN_PROGRESS'
    const bActive = b.status === 'OPEN' || b.status === 'IN_PROGRESS'

    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

interface ZoneSectionProps {
    zone: string
    workstations: Workstation[]
    equipmentByWorkstationId: Map<string, Equipment[]>
    activeIssueCountByWorkstationId: Map<string, number>
    activeIssueCountByEquipmentId: Map<string, number>
    zoneIssuesCount: number
    onOpenDetails: (wsId: string) => void
    onEdit: (ws: Workstation) => void
    onDelete: (wsId: string) => void
    onOpenAssignDialog: (wsId: string) => void
    onCreate: (zone?: string) => void
    onUnassignEquipment: (equipmentId: string) => void
    renderEquipmentIcon: (type: string) => React.ReactNode
}

interface WorkstationDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    clubId: string
    workstation: Workstation | null
    equipment: Equipment[]
    employees: Employee[]
    issues: any[]
    equipmentById: Map<string, Equipment>
    isAssigningWorkstationId: string | null
    isSavingIntervalId: string | null
    isSavingCpuThermalId: string | null
    isSavingGpuThermalId: string | null
    onAssignWorkstation: (userId: string | null) => Promise<void>
    onOpenAssignDialog: (wsId: string) => void
    onUnassignEquipment: (equipmentId: string) => Promise<void>
    onToggleMaintenance: (equipmentId: string, enabled: boolean) => Promise<void>
    onSaveInterval: (equipmentId: string, payload: { intervalDays: number; lastCleanedAt: string | null }) => Promise<void>
    onSaveCpuThermal: (equipmentId: string, payload: { changedAt: string | null; intervalDays: number | null; type: string | null; note: string | null }) => Promise<void>
    onSaveGpuThermal: (equipmentId: string, payload: { changedAt: string | null; intervalDays: number | null; type: string | null; note: string | null }) => Promise<void>
    renderEquipmentIcon: (type: string) => React.ReactNode
    renderIssueStatusBadge: (status: string) => React.ReactNode
}

interface ThermalMaintenanceCardProps {
    title: string
    description: string
    summary: string
    isOpen: boolean
    onToggleOpen: () => void
    dateValue: string
    intervalValue: string
    typeValue: string
    noteValue: string
    typePlaceholder: string
    notePlaceholder: string
    isSaving: boolean
    onDateChange: (value: string) => void
    onIntervalChange: (value: string) => void
    onTypeChange: (value: string) => void
    onNoteChange: (value: string) => void
    onSave: () => void
}

const ThermalMaintenanceCard = memo(function ThermalMaintenanceCard({
    title,
    description,
    summary,
    isOpen,
    onToggleOpen,
    dateValue,
    intervalValue,
    typeValue,
    noteValue,
    typePlaceholder,
    notePlaceholder,
    isSaving,
    onDateChange,
    onIntervalChange,
    onTypeChange,
    onNoteChange,
    onSave,
}: ThermalMaintenanceCardProps) {
    return (
        <Card className="border-slate-200">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50/60">
                    <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        onClick={onToggleOpen}
                    >
                        <div>
                            <p className="text-sm font-medium text-slate-900">{summary}</p>
                            <p className="text-xs text-muted-foreground">Дата, интервал и материал</p>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen ? (
                        <div className="space-y-3 border-t border-slate-200 px-4 py-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Дата обслуживания</Label>
                                    <Input
                                        type="date"
                                        value={dateValue}
                                        onChange={(e) => onDateChange(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Интервал (дней)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={intervalValue}
                                        onChange={(e) => onIntervalChange(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Материал</Label>
                                    <Input
                                        placeholder={typePlaceholder}
                                        value={typeValue}
                                        onChange={(e) => onTypeChange(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Заметка</Label>
                                    <Input
                                        placeholder={notePlaceholder}
                                        value={noteValue}
                                        onChange={(e) => onNoteChange(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Button size="sm" className="h-8" disabled={isSaving} onClick={onSave}>
                                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Сохранить"}
                            </Button>
                        </div>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    )
})

interface PeripheralMaintenanceItemProps {
    item: Equipment
    expanded: boolean
    intervalValue: string
    lastCleanedValue: string
    isSaving: boolean
    renderEquipmentIcon: (type: string) => React.ReactNode
    onToggleExpanded: (id: string) => void
    onToggleMaintenance: (equipmentId: string, enabled: boolean) => Promise<void>
    onLastCleanedChange: (equipmentId: string, value: string) => void
    onIntervalChange: (equipmentId: string, value: string) => void
    onSaveInterval: (equipmentId: string, payload: { intervalDays: number; lastCleanedAt: string | null }) => Promise<void>
}

const PeripheralMaintenanceItem = memo(function PeripheralMaintenanceItem({
    item,
    expanded,
    intervalValue,
    lastCleanedValue,
    isSaving,
    renderEquipmentIcon,
    onToggleExpanded,
    onToggleMaintenance,
    onLastCleanedChange,
    onIntervalChange,
    onSaveInterval,
}: PeripheralMaintenanceItemProps) {
    return (
        <div className="rounded-lg border border-slate-100 bg-white p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-slate-50 border flex items-center justify-center text-slate-500 shrink-0">
                        {renderEquipmentIcon(item.type)}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate text-slate-900">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-slate-100 text-slate-600 hover:bg-slate-200">
                                {item.type_name || item.type}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground truncate">{item.brand} {item.model}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Label className="text-xs text-muted-foreground">Обслуживание</Label>
                    <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        checked={item.maintenance_enabled !== false}
                        onChange={(e) => onToggleMaintenance(item.id, e.target.checked)}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => onToggleExpanded(item.id)}
                    >
                        {expanded ? "Скрыть" : "Настроить"}
                    </Button>
                </div>
            </div>

            {expanded ? (
                <div className="grid grid-cols-1 gap-3 items-end sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Посл. чистка</Label>
                        <Input
                            type="date"
                            className="h-9 text-xs"
                            value={lastCleanedValue}
                            onChange={(e) => onLastCleanedChange(item.id, e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Интервал</Label>
                        <Input
                            type="number"
                            min={1}
                            className="h-9 text-xs"
                            value={intervalValue}
                            onChange={(e) => onIntervalChange(item.id, e.target.value)}
                        />
                    </div>
                    <div className="sm:col-span-3">
                        <Button
                            size="sm"
                            className="h-9 w-full bg-slate-900 text-white hover:bg-slate-800"
                            disabled={isSaving}
                            onClick={() => onSaveInterval(item.id, {
                                intervalDays: parseInt(intervalValue, 10),
                                lastCleanedAt: lastCleanedValue || null
                            })}
                        >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Сохранить"}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    )
})

const WorkstationDetailsDialog = memo(function WorkstationDetailsDialog({
    open,
    onOpenChange,
    clubId,
    workstation,
    equipment,
    employees,
    issues,
    equipmentById,
    isAssigningWorkstationId,
    isSavingIntervalId,
    isSavingCpuThermalId,
    isSavingGpuThermalId,
    onAssignWorkstation,
    onOpenAssignDialog,
    onUnassignEquipment,
    onToggleMaintenance,
    onSaveInterval,
    onSaveCpuThermal,
    onSaveGpuThermal,
    renderEquipmentIcon,
    renderIssueStatusBadge,
}: WorkstationDetailsDialogProps) {
    const [activeTab, setActiveTab] = useState<"equipment" | "maintenance" | "issues">("equipment")
    const [isCpuSectionOpen, setIsCpuSectionOpen] = useState(false)
    const [isGpuSectionOpen, setIsGpuSectionOpen] = useState(false)
    const [expandedPeripheralId, setExpandedPeripheralId] = useState<string | null>(null)
    const [intervalDrafts, setIntervalDrafts] = useState<Record<string, string>>({})
    const [lastCleanedDrafts, setLastCleanedDrafts] = useState<Record<string, string>>({})
    const [cpuThermalPasteDateDrafts, setCpuThermalPasteDateDrafts] = useState<Record<string, string>>({})
    const [cpuThermalPasteIntervalDrafts, setCpuThermalPasteIntervalDrafts] = useState<Record<string, string>>({})
    const [cpuThermalPasteTypeDrafts, setCpuThermalPasteTypeDrafts] = useState<Record<string, string>>({})
    const [cpuThermalPasteNoteDrafts, setCpuThermalPasteNoteDrafts] = useState<Record<string, string>>({})
    const [gpuThermalPasteDateDrafts, setGpuThermalPasteDateDrafts] = useState<Record<string, string>>({})
    const [gpuThermalPasteIntervalDrafts, setGpuThermalPasteIntervalDrafts] = useState<Record<string, string>>({})
    const [gpuThermalPasteTypeDrafts, setGpuThermalPasteTypeDrafts] = useState<Record<string, string>>({})
    const [gpuThermalPasteNoteDrafts, setGpuThermalPasteNoteDrafts] = useState<Record<string, string>>({})

    useEffect(() => {
        if (!open) {
            setActiveTab("equipment")
            setIsCpuSectionOpen(false)
            setIsGpuSectionOpen(false)
            setExpandedPeripheralId(null)
            return
        }
    }, [open])

    useEffect(() => {
        if (activeTab !== "maintenance") {
            setIsCpuSectionOpen(false)
            setIsGpuSectionOpen(false)
            setExpandedPeripheralId(null)
        }
    }, [activeTab])

    useEffect(() => {
        if (!open || !workstation || activeTab !== "maintenance") return

        const drafts: Record<string, string> = {}
        const cleanedDrafts: Record<string, string> = {}
        const cpuDateDrafts: Record<string, string> = {}
        const cpuIntervalDraftsMap: Record<string, string> = {}
        const cpuTypeDrafts: Record<string, string> = {}
        const cpuNoteDrafts: Record<string, string> = {}
        const gpuDateDrafts: Record<string, string> = {}
        const gpuIntervalDraftsMap: Record<string, string> = {}
        const gpuTypeDrafts: Record<string, string> = {}
        const gpuNoteDrafts: Record<string, string> = {}

        for (const item of equipment) {
            drafts[item.id] = String(item.cleaning_interval_days ?? 30)

            let cleanedValue = ""
            if (item.last_cleaned_at) {
                const d = new Date(item.last_cleaned_at)
                cleanedValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            }
            cleanedDrafts[item.id] = cleanedValue

            let cpuDateValue = ""
            if (item.cpu_thermal_paste_last_changed_at) {
                const d = new Date(item.cpu_thermal_paste_last_changed_at)
                cpuDateValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            }
            cpuDateDrafts[item.id] = cpuDateValue
            cpuIntervalDraftsMap[item.id] = String(item.cpu_thermal_paste_interval_days ?? 365)
            cpuTypeDrafts[item.id] = item.cpu_thermal_paste_type ?? ""
            cpuNoteDrafts[item.id] = item.cpu_thermal_paste_note ?? ""

            let gpuDateValue = ""
            if (item.gpu_thermal_paste_last_changed_at) {
                const d = new Date(item.gpu_thermal_paste_last_changed_at)
                gpuDateValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            }
            gpuDateDrafts[item.id] = gpuDateValue
            gpuIntervalDraftsMap[item.id] = String(item.gpu_thermal_paste_interval_days ?? 365)
            gpuTypeDrafts[item.id] = item.gpu_thermal_paste_type ?? ""
            gpuNoteDrafts[item.id] = item.gpu_thermal_paste_note ?? ""
        }

        setIntervalDrafts(drafts)
        setLastCleanedDrafts(cleanedDrafts)
        setCpuThermalPasteDateDrafts(cpuDateDrafts)
        setCpuThermalPasteIntervalDrafts(cpuIntervalDraftsMap)
        setCpuThermalPasteTypeDrafts(cpuTypeDrafts)
        setCpuThermalPasteNoteDrafts(cpuNoteDrafts)
        setGpuThermalPasteDateDrafts(gpuDateDrafts)
        setGpuThermalPasteIntervalDrafts(gpuIntervalDraftsMap)
        setGpuThermalPasteTypeDrafts(gpuTypeDrafts)
        setGpuThermalPasteNoteDrafts(gpuNoteDrafts)
    }, [activeTab, equipment, open, workstation])

    const primaryEquipment = useMemo(() => {
        const priority = ["PC", "CONSOLE", "TV"]
        for (const type of priority) {
            const found = equipment.find(item => item.type === type)
            if (found) return found
        }
        return equipment[0] || null
    }, [equipment])

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

    const gpuEligible = useMemo(() => {
        return primaryEquipment ? primaryEquipment.type === "PC" : false
    }, [primaryEquipment])

    const peripheralEquipment = useMemo(() => {
        if (!primaryEquipment) return equipment
        return equipment.filter(item => item.id !== primaryEquipment.id)
    }, [equipment, primaryEquipment])

    const workplaceIssues = useMemo(() => {
        if (activeTab !== "issues") return []
        const equipmentIds = new Set(equipment.map(item => item.id))
        return issues.filter(issue => equipmentIds.has(issue.equipment_id)).sort(sortWorkplaceIssues)
    }, [activeTab, equipment, issues])

    const handleToggleExpandedPeripheral = useCallback((id: string) => {
        setExpandedPeripheralId(current => current === id ? null : id)
    }, [])

    const handlePeripheralLastCleanedChange = useCallback((equipmentId: string, value: string) => {
        setLastCleanedDrafts(prev => ({ ...prev, [equipmentId]: value }))
    }, [])

    const handlePeripheralIntervalChange = useCallback((equipmentId: string, value: string) => {
        setIntervalDrafts(prev => ({ ...prev, [equipmentId]: value }))
    }, [])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{workstation ? `Место ${workstation.name}` : "Место"}</DialogTitle>
                    <DialogDescription>
                        {workstation ? `${workstation.zone} • ${equipment.length} устройств` : ""}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <Label className="text-xs text-muted-foreground">Ответственный</Label>
                    <Select
                        value={workstation?.assigned_user_id || "none"}
                        onValueChange={(val) => onAssignWorkstation(val === "none" ? null : val)}
                        disabled={isAssigningWorkstationId === workstation?.id}
                    >
                        <SelectTrigger className="w-full sm:w-[260px]">
                            <SelectValue placeholder="Не назначено" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">⛔ Не требует обслуживания</SelectItem>
                            {employees.map(emp => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "equipment" | "maintenance" | "issues")} className="pt-2">
                    <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-4 border-b rounded-none">
                        <TabsTrigger value="equipment" variant="underline" className="px-0">Оборудование</TabsTrigger>
                        <TabsTrigger value="maintenance" variant="underline" className="px-0">Обслуживание</TabsTrigger>
                        <TabsTrigger value="issues" variant="underline" className="px-0">Инциденты</TabsTrigger>
                    </TabsList>

                    <TabsContent value="equipment" className="mt-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">Оборудование на месте</div>
                                <div className="text-xs text-muted-foreground truncate">Добавляй со склада, удаление — отправка на склад</div>
                            </div>
                            <Button
                                size="sm"
                                className="shrink-0"
                                onClick={() => {
                                    if (workstation) onOpenAssignDialog(workstation.id)
                                }}
                            >
                                <Plus className="h-4 w-4 mr-1.5" />
                                Добавить
                            </Button>
                        </div>

                        <div className="mt-4 space-y-4">
                            <Card className="border-slate-200">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">{primaryLabel}</CardTitle>
                                    <CardDescription>{primaryDescription}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {!primaryEquipment ? (
                                        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 p-4">
                                            <div className="text-sm text-muted-foreground">Основное устройство не назначено</div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    if (workstation) onOpenAssignDialog(workstation.id)
                                                }}
                                            >
                                                Назначить
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center text-slate-500 shrink-0 shadow-sm">
                                                    {renderEquipmentIcon(primaryEquipment.type)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-semibold truncate max-w-[420px]">{primaryEquipment.name}</p>
                                                        <Badge variant="outline" className="text-[10px] h-5 px-1 bg-white text-slate-500 border-slate-200 font-normal">
                                                            {primaryEquipment.type_name || primaryEquipment.type}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground truncate">{primaryEquipment.brand} {primaryEquipment.model}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onUnassignEquipment(primaryEquipment.id)}
                                                >
                                                    <X className="h-4 w-4 mr-1.5" />
                                                    На склад
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Периферия</CardTitle>
                                    <CardDescription>Устройства, привязанные к месту</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {peripheralEquipment.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">Периферия не назначена</div>
                                    ) : (
                                        peripheralEquipment.map(item => (
                                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-9 w-9 rounded-lg bg-slate-50 border flex items-center justify-center text-slate-500 shrink-0">
                                                        {renderEquipmentIcon(item.type)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-sm font-semibold truncate max-w-[420px] text-slate-900">{item.name}</p>
                                                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-slate-100 text-slate-600 hover:bg-slate-200">
                                                                {item.type_name || item.type}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground truncate">{item.brand} {item.model}</div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="shrink-0"
                                                    onClick={() => onUnassignEquipment(item.id)}
                                                >
                                                    <X className="h-4 w-4 mr-1.5" />
                                                    На склад
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="maintenance" className="mt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-6">
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
                                                <div className="flex items-center justify-between gap-3 w-full">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center text-slate-500 shrink-0 shadow-sm">
                                                            {renderEquipmentIcon(primaryEquipment.type)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold truncate">{primaryEquipment.name}</p>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="text-[10px] h-5 px-1 bg-white text-slate-500 border-slate-200 font-normal">{primaryEquipment.type_name || primaryEquipment.type}</Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <Label htmlFor={`maintenance-${primaryEquipment.id}`} className="text-xs text-muted-foreground cursor-pointer">Обслуживание</Label>
                                                        <input
                                                            type="checkbox"
                                                            id={`maintenance-${primaryEquipment.id}`}
                                                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                            checked={primaryEquipment.maintenance_enabled !== false}
                                                            onChange={(e) => onToggleMaintenance(primaryEquipment.id, e.target.checked)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                                                        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Посл. чистка</Label>
                                                        <Input
                                                            type="date"
                                                            className="w-full h-9 text-xs bg-white"
                                                            value={lastCleanedDrafts[primaryEquipment.id] ?? ""}
                                                            onChange={(e) => setLastCleanedDrafts(prev => ({ ...prev, [primaryEquipment.id]: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Интервал (дн.)</Label>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            className="w-full h-9 text-xs bg-white"
                                                            value={intervalDrafts[primaryEquipment.id] ?? String(primaryEquipment.cleaning_interval_days ?? 30)}
                                                            onChange={(e) => setIntervalDrafts(prev => ({ ...prev, [primaryEquipment.id]: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-3">
                                                        <Button
                                                            size="sm"
                                                            className="h-9 w-full bg-slate-900 text-white hover:bg-slate-800"
                                                            disabled={isSavingIntervalId === primaryEquipment.id}
                                                            onClick={() => onSaveInterval(primaryEquipment.id, {
                                                                intervalDays: parseInt(intervalDrafts[primaryEquipment.id] ?? String(primaryEquipment.cleaning_interval_days ?? 30), 10),
                                                                lastCleanedAt: lastCleanedDrafts[primaryEquipment.id] || null
                                                            })}
                                                        >
                                                            {isSavingIntervalId === primaryEquipment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Сохранить"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="border-slate-200">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Процессор</CardTitle>
                                        <CardDescription>Обслуживание CPU (термопаста)</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {!primaryEquipment ? (
                                            <div className="text-sm text-muted-foreground">Основное устройство не назначено</div>
                                        ) : !thermalEligible ? (
                                            <div className="text-sm text-muted-foreground">Доступно для ПК и консолей</div>
                                        ) : (
                                            <ThermalMaintenanceCard
                                                title="Процессор"
                                                description="Обслуживание CPU (термопаста)"
                                                summary="Настройки CPU"
                                                isOpen={isCpuSectionOpen}
                                                onToggleOpen={() => setIsCpuSectionOpen(current => !current)}
                                                dateValue={cpuThermalPasteDateDrafts[primaryEquipment.id] ?? ""}
                                                intervalValue={cpuThermalPasteIntervalDrafts[primaryEquipment.id] ?? ""}
                                                typeValue={cpuThermalPasteTypeDrafts[primaryEquipment.id] ?? ""}
                                                noteValue={cpuThermalPasteNoteDrafts[primaryEquipment.id] ?? ""}
                                                typePlaceholder="Arctic MX-4"
                                                notePlaceholder="Например, жидкий металл"
                                                isSaving={isSavingCpuThermalId === primaryEquipment.id}
                                                onDateChange={(value) => setCpuThermalPasteDateDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                onIntervalChange={(value) => setCpuThermalPasteIntervalDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                onTypeChange={(value) => setCpuThermalPasteTypeDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                onNoteChange={(value) => setCpuThermalPasteNoteDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                onSave={() => onSaveCpuThermal(primaryEquipment.id, {
                                                    changedAt: cpuThermalPasteDateDrafts[primaryEquipment.id] || null,
                                                    intervalDays: cpuThermalPasteIntervalDrafts[primaryEquipment.id] ? parseInt(cpuThermalPasteIntervalDrafts[primaryEquipment.id], 10) : null,
                                                    type: cpuThermalPasteTypeDrafts[primaryEquipment.id] || null,
                                                    note: cpuThermalPasteNoteDrafts[primaryEquipment.id] || null
                                                })}
                                            />
                                        )}
                                    </CardContent>
                                </Card>

                                {gpuEligible && (
                                    !primaryEquipment ? (
                                        <Card className="border-slate-200">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base">Видеокарта</CardTitle>
                                                <CardDescription>Обслуживание GPU (термопаста/термопрокладки)</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="text-sm text-muted-foreground">Основное устройство не назначено</div>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <ThermalMaintenanceCard
                                            title="Видеокарта"
                                            description="Обслуживание GPU (термопаста/термопрокладки)"
                                            summary="Настройки GPU"
                                            isOpen={isGpuSectionOpen}
                                            onToggleOpen={() => setIsGpuSectionOpen(current => !current)}
                                            dateValue={gpuThermalPasteDateDrafts[primaryEquipment.id] ?? ""}
                                            intervalValue={gpuThermalPasteIntervalDrafts[primaryEquipment.id] ?? ""}
                                            typeValue={gpuThermalPasteTypeDrafts[primaryEquipment.id] ?? ""}
                                            noteValue={gpuThermalPasteNoteDrafts[primaryEquipment.id] ?? ""}
                                            typePlaceholder="Термопаста/прокладки"
                                            notePlaceholder="Например, замена прокладок"
                                            isSaving={isSavingGpuThermalId === primaryEquipment.id}
                                            onDateChange={(value) => setGpuThermalPasteDateDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                            onIntervalChange={(value) => setGpuThermalPasteIntervalDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                            onTypeChange={(value) => setGpuThermalPasteTypeDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                            onNoteChange={(value) => setGpuThermalPasteNoteDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                            onSave={() => onSaveGpuThermal(primaryEquipment.id, {
                                                changedAt: gpuThermalPasteDateDrafts[primaryEquipment.id] || null,
                                                intervalDays: gpuThermalPasteIntervalDrafts[primaryEquipment.id] ? parseInt(gpuThermalPasteIntervalDrafts[primaryEquipment.id], 10) : null,
                                                type: gpuThermalPasteTypeDrafts[primaryEquipment.id] || null,
                                                note: gpuThermalPasteNoteDrafts[primaryEquipment.id] || null
                                            })}
                                        />
                                    )
                                )}
                            </div>

                            <Card className="border-slate-200">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Периферия</CardTitle>
                                    <CardDescription>Регулярность чистки для устройств на месте</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {peripheralEquipment.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">Периферия не назначена</div>
                                    ) : (
                                        peripheralEquipment.map(item => (
                                            <PeripheralMaintenanceItem
                                                key={item.id}
                                                item={item}
                                                expanded={expandedPeripheralId === item.id}
                                                intervalValue={intervalDrafts[item.id] ?? String(item.cleaning_interval_days ?? 30)}
                                                lastCleanedValue={lastCleanedDrafts[item.id] ?? ""}
                                                isSaving={isSavingIntervalId === item.id}
                                                renderEquipmentIcon={renderEquipmentIcon}
                                                onToggleExpanded={handleToggleExpandedPeripheral}
                                                onToggleMaintenance={onToggleMaintenance}
                                                onLastCleanedChange={handlePeripheralLastCleanedChange}
                                                onIntervalChange={handlePeripheralIntervalChange}
                                                onSaveInterval={onSaveInterval}
                                            />
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="issues" className="mt-4">
                        <Card className="border-slate-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-slate-500" />
                                    История инцидентов
                                </CardTitle>
                                <CardDescription>Список всех проблем с оборудованием на этом месте</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {workplaceIssues.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-slate-100 rounded-lg">
                                        <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                            <Check className="h-5 w-5 text-green-500" />
                                        </div>
                                        <p className="text-sm">Инцидентов не зафиксировано</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {workplaceIssues.map(issue => {
                                            const issueEquipment = equipmentById.get(issue.equipment_id)

                                            return (
                                                <div key={issue.id} className={cn(
                                                    "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg border",
                                                    (issue.status === 'OPEN' || issue.status === 'IN_PROGRESS')
                                                        ? "bg-rose-50 border-rose-100"
                                                        : "bg-white border-slate-100"
                                                )}>
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <div className={cn(
                                                            "h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5",
                                                            (issue.status === 'OPEN' || issue.status === 'IN_PROGRESS')
                                                                ? "bg-white border-rose-200 text-rose-500"
                                                                : "bg-slate-50 border-slate-200 text-slate-400"
                                                        )}>
                                                            {issueEquipment ? renderEquipmentIcon(issueEquipment.type) : <Wrench className="h-4 w-4" />}
                                                        </div>
                                                        <div className="min-w-0 space-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="text-sm font-semibold truncate text-slate-900">{issue.title}</p>
                                                                {renderIssueStatusBadge(issue.status)}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                                                <span className="font-medium text-slate-600">{issueEquipment?.name}</span>
                                                                <span>•</span>
                                                                <span>{new Date(issue.created_at).toLocaleDateString('ru-RU')}</span>
                                                                <span>•</span>
                                                                <span className="flex items-center gap-1">
                                                                    <User className="h-3 w-3" />
                                                                    {issue.reported_by_name}
                                                                </span>
                                                            </div>
                                                            {(issue.status === 'OPEN' || issue.status === 'IN_PROGRESS') && (
                                                                <p className="text-xs text-rose-700 line-clamp-1">{issue.description}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {issue.assigned_to_name && (issue.status === 'OPEN' || issue.status === 'IN_PROGRESS') && (
                                                            <Badge variant="outline" className="bg-white text-slate-600 font-normal">
                                                                <User className="h-3 w-3 mr-1" />
                                                                {issue.assigned_to_name}
                                                            </Badge>
                                                        )}
                                                        <Link href={`/clubs/${clubId}/equipment/issues`} className="text-xs font-medium text-primary hover:underline">
                                                            Перейти
                                                        </Link>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
})

const ZoneSection = memo(function ZoneSection({
    zone,
    workstations,
    equipmentByWorkstationId,
    activeIssueCountByWorkstationId,
    activeIssueCountByEquipmentId,
    zoneIssuesCount,
    onOpenDetails,
    onEdit,
    onDelete,
    onOpenAssignDialog,
    onCreate,
    onUnassignEquipment,
    renderEquipmentIcon,
}: ZoneSectionProps) {
    return (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="group flex items-center justify-between px-2 sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b">
                <h2 className="text-lg font-black uppercase tracking-widest text-slate-500 flex items-center gap-3">
                    <Layers className="h-5 w-5 text-primary" />
                    {zone}
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none px-2">{workstations.length}</Badge>
                    {zoneIssuesCount > 0 ? (
                        <Badge variant="outline" className="ml-2 gap-1 flex items-center bg-orange-50 text-orange-700 border-orange-200">
                            <AlertTriangle className="h-3 w-3" />
                            {zoneIssuesCount} проблем
                        </Badge>
                    ) : null}
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {workstations.map(ws => {
                    const wsEquipment = equipmentByWorkstationId.get(ws.id) ?? []
                    const wsIssueCount = activeIssueCountByWorkstationId.get(ws.id) ?? 0

                    return (
                        <Card key={ws.id} className={cn(
                            "group hover:border-primary/50 transition-all border-slate-200 shadow-sm overflow-hidden flex flex-col h-full cursor-pointer",
                            wsIssueCount > 0 && "border-orange-200 bg-orange-50/10"
                        )} onClick={() => onOpenDetails(ws.id)}>
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 bg-slate-50/50 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "h-10 w-10 bg-white rounded-xl border flex items-center justify-center text-slate-400 font-bold shadow-sm relative",
                                        wsIssueCount > 0 && "border-orange-200 text-orange-500"
                                    )}>
                                        {ws.name.replace(/[^0-9]/g, '') || <Monitor className="h-5 w-5" />}
                                        {wsIssueCount > 0 && (
                                            <div className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-orange-500 rounded-full border-2 border-white animate-pulse" />
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 leading-tight flex items-center gap-2">
                                            {ws.name}
                                        </h4>
                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{wsEquipment.length} устройств</p>
                                            <div className="flex items-center gap-1.5" title={ws.assigned_user_name || "Не назначено"}>
                                                <User className={cn("h-3 w-3", ws.assigned_user_name ? "text-primary" : "text-slate-400")} />
                                                <span className={cn("text-[10px] font-medium truncate max-w-[100px]", ws.assigned_user_name ? "text-primary" : "text-slate-400")}>
                                                    {ws.assigned_user_name || "Не назначено"}
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
                                        <DropdownMenuItem onClick={() => onEdit(ws)}>
                                            <Pencil className="mr-2 h-4 w-4" /> Изменить название
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-rose-600" onClick={() => onDelete(ws.id)}>
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
                                        <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1 text-primary" onClick={(e) => { e.stopPropagation(); onOpenAssignDialog(ws.id) }}>
                                            Назначить сейчас
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {wsEquipment.map(item => {
                                            const itemIssueCount = activeIssueCountByEquipmentId.get(item.id) ?? 0

                                            return (
                                                <div key={item.id} className={cn(
                                                    "flex items-center justify-between p-2 pl-3 rounded-lg bg-slate-50 border border-slate-100 group/item hover:border-primary/20 hover:bg-primary/5 transition-all relative overflow-hidden",
                                                    itemIssueCount > 0 && "bg-orange-50/30 border-orange-200 border-l-[3px] border-l-orange-500 pl-2.5"
                                                )}>
                                                    <div className="flex items-center gap-3 overflow-hidden relative z-10">
                                                        <div className={cn(
                                                            "h-8 w-8 rounded-md bg-white border flex items-center justify-center text-slate-500 shrink-0 relative",
                                                            itemIssueCount > 0 && "border-orange-200 text-orange-500"
                                                        )}>
                                                            {renderEquipmentIcon(item.type)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={cn(
                                                                "text-xs font-semibold truncate text-slate-700 group-hover/item:text-primary",
                                                                itemIssueCount > 0 && "text-orange-700"
                                                            )}>{item.name}</p>
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="text-[10px] text-muted-foreground truncate">{item.brand} {item.model}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                                        title="Убрать с места (на склад)"
                                                        onClick={(e) => { e.stopPropagation(); onUnassignEquipment(item.id) }}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>

                            <CardFooter className="p-3 bg-slate-50 border-t border-slate-100">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs h-8 bg-white hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-sm"
                                    onClick={(e) => { e.stopPropagation(); onOpenAssignDialog(ws.id) }}
                                >
                                    <Plus className="h-3 w-3 mr-1.5" /> Добавить оборудование
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })}

                <button
                    onClick={() => onCreate(zone)}
                    className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all group min-h-[250px]"
                >
                    <div className="h-12 w-12 rounded-full bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                        <Plus className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-widest">Новое место в {zone}</span>
                </button>
            </div>
        </section>
    )
})

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
    const [createZoneLocked, setCreateZoneLocked] = useState<string | null>(null)
    
    // Equipment Assignment Dialog
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
    const [selectedWorkstationId, setSelectedWorkstationId] = useState<string | null>(null)
    const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>("all")
    const [searchEquipment, setSearchEquipment] = useState("")

    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [detailsWorkstationId, setDetailsWorkstationId] = useState<string | null>(null)
    const [savingIntervalId, setSavingIntervalId] = useState<string | null>(null)
    const [savingCpuThermalId, setSavingCpuThermalId] = useState<string | null>(null)
    const [savingGpuThermalId, setSavingGpuThermalId] = useState<string | null>(null)
    const [isAssigningWorkstationId, setIsAssigningWorkstationId] = useState<string | null>(null)
    const [activeIssues, setActiveIssues] = useState<any[]>([])
    const [allIssues, setAllIssues] = useState<any[]>([])

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [wsRes, eqRes, typesRes, empRes, zonesRes, issuesRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/workstations`),
                fetch(`/api/clubs/${clubId}/equipment?limit=1000`),
                fetch(`/api/equipment-types`),
                fetch(`/api/clubs/${clubId}/employees`),
                fetch(`/api/clubs/${clubId}/zones`),
                fetch(`/api/clubs/${clubId}/equipment/issues`)
            ])

            const wsData = await wsRes.json()
            const eqData = await eqRes.json()
            const typesData = await typesRes.json()
            const empData = await empRes.json()

            if (issuesRes.ok) {
                const issuesData = await issuesRes.json()
                const issues = issuesData.issues || []
                setAllIssues(issues)
                
                // Filter only active issues
                const active = issues.filter((i: any) => i.status !== 'CLOSED' && i.status !== 'RESOLVED')
                setActiveIssues(active)
            }

            if (zonesRes.ok) {
                const zonesData = await zonesRes.json()
                setZoneList(zonesData)
            }

            if (wsRes.ok && eqRes.ok) {
                const allEquipment = (eqData.equipment || []).map((e: any) => ({
                    ...e,
                    maintenance_enabled: e.maintenance_enabled !== false
                }))
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

    const closeWorkplaceDialog = () => {
        setIsDialogOpen(false)
        setEditingWorkplace(null)
        setCreateZoneLocked(null)
        setIsNewZoneDialogOpen(false)
        setNewZoneName("")
    }

    const handleCreate = useCallback((zone?: string) => {
        setCreateZoneLocked(zone ?? null)
        setEditingWorkplace({
            name: '',
            zone: zone ?? (zones[0] ?? 'General')
        })
        setIsDialogOpen(true)
    }, [zones])

    const handleEdit = useCallback((ws: Workstation) => {
        setCreateZoneLocked(null)
        setEditingWorkplace(ws)
        setIsDialogOpen(true)
    }, [])

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
                closeWorkplaceDialog()
                fetchData()
            }
        } catch (error) {
            console.error("Error saving workplace:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = useCallback(async (id: string) => {
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
    }, [clubId, fetchData, workstations])

    // --- Equipment Assignment Logic ---

    const handleOpenAssignDialog = useCallback((wsId: string) => {
        setSelectedWorkstationId(wsId)
        setIsAssignDialogOpen(true)
    }, [])

    const handleAssignEquipment = useCallback(async (equipmentId: string) => {
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
    }, [clubId, fetchData, selectedWorkstationId])

    const handleUnassignEquipment = useCallback(async (equipmentId: string) => {
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
    }, [clubId, fetchData])

    const handleToggleMaintenance = useCallback(async (equipmentId: string, enabled: boolean) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    maintenance_enabled: enabled,
                    // Если обслуживание выключается вручную, сбрасываем прямого ответственного
                    assigned_user_id: enabled ? undefined : null
                })
            })
            if (res.ok) {
                fetchData() // Refresh
            }
        } catch (error) {
            console.error("Error toggling maintenance:", error)
        }
    }, [clubId, fetchData])

    const equipmentByWorkstationId = useMemo(() => {
        const map = new Map<string, Equipment[]>()

        for (const item of equipment) {
            if (!item.workstation_id) continue
            const current = map.get(item.workstation_id)
            if (current) current.push(item)
            else map.set(item.workstation_id, [item])
        }

        return map
    }, [equipment])

    const equipmentById = useMemo(() => {
        return new Map(equipment.map(item => [item.id, item]))
    }, [equipment])

    const workstationsByZone = useMemo(() => {
        const map = new Map<string, Workstation[]>()

        for (const workstation of workstations) {
            const current = map.get(workstation.zone)
            if (current) current.push(workstation)
            else map.set(workstation.zone, [workstation])
        }

        return map
    }, [workstations])

    const activeIssueCountByEquipmentId = useMemo(() => {
        const map = new Map<string, number>()

        for (const issue of activeIssues) {
            map.set(issue.equipment_id, (map.get(issue.equipment_id) ?? 0) + 1)
        }

        return map
    }, [activeIssues])

    const activeIssueCountByWorkstationId = useMemo(() => {
        const map = new Map<string, number>()

        equipmentByWorkstationId.forEach((items, workstationId) => {
            const issuesCount = items.reduce((total, item) => total + (activeIssueCountByEquipmentId.get(item.id) ?? 0), 0)
            if (issuesCount > 0) {
                map.set(workstationId, issuesCount)
            }
        })

        return map
    }, [activeIssueCountByEquipmentId, equipmentByWorkstationId])

    const zoneIssueCountByName = useMemo(() => {
        const map = new Map<string, number>()

        for (const zone of zones) {
            const issuesCount = (workstationsByZone.get(zone) ?? []).reduce(
                (total, workstation) => total + (activeIssueCountByWorkstationId.get(workstation.id) ?? 0),
                0
            )

            if (issuesCount > 0) {
                map.set(zone, issuesCount)
            }
        }

        return map
    }, [activeIssueCountByWorkstationId, workstationsByZone, zones])

    const handleOpenDetails = useCallback((wsId: string) => {
        setDetailsWorkstationId(wsId)
        setIsDetailsOpen(true)
    }, [])

    const handleSaveInterval = useCallback(async (equipmentId: string, payload: { intervalDays: number; lastCleanedAt: string | null }) => {
        const value = payload.intervalDays
        if (!value || value < 1) return

        setSavingIntervalId(equipmentId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    cleaning_interval_days: value,
                    last_cleaned_at: payload.lastCleanedAt
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
    }, [clubId, fetchData])

    const handleCpuThermalSave = useCallback(async (equipmentId: string, payload: { changedAt: string | null; intervalDays: number | null; type: string | null; note: string | null }) => {
        const intervalValue = payload.intervalDays
        if (intervalValue !== null && intervalValue < 1) return

        setSavingCpuThermalId(equipmentId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cpu_thermal_paste_last_changed_at: payload.changedAt,
                    cpu_thermal_paste_interval_days: intervalValue,
                    cpu_thermal_paste_type: payload.type,
                    cpu_thermal_paste_note: payload.note
                })
            })
            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            console.error("Error updating CPU maintenance:", error)
        } finally {
            setSavingCpuThermalId(null)
        }
    }, [clubId, fetchData])

    const handleGpuThermalSave = useCallback(async (equipmentId: string, payload: { changedAt: string | null; intervalDays: number | null; type: string | null; note: string | null }) => {
        const intervalValue = payload.intervalDays
        if (intervalValue !== null && intervalValue < 1) return

        setSavingGpuThermalId(equipmentId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gpu_thermal_paste_last_changed_at: payload.changedAt,
                    gpu_thermal_paste_interval_days: intervalValue,
                    gpu_thermal_paste_type: payload.type,
                    gpu_thermal_paste_note: payload.note
                })
            })
            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            console.error("Error updating GPU maintenance:", error)
        } finally {
            setSavingGpuThermalId(null)
        }
    }, [clubId, fetchData])

    const handleAssignWorkstation = useCallback(async (userId: string | null) => {
        if (!detailsWorkstationId) return

        setIsAssigningWorkstationId(detailsWorkstationId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations/${detailsWorkstationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigned_user_id: userId })
            })
            
            if (res.ok) {
                fetchData()
            }
        } catch (error) {
            console.error("Error assigning workstation:", error)
        } finally {
            setIsAssigningWorkstationId(null)
        }
    }, [clubId, detailsWorkstationId, fetchData])

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
        if (!detailsWorkstationId) return []
        return equipmentByWorkstationId.get(detailsWorkstationId) ?? []
    }, [detailsWorkstationId, equipmentByWorkstationId])

    const getEquipmentIcon = useCallback((type: string) => {
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
    }, [])

    const getIssueStatusBadge = useCallback((status: string) => {
        switch (status) {
            case 'OPEN': return <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-300">Открыто</Badge>
            case 'IN_PROGRESS': return <Badge className="bg-blue-500 hover:bg-blue-600">В работе</Badge>
            case 'RESOLVED': return <Badge className="bg-green-500 hover:bg-green-600">Решено</Badge>
            case 'CLOSED': return <Badge variant="outline" className="text-slate-500 border-slate-300">Закрыто</Badge>
            default: return null
        }
    }, [])

    const zonesContent = useMemo(() => {
        if (zones.length === 0 && !isLoading) {
            return (
                <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                    <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <MapPin className="h-10 w-10 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold">Зоны не созданы</h3>
                    <p className="text-sm text-muted-foreground mb-6">Создайте первое рабочее место, чтобы организовать пространство клуба</p>
                    <Button onClick={() => handleCreate()} variant="outline">Создать первое место</Button>
                </div>
            )
        }

        return zones.map(zone => (
            <ZoneSection
                key={zone}
                zone={zone}
                workstations={workstationsByZone.get(zone) ?? []}
                equipmentByWorkstationId={equipmentByWorkstationId}
                activeIssueCountByWorkstationId={activeIssueCountByWorkstationId}
                activeIssueCountByEquipmentId={activeIssueCountByEquipmentId}
                zoneIssuesCount={zoneIssueCountByName.get(zone) ?? 0}
                onOpenDetails={handleOpenDetails}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onOpenAssignDialog={handleOpenAssignDialog}
                onCreate={handleCreate}
                onUnassignEquipment={handleUnassignEquipment}
                renderEquipmentIcon={getEquipmentIcon}
            />
        ))
    }, [
        activeIssueCountByEquipmentId,
        activeIssueCountByWorkstationId,
        equipmentByWorkstationId,
        getEquipmentIcon,
        handleCreate,
        handleDelete,
        handleEdit,
        handleOpenAssignDialog,
        handleOpenDetails,
        handleUnassignEquipment,
        isLoading,
        workstationsByZone,
        zoneIssueCountByName,
        zones
    ])

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
                        <Button onClick={() => handleCreate()} className="bg-primary shadow-md hover:bg-primary/90">
                            <Plus className="mr-2 h-4 w-4" />
                            Создать место
                        </Button>
                    </div>
                </div>
            </div>

            {/* Zones Grid */}
            <div className="space-y-12">
                {zonesContent}
            </div>

            <WorkstationDetailsDialog
                open={isDetailsOpen}
                onOpenChange={(open) => {
                    setIsDetailsOpen(open)
                    if (!open) setDetailsWorkstationId(null)
                }}
                clubId={clubId as string}
                workstation={activeWorkstation}
                equipment={activeEquipment}
                employees={employees}
                issues={allIssues}
                equipmentById={equipmentById}
                isAssigningWorkstationId={isAssigningWorkstationId}
                isSavingIntervalId={savingIntervalId}
                isSavingCpuThermalId={savingCpuThermalId}
                isSavingGpuThermalId={savingGpuThermalId}
                onAssignWorkstation={handleAssignWorkstation}
                onOpenAssignDialog={handleOpenAssignDialog}
                onUnassignEquipment={handleUnassignEquipment}
                onToggleMaintenance={handleToggleMaintenance}
                onSaveInterval={handleSaveInterval}
                onSaveCpuThermal={handleCpuThermalSave}
                onSaveGpuThermal={handleGpuThermalSave}
                renderEquipmentIcon={getEquipmentIcon}
                renderIssueStatusBadge={getIssueStatusBadge}
            />

            {/* Workplace Edit/Create Dialog */}
            <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    if (open) setIsDialogOpen(true)
                    else closeWorkplaceDialog()
                }}
            >
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
                            {createZoneLocked && !editingWorkplace?.id ? (
                                <Input id="ws-zone" value={createZoneLocked} disabled />
                            ) : (
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
                            )}
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={closeWorkplaceDialog}>Отмена</Button>
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
