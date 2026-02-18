"use client"

import { useState, useTransition, useEffect } from "react"
import { Plus, Search, Calendar, User, ClipboardCheck, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createInventory, Inventory, getMetrics } from "../actions"
import { useParams } from "next/navigation"
import { ActiveInventory } from "./ActiveInventory"

interface InventoryTabProps {
    inventories: Inventory[]
    currentUserId: string
}

export function InventoryTab({ inventories, currentUserId }: InventoryTabProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [metrics, setMetrics] = useState<{ key: string, label: string }[]>([])
    
    // New Inventory State
    const [selectedMetric, setSelectedMetric] = useState("")

    // Active Inventory State
    const [activeInventoryId, setActiveInventoryId] = useState<number | null>(null)

    useEffect(() => {
        if (isDialogOpen && metrics.length === 0) {
            getMetrics().then(setMetrics)
        }
    }, [isDialogOpen, metrics.length])

    const handleStartInventory = () => {
        if (!selectedMetric) return
        startTransition(async () => {
            try {
                const newId = await createInventory(clubId, currentUserId, selectedMetric)
                setIsDialogOpen(false)
                setActiveInventoryId(newId)
            } catch (e) {
                console.error(e)
                alert("Ошибка при создании инвентаризации")
            }
        })
    }

    if (activeInventoryId) {
        return <ActiveInventory inventoryId={activeInventoryId} onClose={() => setActiveInventoryId(null)} />
    }

    // Check if there is already an OPEN inventory in the list
    const openInventory = inventories.find(i => i.status === 'OPEN')

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <h3 className="font-medium">История инвентаризаций</h3>
                {openInventory ? (
                    <Button onClick={() => setActiveInventoryId(openInventory.id)} variant="default" className="bg-amber-600 hover:bg-amber-700">
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Продолжить текущую
                    </Button>
                ) : (
                    <Button onClick={() => setIsDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Начать инвентаризацию
                    </Button>
                )}
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Дата</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Ответственный</TableHead>
                            <TableHead>Метрика сверки</TableHead>
                            <TableHead className="text-right">Заявлено</TableHead>
                            <TableHead className="text-right">По факту</TableHead>
                            <TableHead className="text-right">Разница</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inventories.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                    Инвентаризаций не проводилось
                                </TableCell>
                            </TableRow>
                        ) : inventories.map(inv => (
                            <TableRow key={inv.id}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">
                                            {new Date(inv.started_at).toLocaleDateString()}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(inv.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {inv.status === 'OPEN' ? (
                                        <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">В процессе</Badge>
                                    ) : (
                                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">Завершено</Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <User className="h-3 w-3 text-muted-foreground" />
                                        {inv.created_by_name || "Неизвестно"}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{inv.target_metric_key}</code>
                                </TableCell>
                                <TableCell className="text-right">
                                    {inv.status === 'CLOSED' ? `${Number(inv.reported_revenue).toLocaleString()} ₽` : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                    {inv.status === 'CLOSED' ? `${Number(inv.calculated_revenue).toLocaleString()} ₽` : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                    {inv.status === 'CLOSED' ? (
                                        <span className={inv.revenue_difference < 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                                            {inv.revenue_difference > 0 ? '+' : ''}{Number(inv.revenue_difference).toLocaleString()} ₽
                                        </span>
                                    ) : '—'}
                                </TableCell>
                                <TableCell>
                                    {inv.status === 'CLOSED' ? (
                                        <Button variant="ghost" size="sm" onClick={() => setActiveInventoryId(inv.id)}>
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" size="sm" onClick={() => setActiveInventoryId(inv.id)} className="text-amber-600">
                                            Продолжить
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* New Inventory Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Новая инвентаризация</DialogTitle>
                        <DialogDescription>
                            Выберите финансовый показатель из отчета, с которым будем сверять расчетную выручку.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Метрика выручки</Label>
                            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите метрику (например, Выручка бар)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {metrics.map(m => (
                                        <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Система посчитает проданные товары × цену и сравнит с суммой, которую админ внес в это поле в отчете.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleStartInventory} disabled={!selectedMetric || isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Начать подсчет
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
