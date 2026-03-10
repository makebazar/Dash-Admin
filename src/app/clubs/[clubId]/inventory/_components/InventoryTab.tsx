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
import { cn } from "@/lib/utils"
import { useUiDialogs } from "./useUiDialogs"

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
    const [selectedMetric, setSelectedMetric] = useState("none")
    const [selectedCategory, setSelectedCategory] = useState("all")
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>("")

    // Active Inventory State
    const [activeInventoryId, setActiveInventoryId] = useState<number | null>(null)
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const { showMessage, Dialogs } = useUiDialogs()

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
                setSelectedMetric("none") 
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
            if ((!selectedMetric || selectedMetric === "none") && !inventorySettings?.employee_default_metric_key) {
                showMessage({ title: "Настройка не завершена", description: "Не настроена метрика выручки для сотрудников. Обратитесь к администратору." })
                return
            }
        }
        
        if (!selectedWarehouse) {
            showMessage({ title: "Проверьте данные", description: "Выберите склад" })
            return
        }

        startTransition(async () => {
            try {
                const categoryId = selectedCategory === "all" ? null : Number(selectedCategory)
                const warehouseId = selectedWarehouse ? Number(selectedWarehouse) : null
                
                // For Owner, metric is always null (removed from UI)
                // For Employee, use selected OR default
                let metricKey: string | null = null
                
                if (!isOwner) {
                    metricKey = inventorySettings?.employee_default_metric_key || (selectedMetric === "none" ? null : selectedMetric)
                }

                const newId = await createInventory(clubId, currentUserId, metricKey, categoryId, warehouseId)
                setIsDialogOpen(false)
                setActiveInventoryId(newId)
            } catch (e) {
                console.error(e)
                showMessage({ title: "Ошибка", description: "Ошибка при создании инвентаризации" })
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
                showMessage({ title: "Ошибка", description: "Ошибка при удалении" })
            }
        })
    }

    if (activeInventoryId) {
        return <ActiveInventory inventoryId={activeInventoryId} onClose={() => setActiveInventoryId(null)} isOwner={isOwner} currentUserId={currentUserId} />
    }

    // Check if there is already an OPEN inventory in the list that belongs to the current user
    const openInventory = inventories.find(i => i.status === 'OPEN' && i.created_by === currentUserId)

    // Filter warehouses for dropdown
    const availableWarehouses = isOwner 
        ? warehouses 
        : warehouses.filter(w => (inventorySettings?.employee_allowed_warehouse_ids || []).includes(w.id))

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-3 md:p-4 rounded-lg border shadow-sm gap-3">
                <h3 className="font-medium text-sm md:text-base">История инвентаризаций</h3>
                {openInventory ? (
                    <Button onClick={() => setActiveInventoryId(openInventory.id)} variant="default" className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 h-10 md:h-9">
                        <ClipboardCheck className="mr-2 h-4 w-4 shrink-0" />
                        Продолжить текущую
                    </Button>
                ) : (
                    <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto h-10 md:h-9">
                        <Plus className="mr-2 h-4 w-4 shrink-0" />
                        Начать инвентаризацию
                    </Button>
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block rounded-md border bg-white overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead className="font-bold">Дата</TableHead>
                            <TableHead className="font-bold">Склад</TableHead>
                            <TableHead className="font-bold">Статус</TableHead>
                            <TableHead className="font-bold">Ответственный</TableHead>
                            <TableHead className="font-bold">Метрика сверки</TableHead>
                            <TableHead className="text-right font-bold">Заявлено</TableHead>
                            <TableHead className="text-right font-bold">По факту</TableHead>
                            <TableHead className="text-right font-bold">Разница</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inventories.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground italic">
                                    Инвентаризаций не проводилось
                                </TableCell>
                            </TableRow>
                        ) : inventories.map(inv => {
                            return (
                                <TableRow key={inv.id} className="hover:bg-slate-50 transition-colors">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {new Date(inv.started_at).toLocaleDateString('ru-RU')}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">
                                                {new Date(inv.started_at).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <WarehouseIcon className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-sm font-medium">{inv.warehouse_name || "Не указан"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {inv.status === 'OPEN' ? (
                                            <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-[10px] h-5 px-1.5 font-bold">В процессе</Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 text-[10px] h-5 px-1.5 font-bold">Завершено</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <User className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-sm">{inv.created_by_name || "Неизвестно"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {inv.target_metric_key ? (
                                            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-slate-600 border border-slate-200">{inv.target_metric_key}</code>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {inv.status === 'CLOSED' && inv.reported_revenue != null ? `${Number(inv.reported_revenue).toLocaleString()} ₽` : '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-slate-900">
                                        {inv.status === 'CLOSED' ? `${Number(inv.calculated_revenue).toLocaleString()} ₽` : '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {inv.status === 'CLOSED' ? (
                                            <span className={inv.revenue_difference < 0 ? "text-red-600 font-black" : "text-green-600 font-black"}>
                                                {inv.revenue_difference > 0 ? '+' : ''}{Number(inv.revenue_difference).toLocaleString()} ₽
                                            </span>
                                        ) : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-1">
                                            {inv.status === 'CLOSED' ? (
                                                <Button aria-label={`Открыть результаты инвентаризации ${inv.id}`} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => setActiveInventoryId(inv.id)}>
                                                    <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            ) : (
                                                inv.created_by === currentUserId ? (
                                                    <Button variant="ghost" size="sm" onClick={() => setActiveInventoryId(inv.id)} className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 px-2 text-xs font-bold">
                                                        Продолжить
                                                    </Button>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground italic px-2 font-medium">В процессе...</span>
                                                )
                                            )}
                                            <Button aria-label={`Удалить инвентаризацию ${inv.id}`} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors" onClick={() => setDeleteId(inv.id)}>
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

            {/* Mobile List View */}
            <div className="md:hidden space-y-3">
                {inventories.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground italic bg-white rounded-xl border border-dashed">Инвентаризаций не проводилось</div>
                ) : inventories.map(inv => {
                    const isClosed = inv.status === 'CLOSED';
                    return (
                        <div key={inv.id} className="bg-white rounded-xl border p-4 shadow-sm relative">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-slate-900">{new Date(inv.started_at).toLocaleDateString('ru-RU')}</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(inv.started_at).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                        <WarehouseIcon className="h-3 w-3 shrink-0" />
                                        <span>{inv.warehouse_name || "Не указан"}</span>
                                    </div>
                                </div>
                                {inv.status === 'OPEN' ? (
                                    <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-[10px] h-5 px-1.5 font-bold">В процессе</Badge>
                                ) : (
                                    <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 text-[10px] h-5 px-1.5 font-bold">Завершено</Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <User className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="text-xs text-slate-600 font-medium">{inv.created_by_name || "Неизвестно"}</span>
                                {inv.target_metric_key && (
                                    <>
                                        <span className="text-slate-200 mx-1">|</span>
                                        <code className="text-[10px] font-bold text-slate-500">{inv.target_metric_key}</code>
                                    </>
                                )}
                            </div>

                            {isClosed && (
                                <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-50 mb-3 bg-slate-50/30 -mx-4 px-4">
                                    <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Заявлено</p>
                                        <p className="text-xs font-bold text-slate-900">{Number(inv.reported_revenue || 0).toLocaleString()} ₽</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">По факту</p>
                                        <p className="text-xs font-bold text-slate-900">{Number(inv.calculated_revenue || 0).toLocaleString()} ₽</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Разница</p>
                                        <p className={cn(
                                            "text-xs font-black",
                                            inv.revenue_difference < 0 ? "text-red-600" : "text-green-600"
                                        )}>
                                            {inv.revenue_difference > 0 ? '+' : ''}{Number(inv.revenue_difference).toLocaleString()} ₽
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                {inv.status === 'CLOSED' ? (
                                    <Button variant="outline" className="flex-1 h-9 text-xs font-bold border-slate-200 text-slate-600" onClick={() => setActiveInventoryId(inv.id)}>
                                        Результаты
                                    </Button>
                                ) : (
                                    inv.created_by === currentUserId ? (
                                        <Button variant="default" className="flex-1 h-9 text-xs font-bold bg-amber-600 hover:bg-amber-700" onClick={() => setActiveInventoryId(inv.id)}>
                                            Продолжить
                                        </Button>
                                    ) : (
                                        <Button disabled variant="outline" className="flex-1 h-9 text-[10px] font-bold italic opacity-50">
                                            В процессе (другой админ)
                                        </Button>
                                    )
                                )}
                                <Button aria-label={`Удалить инвентаризацию ${inv.id}`} variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteId(inv.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
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
                                    <SelectItem value="all">Все товары (весь склад)</SelectItem>
                                    {categories.map(c => (
                                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Metric Selection */}
                        {/* Owner never sees metric selection (always null). Employees see it only if no default is set. */}
                        {!isOwner && !inventorySettings?.employee_default_metric_key && (
                            <div className="space-y-2">
                                <Label>Метрика выручки</Label>
                                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Выберите метрику" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {metrics.map(m => (
                                            <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Система сравнит расчетную выручку с суммой, указанной в отчете.
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleStartInventory} disabled={!selectedWarehouse || (!isOwner && (!selectedMetric || selectedMetric === "none")) || isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Начать подсчет
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {Dialogs}
        </div>
    )
}
