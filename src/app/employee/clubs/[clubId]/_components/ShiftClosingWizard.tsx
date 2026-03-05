"use client"

import { useState, useTransition, useEffect, useMemo } from "react"
import { Loader2, ArrowRight, CheckCircle2, AlertTriangle, Package, Camera, Search, Barcode, X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createInventory, closeInventory, getInventoryItems, getProducts, InventoryItem, bulkUpdateInventoryItems, getProductByBarcode, addProductToInventory } from "@/app/clubs/[clubId]/inventory/actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarcodeScanner } from "@/app/clubs/[clubId]/inventory/_components/BarcodeScanner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ShiftClosingWizardProps {
    isOpen: boolean
    onClose: () => void
    onComplete: (reportData: any) => void
    clubId: string
    userId: string
    reportTemplate: any
    activeShiftId: string | number
    skipInventory?: boolean
    checklistTemplates?: any[]
    inventorySettings?: {
        employee_default_metric_key?: string
        employee_allowed_warehouse_ids?: number[]
        blind_inventory_enabled?: boolean
    }
}

interface ExtendedInventoryItem extends InventoryItem {
    is_visible?: boolean
}

export function ShiftClosingWizard({
    isOpen,
    onClose,
    onComplete,
    clubId,
    userId,
    reportTemplate,
    activeShiftId,
    skipInventory = false,
    checklistTemplates = [],
    inventorySettings
}: ShiftClosingWizardProps) {
    const [step, setStep] = useState<0 | 1 | 2 | 3>(1)
    const [reportData, setReportData] = useState<any>({})
    const [inventoryId, setInventoryId] = useState<number | null>(null)
    const [inventoryItems, setInventoryItems] = useState<ExtendedInventoryItem[]>([])
    const [isPending, startTransition] = useTransition()
    const [calculationResult, setCalculationResult] = useState<{ reported: number, calculated: number, diff: number } | null>(null)
    const [requiredChecklist, setRequiredChecklist] = useState<any>(null)
    const [checklistResponses, setChecklistResponses] = useState<Record<number, { score: number, comment: string, selected_workstations?: string[] }>>({})
    const [workstations, setWorkstations] = useState<any[]>([])
    const [problematicItems, setProblematicItems] = useState<Record<number, string[]>>({})

    // New states for barcode scanner and manual adding
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [scannedItemId, setScannedItemId] = useState<number | null>(null)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [allProducts, setAllProducts] = useState<{ id: number, name: string }[]>([])
    const [selectedProductToAdd, setSelectedProductToAdd] = useState("")
    const [searchQuery, setSearchQuery] = useState("")

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            console.log('Wizard opened, resetting state')
            setReportData({})
            setInventoryId(null)
            setInventoryItems([])
            setCalculationResult(null)
            setChecklistResponses({})
            setProblematicItems({})
            setScannedItemId(null)
            setSearchQuery("")
            
            const mandatory = checklistTemplates?.find((t: any) => 
                t.type === 'shift_handover' && t.settings?.block_shift_close
            )
            
            if (mandatory) {
                setRequiredChecklist(mandatory)
                const initial: Record<number, { score: number, comment: string, selected_workstations?: string[] }> = {}
                mandatory.items?.forEach((item: any) => {
                    // For standard items, default to 1 (Yes). For workstation items, we wait for fetch.
                    if (item.related_entity_type !== 'workstations') {
                        initial[item.id] = { score: 1, comment: '', selected_workstations: [] }
                    }
                })
                setChecklistResponses(initial)
            } else {
                setRequiredChecklist(null)
            }
            setStep(1)

            // Fetch workstations
            if (clubId) {
                fetch(`/api/clubs/${clubId}/workstations`)
                    .then(res => res.json())
                    .then(data => {
                        if (Array.isArray(data)) {
                            setWorkstations(data)
                            // Set initial scores for workstation items to 10 (Max)
                            if (mandatory) {
                                setChecklistResponses(prev => {
                                    const next = { ...prev }
                                    mandatory.items?.forEach((item: any) => {
                                        if (item.related_entity_type === 'workstations') {
                                            // Default score is always 10 for workstation checks
                                            next[item.id] = { score: 10, comment: '', selected_workstations: [] }
                                        }
                                    })
                                    return next
                                })
                            }
                        }
                    })
                    .catch(console.error)
            }
        }
    }, [isOpen]) // Only reset when isOpen transitions to true

    // Step 1: Financial Report + Checklist
    const handleStep1Submit = () => {
        const requiredFields = reportTemplate?.schema.filter((f: any) => f.is_required).map((f: any) => f.metric_key) || []
        const missing = requiredFields.filter((key: string) => !reportData[key])
        if (missing.length > 0) return alert(`Заполните обязательные поля отчета`)
        if (requiredChecklist?.items?.length) {
            const missingWorkstationComment = requiredChecklist.items.some((item: any) => {
                if (item.related_entity_type !== 'workstations') return false
                const issues = problematicItems[item.id] || []
                if (issues.length === 0) return false
                const comment = checklistResponses[item.id]?.comment || ''
                return comment.trim().length === 0
            })
            if (missingWorkstationComment) {
                return alert("Укажите причину для проблемных мест")
            }
        }

        if (skipInventory) {
            onComplete({ ...reportData, checklistResponses, checklistId: requiredChecklist?.id })
            return
        }
        
        setStep(2)
        startInventory()
    }

    const handleChecklistChange = (itemId: number, score: number) => {
        setChecklistResponses(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], score }
        }))
    }

    const toggleProblematicWorkstation = (itemId: number, wsId: string, maxScore: number, targetWs: any[]) => {
        setProblematicItems(prev => {
            const current = prev[itemId] || []
            const newItems = current.includes(wsId) 
                ? current.filter(id => id !== wsId)
                : [...current, wsId]
            
            // Calculate proportional score
            // Max score is always 10
            // Error price = 10 / total_workstations
            const totalWorkstations = targetWs.length
            const errorPrice = totalWorkstations > 0 ? 10 / totalWorkstations : 0
            
            // Score = 10 - (errors * error_price)
            const rawScore = 10 - (newItems.length * errorPrice)
            // Round to 1 decimal place to look nice (e.g. 9.5, 8.3)
            const newScore = Math.max(0, Math.round(rawScore * 10) / 10)
            
            const workstationNames = targetWs.filter(w => newItems.includes(w.id)).map(w => w.name)
            
            setChecklistResponses(r => ({
                ...r,
                [itemId]: {
                    score: newScore,
                    comment: r[itemId]?.comment || '',
                    selected_workstations: workstationNames
                }
            }))
            
            return { ...prev, [itemId]: newItems }
        })
    }

    const startInventory = () => {
        startTransition(async () => {
            try {
                // 1. Determine target metric key
                const targetMetric = inventorySettings?.employee_default_metric_key || 
                    reportTemplate?.schema?.find((f: any) => 
                        f.metric_key.toLowerCase().includes('bar') || 
                        f.metric_key.toLowerCase().includes('revenue') ||
                        f.custom_label.toLowerCase().includes('бар') ||
                        f.custom_label.toLowerCase().includes('выручка')
                    )?.metric_key || 'total_revenue'

                // 2. Determine which warehouse to use. 
                // If multiple are allowed, we'll pick the first one for now (simplest for shift closing)
                const allowedWarehouseId = inventorySettings?.employee_allowed_warehouse_ids?.[0] || null

                console.log('Starting inventory:', { targetMetric, allowedWarehouseId })
                
                const newInvId = await createInventory(
                    clubId, 
                    userId, 
                    targetMetric, 
                    null, // categoryId
                    allowedWarehouseId,
                    activeShiftId.toString() // Pass shiftId
                )
                
                setInventoryId(newInvId)
                const items = await getInventoryItems(newInvId)
                
                // If blind inventory is enabled, we start with an empty list for the UI
                // but the items exist in state. We'll only show them once scanned/added.
                setInventoryItems(items.map(i => ({ ...i, is_visible: false })))
            } catch (e) {
                console.error('Failed to start inventory:', e)
                alert("Ошибка запуска инвентаризации")
            }
        })
    }

    const handleBarcodeScan = async (barcode: string) => {
        setIsScannerOpen(false)
        const item = inventoryItems.find(i => i.barcode === barcode)
        
        if (item) {
            setInventoryItems(prev => prev.map(i => i.id === item.id ? { ...i, is_visible: true } : i))
            setScannedItemId(item.id)
            return
        }

        // Try to find in general products if not in current inventory
        try {
            const product = await getProductByBarcode(clubId, barcode)
            if (product) {
                if (confirm(`Товар "${product.name}" не в списке инвентаризации. Добавить?`)) {
                    await addProductToInventory(inventoryId!, product.id)
                    const invItems = await getInventoryItems(inventoryId!)
                    setInventoryItems(invItems.map(i => ({ 
                        ...i, 
                        is_visible: i.product_id === product.id ? true : inventoryItems.find(old => old.id === i.id)?.is_visible || false 
                    })))
                    const newItem = invItems.find(i => i.product_id === product.id)
                    if (newItem) setScannedItemId(newItem.id)
                }
            } else {
                alert(`Товар со штрихкодом ${barcode} не найден.`)
            }
        } catch (e) {
            console.error(e)
        }
    }

    const handleAddProductManually = async () => {
        if (!selectedProductToAdd) return
        startTransition(async () => {
            try {
                await addProductToInventory(inventoryId!, Number(selectedProductToAdd))
                const invItems = await getInventoryItems(inventoryId!)
                setInventoryItems(invItems.map(i => ({ 
                    ...i, 
                    is_visible: i.product_id === Number(selectedProductToAdd) ? true : inventoryItems.find(old => old.id === i.id)?.is_visible || false 
                })))
                
                const newItem = invItems.find(i => i.product_id === Number(selectedProductToAdd))
                if (newItem) setScannedItemId(newItem.id)
                
                setIsAddDialogOpen(false)
                setSelectedProductToAdd("")
            } catch (e: any) {
                alert(e.message)
            }
        })
    }

    const openAddDialog = async () => {
        setIsAddDialogOpen(true)
        if (allProducts.length === 0) {
            const products = await getProducts(clubId)
            setAllProducts(products.map(p => ({ id: p.id, name: p.name })))
        }
    }

    // Auto-focus logic for scanned item
    useEffect(() => {
        if (scannedItemId) {
            const input = document.getElementById(`inventory-input-${scannedItemId}`)
            if (input) {
                input.focus()
                // @ts-ignore
                input.select()
            }
        }
    }, [scannedItemId])

    // Step 2: Inventory Count
    const handleStockChange = (itemId: number, val: string) => {
        const numVal = val === "" ? null : parseInt(val)
        setInventoryItems(prev => prev.map(i => i.id === itemId ? { ...i, actual_stock: numVal } : i))
    }

    const visibleItems = useMemo(() => {
        return inventoryItems.filter(i => {
            if (i.is_visible) return true
            if (searchQuery && i.product_name.toLowerCase().includes(searchQuery.toLowerCase())) return true
            if (searchQuery && i.barcode && i.barcode.includes(searchQuery)) return true
            return false
        })
    }, [inventoryItems, searchQuery])

    const handleInventorySubmit = () => {
        startTransition(async () => {
            try {
                // Save all items first using bulk update
                const itemsToUpdate = inventoryItems
                    .filter(item => item.actual_stock !== null)
                    .map(item => ({ id: item.id, actual_stock: item.actual_stock }))
                
                if (itemsToUpdate.length > 0) {
                    await bulkUpdateInventoryItems(itemsToUpdate, clubId)
                }

                // Calculate local result for preview (Step 3)
                let calculatedRev = 0
                inventoryItems.forEach(item => {
                    if (item.actual_stock !== null) {
                        const sold = item.expected_stock - item.actual_stock
                        calculatedRev += sold * item.selling_price_snapshot
                    }
                })

                // Find the most likely revenue metric key from the template
                const revenueKey = inventorySettings?.employee_default_metric_key || 
                    reportTemplate?.schema?.find((f: any) => 
                        f.metric_key.toLowerCase().includes('bar') || 
                        f.metric_key.toLowerCase().includes('revenue') ||
                        f.custom_label.toLowerCase().includes('бар') ||
                        f.custom_label.toLowerCase().includes('выручка')
                    )?.metric_key || 'total_revenue'

                const reportedRev = parseFloat(reportData[revenueKey] || reportData['bar_revenue'] || reportData['total_revenue'] || '0')
                
                console.log('Calculation summary:', { revenueKey, reportedRev, calculatedRev, reportData })

                setCalculationResult({
                    reported: reportedRev,
                    calculated: calculatedRev,
                    diff: reportedRev - calculatedRev
                })

                setStep(3)
            } catch (e) {
                console.error('Error saving inventory:', e)
                alert("Ошибка сохранения подсчетов")
            }
        })
    }

    // Step 3: Finalize
    const handleFinalize = () => {
        if (!inventoryId || !calculationResult) return
        startTransition(async () => {
            try {
                // Close inventory in DB
                await closeInventory(inventoryId, clubId, calculationResult.reported)
                
                // Complete shift closing
                onComplete({ ...reportData, checklistResponses, checklistId: requiredChecklist?.id })
            } catch (e) {
                console.error(e)
                alert("Ошибка завершения")
            }
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={`
                bg-slate-950 border-slate-800 text-white flex flex-col transition-all duration-300
                ${step === 2 ? 'fixed inset-0 max-w-none w-screen h-screen m-0 rounded-none' : 'max-w-4xl max-h-[90vh] overflow-hidden'}
            `}>
                <BarcodeScanner 
                    isOpen={isScannerOpen} 
                    onScan={handleBarcodeScan} 
                    onClose={() => setIsScannerOpen(false)} 
                />
                
                <DialogHeader className={step === 2 ? 'px-6 pt-6' : ''}>
                    <DialogTitle className="flex items-center justify-between">
                        <span>{skipInventory ? "Закрытие смены" : `Закрытие смены: Шаг ${step} из 3`}</span>
                        {step === 2 && (
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setIsScannerOpen(true)}
                                    className="bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600/30"
                                >
                                    <Camera className="h-4 w-4 mr-2" />
                                    Сканировать
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={openAddDialog}
                                    className="bg-slate-800 border-slate-700 text-slate-300"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Добавить товар
                                </Button>
                            </div>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        {step === 1 && "Заполните финансовый отчет"}
                        {!skipInventory && step === 2 && "Инвентаризация: сканируйте штрихкод или найдите товар через поиск"}
                        {!skipInventory && step === 3 && "Сверка итогов"}
                    </DialogDescription>
                </DialogHeader>

                <div className={`flex-1 overflow-y-auto py-4 ${step === 2 ? 'px-6' : 'pr-2'}`}>
                    {/* STEP 1: REPORT FORM + CHECKLIST */}
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* ... existing Step 1 content ... */}
                        </div>
                    )}

                    {/* STEP 2: INVENTORY */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                    <Input 
                                        placeholder="Поиск по названию или штрихкоду..."
                                        className="pl-10 bg-slate-900 border-slate-800 focus:border-blue-500 transition-all"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                {visibleItems.length > 0 && (
                                    <p className="text-xs text-slate-500 whitespace-nowrap">
                                        Показано: {visibleItems.length} из {inventoryItems.length}
                                    </p>
                                )}
                            </div>

                            {visibleItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-2xl animate-in fade-in zoom-in duration-300">
                                    <div className="bg-slate-800/50 p-6 rounded-full mb-4">
                                        <Barcode className="h-12 w-12 text-slate-600" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-300">Список пуст</h3>
                                    <p className="text-sm text-slate-500 mt-2 text-center max-w-xs">
                                        Начните сканировать товары или воспользуйтесь поиском выше, чтобы внести остатки.
                                    </p>
                                    <div className="flex gap-3 mt-8">
                                        <Button onClick={() => setIsScannerOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                                            <Camera className="h-4 w-4 mr-2" />
                                            Сканировать штрихкод
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
                                    <Table>
                                        <TableHeader className="bg-slate-900">
                                            <TableRow className="border-slate-800 hover:bg-transparent">
                                                <TableHead className="text-slate-300 py-4">Товар</TableHead>
                                                {inventorySettings?.blind_inventory_enabled === false && (
                                                    <TableHead className="text-right text-slate-300 py-4">Ожидалось</TableHead>
                                                )}
                                                <TableHead className="text-right text-slate-300 py-4">Фактически</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {visibleItems.map(item => (
                                                <TableRow 
                                                    key={item.id} 
                                                    className={`border-slate-800 transition-colors ${scannedItemId === item.id ? 'bg-blue-950/30' : 'hover:bg-slate-800/30'}`}
                                                >
                                                    <TableCell className="py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-200">{item.product_name}</span>
                                                            {item.barcode && (
                                                                <span className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1">
                                                                    <Barcode className="h-2.5 w-2.5" />
                                                                    {item.barcode}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    {inventorySettings?.blind_inventory_enabled === false && (
                                                        <TableCell className="text-right text-slate-400 font-mono py-4">
                                                            {item.expected_stock}
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="text-right py-4">
                                                        <Input 
                                                            type="number" 
                                                            id={`inventory-input-${item.id}`}
                                                            className={`bg-slate-900 border-slate-700 text-right w-24 ml-auto font-bold text-lg h-11 focus:ring-2 focus:ring-blue-500 transition-all ${scannedItemId === item.id ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : ''}`}
                                                            placeholder="0"
                                                            value={item.actual_stock === null ? "" : item.actual_stock}
                                                            onChange={(e) => handleStockChange(item.id, e.target.value)}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: SUMMARY */}
                    {step === 3 && calculationResult && (
                        <div className="space-y-6">
                            {/* ... existing Step 3 content ... */}
                        </div>
                    )}
                </div>

                <DialogFooter className={`mt-4 border-t border-slate-800 pt-4 ${step === 2 ? 'px-6 pb-6' : ''}`}>
                    {/* ... existing Footer content ... */}
                </DialogFooter>

                {/* Add Product Manually Dialog */}
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogContent className="bg-slate-950 border-slate-800 text-white">
                        <DialogHeader>
                            <DialogTitle>Добавить товар</DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label>Выберите товар</Label>
                                <Select value={selectedProductToAdd} onValueChange={setSelectedProductToAdd}>
                                    <SelectTrigger className="bg-slate-900 border-slate-800">
                                        <SelectValue placeholder="Поиск по списку..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-[300px]">
                                        {allProducts.map(p => (
                                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="border-slate-800">Отмена</Button>
                            <Button onClick={handleAddProductManually} disabled={!selectedProductToAdd || isPending} className="bg-blue-600">
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Добавить
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DialogContent>
        </Dialog>
    )
}
