"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, Gamepad, Gamepad2, Glasses, MapPin, Monitor, MousePointer2, Headphones, Keyboard, Plus, Sofa, Square, Tv, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ManageZonesDialog } from "./ManageZonesDialog"
import ZoneSection from "./ZoneSection"
import type { Employee, Equipment, EquipmentType, Workstation } from "./types"

const AssignEquipmentDialog = dynamic(() => import("./AssignEquipmentDialog"), { ssr: false })
const WorkplaceFormDialog = dynamic(() => import("./WorkplaceFormDialog"), { ssr: false })
const WorkstationDetailsDialog = dynamic(() => import("./WorkstationDetailsDialog"), { ssr: false })

const sortWorkstationsByZoneAndName = (a: Workstation, b: Workstation) => {
    const zoneCompare = a.zone.localeCompare(b.zone, "ru", { sensitivity: "base" })
    if (zoneCompare !== 0) return zoneCompare
    return a.name.localeCompare(b.name, "ru", { numeric: true, sensitivity: "base" })
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

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingWorkplace, setEditingWorkplace] = useState<Partial<Workstation> | null>(null)
    const [createZoneLocked, setCreateZoneLocked] = useState<string | null>(null)
    
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
    const [selectedWorkstationId, setSelectedWorkstationId] = useState<string | null>(null)

    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [detailsWorkstationId, setDetailsWorkstationId] = useState<string | null>(null)
    const [savingIntervalId, setSavingIntervalId] = useState<string | null>(null)
    const [savingCpuThermalId, setSavingCpuThermalId] = useState<string | null>(null)
    const [savingGpuThermalId, setSavingGpuThermalId] = useState<string | null>(null)
    const [isAssigningWorkstationId, setIsAssigningWorkstationId] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/workplaces`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data?.error || "Failed to load workplaces")
            }

            setWorkstations(data.workstations || [])
            setEquipment(data.equipment || [])
            setEquipmentTypes(data.equipmentTypes || [])
            setEmployees(data.employees || [])
            setZoneList(data.zones || [])
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

    const employeeNameById = useMemo(() => {
        return new Map(employees.map(employee => [employee.id, employee.full_name]))
    }, [employees])

    const mergeEquipmentState = useCallback((equipmentId: string, patch: Partial<Equipment>) => {
        setEquipment(prev => prev.map(item => (
            item.id === equipmentId
                ? { ...item, ...patch }
                : item
        )))
    }, [])

    const mergeWorkstationState = useCallback((workstationId: string, patch: Partial<Workstation>) => {
        setWorkstations(prev => prev.map(workstation => (
            workstation.id === workstationId
                ? { ...workstation, ...patch }
                : workstation
        )))
    }, [])

    const syncWorkstationEquipmentCounts = useCallback((previousWorkstationId: string | null | undefined, nextWorkstationId: string | null | undefined) => {
        if (previousWorkstationId === nextWorkstationId) return

        setWorkstations(prev => prev.map(workstation => {
            let nextEquipmentCount = workstation.equipment_count ?? 0

            if (previousWorkstationId && workstation.id === previousWorkstationId) {
                nextEquipmentCount = Math.max(0, nextEquipmentCount - 1)
            }

            if (nextWorkstationId && workstation.id === nextWorkstationId) {
                nextEquipmentCount += 1
            }

            return nextEquipmentCount === (workstation.equipment_count ?? 0)
                ? workstation
                : { ...workstation, equipment_count: nextEquipmentCount }
        }))
    }, [])

    const closeWorkplaceDialog = () => {
        setIsDialogOpen(false)
        setEditingWorkplace(null)
        setCreateZoneLocked(null)
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

    const handleSave = async (draft: Partial<Workstation>) => {
        if (!draft?.name || !draft?.zone) return
        setIsSaving(true)
        try {
            const isNew = !draft.id
            const url = isNew
                ? `/api/clubs/${clubId}/workstations`
                : `/api/clubs/${clubId}/workstations/${draft.id}`

            const res = await fetch(url, {
                method: isNew ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft)
            })

            if (res.ok) {
                const savedWorkstation = await res.json()
                setWorkstations(prev => {
                    if (isNew) {
                        return [...prev, { ...savedWorkstation, assigned_user_name: null, equipment_count: 0 }].sort(sortWorkstationsByZoneAndName)
                    }

                    return prev
                        .map(workstation => (
                            workstation.id === savedWorkstation.id
                                ? {
                                    ...workstation,
                                    ...savedWorkstation,
                                    assigned_user_name: workstation.assigned_user_name ?? null,
                                    equipment_count: workstation.equipment_count ?? 0
                                }
                                : workstation
                        ))
                        .sort(sortWorkstationsByZoneAndName)
                })
                closeWorkplaceDialog()
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
            if (res.ok) {
                setWorkstations(prev => prev.filter(workstation => workstation.id !== id))
                if (detailsWorkstationId === id) {
                    setIsDetailsOpen(false)
                    setDetailsWorkstationId(null)
                }
            }
        } catch (error) {
            console.error("Error deleting workplace:", error)
        }
    }, [clubId, detailsWorkstationId, workstations])

    const equipmentById = useMemo(() => {
        return new Map(equipment.map(item => [item.id, item]))
    }, [equipment])

    const handleOpenAssignDialog = useCallback((wsId: string) => {
        setSelectedWorkstationId(wsId)
        setIsAssignDialogOpen(true)
    }, [])

    const handleAssignEquipment = useCallback(async (equipmentId: string) => {
        if (!selectedWorkstationId) return

        const previousWorkstationId = equipmentById.get(equipmentId)?.workstation_id ?? null

        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workstation_id: selectedWorkstationId })
            })
            if (res.ok) {
                const updatedEquipment = await res.json()
                mergeEquipmentState(equipmentId, {
                    ...updatedEquipment,
                    maintenance_enabled: updatedEquipment.maintenance_enabled !== false
                })
                syncWorkstationEquipmentCounts(previousWorkstationId, updatedEquipment.workstation_id ?? null)
            }
        } catch (error) {
            console.error("Error assigning equipment:", error)
        }
    }, [clubId, equipmentById, mergeEquipmentState, selectedWorkstationId, syncWorkstationEquipmentCounts])

    const handleUnassignEquipment = useCallback(async (equipmentId: string) => {
        const previousWorkstationId = equipmentById.get(equipmentId)?.workstation_id ?? null

        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workstation_id: null })
            })
            if (res.ok) {
                const updatedEquipment = await res.json()
                mergeEquipmentState(equipmentId, {
                    ...updatedEquipment,
                    maintenance_enabled: updatedEquipment.maintenance_enabled !== false
                })
                syncWorkstationEquipmentCounts(previousWorkstationId, updatedEquipment.workstation_id ?? null)
            }
        } catch (error) {
            console.error("Error unassigning equipment:", error)
        }
    }, [clubId, equipmentById, mergeEquipmentState, syncWorkstationEquipmentCounts])

    const handleToggleMaintenance = useCallback(async (equipmentId: string, enabled: boolean) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/${equipmentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    maintenance_enabled: enabled,
                    assigned_user_id: enabled ? undefined : null
                })
            })
            if (res.ok) {
                const updatedEquipment = await res.json()
                mergeEquipmentState(equipmentId, {
                    ...updatedEquipment,
                    maintenance_enabled: updatedEquipment.maintenance_enabled !== false
                })
            }
        } catch (error) {
            console.error("Error toggling maintenance:", error)
        }
    }, [clubId, mergeEquipmentState])

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

        for (const item of equipment) {
            const issuesCount = Number(item.open_issues_count ?? 0)
            if (issuesCount > 0) {
                map.set(item.id, issuesCount)
            }
        }

        return map
    }, [equipment])

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
                const updatedEquipment = await res.json()
                mergeEquipmentState(equipmentId, updatedEquipment)
            }
        } catch (error) {
            console.error("Error updating interval:", error)
        } finally {
            setSavingIntervalId(null)
        }
    }, [clubId, mergeEquipmentState])

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
                const updatedEquipment = await res.json()
                mergeEquipmentState(equipmentId, updatedEquipment)
            }
        } catch (error) {
            console.error("Error updating CPU maintenance:", error)
        } finally {
            setSavingCpuThermalId(null)
        }
    }, [clubId, mergeEquipmentState])

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
                const updatedEquipment = await res.json()
                mergeEquipmentState(equipmentId, updatedEquipment)
            }
        } catch (error) {
            console.error("Error updating GPU maintenance:", error)
        } finally {
            setSavingGpuThermalId(null)
        }
    }, [clubId, mergeEquipmentState])

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
                const updatedWorkstation = await res.json()
                mergeWorkstationState(detailsWorkstationId, {
                    ...updatedWorkstation,
                    assigned_user_name: userId ? (employeeNameById.get(userId) ?? null) : null
                })
                setEquipment(prev => prev.map(item => (
                    item.workstation_id === detailsWorkstationId
                        ? {
                            ...item,
                            assigned_user_id: null,
                            assignment_mode: 'INHERIT',
                            maintenance_enabled: userId ? true : false
                        }
                        : item
                )))
            }
        } catch (error) {
            console.error("Error assigning workstation:", error)
        } finally {
            setIsAssigningWorkstationId(null)
        }
    }, [clubId, detailsWorkstationId, employeeNameById, mergeWorkstationState])

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

            <div className="space-y-12">
                {zonesContent}
            </div>

            {isDetailsOpen && activeWorkstation ? (
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
            ) : null}

            <WorkplaceFormDialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                    if (!open) closeWorkplaceDialog()
                }}
                isSaving={isSaving}
                workplace={editingWorkplace}
                createZoneLocked={createZoneLocked}
                zones={zones}
                onSubmit={handleSave}
            />

            <AssignEquipmentDialog
                open={isAssignDialogOpen}
                onOpenChange={setIsAssignDialogOpen}
                equipment={equipment}
                equipmentTypes={equipmentTypes}
                onAssignEquipment={handleAssignEquipment}
                renderEquipmentIcon={getEquipmentIcon}
            />
        </div>
    )
}
