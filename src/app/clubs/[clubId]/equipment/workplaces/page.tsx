"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ChevronLeft, Loader2, MapPin, Plus, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/PageShell"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import ZoneSection from "./ZoneSection"
import type { Equipment, EquipmentType, Workstation } from "./types"
import { renderEquipmentIcon } from "@/lib/equipment-icons"

const AssignEquipmentDialog = dynamic(() => import("./AssignEquipmentDialog"), { ssr: false })
const WorkplaceFormDialog = dynamic(() => import("./WorkplaceFormDialog"), { ssr: false })

const sortWorkstationsByZoneAndName = (a: Workstation, b: Workstation) => {
    const zoneA = a.zone || ''
    const zoneB = b.zone || ''
    const zoneCompare = zoneA.localeCompare(zoneB, "ru", { sensitivity: "base" })
    if (zoneCompare !== 0) return zoneCompare
    return a.name.localeCompare(b.name, "ru", { numeric: true, sensitivity: "base" })
}

const getMaintenanceStatus = (item: Equipment): "overdue" | "serviced" | "disabled" | "unknown" => {
    if (item.maintenance_enabled === false) return "disabled"

    const intervalDays = Math.max(1, Number(item.cleaning_interval_override_days ?? item.cleaning_interval_days) || 30)
    if (!item.last_cleaned_at) return "overdue"

    const lastCleaned = new Date(item.last_cleaned_at)
    if (Number.isNaN(lastCleaned.getTime())) return "unknown"

    const dueDate = new Date(lastCleaned)
    dueDate.setDate(dueDate.getDate() + intervalDays)

    return dueDate.getTime() < Date.now() ? "overdue" : "serviced"
}

const getMaintenanceOverdueDays = (item: Equipment): number => {
    if (item.maintenance_enabled === false) return 0

    const intervalDays = Math.max(1, Number(item.cleaning_interval_override_days ?? item.cleaning_interval_days) || 30)
    if (!item.last_cleaned_at) return intervalDays

    const lastCleaned = new Date(item.last_cleaned_at)
    if (Number.isNaN(lastCleaned.getTime())) return 0

    const dueDate = new Date(lastCleaned)
    dueDate.setDate(dueDate.getDate() + intervalDays)

    const overdueMs = Date.now() - dueDate.getTime()
    if (overdueMs <= 0) return 0

    return Math.max(1, Math.floor(overdueMs / (1000 * 60 * 60 * 24)))
}

