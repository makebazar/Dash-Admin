"use client"

import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
    AlertCircle,
    AlertTriangle,
    ArrowRightLeft,
    ArrowLeft,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    Shirt,
    Trash2,
    Wrench,
    X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { PageShell } from "@/components/layout/PageShell"
import { renderEquipmentIcon } from "@/lib/equipment-icons"
import type { Employee, Equipment, EquipmentType, Workstation } from "../types"
import AssignEquipmentDialog from "../AssignEquipmentDialog"
import WorkplaceFormDialog from "../WorkplaceFormDialog"

type HistoryActionType = "MAINTENANCE" | "REWORK" | "MOVE" | "ISSUE" | "LAUNDRY"
type HistoryFilter = "all" | "maintenance" | "move" | "issue" | "laundry"

interface HistoryLog {
    id: string
    action_type: HistoryActionType
    action: string
    date: string
    user_name: string | null
    details: string | null
    photos?: string[]
    equipment_id: string
    equipment_name: string
    equipment_type: string
}

interface LaundryHistoryRequest {
    id: string
    equipment_id: string
    equipment_name: string
    equipment_type: string
    equipment_type_name: string | null
    workstation_name: string | null
    zone_name: string | null
    requested_by_name: string | null
    processed_by_name: string | null
    source: "EMPLOYEE_SERVICE" | "INSPECTION_CENTER"
    status: "NEW" | "SENT_TO_LAUNDRY" | "READY_FOR_RETURN" | "RETURNED" | "CANCELLED"
    title: string
    description: string | null
    photos: string[] | null
    created_at: string
    completed_at: string | null
}

interface ThermalMaintenanceCardProps {
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
    disabled?: boolean
    disabledText?: string
}

