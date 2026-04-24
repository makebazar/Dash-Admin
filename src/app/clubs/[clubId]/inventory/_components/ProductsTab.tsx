"use client"

import { useMemo, useState, useTransition } from "react"
import { Plus, Search, MoreVertical, Pencil, Trash2, LayoutGrid, Box, RefreshCw, Layers, Barcode, History, TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createProduct, updateProduct, deleteProduct, bulkUpdatePrices, writeOffProduct, getProductHistory, Product, Category, adjustWarehouseStock, getReplenishmentRulesForProduct, createReplenishmentRule, deleteReplenishmentRule, ReplenishmentRule, Warehouse, PriceTagSettings, archiveProduct, restoreProduct } from "../actions"
import { PageToolbar, ToolbarGroup, SearchInput } from "@/components/layout/PageShell"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { useUiDialogs } from "./useUiDialogs"
import { PriceTagPrinter } from "./PriceTagPrinter"
import { Printer } from "lucide-react"

interface ProductsTabProps {
    products: Product[]
    categories: Category[]
    warehouses: Warehouse[]
    currentUserId: string
    priceTagSettings?: PriceTagSettings
}

export function ProductsTab({ products, categories, warehouses, currentUserId, priceTagSettings }: ProductsTabProps) {
    const params = useParams()
    const router = useRouter()
    const clubId = params.clubId as string
    
    const activeTemplate = priceTagSettings?.templates.find(t => t.id === priceTagSettings.active_template_id) || priceTagSettings?.templates[0]
    
    const [search, setSearch] = useState("")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [productsView, setProductsView] = useState<"active" | "archived">("active")
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)

    type SortKey = "name" | "category" | "cost_price" | "selling_price" | "markup" | "margin" | "stock" | "sum"
    const [sortKey, setSortKey] = useState<SortKey | null>(null)
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
    
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null)
    const [desiredMarkup, setDesiredMarkup] = useState<string>("")
    const [desiredMargin, setDesiredMargin] = useState<string>("")
    
    // Warehouse Stock Management
    const [manageStockDialog, setManageStockDialog] = useState<{ isOpen: boolean, product: Product | null }>({ isOpen: false, product: null })
    
    // Replenishment Rules
    const [replenishmentDialog, setReplenishmentDialog] = useState<{ isOpen: boolean, product: Product | null, rules: ReplenishmentRule[] }>({ isOpen: false, product: null, rules: [] })
    
    const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
    const [bulkAction, setBulkAction] = useState<{ type: 'fixed' | 'percent', value: string }>({ type: 'fixed', value: '' })
    
    // Write-off state
    const [writeOffDialog, setWriteOffDialog] = useState<{ isOpen: boolean, product: Product | null }>({ isOpen: false, product: null })
    const [writeOffAmount, setWriteOffAmount] = useState("")
    const [writeOffReason, setWriteOffReason] = useState("")

    // History state
    const [historyDialog, setHistoryDialog] = useState<{ isOpen: boolean, product: Product | null, logs: any[] }>({ isOpen: false, product: null, logs: [] })
    const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false)

    const [isPending, startTransition] = useTransition()
    const { confirmAction, showMessage, Dialogs } = useUiDialogs()

    const getHistoryTypeMeta = (log: any) => {
        if (log.related_entity_type === "TRANSFER") {
            return {
                label: log.change_amount > 0 ? "Приход по перемещению" : "Расход по перемещению",
                className: log.change_amount > 0 ? "text-blue-700 border-blue-200 bg-blue-50" : "text-indigo-700 border-indigo-200 bg-indigo-50"
            }
        }

        switch (log.type) {
            case "SUPPLY":
                return { label: "Поставка", className: "text-emerald-700 border-emerald-200 bg-emerald-50" }
            case "SALE":
                return { label: "Продажа", className: "text-red-700 border-red-200 bg-red-50" }
            case "RETURN":
                return { label: "Возврат", className: "text-violet-700 border-violet-200 bg-violet-50" }
            case "INVENTORY_GAIN":
                return { label: "Излишек инв.", className: "text-green-700 border-green-200 bg-green-50" }
            case "INVENTORY_LOSS":
                return { label: "Недостача инв.", className: "text-amber-700 border-amber-200 bg-amber-50" }
            case "INVENTORY_CORRECTION":
                return { label: "Коррекция инв.", className: "text-orange-700 border-orange-200 bg-orange-50" }
            case "WRITE_OFF":
                return { label: "Списание", className: "text-foreground border-border bg-accent" }
            case "ADJUSTMENT":
                return { label: "Ручная корректировка", className: "text-foreground border-border bg-accent" }
            default:
                return { label: log.type || "Движение", className: "text-foreground border-border bg-accent" }
        }
    }

    // Filter Logic
    const filteredProducts = products.filter(p => {
        const matchesArchive = productsView === "archived" ? Boolean(p.deleted_at) : !p.deleted_at
        const matchesSearch = 
            p.name.toLowerCase().includes(search.toLowerCase()) || 
            (p.barcode && p.barcode.includes(search)) ||
            (p.barcodes && p.barcodes.some(b => b.includes(search)))
        const matchesCategory = categoryFilter === "all" || (p.category_id?.toString() === categoryFilter)
        return matchesArchive && matchesSearch && matchesCategory
    })

    const displayedProducts = useMemo(() => {
        if (!sortKey) return filteredProducts

        const dir = sortDir === "asc" ? 1 : -1

        const getMarkupPercent = (p: Product) => {
            const cost = Number(p.cost_price) || 0
            const selling = Number(p.selling_price) || 0
            if (cost <= 0) return null
            return ((selling - cost) / cost) * 100
        }

        const getMarginPercent = (p: Product) => {
            const cost = Number(p.cost_price) || 0
            const selling = Number(p.selling_price) || 0
            if (selling <= 0) return null
            return ((selling - cost) / selling) * 100
        }

        const compareNullableNumber = (a: number | null, b: number | null) => {
            if (a === null && b === null) return 0
            if (a === null) return 1
            if (b === null) return -1
            return a - b
        }

        const sorted = [...filteredProducts].sort((a, b) => {
            let cmp = 0
            if (sortKey === "name") {
                cmp = (a.name || "").localeCompare(b.name || "", "ru", { sensitivity: "base" })
            } else if (sortKey === "category") {
                cmp = (a.category_name || "").localeCompare(b.category_name || "", "ru", { sensitivity: "base" })
            } else if (sortKey === "cost_price") {
                cmp = (Number(a.cost_price) || 0) - (Number(b.cost_price) || 0)
            } else if (sortKey === "selling_price") {
                cmp = (Number(a.selling_price) || 0) - (Number(b.selling_price) || 0)
            } else if (sortKey === "markup") {
                cmp = compareNullableNumber(getMarkupPercent(a), getMarkupPercent(b))
            } else if (sortKey === "margin") {
                cmp = compareNullableNumber(getMarginPercent(a), getMarginPercent(b))
            } else if (sortKey === "stock") {
                cmp = (Number(a.current_stock) || 0) - (Number(b.current_stock) || 0)
            } else if (sortKey === "sum") {
                const aSum = (Number(a.current_stock) || 0) * (Number(a.cost_price) || 0)
                const bSum = (Number(b.current_stock) || 0) * (Number(b.cost_price) || 0)
                cmp = aSum - bSum
            }

            cmp *= dir
            if (cmp !== 0) return cmp
            return a.id - b.id
        })

        return sorted
    }, [filteredProducts, sortDir, sortKey])

    // Price Calculation Logic
    const calculatePrices = (type: 'markup' | 'margin' | 'selling', value: number) => {
        if (!editingProduct) return

        const cost = Number(editingProduct.cost_price) || 0
        if (cost <= 0) return

        if (type === 'markup') {
            // Selling = Cost * (1 + Markup/100)
            const selling = cost * (1 + value / 100)
            setEditingProduct(prev => ({ ...prev!, selling_price: Math.ceil(selling) }))
            setDesiredMargin(((selling - cost) / selling * 100).toFixed(1))
        } else if (type === 'margin') {
            // Selling = Cost / (1 - Margin/100)
            if (value >= 100) return // Avoid division by zero
            const selling = cost / (1 - value / 100)
            setEditingProduct(prev => ({ ...prev!, selling_price: Math.ceil(selling) }))
            setDesiredMarkup(((selling - cost) / cost * 100).toFixed(1))
        } else if (type === 'selling') {
            // Calculate Markup and Margin from Selling
            const selling = value
            setDesiredMarkup(((selling - cost) / cost * 100).toFixed(1))
            setDesiredMargin(((selling - cost) / selling * 100).toFixed(1))
        }
    }

    const handleAdjustStock = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const warehouseId = Number(formData.get("warehouse_id"))
        const quantity = Number(formData.get("quantity"))
        const reason = formData.get("reason") as string
        
        if (!manageStockDialog.product || !warehouseId) return

        startTransition(async () => {
            try {
                await adjustWarehouseStock(clubId, currentUserId, manageStockDialog.product!.id, warehouseId, quantity, reason)
                setManageStockDialog({ isOpen: false, product: null })
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message || "Ошибка при обновлении остатка" })
            }
        })
    }

    const handleAddReplenishmentRule = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const sourceId = Number(formData.get("source_id"))
        const targetId = Number(formData.get("target_id"))
        const minStock = Number(formData.get("min_stock"))
        const maxStock = Number(formData.get("max_stock"))
        
        if (!replenishmentDialog.product || !sourceId || !targetId) return

        startTransition(async () => {
            try {
                await createReplenishmentRule(clubId, {
                    source_warehouse_id: sourceId,
                    target_warehouse_id: targetId,
                    product_id: replenishmentDialog.product!.id,
                    min_stock_level: minStock,
                    max_stock_level: maxStock
                })
                
                // Refresh rules
                const rules = await getReplenishmentRulesForProduct(clubId, replenishmentDialog.product!.id)
                setReplenishmentDialog(prev => ({ ...prev, rules }))
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message || "Ошибка при создании правила" })
            }
        })
    }

    const handleDeleteReplenishmentRule = async (ruleId: number) => {
        const confirmed = await confirmAction({
            title: "Удаление правила",
            description: "Удалить правило?",
            confirmText: "Удалить"
        })
        if (!confirmed) return
        startTransition(async () => {
            try {
                await deleteReplenishmentRule(ruleId, clubId)
                // Refresh rules
                const rules = await getReplenishmentRulesForProduct(clubId, replenishmentDialog.product!.id)
                setReplenishmentDialog(prev => ({ ...prev, rules }))
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message || "Ошибка при удалении" })
            }
        })
    }

    const openReplenishment = async (product: Product) => {
        setReplenishmentDialog({ isOpen: true, product, rules: [] })
        const rules = await getReplenishmentRulesForProduct(clubId, product.id)
        setReplenishmentDialog(prev => ({ ...prev, rules }))
    }

    // Actions
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingProduct?.name) return

        startTransition(async () => {
            try {
                if (editingProduct.id) {
                    await updateProduct(editingProduct.id, clubId, currentUserId, {
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
                } else {
                    await createProduct(clubId, currentUserId, {
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
                }
                setIsDialogOpen(false)
                setEditingProduct(null)
                setDesiredMarkup("")
                setDesiredMargin("")
            } catch (err) {
                console.error(err)
                showMessage({ title: "Ошибка", description: "Ошибка при сохранении" })
            }
        })
    }

    const handleDelete = async (id: number) => {
        const confirmed = await confirmAction({
            title: "Удаление товара",
            description: "Вы уверены? Это действие нельзя отменить.",
            confirmText: "Удалить"
        })
        if (!confirmed) return
        startTransition(async () => {
            try {
                await deleteProduct(id, clubId)
                router.refresh()
                setSelectedIds(new Set())
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message || "Не удалось удалить" })
            }
        })
    }

    const handleArchive = async (id: number) => {
        const confirmed = await confirmAction({
            title: "Архивация товара",
            description: "Скрыть товар из списка? История сохранится.",
            confirmText: "Архивировать"
        })
        if (!confirmed) return
        startTransition(async () => {
            try {
                await archiveProduct(id, clubId)
                router.refresh()
                setSelectedIds(new Set())
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message || "Не удалось архивировать" })
            }
        })
    }

    const handleRestore = async (id: number) => {
        const confirmed = await confirmAction({
            title: "Восстановление товара",
            description: "Вернуть товар из архива?",
            confirmText: "Восстановить"
        })
        if (!confirmed) return
        startTransition(async () => {
            try {
                await restoreProduct(id, clubId)
                router.refresh()
                setSelectedIds(new Set())
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message || "Не удалось восстановить" })
            }
        })
    }

    const handleBulkUpdate = async () => {
        if (!bulkAction.value || selectedIds.size === 0) return
        startTransition(async () => {
            await bulkUpdatePrices(Array.from(selectedIds), clubId, bulkAction.type, Number(bulkAction.value))
            setIsBulkDialogOpen(false)
            setSelectedIds(new Set())
            setBulkAction({ type: 'fixed', value: '' })
        })
    }

    const handleWriteOff = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!writeOffDialog.product || !writeOffAmount) return

        startTransition(async () => {
            try {
                await writeOffProduct(clubId, currentUserId, writeOffDialog.product!.id, Number(writeOffAmount), writeOffReason)
                setWriteOffDialog({ isOpen: false, product: null })
                setWriteOffAmount("")
                setWriteOffReason("")
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: err.message || "Ошибка при списании" })
            }
        })
    }

    const openHistory = async (product: Product) => {
        setHistoryDialog({ isOpen: true, product, logs: [] })
        const logs = await getProductHistory(clubId, product.id)
        setHistoryDialog(prev => ({ ...prev, logs }))
    }

    // Selection
    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === displayedProducts.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(displayedProducts.map(p => p.id)))
    }

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(prev => (prev === "asc" ? "desc" : "asc"))
        } else {
            setSortKey(key)
            setSortDir("asc")
        }
    }

    const renderSortIcon = (key: SortKey) => {
        if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />
        return sortDir === "asc"
            ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
            : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
    }

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <PageToolbar>
                <ToolbarGroup className="w-full md:w-auto">
                    <div className="flex-1 min-w-[200px]">
                        <SearchInput 
                            placeholder="Поиск товара..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[140px] md:w-[180px] h-9 bg-white">
                            <SelectValue placeholder="Категория" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все категории</SelectItem>
                            {categories.map(c => (
                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={productsView}
                        onValueChange={(v) => {
                            setProductsView(v as "active" | "archived")
                            setSelectedIds(new Set())
                        }}
                    >
                        <SelectTrigger className="w-[120px] md:w-[140px] h-9 bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Активные</SelectItem>
                            <SelectItem value="archived">Архив</SelectItem>
                        </SelectContent>
                    </Select>
                </ToolbarGroup>
                <ToolbarGroup align="end" className="w-full md:w-auto mt-3 md:mt-0">
                    {selectedIds.size > 0 && (
                        <>
                            <Button variant="outline" onClick={() => setIsPrintDialogOpen(true)} className="flex-1 md:flex-none h-9 bg-white">
                                <Printer className="mr-2 h-4 w-4" />
                                Печать ({selectedIds.size})
                            </Button>
                            <Button variant="outline" onClick={() => setIsBulkDialogOpen(true)} className="flex-1 md:flex-none h-9 bg-white">
                                <Layers className="mr-2 h-4 w-4" />
                                Цены ({selectedIds.size})
                            </Button>
                        </>
                    )}
                    <Button onClick={() => router.push(`/clubs/${clubId}/inventory/products/new`)} className="flex-1 md:flex-none h-9">
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить товар
                    </Button>
                </ToolbarGroup>
            </PageToolbar>

            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[40px]">
                                <input 
                                    type="checkbox"
                                    className="rounded border-slate-300"
                                    checked={selectedIds.size === displayedProducts.length && displayedProducts.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-slate-100 select-none transition-colors" onClick={() => toggleSort("name")}>
                                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Название
                                    {renderSortIcon("name")}
                                </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-slate-100 select-none transition-colors" onClick={() => toggleSort("category")}>
                                <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Категория
                                    {renderSortIcon("category")}
                                </div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-slate-100 select-none transition-colors" onClick={() => toggleSort("cost_price")}>
                                <div className="flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Закупка
                                    {renderSortIcon("cost_price")}
                                </div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-slate-100 select-none transition-colors" onClick={() => toggleSort("selling_price")}>
                                <div className="flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Продажа
                                    {renderSortIcon("selling_price")}
                                </div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-slate-100 select-none transition-colors" onClick={() => toggleSort("markup")}>
                                <div className="flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Наценка
                                    {renderSortIcon("markup")}
                                </div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-slate-100 select-none transition-colors" onClick={() => toggleSort("margin")}>
                                <div className="flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Маржа
                                    {renderSortIcon("margin")}
                                </div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-slate-100 select-none transition-colors" onClick={() => toggleSort("stock")}>
                                <div className="flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Остаток
                                    {renderSortIcon("stock")}
                                </div>
                            </TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedProducts.map(product => {
                            return (
                                <TableRow key={product.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => router.push(`/clubs/${clubId}/inventory/products/${product.id}`)}>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <input 
                                            type="checkbox"
                                            className="rounded border-gray-300"
                                            checked={selectedIds.has(product.id)}
                                            onChange={() => toggleSelection(product.id)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span>{product.name}</span>
                                                {product.abc_category && (
                                                    <Badge 
                                                        className={cn(
                                                            "h-4 px-1 text-[9px] font-black uppercase",
                                                            product.abc_category === 'A' ? "bg-green-500 hover:bg-green-600" :
                                                            product.abc_category === 'B' ? "bg-amber-500 hover:bg-amber-600" :
                                                            "bg-slate-400 hover:bg-slate-500"
                                                        )}
                                                    >
                                                        {product.abc_category}
                                                    </Badge>
                                                )}
                                            </div>
                                            {(product.barcode || (product.barcodes && product.barcodes.length > 0)) && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {product.barcode && (
                                                        <span className="text-[9px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                                                            <Barcode className="h-2 w-2" />
                                                            {product.barcode}
                                                        </span>
                                                    )}
                                                    {product.barcodes?.filter(b => b !== product.barcode).map((bc, idx) => (
                                                        <span key={idx} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                                                            <Barcode className="h-2 w-2" />
                                                            {bc}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {product.category_name ? (
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none font-normal">{product.category_name}</Badge>
                                        ) : <span className="text-slate-400 text-sm">—</span>}
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap text-slate-600">{product.cost_price} ₽</TableCell>
                                    <TableCell className="text-right font-bold whitespace-nowrap text-slate-900">{product.selling_price} ₽</TableCell>
                                    <TableCell className="text-right">
                                        {product.cost_price > 0 ? (
                                            <span className="text-sm font-medium text-emerald-600">
                                                {Math.round(((product.selling_price - product.cost_price) / product.cost_price) * 100)}%
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {product.selling_price > 0 ? (
                                            <span className="text-sm font-medium text-blue-600">
                                                {Math.round(((product.selling_price - product.cost_price) / product.selling_price) * 100)}%
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        <div className="flex flex-col items-end">
                                            <span className="text-base font-medium text-slate-900 tracking-tight">
                                                {product.current_stock} <span className="text-sm font-normal text-slate-500">шт</span>
                                            </span>
                                            {product.stocks && product.stocks.length > 0 && (
                                                <div className="flex flex-col gap-0.5 mt-1">
                                                    {product.stocks.map((s, i) => (
                                                        <div key={i} className="flex items-center justify-end gap-2 text-[11px]">
                                                            <span className="text-slate-400 truncate max-w-[100px]" title={s.warehouse_name}>
                                                                {s.warehouse_name}
                                                            </span>
                                                            <span className={cn(
                                                                "font-medium tabular-nums min-w-[20px] text-right",
                                                                s.is_default ? "text-slate-900" : "text-slate-500"
                                                            )}>
                                                                {s.quantity}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenuItem onClick={() => router.push(`/clubs/${clubId}/inventory/products/${product.id}`)}>
                                                        Открыть
                                                    </DropdownMenuItem>
                                                    {product.deleted_at ? (
                                                        <DropdownMenuItem onClick={() => handleRestore(product.id)}>
                                                            Восстановить
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem onClick={() => handleArchive(product.id)}>
                                                            Архивировать
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-rose-600" onClick={() => handleDelete(product.id)}>
                                                        Удалить
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {displayedProducts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                    Товары не найдены
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile List View */}
            <div className="md:hidden space-y-3">
                {displayedProducts.map(product => {
                    return (
                        <div
                            key={product.id}
                            className="bg-card rounded-xl border p-4 shadow-sm relative overflow-hidden active:bg-muted transition-colors"
                            onClick={() => router.push(`/clubs/${clubId}/inventory/products/${product.id}`)}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex gap-3">
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <input 
                                            type="checkbox"
                                            className="rounded border-gray-300 mt-1 size-4"
                                            checked={selectedIds.has(product.id)}
                                            onChange={() => toggleSelection(product.id)}
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-base leading-tight truncate max-w-[180px]">{product.name}</h3>
                                            {product.abc_category && (
                                                <Badge 
                                                    className={cn(
                                                        "h-4 px-1 text-[9px] font-black uppercase",
                                                        product.abc_category === 'A' ? "bg-green-500 hover:bg-green-600" :
                                                        product.abc_category === 'B' ? "bg-amber-500 hover:bg-amber-600" :
                                                        "bg-slate-400 hover:bg-slate-500"
                                                    )}
                                                >
                                                    {product.abc_category}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {product.category_name && (
                                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 leading-none uppercase tracking-wider font-bold border-border text-muted-foreground bg-muted/50">
                                                    {product.category_name}
                                                </Badge>
                                            )}
                                            {product.barcode && (
                                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono bg-accent px-1.5 rounded h-4">
                                                    <Barcode className="h-2.5 w-2.5" />
                                                    {product.barcode}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div onClick={(e) => e.stopPropagation()}>
                                    <Button variant="outline" size="sm" className="h-8 bg-slate-50 border-slate-200 text-xs font-medium" onClick={() => router.push(`/clubs/${clubId}/inventory/products/${product.id}`)}>
                                        Открыть
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100 mt-2">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Цена продажи</p>
                                    <div className="flex items-baseline gap-1.5">
                                        <p className="font-black text-xl text-slate-900">{product.selling_price} ₽</p>
                                    </div>
                                    {product.cost_price > 0 && product.selling_price > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                Наценка +{Math.round(((product.selling_price - product.cost_price) / product.cost_price) * 100)}%
                                            </span>
                                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                                Маржа {Math.round(((product.selling_price - product.cost_price) / product.selling_price) * 100)}%
                                            </span>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-slate-500 mt-1 font-medium">Закупка: {product.cost_price} ₽</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">На складе</p>
                                    <div className="flex items-center justify-end gap-1.5">
                                        <span className="text-xl font-black text-slate-900">
                                            {product.current_stock}
                                        </span>
                                        <span className="text-sm font-medium text-slate-500">шт</span>
                                    </div>
                                    <div className="flex flex-col items-end mt-1">
                                        {product.stocks && product.stocks.length > 0 && (
                                            <div className="flex flex-col gap-0.5 w-full items-end">
                                                {product.stocks.slice(0, 3).map((s, i) => (
                                                    <div key={i} className="flex items-center justify-end gap-2 text-[11px] w-full max-w-[120px]">
                                                        <span className="text-slate-400 truncate text-right flex-1" title={s.warehouse_name}>
                                                            {s.warehouse_name}
                                                        </span>
                                                        <span className={cn(
                                                            "font-medium tabular-nums text-right min-w-[16px]",
                                                            s.is_default ? "text-slate-900" : "text-slate-500"
                                                        )}>
                                                            {s.quantity}
                                                        </span>
                                                    </div>
                                                ))}
                                                {product.stocks.length > 3 && (
                                                    <span className="text-[10px] text-slate-400 font-medium">и еще {product.stocks.length - 3}...</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
                {displayedProducts.length === 0 && (
                    <div className="py-20 text-center text-muted-foreground bg-muted rounded-xl border border-dashed">
                        <Box className="h-12 w-12 mx-auto opacity-10 mb-3" />
                        <p className="italic">Товары не найдены</p>
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingProduct?.id ? 'Редактирование товара' : 'Новый товар'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Название</Label>
                            <Input 
                                value={editingProduct?.name || ''} 
                                onChange={e => setEditingProduct(prev => ({ ...prev!, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Barcode className="h-4 w-4" />
                                Штрихкоды
                            </Label>
                            <div className="space-y-2">
                                {(editingProduct?.barcodes || []).map((bc, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <Input 
                                            value={bc} 
                                            onChange={e => {
                                                const newBarcodes = [...(editingProduct?.barcodes || [])]
                                                newBarcodes[idx] = e.target.value
                                                setEditingProduct(prev => ({ ...prev!, barcodes: newBarcodes }))
                                            }}
                                            placeholder="Штрихкод"
                                        />
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => {
                                                const newBarcodes = (editingProduct?.barcodes || []).filter((_, i) => i !== idx)
                                                setEditingProduct(prev => ({ ...prev!, barcodes: newBarcodes }))
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                ))}
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full border-dashed"
                                    onClick={() => {
                                        const newBarcodes = [...(editingProduct?.barcodes || []), ""]
                                        setEditingProduct(prev => ({ ...prev!, barcodes: newBarcodes }))
                                    }}
                                >
                                    <Plus className="h-3 w-3 mr-2" /> Добавить штрихкод
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Закупка (₽)</Label>
                                <Input 
                                    type="number" 
                                    value={editingProduct?.cost_price || ''} 
                                    onChange={e => {
                                        const cost = Number(e.target.value)
                                        // Update cost price
                                        setEditingProduct(prev => {
                                            const newState = { ...prev!, cost_price: cost }
                                            
                                            // If we have a desired markup, recalculate selling price
                                            const markup = parseFloat(desiredMarkup)
                                            if (!isNaN(markup) && cost > 0) {
                                                const selling = cost * (1 + markup / 100)
                                                newState.selling_price = Math.ceil(selling)
                                            }
                                            
                                            return newState
                                        })
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Продажа (₽)</Label>
                                <Input 
                                    type="number" 
                                    value={editingProduct?.selling_price || ''} 
                                    onChange={e => {
                                        const selling = Number(e.target.value)
                                        setEditingProduct(prev => ({ ...prev!, selling_price: selling }))
                                        
                                        // Recalculate markup/margin based on new selling price
                                        if (editingProduct?.cost_price && editingProduct.cost_price > 0) {
                                            const cost = editingProduct.cost_price
                                            const markup = ((selling - cost) / cost * 100).toFixed(1)
                                            const margin = ((selling - cost) / selling * 100).toFixed(1)
                                            setDesiredMarkup(markup)
                                            setDesiredMargin(margin)
                                        }
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        {/* Price Calculator Tools */}
                        <div className="grid grid-cols-2 gap-4 bg-muted p-4 rounded-lg border">
                             <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Желаемая наценка (%)</Label>
                                <Input 
                                    type="number"
                                    placeholder="Например: 150"
                                    value={desiredMarkup}
                                    onChange={e => {
                                        setDesiredMarkup(e.target.value)
                                        calculatePrices('markup', parseFloat(e.target.value))
                                    }}
                                    disabled={!editingProduct?.cost_price || editingProduct.cost_price <= 0}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Желаемая маржа (%)</Label>
                                <Input 
                                    type="number"
                                    placeholder="Например: 40"
                                    value={desiredMargin}
                                    onChange={e => {
                                        setDesiredMargin(e.target.value)
                                        calculatePrices('margin', parseFloat(e.target.value))
                                    }}
                                    disabled={!editingProduct?.cost_price || editingProduct.cost_price <= 0}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Текущий остаток</Label>
                                <Input 
                                    type="number" 
                                    value={editingProduct?.current_stock || ''} 
                                    onChange={e => setEditingProduct(prev => ({ ...prev!, current_stock: Number(e.target.value) }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Мин. остаток</Label>
                                <Input 
                                    type="number" 
                                    value={editingProduct?.min_stock_level || ''} 
                                    onChange={e => setEditingProduct(prev => ({ ...prev!, min_stock_level: Number(e.target.value) }))}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 bg-muted p-4 rounded-lg border">
                            <Label className="flex items-center gap-2 text-blue-600">
                                <LayoutGrid className="h-4 w-4" />
                                Формат упаковки (шт в коробке)
                            </Label>
                            <Input 
                                type="number" 
                                value={editingProduct?.units_per_box || ''} 
                                onChange={e => setEditingProduct(prev => ({ ...prev!, units_per_box: Number(e.target.value) }))}
                                placeholder="1 (по умолчанию)"
                                min={1}
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Используется для округления рекомендуемого количества при закупке.
                            </p>
                        </div>

                        {/* Front/Back Stock Settings */}
                        <div className="bg-muted p-4 rounded-lg border space-y-4">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                                <Box className="h-4 w-4" /> Витрина и Склад
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Вместимость витрины (шт)</Label>
                                    <Input 
                                        type="number" 
                                        value={editingProduct?.max_front_stock || ''} 
                                        onChange={e => setEditingProduct(prev => ({ ...prev!, max_front_stock: Number(e.target.value) }))}
                                        placeholder="0 (не используется)"
                                    />
                                    <p className="text-[10px] text-muted-foreground">Если &gt; 0, включится режим раздельного учета</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Порог пополнения (шт)</Label>
                                    <Input 
                                        type="number" 
                                        value={editingProduct?.min_front_stock || ''} 
                                        onChange={e => setEditingProduct(prev => ({ ...prev!, min_front_stock: Number(e.target.value) }))}
                                        placeholder="3"
                                        disabled={!editingProduct?.max_front_stock}
                                    />
                                    <p className="text-[10px] text-muted-foreground">Создаст задачу при остатке ниже этого</p>
                                </div>
                            </div>
                            
                            {(editingProduct?.max_front_stock || 0) > 0 && (
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-2">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Сейчас на витрине</Label>
                                        <Input 
                                            type="number" 
                                            value={editingProduct?.front_stock ?? ''} 
                                            onChange={e => {
                                                const val = Number(e.target.value)
                                                // Ensure we don't exceed current stock
                                                const current = editingProduct?.current_stock || 0
                                                const safeVal = Math.min(val, current)
                                                
                                                setEditingProduct(prev => ({ 
                                                    ...prev!, 
                                                    front_stock: safeVal,
                                                    // Auto adjust back stock to match total
                                                    back_stock: current - safeVal
                                                }))
                                            }}
                                            max={editingProduct?.current_stock}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Сейчас на складе</Label>
                                        <Input 
                                            type="number" 
                                            value={editingProduct?.back_stock ?? ''} 
                                            disabled // Calculated automatically
                                            className="bg-accent"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Категория</Label>
                            <Select 
                                value={editingProduct?.category_id?.toString() || "none"} 
                                onValueChange={v => setEditingProduct(prev => ({ ...prev!, category_id: v === "none" ? null : Number(v) }))}
                            >
                                <SelectTrigger>
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
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={isPending}>Сохранить</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Replenishment Rules Dialog */}
            <Dialog open={replenishmentDialog.isOpen} onOpenChange={(v) => setReplenishmentDialog(prev => ({ ...prev, isOpen: v }))}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Правила пополнения: {replenishmentDialog.product?.name}</DialogTitle>
                        <DialogDescription>
                            Настройте автоматическое создание задач на пополнение складов.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                        {/* List Existing Rules */}
                        {replenishmentDialog.rules.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Откуда</TableHead>
                                        <TableHead>Куда</TableHead>
                                        <TableHead>Порог (Мин)</TableHead>
                                        <TableHead>До (Макс)</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {replenishmentDialog.rules.map(rule => (
                                        <TableRow key={rule.id}>
                                            <TableCell>{rule.source_warehouse_name}</TableCell>
                                            <TableCell>{rule.target_warehouse_name}</TableCell>
                                            <TableCell>{rule.min_stock_level}</TableCell>
                                            <TableCell>{rule.max_stock_level}</TableCell>
                                            <TableCell>
                                                <Button aria-label={`Удалить правило пополнения ${rule.id}`} variant="ghost" size="icon" onClick={() => handleDeleteReplenishmentRule(rule.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-4 text-muted-foreground bg-muted rounded-lg">
                                Нет активных правил пополнения
                            </div>
                        )}

                        {/* Add New Rule Form */}
                        <div className="border-t pt-4">
                            <h4 className="font-medium mb-4">Добавить новое правило</h4>
                            <form onSubmit={handleAddReplenishmentRule} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Откуда брать (Источник)</Label>
                                        <Select name="source_id" required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите склад" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {warehouses.map(w => (
                                                    <SelectItem key={w.id} value={w.id.toString()}>{w.name} {w.is_default ? '(Осн)' : ''}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Куда пополнять (Цель)</Label>
                                        <Select name="target_id" required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите склад" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {warehouses.map(w => (
                                                    <SelectItem key={w.id} value={w.id.toString()}>{w.name} {w.is_default ? '(Осн)' : ''}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Порог срабатывания (Мин)</Label>
                                        <Input name="min_stock" type="number" placeholder="Например: 5" required min={0} />
                                        <p className="text-[10px] text-muted-foreground">Создать задачу, если остаток ниже этого</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Заполнять до (Макс)</Label>
                                        <Input name="max_stock" type="number" placeholder="Например: 20" required min={1} />
                                        <p className="text-[10px] text-muted-foreground">Сколько должно стать после пополнения</p>
                                    </div>
                                </div>
                                <Button type="submit" className="w-full" disabled={isPending}>
                                    <Plus className="mr-2 h-4 w-4" /> Добавить правило
                                </Button>
                            </form>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Manage Stock Dialog */}
            <Dialog open={manageStockDialog.isOpen} onOpenChange={(v) => setManageStockDialog(prev => ({ ...prev, isOpen: v }))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Управление остатками: {manageStockDialog.product?.name}</DialogTitle>
                        <DialogDescription>
                            Ручная корректировка остатков по складам.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Склад</TableHead>
                                    <TableHead>Текущий остаток</TableHead>
                                    <TableHead className="w-[100px]">Действие</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {manageStockDialog.product?.stocks?.map(stock => (
                                    <TableRow key={stock.warehouse_id}>
                                        <TableCell>
                                            {stock.warehouse_name}
                                            {stock.is_default && <Badge variant="secondary" className="ml-2 text-[10px]">Основной</Badge>}
                                        </TableCell>
                                        <TableCell>{stock.quantity}</TableCell>
                                        <TableCell>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm">Изменить</Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Изменить остаток</DialogTitle>
                                                        <DialogDescription>
                                                            {stock.warehouse_name} - {manageStockDialog.product?.name}
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <form onSubmit={handleAdjustStock} className="space-y-4">
                                                        <input type="hidden" name="warehouse_id" value={stock.warehouse_id} />
                                                        <div className="space-y-2">
                                                            <Label>Новое количество</Label>
                                                            <Input 
                                                                name="quantity"
                                                                type="number" 
                                                                defaultValue={stock.quantity}
                                                                required
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Причина изменения</Label>
                                                            <Input 
                                                                name="reason"
                                                                placeholder="Например: Инвентаризация, Ошибка ввода"
                                                                required
                                                            />
                                                        </div>
                                                        <DialogFooter>
                                                            <Button type="submit" disabled={isPending}>Сохранить</Button>
                                                        </DialogFooter>
                                                    </form>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!manageStockDialog.product?.stocks || manageStockDialog.product.stocks.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                                            Нет данных о складах
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Bulk Edit Dialog */}
            <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Массовое изменение цен</DialogTitle>
                        <DialogDescription>
                            Выбрано товаров: {selectedIds.size}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Тип изменения</Label>
                            <Select 
                                value={bulkAction.type} 
                                onValueChange={(v: any) => setBulkAction(prev => ({ ...prev, type: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fixed">Установить фиксированную цену</SelectItem>
                                    <SelectItem value="percent">Изменить на процент (+/-)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{bulkAction.type === 'fixed' ? 'Новая цена (₽)' : 'Процент изменения (%)'}</Label>
                            <Input 
                                type="number" 
                                placeholder={bulkAction.type === 'fixed' ? '500' : '10 (для +10%) или -10'}
                                value={bulkAction.value}
                                onChange={e => setBulkAction(prev => ({ ...prev, value: e.target.value }))}
                            />
                            {bulkAction.type === 'percent' && (
                                <p className="text-xs text-muted-foreground">
                                    Введите положительное число для наценки (10 = +10%) или отрицательное для скидки (-20 = -20%).
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleBulkUpdate} disabled={isPending || !bulkAction.value}>Применить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Write-off Dialog */}
            <Dialog open={writeOffDialog.isOpen} onOpenChange={(v) => setWriteOffDialog(prev => ({ ...prev, isOpen: v }))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Списание товара</DialogTitle>
                        <DialogDescription>
                            {writeOffDialog.product?.name} (Текущий остаток: {writeOffDialog.product?.current_stock})
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleWriteOff} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Количество</Label>
                            <Input 
                                type="number" 
                                value={writeOffAmount} 
                                onChange={e => setWriteOffAmount(e.target.value)}
                                max={writeOffDialog.product?.current_stock}
                                min={1}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Причина списания</Label>
                            <Input 
                                value={writeOffReason} 
                                onChange={e => setWriteOffReason(e.target.value)}
                                placeholder="Например: Порча, Бой, Угощение"
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setWriteOffDialog({ isOpen: false, product: null })}>Отмена</Button>
                            <Button type="submit" variant="destructive" disabled={isPending}>Списать</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={historyDialog.isOpen} onOpenChange={(v) => setHistoryDialog(prev => ({ ...prev, isOpen: v }))}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>История движения товара</DialogTitle>
                        <DialogDescription>
                            {historyDialog.product?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Дата</TableHead>
                                    <TableHead>Тип</TableHead>
                                    <TableHead>Изменение</TableHead>
                                    <TableHead>Остаток</TableHead>
                                    <TableHead>Сотрудник</TableHead>
                                    <TableHead>Причина</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {historyDialog.logs.length > 0 ? (
                                    historyDialog.logs.map((log: any) => {
                                        const meta = getHistoryTypeMeta(log)
                                        return (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs">
                                                {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: ru })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("text-xs", meta.className)}>
                                                    {meta.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={log.change_amount > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                                {log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount}
                                            </TableCell>
                                            <TableCell>{log.new_stock}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{log.user_name || 'Система'}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={log.reason}>
                                                {log.reason || '-'}
                                            </TableCell>
                                        </TableRow>
                                    )})
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                                            История пуста
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Price History Dialog */}
            <Dialog open={isPriceHistoryOpen} onOpenChange={setIsPriceHistoryOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                            История закупочных цен
                        </DialogTitle>
                        <DialogDescription>
                            {editingProduct?.name} — Динамика изменений по последним поставкам
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                        <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm bg-card">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-[10px] uppercase font-black text-muted-foreground/70">Дата</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black text-muted-foreground/70">Поставщик</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-black text-muted-foreground/70">Цена закупа</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-black text-muted-foreground/70">Динамика</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!editingProduct?.price_history || editingProduct.price_history.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-muted-foreground/70 italic text-sm">
                                                История закупок пока пуста
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        editingProduct.price_history.map((entry, idx) => {
                                            const prevEntry = editingProduct.price_history![idx + 1]
                                            const diff = prevEntry ? entry.cost_price - prevEntry.cost_price : 0
                                            const percentDiff = prevEntry ? (diff / prevEntry.cost_price * 100) : 0
                                            
                                            return (
                                                <TableRow key={idx} className="hover:bg-muted/50">
                                                    <TableCell className="text-sm font-medium text-foreground">
                                                        {new Date(entry.created_at).toLocaleDateString('ru-RU')}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground font-semibold">
                                                        {entry.supplier_name}
                                                    </TableCell>
                                                    <TableCell className="text-right font-black text-foreground">
                                                        {entry.cost_price.toLocaleString('ru-RU')} ₽
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {idx < editingProduct.price_history!.length - 1 ? (
                                                            <div className={cn(
                                                                "flex items-center justify-end gap-1 text-xs font-bold",
                                                                diff > 0 ? "text-red-500" : diff < 0 ? "text-green-500" : "text-muted-foreground/70"
                                                            )}>
                                                                {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                                                                {diff !== 0 && `${Math.abs(percentDiff).toFixed(1)}%`}
                                                                {diff === 0 && "—"}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter">Первая</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        
                        <div className="mt-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] uppercase font-black text-blue-400 tracking-wider">Текущая цена в каталоге</p>
                                    <p className="text-2xl font-black text-blue-600">{editingProduct?.cost_price?.toLocaleString('ru-RU')} ₽</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-black text-muted-foreground/70 tracking-wider">Средняя за 5 запок</p>
                                    <p className="text-lg font-bold text-foreground">
                                        {editingProduct?.price_history && editingProduct.price_history.length > 0
                                            ? (editingProduct.price_history.reduce((acc, curr) => acc + Number(curr.cost_price), 0) / editingProduct.price_history.length).toLocaleString(undefined, { maximumFractionDigits: 0 })
                                            : 0} ₽
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" className="w-full h-11" onClick={() => setIsPriceHistoryOpen(false)}>Понятно</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PriceTagPrinter 
                isOpen={isPrintDialogOpen} 
                onClose={() => setIsPrintDialogOpen(false)} 
                products={products.filter(p => selectedIds.has(p.id))}
                template={activeTemplate}
            />

            {Dialogs}
        </div>
    )
}
