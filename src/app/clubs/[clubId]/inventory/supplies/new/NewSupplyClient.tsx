"use client"

import { useState, useTransition } from "react"
import { ArrowLeft, Package, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageShell } from "@/components/layout/PageShell"
import { useRouter } from "next/navigation"
import { createSupply } from "../../actions"
import type { Product, Warehouse } from "../../types"
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
    const [supplierId, setSupplierId] = useState("")
    const [notes, setNotes] = useState("")
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")
    const [items, setItems] = useState<{ productId: number, quantity: number, cost: number, expirationDate?: string }[]>([])
    const [supplyStatus, setSupplyStatus] = useState<'DRAFT' | 'COMPLETED'>('COMPLETED')
    
    // New Item State
    const [selectedProductId, setSelectedProductId] = useState<string>("")
    const [qty, setQty] = useState("")
    const [cost, setCost] = useState("")
    const [expirationDate, setExpirationDate] = useState("")

    const selectedProduct = products.find(p => p.id === Number(selectedProductId))

    // When product is selected, pre-fill cost with current cost_price and expiry date if shelf_life_days
    const handleProductSelect = (val: string) => {
        setSelectedProductId(val)
        const product = products.find(p => p.id === Number(val))
        if (product) {
            setCost(product.cost_price.toString())
            if (product.track_expiration && product.shelf_life_days && product.shelf_life_days > 0) {
                const exp = new Date()
                exp.setDate(exp.getDate() + Number(product.shelf_life_days))
                setExpirationDate(exp.toISOString().split('T')[0])
            } else {
                setExpirationDate("")
            }
        }
    }

    const handleAddItem = () => {
        if (!selectedProductId || !qty || !cost) return
        const product = products.find(p => p.id === Number(selectedProductId))
        if (!product) return

        setItems(prev => [...prev, {
            productId: Number(selectedProductId),
            quantity: Number(qty),
            cost: Number(cost),
            expirationDate: expirationDate || undefined,
        }])
        
        // Reset item fields
        setSelectedProductId("")
        setQty("")
        setCost("")
        setExpirationDate("")
    }

    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index))
    }

    const handleUpdateItem = (index: number, field: 'quantity' | 'cost' | 'expirationDate', value: any) => {
        setItems(prev => prev.map((item, i) => 
            i === index ? { ...item, [field]: value } : item
        ))
    }

    const handleSubmit = async () => {
        const selectedSupplier = suppliers.find(s => s.id.toString() === supplierId)
        if (!selectedSupplier || items.length === 0) return
        
        startTransition(async () => {
            await createSupply(clubId, currentUserId, {
                supplier_name: selectedSupplier.name,
                notes,
                warehouse_id: selectedWarehouseId ? Number(selectedWarehouseId) : undefined,
                status: supplyStatus,
                items: items.map(i => ({
                    product_id: i.productId,
                    quantity: i.quantity,
                    cost_price: i.cost,
                    expiration_date: i.expirationDate || undefined,
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
                        {suppliers.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                                Нет сохраненных поставщиков.
                            </div>
                        ) : (
                            <Select value={supplierId} onValueChange={setSupplierId}>
                                <SelectTrigger className="bg-slate-50 h-10 border-slate-200">
                                    <SelectValue placeholder="Выберите поставщика" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map(s => (
                                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Склад назначения</Label>
                        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                            <SelectTrigger className="bg-slate-50 h-10 border-slate-200">
                                <SelectValue placeholder="Основной склад (по умолчанию)" />
                            </SelectTrigger>
                            <SelectContent>
                                {warehouses.map(w => (
                                    <SelectItem key={w.id} value={w.id.toString()}>{w.name} {w.is_default ? '(Основной)' : ''}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Примечание / Номер накладной</Label>
                        <Input 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)} 
                            placeholder="Например: Накладная №12345 от 20.08"
                            className="h-10 bg-slate-50 border-slate-200"
                        />
                    </div>
                </div>

                <div className="border-t border-slate-200 p-4 sm:p-6 bg-slate-50/50">
                    <h4 className="font-bold text-base text-slate-900 mb-6">Добавление товаров</h4>
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-end mb-6">
                        <div className="w-full sm:flex-1 space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-500">Товар</Label>
                            <Select value={selectedProductId} onValueChange={handleProductSelect}>
                                <SelectTrigger className="bg-white h-10 border-slate-200">
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
                        <div className="flex flex-wrap sm:flex-nowrap w-full sm:w-auto gap-3 items-end">
                            <div className="flex-1 sm:w-24 space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">Кол-во</Label>
                                <Input 
                                    type="number" 
                                    className="bg-white h-10 border-slate-200" 
                                    value={qty}
                                    onChange={e => setQty(e.target.value)}
                                />
                            </div>
                            <div className="flex-1 sm:w-28 space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">Цена за ед.</Label>
                                <Input 
                                    type="number" 
                                    className="bg-white h-10 border-slate-200" 
                                    placeholder="Закупка"
                                    value={cost}
                                    onChange={e => setCost(e.target.value)}
                                />
                            </div>
                            {selectedProduct?.track_expiration && (
                                <div className="flex-1 sm:w-36 space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-amber-600">Годен до</Label>
                                    <Input 
                                        type="date" 
                                        className="bg-amber-50/40 border-amber-200 h-10 text-xs" 
                                        value={expirationDate}
                                        onChange={e => setExpirationDate(e.target.value)}
                                    />
                                </div>
                            )}
                            <Button 
                                onClick={handleAddItem} 
                                disabled={!selectedProductId || !qty || !cost} 
                                className="h-10 w-10 p-0 bg-blue-600 hover:bg-blue-700 shrink-0 rounded-xl"
                            >
                                <Plus className="h-4 w-4" />
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
                                        <TableHead className="text-center text-[10px] uppercase font-bold text-slate-500 w-36">Годен до</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 w-32">Сумма</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-sm text-slate-500 py-12 italic bg-slate-50/30">
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
                                                            className="h-9 w-24 text-right font-mono border-slate-200"
                                                            value={item.cost}
                                                            onChange={e => handleUpdateItem(idx, 'cost', Number(e.target.value))}
                                                        />
                                                        <span className="text-xs text-slate-400 font-bold">₽</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center py-3">
                                                    {item.expirationDate ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                                            {new Date(item.expirationDate).toLocaleDateString('ru-RU')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right py-3 font-bold font-mono text-sm text-slate-900">
                                                    {(item.quantity * item.cost).toLocaleString('ru-RU')} ₽
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(idx)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-8 w-8">
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
                <Button onClick={handleSubmit} disabled={isPending || items.length === 0 || !supplierId} className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-base font-medium">
                    {isPending ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Package className="mr-2 h-5 w-5" />}
                    {supplyStatus === 'DRAFT' ? 'Сохранить черновик' : 'Оформить приход'}
                </Button>
            </div>

            {/* Mobile Bottom Actions (Sticky) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden z-50 flex items-center gap-3">
                <Button variant="outline" className="flex-1 bg-slate-50 border-slate-200" onClick={() => router.push(`/clubs/${clubId}/inventory?tab=supplies`)}>
                    Отмена
                </Button>
                <Button onClick={handleSubmit} disabled={isPending || items.length === 0 || !supplierId} className="flex-2 bg-blue-600 hover:bg-blue-700">
                    {isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                    {supplyStatus === 'DRAFT' ? 'Черновик' : 'Оформить'}
                </Button>
            </div>
        </PageShell>
    )
}
