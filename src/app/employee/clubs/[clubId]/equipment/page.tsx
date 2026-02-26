"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import {
    LayoutGrid,
    ChevronLeft,
    Loader2,
    MapPin,
    Monitor,
    Layers,
    User,
    MousePointer2,
    Keyboard,
    Headphones,
    Gamepad2,
    Gamepad,
    Tv,
    Glasses,
    Square,
    Sofa,
    Wrench,
    ArrowRightLeft,
    Warehouse,
    AlertCircle,
    AlertTriangle,
    Flag,
    ArrowRight
} from "lucide-react"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import Link from "next/link"

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
    brand: string | null
    model: string | null
    workstation_id: string | null
    is_active: boolean
}

interface Zone {
    id: string
    name: string
}

export default function EmployeeEquipmentPage() {
    const { clubId } = useParams()
    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [zoneList, setZoneList] = useState<Zone[]>([])
    const [isLoading, setIsLoading] = useState(true)
    
    // Move Dialog State
    const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
    const [moveAction, setMoveAction] = useState<'SWAP' | 'REPLACE'>('SWAP')
    const [targetWorkstationId, setTargetWorkstationId] = useState<string>("")
    const [moveReason, setMoveReason] = useState("")
    const [isMoveWithIssue, setIsMoveWithIssue] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Details Dialog State (for viewing workstation contents)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [detailsWorkstationId, setDetailsWorkstationId] = useState<string | null>(null)

    // Report Issue Dialog State
    const [isReportIssueOpen, setIsReportIssueOpen] = useState(false)
    const [issueTitle, setIssueTitle] = useState("")
    const [issueDescription, setIssueDescription] = useState("")

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [wsRes, eqRes, zonesRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/workstations`),
                fetch(`/api/clubs/${clubId}/equipment?limit=1000`),
                fetch(`/api/clubs/${clubId}/zones`)
            ])

            const wsData = await wsRes.json()
            const eqData = await eqRes.json()

            if (zonesRes.ok) {
                const zonesData = await zonesRes.json()
                setZoneList(zonesData)
            }

            if (wsRes.ok && eqRes.ok) {
                const allEquipment = (eqData.equipment || []).filter((e: Equipment) => e.is_active)
                setEquipment(allEquipment)
                
                const enhancedWs = wsData.map((ws: Workstation) => ({
                    ...ws,
                    equipment_count: allEquipment.filter((e: Equipment) => e.workstation_id === ws.id).length
                }))
                setWorkstations(enhancedWs)
            }
        } catch (error) {
            console.error("Error fetching data:", error)
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

    // --- Helpers ---

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

    // --- Actions ---

    const handleOpenDetails = (wsId: string) => {
        setDetailsWorkstationId(wsId)
        setIsDetailsOpen(true)
    }

    const handleOpenMoveDialog = (item: Equipment) => {
        setSelectedEquipment(item)
        setMoveAction('SWAP')
        setTargetWorkstationId("")
        setMoveReason("")
        setIsMoveWithIssue(false)
        setIsMoveDialogOpen(true)
    }

    const handleOpenReportIssue = (item: Equipment) => {
        setSelectedEquipment(item)
        setIssueTitle("")
        setIssueDescription("")
        setIsReportIssueOpen(true)
    }

    const handleReportIssueSubmit = async () => {
        if (!selectedEquipment || !issueTitle.trim()) return

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/equipment/issues`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    equipment_id: selectedEquipment.id,
                    title: issueTitle,
                    description: issueDescription,
                    severity: 'MEDIUM'
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Не удалось создать инцидент")
            }

            alert("Проблема зарегистрирована")
            setIsReportIssueOpen(false)
        } catch (error: any) {
            console.error(error)
            alert(error.message || "Ошибка при создании инцидента")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleMoveSubmit = async () => {
        if (!selectedEquipment) return
        if (moveAction === 'SWAP' && !targetWorkstationId) {
            alert("Выберите целевое место для перемещения")
            return
        }
        if (!moveReason.trim()) {
            alert("Укажите причину перемещения")
            return
        }

        setIsSubmitting(true)
        try {
            // 1. Move Equipment
            const moveRes = await fetch(`/api/clubs/${clubId}/equipment/move`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    equipment_id: selectedEquipment.id,
                    target_workstation_id: moveAction === 'SWAP' ? targetWorkstationId : null,
                    action: moveAction,
                    reason: moveReason + (isMoveWithIssue ? " (Создан инцидент)" : "")
                })
            })

            const moveData = await moveRes.json()

            if (!moveRes.ok) {
                throw new Error(moveData.error || "Ошибка перемещения")
            }

            // 2. Create Issue if requested
            if (isMoveWithIssue) {
                const issueRes = await fetch(`/api/clubs/${clubId}/equipment/issues`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        equipment_id: selectedEquipment.id,
                        title: "Проблема при перемещении",
                        description: moveReason,
                        severity: 'MEDIUM'
                    })
                })

                if (!issueRes.ok) {
                    const issueData = await issueRes.json()
                    console.error("Failed to create issue:", issueData)
                    alert(`Оборудование перемещено, но не удалось создать инцидент: ${issueData.error || 'Unknown error'}`)
                }
            }

            alert(moveAction === 'SWAP' ? "Оборудование перемещено" : "Оборудование отправлено на склад")
            setIsMoveDialogOpen(false)
            fetchData()
        } catch (error: any) {
            console.error("Error moving equipment:", error)
            alert(error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    // --- Computed ---

    const activeWorkstation = useMemo(() => {
        return workstations.find(w => w.id === detailsWorkstationId) || null
    }, [workstations, detailsWorkstationId])

    const activeEquipment = useMemo(() => {
        return equipment.filter(item => item.workstation_id === detailsWorkstationId)
    }, [equipment, detailsWorkstationId])

    const availableTargets = useMemo(() => {
        if (!selectedEquipment) return []
        // Filter out current workstation
        return workstations.filter(w => w.id !== selectedEquipment.workstation_id)
    }, [workstations, selectedEquipment])

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto pb-24">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Перемещение оборудования</h1>
                        <p className="text-muted-foreground mt-1">Выберите рабочее место для управления устройствами</p>
                    </div>
                </div>
            </div>

            {/* Zones Grid */}
            <div className="space-y-12">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : zones.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold">Зоны не найдены</h3>
                    </div>
                ) : (
                    zones.map(zone => (
                        <section key={zone} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="group flex items-center px-2 sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b">
                                <h2 className="text-lg font-black uppercase tracking-widest text-slate-500 flex items-center gap-3">
                                    <Layers className="h-5 w-5 text-primary" />
                                    {zone}
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none px-2">{workstations.filter(w => w.zone === zone).length}</Badge>
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
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            
                                            <CardContent className="p-4 flex-1 bg-white">
                                                {wsEquipment.length === 0 ? (
                                                    <div className="h-full min-h-[100px] flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-100 rounded-lg p-4">
                                                        <Monitor className="h-8 w-8 text-slate-200 mb-2" />
                                                        <p className="text-xs text-muted-foreground font-medium">Пусто</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {wsEquipment.slice(0, 3).map(item => (
                                                            <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                                                <div className="h-6 w-6 rounded bg-white border flex items-center justify-center text-slate-500 shrink-0">
                                                                    {getEquipmentIcon(item.type)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold truncate text-slate-700">{item.name}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {wsEquipment.length > 3 && (
                                                            <div className="text-center text-xs text-muted-foreground pt-1">
                                                                + еще {wsEquipment.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </CardContent>
                                            
                                            <CardFooter className="p-3 bg-slate-50 border-t border-slate-100">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="w-full text-xs h-8 hover:bg-white hover:shadow-sm transition-all"
                                                >
                                                    Управление
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    )
                                })}
                            </div>
                        </section>
                    ))
                )}
            </div>

            {/* Workstation Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="w-screen h-screen max-w-none m-0 rounded-none flex flex-col p-0 sm:rounded-none">
                    <DialogHeader className="px-6 py-4 border-b">
                        <DialogTitle>{activeWorkstation ? `Оборудование: ${activeWorkstation.name}` : "Рабочее место"}</DialogTitle>
                        <DialogDescription>
                            Выберите устройство для перемещения или сообщите о проблеме.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {activeEquipment.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                Нет оборудования на этом месте.
                            </div>
                        ) : (
                            activeEquipment.map(item => (
                                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-200 bg-white shadow-sm gap-4">
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className="h-12 w-12 rounded-xl bg-slate-50 border flex items-center justify-center text-slate-500 shrink-0">
                                            {getEquipmentIcon(item.type)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-base truncate">{item.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-slate-100 text-slate-600">{item.type_name || item.type}</Badge>
                                                <span className="text-xs text-muted-foreground truncate">{item.brand} {item.model}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="flex-1 sm:flex-none gap-2"
                                            onClick={() => handleOpenReportIssue(item)}
                                        >
                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                            Проблема
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            className="flex-1 sm:flex-none gap-2 bg-indigo-600 hover:bg-indigo-700"
                                            onClick={() => handleOpenMoveDialog(item)}
                                        >
                                            <ArrowRightLeft className="h-4 w-4" />
                                            Переместить
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    
                    <DialogFooter className="p-6 border-t mt-auto">
                        <Button variant="ghost" onClick={() => setIsDetailsOpen(false)} className="w-full sm:w-auto">Закрыть</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Move/Swap Dialog */}
            <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
                <DialogContent className="w-screen h-screen max-w-none m-0 rounded-none flex flex-col p-0 sm:rounded-none">
                    <DialogHeader className="px-6 py-4 border-b">
                        <DialogTitle>Перемещение оборудования</DialogTitle>
                        <DialogDescription>
                            {selectedEquipment?.name} ({selectedEquipment?.type_name})
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* From / To Indicator */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex-1">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Откуда</p>
                                <p className="font-bold text-sm text-slate-900">
                                    {workstations.find(w => w.id === selectedEquipment?.workstation_id)?.name || "Склад"}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {workstations.find(w => w.id === selectedEquipment?.workstation_id)?.zone || "Зона хранения"}
                                </p>
                            </div>
                            <div className="px-4">
                                <ArrowRight className="h-5 w-5 text-slate-300" />
                            </div>
                            <div className="flex-1 text-right">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Куда</p>
                                {moveAction === 'REPLACE' ? (
                                    <div className="flex flex-col items-end">
                                        <p className="font-bold text-sm text-amber-600">Склад</p>
                                        <p className="text-xs text-amber-600/70">Списание / Ремонт</p>
                                    </div>
                                ) : targetWorkstationId ? (
                                    <div className="flex flex-col items-end">
                                        <p className="font-bold text-sm text-indigo-600">
                                            {workstations.find(w => w.id === targetWorkstationId)?.name}
                                        </p>
                                        <p className="text-xs text-indigo-600/70">
                                            {workstations.find(w => w.id === targetWorkstationId)?.zone}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="font-bold text-sm text-slate-400">Выберите место</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div 
                                className={cn(
                                    "cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all hover:bg-slate-50",
                                    moveAction === 'SWAP' ? "border-primary bg-primary/5" : "border-slate-200"
                                )}
                                onClick={() => setMoveAction('SWAP')}
                            >
                                <ArrowRightLeft className={cn("h-6 w-6", moveAction === 'SWAP' ? "text-primary" : "text-slate-400")} />
                                <span className="font-semibold text-sm">Переместить</span>
                                <span className="text-xs text-center text-muted-foreground">На другое место</span>
                            </div>
                            <div 
                                className={cn(
                                    "cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all hover:bg-slate-50",
                                    moveAction === 'REPLACE' ? "border-primary bg-primary/5" : "border-slate-200"
                                )}
                                onClick={() => setMoveAction('REPLACE')}
                            >
                                <Warehouse className={cn("h-6 w-6", moveAction === 'REPLACE' ? "text-primary" : "text-slate-400")} />
                                <span className="font-semibold text-sm">На склад</span>
                                <span className="text-xs text-center text-muted-foreground">Поломка / Замена</span>
                            </div>
                        </div>

                        {moveAction === 'SWAP' && (
                            <div className="space-y-2">
                                <Label>Выберите новое место</Label>
                                <Select value={targetWorkstationId} onValueChange={setTargetWorkstationId}>
                                    <SelectTrigger className="h-12 bg-white">
                                        <SelectValue placeholder="Нажмите для выбора..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        {availableTargets.map(ws => (
                                            <SelectItem key={ws.id} value={ws.id}>
                                                {ws.name} ({ws.zone})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {targetWorkstationId && (() => {
                                    const targetWs = workstations.find(w => w.id === targetWorkstationId)
                                    // Check if target has equipment of same type
                                    const targetHasSameType = equipment.some(e => 
                                        e.workstation_id === targetWorkstationId && 
                                        e.type === selectedEquipment?.type
                                    )
                                    
                                    if (targetHasSameType) {
                                        return (
                                            <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-md text-xs mt-2">
                                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                                <p>На выбранном месте уже есть устройство такого типа. Они поменяются местами (SWAP).</p>
                                            </div>
                                        )
                                    }
                                    return (
                                        <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-800 rounded-md text-xs mt-2">
                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <p>Устройство будет перемещено на выбранное место.</p>
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Есть проблема?</Label>
                                    <p className="text-xs text-muted-foreground">Создать инцидент при перемещении</p>
                                </div>
                                <Switch
                                    checked={isMoveWithIssue}
                                    onCheckedChange={setIsMoveWithIssue}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>
                                    {isMoveWithIssue ? "Опишите проблему" : "Причина перемещения"} 
                                    <span className="text-rose-500 ml-1">*</span>
                                </Label>
                                <Textarea 
                                    placeholder={
                                        isMoveWithIssue 
                                            ? "Что сломалось? Опишите неисправность..." 
                                            : moveAction === 'REPLACE' 
                                                ? "Почему отправляете на склад?" 
                                                : "Почему перемещаете устройство?"
                                    }
                                    value={moveReason}
                                    onChange={(e) => setMoveReason(e.target.value)}
                                    className="min-h-[100px] text-base p-4"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t mt-auto">
                        <Button variant="ghost" onClick={() => setIsMoveDialogOpen(false)} className="w-full sm:w-auto">Отмена</Button>
                        <Button onClick={handleMoveSubmit} disabled={isSubmitting} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {moveAction === 'SWAP' ? "Переместить" : "На склад"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Report Issue Dialog */}
            <Dialog open={isReportIssueOpen} onOpenChange={setIsReportIssueOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Сообщить о проблеме</DialogTitle>
                        <DialogDescription>
                            {selectedEquipment?.name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Что случилось? <span className="text-rose-500">*</span></Label>
                            <Input
                                placeholder="Краткое название проблемы"
                                value={issueTitle}
                                onChange={(e) => setIssueTitle(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Подробности</Label>
                            <Textarea
                                placeholder="Опишите детали, как воспроизвести..."
                                value={issueDescription}
                                onChange={(e) => setIssueDescription(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsReportIssueOpen(false)}>Отмена</Button>
                        <Button onClick={handleReportIssueSubmit} disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-700">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Отправить отчет
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
