"use client"

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Loader2, Plus, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { canAssignEquipmentToWorkstation } from "@/lib/equipment-status"
import type { Equipment, EquipmentType } from "./types"

const ASSIGN_DIALOG_ITEM_HEIGHT = 78
const ASSIGN_DIALOG_OVERSCAN = 6
const ASSIGN_DIALOG_VIEWPORT_HEIGHT = 460

interface AssignEquipmentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    equipment: Equipment[]
    equipmentTypes: EquipmentType[]
    workstationName?: string | null
    onAssignEquipment: (equipmentId: string) => Promise<void>
    renderEquipmentIcon: (type: string) => ReactNode
}

const VirtualizedAssignEquipmentList = memo(function VirtualizedAssignEquipmentList({
    items,
    renderEquipmentIcon,
    onAssignEquipment,
    assigningEquipmentId,
}: {
    items: Equipment[]
    renderEquipmentIcon: (type: string) => ReactNode
    onAssignEquipment: (equipmentId: string) => void
    assigningEquipmentId: string | null
}) {
    const [scrollTop, setScrollTop] = useState(0)
    const scrollContainerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        setScrollTop(0)
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0
        }
    }, [items])

    const totalHeight = items.length * ASSIGN_DIALOG_ITEM_HEIGHT
    const startIndex = Math.max(0, Math.floor(scrollTop / ASSIGN_DIALOG_ITEM_HEIGHT) - ASSIGN_DIALOG_OVERSCAN)
    const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + ASSIGN_DIALOG_VIEWPORT_HEIGHT) / ASSIGN_DIALOG_ITEM_HEIGHT) + ASSIGN_DIALOG_OVERSCAN
    )
    const visibleItems = items.slice(startIndex, endIndex)

    return (
        <div
            ref={scrollContainerRef}
            className="overflow-y-auto"
            style={{ height: ASSIGN_DIALOG_VIEWPORT_HEIGHT }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
            <div style={{ height: totalHeight, position: "relative" }}>
                <div
                    className="absolute inset-x-0 top-0 grid grid-cols-1 gap-2"
                    style={{ transform: `translateY(${startIndex * ASSIGN_DIALOG_ITEM_HEIGHT}px)` }}
                >
                    {visibleItems.map(item => (
                        <div key={item.id} className="flex h-[70px] items-center justify-between rounded-xl border bg-white p-3 shadow-sm transition-all hover:border-primary/50">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                    {renderEquipmentIcon(item.type)}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{item.name}</p>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="h-5 px-1 text-[10px]">{item.type_name || item.type}</Badge>
                                        <span className="truncate text-xs text-muted-foreground">{item.brand} {item.model}</span>
                                        {item.identifier ? (
                                            <span className="hidden truncate text-[10px] text-slate-400 sm:inline">{item.identifier}</span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                            <Button size="sm" disabled={assigningEquipmentId !== null} onClick={() => onAssignEquipment(item.id)}>
                                {assigningEquipmentId === item.id ? (
                                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : (
                                    <Plus className="mr-1 h-4 w-4" />
                                )}
                                Добавить
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
})

export default function AssignEquipmentDialog({
    open,
    onOpenChange,
    equipment,
    equipmentTypes,
    workstationName,
    onAssignEquipment,
    renderEquipmentIcon,
}: AssignEquipmentDialogProps) {
    const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>("all")
    const [searchEquipment, setSearchEquipment] = useState("")
    const [assigningEquipmentId, setAssigningEquipmentId] = useState<string | null>(null)
    const [assignError, setAssignError] = useState<string | null>(null)
    const deferredSearchEquipment = useDeferredValue(searchEquipment)

    useEffect(() => {
        if (!open) return
        setSelectedEquipmentType("all")
        setSearchEquipment("")
        setAssigningEquipmentId(null)
        setAssignError(null)
    }, [open])

    const normalizedEquipmentSearch = useMemo(() => deferredSearchEquipment.trim().toLowerCase(), [deferredSearchEquipment])

    const availableEquipment = useMemo(() => {
        return equipment.filter(item => {
            if (item.workstation_id || !canAssignEquipmentToWorkstation(item.status)) return false
            if (selectedEquipmentType !== "all" && item.type !== selectedEquipmentType) return false
            if (!normalizedEquipmentSearch) return true

            return item.name.toLowerCase().includes(normalizedEquipmentSearch)
                || item.brand?.toLowerCase().includes(normalizedEquipmentSearch)
                || item.model?.toLowerCase().includes(normalizedEquipmentSearch)
                || item.identifier?.toLowerCase().includes(normalizedEquipmentSearch)
        })
    }, [equipment, normalizedEquipmentSearch, selectedEquipmentType])

    const handleAssign = async (equipmentId: string) => {
        setAssignError(null)
        setAssigningEquipmentId(equipmentId)
        try {
            await onAssignEquipment(equipmentId)
            onOpenChange(false)
        } catch (error) {
            console.error("Assign equipment error:", error)
            setAssignError("Не удалось назначить оборудование. Попробуйте ещё раз.")
        } finally {
            setAssigningEquipmentId(null)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 p-0 [&>button]:hidden sm:left-1/2 sm:top-1/2 sm:h-[80vh] sm:w-[calc(100vw-1rem)] sm:max-w-[720px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border">
                <DialogHeader className="border-b bg-slate-50 p-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:p-6">
                    <div className="space-y-3">
                        <div>
                            <DialogTitle>Назначить оборудование</DialogTitle>
                            <DialogDescription>
                                Выберите устройство со склада и привяжите его к рабочему месту.
                            </DialogDescription>
                        </div>
                        {workstationName ? (
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    Место назначения
                                </p>
                                <p className="mt-1 text-base font-semibold text-slate-900">
                                    {workstationName}
                                </p>
                            </div>
                        ) : null}
                    </div>
                </DialogHeader>

                <div className="space-y-4 border-b bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Поиск по названию, бренду или ID..."
                                className="pl-9"
                                value={searchEquipment}
                                onChange={(e) => setSearchEquipment(e.target.value)}
                            />
                        </div>
                        <Select value={selectedEquipmentType} onValueChange={setSelectedEquipmentType}>
                            <SelectTrigger className="w-full sm:w-[220px]">
                                <SelectValue placeholder="Тип" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Все типы</SelectItem>
                                {equipmentTypes.map(type => (
                                    <SelectItem key={type.code} value={type.code}>{type.name_ru}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>Доступно на складе: <span className="font-medium text-slate-900">{availableEquipment.length}</span></span>
                        {assignError ? <span className="text-rose-600">{assignError}</span> : null}
                    </div>
                </div>

                <div className="flex-1 bg-slate-50/50 p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-4">
                    {availableEquipment.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                            <Search className="mb-2 h-10 w-10 opacity-20" />
                            <p className="text-sm font-medium text-slate-700">Подходящее оборудование не найдено.</p>
                            <p className="mt-1 text-center text-xs text-muted-foreground">Проверьте фильтры или убедитесь, что нужное устройство находится на складе.</p>
                        </div>
                    ) : (
                        <VirtualizedAssignEquipmentList
                            items={availableEquipment}
                            renderEquipmentIcon={renderEquipmentIcon}
                            onAssignEquipment={handleAssign}
                            assigningEquipmentId={assigningEquipmentId}
                        />
                    )}
                </div>

                <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden">
                    <Button variant="outline" className="h-11 w-full" onClick={() => onOpenChange(false)}>
                        Закрыть
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
