"use client"

import { useState, useTransition, useMemo, useEffect } from "react"
import { Plus, Search, Calendar, User, Package, Trash2, RefreshCw, Eye, Edit, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createSupply, getSupplyItems, deleteSupply, Supply, SupplyItem, Product, Warehouse } from "../actions"
import { useParams, useRouter } from "next/navigation"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUiDialogs } from "./useUiDialogs"

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

    // View/Edit State
    const [viewingSupply, setViewSupply] = useState<Supply | null>(null)
    const [viewingItems, setViewItems] = useState<SupplyItem[]>([])
    const [isLoadingItems, setIsLoadingItems] = useState(false)

    // Form State
    const [supplierName, setSupplierName] = useState("")
    const [isSupplierOpen, setIsSupplierOpen] = useState(false)
    
    const [notes, setNotes] = useState("")
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")
    const [items, setItems] = useState<{ productId: number, quantity: number, cost: number }[]>([])
    const [supplyStatus, setSupplyStatus] = useState<'DRAFT' | 'COMPLETED'>('COMPLETED')
    
    // New Item State
    const [selectedProductId, setSelectedProductId] = useState<string>("")
    const [qty, setQty] = useState("")
    const [cost, setCost] = useState("")
    const { confirmAction, showMessage, Dialogs } = useUiDialogs()

    const handleOpenSupply = async (supply: Supply) => {
        setViewSupply(supply)
        setIsLoadingItems(true)
        try {
            const items = await getSupplyItems(supply.id)
            setViewItems(items)
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoadingItems(false)
        }
    }

    const handleDeleteSupply = async (id: number) => {
        const confirmed = await confirmAction({
            title: "Удаление поставки",
            description: "Вы уверены? Это действие может изменить остатки на складе (если не было инвентаризации).",
            confirmText: "Удалить"
        })
        if (!confirmed) return
        
        startTransition(async () => {
            try {
                await deleteSupply(id, clubId, currentUserId)
                setViewSupply(null)
                router.refresh()
            } catch (e) {
                showMessage({ title: "Ошибка", description: "Ошибка при удалении" })
            }
        })
    }

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

    const handleUpdateItem = (index: number, field: 'quantity' | 'cost', value: number) => {
        setItems(prev => prev.map((item, i) => 
            i === index ? { ...item, [field]: value } : item
        ))
    }

    const handleSubmit = async () => {
        if (!supplierName || items.length === 0) return
        
        startTransition(async () => {
            await createSupply(clubId, currentUserId, {
                supplier_name: supplierName,
                notes,
                warehouse_id: selectedWarehouseId ? Number(selectedWarehouseId) : undefined,
                status: supplyStatus,
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
            setSupplyStatus('COMPLETED')
        })
    }

    const totalSum = items.reduce((acc, i) => acc + (i.quantity * i.cost), 0)

    const selectedProduct = products.find(p => p.id.toString() === selectedProductId)

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex flex-col">
                    <h3 className="font-bold text-slate-900">Поставки</h3>
                    <p className="text-xs text-slate-500">Учет прихода товаров и контроль закупочных цен</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Оформить поставку
                </Button>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-[10px] uppercase font-bold text-slate-400">Дата</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-slate-400">Поставщик</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-slate-400">Статус</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-slate-400 text-right">Позиций</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-slate-400 text-right">Сумма</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {supplies.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                    История поставок пуста
                                </TableCell>
                            </TableRow>
                        ) : supplies.map(supply => (
                            <TableRow key={supply.id} className="hover:bg-slate-50/50 cursor-pointer group" onClick={() => handleOpenSupply(supply)}>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-slate-900 font-bold">{new Date(supply.created_at).toLocaleDateString()}</span>
                                        <span className="text-[10px] text-slate-400">{new Date(supply.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-700">{supply.supplier_name}</span>
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                            <User className="h-2.5 w-2.5" /> {supply.created_by_name || "Неизвестно"}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {supply.status === 'DRAFT' ? (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Черновик</Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Проведено</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium text-slate-600">{supply.items_count}</TableCell>
                                <TableCell className="text-right">
                                    <span className="text-sm font-black text-slate-900">{Number(supply.total_cost).toLocaleString()} ₽</span>
                                </TableCell>
                                <TableCell>
                                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {supplies.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-muted-foreground bg-white rounded-xl border border-dashed">
                        <Package className="h-8 w-8 opacity-10 mb-2" />
                        <p className="italic text-sm">История поставок пуста</p>
                    </div>
                ) : supplies.map(supply => (
                    <div 
                        key={supply.id} 
                        className="bg-white rounded-xl border p-4 shadow-sm active:bg-slate-50 transition-colors"
                        onClick={() => handleOpenSupply(supply)}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">
                                    {new Date(supply.created_at).toLocaleDateString()} в {new Date(supply.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                <h4 className="font-black text-slate-900 text-base leading-tight">{supply.supplier_name}</h4>
                            </div>
                            {supply.status === 'DRAFT' ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] uppercase font-black">Черновик</Badge>
                            ) : (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[9px] uppercase font-black">Проведено</Badge>
                            )}
                        </div>
                        
                        <div className="flex justify-between items-end pt-3 border-t border-slate-100">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <User className="h-3.5 w-3.5" />
                                    <span>{supply.created_by_name || "Неизвестно"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Package className="h-3.5 w-3.5" />
                                    <span>{supply.items_count} поз.</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Сумма</p>
                                <p className="text-xl font-black text-blue-600">{Number(supply.total_cost).toLocaleString()} ₽</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* View Details Dialog */}
            <Dialog open={!!viewingSupply} onOpenChange={(v) => !v && setViewSupply(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <DialogTitle className="text-xl">Поставка #{viewingSupply?.id}</DialogTitle>
                                <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                                    <span>{viewingSupply && new Date(viewingSupply.created_at).toLocaleString()}</span>
                                    {viewingSupply?.status === 'DRAFT' ? (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Черновик</Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Проведено</Badge>
                                    )}
                                </div>
                            </div>
                            <Button aria-label={`Удалить поставку ${viewingSupply?.id || ""}`} variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => viewingSupply && handleDeleteSupply(viewingSupply.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="grid grid-cols-3 gap-4 py-4 border-y border-slate-100">
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Поставщик</p>
                            <p className="text-sm font-bold text-slate-700">{viewingSupply?.supplier_name}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Сотрудник</p>
                            <p className="text-sm font-bold text-slate-700">{viewingSupply?.created_by_name || "—"}</p>
                        </div>
                        <div className="space-y-1 text-right">
                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Итоговая сумма</p>
                            <p className="text-lg font-black text-blue-600">{viewingSupply?.total_cost.toLocaleString()} ₽</p>
                        </div>
                        {viewingSupply?.notes && (
                            <div className="col-span-3 space-y-1 pt-2">
                                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Заметки</p>
                                <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded-lg italic">"{viewingSupply.notes}"</p>
                            </div>
                        )}
                    </div>

                    <div className="py-4">
                        <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                            <Package className="h-4 w-4 text-slate-400" /> Состав поставки
                        </h4>
                        <div className="rounded-xl border border-slate-100 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-[10px] uppercase font-bold">Товар</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-bold">Кол-во</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-bold">Цена за ед.</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-bold">Сумма</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingItems ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-slate-300" />
                                            </TableCell>
                                        </TableRow>
                                    ) : viewingItems.map(item => (
                                        <TableRow key={item.id} className="hover:bg-slate-50/30">
                                            <TableCell className="font-semibold text-slate-700 text-sm">{item.product_name}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 font-mono">
                                                    {item.quantity} шт
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-slate-600">{item.cost_price.toLocaleString()} ₽</TableCell>
                                            <TableCell className="text-right font-bold text-slate-900">{item.total_cost.toLocaleString()} ₽</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" className="w-full" onClick={() => setViewSupply(null)}>Закрыть</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                        <div className="space-y-2">
                            <Label>Статус</Label>
                            <Select value={supplyStatus} onValueChange={(v: any) => setSupplyStatus(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="COMPLETED">Провести (обновит остатки)</SelectItem>
                                    <SelectItem value="DRAFT">Черновик (только запись)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Заметки</Label>
                            <Input 
                                placeholder="Номер накладной и т.д." 
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="border rounded-xl p-4 bg-slate-50/50 space-y-4 flex-1 overflow-y-auto">
                        <h4 className="font-bold text-sm flex items-center gap-2 text-slate-700">
                            <Package className="h-4 w-4 text-slate-400" /> Добавление товаров
                        </h4>
                        
                        <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-400">Товар</Label>
                                <Select value={selectedProductId} onValueChange={handleProductSelect}>
                                    <SelectTrigger className="bg-white h-9">
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
                                <Label className="text-[10px] uppercase font-bold text-slate-400">Кол-во</Label>
                                <Input 
                                    type="number" 
                                    className="bg-white h-9" 
                                    value={qty}
                                    onChange={e => setQty(e.target.value)}
                                />
                            </div>
                            <div className="w-28 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-400">Цена за ед.</Label>
                                <Input 
                                    type="number" 
                                    className="bg-white h-9" 
                                    placeholder="Закупка"
                                    value={cost}
                                    onChange={e => setCost(e.target.value)}
                                />
                            </div>
                            <Button aria-label="Добавить товар в поставку" onClick={handleAddItem} disabled={!selectedProductId || !qty || !cost} className="h-9 w-9 p-0 bg-slate-900 hover:bg-slate-800">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Items List */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-[10px] uppercase font-bold">Товар</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-bold">Кол-во</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-bold">Цена</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-bold">Сумма</TableHead>
                                        <TableHead className="w-[40px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-[11px] text-muted-foreground py-12 italic">
                                                Список пуст. Добавьте товары выше.
                                            </TableCell>
                                        </TableRow>
                                    ) : items.map((item, idx) => {
                                        const p = products.find(p => p.id === item.productId)
                                        return (
                                            <TableRow key={idx} className="hover:bg-slate-50/30">
                                                <TableCell className="py-2 text-sm font-medium text-slate-700">{p?.name}</TableCell>
                                                <TableCell className="text-right py-2">
                                                    <Input 
                                                        type="number" 
                                                        className="h-7 w-16 ml-auto text-right text-xs"
                                                        value={item.quantity}
                                                        onChange={e => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right py-2">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Input 
                                                            type="number" 
                                                            className="h-7 w-20 text-right text-xs"
                                                            value={item.cost}
                                                            onChange={e => handleUpdateItem(idx, 'cost', Number(e.target.value))}
                                                        />
                                                        <span className="text-[10px] text-slate-400 font-bold">₽</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-2 font-bold text-slate-900">{(item.quantity * item.cost).toLocaleString()} ₽</TableCell>
                                                <TableCell className="py-2">
                                                    <Button aria-label={`Удалить позицию ${p?.name || idx}`} variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50" onClick={() => handleRemoveItem(idx)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        
                        <div className="flex justify-end items-center gap-3 pt-2">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Итого к оплате:</span>
                            <span className="text-xl font-black text-blue-600">{totalSum.toLocaleString()} ₽</span>
                        </div>
                    </div>

                    <DialogFooter className="mt-4 pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="h-10">Отмена</Button>
                        <Button onClick={handleSubmit} disabled={isPending || items.length === 0 || !supplierName} className="h-10 bg-blue-600 hover:bg-blue-700 min-w-[160px]">
                            {isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                            {supplyStatus === 'DRAFT' ? 'Сохранить черновик' : 'Оформить приход'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {Dialogs}
        </div>
    )
}
