"use client"

import React, { useState, useTransition, useEffect, useMemo, useCallback } from "react"
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Save, X, Search, Camera, Barcode, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { getInventory, getInventoryItems, updateInventoryItem, closeInventory, Inventory, InventoryItem, addProductToInventory, getProducts, getProductByBarcode, correctInventoryItem } from "../actions"
import { useParams } from "next/navigation"
import { Plus, Pencil } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarcodeScanner } from "./BarcodeScanner"
import { cn } from "@/lib/utils"
import { useUiDialogs } from "./useUiDialogs"

interface ActiveInventoryProps {
    inventoryId: number
    onClose: () => void
    isOwner: boolean
    currentUserId: string
}

export function ActiveInventory({ inventoryId, onClose, isOwner, currentUserId }: ActiveInventoryProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [inventory, setInventory] = useState<Inventory | null>(null)
    const [items, setItems] = useState<InventoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isPending, startTransition] = useTransition()
    
    // Close Dialog State
    const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
    const [reportedRevenue, setReportedRevenue] = useState("")
    const [unaccountedSales, setUnaccountedSales] = useState<{ product_id: number, quantity: number, selling_price: number, cost_price: number, name: string }[]>([])
    const [isUnaccountedDialogOpen, setIsUnaccountedDialogOpen] = useState(false)
    const [selectedUnaccountedProduct, setSelectedUnaccountedProduct] = useState("")
    const [unaccountedQty, setUnaccountedQty] = useState("1")
    
    // Add Item State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [allProducts, setAllProducts] = useState<{ id: number, name: string, selling_price?: number, cost_price?: number }[]>([])
    const [isRefreshingProducts, setIsRefreshingProducts] = useState(false)
    const [selectedProductToAdd, setSelectedProductToAdd] = useState("")

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState("")

    // Correction state for closed inventory
    const [editingItemId, setEditingItemId] = useState<number | null>(null)
    const [correctionStock, setCorrectionStock] = useState<string>("")

    const handleStartCorrection = (item: InventoryItem) => {
        setEditingItemId(item.id)
        setCorrectionStock(item.actual_stock?.toString() || "0")
    }

    const handleSaveCorrection = async (productId: number) => {
        const val = parseInt(correctionStock)
        if (isNaN(val)) return
        
        startTransition(async () => {
            try {
                const res = await correctInventoryItem(inventoryId, productId, val, clubId, currentUserId)
                if (res.success) {
                    // Refresh data
                    const [inv, invItems] = await Promise.all([
                        getInventory(inventoryId),
                        getInventoryItems(inventoryId)
                    ])
                    setInventory(inv)
                    setItems(invItems)
                    setEditingItemId(null)
                }
            } catch (err: any) {
                showMessage({ title: "Ошибка", description: "Ошибка при сохранении: " + (err.message || "Неизвестная ошибка") })
            }
        })
    }

    // Barcode Scanner State
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null)
    const { confirmAction, showMessage, Dialogs } = useUiDialogs()

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true)
            try {
                const [inv, invItems] = await Promise.all([
                    getInventory(inventoryId),
                    getInventoryItems(inventoryId)
                ])
                setInventory(inv)
                setItems(invItems)
            } catch (e) {
                console.error(e)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [inventoryId])

    const handleStockChange = (itemId: number, val: string) => {
        const numVal = val === "" ? null : parseInt(val)
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, actual_stock: numVal, last_modified: numVal !== null ? Date.now() : i.last_modified } : i))
    }

    // Saves to server only when user leaves the field
    const handleBlur = async (itemId: number, val: number | null) => {
        try {
            await updateInventoryItem(itemId, val, clubId)
        } catch (e) {
            console.error("Failed to save item", e)
        }
    }

    // FIX #8: Track uncounted items
    const uncountedItems = useMemo(() => {
        return items.filter(i => i.actual_stock === null)
    }, [items])

    const uncountedCount = uncountedItems.length
    const totalCount = items.length

    // Calculate Sales Summary for Preview
    // Note: This shows sales (expected > actual means sold), so we use (expected - actual)
    const salesPreview = useMemo(() => {
        const standardSales = items
            .filter(i => i.actual_stock !== null && (i.expected_stock || 0) > (i.actual_stock || 0))
            .map(i => ({
                id: i.id,
                name: i.product_name,
                qty: (i.expected_stock || 0) - (i.actual_stock || 0),
                price: i.selling_price_snapshot,
                total: ((i.expected_stock || 0) - (i.actual_stock || 0)) * i.selling_price_snapshot,
                isUnaccounted: false
            }))

        const manualSales = unaccountedSales.map(s => ({
            id: s.product_id,
            name: s.name,
            qty: s.quantity,
            price: s.selling_price,
            total: s.quantity * s.selling_price,
            isUnaccounted: true
        }))

        return [...standardSales, ...manualSales]
    }, [items, unaccountedSales])

    const totalSalesRevenue = salesPreview.reduce((acc, s) => acc + s.total, 0)

    const handleCloseInventory = async () => {
        // FIX #8: Block closing if items are uncounted
        if (uncountedCount > 0) {
            showMessage({ 
                title: "Не все товары посчитаны", 
                description: `Осталось ${uncountedCount} из ${totalCount} товаров без фактического остатка. Заполните все позиции перед закрытием.` 
            })
            return
        }

        // If owner didn't select a metric (metric is null), we don't need reported revenue
        const metricRequired = !!inventory?.target_metric_key
        if (metricRequired && !reportedRevenue) return

        startTransition(async () => {
            try {
                await closeInventory(
                    inventoryId,
                    clubId,
                    metricRequired ? Number(reportedRevenue) : 0,
                    unaccountedSales.map(s => ({
                        product_id: s.product_id,
                        quantity: s.quantity,
                        selling_price: s.selling_price,
                        cost_price: s.cost_price
                    }))
                )
                setIsCloseDialogOpen(false)
                onClose() // Go back to list
            } catch (e) {
                console.error(e)
                showMessage({ title: "Ошибка", description: "Ошибка при закрытии инвентаризации" })
            }
        })
    }

    const addUnaccountedSale = () => {
        const product = allProducts.find(p => p.id === Number(selectedUnaccountedProduct))
        if (!product || !unaccountedQty) return

        setUnaccountedSales(prev => [
            ...prev,
            {
                product_id: product.id,
                name: product.name,
                quantity: Number(unaccountedQty),
                selling_price: product.selling_price || 0,
                cost_price: product.cost_price || 0
            }
        ])
        setSelectedUnaccountedProduct("")
        setUnaccountedQty("1")
        setIsUnaccountedDialogOpen(false)
    }

    const removeUnaccountedSale = (productId: number) => {
        setUnaccountedSales(prev => prev.filter(s => s.product_id !== productId))
    }

    const handleAddProduct = async () => {
        if (!selectedProductToAdd) return
        startTransition(async () => {
            try {
                await addProductToInventory(inventoryId, Number(selectedProductToAdd))
                
                // Refresh list
                const invItems = await getInventoryItems(inventoryId)
                setItems(invItems)
                
                setIsAddDialogOpen(false)
                setSelectedProductToAdd("")
            } catch (e: any) {
                showMessage({ title: "Ошибка", description: e.message || "Ошибка при добавлении товара" })
            }
        })
    }

    const openAddDialog = async () => {
        setIsAddDialogOpen(true)
        if (allProducts.length === 0) {
            const products = await getProducts(clubId)
            setAllProducts(products.map(p => ({ 
                id: p.id, 
                name: p.name,
                selling_price: p.selling_price,
                cost_price: p.cost_price
            })))
        }
    }

    const handleBarcodeScan = useCallback(async (barcode: string): Promise<boolean> => {
        // 1. First, check our local list (might have stale barcodes)
        const existingItem = items.find(i => 
            i.barcode === barcode || 
            (i.barcodes && i.barcodes.includes(barcode))
        )
        
        if (existingItem) {
            const newStock = (existingItem.actual_stock || 0) + 1
            setItems(prev => prev.map(i => i.id === existingItem.id ? { ...i, actual_stock: newStock, last_modified: Date.now() } : i))
            setScannedItem(existingItem)
            
            // Save immediately
            await handleBlur(existingItem.id, newStock)
            
            setIsScannerOpen(false) 
            return true
        }

        // 2. Not in local list with this barcode? Check the server (Admin might have added a barcode)
        try {
            const product = await getProductByBarcode(clubId, barcode)
            if (product) {
                // Is this product already in our inventory list?
                const alreadyInList = items.find(i => i.product_id === product.id)
                
                if (alreadyInList) {
                    // It's already here! Just the barcode was new. Update the item's barcodes and count it.
                    const newStock = (alreadyInList.actual_stock || 0) + 1
                    setItems(prev => prev.map(i => {
                        if (i.product_id === product.id) {
                            return { 
                                ...i, 
                                actual_stock: newStock, 
                                last_modified: Date.now(),
                                barcode: product.barcode, // Sync fresh barcodes
                                barcodes: product.barcodes 
                            }
                        }
                        return i
                    }))
                    
                    const updatedItem = { ...alreadyInList, actual_stock: newStock }
                    setScannedItem(updatedItem as InventoryItem)
                    await handleBlur(alreadyInList.id, newStock)
                    
                    setIsScannerOpen(false)
                    return true
                }

                // If truly not in list, confirm if user wants to add it
                const confirmed = await confirmAction({
                    title: "Добавить товар",
                    description: `Товар "${product.name}" не в списке инвентаризации. Добавить?`,
                    confirmText: "Добавить"
                })
                if (confirmed) {
                    setIsScannerOpen(false) 
                    await addProductToInventory(inventoryId, product.id)
                    const invItems = await getInventoryItems(inventoryId)
                    
                    // Set initial stock to 1 for the new item
                    const updatedItems = invItems.map(i => i.product_id === product.id ? { ...i, actual_stock: 1, last_modified: Date.now() } : i)
                    setItems(updatedItems)
                    
                    const newItem = updatedItems.find(i => i.product_id === product.id)
                    if (newItem) {
                        setScannedItem(newItem)
                        await handleBlur(newItem.id, 1)
                    }
                    return true
                }
            } else {
                showMessage({ title: "Товар не найден", description: `Товар со штрихкодом ${barcode} не найден в базе.` })
            }
        } catch (e) {
            console.error(e)
            showMessage({ title: "Ошибка", description: "Ошибка при поиске товара" })
        }
        return false
    }, [items, clubId, inventoryId, confirmAction, showMessage])

    const handleScannedStockSave = async () => {
        if (!scannedItem) return
        await handleBlur(scannedItem.id, scannedItem.actual_stock)
        setScannedItem(null)
    }

    // Filter and Group Items
    const groupedItems = useMemo(() => {
        let filtered = [...items]
        
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            filtered = items.filter(i => 
                i.product_name.toLowerCase().includes(q) || 
                (i.category_name && i.category_name.toLowerCase().includes(q))
            )
            
            // Sort to put exact name matches and matches at start of string first
            filtered.sort((a, b) => {
                const aName = a.product_name.toLowerCase()
                const bName = b.product_name.toLowerCase()
                
                const aExact = aName === q
                const bExact = bName === q
                if (aExact && !bExact) return -1
                if (!aExact && bExact) return 1
                
                // Priority: Recently modified items (during this search)
                const aMod = a.last_modified || 0
                const bMod = b.last_modified || 0
                if (aMod !== bMod) return bMod - aMod

                const aStarts = aName.startsWith(q)
                const bStarts = bName.startsWith(q)
                if (aStarts && !bStarts) return -1
                if (!aStarts && bStarts) return 1
                
                return aName.localeCompare(bName)
            })

            // When searching, don't group by category, just return flat list
            return [["Результаты поиска", filtered]] as [string, InventoryItem[]][]
        }

        // Group by category
        const groups: Record<string, InventoryItem[]> = {}
        filtered.forEach(item => {
            const cat = item.category_name || "Без категории"
            if (!groups[cat]) groups[cat] = []
            groups[cat].push(item)
        })
        
        // Sort items within each category: recently changed or newly added first (by timestamp)
        Object.keys(groups).forEach(cat => {
            groups[cat].sort((a, b) => {
                const aMod = a.last_modified || 0
                const bMod = b.last_modified || 0
                if (aMod !== bMod) return bMod - aMod
                
                return a.product_name.localeCompare(b.product_name)
            })
        })

        // Sort categories (put "No Category" last)
        return Object.entries(groups).sort((a, b) => {
            if (a[0] === "Без категории") return 1
            if (b[0] === "Без категории") return -1
            return a[0].localeCompare(b[0])
        })
    }, [items, searchQuery])

    useEffect(() => {
        if (scannedItem) {
            const input = document.getElementById(`input-${scannedItem.id}`)
            if (input) {
                input.focus()
                // @ts-ignore
                input.select()
            }
        }
    }, [scannedItem])

    if (isLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    }

    if (!inventory) return <div>Инвентаризация не найдена</div>

    const isClosed = inventory.status === 'CLOSED'

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 overscroll-none">
            <BarcodeScanner 
                isOpen={isScannerOpen} 
                onScan={handleBarcodeScan} 
                onClose={() => setIsScannerOpen(false)} 
            />
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Button aria-label="Вернуться к списку инвентаризаций" variant="ghost" size="icon" onClick={onClose}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            Инвентаризация #{inventory.id}
                            {isClosed ? <Badge className="bg-green-500">Завершено</Badge> : <Badge className="bg-amber-500">В процессе</Badge>}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Начата: {new Date(inventory.started_at).toLocaleString('ru-RU')}
                            {inventory.target_metric_key && (
                                <> | Метрика: <code className="bg-slate-100 px-1 rounded">{inventory.target_metric_key}</code></>
                            )}
                        </p>
                        {/* FIX #8: Progress indicator */}
                        {!isClosed && (
                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[200px]">
                                    <div 
                                        className={cn(
                                            "h-full transition-all",
                                            uncountedCount === 0 ? "bg-green-500" : "bg-amber-500"
                                        )}
                                        style={{ width: `${totalCount > 0 ? ((totalCount - uncountedCount) / totalCount) * 100 : 0}%` }}
                                    />
                                </div>
                                <span className={cn(
                                    "text-xs font-bold",
                                    uncountedCount === 0 ? "text-green-600" : "text-amber-600"
                                )}>
                                    {totalCount - uncountedCount} из {totalCount}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Поиск товара..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 text-base"
                        />
                        <button 
                            aria-label="Синхронизировать список товаров"
                            onClick={async () => {
                                setIsLoading(true)
                                try {
                                    const invItems = await getInventoryItems(inventoryId)
                                    setItems(invItems)
                                } finally {
                                    setIsLoading(false)
                                }
                            }}
                            disabled={isLoading}
                            className="absolute right-2 top-2.5 text-muted-foreground hover:text-blue-500 transition-colors"
                            title="Синхронизировать с базой"
                        >
                            <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        </button>
                    </div>
                    {!isClosed && (
                        <>
                            <Button variant="outline" onClick={() => setIsScannerOpen(true)} className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100">
                                <Camera className="h-4 w-4 md:mr-2" />
                                <span className="hidden md:inline">Сканировать</span>
                            </Button>
                            <Button variant="outline" onClick={openAddDialog}>
                                <Plus className="h-4 w-4 md:mr-2" />
                                <span className="hidden md:inline">Добавить товар</span>
                            </Button>
                            <Button 
                                onClick={() => setIsCloseDialogOpen(true)} 
                                variant="default" 
                                className={cn(
                                    "whitespace-nowrap",
                                    uncountedCount > 0 
                                        ? "bg-amber-600 hover:bg-amber-700" 
                                        : "bg-green-600 hover:bg-green-700"
                                )}
                                disabled={uncountedCount > 0}
                            >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {uncountedCount > 0 
                                    ? `Сначала посчитайте ${uncountedCount} тов.` 
                                    : inventory.target_metric_key 
                                        ? "Завершить и сверить" 
                                        : "Завершить подсчет"}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <Card>
                <CardHeader>
                    <CardTitle>Список товаров</CardTitle>
                    <CardDescription>
                        {isClosed 
                            ? "Результаты инвентаризации" 
                            : isOwner 
                                ? "Введите фактическое количество. Ожидаемый остаток показан для сверки."
                                : "Введите фактическое количество товара на полках. Система скрывает ожидаемый остаток для чистоты проверки."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                    {/* Desktop Table */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40%]">Товар</TableHead>
                                    <TableHead className="text-right">Цена продажи</TableHead>
                                    {(isClosed || isOwner) && <TableHead className="text-right text-muted-foreground">Ожидалось</TableHead>}
                                    <TableHead className="text-right w-[150px]">Фактический остаток</TableHead>
                                    {isClosed && (
                                        <>
                                            <TableHead className="text-right">Разница (шт)</TableHead>
                                            {inventory.target_metric_key && <TableHead className="text-right">Разница (₽)</TableHead>}
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupedItems.map(([category, categoryItems]) => (
                                    <React.Fragment key={`cat-group-${category}`}>
                                        <TableRow key={`cat-${category}`} className="bg-muted/50 hover:bg-muted/50">
                                            <TableCell colSpan={isClosed ? (inventory.target_metric_key ? 6 : 5) : (isOwner ? 4 : 3)} className="font-semibold py-2">
                                                {category} ({categoryItems.length})
                                            </TableCell>
                                        </TableRow>
                                        {categoryItems.map(item => {
                                            // FIX #10: Unified difference (actual - expected, matches DB)
                                            const difference = (item.actual_stock || 0) - (item.expected_stock || 0)
                                            const revenue = Math.abs(difference) * item.selling_price_snapshot

                                            return (
                                                <TableRow key={item.id} className={isClosed && difference !== 0 ? "bg-slate-50" : scannedItem?.id === item.id ? "bg-blue-50 ring-2 ring-blue-500 ring-inset" : ""}>
                                                    <TableCell className="font-medium pl-8">
                                                        <div className="flex flex-col">
                                                            <span>{item.product_name}</span>
                                                            {(item.barcode || (item.barcodes && item.barcodes.length > 0)) && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {item.barcode && (
                                                                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                            <Barcode className="h-2.5 w-2.5" />
                                                                            {item.barcode}
                                                                        </span>
                                                                    )}
                                                                    {item.barcodes?.map((bc: string) => (
                                                                        <span key={bc} className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                            <Barcode className="h-2.5 w-2.5" />
                                                                            {bc}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">{item.selling_price_snapshot} ₽</TableCell>
                                                    
                                                    {(isClosed || isOwner) && (
                                                        <TableCell className="text-right text-muted-foreground">
                                                            {item.expected_stock}
                                                        </TableCell>
                                                    )}

                                                    <TableCell className="text-right">
                                                        {isClosed ? (
                                                            editingItemId === item.id ? (
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <Input 
                                                                        type="number" 
                                                                        className="h-7 w-20 text-right text-base"
                                                                        value={correctionStock}
                                                                        onChange={e => setCorrectionStock(e.target.value)}
                                                                    />
                                                                    <Button 
                                                                        aria-label={`Сохранить корректировку ${item.product_name}`}
                                                                        size="icon" 
                                                                        variant="ghost" 
                                                                        className="h-7 w-7 text-green-600"
                                                                        onClick={() => handleSaveCorrection(item.product_id)}
                                                                        disabled={isPending}
                                                                    >
                                                                        <Save className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button 
                                                                        aria-label={`Отменить корректировку ${item.product_name}`}
                                                                        size="icon" 
                                                                        variant="ghost" 
                                                                        className="h-7 w-7 text-slate-400"
                                                                        onClick={() => setEditingItemId(null)}
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <span className="font-bold">{item.actual_stock}</span>
                                                                    {isOwner && (
                                                                        <Button 
                                                                            aria-label={`Редактировать позицию ${item.product_name}`}
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className="h-6 w-6 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                                                            onClick={() => handleStartCorrection(item)}
                                                                        >
                                                                            <Pencil className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )
                                                        ) : (
                                                            <Input 
                                                                type="number" 
                                                                id={`input-${item.id}`}
                                                                className="text-right w-24 ml-auto"
                                                                value={item.actual_stock === null ? "" : item.actual_stock}
                                                                onChange={(e) => handleStockChange(item.id, e.target.value)}
                                                                onBlur={(e) => handleBlur(item.id, e.target.value === "" ? null : Number(e.target.value))}
                                                                placeholder="0"
                                                            />
                                                        )}
                                                    </TableCell>

                                                    {isClosed && (
                                                        <>
                                                            <TableCell className="text-right">
                                                                <span className={cn(
                                                                    "font-bold",
                                                                    difference > 0 ? "text-green-600" : 
                                                                    difference < 0 ? "text-red-600" : "text-gray-400"
                                                                )}>
                                                                    {difference > 0 ? `+${difference}` : difference < 0 ? `${difference}` : '0'}
                                                                </span>
                                                            </TableCell>
                                                            {inventory.target_metric_key && (
                                                                <TableCell className="text-right font-bold">
                                                                    {revenue.toLocaleString('ru-RU')} ₽
                                                                </TableCell>
                                                            )}
                                                        </>
                                                    )}
                                                </TableRow>
                                            )
                                        })}
                                    </React.Fragment>
                                ))}
                                {items.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={isClosed ? 6 : 4} className="h-24 text-center text-muted-foreground">
                                            Товары не найдены
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y">
                        {groupedItems.map(([category, categoryItems]) => (
                            <div key={`mob-cat-${category}`} className="flex flex-col">
                                <div className="bg-slate-50 px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 border-y">
                                    {category} ({categoryItems.length})
                                </div>
                                {categoryItems.map(item => {
                                    // FIX #10: Unified difference (actual - expected, matches DB)
                                    const difference = (item.actual_stock || 0) - (item.expected_stock || 0)
                                    const revenue = Math.abs(difference) * item.selling_price_snapshot
                                    const isModified = item.actual_stock !== null

                                    return (
                                        <div key={`mob-item-${item.id}`} className={cn(
                                            "p-4 flex flex-col gap-3 active:bg-slate-50 transition-colors",
                                            isClosed && difference !== 0 ? "bg-slate-50" :
                                            scannedItem?.id === item.id ? "bg-blue-50 ring-2 ring-blue-500 ring-inset" : ""
                                        )}>
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-900 text-sm leading-tight mb-1">{item.product_name}</h4>
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.barcode && (
                                                            <span className="text-[9px] text-slate-400 font-mono bg-slate-100 px-1 rounded flex items-center gap-0.5">
                                                                <Barcode className="h-2 w-2" />
                                                                {item.barcode}
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{item.selling_price_snapshot} ₽</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-col items-end gap-1">
                                                    {isClosed ? (
                                                        <div className="flex flex-col items-end">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-slate-400">Было: {item.expected_stock}</span>
                                                                <span className="text-sm font-black text-slate-900">Стало: {item.actual_stock}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className={cn(
                                                                    "text-xs font-black px-1.5 py-0.5 rounded",
                                                                    difference === 0 ? "bg-slate-100 text-slate-500" :
                                                                    difference > 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                                                )}>
                                                                    {difference === 0 ? "OK" : difference > 0 ? `+${difference}` : `${difference}`}
                                                                </span>
                                                                {inventory.target_metric_key && (
                                                                    <span className="text-xs font-bold text-slate-700">{revenue.toLocaleString('ru-RU')} ₽</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            {(isOwner) && (
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Ожидалось</span>
                                                                    <span className="text-sm font-bold text-slate-400">{item.expected_stock}</span>
                                                                </div>
                                                            )}
                                                            <div className="relative">
                                                                <Input 
                                                                    type="number" 
                                                                    id={`mob-input-${item.id}`}
                                                                    className={cn(
                                                                        "text-center w-20 h-10 font-black text-lg p-0",
                                                                        isModified ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white"
                                                                    )}
                                                                    value={item.actual_stock === null ? "" : item.actual_stock}
                                                                    onChange={(e) => handleStockChange(item.id, e.target.value)}
                                                                    onBlur={(e) => handleBlur(item.id, e.target.value === "" ? null : Number(e.target.value))}
                                                                    placeholder="0"
                                                                />
                                                                {isModified && (
                                                                    <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 shadow-sm">
                                                                        <CheckCircle2 className="h-2.5 w-2.5" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Add Product Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Добавить товар в инвентаризацию</DialogTitle>
                        <DialogDescription>
                            Выберите товар, который был найден на складе, но отсутствует в списке.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Товар</Label>
                            <Select value={selectedProductToAdd} onValueChange={setSelectedProductToAdd}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите товар" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {allProducts.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleAddProduct} disabled={!selectedProductToAdd || isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Добавить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Close Dialog */}
            <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
                <DialogContent className="max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Завершение инвентаризации</DialogTitle>
                        <DialogDescription>
                            {inventory.target_metric_key 
                                ? `Сверьте продажи со склада с кассой за смену.` 
                                : "Подтвердите обновление остатков на складе."}
                        </DialogDescription>
                    </DialogHeader>
                    
                    {inventory.target_metric_key && (
                        <div className="space-y-4 py-2">
                            {/* Sales Summary Section */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted/50 p-2 text-xs font-bold border-b flex justify-between">
                                    <span>ПРОДАНО ЗА СМЕНУ (СИСТЕМА)</span>
                                    <span>СУММА: {totalSalesRevenue} ₽</span>
                                </div>
                                <div className="max-h-[200px] overflow-y-auto">
                                    {salesPreview.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-muted-foreground">
                                            Продаж не обнаружено.
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableBody>
                                                {salesPreview.map((s, idx) => (
                                                    <TableRow key={`${s.id}-${idx}`} className="text-[11px] h-8">
                                                        <TableCell className="py-1">
                                                            <div className="flex items-center gap-1">
                                                                {s.isUnaccounted && <Badge variant="outline" className="text-[9px] h-4 px-1 bg-blue-50 text-blue-600 border-blue-100">Неучт.</Badge>}
                                                                <span className="truncate max-w-[150px]">{s.name}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right py-1 font-mono">{s.qty} шт</TableCell>
                                                        <TableCell className="text-right py-1 font-bold">{s.total} ₽</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                                <div className="bg-blue-50 p-3 border-t flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-blue-600 font-bold uppercase">Итого к сдаче:</span>
                                        <span className="text-xl font-black text-blue-700">{totalSalesRevenue} ₽</span>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <span className="text-[10px] text-blue-600 opacity-70">Сумма в кассе:</span>
                                        <div className="flex items-center gap-2">
                                            <Input 
                                                type="number" 
                                                placeholder="0.00"
                                                value={reportedRevenue}
                                                onChange={e => setReportedRevenue(e.target.value)}
                                                className="w-24 h-8 text-right font-bold text-base bg-white"
                                            />
                                            <span className="text-sm font-bold text-blue-700">₽</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Unaccounted Sales Section */}
                            <div className="pt-2 border-t">
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-xs font-semibold">Добавить неучтенную продажу</Label>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => {
                                            openAddDialog()
                                            setIsUnaccountedDialogOpen(true)
                                        }}
                                        className="h-7 text-[10px] bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> Добавить
                                    </Button>
                                </div>
                                
                                {unaccountedSales.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {unaccountedSales.map(sale => (
                                            <div key={sale.product_id} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-full text-[10px] border border-slate-200">
                                                <span>{sale.name} ({sale.quantity} шт)</span>
                                                <button
                                                    aria-label={`Удалить неучтенную продажу ${sale.name}`}
                                                    onClick={() => removeUnaccountedSale(sale.product_id)}
                                                    className="inline-flex items-center justify-center"
                                                >
                                                    <X className="h-3 w-3 cursor-pointer text-red-500 hover:text-red-700" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Revenue Difference Warning */}
                            {reportedRevenue && Number(reportedRevenue) !== totalSalesRevenue && (
                                <div className={`p-3 rounded-lg border flex items-start gap-3 ${
                                    Number(reportedRevenue) > totalSalesRevenue 
                                        ? 'bg-amber-50 border-amber-200 text-amber-800' 
                                        : 'bg-red-50 border-red-200 text-red-800'
                                }`}>
                                    <div className="bg-white/50 p-1 rounded">
                                        <AlertTriangle className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold">
                                            {Number(reportedRevenue) > totalSalesRevenue 
                                                ? `Излишек в кассе: +${Number(reportedRevenue) - totalSalesRevenue} ₽` 
                                                : `Недостача в кассе: -${totalSalesRevenue - Number(reportedRevenue)} ₽`}
                                        </span>
                                        <p className="text-[10px] opacity-80 leading-tight mt-1">
                                            {Number(reportedRevenue) > totalSalesRevenue 
                                                ? "Сумма в кассе больше, чем проданных товаров со склада. Проверьте, все ли продажи зафиксированы в системе." 
                                                : "Денег в кассе меньше, чем должно быть по остаткам склада. Проверьте правильность подсчета товара."}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!inventory.target_metric_key && (
                        <div className="py-4">
                            <p className="text-sm text-muted-foreground">
                                Остатки на складе будут обновлены в соответствии с введенными фактическими значениями.
                            </p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleCloseInventory} disabled={(!!inventory.target_metric_key && !reportedRevenue) || isPending} className="bg-green-600 hover:bg-green-700">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {inventory.target_metric_key ? "Сверить и закрыть" : "Обновить остатки"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Unaccounted Product Dialog */}
            <Dialog open={isUnaccountedDialogOpen} onOpenChange={setIsUnaccountedDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Добавить неучтенную продажу</DialogTitle>
                        <DialogDescription>
                            Выберите товар, который был продан без остатка в системе.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Товар</Label>
                            <Select value={selectedUnaccountedProduct} onValueChange={setSelectedUnaccountedProduct}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Выберите товар" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {allProducts.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Количество</Label>
                            <Input 
                                type="number" 
                                value={unaccountedQty}
                                onChange={e => setUnaccountedQty(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUnaccountedDialogOpen(false)}>Отмена</Button>
                        <Button onClick={addUnaccountedSale} disabled={!selectedUnaccountedProduct || !unaccountedQty}>Добавить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {Dialogs}
        </div>
    )
}
