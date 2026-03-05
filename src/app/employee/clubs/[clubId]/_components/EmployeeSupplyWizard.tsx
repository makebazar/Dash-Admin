"use client"

import { useState, useTransition, useCallback, useEffect } from "react"
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
    Loader2, Plus, Trash2, Search, Camera, Package, 
    ArrowLeft, ArrowRight, CheckCircle2, ShoppingCart
} from "lucide-react"
import { getProducts, createSupply, getProductByBarcode } from "@/app/clubs/[clubId]/inventory/actions"
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BarcodeScanner } from "@/app/clubs/[clubId]/inventory/_components/BarcodeScanner"
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
    const [step, setStep] = useState(1) // 1: Items List, 2: Final Details
    const [items, setItems] = useState<SupplyItem[]>([])
    const [allProducts, setAllProducts] = useState<any[]>([])
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

    // Load products
    useEffect(() => {
        if (isOpen) {
            getProducts(clubId).then(setAllProducts)
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

    const handleFinalize = () => {
        if (items.length === 0) return
        startTransition(async () => {
            try {
                await createSupply(clubId, userId, {
                    supplier_name: supplierName || "Сотрудник (самовывоз)",
                    notes: notes + (activeShiftId ? ` (Смена #${activeShiftId})` : ""),
                    items: items.map(i => ({
                        product_id: i.product_id,
                        quantity: i.quantity,
                        cost_price: i.cost_price
                    }))
                })
                alert("Поставка успешно оформлена")
                handleClose()
            } catch (e) {
                console.error(e)
                alert("Ошибка при оформлении поставки")
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
        p.barcode?.includes(searchQuery)
    )

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-2xl bg-slate-950 border-slate-800 text-white p-0 overflow-hidden flex flex-col h-[90vh]">
                    <DialogHeader className="p-6 border-b border-slate-800">
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-blue-400" />
                            {step === 1 ? "Оформление поставки" : "Детали поставки"}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            {step === 1 ? "Добавьте товары, которые поступили в клуб." : "Укажите поставщика и примечание."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6">
                        {step === 1 ? (
                            <div className="space-y-6">
                                {/* Actions Area */}
                                <div className="grid grid-cols-2 gap-3">
                                    <Button 
                                        variant="outline" 
                                        className="h-14 border-slate-800 bg-slate-900/50 hover:bg-slate-800"
                                        onClick={() => setIsScannerOpen(true)}
                                    >
                                        <Camera className="mr-2 h-5 w-5 text-blue-400" />
                                        Сканировать
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        className="h-14 border-slate-800 bg-slate-900/50 hover:bg-slate-800"
                                        onClick={() => setIsAddDialogOpen(true)}
                                    >
                                        <Search className="mr-2 h-5 w-5 text-blue-400" />
                                        Найти товар
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
                                            <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm">Список пуст. Добавьте товары через поиск или сканер.</p>
                                        </div>
                                    ) : (
                                        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/30">
                                            <Table>
                                                <TableBody>
                                                    {items.map((item) => (
                                                        <TableRow key={item.product_id} className="border-slate-800 hover:bg-slate-800/50">
                                                            <TableCell className="py-3">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium text-slate-200">{item.name}</span>
                                                                    <span className="text-[10px] text-slate-500">{item.cost_price} ₽ / шт</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right py-3">
                                                                <div className="flex items-center justify-end gap-3">
                                                                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-none font-bold">
                                                                        {item.quantity} шт
                                                                    </Badge>
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
                                        <span className="font-bold text-white">{items.reduce((acc, i) => acc + i.quantity, 0)} шт</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm mt-2">
                                        <span className="text-slate-400">На сумму:</span>
                                        <span className="font-bold text-blue-400">
                                            {items.reduce((acc, i) => acc + (i.quantity * i.cost_price), 0).toLocaleString()} ₽
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
                                        className="bg-slate-900 border-slate-800 h-12 text-lg font-bold"
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
        </>
    )
}
