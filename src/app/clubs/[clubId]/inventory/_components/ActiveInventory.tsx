"use client"

import React, { useState, useTransition, useEffect, useMemo, useCallback } from "react"
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Save, X, Search, Camera, Barcode, RefreshCcw, Package, ReceiptText, CircleAlert, Boxes, Warehouse as WarehouseIcon, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { getInventory, getInventoryItems, updateInventoryItem, closeInventory, Inventory, InventoryItem, addProductToInventory, getProducts, getProductByBarcode, correctInventoryItem, getInventoryShiftReceipts, getInventoryPostCloseCorrections, InventoryPostCloseCorrection, ShiftReceipt } from "../actions"
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

type InventoryQuickFilter = "all" | "uncounted" | "counted" | "difference" | "shortage" | "excess" | "sold"

export function ActiveInventory({ inventoryId, onClose, isOwner, currentUserId }: ActiveInventoryProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [inventory, setInventory] = useState<Inventory | null>(null)
    const [items, setItems] = useState<InventoryItem[]>([])
    const [corrections, setCorrections] = useState<InventoryPostCloseCorrection[]>([])
    const [shiftReceipts, setShiftReceipts] = useState<ShiftReceipt[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [quickFilter, setQuickFilter] = useState<InventoryQuickFilter>("all")
    
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
                    const [inv, invItems, invCorrections] = await Promise.all([
                        getInventory(inventoryId),
                        getInventoryItems(inventoryId),
                        getInventoryPostCloseCorrections(inventoryId)
                    ])
                    setInventory(inv)
                    setItems(invItems)
                    setCorrections(invCorrections)
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
                const [inv, invItems, invCorrections] = await Promise.all([
                    getInventory(inventoryId),
                    getInventoryItems(inventoryId),
                    getInventoryPostCloseCorrections(inventoryId)
                ])
                setInventory(inv)
                setItems(invItems)
                setCorrections(invCorrections)
                if (inv.shift_id && inv.created_by) {
                    const receipts = await getInventoryShiftReceipts(clubId, inventoryId, { includeVoided: true })
                    setShiftReceipts(receipts)
                } else {
                    setShiftReceipts([])
                }
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

    const persistCountedItems = useCallback(async () => {
        const itemsToUpdate = items
            .filter(item => item.actual_stock !== null)
            .map(item => ({ id: item.id, actual_stock: item.actual_stock }))

        if (itemsToUpdate.length === 0) return
        await Promise.all(itemsToUpdate.map(item => updateInventoryItem(item.id, item.actual_stock, clubId)))
    }, [items, clubId])

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
    const isClosed = inventory?.status === 'CLOSED'
    const isCanceled = inventory?.status === 'CANCELED'
    const isReadOnly = inventory?.status !== 'OPEN'
    const usesPosRevenue = Boolean(inventory?.shift_id && inventory?.sales_capture_mode === 'SHIFT')
    const canAddUnaccountedSales = Boolean(inventory?.target_metric_key && !usesPosRevenue)
    const canCorrectClosedInventory = Boolean(isOwner && isClosed && !inventory?.shift_id && !inventory?.target_metric_key)
    const showInventoryRevenueColumn = Boolean(inventory?.target_metric_key && !usesPosRevenue)

    const salesPreview = useMemo(() => {
        if (usesPosRevenue) {
            return shiftReceipts.flatMap((receipt) => {
                if (receipt.voided_at) return []
                return (receipt.items || [])
                    .map((item) => {
                        const qty = Math.max(0, Number(item.quantity) - Number(item.returned_qty || 0))
                        return {
                            id: item.id,
                            name: item.product_name,
                            qty,
                            price: item.selling_price_snapshot,
                            total: qty * Number(item.selling_price_snapshot || 0),
                            isUnaccounted: false
                        }
                    })
                    .filter(item => item.qty > 0)
            })
        }

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
    }, [items, shiftReceipts, unaccountedSales, usesPosRevenue])

    const totalSalesRevenue = salesPreview.reduce((acc, s) => acc + s.total, 0)

    const inventorySummary = useMemo(() => {
        let counted = 0
        let shortageItems = 0
        let excessItems = 0
        let shortageValue = 0

        for (const item of items) {
            if (item.actual_stock === null) continue
            counted += 1
            const difference = Number(item.actual_stock) - Number(item.expected_stock || 0)
            if (difference < 0) {
                shortageItems += 1
                shortageValue += Math.abs(difference) * Number(item.selling_price_snapshot || 0)
            } else if (difference > 0) {
                excessItems += 1
            }
        }

        return {
            counted,
            progress: totalCount > 0 ? Math.round((counted / totalCount) * 100) : 0,
            shortageItems,
            excessItems,
            shortageValue
        }
    }, [items, totalCount])

    const summaryCards = [
        {
            label: "Посчитано",
            value: `${inventorySummary.counted}/${totalCount}`,
            hint: isReadOnly ? "Позиции инвентаризации" : `${inventorySummary.progress}% заполнено`,
            icon: Package,
            tone: "text-slate-700 bg-slate-50 border-slate-200"
        },
        {
            label: "Осталось проверить",
            value: `${uncountedCount}`,
            hint: uncountedCount === 0 ? "Все позиции заполнены" : "Пустые фактические остатки",
            icon: CircleAlert,
            tone: uncountedCount === 0 ? "text-green-700 bg-green-50 border-green-200" : "text-amber-700 bg-amber-50 border-amber-200"
        },
        {
            label: "Недостачи",
            value: `${inventorySummary.shortageItems}`,
            hint: inventorySummary.shortageValue > 0 ? `${inventorySummary.shortageValue.toLocaleString("ru-RU")} ₽ по продаже` : "Пока не обнаружены",
            icon: ReceiptText,
            tone: inventorySummary.shortageItems > 0 ? "text-red-700 bg-red-50 border-red-200" : "text-slate-700 bg-slate-50 border-slate-200"
        },
        {
            label: "Излишки",
            value: `${inventorySummary.excessItems}`,
            hint: inventorySummary.excessItems > 0 ? "Есть найденные позиции сверх ожидания" : "Пока не обнаружены",
            icon: Boxes,
            tone: inventorySummary.excessItems > 0 ? "text-green-700 bg-green-50 border-green-200" : "text-slate-700 bg-slate-50 border-slate-200"
        }
    ]

    const posSoldMap = useMemo(() => {
        const soldMap = new Map<number, number>()
        for (const receipt of shiftReceipts) {
            if (receipt.voided_at) continue
            for (const item of receipt.items || []) {
                const netQty = Math.max(0, Number(item.quantity) - Number(item.returned_qty || 0))
                if (netQty > 0) {
                    const productId = Number(item.product_id)
                    soldMap.set(productId, (soldMap.get(productId) || 0) + netQty)
                }
            }
        }
        return soldMap
    }, [shiftReceipts])

    const soldProductIds = useMemo(() => {
        return new Set<number>(Array.from(posSoldMap.keys()))
    }, [posSoldMap])

    const quickFilterOptions = useMemo(() => {
        const countedItems = items.filter(item => item.actual_stock !== null)
        const shortageItems = items.filter(item => item.actual_stock !== null && Number(item.actual_stock) < Number(item.expected_stock || 0))
        const excessItems = items.filter(item => item.actual_stock !== null && Number(item.actual_stock) > Number(item.expected_stock || 0))
        const discrepancyItems = items.filter(item => item.actual_stock !== null && Number(item.actual_stock) !== Number(item.expected_stock || 0))

        return [
            { key: "all" as const, label: "Все", count: items.length },
            { key: "uncounted" as const, label: "Не посчитано", count: uncountedItems.length },
            { key: "counted" as const, label: "Посчитано", count: countedItems.length },
            { key: "sold" as const, label: "В POS-чеке", count: items.filter(item => soldProductIds.has(Number(item.product_id))).length },
            { key: "difference" as const, label: "С расхождением", count: discrepancyItems.length },
            { key: "shortage" as const, label: "Недостача", count: shortageItems.length },
            { key: "excess" as const, label: "Излишек", count: excessItems.length }
        ]
    }, [items, soldProductIds, uncountedItems.length])

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
                setIsSaving(true)
                await persistCountedItems()
                await closeInventory(
                    inventoryId,
                    clubId,
                    metricRequired ? Number(reportedRevenue) : 0,
                    (canAddUnaccountedSales ? unaccountedSales : []).map(s => ({
                        product_id: s.product_id,
                        quantity: s.quantity,
                        selling_price: s.selling_price,
                        cost_price: s.cost_price
                    }))
                )
                setIsCloseDialogOpen(false)
                onClose() // Go back to list
            } catch (e: any) {
                console.error(e)
                showMessage({ title: "Ошибка", description: e?.message || "Ошибка при закрытии инвентаризации" })
            } finally {
                setIsSaving(false)
            }
        })
    }

    const addUnaccountedSale = () => {
        const product = allProducts.find(p => p.id === Number(selectedUnaccountedProduct))
        if (!product || !unaccountedQty) return

        const quantity = Number(unaccountedQty)
        if (!Number.isInteger(quantity) || quantity <= 0) {
            showMessage({ title: "Проверьте количество", description: "Количество должно быть целым положительным числом" })
            return
        }

        const inInventory = items.some(i => i.product_id === product.id)
        if (inInventory) {
            showMessage({ title: "Товар уже в инвентаризации", description: "Укажите остаток по этому товару в основном списке, а не как неучтенную продажу." })
            setIsUnaccountedDialogOpen(false)
            return
        }

        setUnaccountedSales(prev => {
            const existing = prev.find(sale => sale.product_id === product.id)
            if (existing) {
                return prev.map(sale =>
                    sale.product_id === product.id
                        ? { ...sale, quantity: sale.quantity + quantity }
                        : sale
                )
            }
            return [
                ...prev,
                {
                    product_id: product.id,
                    name: product.name,
                    quantity,
                    selling_price: product.selling_price || 0,
                    cost_price: product.cost_price || 0
                }
            ]
        })
        setSelectedUnaccountedProduct("")
        setUnaccountedQty("1")
        setIsUnaccountedDialogOpen(false)
    }

    const removeUnaccountedSale = (productId: number) => {
        setUnaccountedSales(prev => prev.filter(s => s.product_id !== productId))
    }

    const ensureProductsLoaded = useCallback(async () => {
        if (allProducts.length > 0) return
        const products = await getProducts(clubId)
        setAllProducts(products.map(p => ({
            id: p.id,
            name: p.name,
            selling_price: p.selling_price,
            cost_price: p.cost_price
        })))
    }, [allProducts.length, clubId])

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
        await ensureProductsLoaded()
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

    const compareInventoryItems = useCallback((a: InventoryItem, b: InventoryItem, searchTerm?: string) => {
        const aSold = soldProductIds.has(Number(a.product_id))
        const bSold = soldProductIds.has(Number(b.product_id))
        if (aSold !== bSold) return aSold ? -1 : 1

        const aMod = a.last_modified || 0
        const bMod = b.last_modified || 0
        if (aMod !== bMod) return bMod - aMod

        if (searchTerm) {
            const q = searchTerm.toLowerCase()
            const aName = a.product_name.toLowerCase()
            const bName = b.product_name.toLowerCase()

            const aExact = aName === q
            const bExact = bName === q
            if (aExact !== bExact) return aExact ? -1 : 1

            const aStarts = aName.startsWith(q)
            const bStarts = bName.startsWith(q)
            if (aStarts !== bStarts) return aStarts ? -1 : 1
        }

        return a.product_name.localeCompare(b.product_name)
    }, [soldProductIds])

    // Filter and Group Items
    const groupedItems = useMemo(() => {
        let filtered = [...items]

        if (quickFilter !== "all") {
            filtered = filtered.filter(item => {
                const actual = item.actual_stock
                const expected = Number(item.expected_stock || 0)
                if (quickFilter === "uncounted") return actual === null
                if (quickFilter === "counted") return actual !== null
                if (quickFilter === "sold") return soldProductIds.has(Number(item.product_id))
                if (actual === null) return false
                if (quickFilter === "difference") return Number(actual) !== expected
                if (quickFilter === "shortage") return Number(actual) < expected
                if (quickFilter === "excess") return Number(actual) > expected
                return true
            })
        }
        
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(i => 
                i.product_name.toLowerCase().includes(q) || 
                (i.category_name && i.category_name.toLowerCase().includes(q))
            )
            
            filtered.sort((a, b) => compareInventoryItems(a, b, q))

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
            groups[cat].sort((a, b) => compareInventoryItems(a, b))
        })

        // Sort categories (put "No Category" last)
        return Object.entries(groups).sort((a, b) => {
            if (a[0] === "Без категории") return 1
            if (b[0] === "Без категории") return -1
            return a[0].localeCompare(b[0])
        })
    }, [items, searchQuery, quickFilter, compareInventoryItems])

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

    return (
        <div className="space-y-6 overscroll-none">
            <BarcodeScanner 
                isOpen={isScannerOpen} 
                onScan={handleBarcodeScan} 
                onClose={() => setIsScannerOpen(false)} 
            />
            {/* Header */}
            <div className="rounded-2xl border bg-gradient-to-br from-white via-slate-50 to-slate-100 p-4 md:p-6 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <Button aria-label="Вернуться к списку инвентаризаций" variant="outline" size="icon" onClick={onClose} className="mt-1 shrink-0 rounded-xl">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-xl font-black text-slate-900 md:text-2xl">Инвентаризация #{inventory.id}</h2>
                                    {isClosed ? (
                                        <Badge className="bg-green-600">Завершено</Badge>
                                    ) : isCanceled ? (
                                        <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">Отменено</Badge>
                                    ) : (
                                        <Badge className="bg-amber-500">В процессе</Badge>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                    <span>Начата: {new Date(inventory.started_at).toLocaleString('ru-RU')}</span>
                                    <span className="inline-flex items-center gap-1">
                                        <WarehouseIcon className="h-3.5 w-3.5 text-slate-400" />
                                        {inventory.warehouse_name || "Склад не указан"}
                                    </span>
                                    {inventory.target_metric_key && (
                                        <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                                            Метрика: {inventory.target_metric_key}
                                        </span>
                                    )}
                                </div>
                                {!isReadOnly && (
                                    <div className="rounded-2xl border bg-white/80 p-3">
                                        <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                            <span>Готовность подсчёта</span>
                                            <span>{inventorySummary.progress}%</span>
                                        </div>
                                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                            <div
                                                className={cn(
                                                    "h-full transition-all",
                                                    uncountedCount === 0 ? "bg-green-500" : "bg-amber-500"
                                                )}
                                                style={{ width: `${inventorySummary.progress}%` }}
                                            />
                                        </div>
                                        <p className="mt-2 text-xs text-slate-500">
                                            {uncountedCount === 0 ? "Можно завершать подсчёт — все позиции заполнены." : `Осталось проверить ${uncountedCount} поз.`}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {summaryCards.map(card => {
                                const Icon = card.icon
                                return (
                                    <Card key={card.label} className="border-slate-200/80 shadow-none">
                                        <CardContent className="flex items-start justify-between p-4">
                                            <div className="space-y-1">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
                                                <p className="text-2xl font-black text-slate-900">{card.value}</p>
                                                <p className="text-xs text-slate-500">{card.hint}</p>
                                            </div>
                                            <div className={cn("rounded-xl border p-2.5", card.tone)}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 xl:max-w-sm">
                        <div className="relative w-full">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Поиск по товару или категории..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-11 rounded-xl border-slate-200 bg-white pl-8 text-base"
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
                        {!isReadOnly && (
                            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                                <Button variant="outline" onClick={() => setIsScannerOpen(true)} className="h-11 rounded-xl bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100">
                                    <Camera className="mr-2 h-4 w-4" />
                                    Сканировать товар
                                </Button>
                                <Button variant="outline" onClick={openAddDialog} className="h-11 rounded-xl">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Добавить позицию
                                </Button>
                                <Button 
                                    onClick={() => setIsCloseDialogOpen(true)} 
                                    variant="default" 
                                    className={cn(
                                        "h-11 rounded-xl whitespace-nowrap",
                                        uncountedCount > 0 
                                            ? "bg-amber-600 hover:bg-amber-700" 
                                            : "bg-green-600 hover:bg-green-700"
                                    )}
                                    disabled={uncountedCount > 0}
                                >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    {uncountedCount > 0 
                                        ? `Осталось ${uncountedCount} поз.` 
                                        : inventory.target_metric_key 
                                            ? "Завершить и сверить" 
                                            : "Завершить подсчёт"}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <Card>
                <CardHeader>
                    <CardTitle>Список товаров</CardTitle>
                    <CardDescription>
                        {isClosed 
                            ? "Результаты инвентаризации" 
                            : isCanceled
                                ? "Инвентаризация была отменена. Данные доступны только для истории."
                            : isOwner 
                                ? "Введите фактическое количество. Ожидаемый остаток показан для сверки."
                                : "Введите фактическое количество товара на полках. Система скрывает ожидаемый остаток для чистоты проверки."}
                    </CardDescription>
                    <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-500">
                        <Badge variant="outline" className="bg-white">Групп по категориям: {groupedItems.length}</Badge>
                        <Badge variant="outline" className="bg-white">Товаров: {items.length}</Badge>
                        {searchQuery && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Поиск: {searchQuery}</Badge>}
                        {quickFilter !== "all" && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                Фильтр: {quickFilterOptions.find(option => option.key === quickFilter)?.label}
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {quickFilterOptions.map(option => (
                            <Button
                                key={option.key}
                                type="button"
                                variant={quickFilter === option.key ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                    "h-8 rounded-full px-3 text-xs font-semibold",
                                    quickFilter === option.key
                                        ? "bg-slate-900 text-white hover:bg-slate-800"
                                        : "bg-white"
                                )}
                                onClick={() => setQuickFilter(option.key)}
                            >
                                {option.label}
                                <span className="ml-2 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] leading-none">
                                    {option.count}
                                </span>
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                    {/* Desktop Table */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40%]">Товар</TableHead>
                                    <TableHead className="text-right">Цена продажи</TableHead>
                                    {(isReadOnly || isOwner) && <TableHead className="text-right text-muted-foreground">Ожидалось</TableHead>}
                                    <TableHead className="text-right w-[150px]">Фактический остаток</TableHead>
                                    {isClosed && (
                                        <>
                                            <TableHead className="text-right">Разница (шт)</TableHead>
                                            {showInventoryRevenueColumn && <TableHead className="text-right">Разница (₽)</TableHead>}
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupedItems.map(([category, categoryItems]) => (
                                    <React.Fragment key={`cat-group-${category}`}>
                                        <TableRow key={`cat-${category}`} className="bg-muted/50 hover:bg-muted/50">
                                            <TableCell colSpan={isClosed ? (showInventoryRevenueColumn ? 6 : 5) : ((isReadOnly || isOwner) ? 4 : 3)} className="font-semibold py-2">
                                                {category} ({categoryItems.length})
                                            </TableCell>
                                        </TableRow>
                                        {categoryItems.map(item => {
                                            // FIX #10: Unified difference (actual - expected, matches DB)
                                            const difference = (item.actual_stock || 0) - (item.expected_stock || 0)
                                            const inventoryValue = difference * item.selling_price_snapshot

                                            return (
                                                <TableRow key={item.id} className={cn(
                                                    isClosed && difference < 0 ? "bg-red-50/40" : isClosed && difference > 0 ? "bg-green-50/40" : scannedItem?.id === item.id ? "bg-blue-50 ring-2 ring-blue-500 ring-inset" : "",
                                                    !isReadOnly && item.actual_stock !== null && "bg-blue-50/30"
                                                )}>
                                                    <TableCell className="font-medium pl-8">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span>{item.product_name}</span>
                                                                {!isReadOnly && item.actual_stock !== null && (
                                                                    <Badge variant="outline" className="h-5 border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700">Посчитан</Badge>
                                                                )}
                                                                {soldProductIds.has(Number(item.product_id)) && (
                                                                    <Badge variant="outline" className="h-5 border-violet-200 bg-violet-50 text-[10px] font-bold text-violet-700">
                                                                        POS · {posSoldMap.get(Number(item.product_id)) || 0} шт
                                                                    </Badge>
                                                                )}
                                                            </div>
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
                                                    
                                                    {(isReadOnly || isOwner) && (
                                                        <TableCell className="text-right text-muted-foreground">
                                                            {item.expected_stock}
                                                        </TableCell>
                                                    )}

                                                    <TableCell className="text-right">
                                                        {isReadOnly ? (
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
                                                                    {canCorrectClosedInventory && (
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
                                                            {showInventoryRevenueColumn && (
                                                                <TableCell className={cn(
                                                                    "text-right font-bold",
                                                                    inventoryValue > 0 ? "text-green-600" : inventoryValue < 0 ? "text-red-600" : "text-slate-500"
                                                                )}>
                                                                    {inventoryValue > 0 ? `+${inventoryValue.toLocaleString('ru-RU')} ₽` : inventoryValue < 0 ? `${inventoryValue.toLocaleString('ru-RU')} ₽` : '0 ₽'}
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
                                        <TableCell colSpan={isClosed ? 6 : ((isReadOnly || isOwner) ? 4 : 3)} className="h-24 text-center text-muted-foreground">
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
                                    const inventoryValue = difference * item.selling_price_snapshot
                                    const isModified = item.actual_stock !== null

                                    return (
                                        <div key={`mob-item-${item.id}`} className={cn(
                                            "p-4 flex flex-col gap-3 active:bg-slate-50 transition-colors",
                                            isClosed && difference < 0 ? "bg-red-50/50" :
                                            isClosed && difference > 0 ? "bg-green-50/50" :
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
                                                        {soldProductIds.has(Number(item.product_id)) && (
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 px-1 rounded border border-violet-200">
                                                                POS · {posSoldMap.get(Number(item.product_id)) || 0} шт
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{item.selling_price_snapshot} ₽</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-col items-end gap-1">
                                                    {isReadOnly ? (
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
                                                                {showInventoryRevenueColumn && (
                                                                    <span className={cn(
                                                                        "text-xs font-bold",
                                                                        inventoryValue > 0 ? "text-green-600" : inventoryValue < 0 ? "text-red-600" : "text-slate-500"
                                                                    )}>
                                                                        {inventoryValue > 0 ? `+${inventoryValue.toLocaleString('ru-RU')} ₽` : inventoryValue < 0 ? `${inventoryValue.toLocaleString('ru-RU')} ₽` : '0 ₽'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            {(isReadOnly || isOwner) && (
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

            {isClosed && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-slate-500" />
                            <CardTitle>История пост-коррекций</CardTitle>
                        </div>
                        <CardDescription>
                            Показывает все изменения, которые были внесены после закрытия ревизии.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {corrections.length === 0 ? (
                            <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">
                                После закрытия этой инвентаризации корректировок не было.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {corrections.map(correction => (
                                    <div key={correction.id} className="rounded-2xl border bg-white p-4">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900">{correction.product_name}</span>
                                                    <Badge variant="outline" className={cn(
                                                        "text-[10px] font-bold",
                                                        correction.stock_delta > 0 ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
                                                    )}>
                                                        {correction.stock_delta > 0 ? `+${correction.stock_delta}` : correction.stock_delta} шт
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    Было: {correction.old_actual_stock} · Стало: {correction.new_actual_stock} · Разница до: {correction.difference_before ?? "—"} · После: {correction.difference_after}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Причина: {correction.reason || "Не указана"}
                                                </p>
                                            </div>
                                            <div className="text-xs text-slate-500 md:text-right">
                                                <div>{new Date(correction.created_at).toLocaleString('ru-RU')}</div>
                                                <div className="font-semibold text-slate-700">{correction.created_by_name || correction.created_by}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

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
                                ? usesPosRevenue
                                    ? `Сверьте сумму чеков смены с кассой. Инвентаризация больше не подменяет продажи складскими корректировками.`
                                    : `Сверьте продажи по расхождениям склада с кассой за смену.`
                                : "Подтвердите обновление остатков на складе."}
                        </DialogDescription>
                    </DialogHeader>
                    
                    {inventory.target_metric_key && (
                        <div className="space-y-4 py-2">
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-2xl border bg-slate-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Недостачи</p>
                                    <p className="mt-1 text-lg font-black text-slate-900">{inventorySummary.shortageItems}</p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Излишки</p>
                                    <p className="mt-1 text-lg font-black text-slate-900">{inventorySummary.excessItems}</p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Не посчитано</p>
                                    <p className="mt-1 text-lg font-black text-slate-900">{uncountedCount}</p>
                                </div>
                            </div>

                            {/* Sales Summary Section */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted/50 p-2 text-xs font-bold border-b flex justify-between">
                                    <span>{usesPosRevenue ? "ПРОДАЖИ ПО POS" : "ПРОДАНО ЗА СМЕНУ (СИСТЕМА)"}</span>
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

                            {canAddUnaccountedSales && (
                                <div className="pt-2 border-t">
                                    <div className="flex items-center justify-between mb-2">
                                        <Label className="text-xs font-semibold">Добавить неучтенную продажу</Label>
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={async () => {
                                                await ensureProductsLoaded()
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
                            )}

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
                                                ? usesPosRevenue
                                                    ? "Сумма в кассе больше, чем сумма чеков по смене. Проверьте лишние поступления наличных или непробитые возвраты."
                                                    : "Сумма в кассе больше, чем проданных товаров со склада. Проверьте, все ли продажи зафиксированы в системе."
                                                : usesPosRevenue
                                                    ? "Денег в кассе меньше, чем по чекам смены. Проверьте отмены, возвраты и дисциплину пробития."
                                                    : "Денег в кассе меньше, чем должно быть по остаткам склада. Проверьте правильность подсчета товара."}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!inventory.target_metric_key && (
                        <div className="space-y-3 py-4">
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-2xl border bg-slate-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Посчитано</p>
                                    <p className="mt-1 text-lg font-black text-slate-900">{inventorySummary.counted}</p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Недостачи</p>
                                    <p className="mt-1 text-lg font-black text-slate-900">{inventorySummary.shortageItems}</p>
                                </div>
                                <div className="rounded-2xl border bg-slate-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Излишки</p>
                                    <p className="mt-1 text-lg font-black text-slate-900">{inventorySummary.excessItems}</p>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Остатки на складе будут обновлены по введённым фактическим значениям. Перед подтверждением проверьте недостачи и излишки.
                            </p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleCloseInventory} disabled={(!!inventory.target_metric_key && !reportedRevenue) || isPending || isSaving} className="bg-green-600 hover:bg-green-700">
                            {(isPending || isSaving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
