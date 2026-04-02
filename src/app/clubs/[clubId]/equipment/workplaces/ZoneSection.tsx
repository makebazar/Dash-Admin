"use client"

import { memo } from "react"
import { AlertTriangle, Layers, Monitor, MoreVertical, Pencil, Plus, Trash2, User, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { WORKSTATION_CARD_EQUIPMENT_PREVIEW_LIMIT } from "./constants"
import type { ZoneSectionProps } from "./types"

export default memo(function ZoneSection({
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
        <section
            className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ contentVisibility: "auto", containIntrinsicSize: "900px" }}
        >
            <div className="group sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-2 py-2 backdrop-blur">
                <h2 className="flex items-center gap-3 text-lg font-black uppercase tracking-widest text-slate-500">
                    <Layers className="h-5 w-5 text-primary" />
                    {zone}
                    <Badge variant="secondary" className="border-none bg-slate-100 px-2 text-slate-600">{workstations.length}</Badge>
                    {zoneIssuesCount > 0 ? (
                        <Badge variant="outline" className="ml-2 flex items-center gap-1 border-orange-200 bg-orange-50 text-orange-700">
                            <AlertTriangle className="h-3 w-3" />
                            {zoneIssuesCount} проблем
                        </Badge>
                    ) : null}
                </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {workstations.map(ws => {
                    const wsEquipment = equipmentByWorkstationId.get(ws.id) ?? []
                    const wsIssueCount = activeIssueCountByWorkstationId.get(ws.id) ?? 0
                    const previewEquipment = wsEquipment.slice(0, WORKSTATION_CARD_EQUIPMENT_PREVIEW_LIMIT)
                    const hiddenEquipmentCount = Math.max(0, wsEquipment.length - previewEquipment.length)

                    return (
                        <Card
                            key={ws.id}
                            className={cn(
                                "group flex h-full cursor-pointer flex-col overflow-hidden border-slate-200 shadow-sm transition-all hover:border-primary/50",
                                wsIssueCount > 0 && "border-orange-200 bg-orange-50/10"
                            )}
                            onClick={() => onOpenDetails(ws.id)}
                        >
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-100 bg-slate-50/50 p-4 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "relative flex h-10 w-10 items-center justify-center rounded-xl border bg-white font-bold text-slate-400 shadow-sm",
                                        wsIssueCount > 0 && "border-orange-200 text-orange-500"
                                    )}>
                                        {ws.name.replace(/[^0-9]/g, '') || <Monitor className="h-5 w-5" />}
                                        {wsIssueCount > 0 ? (
                                            <div className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-orange-500" />
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

                            <CardContent className="flex-1 bg-white p-4">
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
                                        {previewEquipment.map(item => {
                                            const itemIssueCount = activeIssueCountByEquipmentId.get(item.id) ?? 0

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={cn(
                                                        "group/item relative flex items-center justify-between overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-2 pl-3 transition-all hover:border-primary/20 hover:bg-primary/5",
                                                        itemIssueCount > 0 && "border-l-[3px] border-l-orange-500 border-orange-200 bg-orange-50/30 pl-2.5"
                                                    )}
                                                >
                                                    <div className="relative z-10 flex items-center gap-3 overflow-hidden">
                                                        <div className={cn(
                                                            "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-white text-slate-500",
                                                            itemIssueCount > 0 && "border-orange-200 text-orange-500"
                                                        )}>
                                                            {renderEquipmentIcon(item.type)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={cn(
                                                                "truncate text-xs font-semibold text-slate-700 group-hover/item:text-primary",
                                                                itemIssueCount > 0 && "text-orange-700"
                                                            )}>{item.name}</p>
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="truncate text-[10px] text-muted-foreground">{item.brand} {item.model}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-slate-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover/item:opacity-100"
                                                        title="Убрать с места (на склад)"
                                                        onClick={(e) => { e.stopPropagation(); onUnassignEquipment(item.id) }}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )
                                        })}
                                        {hiddenEquipmentCount > 0 ? (
                                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-medium text-slate-500">
                                                + ещё {hiddenEquipmentCount} устройств
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </CardContent>

                            <CardFooter className="border-t border-slate-100 bg-slate-50 p-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-full bg-white text-xs shadow-sm transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground"
                                    onClick={(e) => { e.stopPropagation(); onOpenAssignDialog(ws.id) }}
                                >
                                    <Plus className="mr-1.5 h-3 w-3" /> Добавить оборудование
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })}

                <button
                    onClick={() => onCreate(zone)}
                    className="group flex min-h-[250px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-primary/10">
                        <Plus className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-widest">Новое место в {zone}</span>
                </button>
            </div>
        </section>
    )
})
