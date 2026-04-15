"use client"

import { useState, useTransition } from "react"
import { ArrowLeft, Package, Plus, Check, ChevronsUpDown, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { PageShell } from "@/components/layout/PageShell"
import { useRouter } from "next/navigation"
import { createSupply, type Product, type Warehouse } from "../../actions"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface NewSupplyClientProps {
    clubId: string
    currentUserId: string
    products: Product[]
    warehouses: Warehouse[]
    suppliers: { id: number, name: string }[]
}

export function NewSupplyClient({ clubId, currentUserId, products, warehouses, suppliers }: NewSupplyClientProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

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
            router.push(`/clubs/${clubId}/inventory?tab=supplies`)
            router.refresh()
        })
    }

    const totalSum = items.reduce((acc, i) => acc + (i.quantity * i.cost), 0)

    return (
        <PageShell maxWidth="5xl" className="pb-24 md:pb-8">
            <div className="mb-6">
                <Link href={`/clubs/${clubId}/inventory?tab=supplies`} className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Назад к поставкам
                </Link>
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        Новая поставка
                    </h1>
                    <p className="text-sm text-slate-500">
                        Внесите данные о приходе товаров на склад
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Поставщик</Label>
                        <Popover open={isSupplierOpen} onOpenChange={setIsSupplierOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isSupplierOpen}
                                    className="w-full justify-between h-12 bg-slate-50 hover:bg-slate-100 border-slate-200"
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
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Склад приема</Label>
                        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                            <SelectTrigger className="h-12 bg-slate-50 hover:bg-slate-100 border-slate-200">
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
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Статус</Label>
                        <Select value={supplyStatus} onValueChange={(v: any) => setSupplyStatus(v)}>
                            <SelectTrigger className="h-12 bg-slate-50 hover:bg-slate-100 border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="COMPLETED">Провести (обновит остатки)</SelectItem>
                                <SelectItem value="DRAFT">Черновик (только запись)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Заметки</Label>
                        <Input 
                            placeholder="Номер накладной и т.д." 
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="h-12 bg-slate-50 border-slate-200"
                        />
                    </div>
                </div>

                <div className="border-t border-slate-200 p-4 sm:p-6 bg-slate-50/50">
                    <h4 className="font-bold text-base flex items-center gap-2 text-slate-900 mb-6">
                        <Package className="h-5 w-5 text-slate-400" /> Добавление товаров
                    </h4>
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-end mb-6">
                        <div className="w-full sm:flex-1 space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-500">Товар</Label>
                            <Select value={selectedProductId} onValueChange={handleProductSelect}>
                                <SelectTrigger className="bg-white h-11 border-slate-200">
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
                        <div className="flex w-full sm:w-auto gap-3 items-end">
                            <div className="flex-1 sm:w-28 space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">Кол-во</Label>
                                <Input 
                                    type="number" 
                                    className="bg-white h-11 border-slate-200" 
                                    value={qty}
                                    onChange={e => setQty(e.target.value)}
                                />
                            </div>
                            <div className="flex-1 sm:w-32 space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">Цена за ед.</Label>
                                <Input 
                                    type="number" 
                                    className="bg-white h-11 border-slate-200" 
                                    placeholder="Закупка"
                                    value={cost}
                                    onChange={e => setCost(e.target.value)}
                                />
                            </div>
                            <Button 
                                onClick={handleAddItem} 
                                disabled={!selectedProductId || !qty || !cost} 
                                className="h-11 w-11 p-0 bg-blue-600 hover:bg-blue-700 shrink-0 rounded-xl"
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="hidden sm:block">
                            <Table>
                                <TableHeader className="bg-slate-50 border-b border-slate-100">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-[10px] uppercase font-bold text-slate-500">Товар</TableHead>
                                        <TableHead className="text-center text-[10px] uppercase font-bold text-slate-500 w-32">Кол-во</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 w-40">Цена</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 w-32">Сумма</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-sm text-slate-500 py-12 italic bg-slate-50/30">
                                                Список пуст. Добавьте товары выше.
                                            </TableCell>
                                        </TableRow>
                                    ) : items.map((item, idx) => {
                                        const p = products.find(p => p.id === item.productId)
                                        return (
                                            <TableRow key={idx} className="hover:bg-slate-50/50">
                                                <TableCell className="py-3 text-sm font-bold text-slate-900">{p?.name}</TableCell>
                                                <TableCell className="py-3">
                                                    <Input 
                                                        type="number" 
                                                        className="h-9 w-20 mx-auto text-center font-mono font-bold border-slate-200"
                                                        value={item.quantity}
                                                        onChange={e => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Input 
                                                            type="number" 
                                                            className="h-9 w-24 text-right border-slate-200"
                                                            value={item.cost}
                                                            onChange={e => handleUpdateItem(idx, 'cost', Number(e.target.value))}
                                                        />
                                                        <span className="text-sm font-bold text-slate-400">₽</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-3 font-black text-slate-900">{(item.quantity * item.cost).toLocaleString('ru-RU')} ₽</TableCell>
                                                <TableCell className="py-3 text-right">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleRemoveItem(idx)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        
                        {/* Mobile Items List */}
                        <div className="sm:hidden divide-y divide-slate-100">
                            {items.length === 0 ? (
                                <div className="text-center text-sm text-slate-500 py-12 italic bg-slate-50/30">
                                    Список пуст. Добавьте товары выше.
                                </div>
                            ) : items.map((item, idx) => {
                                const p = products.find(p => p.id === item.productId)
                                return (
                                    <div key={idx} className="p-4 flex flex-col gap-4">
                                        <div className="flex justify-between items-start">
                                            <h5 className="font-bold text-slate-900 leading-tight">{p?.name}</h5>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 -mt-1 -mr-2" onClick={() => handleRemoveItem(idx)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Кол-во</Label>
                                                <Input 
                                                    type="number" 
                                                    className="h-10 text-center font-mono font-bold border-slate-200"
                                                    value={item.quantity}
                                                    onChange={e => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Цена за ед.</Label>
                                                <Input 
                                                    type="number" 
                                                    className="h-10 text-center border-slate-200"
                                                    value={item.cost}
                                                    onChange={e => handleUpdateItem(idx, 'cost', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="flex-1 text-right">
                                                <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Сумма</Label>
                                                <div className="h-10 flex items-center justify-end font-black text-slate-900">
                                                    {(item.quantity * item.cost).toLocaleString('ru-RU')} ₽
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    
                    <div className="flex justify-end items-center gap-3 pt-6 mt-4">
                        <span className="text-xs uppercase font-black text-slate-400 tracking-wider">Итого к оплате:</span>
                        <span className="text-2xl font-black text-blue-600">{totalSum.toLocaleString('ru-RU')} ₽</span>
                    </div>
                </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex justify-end gap-3">
                <Button variant="outline" onClick={() => router.push(`/clubs/${clubId}/inventory?tab=supplies`)} className="h-12 px-6 border-slate-200">Отмена</Button>
                <Button onClick={handleSubmit} disabled={isPending || items.length === 0 || !supplierName} className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-base font-medium">
                    {isPending ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Package className="mr-2 h-5 w-5" />}
                    {supplyStatus === 'DRAFT' ? 'Сохранить черновик' : 'Оформить приход'}
                </Button>
            </div>

            {/* Mobile Bottom Actions (Sticky) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden z-50 flex items-center gap-3">
                <Button variant="outline" className="flex-1 bg-slate-50 border-slate-200" onClick={() => router.push(`/clubs/${clubId}/inventory?tab=supplies`)}>
                    Отмена
                </Button>
                <Button onClick={handleSubmit} disabled={isPending || items.length === 0 || !supplierName} className="flex-[2] bg-blue-600 hover:bg-blue-700">
                    {isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                    {supplyStatus === 'DRAFT' ? 'Черновик' : 'Оформить'}
                </Button>
            </div>
        </PageShell>
    )
}
