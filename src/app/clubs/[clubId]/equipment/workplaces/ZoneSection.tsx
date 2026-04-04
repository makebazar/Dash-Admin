"use client"

import { memo, useEffect, useRef, useState, type ReactNode } from "react"
import { AlertTriangle, CheckCircle2, Layers, Monitor, Plus, User, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ZoneSectionProps } from "./types"

const WORKSTATION_CARD_PLACEHOLDER_HEIGHT = 320
const VIEWPORT_ROOT_MARGIN = "900px 0px"
const EQUIPMENT_TYPE_SORT_ORDER = ["PC", "CONSOLE", "TV", "MONITOR", "CHAIR", "HEADSET", "KEYBOARD", "MOUSE", "MOUSEPAD"]

const DeferredViewportItem = memo(function DeferredViewportItem({
    children,
}: {
    children: ReactNode
}) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const element = containerRef.current
        if (!element) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting)
            },
            {
                root: null,
                rootMargin: VIEWPORT_ROOT_MARGIN,
                threshold: 0,
            }
        )

        observer.observe(element)

        return () => {
            observer.disconnect()
        }
    }, [])

    return (
        <div ref={containerRef} className="min-h-0">
            {isVisible ? (
                children
            ) : (
                <div
                    className="rounded-xl border border-slate-200 bg-slate-50/70"
                    style={{
                        height: WORKSTATION_CARD_PLACEHOLDER_HEIGHT,
                        contain: "layout paint style",
                    }}
                />
            )}
        </div>
    )
})

