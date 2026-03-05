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
        setInventoryItems(prev => prev.map(i => {
            if (i.id === itemId) {
                // Если ввели число >= 0, помечаем товар как видимый навсегда
                const isVisible = numVal !== null ? true : i.is_visible
                return { ...i, actual_stock: numVal, is_visible: isVisible }
            }
            return i
        }))
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

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-slate-950 text-white flex flex-col z-[9999] animate-in fade-in duration-300 overflow-hidden">
            {step === 2 && (
                <BarcodeScanner 
                    isOpen={isScannerOpen} 
                    onScan={handleBarcodeScan} 
                    onClose={() => setIsScannerOpen(false)} 
                />
            )}
            
            <header className="px-4 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-lg font-bold truncate">
                            {skipInventory ? "Закрытие смены" : `Закрытие смены: Шаг ${step} из 3`}
                        </h2>
                        {step === 2 && (
                            <div className="flex items-center gap-2 shrink-0">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setIsScannerOpen(true)}
                                    className="bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600/30 h-8 px-2.5"
                                >
                                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                                    <span className="text-[11px] font-medium">Сканер</span>
                                </Button>
                            </div>
                        )}
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={onClose} 
                            className="text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800 shrink-0 h-10 w-10"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                            {step === 1 && "Заполните финансовый отчет"}
                            {step === 2 && "Внесите остатки на складе"}
                            {step === 3 && "Сверка итогов"}
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 py-6">
                {/* STEP 1: REPORT FORM + CHECKLIST */}
                {step === 1 && (
                    <div className="space-y-6 max-w-2xl mx-auto pb-20">
                        {/* Checklist Section if Required */}
                        {requiredChecklist && (
                            <div className="bg-orange-900/10 border border-orange-900/30 p-4 rounded-xl space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="bg-orange-100/10 p-2 rounded-full">
                                        <CheckCircle2 className="h-5 w-5 text-orange-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-orange-100">Чеклист: {requiredChecklist.name}</h4>
                                        <p className="text-xs text-orange-200/60">Обязательно перед закрытием</p>
                                    </div>
                                </div>

                                <div className="space-y-4 pl-2 border-l-2 border-orange-800/30 ml-4">
                                    {requiredChecklist.items?.map((item: any) => {
                                         // Workstation Checklist Logic
                                         if (item.related_entity_type === 'workstations') {
                                             const targetWs = workstations.filter(w => w.is_active && (!item.target_zone || item.target_zone === 'all' || w.zone === item.target_zone))
                                             const currentProblematic = problematicItems[item.id] || []
                                             const errorPrice = targetWs.length > 0 ? 10 / targetWs.length : 0
                                             const rawScore = 10 - (currentProblematic.length * errorPrice)
                                             const currentScore = Math.max(0, Math.round(rawScore * 10) / 10)
                                             
                                             return (
                                                 <div key={item.id} className="space-y-3 py-2">
                                                     <div className="flex items-center justify-between">
                                                         <span className="text-sm font-medium text-slate-200">{item.content}</span>
                                                         <div className="text-xs font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                                             <span className={currentScore < 10 ? "text-red-400" : "text-green-400"}>{currentScore}</span>
                                                             <span className="opacity-50 mx-1">/</span>
                                                             <span>10</span>
                                                         </div>
                                                     </div>
                                                     <div className="grid grid-cols-3 gap-2">
                                                         {targetWs.map(ws => (
                                                             <Button
                                                                 key={ws.id}
                                                                 variant="outline"
                                                                 size="sm"
                                                                 className={`h-8 text-[10px] ${currentProblematic.includes(ws.id) ? 'bg-red-950/50 border-red-800 text-red-200' : 'bg-slate-900/50 border-slate-800'}`}
                                                                 onClick={() => toggleProblematicWorkstation(item.id, ws.id, 10, targetWs)}
                                                             >
                                                                 {ws.name}
                                                             </Button>
                                                         ))}
                                                     </div>
                                                 </div>
                                             )
                                         }

                                        return (
                                            <div key={item.id} className="space-y-2">
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-sm font-medium text-slate-200">{item.content}</span>
                                                    <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 shrink-0">
                                                        <Button 
                                                            variant={checklistResponses[item.id]?.score === 1 ? 'default' : 'ghost'} 
                                                            size="sm"
                                                            className={`h-7 px-3 text-xs ${checklistResponses[item.id]?.score === 1 ? 'bg-green-600' : 'text-slate-400'}`}
                                                            onClick={() => handleChecklistChange(item.id, 1)}
                                                        >
                                                            Да
                                                        </Button>
                                                        <Button 
                                                            variant={checklistResponses[item.id]?.score === 0 ? 'default' : 'ghost'} 
                                                            size="sm"
                                                            className={`h-7 px-3 text-xs ${checklistResponses[item.id]?.score === 0 ? 'bg-red-600' : 'text-slate-400'}`}
                                                            onClick={() => handleChecklistChange(item.id, 0)}
                                                        >
                                                            Нет
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )})}
                                </div>
                            </div>
                        )}

                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                                <div className="h-1 w-4 bg-purple-500 rounded-full" />
                                Финансовый отчет
                            </h3>
                            <div className="grid gap-5">
                                {reportTemplate?.schema.map((field: any, idx: number) => (
                                    <div key={idx} className="space-y-2">
                                        <Label className="text-slate-400 text-xs uppercase tracking-wider ml-1">
                                            {field.custom_label}
                                            {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                        </Label>
                                        <Input
                                            required={field.is_required}
                                            type={field.metric_key.includes('comment') ? 'text' : 'number'}
                                            inputMode={field.metric_key.includes('comment') ? 'text' : 'numeric'}
                                            className="bg-slate-900 border-slate-800 h-12 rounded-xl focus:ring-2 focus:ring-purple-500 transition-all text-lg font-medium"
                                            value={reportData[field.metric_key] || ''}
                                            onChange={(e) => setReportData({ ...reportData, [field.metric_key]: e.target.value })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: INVENTORY */}
                {step === 2 && (
                    <div className="space-y-6 max-w-4xl mx-auto pb-20">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input 
                                placeholder="Поиск по названию или штрихкоду..."
                                className="pl-10 bg-slate-900 border-slate-800 h-12 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {visibleItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-2xl">
                                <Barcode className="h-12 w-12 text-slate-700 mb-4" />
                                <h3 className="text-lg font-medium text-slate-400 text-center">Список пуст.<br/>Сканируйте товар!</h3>
                            </div>
                        ) : (
                            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/50">
                                <Table>
                                    <TableHeader className="bg-slate-900">
                                        <TableRow className="border-slate-800 hover:bg-transparent">
                                            <TableHead className="text-slate-400 text-[10px] uppercase font-bold py-4 pl-6">Товар</TableHead>
                                            <TableHead className="text-right text-slate-400 text-[10px] uppercase font-bold py-4 pr-6">Кол-во</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {visibleItems.map(item => (
                                            <TableRow key={item.id} className={`border-slate-800 ${scannedItemId === item.id ? 'bg-blue-900/20' : ''}`}>
                                                <TableCell className="py-4 pl-6">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-200">{item.product_name}</span>
                                                        {item.barcode && <span className="text-[10px] text-slate-500 font-mono">{item.barcode}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-4 pr-6">
                                                    <Input 
                                                        type="number" 
                                                        id={`inventory-input-${item.id}`}
                                                        className="bg-slate-900 border-slate-800 text-right w-20 ml-auto font-bold h-10 rounded-lg"
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
                    <div className="space-y-8 max-w-2xl mx-auto pb-20">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex justify-between items-center">
                                <span className="text-slate-400">В кассе (отчет)</span>
                                <span className="text-xl font-bold">{calculationResult.reported.toLocaleString()} ₽</span>
                            </div>
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex justify-between items-center">
                                <span className="text-slate-400">Продано (склад)</span>
                                <span className="text-xl font-bold">{calculationResult.calculated.toLocaleString()} ₽</span>
                            </div>
                            <div className={`p-6 rounded-2xl border flex justify-between items-center ${
                                calculationResult.diff >= 0 ? 'bg-green-900/10 border-green-900/30 text-green-400' : 'bg-red-900/10 border-red-900/30 text-red-400'
                            }`}>
                                <span className="font-bold">Разница</span>
                                <span className="text-2xl font-black">{calculationResult.diff.toLocaleString()} ₽</span>
                            </div>
                        </div>

                        {calculationResult.diff !== 0 && (
                            <div className="space-y-3">
                                <Label className="text-slate-400 text-xs uppercase tracking-wider ml-1">Причина расхождения</Label>
                                <Input 
                                    className="bg-slate-900 border-slate-800 h-14 rounded-xl"
                                    placeholder="Укажите причину..."
                                    value={reportData['shift_comment'] || ''}
                                    onChange={(e) => setReportData({ ...reportData, 'shift_comment': e.target.value })}
                                />
                            </div>
                        )}
                    </div>
                )}
            </main>

            <footer className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md sticky bottom-0 z-50">
                {step === 1 && (
                    <Button onClick={handleStep1Submit} className="w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 rounded-2xl shadow-lg shadow-purple-900/20">
                        {skipInventory ? "Завершить смену" : "Далее: Инвентаризация"}
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                )}
                {step === 2 && (
                    <Button onClick={handleInventorySubmit} disabled={isPending} className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-900/20">
                        Далее: Сверка итогов
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                )}
                {step === 3 && (
                    <Button onClick={handleFinalize} disabled={isPending} className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 rounded-2xl shadow-lg shadow-green-900/20">
                        Подтвердить и закрыть
                    </Button>
                )}
            </footer>

            {/* Manual Add Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-[90vw] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Добавить товар</DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <Select value={selectedProductToAdd} onValueChange={setSelectedProductToAdd}>
                            <SelectTrigger className="bg-slate-900 border-slate-800 h-12 rounded-xl">
                                <SelectValue placeholder="Выберите товар..." />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-[300px]">
                                {allProducts.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter className="flex-row gap-3">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1 border-slate-800 h-12 rounded-xl">Отмена</Button>
                        <Button onClick={handleAddProductManually} disabled={!selectedProductToAdd || isPending} className="flex-1 bg-blue-600 h-12 rounded-xl">Добавить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
