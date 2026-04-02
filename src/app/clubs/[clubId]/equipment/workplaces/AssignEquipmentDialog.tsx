"use client"

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Plus, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import type { Equipment, EquipmentType } from "./types"

const ASSIGN_DIALOG_ITEM_HEIGHT = 78
const ASSIGN_DIALOG_OVERSCAN = 6
const ASSIGN_DIALOG_VIEWPORT_HEIGHT = 480

interface AssignEquipmentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    equipment: Equipment[]
    equipmentTypes: EquipmentType[]
    onAssignEquipment: (equipmentId: string) => void
    renderEquipmentIcon: (type: string) => ReactNode
}

const VirtualizedAssignEquipmentList = memo(function VirtualizedAssignEquipmentList({
    items,
    renderEquipmentIcon,
    onAssignEquipment,
}: {
    items: Equipment[]
    renderEquipmentIcon: (type: string) => ReactNode
    onAssignEquipment: (equipmentId: string) => void
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
                        <div key={item.id} className="flex h-[70px] items-center justify-between rounded-lg border bg-white p-3 shadow-sm transition-all hover:border-primary/50">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                    {renderEquipmentIcon(item.type)}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{item.name}</p>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="h-5 px-1 text-[10px]">{item.type_name || item.type}</Badge>
                                        <span className="truncate text-xs text-muted-foreground">{item.brand} {item.model}</span>
                                    </div>
                                </div>
                            </div>
                            <Button size="sm" onClick={() => onAssignEquipment(item.id)}>
                                <Plus className="mr-1 h-4 w-4" /> Добавить
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
    onAssignEquipment,
    renderEquipmentIcon,
}: AssignEquipmentDialogProps) {
    const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>("all")
    const [searchEquipment, setSearchEquipment] = useState("")
    const deferredSearchEquipment = useDeferredValue(searchEquipment)

    useEffect(() => {
        if (!open) return
        setSelectedEquipmentType("all")
        setSearchEquipment("")
    }, [open])

    const normalizedEquipmentSearch = useMemo(() => deferredSearchEquipment.trim().toLowerCase(), [deferredSearchEquipment])

    const availableEquipment = useMemo(() => {
        return equipment.filter(item => {
            if (item.workstation_id || !item.is_active) return false
            if (selectedEquipmentType !== "all" && item.type !== selectedEquipmentType) return false
            if (!normalizedEquipmentSearch) return true

            return item.name.toLowerCase().includes(normalizedEquipmentSearch)
                || item.brand?.toLowerCase().includes(normalizedEquipmentSearch)
                || item.model?.toLowerCase().includes(normalizedEquipmentSearch)
                || item.identifier?.toLowerCase().includes(normalizedEquipmentSearch)
        })
    }, [equipment, normalizedEquipmentSearch, selectedEquipmentType])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[80vh] flex-col p-0 sm:max-w-[600px]">
                <DialogHeader className="border-b bg-slate-50 p-6">
                    <DialogTitle>Назначить оборудование</DialogTitle>
                    <DialogDescription>
                        Выберите устройство со склада для привязки к рабочему месту.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 border-b bg-white p-4">
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
                                {equipmentTypes.map(type => (
                                    <SelectItem key={type.code} value={type.code}>{type.name_ru}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex-1 bg-slate-50/50 p-4">
                    {availableEquipment.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                            <Search className="mb-2 h-10 w-10 opacity-20" />
                            <p>Подходящее оборудование не найдено на складе.</p>
                        </div>
                    ) : (
                        <VirtualizedAssignEquipmentList
                            items={availableEquipment}
                            renderEquipmentIcon={renderEquipmentIcon}
                            onAssignEquipment={onAssignEquipment}
                        />
                    )}
                </div>

                <DialogFooter className="border-t bg-white p-4">
                    <Button onClick={() => onOpenChange(false)}>Готово</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
