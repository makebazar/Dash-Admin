"use client"

import { useState, useTransition, useMemo } from "react"
import { Plus, Search, Calendar, User, Package, Trash2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createSupply, Supply, Product, Warehouse } from "../actions"
import { useParams, useRouter } from "next/navigation"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SuppliesTabProps {
    supplies: Supply[]
    products: Product[]
    warehouses: Warehouse[]
    suppliers: { id: number, name: string }[]
    currentUserId: string
}

export function SuppliesTab({ supplies, products, warehouses, suppliers, currentUserId }: SuppliesTabProps) {
    const params = useParams()
    const router = useRouter()
    const clubId = params.clubId as string
    
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Form State
    const [supplierName, setSupplierName] = useState("")
    const [isSupplierOpen, setIsSupplierOpen] = useState(false)
    
    const [notes, setNotes] = useState("")
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")
    const [items, setItems] = useState<{ productId: number, quantity: number, cost: number }[]>([])
    
    // New Item State
    const [selectedProductId, setSelectedProductId] = useState<string>("")
    const [qty, setQty] = useState("")
    const [cost, setCost] = useState("")

    // When product is selected, pre-fill cost with current cost_price
    const handleProductSelect = (val: string) => {
        setSelectedProductId(val)
        const product = products.find(p => p.id === Number(val))
        if (product) {
            setCost(product.cost_price.toString())
        }
    }

    const handleAddItem = () => {
        if (!selectedProductId || !qty || !cost) return
        const product = products.find(p => p.id === Number(selectedProductId))
        if (!product) return

        setItems(prev => [...prev, {
            productId: Number(selectedProductId),
            quantity: Number(qty),
            cost: Number(cost)
        }])
        
        // Reset item fields
        setSelectedProductId("")
        setQty("")
        setCost("")
    }

    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        if (!supplierName || items.length === 0) return
        
        startTransition(async () => {
            await createSupply(clubId, currentUserId, {
                supplier_name: supplierName,
                notes,
                warehouse_id: selectedWarehouseId ? Number(selectedWarehouseId) : undefined,
                items: items.map(i => ({
                    product_id: i.productId,
                    quantity: i.quantity,
                    cost_price: i.cost
                }))
            })
            router.refresh()
            setIsDialogOpen(false)
            setSupplierName("")
            setNotes("")
            setSelectedWarehouseId("")
            setItems([])
        })
    }

    const totalSum = items.reduce((acc, i) => acc + (i.quantity * i.cost), 0)

    const selectedProduct = products.find(p => p.id.toString() === selectedProductId)

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <h3 className="font-medium">История поставок</h3>
                <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Оформить поставку
                </Button>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Дата</TableHead>
                            <TableHead>Поставщик</TableHead>
                            <TableHead>Сотрудник</TableHead>
                            <TableHead className="text-right">Позиций</TableHead>
                            <TableHead className="text-right">Сумма</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {supplies.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    История пуста
                                </TableCell>
                            </TableRow>
                        ) : supplies.map(supply => (
                            <TableRow key={supply.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        {new Date(supply.created_at).toLocaleDateString()} {new Date(supply.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </TableCell>
                                <TableCell>{supply.supplier_name}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <User className="h-3 w-3 text-muted-foreground" />
                                        {supply.created_by_name || "Неизвестно"}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">{supply.items_count}</TableCell>
                                <TableCell className="text-right font-bold">{Number(supply.total_cost).toLocaleString()} ₽</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* New Supply Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Новая поставка</DialogTitle>
                        <DialogDescription>Внесите данные о приходе товаров на склад</DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Поставщик</Label>
                            <Popover open={isSupplierOpen} onOpenChange={setIsSupplierOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isSupplierOpen}
                                        className="w-full justify-between"
                                    >
                                        {supplierName
                                            ? supplierName
                                            : "Выберите или введите..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Поиск поставщика..." onValueChange={(val) => setSupplierName(val)} />
                                        <CommandList>
                                            <CommandEmpty>
                                                <div className="p-2 text-sm text-muted-foreground">
                                                    Нет совпадений. Нажмите Enter или выберите, чтобы создать "{supplierName}".
                                                    <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setIsSupplierOpen(false)}>
                                                        Использовать "{supplierName}"
                                                    </Button>
                                                </div>
                                            </CommandEmpty>
                                            <CommandGroup heading="Существующие">
                                                {suppliers.map((sup) => (
                                                    <CommandItem
                                                        key={sup.id}
                                                        value={sup.name}
                                                        onSelect={(currentValue) => {
                                                            setSupplierName(currentValue)
                                                            setIsSupplierOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                supplierName === sup.name ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {sup.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Склад приема</Label>
                            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="По умолчанию (Основной)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id.toString()}>
                                            {w.name} {w.is_default ? '(Основной)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label>Заметки</Label>
                            <Textarea 
                                placeholder="Номер накладной и т.д." 
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="border rounded-lg p-4 bg-slate-50 space-y-4 flex-1 overflow-y-auto">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                            <Package className="h-4 w-4" /> Добавление товаров
                        </h4>
                        
                        <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                                <Label className="text-xs">Товар</Label>
                                <Select value={selectedProductId} onValueChange={handleProductSelect}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Выберите товар" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products.map(p => (
                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                {p.name} (Остаток: {p.current_stock})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-24 space-y-1">
                                <Label className="text-xs">Кол-во</Label>
                                <Input 
                                    type="number" 
                                    className="bg-white" 
                                    value={qty}
                                    onChange={e => setQty(e.target.value)}
                                />
                            </div>
                            <div className="w-28 space-y-1">
                                <Label className="text-xs">Цена за ед.</Label>
                                <Input 
                                    type="number" 
                                    className="bg-white" 
                                    placeholder="Закупка"
                                    value={cost}
                                    onChange={e => setCost(e.target.value)}
                                />
                                {selectedProduct && selectedProduct.cost_price > 0 && (
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Посл. закупка: {selectedProduct.cost_price} ₽
                                    </p>
                                )}
                            </div>
                            <Button onClick={handleAddItem} disabled={!selectedProductId || !qty || !cost}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Items List */}
                        <div className="bg-white rounded border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead>Товар</TableHead>
                                        <TableHead className="text-right">Кол-во</TableHead>
                                        <TableHead className="text-right">Цена</TableHead>
                                        <TableHead className="text-right">Сумма</TableHead>
                                        <TableHead className="w-[40px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                                                Список пуст. Добавьте товары выше.
                                            </TableCell>
                                        </TableRow>
                                    ) : items.map((item, idx) => {
                                        const p = products.find(p => p.id === item.productId)
                                        return (
                                            <TableRow key={idx}>
                                                <TableCell className="py-2">{p?.name}</TableCell>
                                                <TableCell className="text-right py-2">{item.quantity}</TableCell>
                                                <TableCell className="text-right py-2">{item.cost} ₽</TableCell>
                                                <TableCell className="text-right py-2 font-medium">{(item.quantity * item.cost).toLocaleString()} ₽</TableCell>
                                                <TableCell className="py-2">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleRemoveItem(idx)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        
                        <div className="flex justify-end items-center gap-2 pt-2">
                            <span className="text-sm text-muted-foreground">Итого:</span>
                            <span className="text-lg font-bold">{totalSum.toLocaleString()} ₽</span>
                        </div>
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleSubmit} disabled={isPending || items.length === 0 || !supplierName}>
                            {isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Создать поставку
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
