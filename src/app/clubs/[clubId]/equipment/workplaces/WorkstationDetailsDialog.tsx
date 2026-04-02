"use client"

import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, Check, ChevronDown, Loader2, Plus, User, Wrench, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { Employee, Equipment, Workstation } from "./types"

const sortWorkplaceIssues = (a: any, b: any) => {
    const aActive = a.status === "OPEN" || a.status === "IN_PROGRESS"
    const bActive = b.status === "OPEN" || b.status === "IN_PROGRESS"

    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

interface WorkstationDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    clubId: string
    workstation: Workstation | null
    equipment: Equipment[]
    employees: Employee[]
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
    renderEquipmentIcon: (type: string) => ReactNode
    renderIssueStatusBadge: (status: string) => ReactNode
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

interface PeripheralMaintenanceItemProps {
    item: Equipment
    expanded: boolean
    intervalValue: string
    lastCleanedValue: string
    isSaving: boolean
    renderEquipmentIcon: (type: string) => ReactNode
    onToggleExpanded: (id: string) => void
    onToggleMaintenance: (equipmentId: string, enabled: boolean) => Promise<void>
    onLastCleanedChange: (equipmentId: string, value: string) => void
    onIntervalChange: (equipmentId: string, value: string) => void
    onSaveInterval: (equipmentId: string, payload: { intervalDays: number; lastCleanedAt: string | null }) => Promise<void>
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
                                    <Input type="date" value={dateValue} onChange={(e) => onDateChange(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Интервал (дней)</Label>
                                    <Input type="number" min={1} value={intervalValue} onChange={(e) => onIntervalChange(e.target.value)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Материал</Label>
                                    <Input placeholder={typePlaceholder} value={typeValue} onChange={(e) => onTypeChange(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Заметка</Label>
                                    <Input placeholder={notePlaceholder} value={noteValue} onChange={(e) => onNoteChange(e.target.value)} />
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
        <div className="space-y-3 rounded-lg border border-slate-100 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-slate-50 text-slate-500">
                        {renderEquipmentIcon(item.type)}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                            <Badge variant="secondary" className="h-5 bg-slate-100 px-1.5 text-[10px] font-normal text-slate-600 hover:bg-slate-200">
                                {item.type_name || item.type}
                            </Badge>
                            <span className="truncate text-[10px] text-muted-foreground">{item.brand} {item.model}</span>
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Обслуживание</Label>
                    <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        checked={item.maintenance_enabled !== false}
                        onChange={(e) => onToggleMaintenance(item.id, e.target.checked)}
                    />
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onToggleExpanded(item.id)}>
                        {expanded ? "Скрыть" : "Настроить"}
                    </Button>
                </div>
            </div>

            {expanded ? (
                <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Посл. чистка</Label>
                        <Input type="date" className="h-9 text-xs" value={lastCleanedValue} onChange={(e) => onLastCleanedChange(item.id, e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Интервал</Label>
                        <Input type="number" min={1} className="h-9 text-xs" value={intervalValue} onChange={(e) => onIntervalChange(item.id, e.target.value)} />
                    </div>
                    <div className="sm:col-span-3">
                        <Button
                            size="sm"
                            className="h-9 w-full bg-slate-900 text-white hover:bg-slate-800"
                            disabled={isSaving}
                            onClick={() => onSaveInterval(item.id, {
                                intervalDays: parseInt(intervalValue, 10),
                                lastCleanedAt: lastCleanedValue || null,
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

export default memo(function WorkstationDetailsDialog({
    open,
    onOpenChange,
    clubId,
    workstation,
    equipment,
    employees,
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
    const [issuesByWorkstationId, setIssuesByWorkstationId] = useState<Record<string, any[]>>({})
    const [isIssuesLoading, setIsIssuesLoading] = useState(false)

    useEffect(() => {
        if (!open) {
            setActiveTab("equipment")
            setIsCpuSectionOpen(false)
            setIsGpuSectionOpen(false)
            setExpandedPeripheralId(null)
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
        if (!open || activeTab !== "issues" || !workstation) return

        const cachedIssues = issuesByWorkstationId[workstation.id]
        if (cachedIssues) return

        let cancelled = false

        const loadIssues = async () => {
            setIsIssuesLoading(true)
            try {
                const res = await fetch(`/api/clubs/${clubId}/equipment/issues?workstation_id=${workstation.id}&include_stats=false`)
                const data = await res.json()

                if (!res.ok || cancelled) return

                setIssuesByWorkstationId(prev => prev[workstation.id] ? prev : ({ ...prev, [workstation.id]: data.issues || [] }))
            } catch (error) {
                if (!cancelled) {
                    console.error("Error loading workstation issues:", error)
                }
            } finally {
                if (!cancelled) {
                    setIsIssuesLoading(false)
                }
            }
        }

        loadIssues()

        return () => {
            cancelled = true
        }
    }, [activeTab, clubId, issuesByWorkstationId, open, workstation])

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
                cleanedValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
            }
            cleanedDrafts[item.id] = cleanedValue

            let cpuDateValue = ""
            if (item.cpu_thermal_paste_last_changed_at) {
                const d = new Date(item.cpu_thermal_paste_last_changed_at)
                cpuDateValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
            }
            cpuDateDrafts[item.id] = cpuDateValue
            cpuIntervalDraftsMap[item.id] = String(item.cpu_thermal_paste_interval_days ?? 365)
            cpuTypeDrafts[item.id] = item.cpu_thermal_paste_type ?? ""
            cpuNoteDrafts[item.id] = item.cpu_thermal_paste_note ?? ""

            let gpuDateValue = ""
            if (item.gpu_thermal_paste_last_changed_at) {
                const d = new Date(item.gpu_thermal_paste_last_changed_at)
                gpuDateValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
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

    const thermalEligible = useMemo(() => primaryEquipment ? ["PC", "CONSOLE"].includes(primaryEquipment.type) : false, [primaryEquipment])
    const gpuEligible = useMemo(() => primaryEquipment ? primaryEquipment.type === "PC" : false, [primaryEquipment])
    const peripheralEquipment = useMemo(() => !primaryEquipment ? equipment : equipment.filter(item => item.id !== primaryEquipment.id), [equipment, primaryEquipment])
    const workplaceIssues = useMemo(() => activeTab !== "issues" || !workstation ? [] : [...(issuesByWorkstationId[workstation.id] || [])].sort(sortWorkplaceIssues), [activeTab, issuesByWorkstationId, workstation])

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
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[900px]">
                <DialogHeader>
                    <DialogTitle>{workstation ? `Место ${workstation.name}` : "Место"}</DialogTitle>
                    <DialogDescription>
                        {workstation ? `${workstation.zone} • ${equipment.length} устройств` : ""}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Label className="text-xs text-muted-foreground">Ответственный</Label>
                    <Select
                        value={workstation?.assigned_user_id || "none"}
                        onValueChange={(value) => onAssignWorkstation(value === "none" ? null : value)}
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
                    <TabsList className="h-auto w-full justify-start gap-4 rounded-none border-b bg-transparent p-0">
                        <TabsTrigger value="equipment" variant="underline" className="px-0">Оборудование</TabsTrigger>
                        <TabsTrigger value="maintenance" variant="underline" className="px-0">Обслуживание</TabsTrigger>
                        <TabsTrigger value="issues" variant="underline" className="px-0">Инциденты</TabsTrigger>
                    </TabsList>

                    <TabsContent value="equipment" className="mt-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">Оборудование на месте</div>
                                <div className="truncate text-xs text-muted-foreground">Добавляй со склада, удаление — отправка на склад</div>
                            </div>
                            <Button size="sm" className="shrink-0" onClick={() => workstation && onOpenAssignDialog(workstation.id)}>
                                <Plus className="mr-1.5 h-4 w-4" />
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
                                            <Button size="sm" variant="outline" onClick={() => workstation && onOpenAssignDialog(workstation.id)}>
                                                Назначить
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white text-slate-500 shadow-sm">
                                                    {renderEquipmentIcon(primaryEquipment.type)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="max-w-[420px] truncate text-sm font-semibold">{primaryEquipment.name}</p>
                                                        <Badge variant="outline" className="h-5 border-slate-200 bg-white px-1 text-[10px] font-normal text-slate-500">
                                                            {primaryEquipment.type_name || primaryEquipment.type}
                                                        </Badge>
                                                    </div>
                                                    <div className="truncate text-[10px] text-muted-foreground">{primaryEquipment.brand} {primaryEquipment.model}</div>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => onUnassignEquipment(primaryEquipment.id)}>
                                                <X className="mr-1.5 h-4 w-4" />
                                                На склад
                                            </Button>
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
                                    ) : peripheralEquipment.map(item => (
                                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-slate-50 text-slate-500">
                                                    {renderEquipmentIcon(item.type)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="max-w-[420px] truncate text-sm font-semibold text-slate-900">{item.name}</p>
                                                        <Badge variant="secondary" className="h-5 bg-slate-100 px-1.5 text-[10px] font-normal text-slate-600 hover:bg-slate-200">
                                                            {item.type_name || item.type}
                                                        </Badge>
                                                    </div>
                                                    <div className="truncate text-[10px] text-muted-foreground">{item.brand} {item.model}</div>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm" className="shrink-0" onClick={() => onUnassignEquipment(item.id)}>
                                                <X className="mr-1.5 h-4 w-4" />
                                                На склад
                                            </Button>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="maintenance" className="mt-4">
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                                                <div className="flex w-full items-center justify-between gap-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white text-slate-500 shadow-sm">
                                                            {renderEquipmentIcon(primaryEquipment.type)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-semibold">{primaryEquipment.name}</p>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="h-5 border-slate-200 bg-white px-1 text-[10px] font-normal text-slate-500">{primaryEquipment.type_name || primaryEquipment.type}</Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <Label htmlFor={`maintenance-${primaryEquipment.id}`} className="cursor-pointer text-xs text-muted-foreground">Обслуживание</Label>
                                                        <input
                                                            type="checkbox"
                                                            id={`maintenance-${primaryEquipment.id}`}
                                                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                            checked={primaryEquipment.maintenance_enabled !== false}
                                                            onChange={(e) => onToggleMaintenance(primaryEquipment.id, e.target.checked)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
                                                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                                                        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Посл. чистка</Label>
                                                        <Input type="date" className="h-9 w-full bg-white text-xs" value={lastCleanedDrafts[primaryEquipment.id] ?? ""} onChange={(e) => setLastCleanedDrafts(prev => ({ ...prev, [primaryEquipment.id]: e.target.value }))} />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Интервал (дн.)</Label>
                                                        <Input type="number" min={1} className="h-9 w-full bg-white text-xs" value={intervalDrafts[primaryEquipment.id] ?? String(primaryEquipment.cleaning_interval_days ?? 30)} onChange={(e) => setIntervalDrafts(prev => ({ ...prev, [primaryEquipment.id]: e.target.value }))} />
                                                    </div>
                                                    <div className="sm:col-span-3">
                                                        <Button
                                                            size="sm"
                                                            className="h-9 w-full bg-slate-900 text-white hover:bg-slate-800"
                                                            disabled={isSavingIntervalId === primaryEquipment.id}
                                                            onClick={() => onSaveInterval(primaryEquipment.id, {
                                                                intervalDays: parseInt(intervalDrafts[primaryEquipment.id] ?? String(primaryEquipment.cleaning_interval_days ?? 30), 10),
                                                                lastCleanedAt: lastCleanedDrafts[primaryEquipment.id] || null,
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
                                                    note: cpuThermalPasteNoteDrafts[primaryEquipment.id] || null,
                                                })}
                                            />
                                        )}
                                    </CardContent>
                                </Card>

                                {gpuEligible ? (
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
                                                note: gpuThermalPasteNoteDrafts[primaryEquipment.id] || null,
                                            })}
                                        />
                                    )
                                ) : null}
                            </div>

                            <Card className="border-slate-200">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Периферия</CardTitle>
                                    <CardDescription>Регулярность чистки для устройств на месте</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {peripheralEquipment.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">Периферия не назначена</div>
                                    ) : peripheralEquipment.map(item => (
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
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="issues" className="mt-4">
                        <Card className="border-slate-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <AlertTriangle className="h-4 w-4 text-slate-500" />
                                    История инцидентов
                                </CardTitle>
                                <CardDescription>Список всех проблем с оборудованием на этом месте</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isIssuesLoading ? (
                                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Загружаем инциденты…
                                    </div>
                                ) : workplaceIssues.length === 0 ? (
                                    <div className="rounded-lg border-2 border-dashed border-slate-100 py-8 text-center text-muted-foreground">
                                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50">
                                            <Check className="h-5 w-5 text-green-500" />
                                        </div>
                                        <p className="text-sm">Инцидентов не зафиксировано</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {workplaceIssues.map(issue => {
                                            const issueEquipment = equipmentById.get(issue.equipment_id)

                                            return (
                                                <div
                                                    key={issue.id}
                                                    className={cn(
                                                        "flex flex-col justify-between gap-4 rounded-lg border p-3 sm:flex-row sm:items-center",
                                                        (issue.status === "OPEN" || issue.status === "IN_PROGRESS")
                                                            ? "border-rose-100 bg-rose-50"
                                                            : "border-slate-100 bg-white"
                                                    )}
                                                >
                                                    <div className="flex min-w-0 items-start gap-3">
                                                        <div className={cn(
                                                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                                                            (issue.status === "OPEN" || issue.status === "IN_PROGRESS")
                                                                ? "border-rose-200 bg-white text-rose-500"
                                                                : "border-slate-200 bg-slate-50 text-slate-400"
                                                        )}>
                                                            {issueEquipment ? renderEquipmentIcon(issueEquipment.type) : <Wrench className="h-4 w-4" />}
                                                        </div>
                                                        <div className="min-w-0 space-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="truncate text-sm font-semibold text-slate-900">{issue.title}</p>
                                                                {renderIssueStatusBadge(issue.status)}
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                                                                <span className="font-medium text-slate-600">{issueEquipment?.name}</span>
                                                                <span>•</span>
                                                                <span>{new Date(issue.created_at).toLocaleDateString("ru-RU")}</span>
                                                                <span>•</span>
                                                                <span className="flex items-center gap-1">
                                                                    <User className="h-3 w-3" />
                                                                    {issue.reported_by_name}
                                                                </span>
                                                            </div>
                                                            {(issue.status === "OPEN" || issue.status === "IN_PROGRESS") ? (
                                                                <p className="line-clamp-1 text-xs text-rose-700">{issue.description}</p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        {issue.assigned_to_name && (issue.status === "OPEN" || issue.status === "IN_PROGRESS") ? (
                                                            <Badge variant="outline" className="bg-white font-normal text-slate-600">
                                                                <User className="mr-1 h-3 w-3" />
                                                                {issue.assigned_to_name}
                                                            </Badge>
                                                        ) : null}
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