export default function WorkplacesPage() {
    const { clubId } = useParams()
    const router = useRouter()
    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
    const [zoneList, setZoneList] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingWorkplace, setEditingWorkplace] = useState<Partial<Workstation> | null>(null)
    const [createZoneLocked, setCreateZoneLocked] = useState<string | null>(null)
    
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
    const [selectedWorkstationId, setSelectedWorkstationId] = useState<string | null>(null)

    const [pendingUnassignEquipmentId, setPendingUnassignEquipmentId] = useState<string | null>(null)
    const [isUnassigningEquipmentId, setIsUnassigningEquipmentId] = useState<string | null>(null)

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
        const listOrdered = [...zoneList]
            .filter(z => z?.name)
            .sort((a, b) => {
                const ao = Number(a?.display_order || 0)
                const bo = Number(b?.display_order || 0)
                if (ao !== bo) return ao - bo
                return String(a.name).localeCompare(String(b.name), "ru", { sensitivity: "base" })
            })
            .map(z => z.name)

        const known = new Set(listOrdered)
        const extra = workstations
            .map(w => w.zone)
            .filter(Boolean)
            .filter((z: any) => !known.has(z))
            .sort((a: any, b: any) => String(a).localeCompare(String(b), "ru", { sensitivity: "base" }))

        return [...listOrdered, ...extra]
    }, [zoneList, workstations])

    const mergeEquipmentState = useCallback((equipmentId: string, patch: Partial<Equipment>) => {
        setEquipment(prev => prev.map(item => (
            item.id === equipmentId
                ? { ...item, ...patch }
                : item
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

    const equipmentById = useMemo(() => {
        return new Map(equipment.map(item => [item.id, item]))
    }, [equipment])

    const pendingUnassignEquipment = useMemo(() => {
        return pendingUnassignEquipmentId ? (equipmentById.get(pendingUnassignEquipmentId) ?? null) : null
    }, [equipmentById, pendingUnassignEquipmentId])

    const pendingUnassignWorkstationName = useMemo(() => {
        if (!pendingUnassignEquipment?.workstation_id) return null
        return workstations.find(item => item.id === pendingUnassignEquipment.workstation_id)?.name ?? null
    }, [pendingUnassignEquipment?.workstation_id, workstations])

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
            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || "Не удалось назначить оборудование")
            }
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

    const handleUnassignEquipment = useCallback((equipmentId: string) => {
        setPendingUnassignEquipmentId(equipmentId)
    }, [])

    const confirmUnassignEquipment = useCallback(async () => {
        if (!pendingUnassignEquipmentId) return

        const equipmentItem = equipmentById.get(pendingUnassignEquipmentId)
        const previousWorkstationId = equipmentItem?.workstation_id ?? null

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
            syncWorkstationEquipmentCounts(previousWorkstationId, updatedEquipment.workstation_id ?? null)
            setPendingUnassignEquipmentId(null)
        } catch (error) {
            console.error("Error unassigning equipment:", error)
            alert(error instanceof Error ? error.message : "Ошибка снятия оборудования с места")
        } finally {
            setIsUnassigningEquipmentId(null)
        }
    }, [clubId, equipmentById, mergeEquipmentState, pendingUnassignEquipmentId, syncWorkstationEquipmentCounts])

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
            const zone = workstation.zone || ''
            const current = map.get(zone)
            if (current) current.push(workstation)
            else map.set(zone, [workstation])
        }

        return map
    }, [workstations])

    const zoneMetaByName = useMemo(() => {
        return new Map(zoneList.map(zone => [zone.name, zone]))
    }, [zoneList])

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

    const maintenanceStatusByEquipmentId = useMemo(() => {
        const map = new Map<string, "overdue" | "serviced" | "disabled" | "unknown">()

        for (const item of equipment) {
            map.set(item.id, getMaintenanceStatus(item))
        }

        return map
    }, [equipment])

    const overdueDaysByEquipmentId = useMemo(() => {
        const map = new Map<string, number>()

        for (const item of equipment) {
            const overdueDays = getMaintenanceOverdueDays(item)
            if (overdueDays > 0) {
                map.set(item.id, overdueDays)
            }
        }

        return map
    }, [equipment])

    const overdueMaintenanceCountByWorkstationId = useMemo(() => {
        const map = new Map<string, number>()

        equipmentByWorkstationId.forEach((items, workstationId) => {
            const overdueCount = items.filter(item => maintenanceStatusByEquipmentId.get(item.id) === "overdue").length
            if (overdueCount > 0) {
                map.set(workstationId, overdueCount)
            }
        })

        return map
    }, [equipmentByWorkstationId, maintenanceStatusByEquipmentId])

    const servicedMaintenanceCountByWorkstationId = useMemo(() => {
        const map = new Map<string, number>()

        equipmentByWorkstationId.forEach((items, workstationId) => {
            const servicedCount = items.filter(item => maintenanceStatusByEquipmentId.get(item.id) === "serviced").length
            if (servicedCount > 0) {
                map.set(workstationId, servicedCount)
            }
        })

        return map
    }, [equipmentByWorkstationId, maintenanceStatusByEquipmentId])

    const disabledMaintenanceCountByWorkstationId = useMemo(() => {
        const map = new Map<string, number>()

        equipmentByWorkstationId.forEach((items, workstationId) => {
            const disabledCount = items.filter(item => maintenanceStatusByEquipmentId.get(item.id) === "disabled").length
            if (disabledCount > 0) {
                map.set(workstationId, disabledCount)
            }
        })

        return map
    }, [equipmentByWorkstationId, maintenanceStatusByEquipmentId])

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

    const zoneRepairCountByName = useMemo(() => {
        const map = new Map<string, number>()

        for (const zone of zones) {
            const repairCount = (workstationsByZone.get(zone) ?? []).reduce((total, workstation) => {
                const hasRepairEquipment = (equipmentByWorkstationId.get(workstation.id) ?? []).some(item => item.status === "REPAIR")
                return total + (hasRepairEquipment ? 1 : 0)
            }, 0)

            if (repairCount > 0) {
                map.set(zone, repairCount)
            }
        }

        return map
    }, [equipmentByWorkstationId, workstationsByZone, zones])

    const zoneEmptyCountByName = useMemo(() => {
        const map = new Map<string, number>()

        for (const zone of zones) {
            const emptyCount = (workstationsByZone.get(zone) ?? []).filter(workstation => (workstation.equipment_count ?? 0) === 0).length
            if (emptyCount > 0) {
                map.set(zone, emptyCount)
            }
        }

        return map
    }, [workstationsByZone, zones])

    const zoneUnassignedCountByName = useMemo(() => {
        const map = new Map<string, number>()

        for (const zone of zones) {
            const withoutResponsible = (workstationsByZone.get(zone) ?? []).filter(workstation => !workstation.assigned_user_id).length
            if (withoutResponsible > 0) {
                map.set(zone, withoutResponsible)
            }
        }

        return map
    }, [workstationsByZone, zones])

    const zoneOverdueMaintenanceCountByName = useMemo(() => {
        const map = new Map<string, number>()

        for (const zone of zones) {
            const overdueCount = (workstationsByZone.get(zone) ?? []).reduce(
                (total, workstation) => total + (overdueMaintenanceCountByWorkstationId.get(workstation.id) ?? 0),
                0
            )

            if (overdueCount > 0) {
                map.set(zone, overdueCount)
            }
        }

        return map
    }, [overdueMaintenanceCountByWorkstationId, workstationsByZone, zones])

    const zoneServicedMaintenanceCountByName = useMemo(() => {
        const map = new Map<string, number>()

        for (const zone of zones) {
            const servicedCount = (workstationsByZone.get(zone) ?? []).reduce(
                (total, workstation) => total + (servicedMaintenanceCountByWorkstationId.get(workstation.id) ?? 0),
                0
            )

            if (servicedCount > 0) {
                map.set(zone, servicedCount)
            }
        }

        return map
    }, [servicedMaintenanceCountByWorkstationId, workstationsByZone, zones])

    const zoneDisabledMaintenanceCountByName = useMemo(() => {
        const map = new Map<string, number>()

        for (const zone of zones) {
            const disabledCount = (workstationsByZone.get(zone) ?? []).reduce(
                (total, workstation) => total + (disabledMaintenanceCountByWorkstationId.get(workstation.id) ?? 0),
                0
            )

            if (disabledCount > 0) {
                map.set(zone, disabledCount)
            }
        }

        return map
    }, [disabledMaintenanceCountByWorkstationId, workstationsByZone, zones])

    const selectedWorkstation = useMemo(() => {
        return workstations.find(w => w.id === selectedWorkstationId) || null
    }, [workstations, selectedWorkstationId])

    const getEquipmentIcon = useCallback((type: string) => renderEquipmentIcon(type, null, "h-4 w-4"), [])

    const handleOpenDetails = useCallback((wsId: string) => {
        router.push(`/clubs/${clubId}/equipment/workplaces/${wsId}`)
    }, [clubId, router])

    const zonesContent = useMemo(() => {
        if (zones.length === 0 && !isLoading) {
            return (
                <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                    <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <MapPin className="h-10 w-10 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold">Зоны не созданы</h3>
                    <p className="text-sm text-muted-foreground mb-6">Сначала настройте зоны клуба, после этого можно будет создавать рабочие места.</p>
                    <Button asChild variant="outline">
                        <Link href={`/clubs/${clubId}/equipment/settings?tab=zones`}>Перейти к зонам</Link>
                    </Button>
                </div>
            )
        }

        return zones.map(zone => (
            <ZoneSection
                key={zone}
                zone={zone}
                workstations={workstationsByZone.get(zone) ?? []}
                zoneAssignedUserName={zoneMetaByName.get(zone)?.assigned_user_name ?? null}
                equipmentByWorkstationId={equipmentByWorkstationId}
                activeIssueCountByWorkstationId={activeIssueCountByWorkstationId}
                activeIssueCountByEquipmentId={activeIssueCountByEquipmentId}
                maintenanceStatusByEquipmentId={maintenanceStatusByEquipmentId}
                overdueDaysByEquipmentId={overdueDaysByEquipmentId}
                overdueMaintenanceCountByWorkstationId={overdueMaintenanceCountByWorkstationId}
                servicedMaintenanceCountByWorkstationId={servicedMaintenanceCountByWorkstationId}
                disabledMaintenanceCountByWorkstationId={disabledMaintenanceCountByWorkstationId}
                zoneIssuesCount={zoneIssueCountByName.get(zone) ?? 0}
                zoneRepairCount={zoneRepairCountByName.get(zone) ?? 0}
                zoneEmptyCount={zoneEmptyCountByName.get(zone) ?? 0}
                zoneUnassignedCount={zoneUnassignedCountByName.get(zone) ?? 0}
                zoneOverdueMaintenanceCount={zoneOverdueMaintenanceCountByName.get(zone) ?? 0}
                zoneServicedMaintenanceCount={zoneServicedMaintenanceCountByName.get(zone) ?? 0}
                zoneDisabledMaintenanceCount={zoneDisabledMaintenanceCountByName.get(zone) ?? 0}
                onOpenDetails={handleOpenDetails}
                onOpenAssignDialog={handleOpenAssignDialog}
                onCreate={handleCreate}
                onUnassignEquipment={handleUnassignEquipment}
            />
        ))
    }, [
        activeIssueCountByEquipmentId,
        activeIssueCountByWorkstationId,
        equipmentByWorkstationId,
        handleCreate,
        handleOpenAssignDialog,
        handleOpenDetails,
        handleUnassignEquipment,
        isLoading,
        maintenanceStatusByEquipmentId,
        overdueDaysByEquipmentId,
        overdueMaintenanceCountByWorkstationId,
        servicedMaintenanceCountByWorkstationId,
        disabledMaintenanceCountByWorkstationId,
        zoneEmptyCountByName,
        zoneDisabledMaintenanceCountByName,
        zoneOverdueMaintenanceCountByName,
        workstationsByZone,
        zoneIssueCountByName,
        zoneMetaByName,
        zoneRepairCountByName,
        zoneServicedMaintenanceCountByName,
        zoneUnassignedCountByName,
        zones,
        clubId
    ])

    return (
        <PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                    <div className="min-w-0">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Рабочие места</h1>
                        <p className="text-slate-500 text-lg mt-2">Обзор зон, мест и подключенного оборудования</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                        <Button asChild variant="outline" className="hidden w-full md:inline-flex md:w-auto rounded-xl h-11 px-6 font-medium">
                            <Link href={`/clubs/${clubId}/equipment`}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Назад
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium">
                            <Link href={`/clubs/${clubId}/equipment/settings?tab=zones`}>
                                <Settings2 className="mr-2 h-4 w-4" />
                                Настройки зон
                            </Link>
                        </Button>
                        <Button onClick={() => handleCreate()} disabled={zones.length === 0} className="w-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 sm:w-auto rounded-xl h-11 px-6 font-medium">
                            <Plus className="mr-2 h-4 w-4" />
                            Создать место
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {zonesContent}
            </div>

            <WorkplaceFormDialog
                clubId={clubId as string}
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
                workstationName={selectedWorkstation?.name ?? null}
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
                            Убрать оборудование с места?
                        </DialogTitle>
                        <DialogDescription className="space-y-2 text-left">
                            <span className="block">
                                Оборудование <span className="font-medium text-slate-900">"{pendingUnassignEquipment?.name || "Без названия"}"</span>
                                {pendingUnassignWorkstationName ? (
                                    <> будет снято с места <span className="font-medium text-slate-900">"{pendingUnassignWorkstationName}"</span>.</>
                                ) : (
                                    <> будет отвязано от текущего места.</>
                                )}
                            </span>
                            <span className="block">
                                После подтверждения устройство автоматически переместится на склад и исчезнет из комплектации этого места.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            className="rounded-xl font-bold"
                            onClick={() => setPendingUnassignEquipmentId(null)}
                            disabled={Boolean(isUnassigningEquipmentId)}
                        >
                            Отмена
                        </Button>
                        <Button
                            className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white"
                            onClick={confirmUnassignEquipment}
                            disabled={Boolean(isUnassigningEquipmentId)}
                        >
                            {isUnassigningEquipmentId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Подтвердить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
