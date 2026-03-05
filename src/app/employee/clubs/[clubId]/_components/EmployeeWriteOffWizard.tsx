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
import { getProducts, createWriteOff, getProductByBarcode, getWarehouses, type Warehouse as WarehouseType } from "@/app/clubs/[clubId]/inventory/actions"
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
}

export function EmployeeWriteOffWizard({ isOpen, onClose, clubId, userId, activeShiftId, currentSalary = 0 }: EmployeeWriteOffWizardProps) {
    const [step, setStep] = useState(1) // 1: Items, 2: Final Details
    const [items, setItems] = useState<WriteOffItem[]>([])
    const [allProducts, setAllProducts] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")
    const [isPending, startTransition] = useTransition()
    
    // UI States
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedProductId, setSelectedProductId] = useState<string>("")
    const [itemQty, setItemQty] = useState("1")
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
        }
    }, [isOpen, clubId])

    const handleAddProduct = () => {
        const product = allProducts.find(p => p.id === Number(selectedProductId))
        if (!product) return

        const existingIdx = items.findIndex(i => i.product_id === product.id && i.type === writeOffType)
        if (existingIdx > -1) {
            const newItems = [...items]
            newItems[existingIdx].quantity += Number(itemQty)
            setItems(newItems)
        } else {
            setItems(prev => [...prev, {
                product_id: product.id,
                name: product.name,
                quantity: Number(itemQty),
                type: writeOffType,
                price: product.selling_price || 0
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
                        type: i.type
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
        p.barcode?.includes(searchQuery)
    )

    const totalDeduction = items
        .filter(i => i.type === 'SALARY_DEDUCTION')
        .reduce((acc, i) => acc + (i.quantity * i.price), 0)

    const isOverSalaryLimit = totalDeduction > currentSalary

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-none w-screen h-screen m-0 p-0 rounded-none bg-slate-950 border-none text-white overflow-hidden flex flex-col">
                    <DialogHeader className="p-6 border-b border-slate-800 flex-row items-center justify-between space-y-0">
                        <div className="space-y-1">
                            <DialogTitle className="flex items-center gap-2">
                                <Ban className="h-5 w-5 text-red-400" />
                                {step === 1 ? "Списание товара" : "Причина списания"}
                            </DialogTitle>
                            <DialogDescription className="text-slate-400">
                                {step === 1 ? (
                                    <span>
                                        Выберите товары для списания. 
                                        {currentSalary > 0 && <span className="ml-1 text-emerald-400">Доступно из ЗП: {currentSalary.toLocaleString()} ₽</span>}
                                    </span>
                                ) : "Укажите причину (брак, просрочка и т.д.)"}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full">
                        {step === 1 ? (
                            <div className="space-y-6">
                                {/* Warehouse Selector */}
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <Warehouse className="h-3 w-3" />
                                        Списать со склада
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {warehouses.map(wh => (
                                            <Button
                                                key={wh.id}
                                                variant="outline"
                                                className={cn(
                                                    "h-12 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-xs justify-start px-4",
                                                    selectedWarehouseId === wh.id.toString() && "border-red-500 bg-red-500/10 text-red-400"
                                                )}
                                                onClick={() => setSelectedWarehouseId(wh.id.toString())}
                                            >
                                                <div className="flex flex-col items-start truncate">
                                                    <span className="truncate">{wh.name}</span>
                                                    {wh.is_default && <span className="text-[8px] opacity-50 uppercase">Основной</span>}
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button 
                                        variant="outline" 
                                        className="h-14 border-slate-800 bg-slate-900/50 hover:bg-slate-800"
                                        onClick={() => setIsScannerOpen(true)}
                                    >
                                        <Camera className="mr-2 h-5 w-5 text-red-400" />
                                        Сканировать
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        className="h-14 border-slate-800 bg-slate-900/50 hover:bg-slate-800"
                                        onClick={() => setIsAddDialogOpen(true)}
                                    >
                                        <Search className="mr-2 h-5 w-5 text-red-400" />
                                        Найти товар
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
                                        <Label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Тип списания</Label>
                                        <div className="grid grid-cols-1 gap-2">
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
                                        </div>
                                    </div>
                                </div>
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
