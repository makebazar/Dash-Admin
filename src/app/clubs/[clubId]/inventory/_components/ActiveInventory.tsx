"use client"

import { useState, useTransition, useEffect, useMemo, useCallback } from "react"
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Save, X, Search, Camera, Barcode } from "lucide-react"
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

interface ActiveInventoryProps {
    inventoryId: number
    onClose: () => void
    isOwner: boolean
}

export function ActiveInventory({ inventoryId, onClose, isOwner }: ActiveInventoryProps) {
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
            const res = await correctInventoryItem(inventoryId, productId, val, clubId)
            if (res.success) {
                // Refresh data
                const [inv, invItems] = await Promise.all([
                    getInventory(inventoryId),
                    getInventoryItems(inventoryId)
                ])
                setInventory(inv)
                setItems(invItems)
                setEditingItemId(null)
            } else {
                alert("Ошибка при сохранении: " + res.error)
            }
        })
    }

    // Barcode Scanner State
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null)

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
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, actual_stock: numVal } : i))
    }

    // Saves to server only when user leaves the field
    const handleBlur = async (itemId: number, val: number | null) => {
        try {
            await updateInventoryItem(itemId, val, clubId)
        } catch (e) {
            console.error("Failed to save item", e)
        }
    }

    // Calculate Sales Summary for Preview
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
                alert("Ошибка при закрытии инвентаризации")
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
                alert(e.message)
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
        // 1. Find item in the current inventory list
        const existingItem = items.find(i => i.barcode === barcode)
        
        if (existingItem) {
            const newStock = (existingItem.actual_stock || 0) + 1
            setItems(prev => prev.map(i => i.id === existingItem.id ? { ...i, actual_stock: newStock } : i))
            setScannedItem(existingItem)
            
            // Save immediately
            await handleBlur(existingItem.id, newStock)
            
            // We don't close the scanner to allow multiple scans
            return true
        }

        // 2. If not in current list, try to find in general products
        try {
            const product = await getProductByBarcode(clubId, barcode)
            if (product) {
                // Confirm if user wants to add this product to current inventory
                if (confirm(`Товар "${product.name}" не в списке инвентаризации. Добавить?`)) {
                    setIsScannerOpen(false) // Close scanner to show confirm/dialog
                    await addProductToInventory(inventoryId, product.id)
                    const invItems = await getInventoryItems(inventoryId)
                    
                    // Set initial stock to 1 for the new item
                    const updatedItems = invItems.map(i => i.product_id === product.id ? { ...i, actual_stock: 1 } : i)
                    setItems(updatedItems)
                    
                    const newItem = updatedItems.find(i => i.product_id === product.id)
                    if (newItem) {
                        setScannedItem(newItem)
                        await handleBlur(newItem.id, 1)
                    }
                    return true
                }
            } else {
                alert(`Товар со штрихкодом ${barcode} не найден в базе.`)
            }
        } catch (e) {
            console.error(e)
            alert("Ошибка при поиске товара")
        }
        return false
    }, [items, clubId, inventoryId])

    const handleScannedStockSave = async () => {
        if (!scannedItem) return
        await handleBlur(scannedItem.id, scannedItem.actual_stock)
        setScannedItem(null)
    }

    // Filter and Group Items
    const groupedItems = useMemo(() => {
        let filtered = items
        
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            filtered = items.filter(i => 
                i.product_name.toLowerCase().includes(q) || 
                (i.category_name && i.category_name.toLowerCase().includes(q))
            )
        }

        // Group by category
        const groups: Record<string, InventoryItem[]> = {}
        filtered.forEach(item => {
            const cat = item.category_name || "Без категории"
            if (!groups[cat]) groups[cat] = []
            groups[cat].push(item)
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
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <BarcodeScanner 
                isOpen={isScannerOpen} 
                onScan={handleBarcodeScan} 
                onClose={() => setIsScannerOpen(false)} 
            />
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            Инвентаризация #{inventory.id}
                            {isClosed ? <Badge className="bg-green-500">Завершено</Badge> : <Badge className="bg-amber-500">В процессе</Badge>}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Начата: {new Date(inventory.started_at).toLocaleString()} 
                            {inventory.target_metric_key && (
                                <> | Метрика: <code className="bg-slate-100 px-1 rounded">{inventory.target_metric_key}</code></>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Поиск товара..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8"
                        />
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
                            <Button onClick={() => setIsCloseDialogOpen(true)} variant="default" className="bg-green-600 hover:bg-green-700 whitespace-nowrap">
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {inventory.target_metric_key ? "Завершить и сверить" : "Завершить подсчет"}
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
                <CardContent>
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
                                <>
                                    <TableRow key={`cat-${category}`} className="bg-muted/50 hover:bg-muted/50">
                                        <TableCell colSpan={isClosed ? (inventory.target_metric_key ? 6 : 5) : (isOwner ? 4 : 3)} className="font-semibold py-2">
                                            {category} ({categoryItems.length})
                                        </TableCell>
                                    </TableRow>
                                    {categoryItems.map(item => {
                                        const difference = (item.expected_stock || 0) - (item.actual_stock || 0)
                                        const revenue = difference * item.selling_price_snapshot
                                        
                                        return (
                                            <TableRow key={item.id} className={isClosed && difference !== 0 ? "bg-slate-50" : scannedItem?.id === item.id ? "bg-blue-50 ring-2 ring-blue-500 ring-inset" : ""}>
                                                <TableCell className="font-medium pl-8">
                                                    <div className="flex flex-col">
                                                        <span>{item.product_name}</span>
                                                        {item.barcode && (
                                                            <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                                                <Barcode className="h-2.5 w-2.5" />
                                                                {item.barcode}
                                                            </span>
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
                                                                    className="h-7 w-20 text-right text-xs"
                                                                    value={correctionStock}
                                                                    onChange={e => setCorrectionStock(e.target.value)}
                                                                />
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    className="h-7 w-7 text-green-600"
                                                                    onClick={() => handleSaveCorrection(item.product_id)}
                                                                    disabled={isPending}
                                                                >
                                                                    <Save className="h-3 w-3" />
                                                                </Button>
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    className="h-7 w-7 text-slate-400"
                                                                    onClick={() => setEditingItemId(null)}
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-2 group/cell">
                                                                <span className="font-bold">{item.actual_stock}</span>
                                                                {isOwner && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-6 w-6 opacity-0 group-hover/cell:opacity-100 text-slate-400 hover:text-blue-500"
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
                                                            <span className={difference > 0 ? "text-green-600" : difference < 0 ? "text-red-600" : "text-gray-400"}>
                                                                {difference > 0 ? `-${difference}` : `+${Math.abs(difference)}`} 
                                                            </span>
                                                        </TableCell>
                                                        {inventory.target_metric_key && (
                                                            <TableCell className="text-right font-bold">
                                                                {revenue.toLocaleString()} ₽
                                                            </TableCell>
                                                        )}
                                                    </>
                                                )}
                                            </TableRow>
                                        )
                                    })}
                                </>
                            ))}
                            {items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        Товары не найдены
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
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
                                                className="w-24 h-8 text-right font-bold text-sm bg-white"
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
                                                <X 
                                                    className="h-3 w-3 cursor-pointer text-red-500 hover:text-red-700" 
                                                    onClick={() => removeUnaccountedSale(sale.product_id)}
                                                />
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
        </div>
    )
}
