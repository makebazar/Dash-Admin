"use client"

import { useState, useTransition, useEffect, useMemo } from "react"
import { Plus, User, ClipboardCheck, ArrowRight, Loader2, Trash2, Warehouse as WarehouseIcon, Clock3, Boxes, CheckCircle2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { createInventory, cancelInventory, Inventory, Category, Warehouse, getMetrics } from "../actions"
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
    const [cancelId, setCancelId] = useState<number | null>(null)
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
                showMessage({ title: "Ошибка", description: e instanceof Error ? e.message : "Ошибка при создании инвентаризации" })
            }
        })
    }

    const handleCancel = async () => {
        if (!cancelId) return
        startTransition(async () => {
            try {
                await cancelInventory(cancelId, clubId, currentUserId)
                setCancelId(null)
            } catch (e) {
                console.error(e)
                showMessage({ title: "Ошибка", description: e instanceof Error ? e.message : "Ошибка при отмене инвентаризации" })
            }
        })
    }

    const inventoryStats = useMemo(() => {
        const openCount = inventories.filter(inv => inv.status === "OPEN").length
        const closedCount = inventories.filter(inv => inv.status === "CLOSED").length
        const canceledCount = inventories.filter(inv => inv.status === "CANCELED").length
        const withMetricCount = inventories.filter(inv => Boolean(inv.target_metric_key)).length
        return {
            total: inventories.length,
            open: openCount,
            closed: closedCount,
            canceled: canceledCount,
            withMetric: withMetricCount
        }
    }, [inventories])

    // Check if there is already an OPEN inventory in the club
    const openInventory = inventories.find(i => i.status === 'OPEN')

    // Filter warehouses for dropdown
    const availableWarehouses = isOwner 
        ? warehouses 
        : warehouses.filter(w => (inventorySettings?.employee_allowed_warehouse_ids || []).includes(w.id))

    const inventoryCards = [
        {
            label: "Всего инвентаризаций",
            value: inventoryStats.total,
            hint: inventoryStats.total === 0 ? "Пока нет истории" : "Вся история по клубу",
            icon: ClipboardCheck,
            tone: "text-foreground bg-muted border-border"
        },
        {
            label: "Сейчас в работе",
            value: inventoryStats.open,
            hint: openInventory ? `Открыта #${openInventory.id}` : "Можно запускать новую",
            icon: Clock3,
            tone: "text-amber-700 bg-amber-50 border-amber-200"
        },
        {
            label: "Завершено",
            value: inventoryStats.closed,
            hint: inventoryStats.closed > 0 ? "Есть результаты для анализа" : "Закрытых ещё нет",
            icon: CheckCircle2,
            tone: "text-green-700 bg-green-50 border-green-200"
        },
        {
            label: "Отменено",
            value: inventoryStats.canceled,
            hint: inventoryStats.canceled > 0 ? "История отмен сохранена" : "Отмен пока не было",
            icon: Sparkles,
            tone: "text-foreground bg-muted border-border"
        },
        {
            label: "Складов доступно",
            value: availableWarehouses.length,
            hint: isOwner ? "Все склады клуба" : "С учётом ограничений роли",
            icon: Boxes,
            tone: "text-blue-700 bg-blue-50 border-blue-200"
        }
    ]

    const formatMoney = (value: number | null | undefined) => {
        if (value == null) return "—"
        return `${Number(value).toLocaleString("ru-RU")} ₽`
    }

    if (activeInventoryId) {
        return <ActiveInventory inventoryId={activeInventoryId} onClose={() => setActiveInventoryId(null)} isOwner={isOwner} currentUserId={currentUserId} />
    }

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border bg-gradient-to-br from-white via-slate-50 to-slate-100 p-4 md:p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                            Инвентаризация
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground md:text-2xl">Проведение и история подсчётов</h3>
                            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                                Здесь удобно запускать новую инвентаризацию, быстро возвращаться к активной и смотреть результаты прошлых сверок.
                            </p>
                        </div>
                    </div>

                    {openInventory ? (
                        <Button onClick={() => setActiveInventoryId(openInventory.id)} className="h-11 rounded-xl bg-amber-600 px-4 font-bold hover:bg-amber-700">
                            <ClipboardCheck className="mr-2 h-4 w-4" />
                            {openInventory.created_by === currentUserId ? `Продолжить #${openInventory.id}` : `Открыть активную #${openInventory.id}`}
                        </Button>
                    ) : (
                        <Button onClick={() => setIsDialogOpen(true)} className="h-11 rounded-xl px-4 font-bold">
                            <Plus className="mr-2 h-4 w-4" />
                            Начать новую инвентаризацию
                        </Button>
                    )}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {inventoryCards.map(card => {
                        const Icon = card.icon
                        return (
                            <Card key={card.label} className="border-border/80 shadow-none">
                                <CardContent className="flex items-start justify-between p-4">
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{card.label}</p>
                                        <p className="text-2xl font-black text-foreground">{card.value}</p>
                                        <p className="text-xs text-muted-foreground">{card.hint}</p>
                                    </div>
                                    <div className={cn("rounded-xl border p-2.5", card.tone)}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>

                {openInventory && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-sm font-bold text-amber-900">Сейчас открыта инвентаризация #{openInventory.id}</p>
                                <p className="text-xs text-amber-800/80">
                                    Склад: {openInventory.warehouse_name || "Не указан"} · Ответственный: {openInventory.created_by_name || "Неизвестно"}
                                </p>
                            </div>
                            <Badge variant="outline" className="w-fit border-amber-300 bg-card text-amber-700">В процессе</Badge>
                        </div>
                    </div>
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-sm md:block">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/80">
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
                            const isOpen = inv.status === "OPEN"
                            const isMine = inv.created_by === currentUserId
                            return (
                                <TableRow key={inv.id} className={cn(
                                    "transition-colors hover:bg-muted",
                                    isOpen && "bg-amber-50/40",
                                    isMine && isOpen && "ring-1 ring-inset ring-amber-100"
                                )}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {new Date(inv.started_at).toLocaleDateString('ru-RU')}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground/70 font-bold uppercase">
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
                                        ) : inv.status === 'CANCELED' ? (
                                            <Badge variant="outline" className="border-border text-muted-foreground bg-muted text-[10px] h-5 px-1.5 font-bold">Отменено</Badge>
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
                                            <code className="bg-accent px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-muted-foreground border border-border">{inv.target_metric_key}</code>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {inv.status === 'CLOSED' ? formatMoney(inv.reported_revenue) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-foreground">
                                        {inv.status === 'CLOSED' ? formatMoney(inv.calculated_revenue) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {inv.status === 'CLOSED' ? (
                                            <span className={inv.revenue_difference < 0 ? "text-red-600 font-black" : "text-green-600 font-black"}>
                                                {inv.revenue_difference > 0 ? '+' : ''}{Number(inv.revenue_difference).toLocaleString('ru-RU')} ₽
                                            </span>
                                        ) : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-1">
                                            {inv.status === 'CLOSED' ? (
                                                <Button aria-label={`Открыть результаты инвентаризации ${inv.id}`} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/70 hover:text-blue-600" onClick={() => setActiveInventoryId(inv.id)}>
                                                    <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            ) : inv.status === 'CANCELED' ? (
                                                <span className="text-[10px] text-muted-foreground/70 italic px-2 font-medium">Отменена</span>
                                            ) : (
                                                inv.created_by === currentUserId ? (
                                                    <Button variant="ghost" size="sm" onClick={() => setActiveInventoryId(inv.id)} className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 px-2 text-xs font-bold">
                                                        Продолжить
                                                    </Button>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground italic px-2 font-medium">В процессе...</span>
                                                )
                                            )}
                                            {inv.status === 'OPEN' && (
                                                <Button aria-label={`Отменить инвентаризацию ${inv.id}`} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors" onClick={() => setCancelId(inv.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
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
                    <div className="rounded-2xl border border-dashed bg-card px-4 py-12 text-center text-sm italic text-muted-foreground">
                        Инвентаризаций пока не было
                    </div>
                ) : inventories.map(inv => {
                    const isClosed = inv.status === 'CLOSED';
                    const isCanceled = inv.status === 'CANCELED';
                    return (
                        <div key={inv.id} className={cn(
                            "rounded-2xl border p-4 shadow-sm",
                            isClosed ? "bg-card" : isCanceled ? "bg-muted/70" : "border-amber-200 bg-amber-50/40"
                        )}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-foreground">{new Date(inv.started_at).toLocaleDateString('ru-RU')}</span>
                                        <span className="text-[10px] text-muted-foreground/70 font-bold uppercase">{new Date(inv.started_at).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                        <WarehouseIcon className="h-3 w-3 shrink-0" />
                                        <span>{inv.warehouse_name || "Не указан"}</span>
                                    </div>
                                </div>
                                {inv.status === 'OPEN' ? (
                                    <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-[10px] h-5 px-1.5 font-bold">В процессе</Badge>
                                ) : isCanceled ? (
                                    <Badge variant="outline" className="border-border text-muted-foreground bg-muted text-[10px] h-5 px-1.5 font-bold">Отменено</Badge>
                                ) : (
                                    <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 text-[10px] h-5 px-1.5 font-bold">Завершено</Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <User className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                                <span className="text-xs text-muted-foreground font-medium">{inv.created_by_name || "Неизвестно"}</span>
                                {inv.target_metric_key && (
                                    <>
                                        <span className="text-slate-200 mx-1">|</span>
                                        <code className="text-[10px] font-bold text-muted-foreground">{inv.target_metric_key}</code>
                                    </>
                                )}
                            </div>

                            {isClosed && (
                                <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-50 mb-3 bg-muted/30 -mx-4 px-4">
                                    <div>
                                        <p className="text-[9px] text-muted-foreground/70 uppercase font-bold mb-0.5">Заявлено</p>
                                        <p className="text-xs font-bold text-foreground">{formatMoney(inv.reported_revenue)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] text-muted-foreground/70 uppercase font-bold mb-0.5">По факту</p>
                                        <p className="text-xs font-bold text-foreground">{formatMoney(inv.calculated_revenue)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-muted-foreground/70 uppercase font-bold mb-0.5">Разница</p>
                                        <p className={cn(
                                            "text-xs font-black",
                                            inv.revenue_difference < 0 ? "text-red-600" : "text-green-600"
                                        )}>
                                            {inv.revenue_difference > 0 ? '+' : ''}{Number(inv.revenue_difference).toLocaleString('ru-RU')} ₽
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                {inv.status === 'CLOSED' ? (
                                    <Button variant="outline" className="flex-1 h-9 text-xs font-bold border-border text-muted-foreground" onClick={() => setActiveInventoryId(inv.id)}>
                                        Результаты
                                    </Button>
                                ) : isCanceled ? (
                                    <Button disabled variant="outline" className="flex-1 h-9 text-xs font-bold border-border text-muted-foreground/70">
                                        Отменена
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
                                {inv.status === 'OPEN' && (
                                    <Button aria-label={`Отменить инвентаризацию ${inv.id}`} variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-red-600 hover:bg-red-50" onClick={() => setCancelId(inv.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Отмена инвентаризации</DialogTitle>
                        <DialogDescription>
                            Открытая инвентаризация будет отменена. Закрытые инвентаризации удалять нельзя, они сохраняются как история.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelId(null)}>Отмена</Button>
                        <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Отменить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Inventory Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>Новая инвентаризация</DialogTitle>
                        <DialogDescription>
                            {isOwner 
                                ? "Выберите склад для проведения инвентаризации." 
                                : "Подтвердите параметры начала инвентаризации."}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="grid gap-3 rounded-2xl border bg-muted/70 p-4 md:grid-cols-3">
                            <div className="space-y-1 rounded-xl bg-card p-3 border">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Склад</p>
                                <p className="text-sm font-semibold text-foreground">{selectedWarehouse ? availableWarehouses.find(w => w.id.toString() === selectedWarehouse)?.name || "Выберите склад" : "Выберите склад"}</p>
                            </div>
                            <div className="space-y-1 rounded-xl bg-card p-3 border">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Категория</p>
                                <p className="text-sm font-semibold text-foreground">{selectedCategory === "all" ? "Весь склад" : categories.find(c => c.id.toString() === selectedCategory)?.name || "Категория"}</p>
                            </div>
                            <div className="space-y-1 rounded-xl bg-card p-3 border">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Сверка</p>
                                <p className="text-sm font-semibold text-foreground">
                                    {isOwner ? "Без кассовой метрики" : inventorySettings?.employee_default_metric_key || metrics.find(m => m.key === selectedMetric)?.label || "Нужно выбрать"}
                                </p>
                            </div>
                        </div>

                        {/* Warehouse Selection */}
                        <div className="space-y-2">
                            <Label>Склад для подсчёта</Label>
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
                            <Label>Что считать</Label>
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
                        <Button onClick={handleStartInventory} disabled={!selectedWarehouse || (!isOwner && !inventorySettings?.employee_default_metric_key && (!selectedMetric || selectedMetric === "none")) || isPending}>
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