const ThermalMaintenanceCard = memo(function ThermalMaintenanceCard({
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
    disabled = false,
    disabledText,
}: ThermalMaintenanceCardProps) {
    return (
        <div className={cn("rounded-lg border border-slate-200 bg-slate-50/60", disabled && "bg-slate-50/40")}>
            <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                onClick={onToggleOpen}
                disabled={disabled}
            >
                <div>
                    <p className={cn("text-sm font-medium text-slate-900", disabled && "text-slate-500")}>{summary}</p>
                    <p className="text-xs text-muted-foreground">
                        {disabled ? (disabledText || "Недоступно") : "Дата, интервал и материал"}
                    </p>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", isOpen && "rotate-180", disabled && "opacity-30")} />
            </button>

            {isOpen && !disabled ? (
                <div className="space-y-4 border-t border-slate-200 px-4 py-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Дата замены</Label>
                            <Input type="date" className="bg-white text-sm h-10 rounded-lg" value={dateValue} onChange={(e) => onDateChange(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Интервал (дней)</Label>
                            <Input
                                type="number"
                                min={1}
                                className="bg-white text-sm h-10 rounded-lg"
                                value={intervalValue}
                                onChange={(e) => onIntervalChange(e.target.value)}
                                placeholder="Например, 180"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Тип / материал</Label>
                            <Input className="bg-white text-sm h-10 rounded-lg" value={typeValue} onChange={(e) => onTypeChange(e.target.value)} placeholder={typePlaceholder} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Заметка</Label>
                            <Input className="bg-white text-sm h-10 rounded-lg" value={noteValue} onChange={(e) => onNoteChange(e.target.value)} placeholder={notePlaceholder} />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button size="sm" className="h-10 px-4 rounded-lg font-medium bg-slate-900 text-white hover:bg-slate-800" disabled={isSaving} onClick={onSave}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Сохранить
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    )
})

interface PeripheralMaintenanceItemProps {
    item: Equipment
    expanded: boolean
    lastCleanedValue: string
    isSaving: boolean
    renderEquipmentIcon: (type: string) => ReactNode
    onToggleExpanded: (id: string) => void
    onToggleMaintenance: (equipmentId: string, enabled: boolean) => Promise<void>
    onLastCleanedChange: (equipmentId: string, value: string) => void
    onSaveMaintenance: (equipmentId: string, payload: { lastCleanedAt: string | null }) => Promise<void>
}

const PeripheralMaintenanceItem = memo(function PeripheralMaintenanceItem({
    item,
    expanded,
    lastCleanedValue,
    isSaving,
    renderEquipmentIcon,
    onToggleExpanded,
    onToggleMaintenance,
    onLastCleanedChange,
    onSaveMaintenance,
}: PeripheralMaintenanceItemProps) {
    const maintenanceEnabled = item.maintenance_enabled !== false

    return (
        <div className="rounded-lg border border-slate-100 bg-white">
            <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-slate-50 text-slate-500">
                    {renderEquipmentIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="h-5 bg-slate-100 px-1.5 text-[10px] font-normal text-slate-600 hover:bg-slate-200">
                            {item.type_name || item.type}
                        </Badge>
                        {!maintenanceEnabled ? (
                            <span className="text-[10px] text-amber-700">Исключено из регламента</span>
                        ) : null}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Label htmlFor={`maintenance-toggle-${item.id}`} className="cursor-pointer text-xs text-muted-foreground">Обслуживать</Label>
                    <Switch
                        id={`maintenance-toggle-${item.id}`}
                        checked={item.maintenance_enabled !== false}
                        onCheckedChange={(checked) => onToggleMaintenance(item.id, checked)}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onToggleExpanded(item.id)}>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                    </Button>
                </div>
            </div>

            {expanded ? (
                <div className="border-t border-slate-100 px-3 py-4 sm:px-4">
                    {!maintenanceEnabled ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Для этого устройства обслуживание отключено. Чистка и напоминания по нему не ведутся, пока переключатель не включён.
                        </div>
                    ) : null}
                    <div className="grid grid-cols-1 items-end gap-3 xl:grid-cols-[minmax(0,1fr)_140px]">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Последняя чистка</Label>
                            <Input type="date" className="h-10 bg-white text-sm rounded-lg" disabled={!maintenanceEnabled} value={lastCleanedValue} onChange={(e) => onLastCleanedChange(item.id, e.target.value)} />
                        </div>
                        <div>
                            <Button
                                size="sm"
                                className="h-10 w-full rounded-lg font-medium bg-slate-900 text-white hover:bg-slate-800"
                                disabled={isSaving || !maintenanceEnabled}
                                onClick={() => onSaveMaintenance(item.id, { lastCleanedAt: lastCleanedValue || null })}
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Сохранить
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
})

export default function WorkstationDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const clubId = params.clubId as string
    const workstationId = params.workstationId as string

    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
    const [zones, setZones] = useState<string[]>([])
    const [instructionIntervalsByType, setInstructionIntervalsByType] = useState<Record<string, number>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [editingWorkplace, setEditingWorkplace] = useState<Partial<Workstation> | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
    const [pendingUnassignEquipmentId, setPendingUnassignEquipmentId] = useState<string | null>(null)
    const [pendingDeleteWorkstationId, setPendingDeleteWorkstationId] = useState<string | null>(null)
    const [isUnassigningEquipmentId, setIsUnassigningEquipmentId] = useState<string | null>(null)
    const [isAssigningWorkstationId, setIsAssigningWorkstationId] = useState<string | null>(null)
    const [deletingWorkstationId, setDeletingWorkstationId] = useState<string | null>(null)
    const [savingMaintenanceId, setSavingMaintenanceId] = useState<string | null>(null)
    const [savingCpuThermalId, setSavingCpuThermalId] = useState<string | null>(null)
    const [savingGpuThermalId, setSavingGpuThermalId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<"equipment" | "maintenance" | "history">("equipment")
    const [history, setHistory] = useState<HistoryLog[]>([])
    const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all")
    const [historyEquipmentFilter, setHistoryEquipmentFilter] = useState<string>("all")
    const [historyPhotoViewer, setHistoryPhotoViewer] = useState<{ images: string[]; index: number } | null>(null)
    const [isHistoryLoading, setIsHistoryLoading] = useState(false)
    const [lastCleanedDrafts, setLastCleanedDrafts] = useState<Record<string, string>>({})
    const [cleaningIntervalDrafts, setCleaningIntervalDrafts] = useState<Record<string, string>>({})
    const [cpuThermalPasteDateDrafts, setCpuThermalPasteDateDrafts] = useState<Record<string, string>>({})
    const [cpuThermalPasteIntervalDrafts, setCpuThermalPasteIntervalDrafts] = useState<Record<string, string>>({})
    const [cpuThermalPasteTypeDrafts, setCpuThermalPasteTypeDrafts] = useState<Record<string, string>>({})
    const [cpuThermalPasteNoteDrafts, setCpuThermalPasteNoteDrafts] = useState<Record<string, string>>({})
    const [gpuThermalPasteDateDrafts, setGpuThermalPasteDateDrafts] = useState<Record<string, string>>({})
    const [gpuThermalPasteIntervalDrafts, setGpuThermalPasteIntervalDrafts] = useState<Record<string, string>>({})
    const [gpuThermalPasteTypeDrafts, setGpuThermalPasteTypeDrafts] = useState<Record<string, string>>({})
    const [gpuThermalPasteNoteDrafts, setGpuThermalPasteNoteDrafts] = useState<Record<string, string>>({})
    const [expandedPeripheralIds, setExpandedPeripheralIds] = useState<Record<string, boolean>>({})
    const [isCpuSectionOpen, setIsCpuSectionOpen] = useState(false)
    const [isGpuSectionOpen, setIsGpuSectionOpen] = useState(false)

    const equipmentById = useMemo(() => new Map(equipment.map(item => [item.id, item])), [equipment])
    const workstation = useMemo(() => workstations.find(item => item.id === workstationId) || null, [workstations, workstationId])
    const attachedEquipment = useMemo(() => equipment.filter(item => item.workstation_id === workstationId), [equipment, workstationId])
    const primaryEquipment = useMemo(() => attachedEquipment.find(item => item.type === "PC" || item.type === "CONSOLE" || item.type === "TV") || null, [attachedEquipment])
    const peripheralEquipment = useMemo(() => attachedEquipment.filter(item => item.id !== primaryEquipment?.id), [attachedEquipment, primaryEquipment?.id])
    const thermalEligible = primaryEquipment?.type === "PC" || primaryEquipment?.type === "CONSOLE"
    const gpuEligible = primaryEquipment?.type === "PC"
    const primaryLabel = primaryEquipment?.type === "CONSOLE" ? "Игровая консоль" : primaryEquipment?.type === "TV" ? "Телевизор" : "Компьютер"
    const primaryDescription = primaryEquipment?.type === "CONSOLE" ? "Основное устройство места" : primaryEquipment?.type === "TV" ? "Основной экран/TV" : "Основной системный блок места"
    const employeeNameById = useMemo(() => new Map(employees.map(employee => [employee.id, employee.full_name])), [employees])
    const pendingUnassignEquipment = useMemo(() => pendingUnassignEquipmentId ? (equipmentById.get(pendingUnassignEquipmentId) ?? null) : null, [equipmentById, pendingUnassignEquipmentId])
    const pendingDeleteWorkstation = useMemo(() => pendingDeleteWorkstationId ? (workstations.find(item => item.id === pendingDeleteWorkstationId) ?? null) : null, [pendingDeleteWorkstationId, workstations])
    const pendingDeleteAttachedEquipment = useMemo(() => {
        if (!pendingDeleteWorkstationId) return []
        return equipment.filter(item => item.workstation_id === pendingDeleteWorkstationId)
    }, [equipment, pendingDeleteWorkstationId])

    useEffect(() => {
        const nextLastCleaned: Record<string, string> = {}
        const nextCleaningIntervals: Record<string, string> = {}
        const nextCpuDate: Record<string, string> = {}
        const nextCpuInterval: Record<string, string> = {}
        const nextCpuType: Record<string, string> = {}
        const nextCpuNote: Record<string, string> = {}
        const nextGpuDate: Record<string, string> = {}
        const nextGpuInterval: Record<string, string> = {}
        const nextGpuType: Record<string, string> = {}
        const nextGpuNote: Record<string, string> = {}

        attachedEquipment.forEach((item) => {
            nextLastCleaned[item.id] = item.last_cleaned_at ? item.last_cleaned_at.slice(0, 10) : ""
            nextCleaningIntervals[item.id] = item.cleaning_interval_days ? String(item.cleaning_interval_days) : ""
            nextCpuDate[item.id] = item.cpu_thermal_paste_last_changed_at ? item.cpu_thermal_paste_last_changed_at.slice(0, 10) : ""
            nextCpuInterval[item.id] = item.cpu_thermal_paste_interval_days ? String(item.cpu_thermal_paste_interval_days) : ""
            nextCpuType[item.id] = item.cpu_thermal_paste_type ?? ""
            nextCpuNote[item.id] = item.cpu_thermal_paste_note ?? ""
            nextGpuDate[item.id] = item.gpu_thermal_paste_last_changed_at ? item.gpu_thermal_paste_last_changed_at.slice(0, 10) : ""
            nextGpuInterval[item.id] = item.gpu_thermal_paste_interval_days ? String(item.gpu_thermal_paste_interval_days) : ""
            nextGpuType[item.id] = item.gpu_thermal_paste_type ?? ""
            nextGpuNote[item.id] = item.gpu_thermal_paste_note ?? ""
        })

        setLastCleanedDrafts(nextLastCleaned)
        setCleaningIntervalDrafts(nextCleaningIntervals)
        setCpuThermalPasteDateDrafts(nextCpuDate)
        setCpuThermalPasteIntervalDrafts(nextCpuInterval)
        setCpuThermalPasteTypeDrafts(nextCpuType)
        setCpuThermalPasteNoteDrafts(nextCpuNote)
        setGpuThermalPasteDateDrafts(nextGpuDate)
        setGpuThermalPasteIntervalDrafts(nextGpuInterval)
        setGpuThermalPasteTypeDrafts(nextGpuType)
        setGpuThermalPasteNoteDrafts(nextGpuNote)
    }, [attachedEquipment])

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [workplacesRes, employeesRes, typesRes, instructionsRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/workplaces`, { cache: "no-store" }),
                fetch(`/api/clubs/${clubId}/employees`, { cache: "no-store" }),
                fetch(`/api/clubs/${clubId}/equipment-types`, { cache: "no-store" }),
                fetch(`/api/clubs/${clubId}/equipment-instructions`, { cache: "no-store" }),
            ])

            const workplacesData = await workplacesRes.json()
            const employeesData = await employeesRes.json()
            const typesData = await typesRes.json()
            const instructionsData = await instructionsRes.json()

            setWorkstations(workplacesData.workstations || [])
            setEquipment(workplacesData.equipment || [])
            setZones((workplacesData.zones || []).map((zone: { name: string }) => zone.name))
            setEmployees(employeesData.employees || [])
            setEquipmentTypes(typesData || [])
            setInstructionIntervalsByType(
                Array.isArray(instructionsData)
                    ? instructionsData.reduce((acc: Record<string, number>, item: any) => {
                        if (item?.equipment_type_code && item?.default_interval_days) {
                            acc[item.equipment_type_code] = Number(item.default_interval_days)
                        }
                        return acc
                    }, {})
                    : {}
            )
        } catch (error) {
            console.error("Error loading workstation details:", error)
        } finally {
            setIsLoading(false)
        }
    }, [clubId])

    const fetchHistory = useCallback(async () => {
        if (attachedEquipment.length === 0) {
            setHistory([])
            return
        }

        setIsHistoryLoading(true)
        try {
            const equipmentIds = new Set(attachedEquipment.map(item => item.id))
            const [historyResults, activeLaundryRes, historyLaundryRes] = await Promise.all([
                Promise.all(
                attachedEquipment.map(async (item) => {
                    const res = await fetch(`/api/clubs/${clubId}/equipment/${item.id}/history`, { cache: "no-store" })
                    const data = await res.json().catch(() => [])
                    if (!res.ok || !Array.isArray(data)) return []
                    return data.map((log: any) => ({
                        ...log,
                        equipment_id: item.id,
                        equipment_name: item.name,
                        equipment_type: item.type_name || item.type,
                    }))
                })
                ),
                fetch(`/api/clubs/${clubId}/laundry?status=active`, { cache: "no-store" }),
                fetch(`/api/clubs/${clubId}/laundry?status=history`, { cache: "no-store" })
            ])

            const activeLaundry = await activeLaundryRes.json().catch(() => [])
            const historyLaundry = await historyLaundryRes.json().catch(() => [])
            const laundryRequests = [...(Array.isArray(activeLaundry) ? activeLaundry : []), ...(Array.isArray(historyLaundry) ? historyLaundry : [])]
                .filter((item: LaundryHistoryRequest) => equipmentIds.has(item.equipment_id))

            const laundryLogs: HistoryLog[] = laundryRequests.map((item) => {
                const statusLabel =
                    item.status === "NEW" ? "Новая заявка" :
                    item.status === "SENT_TO_LAUNDRY" ? "Передано в стирку" :
                    item.status === "READY_FOR_RETURN" ? "Готово к возврату" :
                    item.status === "RETURNED" ? "Возвращено" :
                    "Отменено"

                const eventDate = item.completed_at || item.created_at
                const actorName = item.processed_by_name || item.requested_by_name || null
                const details = [item.title, item.description].filter(Boolean).join("\n")

                return {
                    id: `laundry-${item.id}`,
                    action_type: "LAUNDRY",
                    action: `Стирка: ${statusLabel}`,
                    date: eventDate,
                    user_name: actorName,
                    details: details || null,
                    photos: item.photos || undefined,
                    equipment_id: item.equipment_id,
                    equipment_name: item.equipment_name,
                    equipment_type: item.equipment_type_name || item.equipment_type,
                }
            })

            setHistory(
                [...historyResults.flat(), ...laundryLogs]
                    .flat()
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            )
        } catch (error) {
            console.error("Error fetching workstation history:", error)
            setHistory([])
        } finally {
            setIsHistoryLoading(false)
        }
    }, [attachedEquipment, clubId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (activeTab === "history") {
            fetchHistory()
        }
    }, [activeTab, fetchHistory])

    const mergeEquipmentState = useCallback((equipmentId: string, patch: Partial<Equipment>) => {
        setEquipment(prev => prev.map(item => item.id === equipmentId ? { ...item, ...patch } : item))
    }, [])

    const getStandardCleaningInterval = useCallback((type: string) => {
        return instructionIntervalsByType[type]
            || equipmentTypes.find(item => item.code === type)?.default_cleaning_interval
            || 30
    }, [equipmentTypes, instructionIntervalsByType])

    const filteredHistory = useMemo(() => {
        const byType = historyFilter === "all"
            ? history
            : history.filter(log => {
            if (historyFilter === "maintenance") {
                return log.action_type === "MAINTENANCE" || log.action_type === "REWORK"
            }
            if (historyFilter === "move") {
                return log.action_type === "MOVE"
            }
            if (historyFilter === "laundry") {
                return log.action_type === "LAUNDRY"
            }
            return log.action_type === "ISSUE"
        })

        if (historyEquipmentFilter === "all") return byType
        return byType.filter(log => log.equipment_id === historyEquipmentFilter)
    }, [history, historyEquipmentFilter, historyFilter])

    const historyEquipmentOptions = useMemo(() => {
        const seen = new Map<string, { id: string; name: string; type: string }>()
        for (const item of history) {
            if (!seen.has(item.equipment_id)) {
                seen.set(item.equipment_id, {
                    id: item.equipment_id,
                    name: item.equipment_name,
                    type: item.equipment_type,
                })
            }
        }
        return Array.from(seen.values())
    }, [history])

    const groupedHistory = useMemo(() => {
        return filteredHistory.reduce<Array<{ label: string; items: HistoryLog[] }>>((groups, log) => {
            const itemDate = new Date(log.date)
            const today = new Date()
            const yesterday = new Date()
            yesterday.setDate(today.getDate() - 1)

            const isSameDay = (a: Date, b: Date) =>
                a.getFullYear() === b.getFullYear() &&
                a.getMonth() === b.getMonth() &&
                a.getDate() === b.getDate()

            const label = isSameDay(itemDate, today)
                ? "Сегодня"
                : isSameDay(itemDate, yesterday)
                    ? "Вчера"
                    : itemDate.toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: today.getFullYear() === itemDate.getFullYear() ? undefined : "numeric",
                    })

            const existingGroup = groups.find(group => group.label === label)
            if (existingGroup) {
                existingGroup.items.push(log)
            } else {
                groups.push({ label, items: [log] })
            }

            return groups
        }, [])
    }, [filteredHistory])

    const mergeWorkstationState = useCallback((nextWorkstationId: string, patch: Partial<Workstation>) => {
        setWorkstations(prev => prev.map(item => item.id === nextWorkstationId ? { ...item, ...patch } : item))
    }, [])

    const handleEdit = useCallback((workplace: Workstation) => {
        setEditingWorkplace(workplace)
        setIsDialogOpen(true)
    }, [])

    const closeWorkplaceDialog = useCallback(() => {
        setIsDialogOpen(false)
        setEditingWorkplace(null)
    }, [])

    const handleSave = useCallback(async (draft: Partial<Workstation>) => {
        setIsSaving(true)
        try {
            const method = draft.id ? "PATCH" : "POST"
            const endpoint = draft.id
                ? `/api/clubs/${clubId}/workstations/${draft.id}`
                : `/api/clubs/${clubId}/workstations`

            const res = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: draft.name,
                    zone: draft.zone,
                    assigned_user_id: draft.assigned_user_id || null,
                })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось сохранить место")
            }

            await fetchData()
            closeWorkplaceDialog()
        } catch (error) {
            console.error("Error saving workplace:", error)
            alert(error instanceof Error ? error.message : "Ошибка сохранения места")
        } finally {
            setIsSaving(false)
        }
    }, [clubId, closeWorkplaceDialog, fetchData])

    const handleAssignEquipment = useCallback(async (equipmentId: string) => {
        const previousWorkstationId = equipmentById.get(equipmentId)?.workstation_id ?? null

        const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workstation_id: workstationId })
        })

        if (!res.ok) {
            const data = await res.json().catch(() => null)
            throw new Error(data?.error || "Не удалось назначить оборудование")
        }

        const updatedEquipment = await res.json()
        mergeEquipmentState(equipmentId, {
            ...updatedEquipment,
            maintenance_enabled: updatedEquipment.maintenance_enabled !== false
        })

        if (previousWorkstationId && previousWorkstationId !== workstationId) {
            await fetchData()
        }
    }, [clubId, equipmentById, fetchData, mergeEquipmentState, workstationId])

    const handleUnassignEquipment = useCallback((equipmentId: string) => {
        setPendingUnassignEquipmentId(equipmentId)
    }, [])

    const confirmUnassignEquipment = useCallback(async () => {
        if (!pendingUnassignEquipmentId) return

        setIsUnassigningEquipmentId(pendingUnassignEquipmentId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${pendingUnassignEquipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workstation_id: null })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось снять оборудование с места")
            }

            const updatedEquipment = await res.json()
            mergeEquipmentState(pendingUnassignEquipmentId, {
                ...updatedEquipment,
                maintenance_enabled: updatedEquipment.maintenance_enabled !== false
            })
            setPendingUnassignEquipmentId(null)
        } catch (error) {
            console.error("Error unassigning equipment:", error)
            alert(error instanceof Error ? error.message : "Ошибка снятия оборудования с места")
        } finally {
            setIsUnassigningEquipmentId(null)
        }
    }, [clubId, mergeEquipmentState, pendingUnassignEquipmentId])

    const handleToggleMaintenance = useCallback(async (equipmentId: string, enabled: boolean) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    maintenance_enabled: enabled
                })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось обновить обслуживание")
            }

            const updatedEquipment = await res.json()
            mergeEquipmentState(equipmentId, {
                ...updatedEquipment,
                maintenance_enabled: updatedEquipment.maintenance_enabled !== false
            })
        } catch (error) {
            console.error("Error toggling maintenance:", error)
            alert(error instanceof Error ? error.message : "Ошибка изменения обслуживания")
        }
    }, [clubId, mergeEquipmentState])

    const handleSaveMaintenance = useCallback(async (equipmentId: string, payload: { lastCleanedAt: string | null; cleaningIntervalOverrideDays?: number | null }) => {
        setSavingMaintenanceId(equipmentId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    last_cleaned_at: payload.lastCleanedAt,
                    cleaning_interval_override_days: payload.cleaningIntervalOverrideDays
                })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось сохранить настройки обслуживания")
            }

            const updatedEquipment = await res.json()
            mergeEquipmentState(equipmentId, updatedEquipment)
        } catch (error) {
            console.error("Error updating maintenance date:", error)
            alert(error instanceof Error ? error.message : "Ошибка сохранения настроек обслуживания")
        } finally {
            setSavingMaintenanceId(null)
        }
    }, [clubId, mergeEquipmentState])

    const handleResetCleaningInterval = useCallback(async (equipmentId: string, type: string, lastCleanedAt: string | null) => {
        const standardInterval = getStandardCleaningInterval(type)
        setCleaningIntervalDrafts(prev => ({ ...prev, [equipmentId]: String(standardInterval) }))
        await handleSaveMaintenance(equipmentId, {
            lastCleanedAt,
            cleaningIntervalOverrideDays: null
        })
    }, [getStandardCleaningInterval, handleSaveMaintenance])

    const handleCpuThermalSave = useCallback(async (equipmentId: string, payload: { changedAt: string | null; intervalDays: number | null; type: string | null; note: string | null }) => {
        setSavingCpuThermalId(equipmentId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cpu_thermal_paste_last_changed_at: payload.changedAt,
                    cpu_thermal_paste_interval_days: payload.intervalDays,
                    cpu_thermal_paste_type: payload.type,
                    cpu_thermal_paste_note: payload.note
                })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось сохранить CPU-обслуживание")
            }

            const updatedEquipment = await res.json()
            mergeEquipmentState(equipmentId, updatedEquipment)
        } catch (error) {
            console.error("Error updating CPU maintenance:", error)
        } finally {
            setSavingCpuThermalId(null)
        }
    }, [clubId, mergeEquipmentState])

    const handleGpuThermalSave = useCallback(async (equipmentId: string, payload: { changedAt: string | null; intervalDays: number | null; type: string | null; note: string | null }) => {
        setSavingGpuThermalId(equipmentId)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gpu_thermal_paste_last_changed_at: payload.changedAt,
                    gpu_thermal_paste_interval_days: payload.intervalDays,
                    gpu_thermal_paste_type: payload.type,
                    gpu_thermal_paste_note: payload.note
                })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось сохранить GPU-обслуживание")
            }

            const updatedEquipment = await res.json()
            mergeEquipmentState(equipmentId, updatedEquipment)
        } catch (error) {
            console.error("Error updating GPU maintenance:", error)
        } finally {
            setSavingGpuThermalId(null)
        }
    }, [clubId, mergeEquipmentState])

    const handleAssignWorkstation = useCallback(async (userId: string | null) => {
        if (!workstation) return

        setIsAssigningWorkstationId(workstation.id)
        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations/${workstation.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assigned_user_id: userId })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось назначить ответственного")
            }

            const updatedWorkstation = await res.json()
            mergeWorkstationState(workstation.id, {
                ...updatedWorkstation,
                assigned_user_name: userId ? (employeeNameById.get(userId) ?? null) : null
            })
        } catch (error) {
            console.error("Error assigning workstation:", error)
        } finally {
            setIsAssigningWorkstationId(null)
        }
    }, [clubId, employeeNameById, mergeWorkstationState, workstation])

    const requestDeleteWorkstation = useCallback((targetWorkstationId: string) => {
        setPendingDeleteWorkstationId(targetWorkstationId)
    }, [])

    const handleDeleteWorkstation = useCallback(async (targetWorkstationId: string) => {
        const targetWorkstation = workstations.find(item => item.id === targetWorkstationId)
        const attached = equipment.filter(item => item.workstation_id === targetWorkstationId)

        setDeletingWorkstationId(targetWorkstationId)
        try {
            if (attached.length > 0) {
                await Promise.all(attached.map(async (item) => {
                    const res = await fetch(`/api/clubs/${clubId}/equipment/${item.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ workstation_id: null })
                    })

                    if (!res.ok) {
                        const data = await res.json().catch(() => null)
                        throw new Error(data?.error || `Не удалось снять оборудование "${item.name}" с места`)
                    }
                }))
            }

            const res = await fetch(`/api/clubs/${clubId}/workstations/${targetWorkstationId}`, {
                method: "DELETE"
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось удалить рабочее место")
            }

            setPendingDeleteWorkstationId(null)
            router.push(`/clubs/${clubId}/equipment/workplaces`)
        } catch (error) {
            console.error("Error deleting workplace:", error)
            alert(error instanceof Error ? error.message : `Ошибка удаления места "${targetWorkstation?.name || "Без названия"}"`)
        } finally {
            setDeletingWorkstationId(null)
        }
    }, [clubId, equipment, router, workstations])

    const getMaintenanceActionLabel = useCallback((action: string) => {
        switch (action) {
            case "CLEANING":
                return "Плановое обслуживание"
            case "REPAIR":
                return "Ремонт"
            case "INSPECTION":
                return "Проверка"
            case "REPLACEMENT":
                return "Замена"
            default:
                return action
        }
    }, [])

    const getHistoryPresentation = useCallback((log: HistoryLog) => {
        if (log.action_type === "MAINTENANCE") {
            return {
                icon: <Wrench className="h-4 w-4" />,
                badgeLabel: "Обслуживание",
                badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
                title: getMaintenanceActionLabel(log.action),
                description: log.details?.trim() || "Задача обслуживания выполнена без дополнительного комментария.",
            }
        }

        if (log.action_type === "MOVE") {
            return {
                icon: <ArrowRightLeft className="h-4 w-4" />,
                badgeLabel: "Перемещение",
                badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
                title: "Перемещение оборудования",
                description: log.details?.trim() || "Оборудование было перемещено без указанной причины.",
            }
        }

        if (log.action_type === "REWORK") {
            return {
                icon: <RefreshCw className="h-4 w-4" />,
                badgeLabel: "Доработка",
                badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
                title: `Отправлено на доработку: ${getMaintenanceActionLabel(log.action)}`,
                description: log.details?.trim() || "Задача возвращена на доработку без указанного комментария.",
            }
        }

        if (log.action_type === "LAUNDRY") {
            return {
                icon: <Shirt className="h-4 w-4" />,
                badgeLabel: "Стирка",
                badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
                title: log.action,
                description: log.details?.trim() || "Событие по стирке зафиксировано без дополнительного описания.",
            }
        }

        return {
            icon: <AlertCircle className="h-4 w-4" />,
            badgeLabel: "Инцидент",
            badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
            title: log.action,
            description: log.details?.trim() || "Инцидент зафиксирован без подробного описания.",
        }
    }, [getMaintenanceActionLabel])

    const formatHistoryTime = useCallback((date: string) =>
        new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), [])

    const openHistoryPhotoViewer = useCallback((images: string[], index: number) => {
        setHistoryPhotoViewer({ images, index })
    }, [])

    const closeHistoryPhotoViewer = useCallback(() => {
        setHistoryPhotoViewer(null)
    }, [])

    const showNextHistoryPhoto = useCallback(() => {
        setHistoryPhotoViewer(prev => {
            if (!prev) return prev
            return { ...prev, index: Math.min(prev.index + 1, prev.images.length - 1) }
        })
    }, [])

    const showPrevHistoryPhoto = useCallback(() => {
        setHistoryPhotoViewer(prev => {
            if (!prev) return prev
            return { ...prev, index: Math.max(prev.index - 1, 0) }
        })
    }, [])

    const getEquipmentIcon = useCallback((type: string) => renderEquipmentIcon(type, null, "h-4 w-4"), [])

    if (isLoading) {
        return (
            <PageShell maxWidth="5xl">
                <div className="flex h-[40vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
                </div>
            </PageShell>
        )
    }

    if (!workstation) {
        return (
            <PageShell maxWidth="5xl">
                <div className="space-y-6">
                    <Button asChild variant="outline" className="rounded-xl h-11 px-6 font-medium">
                        <Link href={`/clubs/${clubId}/equipment/workplaces`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад к местам
                        </Link>
                    </Button>
                    <div className="border-dashed border-2 border-slate-200 rounded-3xl bg-slate-50/50">
                        <div className="py-16 text-center text-muted-foreground">
                            Рабочее место не найдено
                        </div>
                    </div>
                </div>
            </PageShell>
        )
    }

    return (
        <PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                <Button asChild variant="outline" className="hidden md:inline-flex rounded-xl h-11 px-6 font-medium">
                    <Link href={`/clubs/${clubId}/equipment/workplaces`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Назад
                    </Link>
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="flex-1 md:flex-none rounded-xl h-11 px-6 font-medium" onClick={() => handleEdit(workstation)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Изменить название
                    </Button>
                    <Button
                        variant="outline"
                        className="flex-1 md:flex-none border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl h-11 px-6 font-medium"
                        disabled={deletingWorkstationId === workstation.id}
                        onClick={() => requestDeleteWorkstation(workstation.id)}
                    >
                        {deletingWorkstationId === workstation.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Удалить место
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
                    <div className="p-6 sm:p-8">
                        <div className="flex flex-col gap-4">
                            <div className="min-w-0">
                                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">{workstation.name}</h1>
                                <p className="text-slate-500 text-lg mt-2">Карточка рабочего места и привязанного оборудования</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary" className="h-7 rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100">
                                    Зона: {workstation.zone}
                                </Badge>
                                <Badge variant="secondary" className="h-7 rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100">
                                    {attachedEquipment.length} устройств
                                </Badge>
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        "h-7 rounded-full px-3 text-xs font-medium hover:bg-transparent",
                                        workstation.assigned_user_name
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-amber-50 text-amber-700"
                                    )}
                                >
                                    {workstation.assigned_user_name ? `Ответственный: ${workstation.assigned_user_name}` : "Ответственный не назначен"}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
                    <div className="space-y-6 p-6 sm:p-8">
                        <div className="space-y-2">
                            <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Ответственный</Label>
                            <Select
                                value={workstation.assigned_user_id || "none"}
                                onValueChange={(value) => handleAssignWorkstation(value === "none" ? null : value)}
                                disabled={isAssigningWorkstationId === workstation.id}
                            >
                                <SelectTrigger className="w-full h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white">
                                    <SelectValue placeholder="Не назначено" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Не назначено</SelectItem>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Выбранный сотрудник становится ответственным за это место. Это помогает понимать, кто обслуживает рабочее место и за кем закреплён его комплект оборудования.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "equipment" | "maintenance" | "history")} className="pt-0">
                    <TabsList className="h-auto w-full justify-start gap-8 overflow-x-auto rounded-none border-b border-slate-200 bg-transparent p-0 mb-8">
                        <TabsTrigger value="equipment" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent">Оборудование</TabsTrigger>
                        <TabsTrigger value="maintenance" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent">Обслуживание</TabsTrigger>
                        <TabsTrigger value="history" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent">История</TabsTrigger>
                    </TabsList>

                    <TabsContent value="equipment" className="mt-0">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">Оборудование на месте</div>
                                <div className="truncate text-xs text-muted-foreground">Добавляй со склада или отвязывай оборудование от этого места</div>
                            </div>
                            <Button className="w-full shrink-0 sm:w-auto rounded-xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => setIsAssignDialogOpen(true)}>
                                <Plus className="mr-1.5 h-4 w-4" />
                                Добавить
                            </Button>
                        </div>

                        <div className="mt-4 space-y-4">
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
                                <div className="p-6 sm:p-8 pb-4">
                                    <h3 className="text-lg font-bold text-slate-900">{primaryLabel}</h3>
                                    <p className="text-sm text-slate-500 mt-1">{primaryDescription}</p>
                                </div>
                                <div className="p-6 sm:p-8 pt-0">
                                    {!primaryEquipment ? (
                                        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="text-sm text-muted-foreground">Основное устройство не назначено</div>
                                            <Button variant="outline" className="w-full sm:w-auto rounded-xl font-medium" onClick={() => setIsAssignDialogOpen(true)}>
                                                Назначить
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white text-slate-500 shadow-sm">
                                                    {getEquipmentIcon(primaryEquipment.type)}
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
                                            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => handleUnassignEquipment(primaryEquipment.id)}>
                                                <X className="mr-1.5 h-4 w-4" />
                                                Отвязать
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
                                <div className="p-6 sm:p-8 pb-4">
                                    <h3 className="text-lg font-bold text-slate-900">Периферия</h3>
                                    <p className="text-sm text-slate-500 mt-1">Устройства, привязанные к месту</p>
                                </div>
                                <div className="space-y-4 p-6 sm:p-8 pt-0">
                                    {peripheralEquipment.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">Периферия не назначена</div>
                                    ) : peripheralEquipment.map(item => (
                                        <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-slate-50 text-slate-500">
                                                    {getEquipmentIcon(item.type)}
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
                                            <Button variant="outline" size="sm" className="w-full shrink-0 sm:w-auto" onClick={() => handleUnassignEquipment(item.id)}>
                                                <X className="mr-1.5 h-4 w-4" />
                                                Отвязать
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="maintenance" className="mt-0">
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                            <div className="space-y-6">
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
                                    <div className="p-6 sm:p-8 pb-4">
                                        <h3 className="text-lg font-bold text-slate-900">{primaryLabel}</h3>
                                        <p className="text-sm text-slate-500 mt-1">{primaryDescription}</p>
                                    </div>
                                    <div className="space-y-6 p-6 sm:p-8 pt-0">
                                        {!primaryEquipment ? (
                                            <div className="text-sm text-muted-foreground">Основное устройство не назначено</div>
                                        ) : (
                                            (() => {
                                                const standardInterval = getStandardCleaningInterval(primaryEquipment.type)
                                                const currentIntervalDraft = cleaningIntervalDrafts[primaryEquipment.id] ?? String(primaryEquipment.cleaning_interval_days ?? standardInterval)
                                                const isCustomInterval = primaryEquipment.cleaning_interval_override_days != null

                                                return (
                                            <div className="flex flex-col gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white text-slate-500 shadow-sm">
                                                            {getEquipmentIcon(primaryEquipment.type)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-semibold">{primaryEquipment.name}</p>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="h-5 border-slate-200 bg-white px-1 text-[10px] font-normal text-slate-500">{primaryEquipment.type_name || primaryEquipment.type}</Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="rounded-lg border bg-white px-3 py-2.5">
                                                        <div className="flex shrink-0 items-center gap-2">
                                                            <Label htmlFor={`maintenance-${primaryEquipment.id}`} className="cursor-pointer text-xs font-medium text-slate-700">Обслуживать</Label>
                                                            <Switch
                                                                id={`maintenance-${primaryEquipment.id}`}
                                                                checked={primaryEquipment.maintenance_enabled !== false}
                                                                onCheckedChange={(checked) => handleToggleMaintenance(primaryEquipment.id, checked)}
                                                            />
                                                        </div>
                                                        <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">
                                                            {primaryEquipment.maintenance_enabled !== false
                                                                ? "Устройство участвует в регламенте чистки и сервисных работах."
                                                                : "Устройство исключено из регламента и не будет попадать в обслуживание."}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-[160px_100px_minmax(0,1fr)]">
                                                    <div className="flex flex-col gap-1.5">
                                                        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Посл. чистка</Label>
                                                        <Input type="date" disabled={primaryEquipment.maintenance_enabled === false} className="h-10 w-full bg-white text-sm rounded-lg" value={lastCleanedDrafts[primaryEquipment.id] ?? ""} onChange={(e) => setLastCleanedDrafts(prev => ({ ...prev, [primaryEquipment.id]: e.target.value }))} />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Интервал (дн.)</Label>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            disabled={primaryEquipment.maintenance_enabled === false}
                                                            className="h-10 bg-white text-sm rounded-lg"
                                                            value={currentIntervalDraft}
                                                            onChange={(e) => setCleaningIntervalDrafts(prev => ({ ...prev, [primaryEquipment.id]: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                                                        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Статус</Label>
                                                        <div className="flex h-10 items-center rounded-lg border bg-white px-3 text-sm text-slate-600 truncate">
                                                            {isCustomInterval ? `Индивидуально • станд. ${standardInterval} дн.` : `По стандарту • ${standardInterval} дн.`}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3 mt-2 border-t border-slate-100 pt-4">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-10 px-6 rounded-lg"
                                                            disabled={savingMaintenanceId === primaryEquipment.id || primaryEquipment.maintenance_enabled === false || !isCustomInterval}
                                                            onClick={() => handleResetCleaningInterval(primaryEquipment.id, primaryEquipment.type, lastCleanedDrafts[primaryEquipment.id] || null)}
                                                        >
                                                            Сброс
                                                        </Button>
                                                        <Button size="sm" className="h-10 px-6 rounded-lg bg-slate-900 text-white hover:bg-slate-800" disabled={savingMaintenanceId === primaryEquipment.id || primaryEquipment.maintenance_enabled === false} onClick={() => handleSaveMaintenance(primaryEquipment.id, {
                                                            lastCleanedAt: lastCleanedDrafts[primaryEquipment.id] || null,
                                                            cleaningIntervalOverrideDays: currentIntervalDraft && parseInt(currentIntervalDraft, 10) !== standardInterval
                                                                ? parseInt(currentIntervalDraft, 10)
                                                                : null
                                                        })}>
                                                            {savingMaintenanceId === primaryEquipment.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                            Сохранить
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                                )
                                            })()
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
                                    <div className="p-6 sm:p-8 pb-4">
                                        <h3 className="text-lg font-bold text-slate-900">Термосервис</h3>
                                        <p className="text-sm text-slate-500 mt-1">CPU и GPU обслуживание основного устройства</p>
                                    </div>
                                    <div className="space-y-6 p-6 sm:p-8 pt-0">
                                        {!primaryEquipment ? (
                                            <div className="text-sm text-muted-foreground">Основное устройство не назначено</div>
                                        ) : !thermalEligible ? (
                                            <div className="text-sm text-muted-foreground">Термосервис доступен только для ПК и консолей</div>
                                        ) : (
                                            <div className="space-y-3">
                                                <ThermalMaintenanceCard
                                                    summary="Настройки CPU"
                                                    isOpen={isCpuSectionOpen}
                                                    onToggleOpen={() => setIsCpuSectionOpen(current => !current)}
                                                    dateValue={cpuThermalPasteDateDrafts[primaryEquipment.id] ?? ""}
                                                    intervalValue={cpuThermalPasteIntervalDrafts[primaryEquipment.id] ?? ""}
                                                    typeValue={cpuThermalPasteTypeDrafts[primaryEquipment.id] ?? ""}
                                                    noteValue={cpuThermalPasteNoteDrafts[primaryEquipment.id] ?? ""}
                                                    typePlaceholder="Arctic MX-4"
                                                    notePlaceholder="Например, жидкий металл"
                                                    isSaving={savingCpuThermalId === primaryEquipment.id}
                                                    onDateChange={(value) => setCpuThermalPasteDateDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                    onIntervalChange={(value) => setCpuThermalPasteIntervalDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                    onTypeChange={(value) => setCpuThermalPasteTypeDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                    onNoteChange={(value) => setCpuThermalPasteNoteDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                    disabled={primaryEquipment.maintenance_enabled === false}
                                                    disabledText="Сначала включите обслуживание у основного устройства"
                                                    onSave={() => handleCpuThermalSave(primaryEquipment.id, {
                                                        changedAt: cpuThermalPasteDateDrafts[primaryEquipment.id] || null,
                                                        intervalDays: cpuThermalPasteIntervalDrafts[primaryEquipment.id] ? parseInt(cpuThermalPasteIntervalDrafts[primaryEquipment.id], 10) : null,
                                                        type: cpuThermalPasteTypeDrafts[primaryEquipment.id] || null,
                                                        note: cpuThermalPasteNoteDrafts[primaryEquipment.id] || null,
                                                    })}
                                                />

                                                {gpuEligible ? (
                                                    <ThermalMaintenanceCard
                                                        summary="Настройки GPU"
                                                        isOpen={isGpuSectionOpen}
                                                        onToggleOpen={() => setIsGpuSectionOpen(current => !current)}
                                                        dateValue={gpuThermalPasteDateDrafts[primaryEquipment.id] ?? ""}
                                                        intervalValue={gpuThermalPasteIntervalDrafts[primaryEquipment.id] ?? ""}
                                                        typeValue={gpuThermalPasteTypeDrafts[primaryEquipment.id] ?? ""}
                                                        noteValue={gpuThermalPasteNoteDrafts[primaryEquipment.id] ?? ""}
                                                        typePlaceholder="Термопаста/прокладки"
                                                        notePlaceholder="Например, замена прокладок"
                                                        isSaving={savingGpuThermalId === primaryEquipment.id}
                                                        onDateChange={(value) => setGpuThermalPasteDateDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                        onIntervalChange={(value) => setGpuThermalPasteIntervalDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                        onTypeChange={(value) => setGpuThermalPasteTypeDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                        onNoteChange={(value) => setGpuThermalPasteNoteDrafts(prev => ({ ...prev, [primaryEquipment.id]: value }))}
                                                        disabled={primaryEquipment.maintenance_enabled === false}
                                                        disabledText="Сначала включите обслуживание у основного устройства"
                                                        onSave={() => handleGpuThermalSave(primaryEquipment.id, {
                                                            changedAt: gpuThermalPasteDateDrafts[primaryEquipment.id] || null,
                                                            intervalDays: gpuThermalPasteIntervalDrafts[primaryEquipment.id] ? parseInt(gpuThermalPasteIntervalDrafts[primaryEquipment.id], 10) : null,
                                                            type: gpuThermalPasteTypeDrafts[primaryEquipment.id] || null,
                                                            note: gpuThermalPasteNoteDrafts[primaryEquipment.id] || null,
                                                        })}
                                                    />
                                                ) : (
                                                    <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-xs text-muted-foreground">
                                                        Для этого типа устройства GPU-обслуживание не используется.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
                                    <div className="p-6 sm:p-8 pb-4">
                                        <h3 className="text-lg font-bold text-slate-900">Периферия</h3>
                                        <p className="text-sm text-slate-500 mt-1">Плановое обслуживание подключённых устройств</p>
                                    </div>
                                    <div className="space-y-6 p-6 sm:p-8 pt-0">
                                        {peripheralEquipment.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">Периферия не назначена</div>
                                        ) : peripheralEquipment.map(item => {
                                            const standardInterval = getStandardCleaningInterval(item.type)
                                            const currentIntervalDraft = cleaningIntervalDrafts[item.id] ?? String(item.cleaning_interval_days ?? standardInterval)
                                            const isCustomInterval = item.cleaning_interval_override_days != null

                                            return (
                                                <div key={item.id} className="space-y-2">
                                                    <PeripheralMaintenanceItem
                                                        item={item}
                                                        expanded={Boolean(expandedPeripheralIds[item.id])}
                                                        lastCleanedValue={lastCleanedDrafts[item.id] ?? ""}
                                                        isSaving={savingMaintenanceId === item.id}
                                                        renderEquipmentIcon={getEquipmentIcon}
                                                        onToggleExpanded={(id) => setExpandedPeripheralIds(prev => ({ ...prev, [id]: !prev[id] }))}
                                                        onToggleMaintenance={handleToggleMaintenance}
                                                        onLastCleanedChange={(equipmentId, value) => setLastCleanedDrafts(prev => ({ ...prev, [equipmentId]: value }))}
                                                        onSaveMaintenance={(equipmentId, payload) => handleSaveMaintenance(equipmentId, {
                                                            ...payload,
                                                            cleaningIntervalOverrideDays: currentIntervalDraft && parseInt(currentIntervalDraft, 10) !== standardInterval
                                                                ? parseInt(currentIntervalDraft, 10)
                                                                : null
                                                        })}
                                                    />
                                                    {expandedPeripheralIds[item.id] ? (
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                                                            <div className="flex-1 text-xs text-muted-foreground leading-snug">
                                                                {isCustomInterval
                                                                    ? `Индивидуальный интервал • стандарт ${standardInterval} дн.`
                                                                    : `По стандарту типа • ${standardInterval} дн.`}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    disabled={item.maintenance_enabled === false}
                                                                    className="h-10 w-24 bg-white text-sm rounded-lg"
                                                                    value={currentIntervalDraft}
                                                                    onChange={(e) => setCleaningIntervalDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-10 px-4 rounded-lg"
                                                                    disabled={savingMaintenanceId === item.id || item.maintenance_enabled === false || !isCustomInterval}
                                                                    onClick={() => handleResetCleaningInterval(item.id, item.type, lastCleanedDrafts[item.id] || null)}
                                                                >
                                                                    Сброс
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="history" className="mt-0">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
                            <div className="p-6 sm:p-8 pb-4 flex flex-col gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">История места</h3>
                                    <p className="text-sm text-slate-500 mt-1">События по всему оборудованию, которое закреплено за этим местом</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { label: "Все", value: "all" },
                                        { label: "Обслуживание", value: "maintenance" },
                                        { label: "Перемещения", value: "move" },
                                        { label: "Инциденты", value: "issue" },
                                        { label: "Стирка", value: "laundry" },
                                    ].map((filterOption) => (
                                        <Button
                                            key={filterOption.value}
                                            type="button"
                                            size="sm"
                                            variant={historyFilter === filterOption.value ? "default" : "outline"}
                                            className={cn(
                                                "rounded-full",
                                                historyFilter === filterOption.value && "bg-slate-900 hover:bg-slate-800"
                                            )}
                                            onClick={() => setHistoryFilter(filterOption.value as HistoryFilter)}
                                        >
                                            {filterOption.label}
                                        </Button>
                                    ))}
                                </div>

                                {historyEquipmentOptions.length > 1 ? (
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={historyEquipmentFilter === "all" ? "default" : "outline"}
                                            className={cn(
                                                "rounded-full",
                                                historyEquipmentFilter === "all" && "bg-slate-900 hover:bg-slate-800"
                                            )}
                                            onClick={() => setHistoryEquipmentFilter("all")}
                                        >
                                            Все устройства
                                        </Button>
                                        {historyEquipmentOptions.map((item) => (
                                            <Button
                                                key={item.id}
                                                type="button"
                                                size="sm"
                                                variant={historyEquipmentFilter === item.id ? "default" : "outline"}
                                                className={cn(
                                                    "max-w-full rounded-full",
                                                    historyEquipmentFilter === item.id && "bg-slate-900 hover:bg-slate-800"
                                                )}
                                                onClick={() => setHistoryEquipmentFilter(item.id)}
                                                title={`${item.name} • ${item.type}`}
                                            >
                                                <span className="max-w-[220px] truncate">{item.name}</span>
                                            </Button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            <div className="p-6 sm:p-8 pt-0">
                                {isHistoryLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Загружаем историю места...
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">История по этому месту пока пуста</div>
                                ) : filteredHistory.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">По выбранному фильтру событий нет</div>
                                ) : (
                                    <div className="space-y-6">
                                        {groupedHistory.map((group) => (
                                            <div key={group.label} className="space-y-3">
                                                <div className="sticky top-0 z-10 -mx-2 rounded-lg bg-background/95 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                                    {group.label}
                                                </div>

                                                <div className="space-y-3">
                                                    {group.items.map((log) => {
                                                        const presentation = getHistoryPresentation(log)
                                                        return (
                                                            <div key={`${log.equipment_id}-${log.id}-${log.date}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                                    <div className="min-w-0 flex-1 space-y-3">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", presentation.badgeClassName)}>
                                                                                <span className="mr-1 inline-flex">{presentation.icon}</span>
                                                                                {presentation.badgeLabel}
                                                                            </Badge>
                                                                            <Badge variant="secondary" className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100">
                                                                                {log.equipment_name}
                                                                            </Badge>
                                                                            <span className="text-xs text-muted-foreground">{log.equipment_type}</span>
                                                                        </div>

                                                                        <div>
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <p className="text-sm font-semibold text-slate-950">{presentation.title}</p>
                                                                                <span className="text-xs text-slate-400">{formatHistoryTime(log.date)}</span>
                                                                            </div>
                                                                            <p className="mt-1 text-sm leading-relaxed text-slate-600">
                                                                                {presentation.description}
                                                                            </p>
                                                                        </div>

                                                                        {log.photos && log.photos.length > 0 ? (
                                                                            <div className="space-y-2">
                                                                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                                                                    Фото события
                                                                                </p>
                                                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                                                                    {log.photos.map((photo, photoIndex) => (
                                                                                        <button
                                                                                            key={`${log.id}-photo-${photoIndex}`}
                                                                                            type="button"
                                                                                            onClick={() => openHistoryPhotoViewer(log.photos || [], photoIndex)}
                                                                                            className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-slate-100"
                                                                                        >
                                                                                            <img
                                                                                                src={photo}
                                                                                                alt={`Фото события ${presentation.title} ${photoIndex + 1}`}
                                                                                                className="h-full w-full object-cover"
                                                                                            />
                                                                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1 text-left text-[10px] font-medium text-white">
                                                                                                Открыть
                                                                                            </div>
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ) : null}
                                                                    </div>

                                                                    <div className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-right">
                                                                        <p className="text-[11px] font-semibold text-slate-700">
                                                                            {log.user_name || "Система"}
                                                                        </p>
                                                                        <p className="mt-0.5 text-[10px] text-slate-400">
                                                                            {new Date(log.date).toLocaleDateString("ru-RU")}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <WorkplaceFormDialog
                clubId={clubId}
                open={isDialogOpen}
                onOpenChange={(open) => {
                    if (!open) closeWorkplaceDialog()
                }}
                isSaving={isSaving}
                workplace={editingWorkplace}
                createZoneLocked={null}
                zones={zones}
                onSubmit={handleSave}
            />

            <AssignEquipmentDialog
                open={isAssignDialogOpen}
                onOpenChange={setIsAssignDialogOpen}
                equipment={equipment}
                equipmentTypes={equipmentTypes}
                workstationName={workstation.name}
                onAssignEquipment={handleAssignEquipment}
                renderEquipmentIcon={getEquipmentIcon}
            />

            <Dialog open={Boolean(pendingUnassignEquipmentId)} onOpenChange={(open) => {
                if (!open && !isUnassigningEquipmentId) {
                    setPendingUnassignEquipmentId(null)
                }
            }}>
                <DialogContent className="[&>button]:hidden sm:max-w-md rounded-3xl p-6 sm:p-8">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 mb-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Отвязать оборудование?
                        </DialogTitle>
                        <DialogDescription className="space-y-2 text-left">
                            <span className="block">
                                Оборудование <span className="font-medium text-slate-900">"{pendingUnassignEquipment?.name || "Без названия"}"</span> будет отвязано от места <span className="font-medium text-slate-900">"{workstation.name}"</span>.
                            </span>
                            <span className="block">
                                После подтверждения устройство автоматически переместится на склад и исчезнет из комплектации этого места.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setPendingUnassignEquipmentId(null)} disabled={Boolean(isUnassigningEquipmentId)}>
                            Отмена
                        </Button>
                        <Button className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white" onClick={confirmUnassignEquipment} disabled={Boolean(isUnassigningEquipmentId)}>
                            {isUnassigningEquipmentId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Отвязать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(pendingDeleteWorkstationId)} onOpenChange={(open) => {
                if (!open && !deletingWorkstationId) {
                    setPendingDeleteWorkstationId(null)
                }
            }}>
                <DialogContent className="[&>button]:hidden sm:max-w-lg rounded-3xl p-6 sm:p-8">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 mb-2">
                            <AlertTriangle className="h-5 w-5 text-rose-500" />
                            Удалить рабочее место?
                        </DialogTitle>
                        <DialogDescription className="space-y-2 text-left">
                            <span className="block">
                                Рабочее место <span className="font-medium text-slate-900">"{pendingDeleteWorkstation?.name || "Без названия"}"</span> будет удалено.
                            </span>
                            {pendingDeleteAttachedEquipment.length > 0 ? (
                                <span className="block">
                                    Перед удалением {pendingDeleteAttachedEquipment.length} {pendingDeleteAttachedEquipment.length === 1 ? "устройство будет" : pendingDeleteAttachedEquipment.length < 5 ? "устройства будут" : "устройств будут"} автоматически сняты с места и перемещены на склад.
                                </span>
                            ) : (
                                <span className="block">
                                    К месту сейчас не привязано оборудование, поэтому удаление затронет только само место.
                                </span>
                            )}
                            <span className="block">
                                Это действие лучше использовать только если место действительно больше не нужно в схеме клуба.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            className="rounded-xl font-bold"
                            onClick={() => setPendingDeleteWorkstationId(null)}
                            disabled={Boolean(deletingWorkstationId)}
                        >
                            Отмена
                        </Button>
                        <Button
                            className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white"
                            onClick={() => pendingDeleteWorkstationId && handleDeleteWorkstation(pendingDeleteWorkstationId)}
                            disabled={Boolean(deletingWorkstationId)}
                        >
                            {deletingWorkstationId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Удалить место
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(historyPhotoViewer)} onOpenChange={(open) => { if (!open) closeHistoryPhotoViewer() }}>
                <DialogContent className="left-0 top-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-black p-0 text-white shadow-none [&>button]:hidden">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Просмотр фото из истории места</DialogTitle>
                        <DialogDescription>
                            Полноэкранный просмотр прикреплённых фотографий из истории оборудования этого места.
                        </DialogDescription>
                    </DialogHeader>
                    {historyPhotoViewer && (
                        <div className="relative flex h-screen flex-col">
                            <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
                                <div className="pointer-events-auto flex max-w-[90vw] items-center gap-2 overflow-x-auto rounded-full border border-white/10 bg-black/80 p-2">
                                    <Button type="button" variant="ghost" size="icon" onClick={showPrevHistoryPhoto} disabled={historyPhotoViewer.index === 0} className="h-8 w-8 shrink-0 text-white hover:bg-white/20 disabled:opacity-30">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="w-24 shrink-0 text-center text-xs text-white/70">
                                        {historyPhotoViewer.index + 1} / {historyPhotoViewer.images.length}
                                    </span>
                                    <Button type="button" variant="ghost" size="icon" onClick={showNextHistoryPhoto} disabled={historyPhotoViewer.index >= historyPhotoViewer.images.length - 1} className="h-8 w-8 shrink-0 text-white hover:bg-white/20 disabled:opacity-30">
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <div className="mx-1 h-4 w-px shrink-0 bg-white/20" />
                                    <Button type="button" variant="ghost" size="icon" onClick={closeHistoryPhotoViewer} className="h-8 w-8 shrink-0 text-white hover:bg-white/20">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {historyPhotoViewer.images.length > 1 ? (
                                <>
                                    <Button type="button" variant="ghost" size="icon" onClick={showPrevHistoryPhoto} disabled={historyPhotoViewer.index === 0} className="absolute bottom-8 left-6 z-20 h-12 w-12 rounded-full border border-white/10 bg-black/80 text-white hover:bg-white/20 disabled:opacity-30 md:top-1/2 md:bottom-auto md:-translate-y-1/2">
                                        <ChevronLeft className="h-6 w-6" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" onClick={showNextHistoryPhoto} disabled={historyPhotoViewer.index >= historyPhotoViewer.images.length - 1} className="absolute bottom-8 right-6 z-20 h-12 w-12 rounded-full border border-white/10 bg-black/80 text-white hover:bg-white/20 disabled:opacity-30 md:top-1/2 md:bottom-auto md:-translate-y-1/2">
                                        <ChevronRight className="h-6 w-6" />
                                    </Button>
                                </>
                            ) : null}

                            <div className="flex min-h-0 flex-1 items-center justify-center p-4 md:p-8">
                                <img
                                    src={historyPhotoViewer.images[historyPhotoViewer.index]}
                                    alt="Фото из истории места"
                                    className="max-h-full max-w-full object-contain"
                                />
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl md:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="mx-auto flex max-w-[1600px] gap-2">
                    <Button asChild variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 bg-white font-medium">
                        <Link href={`/clubs/${clubId}/equipment/workplaces`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                </div>
            </div>
            </div>
        </PageShell>
    )
}