export default memo(function ZoneSection({
    zone,
    workstations,
    zoneAssignedUserName,
    equipmentByWorkstationId,
    activeIssueCountByWorkstationId,
    activeIssueCountByEquipmentId,
    maintenanceStatusByEquipmentId,
    overdueMaintenanceCountByWorkstationId,
    servicedMaintenanceCountByWorkstationId,
    disabledMaintenanceCountByWorkstationId,
    zoneIssuesCount,
    zoneRepairCount,
    zoneEmptyCount,
    zoneUnassignedCount,
    zoneOverdueMaintenanceCount,
    zoneServicedMaintenanceCount,
    zoneDisabledMaintenanceCount,
    onOpenDetails,
    onOpenAssignDialog,
    onCreate,
    onUnassignEquipment,
}: ZoneSectionProps) {
    return (
        <section className="space-y-4">
            <div className="group sticky top-0 z-10 flex items-center justify-between border-b bg-background px-1 py-2 sm:px-2">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <h2 className="flex items-center gap-2.5 text-base font-black uppercase tracking-widest text-slate-500 sm:gap-3 sm:text-lg">
                        <Layers className="h-5 w-5 text-primary" />
                        {zone}
                        <Badge variant="secondary" className="border-none bg-slate-100 px-2 text-slate-600">{workstations.length}</Badge>
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                        {zoneAssignedUserName ? (
                            <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                                {zoneAssignedUserName}
                            </Badge>
                        ) : null}
                        {zoneIssuesCount > 0 ? (
                            <Badge variant="outline" className="flex items-center gap-1 border-orange-200 bg-orange-50 text-orange-700">
                                <AlertTriangle className="h-3 w-3" />
                                {zoneIssuesCount} проблем
                            </Badge>
                        ) : null}
                        {zoneOverdueMaintenanceCount > 0 ? (
                            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                                ТО просрочено {zoneOverdueMaintenanceCount}
                            </Badge>
                        ) : null}
                        {zoneServicedMaintenanceCount > 0 ? (
                            <Badge variant="outline" className="flex items-center gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                                <CheckCircle2 className="h-3 w-3" />
                                Обслужено {zoneServicedMaintenanceCount}
                            </Badge>
                        ) : null}
                        {zoneDisabledMaintenanceCount > 0 ? (
                            <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-600">
                                Без ТО {zoneDisabledMaintenanceCount}
                            </Badge>
                        ) : null}
                        {zoneRepairCount > 0 ? (
                            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                                Ремонт {zoneRepairCount}
                            </Badge>
                        ) : null}
                        {zoneEmptyCount > 0 ? (
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                                Пустых {zoneEmptyCount}
                            </Badge>
                        ) : null}
                        {zoneUnassignedCount > 0 ? (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                Без ответств. {zoneUnassignedCount}
                            </Badge>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {workstations.map(ws => {
                    const wsEquipment = equipmentByWorkstationId.get(ws.id) ?? []
                    const wsIssueCount = activeIssueCountByWorkstationId.get(ws.id) ?? 0
                    const wsOverdueMaintenanceCount = overdueMaintenanceCountByWorkstationId.get(ws.id) ?? 0
                    const wsServicedMaintenanceCount = servicedMaintenanceCountByWorkstationId.get(ws.id) ?? 0
                    const wsDisabledMaintenanceCount = disabledMaintenanceCountByWorkstationId.get(ws.id) ?? 0
                    const sortedEquipment = [...wsEquipment].sort((a, b) => {
                        const aIndex = EQUIPMENT_TYPE_SORT_ORDER.indexOf(a.type)
                        const bIndex = EQUIPMENT_TYPE_SORT_ORDER.indexOf(b.type)
                        const aRank = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex
                        const bRank = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex

                        if (aRank !== bRank) return aRank - bRank
                        return a.name.localeCompare(b.name, "ru")
                    })

                    return (
                        <DeferredViewportItem key={ws.id}>
                            <Card
                                className={cn(
                                    "group flex h-full cursor-pointer flex-col overflow-hidden border-slate-200 transition-colors hover:border-primary/50",
                                    wsIssueCount > 0 && "border-orange-200 bg-orange-50/[0.04]"
                                )}
                                style={{ contentVisibility: "auto", containIntrinsicSize: "320px" }}
                                onClick={() => onOpenDetails(ws.id)}
                            >
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-100 bg-slate-50 p-3 pb-2 sm:p-4 sm:pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "relative flex h-10 w-10 items-center justify-center rounded-xl border bg-white font-bold text-slate-400",
                                            wsIssueCount > 0 && "border-orange-200 text-orange-500"
                                        )}>
                                            {ws.name.replace(/[^0-9]/g, '') || <Monitor className="h-5 w-5" />}
                                            {wsIssueCount > 0 ? (
                                                <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-500" />
                                            ) : null}
                                        </div>
                                        <div>
                                            <h4 className="flex items-center gap-2 font-bold leading-tight text-slate-900">
                                                {ws.name}
                                            </h4>
                                            <div className="mt-0.5 flex flex-col gap-0.5">
                                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{wsEquipment.length} устройств</p>
                                                <div className="flex items-center gap-1.5" title={ws.assigned_user_name || "Не назначено"}>
                                                    <User className={cn("h-3 w-3", ws.assigned_user_name ? "text-primary" : "text-slate-400")} />
                                                    <span className={cn("max-w-[100px] truncate text-[10px] font-medium", ws.assigned_user_name ? "text-primary" : "text-slate-400")}>
                                                        {ws.assigned_user_name || "Не назначено"}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {wsOverdueMaintenanceCount > 0 ? (
                                                        <span className="text-[10px] font-medium text-rose-700">
                                                            ТО просрочено: {wsOverdueMaintenanceCount}
                                                        </span>
                                                    ) : null}
                                                    {wsOverdueMaintenanceCount === 0 && wsServicedMaintenanceCount > 0 ? (
                                                        <span className="text-[10px] font-medium text-emerald-700">
                                                            Обслужено: {wsServicedMaintenanceCount}
                                                        </span>
                                                    ) : null}
                                                    {wsDisabledMaintenanceCount > 0 ? (
                                                        <span className="text-[10px] font-medium text-slate-500">
                                                            Без ТО: {wsDisabledMaintenanceCount}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="flex-1 bg-white p-3 sm:p-4">
                                    {wsEquipment.length === 0 ? (
                                        <div className="flex h-full min-h-[100px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-100 p-4 text-center">
                                            <Monitor className="mb-2 h-8 w-8 text-slate-200" />
                                            <p className="text-xs font-medium text-muted-foreground">Оборудование не назначено</p>
                                            <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs text-primary" onClick={(e) => { e.stopPropagation(); onOpenAssignDialog(ws.id) }}>
                                                Назначить сейчас
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {sortedEquipment.map(item => {
                                                const itemIssueCount = activeIssueCountByEquipmentId.get(item.id) ?? 0
                                                const maintenanceStatus = maintenanceStatusByEquipmentId.get(item.id) ?? "unknown"

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={cn(
                                                            "group/item relative flex items-center justify-between overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-2 pl-3 transition-colors hover:border-primary/20 hover:bg-primary/5",
                                                            itemIssueCount > 0 && "border-l-[3px] border-l-orange-500 border-orange-200 bg-orange-50/20 pl-2.5",
                                                            itemIssueCount === 0 && maintenanceStatus === "overdue" && "border-l-[3px] border-l-rose-500 border-rose-200 bg-rose-50/20 pl-2.5",
                                                            itemIssueCount === 0 && maintenanceStatus === "serviced" && "border-l-[3px] border-l-emerald-500 border-emerald-200 bg-emerald-50/20 pl-2.5",
                                                            itemIssueCount === 0 && maintenanceStatus === "disabled" && "border-l-[3px] border-l-slate-400 border-slate-200 bg-slate-100/70 pl-2.5"
                                                        )}
                                                    >
                                                        <div className="relative z-10 min-w-0 overflow-hidden">
                                                            <p className={cn(
                                                                "truncate text-xs font-semibold text-slate-700 group-hover/item:text-primary",
                                                                itemIssueCount > 0 && "text-orange-700",
                                                                itemIssueCount === 0 && maintenanceStatus === "overdue" && "text-rose-700",
                                                                itemIssueCount === 0 && maintenanceStatus === "serviced" && "text-emerald-700",
                                                                itemIssueCount === 0 && maintenanceStatus === "disabled" && "text-slate-600"
                                                            )}>{item.name}</p>
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {item.type_name || item.type}
                                                                </span>
                                                                {item.identifier ? (
                                                                    <span className="truncate text-[10px] text-muted-foreground">
                                                                        • ID: {item.identifier}
                                                                    </span>
                                                                ) : null}
                                                                {itemIssueCount === 0 && maintenanceStatus === "overdue" ? (
                                                                    <span className="text-[10px] font-medium text-rose-700">
                                                                        • ТО просрочено
                                                                    </span>
                                                                ) : null}
                                                                {itemIssueCount === 0 && maintenanceStatus === "serviced" ? (
                                                                    <span className="text-[10px] font-medium text-emerald-700">
                                                                        • Обслужено
                                                                    </span>
                                                                ) : null}
                                                                {itemIssueCount === 0 && maintenanceStatus === "disabled" ? (
                                                                    <span className="text-[10px] font-medium text-slate-500">
                                                                        • Без ТО
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 shrink-0 text-slate-400 opacity-100 transition-opacity hover:bg-rose-50 hover:text-rose-500 md:opacity-0 md:group-hover/item:opacity-100"
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

                                <CardFooter className="border-t border-slate-100 bg-slate-50 p-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 w-full bg-white text-xs transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                                        onClick={(e) => { e.stopPropagation(); onOpenAssignDialog(ws.id) }}
                                    >
                                        <Plus className="mr-1.5 h-3 w-3" /> Добавить оборудование
                                    </Button>
                                </CardFooter>
                            </Card>
                        </DeferredViewportItem>
                    )
                })}

                <DeferredViewportItem>
                    <button
                        onClick={() => onCreate(zone)}
                        className="group flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 p-6 text-slate-400 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary sm:min-h-[250px]"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-primary/10">
                            <Plus className="h-6 w-6" />
                        </div>
                        <span className="text-sm font-bold uppercase tracking-widest">Новое место в {zone}</span>
                    </button>
                </DeferredViewportItem>
            </div>
        </section>
    )
})
