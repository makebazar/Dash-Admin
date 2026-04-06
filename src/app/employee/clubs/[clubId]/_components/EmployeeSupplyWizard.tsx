"use client"

import { useState, useTransition, useCallback, useEffect } from "react"
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
    Loader2, Trash2, Search, Camera, Package, 
    ArrowLeft, ArrowRight, CheckCircle2, ShoppingCart, Warehouse
} from "lucide-react"
import { getProducts, createSupplySafe, getProductByBarcode, getWarehouses, type Warehouse as WarehouseType } from "@/app/clubs/[clubId]/inventory/actions"
import { 
    Table, TableBody, TableCell, TableRow 
} from "@/components/ui/table"
import { BarcodeScanner } from "@/app/clubs/[clubId]/inventory/_components/BarcodeScanner"
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs"
import { cn } from "@/lib/utils"

interface EmployeeSupplyWizardProps {
    isOpen: boolean
    onClose: () => void
    clubId: string
    userId: string
    activeShiftId?: string
}

interface SupplyItem {
    product_id: number
    name: string
    quantity: number
    cost_price: number
}

export function EmployeeSupplyWizard({ isOpen, onClose, clubId, userId, activeShiftId }: EmployeeSupplyWizardProps) {
    const { showMessage, Dialogs } = useUiDialogs()
    const [step, setStep] = useState(1) // 1: Items List, 2: Final Details
    const [items, setItems] = useState<SupplyItem[]>([])
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
    const [itemCost, setItemCost] = useState("0")
    const [supplierName, setSupplierName] = useState("")
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
                if (def) setSelectedWarehouseId(def.id.toString())
            })
        }
    }, [isOpen, clubId])

    const handleAddProduct = () => {
        const product = allProducts.find(p => p.id === Number(selectedProductId))
        if (!product) return

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
                cost_price: Number(itemCost) || product.cost_price || 0
            }])
        }

        setIsAddDialogOpen(false)
        setSelectedProductId("")
        setItemQty("1")
        setItemCost("0")
    }

    const handleBarcodeScan = useCallback(async (barcode: string): Promise<boolean> => {
        try {
            const product = await getProductByBarcode(clubId, barcode)
            if (product) {
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
                        cost_price: product.cost_price || 0
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

    const removeItem = (productId: number) => {
        setItems(prev => prev.filter(i => i.product_id !== productId))
    }

    const updateItem = (productId: number, field: 'quantity' | 'cost_price', value: number) => {
        setItems(prev => prev.map(i => 
            i.product_id === productId ? { ...i, [field]: value } : i
        ))
    }

    const totalSum = items.reduce((acc, i) => acc + (i.quantity * i.cost_price), 0)
    const totalQty = items.reduce((acc, i) => acc + i.quantity, 0)

    const handleFinalize = () => {
        if (items.length === 0) return
        if (!selectedWarehouseId) {
            showMessage({ title: "Проверьте данные", description: "Выберите склад" })
            return
        }
        startTransition(async () => {
            try {
                const result = await createSupplySafe(clubId, userId, {
                    supplier_name: supplierName || "Сотрудник (самовывоз)",
                    notes: notes + (activeShiftId ? ` (Смена #${activeShiftId})` : ""),
                    warehouse_id: Number(selectedWarehouseId),
                    shift_id: activeShiftId,
                    items: items.map(i => ({
                        product_id: i.product_id,
                        quantity: i.quantity,
                        cost_price: i.cost_price
                    }))
                })
                if (!result.ok) {
                    showMessage({ title: "Ошибка", description: result.error })
                    return
                }
                showMessage({ title: "Готово", description: "Поставка успешно оформлена" })
                handleClose()
            } catch (e) {
                console.error(e)
                showMessage({ title: "Ошибка", description: "Ошибка при оформлении поставки" })
            }
        })
    }

    const handleClose = () => {
        setStep(1)
        setItems([])
        setSupplierName("")
        setNotes("")
        onClose()
    }

    const filteredProducts = allProducts.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.barcode?.includes(searchQuery) ||
        p.barcodes?.some((bc: string) => bc.includes(searchQuery))
    )

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-none w-screen h-[100dvh] m-0 p-0 rounded-none bg-slate-950 border-none text-white overflow-hidden flex flex-col fixed inset-0 translate-x-0 translate-y-0 left-0 top-0">
                    <DialogHeader className="p-4 border-b border-slate-800 flex-row items-center justify-between space-y-0 shrink-0">
                        <div className="space-y-0.5">
                            <DialogTitle className="flex items-center gap-2 text-base">
                                <Package className="h-4 w-4 text-blue-400" />
                                {step === 1 ? "Поставка" : "Детали"}
                            </DialogTitle>
                            <DialogDescription className="text-slate-400 text-[10px]">
                                {step === 1 ? "Добавьте товары." : "Поставщик и примечание."}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 w-full max-w-4xl mx-auto space-y-4">
                        {step === 1 ? (
                            <div className="space-y-4 pb-4">
                                {/* Actions Area */}
                                <div className="grid grid-cols-2 gap-2">
                                    <Button 
                                        variant="outline" 
                                        className="h-12 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-xs"
                                        onClick={() => setIsScannerOpen(true)}
                                    >
                                        <Camera className="mr-2 h-4 w-4 text-blue-400" />
                                        Сканер
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        className="h-12 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-xs"
                                        onClick={() => setIsAddDialogOpen(true)}
                                    >
                                        <Search className="mr-2 h-4 w-4 text-blue-400" />
                                        Поиск
                                    </Button>
                                </div>

                                {/* Items List */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ShoppingCart className="h-3 w-3" />
                                            Выбранные товары ({items.length})
                                        </div>
                                        {totalSum > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500">Итого:</span>
                                                <span className="text-blue-400 font-black">{totalSum.toLocaleString()} ₽</span>
                                            </div>
                                        )}
                                    </h4>
                                    
                                    {items.length === 0 ? (
                                        <div className="border border-dashed border-slate-800 rounded-2xl p-10 text-center text-slate-500">
                                            <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
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
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <Input 
                                                                            type="number" 
                                                                            value={item.cost_price} 
                                                                            onChange={e => updateItem(item.product_id, 'cost_price', Number(e.target.value))}
                                                                            className="h-6 w-16 bg-slate-900 border-slate-800 text-[10px] p-1 text-center"
                                                                        />
                                                                        <span className="text-[10px] text-slate-500">₽/шт</span>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right py-3">
                                                                <div className="flex items-center justify-end gap-3">
                                                                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
                                                                        <button 
                                                                            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white"
                                                                            onClick={() => updateItem(item.product_id, 'quantity', Math.max(1, item.quantity - 1))}
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <input 
                                                                            type="number" 
                                                                            value={item.quantity} 
                                                                            onChange={e => updateItem(item.product_id, 'quantity', Number(e.target.value))}
                                                                            className="w-10 bg-transparent text-center text-sm font-bold text-blue-400 focus:outline-none"
                                                                        />
                                                                        <button 
                                                                            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white"
                                                                            onClick={() => updateItem(item.product_id, 'quantity', item.quantity + 1)}
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
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <Warehouse className="h-3 w-3" />
                                        Куда поставляем?
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {warehouses.map(wh => (
                                            <Button
                                                key={wh.id}
                                                variant="outline"
                                                className={cn(
                                                    "h-10 border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-[10px] justify-start px-3",
                                                    selectedWarehouseId === wh.id.toString() && "border-blue-500 bg-blue-500/10 text-blue-400"
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
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500 uppercase tracking-wider">Поставщик</Label>
                                    <Input 
                                        placeholder="Название компании или имя"
                                        value={supplierName}
                                        onChange={e => setSupplierName(e.target.value)}
                                        className="bg-slate-900 border-slate-800 h-12 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500 uppercase tracking-wider">Примечание</Label>
                                    <Input 
                                        placeholder="Например: номер накладной или комментарий"
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="bg-slate-900 border-slate-800 h-12 rounded-xl"
                                    />
                                </div>

                                {/* Summary */}
                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">Итого товаров:</span>
                                        <span className="font-bold text-white">{totalQty} шт</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm mt-2">
                                        <span className="text-slate-400">На сумму:</span>
                                        <span className="font-bold text-blue-400">
                                            {totalSum.toLocaleString()} ₽
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-6 border-t border-slate-800 bg-slate-900/50">
                        {step === 1 ? (
                            <Button 
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20"
                                disabled={items.length === 0}
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
                                    disabled={isPending}
                                >
                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                    Оформить поставку
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manual Add Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-[90vw] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Поиск товара</DialogTitle>
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
                        <div className="max-h-[200px] overflow-y-auto space-y-1 pr-2">
                            {filteredProducts.map(p => (
                                <button
                                    key={p.id}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl transition-all text-sm border",
                                        selectedProductId === p.id.toString() 
                                            ? "bg-blue-600/20 border-blue-500 text-blue-400" 
                                            : "hover:bg-slate-900 border-transparent text-slate-300"
                                    )}
                                    onClick={() => {
                                        setSelectedProductId(p.id.toString())
                                        setItemCost((p as any).cost_price?.toString() || "0")
                                    }}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>

                        {selectedProductId && (
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase text-slate-500 font-bold">Количество</Label>
                                    <Input 
                                        type="number" 
                                        value={itemQty} 
                                        onChange={e => setItemQty(e.target.value)}
                                        className="bg-slate-900 border-slate-800 h-12 text-lg font-bold text-base"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase text-slate-500 font-bold">Цена закупа (₽)</Label>
                                    <Input 
                                        type="number" 
                                        value={itemCost} 
                                        onChange={e => setItemCost(e.target.value)}
                                        className="bg-slate-900 border-slate-800 h-12 text-lg font-bold"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="flex-row gap-3">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1 border-slate-800 h-12 rounded-xl">Отмена</Button>
                        <Button onClick={handleAddProduct} disabled={!selectedProductId} className="flex-1 bg-blue-600 h-12 rounded-xl">Добавить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Scanner */}
            <BarcodeScanner 
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleBarcodeScan}
            />
            {Dialogs}
        </>
    )
}
