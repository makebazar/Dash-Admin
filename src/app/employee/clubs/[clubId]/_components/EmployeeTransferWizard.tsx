"use client"

import { useState, useTransition, useCallback, useEffect } from "react"
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
    Loader2, Plus, Trash2, Search, Camera, 
    ArrowLeft, ArrowRight, CheckCircle2, ShoppingCart, Warehouse,
    ArrowRightLeft
} from "lucide-react"
import { getProducts, createTransfer, getProductByBarcode, getWarehouses, type Warehouse as WarehouseType } from "@/app/clubs/[clubId]/inventory/actions"
import { 
    Table, TableBody, TableCell, TableRow 
} from "@/components/ui/table"
import { BarcodeScanner } from "@/app/clubs/[clubId]/inventory/_components/BarcodeScanner"
import { cn } from "@/lib/utils"

interface EmployeeTransferWizardProps {
    isOpen: boolean
    onClose: () => void
    clubId: string
    userId: string
    activeShiftId?: string
}

interface TransferItem {
    product_id: number
    name: string
    quantity: number
    available_stock: number
}

export function EmployeeTransferWizard({ isOpen, onClose, clubId, userId, activeShiftId }: EmployeeTransferWizardProps) {
    const [step, setStep] = useState(1) // 1: Warehouses, 2: Items, 3: Confirm
    const [items, setItems] = useState<TransferItem[]>([])
    const [allProducts, setAllProducts] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
    const [sourceWarehouseId, setSourceWarehouseId] = useState<string>("")
    const [targetWarehouseId, setTargetWarehouseId] = useState<string>("")
    const [isPending, startTransition] = useTransition()
    
    // UI States
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedProductId, setSelectedProductId] = useState<string>("")
    const [itemQty, setItemQty] = useState("1")
    const [notes, setNotes] = useState("")

    // iOS Scroll Lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
            document.body.style.position = 'fixed'
            document.body.style.width = '100%'
            document.body.style.height = '100%'
        } else {
            document.body.style.overflow = ''
            document.body.style.position = ''
            document.body.style.width = ''
            document.body.style.height = ''
        }
        return () => {
            document.body.style.overflow = ''
            document.body.style.position = ''
            document.body.style.width = ''
            document.body.style.height = ''
        }
    }, [isOpen])

    // Load products and warehouses
    useEffect(() => {
        if (isOpen) {
            getProducts(clubId).then(setAllProducts)
            getWarehouses(clubId).then(whs => {
                setWarehouses(whs)
                const def = whs.find(w => w.is_default) || whs[0]
                if (def) setSourceWarehouseId(def.id.toString())
                
                // Pick another one as default target if possible
                const target = whs.find(w => w.id.toString() !== def?.id.toString()) || whs[0]
                if (target) setTargetWarehouseId(target.id.toString())
            })
        }
    }, [isOpen, clubId])

    const handleAddProduct = () => {
        const product = allProducts.find(p => p.id === Number(selectedProductId))
        if (!product) return

        // Get available stock in source warehouse
        const sourceStock = product.stocks?.find((s: any) => s.warehouse_id === Number(sourceWarehouseId))?.quantity || 0

        const existingIdx = items.findIndex(i => i.product_id === product.id)
        if (existingIdx > -1) {
            const newItems = [...items]
            newItems[existingIdx].quantity += Number(itemQty)
            setItems(newItems)
        } else {
            setItems(prev => [...prev, {
                product_id: product.id,
                name: product.name,
                quantity: Number(itemQty),
                available_stock: sourceStock
            }])
        }

        setIsAddDialogOpen(false)
        setSelectedProductId("")
        setItemQty("1")
    }

    const handleBarcodeScan = useCallback(async (barcode: string): Promise<boolean> => {
        try {
            const product = await getProductByBarcode(clubId, barcode)
            if (product) {
                const sourceStock = product.stocks?.find((s: any) => s.warehouse_id === Number(sourceWarehouseId))?.quantity || 0
                
                const existingIdx = items.findIndex(i => i.product_id === product.id)
                if (existingIdx > -1) {
                    const newItems = [...items]
                    newItems[existingIdx].quantity += 1
                    setItems(newItems)
                } else {
                    setItems(prev => [...prev, {
                        product_id: product.id,
                        name: product.name,
                        quantity: 1,
                        available_stock: sourceStock
                    }])
                }
                return true
            }
            return false
        } catch (e) {
            console.error(e)
            return false
        }
    }, [clubId, items, sourceWarehouseId])

    const removeItem = (productId: number) => {
        setItems(prev => prev.filter(i => i.product_id !== productId))
    }

    const updateItemQty = (productId: number, value: number) => {
        setItems(prev => prev.map(i => 
            i.product_id === productId ? { ...i, quantity: value } : i
        ))
    }

    const handleFinalize = () => {
        if (items.length === 0) return
        if (!sourceWarehouseId || !targetWarehouseId) {
            alert("Выберите склады")
            return
        }
        startTransition(async () => {
            try {
                await createTransfer(clubId, userId, {
                    source_warehouse_id: Number(sourceWarehouseId),
                    target_warehouse_id: Number(targetWarehouseId),
                    notes: notes,
                    shift_id: activeShiftId,
                    items: items.map(i => ({
                        product_id: i.product_id,
                        quantity: i.quantity
                    }))
                })
                alert("Перемещение успешно оформлено")
                handleClose()
            } catch (e: any) {
                console.error(e)
                alert(e.message || "Ошибка при оформлении перемещения")
            }
        })
    }

    const handleClose = () => {
        setStep(1)
        setItems([])
        setNotes("")
        onClose()
    }

    const filteredProducts = allProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             p.barcode?.includes(searchQuery) ||
                             p.barcodes?.some((bc: string) => bc.includes(searchQuery))
        
        if (!matchesSearch) return false
        
        // Only show products that have stock in source warehouse
        const stock = p.stocks?.find((s: any) => s.warehouse_id === Number(sourceWarehouseId))?.quantity || 0
        return stock > 0
    })

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-none w-screen h-[100dvh] m-0 p-0 rounded-none bg-slate-950 border-none text-white overflow-hidden flex flex-col fixed inset-0 translate-x-0 translate-y-0 left-0 top-0">
                    <DialogHeader className="p-4 border-b border-slate-800 flex-row items-center justify-between space-y-0 shrink-0">
                        <div className="space-y-0.5">
                            <DialogTitle className="flex items-center gap-2 text-base">
                                <ArrowRightLeft className="h-4 w-4 text-purple-400" />
                                {step === 1 ? "Склады" : step === 2 ? "Товары" : "Подтверждение"}
                            </DialogTitle>
                            <DialogDescription className="text-slate-400 text-[10px]">
                                {step === 1 ? "Откуда и куда перемещаем?" : step === 2 ? "Выберите товары для перемещения." : "Проверьте данные."}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 w-full max-w-4xl mx-auto space-y-4">
                        {step === 1 ? (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <Label className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <Warehouse className="h-3 w-3" />
                                        Склад отправления (Откуда)
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {warehouses.map(wh => (
                                            <Button
                                                key={wh.id}
                                                variant="outline"
                                                className={cn(
                                                    "h-12 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-[10px] justify-start px-3",
                                                    sourceWarehouseId === wh.id.toString() && "border-purple-500 bg-purple-500/10 text-purple-400"
                                                )}
                                                onClick={() => {
                                                    setSourceWarehouseId(wh.id.toString())
                                                    if (targetWarehouseId === wh.id.toString()) {
                                                        const other = warehouses.find(w => w.id !== wh.id)
                                                        if (other) setTargetWarehouseId(other.id.toString())
                                                    }
                                                }}
                                            >
                                                <div className="flex flex-col items-start truncate">
                                                    <span className="truncate">{wh.name}</span>
                                                    {wh.is_default && <span className="text-[7px] opacity-50 uppercase">Основной</span>}
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-center">
                                    <div className="bg-slate-800 p-2 rounded-full">
                                        <ArrowRightLeft className="h-4 w-4 text-slate-500 rotate-90" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <Warehouse className="h-3 w-3" />
                                        Склад назначения (Куда)
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {warehouses.map(wh => (
                                            <Button
                                                key={wh.id}
                                                variant="outline"
                                                disabled={sourceWarehouseId === wh.id.toString()}
                                                className={cn(
                                                    "h-12 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-[10px] justify-start px-3",
                                                    targetWarehouseId === wh.id.toString() && "border-emerald-500 bg-emerald-500/10 text-emerald-400",
                                                    sourceWarehouseId === wh.id.toString() && "opacity-50 grayscale"
                                                )}
                                                onClick={() => setTargetWarehouseId(wh.id.toString())}
                                            >
                                                <div className="flex flex-col items-start truncate">
                                                    <span className="truncate">{wh.name}</span>
                                                    {wh.is_default && <span className="text-[7px] opacity-50 uppercase">Основной</span>}
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : step === 2 ? (
                            <div className="space-y-4 pb-4">
                                {/* Actions Area */}
                                <div className="grid grid-cols-2 gap-2">
                                    <Button 
                                        variant="outline" 
                                        className="h-12 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-xs"
                                        onClick={() => setIsScannerOpen(true)}
                                    >
                                        <Camera className="mr-2 h-4 w-4 text-purple-400" />
                                        Сканер
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        className="h-12 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-xs"
                                        onClick={() => setIsAddDialogOpen(true)}
                                    >
                                        <Search className="mr-2 h-4 w-4 text-purple-400" />
                                        Поиск
                                    </Button>
                                </div>

                                {/* Items List */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                        <ShoppingCart className="h-3 w-3" />
                                        Выбранные товары ({items.length})
                                    </h4>
                                    
                                    {items.length === 0 ? (
                                        <div className="border border-dashed border-slate-800 rounded-2xl p-10 text-center text-slate-500">
                                            <ArrowRightLeft className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm">Список пуст. Добавьте товары через поиск или сканер.</p>
                                        </div>
                                    ) : (
                                        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/30">
                                            <Table>
                                                <TableBody>
                                                    {items.map((item) => (
                                                        <TableRow key={item.product_id} className="border-slate-800 hover:bg-slate-800/50">
                                                            <TableCell className="py-3 pr-0">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium text-slate-200 truncate max-w-[140px]">{item.name}</span>
                                                                    <span className="text-[10px] text-slate-500 mt-1">Доступно: {item.available_stock} шт</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right py-3">
                                                                <div className="flex items-center justify-end gap-3">
                                                                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
                                                                        <button 
                                                                            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white"
                                                                            onClick={() => updateItemQty(item.product_id, Math.max(1, item.quantity - 1))}
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <input 
                                                                            type="number" 
                                                                            value={item.quantity} 
                                                                            onChange={e => updateItemQty(item.product_id, Math.min(item.available_stock, Number(e.target.value)))}
                                                                            className="w-10 bg-transparent text-center text-sm font-bold text-purple-400 focus:outline-none"
                                                                        />
                                                                        <button 
                                                                            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white"
                                                                            onClick={() => updateItemQty(item.product_id, Math.min(item.available_stock, item.quantity + 1))}
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        onClick={() => removeItem(item.product_id)}
                                                                        className="h-8 w-8 text-slate-600 hover:text-red-400 hover:bg-red-400/10"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Откуда:</span>
                                        <span className="font-bold text-purple-400">{warehouses.find(w => w.id.toString() === sourceWarehouseId)?.name}</span>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <ArrowRightLeft className="h-3 w-3 text-slate-700 rotate-90" />
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Куда:</span>
                                        <span className="font-bold text-emerald-400">{warehouses.find(w => w.id.toString() === targetWarehouseId)?.name}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500 uppercase tracking-wider">Примечание</Label>
                                    <Input 
                                        placeholder="Например: Пополнил холодильник"
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="bg-slate-900 border-slate-800 h-12 rounded-xl"
                                    />
                                </div>

                                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/30">
                                    <div className="p-3 bg-slate-900 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        Итого товаров: {items.length}
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto">
                                        {items.map(item => (
                                            <div key={item.product_id} className="p-3 border-b border-slate-800/50 flex justify-between items-center text-sm">
                                                <span className="text-slate-300 truncate max-w-[200px]">{item.name}</span>
                                                <span className="font-bold text-white">{item.quantity} шт</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-6 border-t border-slate-800 bg-slate-900/50">
                        <div className="flex gap-3 w-full">
                            {step > 1 && (
                                <Button 
                                    variant="outline" 
                                    className="h-12 w-14 border-slate-800 text-slate-400 rounded-xl"
                                    onClick={() => setStep(step - 1)}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            )}
                            <Button 
                                className={cn(
                                    "flex-1 h-12 font-bold rounded-xl shadow-lg",
                                    step === 3 ? "bg-green-600 hover:bg-green-700 text-white shadow-green-900/20" : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-900/20"
                                )}
                                disabled={(step === 2 && items.length === 0) || isPending}
                                onClick={() => step < 3 ? setStep(step + 1) : handleFinalize()}
                            >
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : step === 3 ? (
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                ) : null}
                                {step === 1 ? "Далее: Выбрать товары" : step === 2 ? "Далее: Подтвердить" : "Выполнить перемещение"}
                                {step < 3 && <ArrowRight className="ml-2 h-4 w-4" />}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manual Add Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-[90vw] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Поиск товара</DialogTitle>
                        <DialogDescription className="text-[10px] text-slate-500">
                            Показываются товары, которые есть на складе отправления
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                            <Input 
                                placeholder="Название или штрихкод..."
                                className="bg-slate-900 border-slate-800 pl-10 h-10"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="max-h-[200px] overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                            {filteredProducts.length === 0 ? (
                                <p className="text-center py-4 text-slate-500 text-sm italic">Товары не найдены или закончились на складе</p>
                            ) : (
                                filteredProducts.map(p => {
                                    const stock = p.stocks?.find((s: any) => s.warehouse_id === Number(sourceWarehouseId))?.quantity || 0
                                    return (
                                        <button
                                            key={p.id}
                                            className={cn(
                                                "w-full text-left p-3 rounded-xl transition-all text-sm border flex justify-between items-center",
                                                selectedProductId === p.id.toString() 
                                                    ? "bg-purple-600/20 border-purple-500 text-purple-400" 
                                                    : "hover:bg-slate-900 border-transparent text-slate-300"
                                            )}
                                            onClick={() => setSelectedProductId(p.id.toString())}
                                        >
                                            <span className="truncate max-w-[200px]">{p.name}</span>
                                            <span className="text-[10px] opacity-50 font-bold">{stock} шт</span>
                                        </button>
                                    )
                                })
                            )}
                        </div>

                        {selectedProductId && (
                            <div className="pt-4 border-t border-slate-800">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase text-slate-500 font-bold">Количество для перемещения</Label>
                                    <div className="flex items-center gap-4">
                                        <Input 
                                            type="number" 
                                            value={itemQty} 
                                            max={allProducts.find(p => p.id === Number(selectedProductId))?.stocks?.find((s: any) => s.warehouse_id === Number(sourceWarehouseId))?.quantity || 0}
                                            onChange={e => setItemQty(e.target.value)}
                                            className="bg-slate-900 border-slate-800 h-12 text-lg font-bold flex-1"
                                        />
                                        <Button 
                                            variant="ghost" 
                                            className="text-[10px] h-12 text-slate-500"
                                            onClick={() => {
                                                const max = allProducts.find(p => p.id === Number(selectedProductId))?.stocks?.find((s: any) => s.warehouse_id === Number(sourceWarehouseId))?.quantity || 0
                                                setItemQty(max.toString())
                                            }}
                                        >
                                            Макс
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="flex-row gap-3">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1 border-slate-800 h-12 rounded-xl">Отмена</Button>
                        <Button onClick={handleAddProduct} disabled={!selectedProductId} className="flex-1 bg-purple-600 h-12 rounded-xl">Добавить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Scanner */}
            <BarcodeScanner 
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleBarcodeScan}
            />
        </>
    )
}
