"use client"

import { useState, useTransition, useEffect } from "react"
import { Plus, Search, Calendar, User, ClipboardCheck, ArrowRight, CheckCircle2, AlertTriangle, Loader2, Trash2, Warehouse as WarehouseIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createInventory, deleteInventory, Inventory, Category, Warehouse, getMetrics } from "../actions"
import { useParams } from "next/navigation"
import { ActiveInventory } from "./ActiveInventory"

interface InventoryTabProps {
    inventories: Inventory[]
    categories: Category[]
    warehouses: Warehouse[]
    currentUserId: string
    isOwner: boolean
    inventorySettings: { 
        employee_allowed_warehouse_ids?: number[], 
        employee_default_metric_key?: string 
    }
}

export function InventoryTab({ inventories, categories, warehouses, currentUserId, isOwner, inventorySettings }: InventoryTabProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [metrics, setMetrics] = useState<{ key: string, label: string }[]>([])
    
    // New Inventory State
    const [selectedMetric, setSelectedMetric] = useState("")
    const [selectedCategory, setSelectedCategory] = useState("all")
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>("")

    // Active Inventory State
    const [activeInventoryId, setActiveInventoryId] = useState<number | null>(null)
    const [deleteId, setDeleteId] = useState<number | null>(null)

    useEffect(() => {
        if (isDialogOpen && metrics.length === 0) {
            getMetrics().then(setMetrics)
        }
    }, [isDialogOpen, metrics.length])

    // Initialize defaults when Dialog opens
    useEffect(() => {
        if (isDialogOpen) {
            if (isOwner) {
                // Owner: Default to first warehouse, metric empty
                if (warehouses.length > 0) setSelectedWarehouse(warehouses[0].id.toString())
                setSelectedMetric("") 
                setSelectedCategory("all")
            } else {
                // Employee: Apply restrictions
                const allowed = inventorySettings?.employee_allowed_warehouse_ids || []
                
                // Filter allowed warehouses
                const available = warehouses.filter(w => allowed.includes(w.id))
                
                if (available.length > 0) {
                    setSelectedWarehouse(available[0].id.toString())
                }
                
                // Set default metric
                if (inventorySettings?.employee_default_metric_key) {
                    setSelectedMetric(inventorySettings.employee_default_metric_key)
                }
                setSelectedCategory("all")
            }
        }
    }, [isDialogOpen, isOwner, inventorySettings, warehouses])

    const handleStartInventory = () => {
        // Validation
        if (!isOwner) {
            if (!selectedMetric && !inventorySettings?.employee_default_metric_key) {
                alert("Не настроена метрика выручки для сотрудников. Обратитесь к администратору.")
                return
            }
        }
        
        if (!selectedWarehouse) {
            alert("Выберите склад")
            return
        }

        startTransition(async () => {
            try {
                const categoryId = selectedCategory === "all" ? null : Number(selectedCategory)
                const warehouseId = selectedWarehouse ? Number(selectedWarehouse) : null
                const metricKey = selectedMetric || null 

                const newId = await createInventory(clubId, currentUserId, metricKey, categoryId, warehouseId)
                setIsDialogOpen(false)
                setActiveInventoryId(newId)
            } catch (e) {
                console.error(e)
                alert("Ошибка при создании инвентаризации")
            }
        })
    }

    const handleDelete = async () => {
        if (!deleteId) return
        startTransition(async () => {
            try {
                await deleteInventory(deleteId, clubId, currentUserId)
                setDeleteId(null)
            } catch (e) {
                console.error(e)
                alert("Ошибка при удалении")
            }
        })
    }

    if (activeInventoryId) {
        return <ActiveInventory inventoryId={activeInventoryId} onClose={() => setActiveInventoryId(null)} />
    }

    // Check if there is already an OPEN inventory in the list
    const openInventory = inventories.find(i => i.status === 'OPEN')

    // Filter warehouses for dropdown
    const availableWarehouses = isOwner 
        ? warehouses 
        : warehouses.filter(w => (inventorySettings?.employee_allowed_warehouse_ids || []).includes(w.id))

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
                            <TableHead>Склад</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Ответственный</TableHead>
                            <TableHead>Метрика сверки</TableHead>
                            <TableHead className="text-right">Заявлено</TableHead>
                            <TableHead className="text-right">По факту</TableHead>
                            <TableHead className="text-right">Разница</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inventories.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                    Инвентаризаций не проводилось
                                </TableCell>
                            </TableRow>
                        ) : inventories.map(inv => {
                            // Find warehouse name if possible (assuming inv has warehouse_id now, need to fetch it or join it)
                            // The `getInventories` action should return warehouse_id. 
                            // I didn't update `getInventories` SQL to join warehouse name or select warehouse_id.
                            // I should verify `getInventories` SQL. 
                            // Assuming I'll update it or just show ID for now if needed, but better to fix action.
                            // The `Inventory` type has `warehouse_name`.
                            return (
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
                                        <div className="flex items-center gap-2">
                                            <WarehouseIcon className="h-3 w-3 text-muted-foreground" />
                                            {inv.warehouse_name || "Все склады"}
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
                                        {inv.target_metric_key ? (
                                            <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{inv.target_metric_key}</code>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {inv.status === 'CLOSED' && inv.reported_revenue != null ? `${Number(inv.reported_revenue).toLocaleString()} ₽` : '—'}
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
                                        <div className="flex items-center justify-end gap-2">
                                            {inv.status === 'CLOSED' ? (
                                                <Button variant="ghost" size="icon" onClick={() => setActiveInventoryId(inv.id)}>
                                                    <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            ) : (
                                                <Button variant="ghost" size="sm" onClick={() => setActiveInventoryId(inv.id)} className="text-amber-600 h-8 px-2">
                                                    Продолжить
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteId(inv.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Удаление инвентаризации</DialogTitle>
                        <DialogDescription>
                            Вы уверены, что хотите удалить эту запись? Это действие нельзя отменить.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Удалить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Inventory Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Новая инвентаризация</DialogTitle>
                        <DialogDescription>
                            {isOwner 
                                ? "Выберите склад для проведения инвентаризации." 
                                : "Подтвердите параметры начала инвентаризации."}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        {/* Warehouse Selection */}
                        <div className="space-y-2">
                            <Label>Склад</Label>
                            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите склад" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableWarehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {!isOwner && availableWarehouses.length === 0 && (
                                <p className="text-xs text-red-500">Нет доступных складов для инвентаризации.</p>
                            )}
                        </div>

                        {/* Category Selection (Optional) */}
                        <div className="space-y-2">
                            <Label>Категория (фильтр)</Label>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Весь склад" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Весь склад (все товары)</SelectItem>
                                    {categories.map(c => (
                                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Metric Selection */}
                        {(isOwner || !inventorySettings?.employee_default_metric_key) && (
                            <div className="space-y-2">
                                <Label>Метрика выручки {isOwner && <span className="text-muted-foreground font-normal">(необязательно)</span>}</Label>
                                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={isOwner ? "Не привязывать к выручке" : "Выберите метрику"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isOwner && <SelectItem value="">Не привязывать</SelectItem>}
                                        {metrics.map(m => (
                                            <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {selectedMetric 
                                        ? "Система сравнит расчетную выручку с суммой, указанной в отчете." 
                                        : "Инвентаризация будет проведена только по количеству, без сверки с деньгами."}
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleStartInventory} disabled={!selectedWarehouse || (!isOwner && !selectedMetric) || isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Начать подсчет
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
