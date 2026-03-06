"use client"

import { useState, useTransition, useCallback, useEffect } from "react"
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
    Loader2, Trash2, Search, Camera, 
    ArrowLeft, ArrowRight, CheckCircle2, ShoppingCart, 
    Ban, Wallet, Warehouse, Plus
} from "lucide-react"
import { 
    getProducts, createWriteOff, getProductByBarcode, getWarehouses, getClubSettings, 
    type Warehouse as WarehouseType 
} from "@/app/clubs/[clubId]/inventory/actions"
import { 
    Table, TableBody, TableCell, TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BarcodeScanner } from "@/app/clubs/[clubId]/inventory/_components/BarcodeScanner"
import { cn } from "@/lib/utils"

interface EmployeeWriteOffWizardProps {
    isOpen: boolean
    onClose: () => void
    clubId: string
    userId: string
    activeShiftId?: string
    currentSalary?: number // Added to check limits
}

interface WriteOffItem {
    product_id: number
    name: string
    quantity: number
    type: 'WASTE' | 'SALARY_DEDUCTION'
    price: number
    custom_price?: number
}

export function EmployeeWriteOffWizard({ isOpen, onClose, clubId, userId, activeShiftId, currentSalary = 0 }: EmployeeWriteOffWizardProps) {
    const [step, setStep] = useState(1) // 1: Items, 2: Final Details
    const [items, setItems] = useState<WriteOffItem[]>([])
    const [allProducts, setAllProducts] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")
    const [inventorySettings, setInventorySettings] = useState<any>(null)
    const [isPending, startTransition] = useTransition()
    
    // UI States
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedProductId, setSelectedProductId] = useState<string>("")
    const [itemQty, setItemQty] = useState("1")
    const [itemCustomPrice, setItemCustomPrice] = useState<string>("")
    const [writeOffType, setWriteOffType] = useState<'WASTE' | 'SALARY_DEDUCTION'>('WASTE')
    const [notes, setNotes] = useState("")

    useEffect(() => {
        if (isOpen) {
            getProducts(clubId).then(setAllProducts)
            getWarehouses(clubId).then(whs => {
                setWarehouses(whs)
                const def = whs.find(w => w.is_default) || whs[0]
                if (def) setSelectedWarehouseId(def.id.toString())
            })
            getClubSettings(clubId).then(settings => setInventorySettings(settings.inventory_settings))
        }
    }, [isOpen, clubId])

    const handleAddProduct = () => {
        const product = allProducts.find(p => p.id === Number(selectedProductId))
        if (!product) return

        let priceToRecord = product.selling_price || 0
        let customPrice: number | undefined = undefined

        if (writeOffType === 'SALARY_DEDUCTION') {
            const discountPercent = inventorySettings?.employee_discount_percent || 0
            if (discountPercent > 0) {
                priceToRecord = Math.round(priceToRecord * (1 - discountPercent / 100))
                customPrice = priceToRecord
            }
        } else if (itemCustomPrice) {
            // This case might still happen if cost_price_sale is allowed
            priceToRecord = Number(itemCustomPrice)
            customPrice = priceToRecord
        }

        const existingIdx = items.findIndex(i => i.product_id === product.id && i.type === writeOffType)
        if (existingIdx > -1) {
            const newItems = [...items]
            newItems[existingIdx].quantity += Number(itemQty)
            newItems[existingIdx].custom_price = customPrice
            newItems[existingIdx].price = priceToRecord
            setItems(newItems)
        } else {
            setItems(prev => [...prev, {
                product_id: product.id,
                name: product.name,
                quantity: Number(itemQty),
                type: writeOffType,
                price: priceToRecord,
                custom_price: customPrice
            }])
        }

        setIsAddDialogOpen(false)
        setSelectedProductId("")
        setItemQty("1")
        setItemCustomPrice("")
    }

    const handleBarcodeScan = useCallback(async (barcode: string): Promise<boolean> => {
        try {
            const product = await getProductByBarcode(clubId, barcode)
            if (product) {
                const existingIdx = items.findIndex(i => i.product_id === product.id && i.type === 'WASTE')
                if (existingIdx > -1) {
                    const newItems = [...items]
                    newItems[existingIdx].quantity += 1
                    setItems(newItems)
                } else {
                    setItems(prev => [...prev, {
                        product_id: product.id,
                        name: product.name,
                        quantity: 1,
                        type: 'WASTE',
                        price: product.selling_price || 0
                    }])
                }
                return true
            }
            return false
        } catch (e) {
            console.error(e)
            return false
        }
    }, [clubId, items])

    const removeItem = (productId: number, type: string) => {
        setItems(prev => prev.filter(i => !(i.product_id === productId && i.type === type)))
    }

    const handleFinalize = () => {
        if (items.length === 0) return
        if (!selectedWarehouseId) {
            alert("Выберите склад")
            return
        }
        startTransition(async () => {
            try {
                await createWriteOff(clubId, userId, {
                    items: items.map(i => ({
                        product_id: i.product_id,
                        quantity: i.quantity,
                        type: i.type,
                        custom_price: i.custom_price
                    })),
                    notes: notes,
                    shift_id: activeShiftId,
                    warehouse_id: Number(selectedWarehouseId)
                })
                alert("Списание успешно оформлено")
                handleClose()
            } catch (e) {
                console.error(e)
                alert("Ошибка при оформлении списания")
            }
        })
    }

    const handleClose = () => {
        setStep(1)
        setItems([])
        setNotes("")
        onClose()
    }

    const filteredProducts = allProducts.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.barcode?.includes(searchQuery) ||
        p.barcodes?.some((bc: string) => bc.includes(searchQuery))
    )

    const totalDeduction = items
        .filter(i => i.type === 'SALARY_DEDUCTION')
        .reduce((acc, i) => acc + (i.quantity * i.price), 0)

    const isOverSalaryLimit = totalDeduction > currentSalary

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-none w-screen h-[100dvh] m-0 p-0 rounded-none bg-slate-950 border-none text-white overflow-hidden flex flex-col fixed inset-0 translate-x-0 translate-y-0 left-0 top-0">
                    <DialogHeader className="p-4 border-b border-slate-800 flex-row items-center justify-between space-y-0 shrink-0">
                        <div className="space-y-0.5">
                            <DialogTitle className="flex items-center gap-2 text-base">
                                <Ban className="h-4 w-4 text-red-400" />
                                {step === 1 ? "Списание товара" : "Причина списания"}
                            </DialogTitle>
                            <DialogDescription className="text-slate-400 text-[10px] leading-tight">
                                {step === 1 ? (
                                    <span className="flex flex-wrap items-center gap-x-1">
                                        Выберите товары. 
                                        {currentSalary > 0 && <span className="text-emerald-400 font-medium">Доступно: {currentSalary.toLocaleString()} ₽</span>}
                                    </span>
                                ) : "Укажите причину (брак, просрочка и т.д.)"}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 w-full max-w-4xl mx-auto space-y-4">
                        {step === 1 ? (
                            <div className="space-y-4 pb-4">
                                {/* Warehouse Selector */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <Warehouse className="h-3 w-3" />
                                        Списать со склада
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {warehouses.map(wh => (
                                            <Button
                                                key={wh.id}
                                                variant="outline"
                                                className={cn(
                                                    "h-10 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-[10px] justify-start px-3",
                                                    selectedWarehouseId === wh.id.toString() && "border-red-500 bg-red-500/10 text-red-400"
                                                )}
                                                onClick={() => setSelectedWarehouseId(wh.id.toString())}
                                            >
                                                <div className="flex flex-col items-start truncate">
                                                    <span className="truncate">{wh.name}</span>
                                                    {wh.is_default && <span className="text-[7px] opacity-50 uppercase">Основной</span>}
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <Button 
                                        variant="outline" 
                                        className="h-12 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-xs"
                                        onClick={() => setIsScannerOpen(true)}
                                    >
                                        <Camera className="mr-2 h-4 w-4 text-red-400" />
                                        Сканер
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        className="h-12 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-xs"
                                        onClick={() => setIsAddDialogOpen(true)}
                                    >
                                        <Search className="mr-2 h-4 w-4 text-red-400" />
                                        Поиск
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ShoppingCart className="h-3 w-3" />
                                            Список списания ({items.length})
                                        </div>
                                        {totalDeduction > 0 && (
                                            <span className={cn(
                                                "text-[10px]",
                                                isOverSalaryLimit ? "text-red-400" : "text-emerald-400"
                                            )}>
                                                Итого в счет ЗП: {totalDeduction.toLocaleString()} ₽
                                            </span>
                                        )}
                                    </h4>
                                    
                                    {items.length === 0 ? (
                                        <div className="border border-dashed border-slate-800 rounded-2xl p-10 text-center text-slate-500">
                                            <Ban className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm">Ничего не выбрано</p>
                                        </div>
                                    ) : (
                                        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/30">
                                            <Table>
                                                <TableBody>
                                                    {items.map((item, idx) => (
                                                        <TableRow key={`${item.product_id}-${item.type}-${idx}`} className="border-slate-800 hover:bg-slate-800/50">
                                                            <TableCell className="py-3">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium text-slate-200">{item.name}</span>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        {item.type === 'SALARY_DEDUCTION' ? (
                                                                            <Badge className="bg-amber-500/10 text-amber-500 border-none text-[9px] px-1.5 h-4">В счет ЗП</Badge>
                                                                        ) : (
                                                                            <Badge className="bg-red-500/10 text-red-500 border-none text-[9px] px-1.5 h-4">Списание</Badge>
                                                                        )}
                                                                        <span className="text-[10px] text-slate-500">{item.price} ₽</span>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right py-3">
                                                                <div className="flex items-center justify-end gap-3">
                                                                    <span className="text-sm font-bold text-slate-200">{item.quantity} шт</span>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        onClick={() => removeItem(item.product_id, item.type)}
                                                                        className="h-8 w-8 text-slate-600 hover:text-red-400"
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
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500 uppercase tracking-wider">Причина списания / Комментарий</Label>
                                    <Input 
                                        placeholder="Например: Брак, Истек срок годности, Личное потребление..."
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="bg-slate-900 border-slate-800 h-12 rounded-xl"
                                    />
                                </div>

                                {totalDeduction > 0 && (
                                    <div className={cn(
                                        "p-4 border rounded-2xl flex items-center gap-3",
                                        isOverSalaryLimit 
                                            ? "bg-red-500/10 border-red-500/20" 
                                            : "bg-amber-500/10 border-amber-500/20"
                                    )}>
                                        <Wallet className={cn("h-6 w-6", isOverSalaryLimit ? "text-red-500" : "text-amber-500")} />
                                        <div className="flex-1">
                                            <p className={cn("text-sm font-bold", isOverSalaryLimit ? "text-red-500" : "text-amber-500")}>
                                                {isOverSalaryLimit ? "Лимит превышен!" : "Будет вычтено из зарплаты:"}
                                            </p>
                                            <p className="text-xl font-black text-white">{totalDeduction.toLocaleString()} ₽</p>
                                            {isOverSalaryLimit && (
                                                <p className="text-[10px] text-red-400 mt-1">
                                                    Максимально доступно: {currentSalary.toLocaleString()} ₽ (текущая ЗП за месяц)
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-6 border-t border-slate-800 bg-slate-900/50">
                        {step === 1 ? (
                            <Button 
                                className={cn(
                                    "w-full h-12 font-bold rounded-xl shadow-lg",
                                    isOverSalaryLimit ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 text-white shadow-red-900/20"
                                )}
                                disabled={items.length === 0 || isOverSalaryLimit}
                                onClick={() => setStep(2)}
                            >
                                Далее
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <div className="flex gap-3 w-full">
                                <Button 
                                    variant="outline" 
                                    className="h-12 w-14 border-slate-800 text-slate-400 rounded-xl"
                                    onClick={() => setStep(1)}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <Button 
                                    className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-900/20"
                                    onClick={handleFinalize}
                                    disabled={isPending || isOverSalaryLimit}
                                >
                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                    Подтвердить
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-[90vw] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Выбор товара</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                            <Input 
                                placeholder="Название..."
                                className="bg-slate-900 border-slate-800 pl-10 h-10"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                            {filteredProducts.map(p => (
                                <button
                                    key={p.id}
                                    className={cn(
                                        "w-full text-left p-4 rounded-2xl transition-all text-sm border",
                                        selectedProductId === p.id.toString() 
                                            ? "bg-red-500/10 border-red-500/50 text-red-400 font-bold" 
                                            : "bg-slate-900/30 border-slate-800/50 text-slate-400 hover:bg-slate-900 hover:border-slate-700"
                                    )}
                                    onClick={() => setSelectedProductId(p.id.toString())}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>

                        {selectedProductId && (
                            <div className="space-y-6 pt-6 border-t border-slate-800/50">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Количество</Label>
                                        <Input 
                                            type="number" 
                                            value={itemQty} 
                                            onChange={e => setItemQty(e.target.value)}
                                            className="bg-slate-900/50 border-slate-800 h-14 text-xl font-black text-center rounded-2xl focus:ring-red-500/20 focus:border-red-500/50 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Тип операции</Label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {(!inventorySettings || inventorySettings.allow_salary_deduction !== false) ? (
                                                <button
                                                    onClick={() => setWriteOffType(writeOffType === 'WASTE' ? 'SALARY_DEDUCTION' : 'WASTE')}
                                                    className={cn(
                                                        "h-14 rounded-2xl border transition-all flex items-center justify-center gap-3 px-4",
                                                        writeOffType === 'WASTE' 
                                                            ? "bg-red-500/10 border-red-500/50 text-red-400" 
                                                            : "bg-amber-500/10 border-amber-500/50 text-amber-400"
                                                    )}
                                                >
                                                    {writeOffType === 'WASTE' ? (
                                                        <>
                                                            <Trash2 className="h-4 w-4" />
                                                            <span className="text-xs font-bold uppercase">Списание (брак)</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Wallet className="h-4 w-4" />
                                                            <span className="text-xs font-bold uppercase">В счет ЗП</span>
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="h-14 rounded-2xl border border-red-500/50 bg-red-500/10 text-red-400 flex items-center justify-center gap-3 px-4">
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="text-xs font-bold uppercase">Только списание</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {inventorySettings?.allow_cost_price_sale && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Цена за единицу (₽)</Label>
                                            <div className="flex gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-6 text-[9px] bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                                    onClick={() => {
                                                        const p = allProducts.find(p => p.id === Number(selectedProductId))
                                                        if (p) setItemCustomPrice(p.cost_price.toString())
                                                    }}
                                                >
                                                    По себестоимости
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-6 text-[9px] bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                                    onClick={() => setItemCustomPrice("")}
                                                >
                                                    Сбросить
                                                </Button>
                                            </div>
                                        </div>
                                        <Input 
                                            type="number" 
                                            value={itemCustomPrice} 
                                            onChange={(e) => setItemCustomPrice(e.target.value)}
                                            placeholder={allProducts.find(p => p.id === Number(selectedProductId))?.selling_price?.toString() || "0"}
                                            className="bg-slate-900/50 border-slate-800 h-14 text-xl font-black text-center rounded-2xl focus:ring-blue-500/20 focus:border-blue-500/50 transition-all text-blue-400"
                                        />
                                        <p className="text-[10px] text-slate-500 text-center italic">
                                            {!itemCustomPrice ? "Используется стандартная цена продажи" : "Установлена специальная цена"}
                                        </p>
                                    </div>
                                )}
                                
                                {writeOffType === 'SALARY_DEDUCTION' && (inventorySettings?.employee_discount_percent || 0) > 0 && (
                                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Percent className="h-4 w-4 text-blue-400" />
                                            <span className="text-xs text-blue-100 font-bold">Скидка сотрудника:</span>
                                        </div>
                                        <span className="text-sm font-black text-blue-400">-{inventorySettings.employee_discount_percent}%</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter className="flex-row gap-3 p-6 pt-2 border-t border-slate-800/50">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsAddDialogOpen(false)} 
                            className="flex-1 h-12 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition-colors"
                        >
                            Отмена
                        </Button>
                        <Button 
                            onClick={handleAddProduct} 
                            disabled={!selectedProductId} 
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-bold shadow-lg shadow-red-900/20 transition-all active:scale-[0.98]"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Добавить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <BarcodeScanner 
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleBarcodeScan}
            />
        </>
    )
}
