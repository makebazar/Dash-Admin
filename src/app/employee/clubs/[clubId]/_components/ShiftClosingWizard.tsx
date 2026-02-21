"use client"

import { useState, useTransition, useEffect } from "react"
import { Loader2, ArrowRight, CheckCircle2, AlertTriangle, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createInventory, updateInventoryItem, closeInventory, getInventoryItems, getProducts, InventoryItem } from "@/app/clubs/[clubId]/inventory/actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface ShiftClosingWizardProps {
    isOpen: boolean
    onClose: () => void
    onComplete: (reportData: any) => void
    clubId: string
    userId: string
    reportTemplate: any
    activeShiftId: number
    skipInventory?: boolean
    checklistTemplates?: any[]
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
    checklistTemplates = []
}: ShiftClosingWizardProps) {
    const [step, setStep] = useState<0 | 1 | 2 | 3>(1)
    const [reportData, setReportData] = useState<any>({})
    const [inventoryId, setInventoryId] = useState<number | null>(null)
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
    const [isPending, startTransition] = useTransition()
    const [calculationResult, setCalculationResult] = useState<{ reported: number, calculated: number, diff: number } | null>(null)
    const [requiredChecklist, setRequiredChecklist] = useState<any>(null)
    const [checklistResponses, setChecklistResponses] = useState<Record<number, { score: number, comment: string }>>({})

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setReportData({})
            setInventoryId(null)
            setInventoryItems([])
            setCalculationResult(null)
            setChecklistResponses({})
            
            const mandatory = checklistTemplates?.find((t: any) => 
                t.type === 'shift_handover' && t.settings?.block_shift_close
            )
            
            if (mandatory) {
                setRequiredChecklist(mandatory)
                const initial: Record<number, { score: number, comment: string }> = {}
                mandatory.items?.forEach((item: any) => {
                    initial[item.id] = { score: 1, comment: '' }
                })
                setChecklistResponses(initial)
            } else {
                setRequiredChecklist(null)
            }
            setStep(1)
        }
    }, [isOpen, checklistTemplates])

    // Step 1: Financial Report + Checklist
    const handleStep1Submit = () => {
        const requiredFields = reportTemplate?.schema.filter((f: any) => f.is_required).map((f: any) => f.metric_key) || []
        const missing = requiredFields.filter((key: string) => !reportData[key])
        if (missing.length > 0) return alert(`Заполните обязательные поля отчета`)

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

    const startInventory = () => {
        startTransition(async () => {
            try {
                // Determine target metric key
                const newInvId = await createInventory(clubId, userId, 'shift_closing_check')
                setInventoryId(newInvId)
                const items = await getInventoryItems(newInvId)
                setInventoryItems(items)
            } catch (e) {
                console.error(e)
                alert("Ошибка запуска инвентаризации")
            }
        })
    }

    // Step 2: Inventory Count
    const handleStockChange = (itemId: number, val: string) => {
        const numVal = val === "" ? null : parseInt(val)
        setInventoryItems(prev => prev.map(i => i.id === itemId ? { ...i, actual_stock: numVal } : i))
    }

    const handleInventorySubmit = () => {
        startTransition(async () => {
            try {
                // Save all items first
                await Promise.all(inventoryItems.map(item => 
                    item.actual_stock !== null ? updateInventoryItem(item.id, item.actual_stock, clubId) : Promise.resolve()
                ))

                // Calculate local result for preview (Step 3)
                let calculatedRev = 0
                inventoryItems.forEach(item => {
                    if (item.actual_stock !== null) {
                        const sold = item.expected_stock - item.actual_stock
                        calculatedRev += sold * item.selling_price_snapshot
                    }
                })

                const reportedRev = parseFloat(reportData['bar_revenue'] || reportData['total_revenue'] || '0')
                
                setCalculationResult({
                    reported: reportedRev,
                    calculated: calculatedRev,
                    diff: reportedRev - calculatedRev
                })

                setStep(3)
            } catch (e) {
                console.error(e)
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
            <DialogContent className="max-w-4xl bg-slate-950 border-slate-800 text-white max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {skipInventory ? "Закрытие смены" : `Закрытие смены: Шаг ${step} из 3`}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        {step === 1 && "Заполните финансовый отчет"}
                        {!skipInventory && step === 2 && "Проведите инвентаризацию склада"}
                        {!skipInventory && step === 3 && "Сверка итогов"}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 pr-2">
                    {/* STEP 1: REPORT FORM + CHECKLIST */}
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* Checklist Section if Required */}
                            {requiredChecklist && (
                                <div className="bg-orange-900/10 border border-orange-900/30 p-4 rounded-lg space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-orange-100/10 p-2 rounded-full">
                                            <CheckCircle2 className="h-5 w-5 text-orange-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-orange-100">Обязательный чеклист: {requiredChecklist.name}</h4>
                                            <p className="text-sm text-orange-200/70">Необходимо заполнить перед закрытием смены</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pl-2 border-l-2 border-orange-800/30 ml-4">
                                        {requiredChecklist.items?.map((item: any) => (
                                            <div key={item.id} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-slate-200">{item.content}</span>
                                                    <div className="flex gap-1 bg-slate-900 p-1 rounded-md border border-slate-800">
                                                        <Button 
                                                            variant={checklistResponses[item.id]?.score === 1 ? 'default' : 'ghost'} 
                                                            size="sm"
                                                            className={`h-7 px-3 text-xs ${checklistResponses[item.id]?.score === 1 ? 'bg-green-600 hover:bg-green-700' : 'text-slate-400'}`}
                                                            onClick={() => handleChecklistChange(item.id, 1)}
                                                        >
                                                            Да
                                                        </Button>
                                                        <Button 
                                                            variant={checklistResponses[item.id]?.score === 0 ? 'default' : 'ghost'} 
                                                            size="sm"
                                                            className={`h-7 px-3 text-xs ${checklistResponses[item.id]?.score === 0 ? 'bg-red-600 hover:bg-red-700' : 'text-slate-400'}`}
                                                            onClick={() => handleChecklistChange(item.id, 0)}
                                                        >
                                                            Нет
                                                        </Button>
                                                    </div>
                                                </div>
                                                {checklistResponses[item.id]?.score === 0 && (
                                                    <Input 
                                                        placeholder="Комментарий (обязательно при отказе)..."
                                                        className="h-8 text-xs bg-slate-900 border-slate-700"
                                                        value={checklistResponses[item.id]?.comment || ''}
                                                        onChange={(e) => setChecklistResponses(prev => ({
                                                            ...prev,
                                                            [item.id]: { ...prev[item.id], comment: e.target.value }
                                                        }))}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h4 className="font-medium text-slate-200">Финансовый отчет</h4>
                                {reportTemplate?.schema.map((field: any, idx: number) => (
                                    <div key={idx} className="space-y-2">
                                    <Label>
                                        {field.custom_label}
                                        {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                    </Label>
                                    <Input
                                        required={field.is_required}
                                        type={field.metric_key.includes('comment') ? 'text' : 'number'}
                                        className="bg-slate-900 border-slate-700"
                                        value={reportData[field.metric_key] || ''}
                                        onChange={(e) => setReportData({ ...reportData, [field.metric_key]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* STEP 2: INVENTORY */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg flex items-start gap-3">
                                <Package className="h-5 w-5 text-blue-400 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-blue-100">Слепая инвентаризация</h4>
                                    <p className="text-sm text-blue-300/80">
                                        Посчитайте фактическое количество товаров. Ожидаемые остатки скрыты.
                                    </p>
                                </div>
                            </div>

                            <div className="border border-slate-800 rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-900">
                                        <TableRow>
                                            <TableHead className="text-slate-300">Товар</TableHead>
                                            <TableHead className="text-right text-slate-300">Остаток</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {inventoryItems.map(item => (
                                            <TableRow key={item.id} className="border-slate-800">
                                                <TableCell className="font-medium text-slate-200">{item.product_name}</TableCell>
                                                <TableCell className="text-right">
                                                    <Input 
                                                        type="number" 
                                                        className="bg-slate-900 border-slate-700 text-right w-24 ml-auto"
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
                        </div>
                    )}

                    {/* STEP 3: SUMMARY */}
                    {step === 3 && calculationResult && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 text-center">
                                    <p className="text-xs text-slate-400 uppercase">Заявлено в отчете</p>
                                    <p className="text-2xl font-bold mt-1">{calculationResult.reported.toLocaleString()} ₽</p>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 text-center">
                                    <p className="text-xs text-slate-400 uppercase">Расчет по товарам</p>
                                    <p className="text-2xl font-bold mt-1">{calculationResult.calculated.toLocaleString()} ₽</p>
                                </div>
                                <div className={`p-4 rounded-lg border text-center ${
                                    calculationResult.diff === 0 ? 'bg-emerald-900/20 border-emerald-900/50 text-emerald-400' : 
                                    calculationResult.diff > 0 ? 'bg-emerald-900/20 border-emerald-900/50 text-emerald-400' :
                                    'bg-red-900/20 border-red-900/50 text-red-400'
                                }`}>
                                    <p className="text-xs opacity-80 uppercase">Разница</p>
                                    <p className="text-2xl font-bold mt-1">
                                        {calculationResult.diff > 0 ? '+' : ''}{calculationResult.diff.toLocaleString()} ₽
                                    </p>
                                </div>
                            </div>

                            {calculationResult.diff !== 0 && (
                                <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-lg flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-red-100">Внимание! Расхождение</h4>
                                        <p className="text-sm text-red-300/80">
                                            Сумма в кассе не сходится с проданными товарами. 
                                            Пожалуйста, перепроверьте данные или укажите причину в комментарии к смене.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Комментарий к закрытию (если есть расхождения)</Label>
                                <Input 
                                    className="bg-slate-900 border-slate-700"
                                    placeholder="Обоснование недостачи/излишков..."
                                    value={reportData['shift_comment'] || ''}
                                    onChange={(e) => setReportData({ ...reportData, 'shift_comment': e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-4 border-t border-slate-800 pt-4">
                    {step === 1 && (
                        <Button onClick={handleStep1Submit} className="w-full bg-purple-600 hover:bg-purple-700">
                            {skipInventory ? (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Завершить смену
                                </>
                            ) : (
                                <>
                                    Далее: Инвентаризация <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    )}
                    {step === 2 && (
                        <Button onClick={handleInventorySubmit} disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Далее: Сверка итогов <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                    {step === 3 && (
                        <Button onClick={handleFinalize} disabled={isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Подтвердить и закрыть смену
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
