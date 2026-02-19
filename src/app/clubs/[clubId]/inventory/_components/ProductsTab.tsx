"use client"

import { useState, useTransition } from "react"
import { Plus, Search, Filter, MoreVertical, Pencil, Trash2, LayoutGrid, Box, RefreshCw, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createProduct, updateProduct, deleteProduct, bulkUpdatePrices, Product, Category } from "../actions"
import { useParams } from "next/navigation"

interface ProductsTabProps {
    products: Product[]
    categories: Category[]
}

export function ProductsTab({ products, categories }: ProductsTabProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [search, setSearch] = useState("")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null)
    const [desiredMarkup, setDesiredMarkup] = useState<string>("")
    const [desiredMargin, setDesiredMargin] = useState<string>("")
    
    const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
    const [bulkAction, setBulkAction] = useState<{ type: 'fixed' | 'percent', value: string }>({ type: 'fixed', value: '' })

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

    // Actions
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingProduct?.name) return

        startTransition(async () => {
            try {
                if (editingProduct.id) {
                    await updateProduct(editingProduct.id, clubId, {
                        name: editingProduct.name!,
                        category_id: editingProduct.category_id || null,
                        cost_price: Number(editingProduct.cost_price) || 0,
                        selling_price: Number(editingProduct.selling_price) || 0,
                        current_stock: Number(editingProduct.current_stock) || 0,
                        is_active: editingProduct.is_active ?? true
                    })
                } else {
                    await createProduct(clubId, {
                        name: editingProduct.name!,
                        category_id: editingProduct.category_id || null,
                        cost_price: Number(editingProduct.cost_price) || 0,
                        selling_price: Number(editingProduct.selling_price) || 0,
                        current_stock: Number(editingProduct.current_stock) || 0
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
                        {filteredProducts.map(product => (
                            <TableRow key={product.id}>
                                <TableCell>
                                    <input 
                                        type="checkbox"
                                        className="rounded border-gray-300"
                                        checked={selectedIds.has(product.id)}
                                        onChange={() => toggleSelection(product.id)}
                                    />
                                </TableCell>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>
                                    {product.category_name ? (
                                        <Badge variant="outline">{product.category_name}</Badge>
                                    ) : <span className="text-muted-foreground text-sm">—</span>}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">{product.cost_price} ₽</TableCell>
                                <TableCell className="text-right font-bold whitespace-nowrap">{product.selling_price} ₽</TableCell>
                                <TableCell className="text-right">
                                    {product.cost_price > 0 ? (
                                        <Badge variant={product.selling_price >= product.cost_price ? "secondary" : "destructive"}>
                                            {Math.round(((product.selling_price - product.cost_price) / product.cost_price) * 100)}%
                                        </Badge>
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
                                <TableCell className="text-right">
                                    <Badge variant={product.current_stock > 0 ? "secondary" : "destructive"}>
                                        {product.current_stock} шт
                                    </Badge>
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
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(product.id)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Удалить
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
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

                        <div className="space-y-2">
                            <Label>Текущий остаток</Label>
                            <Input 
                                type="number" 
                                value={editingProduct?.current_stock || ''} 
                                onChange={e => setEditingProduct(prev => ({ ...prev!, current_stock: Number(e.target.value) }))}
                            />
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
        </div>
    )
}
