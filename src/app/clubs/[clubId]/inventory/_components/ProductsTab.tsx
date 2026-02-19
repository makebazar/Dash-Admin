"use client"

import { useState, useTransition } from "react"
import { Plus, Search, Filter, MoreVertical, Pencil, Trash2, LayoutGrid, Box, RefreshCw, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createProduct, updateProduct, deleteProduct, bulkUpdatePrices, writeOffProduct, getProductHistory, Product, Category, adjustWarehouseStock, getReplenishmentRulesForProduct, createReplenishmentRule, deleteReplenishmentRule, ReplenishmentRule, Warehouse } from "../actions"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface ProductsTabProps {
    products: Product[]
    categories: Category[]
    warehouses: Warehouse[]
    currentUserId: string
}

export function ProductsTab({ products, categories, warehouses, currentUserId }: ProductsTabProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [search, setSearch] = useState("")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    
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

    const [isPending, startTransition] = useTransition()

    // Filter Logic
    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
        const matchesCategory = categoryFilter === "all" || (p.category_id?.toString() === categoryFilter)
        return matchesSearch && matchesCategory
    })

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
                alert(err.message || "Ошибка при обновлении остатка")
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
                const rules = await getReplenishmentRulesForProduct(replenishmentDialog.product!.id)
                setReplenishmentDialog(prev => ({ ...prev, rules }))
            } catch (err: any) {
                alert(err.message || "Ошибка при создании правила")
            }
        })
    }

    const handleDeleteReplenishmentRule = async (ruleId: number) => {
        if (!confirm("Удалить правило?")) return
        startTransition(async () => {
            try {
                await deleteReplenishmentRule(ruleId, clubId)
                // Refresh rules
                const rules = await getReplenishmentRulesForProduct(replenishmentDialog.product!.id)
                setReplenishmentDialog(prev => ({ ...prev, rules }))
            } catch (err: any) {
                alert(err.message || "Ошибка при удалении")
            }
        })
    }

    const openReplenishment = async (product: Product) => {
        setReplenishmentDialog({ isOpen: true, product, rules: [] })
        const rules = await getReplenishmentRulesForProduct(product.id)
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
                        category_id: editingProduct.category_id || null,
                        cost_price: Number(editingProduct.cost_price) || 0,
                        selling_price: Number(editingProduct.selling_price) || 0,
                        current_stock: Number(editingProduct.current_stock) || 0,
                        min_stock_level: Number(editingProduct.min_stock_level) || 0,
                        is_active: editingProduct.is_active ?? true
                    })
                } else {
                    await createProduct(clubId, currentUserId, {
                        name: editingProduct.name!,
                        category_id: editingProduct.category_id || null,
                        cost_price: Number(editingProduct.cost_price) || 0,
                        selling_price: Number(editingProduct.selling_price) || 0,
                        current_stock: Number(editingProduct.current_stock) || 0,
                        min_stock_level: Number(editingProduct.min_stock_level) || 0
                    })
                }
                setIsDialogOpen(false)
                setEditingProduct(null)
                setDesiredMarkup("")
                setDesiredMargin("")
            } catch (err) {
                console.error(err)
                alert("Ошибка при сохранении")
            }
        })
    }

    const handleDelete = (id: number) => {
        if (!confirm("Вы уверены? Это действие нельзя отменить.")) return
        startTransition(async () => {
            await deleteProduct(id, clubId)
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
                alert(err.message || "Ошибка при списании")
            }
        })
    }

    const openHistory = async (product: Product) => {
        setHistoryDialog({ isOpen: true, product, logs: [] })
        const logs = await getProductHistory(product.id)
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
        if (selectedIds.size === filteredProducts.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(filteredProducts.map(p => p.id)))
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex gap-4 flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Поиск товара..." 
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Категория" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все категории</SelectItem>
                            {categories.map(c => (
                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                    {selectedIds.size > 0 && (
                        <Button variant="secondary" onClick={() => setIsBulkDialogOpen(true)}>
                            <Layers className="mr-2 h-4 w-4" />
                            Изменить цены ({selectedIds.size})
                        </Button>
                    )}
                    <Button onClick={() => {
                        setEditingProduct({ is_active: true, current_stock: 0, cost_price: 0, selling_price: 0 })
                        setDesiredMarkup("")
                        setDesiredMargin("")
                        setIsDialogOpen(true)
                    }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить товар
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <input 
                                    type="checkbox"
                                    className="rounded border-gray-300"
                                    checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead>Категория</TableHead>
                            <TableHead className="text-right">Закупка</TableHead>
                            <TableHead className="text-right">Продажа</TableHead>
                            <TableHead className="text-right">Наценка</TableHead>
                            <TableHead className="text-right">Маржа</TableHead>
                            <TableHead className="text-right">Остаток</TableHead>
                            <TableHead className="text-right">Сумма</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.map(product => {
                            const isLowStock = product.min_stock_level > 0 && product.current_stock <= product.min_stock_level
                            return (
                                <TableRow key={product.id} className={isLowStock ? "bg-red-50 hover:bg-red-100" : ""}>
                                    <TableCell>
                                        <input 
                                            type="checkbox"
                                            className="rounded border-gray-300"
                                            checked={selectedIds.has(product.id)}
                                            onChange={() => toggleSelection(product.id)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {product.name}
                                        {isLowStock && <span className="ml-2 text-xs text-red-600 font-bold">!</span>}
                                    </TableCell>
                                    <TableCell>
                                        {product.category_name ? (
                                            <Badge variant="outline">{product.category_name}</Badge>
                                        ) : <span className="text-muted-foreground text-sm">—</span>}
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">{product.cost_price} ₽</TableCell>
                                    <TableCell className="text-right font-bold whitespace-nowrap">{product.selling_price} ₽</TableCell>
                                    <TableCell className="text-right">
                                        {product.cost_price > 0 ? (
                                            <span className="text-sm font-medium">
                                                {Math.round(((product.selling_price - product.cost_price) / product.cost_price) * 100)}%
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {product.selling_price > 0 ? (
                                            <span className="text-sm font-medium">
                                                {Math.round(((product.selling_price - product.cost_price) / product.selling_price) * 100)}%
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        <div className="flex flex-col items-end">
                                            <span className={`text-sm font-medium ${isLowStock ? "text-red-600 font-bold" : ""}`}>
                                                {product.current_stock} шт
                                            </span>
                                            {product.stocks && product.stocks.length > 0 && (
                                                <div className="flex flex-col text-[10px] text-muted-foreground mt-1">
                                                    {product.stocks.map((s, i) => (
                                                        <span key={i} title={s.warehouse_name} className={s.is_default ? "font-semibold" : ""}>
                                                            {s.warehouse_name.substring(0, 8)}{s.warehouse_name.length > 8 ? '...' : ''}: {s.quantity}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        <span className="text-sm text-muted-foreground">
                                            {(product.current_stock * product.cost_price).toLocaleString()} ₽
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => {
                                                    setEditingProduct(product)
                                                    // Calculate initial markup/margin for display
                                                    if (product.cost_price > 0 && product.selling_price > 0) {
                                                        setDesiredMarkup(((product.selling_price - product.cost_price) / product.cost_price * 100).toFixed(1))
                                                        setDesiredMargin(((product.selling_price - product.cost_price) / product.selling_price * 100).toFixed(1))
                                                    } else {
                                                        setDesiredMarkup("")
                                                        setDesiredMargin("")
                                                    }
                                                    setIsDialogOpen(true)
                                                }}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Редактировать
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setManageStockDialog({ isOpen: true, product })}>
                                                    <Box className="mr-2 h-4 w-4" /> Управление остатками
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openReplenishment(product)}>
                                                    <RefreshCw className="mr-2 h-4 w-4" /> Правила пополнения
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openHistory(product)}>
                                                    <RefreshCw className="mr-2 h-4 w-4" /> История
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setWriteOffDialog({ isOpen: true, product })}>
                                                    <Trash2 className="mr-2 h-4 w-4 text-orange-500" /> Списать
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(product.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Удалить
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {filteredProducts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                    Товары не найдены
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
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
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border">
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

                        {/* Front/Back Stock Settings */}
                        <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
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
                                            className="bg-slate-100"
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
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteReplenishmentRule(rule.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-4 text-muted-foreground bg-slate-50 rounded-lg">
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
                                    historyDialog.logs.map((log: any) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs">
                                                {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: ru })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {log.type === 'SUPPLY' && 'Поставка'}
                                                    {log.type === 'SALE' && 'Продажа'}
                                                    {log.type === 'INVENTORY_ADJUSTMENT' && 'Инвентаризация'}
                                                    {log.type === 'WRITE_OFF' && 'Списание'}
                                                    {log.type === 'MANUAL_EDIT' && 'Ред. вручную'}
                                                    {!['SUPPLY', 'SALE', 'INVENTORY_ADJUSTMENT', 'WRITE_OFF', 'MANUAL_EDIT'].includes(log.type) && log.type}
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
                                    ))
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
        </div>
    )
}
