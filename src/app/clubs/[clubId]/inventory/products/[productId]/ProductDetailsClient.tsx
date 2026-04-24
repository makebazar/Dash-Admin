"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { PageShell, PageHeader, PageToolbar, ToolbarGroup } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, Trash2, Plus, Barcode, TrendingUp, ArrowUpDown, History, Package, Box, RefreshCw } from "lucide-react"
import { Product, Category, Warehouse, ReplenishmentRule, createProduct, updateProduct, deleteProduct, adjustWarehouseStock, createReplenishmentRule, deleteReplenishmentRule, archiveProduct, restoreProduct } from "../../actions"
import { useUiDialogs } from "../../_components/useUiDialogs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ProductDetailsClientProps {
    clubId: string
    userId: string
    initialProduct: Product | null
    isNew: boolean
    categories: Category[]
    warehouses: Warehouse[]
    history: any[]
    rules: ReplenishmentRule[]
    clubSettings: any
    deletionStatus: { can_hard_delete: boolean } | null
}

export function ProductDetailsClient({ clubId, userId, initialProduct, isNew, categories, warehouses, history, rules, clubSettings, deletionStatus }: ProductDetailsClientProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const { confirmAction, showMessage, Dialogs } = useUiDialogs()

    const isArchived = Boolean(initialProduct?.deleted_at)
    const canHardDelete = Boolean(deletionStatus?.can_hard_delete)

    const [editingProduct, setEditingProduct] = useState<Partial<Product>>(
        initialProduct || { is_active: true, current_stock: 0, cost_price: 0, selling_price: 0, barcodes: [] }
    )
    const [desiredMarkup, setDesiredMarkup] = useState<string>(
        initialProduct && initialProduct.cost_price > 0 && initialProduct.selling_price > 0
            ? ((initialProduct.selling_price - initialProduct.cost_price) / initialProduct.cost_price * 100).toFixed(1)
            : ""
    )
    const [desiredMargin, setDesiredMargin] = useState<string>(
        initialProduct && initialProduct.cost_price > 0 && initialProduct.selling_price > 0
            ? ((initialProduct.selling_price - initialProduct.cost_price) / initialProduct.selling_price * 100).toFixed(1)
            : ""
    )

    // Stock adjustments
    const [stockAdjustments, setStockAdjustments] = useState<Record<number, string>>({})
    const [stockReasons, setStockReasons] = useState<Record<number, string>>({})
    
    // Replenishment
    const [newRuleSourceId, setNewRuleSourceId] = useState<string>("")
    const [newRuleTargetId, setNewRuleTargetId] = useState<string>("")
    const [newRuleMinLevel, setNewRuleMinLevel] = useState<string>("")
    const [newRuleMaxLevel, setNewRuleMaxLevel] = useState<string>("")

    // History Pagination & Filtering
    const [historyPage, setHistoryPage] = useState(1)
    const [historyFilterType, setHistoryFilterType] = useState<string>("all")
    const [historyFilterWarehouse, setHistoryFilterWarehouse] = useState<string>("all")

    const filteredHistory = useMemo(() => {
        return history.filter(log => {
            if (historyFilterWarehouse !== "all" && log.warehouse_id?.toString() !== historyFilterWarehouse) {
                return false
            }
            if (historyFilterType !== "all") {
                if (historyFilterType === "TRANSFER" && log.related_entity_type !== "TRANSFER") return false
                if (historyFilterType !== "TRANSFER" && (log.related_entity_type === "TRANSFER" || log.type !== historyFilterType)) return false
            }
            return true
        })
    }, [history, historyFilterType, historyFilterWarehouse])

    const HISTORY_PER_PAGE = 20
    const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PER_PAGE))
    
    const paginatedHistory = useMemo(() => {
        const start = (historyPage - 1) * HISTORY_PER_PAGE
        return filteredHistory.slice(start, start + HISTORY_PER_PAGE)
    }, [filteredHistory, historyPage])

    const handleSave = async () => {
        if (!editingProduct.name) return showMessage({ title: "Ошибка", description: "Название обязательно" })
        
        startTransition(async () => {
            try {
                if (isNew) {
                    await createProduct(clubId, userId, {
                        name: editingProduct.name!,
                        barcode: editingProduct.barcode || null,
                        barcodes: (editingProduct.barcodes || []).filter(b => b.trim() !== ""),
                        category_id: editingProduct.category_id || null,
                        cost_price: Number(editingProduct.cost_price) || 0,
                        selling_price: Number(editingProduct.selling_price) || 0,
                        current_stock: Number(editingProduct.current_stock) || 0,
                        min_stock_level: Number(editingProduct.min_stock_level) || 0,
                        units_per_box: Number(editingProduct.units_per_box) || 1
                    })
                    router.push(`/clubs/${clubId}/inventory`)
                } else {
                    await updateProduct(initialProduct!.id, clubId, userId, {
                        name: editingProduct.name!,
                        barcode: editingProduct.barcode || null,
                        barcodes: (editingProduct.barcodes || []).filter(b => b.trim() !== ""),
                        category_id: editingProduct.category_id || null,
                        cost_price: Number(editingProduct.cost_price) || 0,
                        selling_price: Number(editingProduct.selling_price) || 0,
                        min_stock_level: Number(editingProduct.min_stock_level) || 0,
                        is_active: editingProduct.is_active ?? true,
                        units_per_box: Number(editingProduct.units_per_box) || 1
                    })
                    showMessage({ title: "Успешно", description: "Товар сохранен" })
                    router.refresh()
                }
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message || "Не удалось сохранить" })
            }
        })
    }

    const handleDelete = async () => {
        if (isNew) return
        if (!initialProduct) return

        if (isArchived) {
            const confirmed = await confirmAction({
                title: "Восстановление товара",
                description: "Вернуть товар из архива?",
                confirmText: "Восстановить"
            })
            if (!confirmed) return
            startTransition(async () => {
                try {
                    await restoreProduct(initialProduct.id, clubId)
                    router.refresh()
                    showMessage({ title: "Успешно", description: "Товар восстановлен" })
                } catch (err: any) {
                    showMessage({ title: "Ошибка", description: err.message || "Не удалось восстановить" })
                }
            })
            return
        }

        if (!canHardDelete) {
            const confirmed = await confirmAction({
                title: "Архивация товара",
                description: "Скрыть товар из списка? История сохранится.",
                confirmText: "Архивировать"
            })
            if (!confirmed) return
            startTransition(async () => {
                try {
                    await archiveProduct(initialProduct.id, clubId)
                    router.refresh()
                    showMessage({ title: "Успешно", description: "Товар отправлен в архив" })
                } catch (err: any) {
                    showMessage({ title: "Ошибка", description: err.message || "Не удалось архивировать" })
                }
            })
            return
        }

        const confirmed = await confirmAction({
            title: "Удаление товара",
            description: "Вы уверены? Это действие нельзя отменить.",
            confirmText: "Удалить"
        })
        if (!confirmed) return
        startTransition(async () => {
            try {
                await deleteProduct(initialProduct.id, clubId)
                router.push(`/clubs/${clubId}/inventory`)
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message || "Не удалось удалить" })
            }
        })
    }

    const handleStockAdjust = async (warehouseId: number) => {
        if (!initialProduct) return
        const raw = stockAdjustments[warehouseId]
        if (raw === undefined || raw === "") return

        const newQuantity = Number(raw)
        if (!Number.isFinite(newQuantity) || !Number.isInteger(newQuantity) || newQuantity < 0) {
            return showMessage({
                title: "Ошибка",
                description: "Остаток должен быть целым неотрицательным числом"
            })
        }
        
        startTransition(async () => {
            try {
                await adjustWarehouseStock(
                    clubId,
                    userId,
                    Number(initialProduct.id),
                    Number(warehouseId),
                    newQuantity,
                    stockReasons[warehouseId] || "Ручная корректировка"
                )
                setStockAdjustments(prev => ({ ...prev, [warehouseId]: "" }))
                setStockReasons(prev => ({ ...prev, [warehouseId]: "" }))
                router.refresh()
                showMessage({ title: "Успешно", description: "Остатки обновлены" })
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message })
            }
        })
    }

    const handleAddRule = async () => {
        if (!initialProduct || !newRuleSourceId || !newRuleTargetId || !newRuleMinLevel || !newRuleMaxLevel) return
        startTransition(async () => {
            try {
                await createReplenishmentRule(clubId, {
                    product_id: initialProduct.id,
                    source_warehouse_id: Number(newRuleSourceId),
                    target_warehouse_id: Number(newRuleTargetId),
                    min_stock_level: Number(newRuleMinLevel),
                    max_stock_level: Number(newRuleMaxLevel)
                })
                setNewRuleSourceId("")
                setNewRuleTargetId("")
                setNewRuleMinLevel("")
                setNewRuleMaxLevel("")
                router.refresh()
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message })
            }
        })
    }

    const handleRemoveRule = async (ruleId: number) => {
        startTransition(async () => {
            try {
                await deleteReplenishmentRule(ruleId, clubId)
                router.refresh()
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message })
            }
        })
    }

    const getHistoryTypeMeta = (log: any) => {
        if (log.related_entity_type === "TRANSFER") {
            return {
                label: log.change_amount > 0 ? "Приход по перемещению" : "Расход по перемещению",
                className: log.change_amount > 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"
            }
        }
        switch (log.type) {
            case "SUPPLY": return { label: "Поставка", className: "text-emerald-700 bg-emerald-50 border-emerald-200" }
            case "SALE": return { label: "Продажа", className: "text-rose-700 bg-rose-50 border-rose-200" }
            case "RETURN": return { label: "Возврат", className: "text-violet-700 bg-violet-50 border-violet-200" }
            case "INVENTORY_GAIN": return { label: "Излишек инв.", className: "text-emerald-700 bg-emerald-50 border-emerald-200" }
            case "INVENTORY_LOSS": return { label: "Недостача инв.", className: "text-rose-700 bg-rose-50 border-rose-200" }
            case "INVENTORY_CORRECTION": return { label: "Коррекция инв.", className: "text-amber-700 bg-amber-50 border-amber-200" }
            case "WRITE_OFF": return { label: "Списание", className: "text-slate-700 bg-slate-100 border-slate-200" }
            case "ADJUSTMENT": return { label: "Ручная корректировка", className: "text-slate-700 bg-slate-100 border-slate-200" }
            default: return { label: log.type || "Движение", className: "text-slate-700 bg-slate-100 border-slate-200" }
        }
    }

    return (
        <PageShell maxWidth="5xl" className="pb-24 md:pb-8">
            {Dialogs}
            <div className="mb-6 hidden md:block">
                <Link href={`/clubs/${clubId}/inventory`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Назад к складу
                </Link>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                                {isNew ? "Новый товар" : initialProduct?.name}
                            </h1>
                            {!isNew && initialProduct?.abc_category && (
                                <Badge className={cn(
                                    "px-2 py-0.5 text-xs font-black uppercase rounded-md",
                                    initialProduct.abc_category === 'A' ? "bg-emerald-500 text-white" :
                                    initialProduct.abc_category === 'B' ? "bg-amber-500 text-white" :
                                    "bg-slate-400 text-white"
                                )}>
                                    {initialProduct.abc_category}
                                </Badge>
                            )}
                            {!isNew && !initialProduct?.is_active && (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-500">Архив</Badge>
                            )}
                        </div>
                        {!isNew && (
                            <p className="text-sm text-slate-500">
                                Артикул / Штрихкод: {initialProduct?.barcode || "—"}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {!isNew && (
                            <Button
                                variant="outline"
                                className={cn(
                                    "border-slate-200",
                                    isArchived
                                        ? "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                                        : canHardDelete
                                            ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                                            : "text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                                )}
                                onClick={handleDelete}
                                disabled={isPending}
                            >
                                {isArchived ? <RefreshCw className="h-4 w-4 mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                {isArchived ? "Восстановить" : canHardDelete ? "Удалить" : "Архив"}
                            </Button>
                        )}
                        <Button onClick={handleSave} disabled={isPending} className="bg-slate-900 text-white hover:bg-slate-800">
                            <Save className="h-4 w-4 mr-2" /> Сохранить
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Header */}
            <div className="mb-6 md:hidden">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            {isNew ? "Новый товар" : initialProduct?.name}
                        </h1>
                        {!isNew && initialProduct?.abc_category && (
                            <Badge className={cn(
                                "px-2 py-0.5 text-xs font-black uppercase rounded-md",
                                initialProduct.abc_category === 'A' ? "bg-emerald-500 text-white" :
                                initialProduct.abc_category === 'B' ? "bg-amber-500 text-white" :
                                "bg-slate-400 text-white"
                            )}>
                                {initialProduct.abc_category}
                            </Badge>
                        )}
                        {!isNew && !initialProduct?.is_active && (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500">Архив</Badge>
                        )}
                    </div>
                    {!isNew && (
                        <p className="text-sm text-slate-500">
                            Артикул: {initialProduct?.barcode || "—"}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Left Column - Main Settings */}
                <div className="md:col-span-2 space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Package className="h-5 w-5 text-slate-400" /> Основная информация
                        </h2>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2 sm:col-span-2">
                                <Label className="text-slate-500 font-medium">Название</Label>
                                <Input 
                                    value={editingProduct.name || ""} 
                                    onChange={e => setEditingProduct(p => ({ ...p, name: e.target.value }))}
                                    className="bg-slate-50 border-slate-200"
                                    placeholder="Например: Вода Аква Минерале 0.5л"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-500 font-medium">Категория</Label>
                                <Select 
                                    value={editingProduct.category_id?.toString() || "none"} 
                                    onValueChange={v => setEditingProduct(p => ({ ...p, category_id: v === "none" ? null : Number(v) }))}
                                >
                                    <SelectTrigger className="bg-slate-50 border-slate-200">
                                        <SelectValue placeholder="Без категории" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Без категории</SelectItem>
                                        {categories.map(c => (
                                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-500 font-medium">Статус</Label>
                                <Select 
                                    value={editingProduct.is_active ? "true" : "false"} 
                                    onValueChange={v => setEditingProduct(p => ({ ...p, is_active: v === "true" }))}
                                >
                                    <SelectTrigger className="bg-slate-50 border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">Активен (в продаже)</SelectItem>
                                        <SelectItem value="false">Архив (не продается)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2 sm:col-span-2 pt-2">
                                <Label className="text-slate-500 font-medium flex items-center gap-2">
                                    <Barcode className="h-4 w-4" /> Штрихкоды
                                </Label>
                                <div className="space-y-2">
                                    {(editingProduct.barcodes || []).map((bc, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <Input 
                                                value={bc} 
                                                onChange={e => {
                                                    const newBarcodes = [...(editingProduct.barcodes || [])]
                                                    newBarcodes[idx] = e.target.value
                                                    setEditingProduct(p => ({ ...p, barcodes: newBarcodes }))
                                                }}
                                                placeholder="Введите штрихкод"
                                                className="font-mono bg-slate-50 border-slate-200"
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => {
                                                const newBarcodes = (editingProduct.barcodes || []).filter((_, i) => i !== idx)
                                                setEditingProduct(p => ({ ...p, barcodes: newBarcodes }))
                                            }} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => {
                                        const newBarcodes = [...(editingProduct.barcodes || []), ""]
                                        setEditingProduct(p => ({ ...p, barcodes: newBarcodes }))
                                    }} className="w-full border-dashed text-slate-500">
                                        <Plus className="h-3 w-3 mr-2" /> Добавить штрихкод
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-slate-400" /> Ценообразование
                        </h2>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-500 font-medium">Закупочная цена (₽)</Label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    min="0"
                                    value={editingProduct.cost_price || ""} 
                                    onChange={e => setEditingProduct(p => ({ ...p, cost_price: Number(e.target.value) }))}
                                    className="bg-slate-50 border-slate-200 font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-500 font-medium">Цена продажи (₽)</Label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    min="0"
                                    value={editingProduct.selling_price || ""} 
                                    onChange={e => {
                                        const sp = Number(e.target.value)
                                        setEditingProduct(p => ({ ...p, selling_price: sp }))
                                        if (editingProduct.cost_price && editingProduct.cost_price > 0 && sp > 0) {
                                            setDesiredMarkup(((sp - editingProduct.cost_price) / editingProduct.cost_price * 100).toFixed(1))
                                            setDesiredMargin(((sp - editingProduct.cost_price) / sp * 100).toFixed(1))
                                        }
                                    }}
                                    className="bg-slate-50 border-slate-200 font-bold text-slate-900"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-500 font-medium text-xs">Расчет по наценке (%)</Label>
                                <Input 
                                    type="number" 
                                    step="0.1" 
                                    value={desiredMarkup} 
                                    onChange={e => {
                                        const mu = e.target.value
                                        setDesiredMarkup(mu)
                                        if (mu !== "" && editingProduct.cost_price) {
                                            const newSp = editingProduct.cost_price * (1 + Number(mu) / 100)
                                            setEditingProduct(p => ({ ...p, selling_price: Number(newSp.toFixed(2)) }))
                                            setDesiredMargin(((newSp - editingProduct.cost_price) / newSp * 100).toFixed(1))
                                        }
                                    }}
                                    className="bg-emerald-50/50 border-emerald-100 text-emerald-700"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-500 font-medium text-xs">Расчет по марже (%)</Label>
                                <Input 
                                    type="number" 
                                    step="0.1" 
                                    value={desiredMargin} 
                                    onChange={e => {
                                        const ma = e.target.value
                                        setDesiredMargin(ma)
                                        if (ma !== "" && editingProduct.cost_price && Number(ma) < 100) {
                                            const newSp = editingProduct.cost_price / (1 - Number(ma) / 100)
                                            setEditingProduct(p => ({ ...p, selling_price: Number(newSp.toFixed(2)) }))
                                            setDesiredMarkup(((newSp - editingProduct.cost_price) / editingProduct.cost_price * 100).toFixed(1))
                                        }
                                    }}
                                    className="bg-blue-50/50 border-blue-100 text-blue-700"
                                />
                            </div>
                        </div>
                    </div>

                    {/* History */}
                    {!isNew && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <Tabs defaultValue="history">
                                <TabsList className="mb-4 bg-slate-100/50 p-1">
                                    <TabsTrigger value="history" className="text-sm">Движение товара</TabsTrigger>
                                    <TabsTrigger value="price" className="text-sm">История цен</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="history" className="m-0 mt-4">
                                    <div className="flex gap-2 mb-4">
                                        <Select 
                                            value={historyFilterType} 
                                            onValueChange={(v) => { setHistoryFilterType(v); setHistoryPage(1); }}
                                        >
                                            <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                                                <SelectValue placeholder="Тип операции" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Все операции</SelectItem>
                                                <SelectItem value="SUPPLY">Поставки</SelectItem>
                                                <SelectItem value="SALE">Продажи</SelectItem>
                                                <SelectItem value="TRANSFER">Перемещения</SelectItem>
                                                <SelectItem value="WRITE_OFF">Списания</SelectItem>
                                                <SelectItem value="ADJUSTMENT">Корректировки</SelectItem>
                                                <SelectItem value="INVENTORY_GAIN">Излишки (инв.)</SelectItem>
                                                <SelectItem value="INVENTORY_LOSS">Недостачи (инв.)</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Select 
                                            value={historyFilterWarehouse} 
                                            onValueChange={(v) => { setHistoryFilterWarehouse(v); setHistoryPage(1); }}
                                        >
                                            <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200">
                                                <SelectValue placeholder="Склад" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Все склады</SelectItem>
                                                {warehouses.map(w => (
                                                    <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {filteredHistory.length > 0 ? (
                                        <div className="space-y-3">
                                            {paginatedHistory.map((log, idx) => {
                                                const meta = getHistoryTypeMeta(log)
                                                return (
                                                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Badge variant="outline" className={cn("text-[10px] font-bold tracking-wider uppercase", meta.className)}>
                                                                    {meta.label}
                                                                </Badge>
                                                                <span className="text-xs text-slate-500 font-medium">
                                                                    {new Date(log.created_at).toLocaleString('ru-RU')}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-slate-900 font-medium">
                                                                {log.user_name}
                                                                {log.warehouse_name && <span className="text-slate-500 font-normal"> · {log.warehouse_name}</span>}
                                                            </p>
                                                            {log.reason && <p className="text-xs text-slate-500 mt-0.5">{log.reason}</p>}
                                                        </div>
                                                        <div className="text-right">
                                                            <span className={cn(
                                                                "text-lg font-black",
                                                                log.change_amount > 0 ? "text-emerald-600" : log.change_amount < 0 ? "text-rose-600" : "text-slate-900"
                                                            )}>
                                                                {log.change_amount > 0 ? "+" : ""}{log.change_amount}
                                                            </span>
                                                            <p className="text-xs text-slate-500 font-medium">Остаток: {log.stock_after}</p>
                                                        </div>
                                                    </div>
                                                )
                                            })}

                                            {totalHistoryPages > 1 && (
                                                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-8 text-xs text-slate-600"
                                                        disabled={historyPage === 1}
                                                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                                    >
                                                        Назад
                                                    </Button>
                                                    <span className="text-xs font-medium text-slate-500">
                                                        {historyPage} из {totalHistoryPages}
                                                    </span>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-8 text-xs text-slate-600"
                                                        disabled={historyPage === totalHistoryPages}
                                                        onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                                                    >
                                                        Вперед
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                                            Ничего не найдено
                                        </div>
                                    )}
                                </TabsContent>
                                
                                <TabsContent value="price" className="m-0 mt-2">
                                    {initialProduct?.price_history && initialProduct.price_history.length > 0 ? (
                                        <div className="space-y-3">
                                            {initialProduct.price_history.map((ph: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Badge variant="secondary" className="text-[10px] font-bold tracking-wider uppercase bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">
                                                                Поставка
                                                            </Badge>
                                                            <span className="text-xs text-slate-500 font-medium">
                                                                {new Date(ph.created_at).toLocaleString('ru-RU')}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-900 font-medium">
                                                            {ph.supplier_name || "Неизвестный поставщик"}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-lg font-black text-slate-900">
                                                            {ph.cost_price} ₽
                                                        </span>
                                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-0.5">Закупка</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                                            История закупок пуста
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </div>

                {/* Right Column - Stock & Logistics */}
                <div className="space-y-6">
                    {/* Current Stock */}
                    {!isNew && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Box className="h-5 w-5 text-slate-400" /> Остатки
                            </h2>
                            <div className="mb-6 pb-6 border-b border-slate-100">
                                <p className="text-xs text-slate-400 uppercase font-black tracking-widest mb-1">Всего на складах</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-slate-900 tracking-tight">{initialProduct?.current_stock}</span>
                                    <span className="text-slate-500 font-medium">шт</span>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                {warehouses.map(w => {
                                    const stock = initialProduct?.stocks?.find(s => s.warehouse_id === w.id)?.quantity || 0
                                    return (
                                        <div key={w.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="font-medium text-slate-900 text-sm">{w.name}</span>
                                                <span className="font-black text-slate-900">{stock} шт</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <Input 
                                                    type="number" 
                                                    placeholder="Новый остаток" 
                                                    className="h-8 text-xs bg-white border-slate-200"
                                                    value={stockAdjustments[w.id] || ""}
                                                    onChange={e => setStockAdjustments(p => ({ ...p, [w.id]: e.target.value }))}
                                                />
                                                <Input 
                                                    placeholder="Причина (опц.)" 
                                                    className="h-8 text-xs bg-white border-slate-200"
                                                    value={stockReasons[w.id] || ""}
                                                    onChange={e => setStockReasons(p => ({ ...p, [w.id]: e.target.value }))}
                                                />
                                                <Button size="sm" className="h-8 px-2" onClick={() => handleStockAdjust(w.id)} disabled={stockAdjustments[w.id] === undefined || stockAdjustments[w.id] === ""}>
                                                    <Save className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Replenishment */}
                    {!isNew && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <RefreshCw className="h-5 w-5 text-slate-400" /> Правила пополнения
                            </h2>
                            <div className="space-y-3 mb-4">
                                {rules.map(rule => (
                                    <div key={rule.id} className="flex items-start justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className="text-[10px] font-bold tracking-wider uppercase text-slate-500 bg-white">
                                                    {rule.source_warehouse_name} → {rule.target_warehouse_name}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1">
                                                Пополнять если меньше: <span className="font-bold text-slate-900">{rule.min_stock_level}</span>
                                            </p>
                                            <p className="text-xs text-slate-600">
                                                Пополнять до уровня: <span className="font-bold text-slate-900">{rule.max_stock_level}</span>
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveRule(rule.id)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-8 w-8">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-3 pt-4 border-t border-slate-100">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Новое правило</p>
                                <Select value={newRuleSourceId} onValueChange={setNewRuleSourceId}>
                                    <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-sm">
                                        <SelectValue placeholder="Откуда брать (Источник)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses.map(w => (
                                            <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={newRuleTargetId} onValueChange={setNewRuleTargetId}>
                                    <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-sm">
                                        <SelectValue placeholder="Куда пополнять (Цель)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses.map(w => (
                                            <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Порог (Мин)</Label>
                                        <Input 
                                            type="number" 
                                            placeholder="Напр. 5" 
                                            value={newRuleMinLevel}
                                            onChange={e => setNewRuleMinLevel(e.target.value)}
                                            className="h-9 text-sm bg-slate-50 border-slate-200"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">До (Макс)</Label>
                                        <Input 
                                            type="number" 
                                            placeholder="Напр. 20" 
                                            value={newRuleMaxLevel}
                                            onChange={e => setNewRuleMaxLevel(e.target.value)}
                                            className="h-9 text-sm bg-slate-50 border-slate-200"
                                        />
                                    </div>
                                </div>
                                <Button onClick={handleAddRule} disabled={!newRuleSourceId || !newRuleTargetId || !newRuleMinLevel || !newRuleMaxLevel} className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white">
                                    <Plus className="h-4 w-4 mr-2" /> Добавить правило
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Bottom Actions (Sticky) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden z-50 flex items-center justify-between gap-3">
                <Button variant="outline" className="flex-1 bg-slate-50 border-slate-200" onClick={() => router.push(`/clubs/${clubId}/inventory`)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Назад
                </Button>
                <Button onClick={handleSave} disabled={isPending} className="flex-1 bg-slate-900 text-white hover:bg-slate-800">
                    <Save className="h-4 w-4 mr-2" /> Сохранить
                </Button>
            </div>
        </PageShell>
    )
}
