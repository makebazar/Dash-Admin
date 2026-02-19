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
}

export function ShiftClosingWizard({
    isOpen,
    onClose,
    onComplete,
    clubId,
    userId,
    reportTemplate,
    activeShiftId
}: ShiftClosingWizardProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [reportData, setReportData] = useState<any>({})
    const [inventoryId, setInventoryId] = useState<number | null>(null)
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
    const [isPending, startTransition] = useTransition()
    const [calculationResult, setCalculationResult] = useState<{ reported: number, calculated: number, diff: number } | null>(null)

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setStep(1)
            setReportData({})
            setInventoryId(null)
            setInventoryItems([])
            setCalculationResult(null)
        }
    }, [isOpen])

    // Step 1: Financial Report
    const handleStep1Submit = () => {
        // Basic validation
        const requiredFields = reportTemplate?.schema.filter((f: any) => f.is_required).map((f: any) => f.metric_key) || []
        const missing = requiredFields.filter((key: string) => !reportData[key])
        
        if (missing.length > 0) {
            alert(`Заполните обязательные поля`)
            return
        }
        
        setStep(2)
        // Initialize Inventory
        startInventory()
    }

    const startInventory = () => {
        startTransition(async () => {
            try {
                // Determine target metric key (e.g., 'bar_revenue')
                // For simplicity, we assume there is a 'bar_revenue' or similar key in reportData
                // Or we ask the user. But here we want automation.
                // Let's look for a metric with type 'INCOME' and 'bar' in label/key, or default to first money metric?
                // Better: hardcode or config. Let's assume 'cash_income' + 'card_income' is total revenue.
                // But inventory usually checks specific stock vs specific revenue (e.g. Bar).
                // Let's use a generic 'total_revenue' or specific key if available.
                // For now, let's use 'revenue_cash' as a placeholder or 'bar_revenue' if exists.
                
                // We'll create inventory attached to this shift closing process.
                const newInvId = await createInventory(clubId, userId, 'shift_closing_check')
                setInventoryId(newInvId)
                
                // Load items
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
                    item.actual_stock !== null ? updateInventoryItem(item.id, item.actual_stock) : Promise.resolve()
                ))

                // Calculate local result for preview (Step 3)
                let calculatedRev = 0
                inventoryItems.forEach(item => {
                    if (item.actual_stock !== null) {
                        const sold = item.expected_stock - item.actual_stock
                        calculatedRev += sold * item.selling_price_snapshot
                    }
                })

                // Get reported revenue from Step 1
                // Assuming 'bar_revenue' or sum of incomes. 
                // Let's use a heuristic: sum of all MONEY fields in reportData?
                // Or specific field 'bar_revenue'.
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
                onComplete(reportData)
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
                    <DialogTitle>Закрытие смены: Шаг {step} из 3</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        {step === 1 && "Заполните финансовый отчет"}
                        {step === 2 && "Проведите инвентаризацию склада"}
                        {step === 3 && "Сверка итогов"}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 pr-2">
                    {/* STEP 1: REPORT FORM */}
                    {step === 1 && (
                        <div className="space-y-4">
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
                            Далее: Инвентаризация <ArrowRight className="ml-2 h-4 w-4" />
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
