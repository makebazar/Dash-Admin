"use client"

import { useState, useTransition, useEffect, useMemo } from "react"
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Save, X, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { getInventory, getInventoryItems, updateInventoryItem, closeInventory, Inventory, InventoryItem, addProductToInventory, getProducts } from "../actions"
import { useParams } from "next/navigation"
import { Plus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
    
    // Add Item State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [allProducts, setAllProducts] = useState<{ id: number, name: string }[]>([])
    const [selectedProductToAdd, setSelectedProductToAdd] = useState("")

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState("")

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

    const handleCloseInventory = async () => {
        // If owner didn't select a metric (metric is null), we don't need reported revenue
        const metricRequired = !!inventory?.target_metric_key
        if (metricRequired && !reportedRevenue) return

        startTransition(async () => {
            try {
                await closeInventory(inventoryId, clubId, metricRequired ? Number(reportedRevenue) : 0)
                setIsCloseDialogOpen(false)
                onClose() // Go back to list
            } catch (e) {
                console.error(e)
                alert("Ошибка при закрытии инвентаризации")
            }
        })
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
            setAllProducts(products.map(p => ({ id: p.id, name: p.name })))
        }
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

    if (isLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    }

    if (!inventory) return <div>Инвентаризация не найдена</div>

    const isClosed = inventory.status === 'CLOSED'

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
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
                                            <TableRow key={item.id} className={isClosed && difference !== 0 ? "bg-slate-50" : ""}>
                                                <TableCell className="font-medium pl-8">{item.product_name}</TableCell>
                                                <TableCell className="text-right">{item.selling_price_snapshot} ₽</TableCell>
                                                
                                                {(isClosed || isOwner) && (
                                                    <TableCell className="text-right text-muted-foreground">
                                                        {item.expected_stock}
                                                    </TableCell>
                                                )}

                                                <TableCell className="text-right">
                                                    {isClosed ? (
                                                        <span className="font-bold">{item.actual_stock}</span>
                                                    ) : (
                                                        <Input 
                                                            type="number" 
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Завершение инвентаризации</DialogTitle>
                        <DialogDescription>
                            {inventory.target_metric_key 
                                ? `Введите сумму из отчета (поле: ${inventory.target_metric_key}) для сверки.` 
                                : "Подтвердите обновление остатков на складе."}
                        </DialogDescription>
                    </DialogHeader>
                    
                    {inventory.target_metric_key && (
                        <div className="space-y-4 py-4">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <p className="text-sm text-blue-800 font-medium">Как это работает?</p>
                                <p className="text-xs text-blue-600 mt-1">
                                    Мы посчитаем разницу остатков (Было - Стало) и умножим на цену продажи.
                                    Полученная сумма должна совпасть с тем, что в кассе/отчете.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Сумма по отчету (₽)</Label>
                                <Input 
                                    type="number" 
                                    placeholder="0.00"
                                    value={reportedRevenue}
                                    onChange={e => setReportedRevenue(e.target.value)}
                                    className="text-lg font-bold"
                                />
                            </div>
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
        </div>
    )
}
