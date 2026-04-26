"use client"

import { useState, useTransition, useEffect, useMemo, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { Loader2, ArrowRight, CheckCircle2, AlertTriangle, Camera, X, Plus, Trash2, ArrowLeft, RefreshCcw, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useSSE } from "@/hooks/usePOSWebSocket"
import {
    addProductToInventorySafe,
    bulkUpdateInventoryItemsSafe,
    closeInventorySafe,
    createShiftReceiptSafe,
    createInventorySafe,
    getInventoryItems,
    getProductByBarcode,
    getProducts,
    getShiftReceipts,
    type InventoryItem,
    type ShiftReceipt
} from "@/app/clubs/[clubId]/inventory/actions"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { StockCountWorkspace, type StockCountWorkspaceItem } from "@/app/clubs/[clubId]/inventory/_components/StockCountWorkspace"
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { optimizeFileBeforeUpload } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { ShiftOpeningWizard } from "./ShiftOpeningWizard"

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
        report_reconciliation_enabled?: boolean
        cashbox_warehouse_id?: number | null
        handover_warehouse_id?: number | null
        sales_capture_mode?: 'SHIFT'
        inventory_timing?: 'END_SHIFT'
    }
    mode?: 'END_SHIFT' | 'START_SHIFT'
}

interface ExtendedInventoryItem extends InventoryItem {
    is_visible?: boolean
    last_modified?: number
}

type InventorySummary = {
    countedItems: number
    discrepancyItems: number
    shortageItems: number
    excessItems: number
    shortageValue: number
    excessValue: number
    discrepancyValue: number
    discrepancyQuantity: number
    isPerfect: boolean
}

function buildShiftSalesPreview(
    receipts: ShiftReceipt[],
    manualSales: { product_id: number, quantity: number, selling_price: number, name: string }[]
) {
    const agg = new Map<number, { name: string, qty: number, price: number }>()

    for (const receipt of receipts) {
        if (receipt.voided_at || receipt.counts_in_revenue === false) continue
        for (const item of receipt.items || []) {
            const netQty = Math.max(0, Number(item.quantity) - Number(item.returned_qty || 0))
            if (netQty <= 0) continue

            const current = agg.get(item.product_id)
            const price = Number(item.selling_price_snapshot || 0)
            if (!current) {
                agg.set(item.product_id, { name: item.product_name, qty: netQty, price })
            } else {
                current.qty += netQty
                current.price = price
            }
        }
    }

    const scanned = Array.from(agg.entries()).map(([productId, value]) => ({
        id: productId,
        name: value.name,
        qty: value.qty,
        price: value.price,
        total: value.qty * value.price,
        isUnaccounted: false
    }))

    const manual = manualSales.map(sale => ({
        id: sale.product_id,
        name: sale.name,
        qty: sale.quantity,
        price: sale.selling_price,
        total: sale.quantity * sale.selling_price,
        isUnaccounted: true
    }))

    return [...scanned, ...manual]
}

function summarizeInventory(items: ExtendedInventoryItem[]): InventorySummary {
    let countedItems = 0
    let discrepancyItems = 0
    let shortageItems = 0
    let excessItems = 0
    let shortageValue = 0
    let excessValue = 0
    let discrepancyQuantity = 0

    for (const item of items) {
        if (item.actual_stock === null) continue
        countedItems += 1

        const difference = Number(item.actual_stock) - Number(item.expected_stock || 0)
        if (difference === 0) continue

        discrepancyItems += 1
        discrepancyQuantity += Math.abs(difference)

        if (difference < 0) {
            shortageItems += 1
            shortageValue += Math.abs(difference) * Number(item.selling_price_snapshot || 0)
        } else {
            excessItems += 1
            excessValue += difference * Number(item.selling_price_snapshot || 0)
        }
    }

    return {
        countedItems,
        discrepancyItems,
        shortageItems,
        excessItems,
        shortageValue,
        excessValue,
        discrepancyValue: shortageValue + excessValue,
        discrepancyQuantity,
        isPerfect: discrepancyItems === 0,
    }
}

function normalizeExpenseEntries(value: any) {
    if (Array.isArray(value)) return value

    const amount = Number(value)
    if (Number.isFinite(amount) && amount > 0) {
        return [{ amount: String(amount), comment: '' }]
    }

    return []
}

function hasReportValue(value: any) {
    if (Array.isArray(value)) {
        return value.some((item) => {
            const raw = item?.amount
            if (raw === null || raw === undefined) return false
            const s = String(raw).trim()
            if (s === '') return false
            const n = Number(s)
            return Number.isFinite(n)
        })
    }

    if (typeof value === 'number') return Number.isFinite(value)
    if (typeof value === 'string') {
        const s = value.trim()
        if (s === '') return false
        const n = Number(s)
        if (Number.isFinite(n)) return true
        return true
    }
    return Boolean(value)
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
    inventorySettings,
    mode = 'END_SHIFT'
}: ShiftClosingWizardProps) {
    const { confirmAction, showMessage, Dialogs } = useUiDialogs()
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
    const [reportData, setReportData] = useState<any>({})
    const [inventoryId, setInventoryId] = useState<number | null>(null)
    const [inventoryItems, setInventoryItems] = useState<ExtendedInventoryItem[]>([])
    const [isPending, startTransition] = useTransition()
    const [calculationResult, setCalculationResult] = useState<{ reported: number, calculated: number, diff: number } | null>(null)
    const [requiredChecklist, setRequiredChecklist] = useState<any>(null)
    const [checklistResponses, setChecklistResponses] = useState<Record<number, { score: number, comment: string, photo_urls?: string[], selected_workstations?: string[] }>>({})
    const [isChecklistWizardOpen, setIsChecklistWizardOpen] = useState(false)
    const [workstations, setWorkstations] = useState<any[]>([])
    const [problematicItems, setProblematicItems] = useState<Record<number, string[]>>({})
    const [uploadingState, setUploadingState] = useState<Record<number, boolean>>({})
    const [unaccountedSales, setUnaccountedSales] = useState<{ product_id: number, quantity: number, selling_price: number, cost_price: number, name: string }[]>([])
    const [isUnaccountedDialogOpen, setIsUnaccountedDialogOpen] = useState(false)
    const [isPortalReady, setIsPortalReady] = useState(false)
    const [selectedUnaccountedProduct, setSelectedUnaccountedProduct] = useState("")
    const [unaccountedQty, setUnaccountedQty] = useState("1")
    const [payoutSuggestion, setPayoutSuggestion] = useState<{ amount: number, isAvailable: boolean } | null>(null)

    // New states for barcode scanner and manual adding
    const [scannedItemId, setScannedItemId] = useState<number | null>(null)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [allProducts, setAllProducts] = useState<{ id: number, name: string, barcode?: string | null, barcodes?: string[] | null }[]>([])
    const [selectedProductToAdd, setSelectedProductToAdd] = useState("")
    const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false)
    const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastAutosavedSnapshotRef = useRef("")

    const notifyError = useCallback((description: string, title = "Ошибка") => {
        showMessage({ title, description })
    }, [showMessage])

    const notifyInfo = useCallback((description: string, title = "Уведомление") => {
        showMessage({ title, description })
    }, [showMessage])

    const salesMode = inventorySettings?.sales_capture_mode ?? 'SHIFT'
    const isShiftSalesMode = salesMode === 'SHIFT'
    const isStartShiftMode = mode === 'START_SHIFT'
    const usesSalesReconciliation = !isStartShiftMode && isShiftSalesMode && Boolean(inventorySettings?.report_reconciliation_enabled)
    const usesInventoryCounting = isStartShiftMode || (!isStartShiftMode && !skipInventory)
    const usesRevisionMode = !isStartShiftMode && !isShiftSalesMode
    const usesShiftInventoryReconciliation = usesSalesReconciliation && usesInventoryCounting
    const inventoryStep = isStartShiftMode ? 1 : (isShiftSalesMode ? 3 : 2)
    const finalizeStep = isStartShiftMode ? 2 : (isShiftSalesMode ? 4 : 3)
    const totalSteps = isStartShiftMode ? 2 : (isShiftSalesMode ? (skipInventory ? 2 : 4) : (skipInventory ? 1 : 3))

    const isRequiredChecklistComplete = useMemo(() => {
        if (!requiredChecklist?.items?.length) return true
        for (const item of requiredChecklist.items) {
            const response = checklistResponses[item.id]
            if (!response) return false
            if (response.score === -1 || response.score === undefined || response.score === null) return false
            if (item.is_photo_required) {
                const uploaded = (response.photo_urls?.length || 0)
                const minRequired = item.min_photos || 1
                if (uploaded < minRequired) return false
            }
        }
        return true
    }, [checklistResponses, requiredChecklist?.items])

    const [shiftReceipts, setShiftReceipts] = useState<ShiftReceipt[]>([])
    const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null)

    // FIX #1: SSE для обновления чеков в реальном времени
    const handleSSEMessage = useCallback((message: any) => {
        if (message.type === 'RECEIPT_CREATED' || message.type === 'RECEIPT_VOIDED' || message.type === 'RECEIPT_ITEM_RETURNED') {
            // Обновляем чеки при создании/аннулировании
            if (activeShiftId) {
                getShiftReceipts(clubId, userId, String(activeShiftId), { includeVoided: true })
                    .then(setShiftReceipts)
                    .catch(console.error)
            }
        }
    }, [activeShiftId, clubId, userId])

    const { isConnected } = useSSE(handleSSEMessage)

    // Check for available daily payout
    useEffect(() => {
        if (isOpen && activeShiftId) {
            fetch(`/api/employee/shifts/${activeShiftId}/indicators`)
                .then(res => res.json())
                .then(data => {
                    // Assuming the API returns something like { instant_payout: 1500 }
                    // We need to implement this calculation on backend or use existing data
                    // For now, let's assume we get 'projected_instant_payout'
                    if (data.projected_instant_payout > 0) {
                        setPayoutSuggestion({ 
                            amount: data.projected_instant_payout, 
                            isAvailable: true 
                        })
                    }
                })
                .catch(console.error)
        }
    }, [isOpen, activeShiftId])

    // Persistence key
    const persistenceKey = `shift_closing_${activeShiftId}`

    // Calculate Sales Summary for Preview
    const salesPreview = useMemo(() => {
        if (isShiftSalesMode) {
            return buildShiftSalesPreview(shiftReceipts, unaccountedSales)
        }

        const standardSales = inventoryItems
            .filter(i => i.actual_stock !== null && (i.expected_stock || 0) > (i.actual_stock || 0))
            .map(i => ({
                id: i.id,
                name: i.product_name,
                qty: (i.expected_stock || 0) - (i.actual_stock || 0),
                price: i.selling_price_snapshot,
                total: ((i.expected_stock || 0) - (i.actual_stock || 0)) * i.selling_price_snapshot,
                isUnaccounted: false
            }))

        const manualSales = unaccountedSales.map(s => ({
            id: s.product_id,
            name: s.name,
            qty: s.quantity,
            price: s.selling_price,
            total: s.quantity * s.selling_price,
            isUnaccounted: true
        }))

        return [...standardSales, ...manualSales]
    }, [inventoryItems, unaccountedSales, shiftReceipts, isShiftSalesMode])

    const totalSalesRevenue = salesPreview.reduce((acc, s) => acc + s.total, 0)

    // Forgotten items (all items with actual_stock === null)
    const forgottenItems = useMemo(() => {
        return inventoryItems.filter(i => i.actual_stock === null)
    }, [inventoryItems])

    const discrepancyItems = useMemo(() => {
        return inventoryItems
            .filter(item => item.actual_stock !== null)
            .map(item => {
                const expected = Number(item.expected_stock || 0)
                const actual = Number(item.actual_stock || 0)
                const difference = actual - expected

                return {
                    id: item.id,
                    product_name: item.product_name,
                    expected_stock: expected,
                    actual_stock: actual,
                    difference,
                    value: Math.abs(difference) * Number(item.selling_price_snapshot || 0)
                }
            })
            .filter(item => item.difference !== 0)
            .sort((a, b) => {
                if (Math.sign(a.difference) !== Math.sign(b.difference)) return a.difference - b.difference
                if (Math.abs(a.difference) !== Math.abs(b.difference)) return Math.abs(b.difference) - Math.abs(a.difference)
                return a.product_name.localeCompare(b.product_name)
            })
    }, [inventoryItems])

    const shortageDiscrepancyItems = useMemo(
        () => discrepancyItems.filter(item => item.difference < 0),
        [discrepancyItems]
    )

    const excessDiscrepancyItems = useMemo(
        () => discrepancyItems.filter(item => item.difference > 0),
        [discrepancyItems]
    )

    const hasInventoryMismatch = usesShiftInventoryReconciliation && inventorySummary?.isPerfect === false
    const isBlindClosingInventory = !isStartShiftMode && usesInventoryCounting

    const revenueKey = inventorySettings?.employee_default_metric_key || null

    const reportedRevenueValue = useMemo(() => {
        if (!revenueKey) return 0
        const raw = reportData[revenueKey] ?? 0
        const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw))
        return Number.isFinite(parsed) ? parsed : 0
    }, [reportData, revenueKey])

    const reconcileSnapshot = useMemo(() => {
        return {
            reported: reportedRevenueValue,
            calculated: totalSalesRevenue,
            diff: reportedRevenueValue - totalSalesRevenue
        }
    }, [reportedRevenueValue, totalSalesRevenue])

    const headerTitle = useMemo(() => {
        if (isStartShiftMode) {
            return step === 1 ? "Стартовая инвентаризация" : "Подтверждение инвентаризации"
        }
        if (step === 1) return "Финансовый отчет"
        if (usesSalesReconciliation && step === 2) return "Сверка продаж"
        if (step === inventoryStep) return "Ревизия товаров"
        return "Сверка итогов"
    }, [inventoryStep, isStartShiftMode, step, usesSalesReconciliation])

    const primaryStepOneLabel = useMemo(() => {
        if (skipInventory) return "Завершить смену"
        if (usesSalesReconciliation) return "Далее: Сверка продаж"
        return "Далее: Ревизия"
    }, [skipInventory, usesSalesReconciliation])

    const inventoryNextLabel = useMemo(() => {
        if (isStartShiftMode) return "Далее: Подтверждение"
        return "Далее"
    }, [isStartShiftMode])

    const reconcileNextLabel = useMemo(() => {
        if (skipInventory) return "Завершить смену"
        return "Далее: Ревизия"
    }, [skipInventory])

    const stepOneMissingFields = useMemo(() => {
        const requiredFields = reportTemplate?.schema
            ?.filter((f: any) => f.is_required)
            ?.map((f: any) => f.metric_key) || []
        return requiredFields.filter((key: string) => !hasReportValue(reportData[key]))
    }, [reportData, reportTemplate?.schema])

    const canProceedFromStep1 = useMemo(() => {
        if (stepOneMissingFields.length > 0) return false
        if (requiredChecklist?.items?.length && !isRequiredChecklistComplete) return false
        if (!isStartShiftMode && usesSalesReconciliation && !revenueKey) return false
        return true
    }, [isRequiredChecklistComplete, isStartShiftMode, requiredChecklist?.items?.length, revenueKey, stepOneMissingFields.length, usesSalesReconciliation])

    const stepOneBlockReasons = useMemo(() => {
        const reasons: string[] = []
        if (stepOneMissingFields.length > 0) {
            const schema = Array.isArray(reportTemplate?.schema) ? reportTemplate.schema : []
            const labels = stepOneMissingFields.map((key: string) => {
                const field = schema.find((f: any) => f?.metric_key === key)
                const label = field?.custom_label || field?.metric_key || key
                return String(label)
            })
            reasons.push(`Заполните поля: ${labels.join(", ")}`)
        }
        if (requiredChecklist?.items?.length && !isRequiredChecklistComplete) {
            reasons.push("Пройдите чеклист")
        }
        if (!isStartShiftMode && usesSalesReconciliation && !revenueKey) {
            reasons.push("В настройках склада не выбрана метрика выручки")
        }
        return reasons
    }, [isRequiredChecklistComplete, isStartShiftMode, reportTemplate?.schema, requiredChecklist?.items?.length, revenueKey, stepOneMissingFields, usesSalesReconciliation])

    const shiftCommentRequired = useMemo(() => {
        if (isStartShiftMode) return false
        if (usesSalesReconciliation && step === 2) return reconcileSnapshot.diff !== 0
        if (step === finalizeStep && calculationResult) return calculationResult.diff !== 0
        return false
    }, [calculationResult, finalizeStep, isStartShiftMode, reconcileSnapshot.diff, step, usesSalesReconciliation])

    const hasShiftComment = useMemo(() => {
        const raw = reportData['shift_comment']
        return typeof raw === 'string' ? raw.trim().length > 0 : Boolean(raw)
    }, [reportData])

    const canProceedFromReconcile = useMemo(() => {
        if (!usesSalesReconciliation) return false
        if (isPending) return false
        if (shiftCommentRequired && !hasShiftComment) return false
        return true
    }, [hasShiftComment, isPending, shiftCommentRequired, usesSalesReconciliation])

    const reconcileBlockReason = useMemo(() => {
        if (!usesSalesReconciliation) return null
        if (isPending) return "Идёт обработка…"
        if (shiftCommentRequired && !hasShiftComment) return "Укажите причину расхождения"
        return null
    }, [hasShiftComment, isPending, shiftCommentRequired, usesSalesReconciliation])

    const canFinalizeShift = useMemo(() => {
        if (isStartShiftMode) return true
        if (!inventoryId || !calculationResult) return false
        if (forgottenItems.length > 0) return false
        if (shiftCommentRequired && !hasShiftComment) return false
        return !isPending
    }, [calculationResult, forgottenItems.length, hasShiftComment, inventoryId, isPending, isStartShiftMode, shiftCommentRequired])

    const finalizeBlockReason = useMemo(() => {
        if (isStartShiftMode) return null
        if (isPending) return "Идёт обработка…"
        if (!inventoryId || !calculationResult) return "Нет данных для завершения"
        if (forgottenItems.length > 0) return `Не посчитано товаров: ${forgottenItems.length}`
        if (shiftCommentRequired && !hasShiftComment) return "Укажите причину расхождения"
        return null
    }, [calculationResult, forgottenItems.length, hasShiftComment, inventoryId, isPending, isStartShiftMode, shiftCommentRequired])

    const finalizeSummary = useMemo(() => {
        if (!calculationResult) return null

        if (isStartShiftMode) {
            const hasMismatch = inventorySummary?.isPerfect === false
            return {
                tone: hasMismatch ? "warning" : "success",
                title: hasMismatch ? "Стартовая инвентаризация завершена с расхождениями" : "Стартовая инвентаризация завершена",
                value: `${inventorySummary?.discrepancyQuantity ?? 0} шт.`,
                description: hasMismatch
                    ? "На старте смены найдены расхождения по остаткам. Проверь подтверждение перед продолжением работы."
                    : "Остатки на старте смены подтверждены. Можно продолжать работу."
            }
        }

        if (usesSalesReconciliation) {
            if (calculationResult.diff === 0 && !hasInventoryMismatch) {
                return {
                    tone: "success",
                    title: "Касса и продажи сходятся",
                    value: "0 ₽",
                    description: usesShiftInventoryReconciliation
                        ? "По кассе и по итогам ревизии расхождений не найдено."
                        : "По кассе и продажам расхождений не найдено."
                }
            }

            if (calculationResult.diff === 0 && hasInventoryMismatch) {
                return {
                    tone: "warning",
                    title: "Касса сходится, но по товару есть расхождения",
                    value: `${inventorySummary?.discrepancyQuantity ?? 0} шт.`,
                    description: "Продажи по смене сошлись, но ревизия нашла расхождения по остаткам."
                }
            }

            return {
                tone: calculationResult.diff > 0 ? "warning" : "danger",
                title: calculationResult.diff > 0 ? "Обнаружен излишек по кассе" : "Обнаружена недостача по кассе",
                value: `${calculationResult.diff > 0 ? '+' : ''}${calculationResult.diff.toLocaleString()} ₽`,
                description: calculationResult.diff > 0
                    ? "Денег в кассе больше, чем по пробитым товарам. Проверьте неучтенные продажи и сторно."
                    : "Денег в кассе меньше, чем по пробитым товарам. Проверьте возвраты, сторно и корректность отчета."
            }
        }

        if (calculationResult.diff === 0) {
            return {
                tone: "success",
                title: "Смена сходится",
                value: "0 ₽",
                description: "Данные по складу полностью соответствуют сумме в кассе."
            }
        }

        return {
            tone: calculationResult.diff > 0 ? "warning" : "danger",
            title: calculationResult.diff > 0 ? "Обнаружен излишек" : "Обнаружена недостача",
            value: `${calculationResult.diff > 0 ? '+' : ''}${calculationResult.diff.toLocaleString()} ₽`,
            description: calculationResult.diff > 0
                ? "Денег в кассе больше, чем проданного товара. Возможно, не указана часть продаж."
                : "Денег в кассе меньше, чем должно быть по остаткам склада. Проверьте правильность подсчета."
        }
    }, [calculationResult, hasInventoryMismatch, inventorySummary, isStartShiftMode, usesSalesReconciliation, usesShiftInventoryReconciliation])

    useEffect(() => {
        if (!isOpen) return
        if (!isShiftSalesMode) return
        if (step !== 2) return
        if (!usesSalesReconciliation) return

        const shiftIdStr = String(activeShiftId)
        startTransition(async () => {
            try {
                const receipts = await getShiftReceipts(clubId, userId, shiftIdStr, { includeVoided: true })
                setShiftReceipts(receipts)
            } catch (e) {
                console.error(e)
            }
        })
    }, [isOpen, isShiftSalesMode, step, clubId, userId, activeShiftId])

    // Lock scroll when open
    useEffect(() => {
        setIsPortalReady(true)
        return () => setIsPortalReady(false)
    }, [])

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

    // Load persisted state
    useEffect(() => {
        if (isOpen && activeShiftId) {
            const saved = localStorage.getItem(persistenceKey)
            if (saved) {
                try {
                    const data = JSON.parse(saved)
                    const rawStep = Number(data.step || 1)
                    const nextStep =
                        !isStartShiftMode && !usesSalesReconciliation && rawStep === 2
                            ? 1
                            : rawStep
                    setStep(nextStep as 1 | 2 | 3 | 4)
                    setReportData(data.reportData || {})
                    setInventoryId(data.inventoryId || null)
                    // Auto-count items with expected_stock = 0 when restoring
                    const restoredItems = (data.inventoryItems || []).map((i: any) => ({
                        ...i,
                        actual_stock: (i.expected_stock || 0) === 0 ? 0 : i.actual_stock
                    }))
                    setInventoryItems(restoredItems)
                    setChecklistResponses(data.checklistResponses || {})
                    setProblematicItems(data.problematicItems || {})
                    setCalculationResult(data.calculationResult || null)
                    setInventorySummary(data.inventorySummary || null)
                    setUnaccountedSales(data.unaccountedSales || [])
                    setShiftReceipts(data.shiftReceipts || [])
                    console.log('Restored state from localStorage')
                } catch (e) {
                    console.error('Failed to parse saved state', e)
                }
            }
        }
    }, [isOpen, activeShiftId, isStartShiftMode, persistenceKey, usesSalesReconciliation])

    useEffect(() => {
        if (!isOpen || !isStartShiftMode) return
        const savedState = localStorage.getItem(persistenceKey)
        if (savedState) return
        setStep(1)
        startInventory()
    }, [isOpen, isStartShiftMode, persistenceKey])

    // Save state on changes
    useEffect(() => {
        if (isOpen && activeShiftId) {
            const stateToSave = {
                step,
                reportData,
                inventoryId,
                inventoryItems,
                checklistResponses,
                problematicItems,
                calculationResult,
                inventorySummary,
                unaccountedSales,
                shiftReceipts
            }
            localStorage.setItem(persistenceKey, JSON.stringify(stateToSave))
        }
    }, [step, reportData, inventoryId, inventoryItems, checklistResponses, problematicItems, calculationResult, inventorySummary, unaccountedSales, isOpen, activeShiftId, persistenceKey])

    useEffect(() => {
        if (!isOpen || !inventoryId || step !== inventoryStep) return

        const snapshot = JSON.stringify(
            inventoryItems
                .map(item => ({ id: item.id, actual_stock: item.actual_stock }))
                .sort((a, b) => a.id - b.id)
        )

        if (snapshot === lastAutosavedSnapshotRef.current) return

        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current)
        }

        autosaveTimeoutRef.current = setTimeout(() => {
            const itemsToSave = inventoryItems
                .map(item => ({ id: item.id, actual_stock: item.actual_stock }))

            startTransition(async () => {
                try {
                    const result = await bulkUpdateInventoryItemsSafe(itemsToSave, clubId)
                    if (!result.ok) {
                        console.error('Failed to autosave inventory progress:', result.error)
                        return
                    }
                    lastAutosavedSnapshotRef.current = snapshot
                } catch (error) {
                    console.error('Failed to autosave inventory progress:', error)
                }
            })
        }, 500)

        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current)
            }
        }
    }, [clubId, inventoryId, inventoryItems, inventoryStep, isOpen, step])

    // Reset state only if NO saved data exists when opening
    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem(persistenceKey)
            if (!saved) {
                console.log('Wizard opened, no saved state, initializing')
                setReportData({})
                setInventoryId(null)
                setInventoryItems([])
                setCalculationResult(null)
                setInventorySummary(null)
                setChecklistResponses({})
                setProblematicItems({})
                setScannedItemId(null)
                setUnaccountedSales([])
                setShiftReceipts([])
                
                const mandatory = checklistTemplates?.find((t: any) => 
                    t.type === 'shift_handover' && t.settings?.block_shift_close
                )
                
                if (mandatory) {
                    setRequiredChecklist(mandatory)
                } else {
                    setRequiredChecklist(null)
                }
                setStep(1)
            } else {
                // If saved, still need to set requiredChecklist for the UI
                const mandatory = checklistTemplates?.find((t: any) => 
                    t.type === 'shift_handover' && t.settings?.block_shift_close
                )
                if (mandatory) setRequiredChecklist(mandatory)
            }

            // Fetch workstations
            if (clubId) {
                fetch(`/api/clubs/${clubId}/workstations`)
                    .then(res => res.json())
                    .then(data => {
                        if (Array.isArray(data)) {
                            setWorkstations(data)
                        }
                    })
                    .catch(console.error)
            }
        }
    }, [isOpen])

    const handleStep1Submit = () => {
        if (stepOneMissingFields.length > 0) {
            notifyInfo(`Заполните обязательные поля отчета`, "Проверьте данные")
            return
        }

        if (requiredChecklist?.items?.length && !isRequiredChecklistComplete) {
            notifyInfo("Пройдите чеклист перед закрытием смены", "Чеклист обязателен")
            setIsChecklistWizardOpen(true)
            return
        }

        if (!isStartShiftMode && usesSalesReconciliation && !revenueKey) {
            notifyError("В настройках склада не выбрана метрика выручки по умолчанию. Без нее нельзя включить сверку итогов.", "Настройте метрику")
            return
        }

        if (skipInventory && !usesSalesReconciliation) {
            onFinalComplete()
            return
        }

        if (usesSalesReconciliation) {
            setStep(2)
            return
        }

        setStep(inventoryStep)
        startInventory()
    }

    const onFinalComplete = () => {
        localStorage.removeItem(persistenceKey)
        onComplete({ ...reportData, checklistResponses, checklistId: requiredChecklist?.id })
    }

    const handleChecklistChange = (itemId: number, score: number) => {
        setChecklistResponses(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], score }
        }))
    }

    const handlePhotoUpload = async (itemId: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return
        setUploadingState(prev => ({ ...prev, [itemId]: true }))
        try {
            const uploadPromises = Array.from(files).map(async (file) => {
                const optimizedFile = await optimizeFileBeforeUpload(file)
                const formData = new FormData()
                formData.append('file', optimizedFile)
                const res = await fetch('/api/upload', { method: 'POST', body: formData })
                if (!res.ok) throw new Error('Upload failed')
                const data = await res.json()
                return data.url
            })
            const urls = await Promise.all(uploadPromises)
            setChecklistResponses(prev => ({
                ...prev,
                [itemId]: { 
                    ...prev[itemId], 
                    photo_urls: [...(prev[itemId]?.photo_urls || []), ...urls]
                }
            }))
        } catch (error) {
            console.error('Failed to upload file:', error)
            notifyError('Не удалось загрузить фото', "Ошибка загрузки")
        } finally {
            setUploadingState(prev => ({ ...prev, [itemId]: false }))
        }
    }

    const removePhoto = (itemId: number, urlToRemove: string) => {
        setChecklistResponses(prev => ({
            ...prev,
            [itemId]: { 
                ...prev[itemId], 
                photo_urls: (prev[itemId]?.photo_urls || []).filter(url => url !== urlToRemove)
            }
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
                    ...r[itemId],
                    score: newScore,
                    selected_workstations: workstationNames
                }
            }))
            
            return { ...prev, [itemId]: newItems }
        })
    }

    const startInventory = () => {
        // If inventoryId already exists (from persistence), don't restart
        if (inventoryId) {
            console.log('Restoring existing inventory:', inventoryId)
            return
        }

        startTransition(async () => {
            try {
                const targetMetric = inventorySettings?.employee_default_metric_key
                if (!targetMetric) {
                    notifyError("В настройках склада не выбрана метрика выручки по умолчанию.", "Настройте метрику")
                    return
                }

                const allowedWarehouseId =
                    inventorySettings?.handover_warehouse_id ||
                    inventorySettings?.cashbox_warehouse_id ||
                    null

                console.log('Starting inventory:', { targetMetric, allowedWarehouseId })
                
                const inventoryResult = await createInventorySafe(
                    clubId, 
                    userId, 
                    targetMetric, 
                    null, // categoryId
                    allowedWarehouseId,
                    activeShiftId.toString() // Pass shiftId
                )
                if (!inventoryResult.ok) {
                    notifyError(inventoryResult.error)
                    return
                }
                const newInvId = inventoryResult.inventoryId
                
                setInventoryId(newInvId)
                const items = await getInventoryItems(newInvId)

                // If blind inventory is enabled, we start with an empty list for the UI
                // but the items exist in state. We'll only show them once scanned/added.
                // Auto-count items with expected_stock = 0 (no need to manually enter 0)
                setInventoryItems(items.map(i => ({
                    ...i,
                    is_visible: false,
                    actual_stock: (i.expected_stock || 0) === 0 ? 0 : i.actual_stock
                })))
            } catch (e) {
                console.error('Failed to start inventory:', e)
                notifyError("Ошибка запуска инвентаризации")
            }
        })
    }

    const handleBarcodeScan = useCallback(async (barcode: string) => {
        // 1. First, check our local list (might have stale barcodes)
        const item = inventoryItems.find(i => 
            i.barcode === barcode || 
            (i.barcodes && i.barcodes.includes(barcode))
        )
        
        if (item) {
            setInventoryItems(prev => prev.map(i => {
                if (i.id === item.id) {
                    const currentStock = i.actual_stock || 0
                    return { ...i, actual_stock: currentStock + 1, is_visible: true, last_modified: Date.now() }
                }
                return i
            }))
            setScannedItemId(item.id)
            return true
        }

        // 2. Not in local list with this barcode? Check the server (Admin might have added a barcode)
        try {
            const product = await getProductByBarcode(clubId, barcode)
            if (product) {
                // Is this product already in our inventory list?
                const existingInList = inventoryItems.find(i => i.product_id === product.id)
                
                if (existingInList) {
                    // It's already here! Just the barcode was new. Update the item's barcodes and count it.
                    setInventoryItems(prev => prev.map(i => {
                        if (i.product_id === product.id) {
                            const currentStock = i.actual_stock || 0
                            return { 
                                ...i, 
                                actual_stock: currentStock + 1, 
                                is_visible: true, 
                                last_modified: Date.now(),
                                barcode: product.barcode, // Sync fresh barcodes
                                barcodes: product.barcodes 
                            }
                        }
                        return i
                    }))
                    setScannedItemId(existingInList.id)
                    return true
                }

                // If truly not in list, add it
                const currentCounts = inventoryItems.reduce((acc, i) => {
                    if (i.actual_stock !== null) acc[i.id] = i.actual_stock
                    return acc
                }, {} as Record<number, number>)

                const addResult = await addProductToInventorySafe(inventoryId!, product.id)
                if (!addResult.ok) {
                    notifyError(addResult.error)
                    return false
                }
                const invItems = await getInventoryItems(inventoryId!)
                
                setInventoryItems(invItems.map(i => {
                    const isNew = i.product_id === product.id
                    const oldItem = inventoryItems.find(old => old.id === i.id)
                    return { 
                        ...i, 
                        actual_stock: isNew ? 1 : (currentCounts[i.id] ?? i.actual_stock),
                        is_visible: isNew ? true : oldItem?.is_visible || false,
                        last_modified: isNew ? Date.now() : oldItem?.last_modified
                    }
                }))
                const newItem = invItems.find(i => i.product_id === product.id)
                if (newItem) setScannedItemId(newItem.id)
                return true
            } else {
                return false
            }
        } catch (e) {
            console.error(e)
            return false
        }
    }, [inventoryItems, clubId, inventoryId])

    const handleAddProductManually = async (productId?: number) => {
        const idToAdd = productId || Number(selectedProductToAdd)
        if (!idToAdd) return

        startTransition(async () => {
            try {
                // Keep track of current counts before re-fetching
                const currentCounts = inventoryItems.reduce((acc, i) => {
                    if (i.actual_stock !== null) acc[i.id] = i.actual_stock
                    return acc
                }, {} as Record<number, number>)

                const addResult = await addProductToInventorySafe(inventoryId!, idToAdd)
                if (!addResult.ok) {
                    notifyError(addResult.error)
                    return
                }
                const invItems = await getInventoryItems(inventoryId!)
                
                setInventoryItems(invItems.map(i => {
                    const isNew = i.product_id === idToAdd
                    const oldItem = inventoryItems.find(old => old.id === i.id)
                    return { 
                        ...i, 
                        actual_stock: isNew ? (currentCounts[i.id] ?? 1) : (currentCounts[i.id] ?? i.actual_stock),
                        is_visible: isNew ? true : oldItem?.is_visible || false,
                        last_modified: isNew ? Date.now() : oldItem?.last_modified
                    }
                }))
                
                const newItem = invItems.find(i => i.product_id === idToAdd)
                if (newItem) setScannedItemId(newItem.id)
                
                setIsAddDialogOpen(false)
                setSelectedProductToAdd("")
            } catch (e: any) {
                notifyError(e.message)
            }
        })
    }

    const openAddDialog = async () => {
        setIsAddDialogOpen(true)
        refreshProductCatalog()
    }

    const refreshInventoryList = async () => {
        if (!inventoryId) return
        startTransition(async () => {
            try {
                const items = await getInventoryItems(inventoryId)
                // Merge with current counts to not lose unsaved work
                setInventoryItems(prev => items.map(newItem => {
                    const existing = prev.find(p => p.id === newItem.id)
                    return {
                        ...newItem,
                        actual_stock: existing?.actual_stock ?? newItem.actual_stock,
                        is_visible: existing?.is_visible ?? (newItem.actual_stock !== null),
                        last_modified: existing?.last_modified
                    }
                }))
            } catch (e) {
                console.error('Failed to refresh inventory list', e)
            }
        })
    }

    const refreshProductCatalog = async () => {
        setIsRefreshingCatalog(true)
        try {
            const products = await getProducts(clubId)
            setAllProducts(products.map(p => ({ 
                id: p.id, 
                name: p.name,
                barcode: p.barcode,
                barcodes: p.barcodes,
                // @ts-ignore
                selling_price: p.selling_price,
                // @ts-ignore
                cost_price: p.cost_price
            })))
        } catch (e) {
            console.error('Failed to refresh products', e)
        } finally {
            setIsRefreshingCatalog(false)
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
    const handleRemoveItem = (itemId: number) => {
        setInventoryItems(prev => prev.map(i => {
            if (i.id === itemId) {
                return { ...i, actual_stock: null, is_visible: false }
            }
            return i
        }))
    }

    const inventoryWorkspaceItems = useMemo<StockCountWorkspaceItem[]>(() => {
        return inventoryItems
            .filter(item => item.is_visible)
            .map((item) => ({
                id: String(item.id),
                groupId: "inventory",
                groupLabel: "Текущий пересчет",
                productId: item.product_id,
                productName: item.product_name,
                barcode: item.barcode,
                barcodes: item.barcodes,
                systemQuantity: Number(item.expected_stock || 0),
                countedQuantity: item.actual_stock,
                sellingPrice: Number(item.selling_price_snapshot || 0),
                removable: true
            }))
    }, [inventoryItems])

    const handleInventoryWorkspaceChange = useCallback((nextItems: StockCountWorkspaceItem[]) => {
        setInventoryItems((prev) => prev.map((item) => {
            const next = nextItems.find((candidate) => candidate.id === String(item.id))
            if (!next) return item
            return {
                ...item,
                actual_stock: next.countedQuantity,
                is_visible: next.countedQuantity !== null ? true : item.is_visible,
                last_modified: next.countedQuantity !== item.actual_stock ? Date.now() : item.last_modified
            }
        }))
    }, [])

    const handleReconcileNext = () => {
        if (!isShiftSalesMode) return
        const shiftIdStr = String(activeShiftId)

        startTransition(async () => {
            try {
                // FIX: Sales are already committed in real-time, no need to commit
                if (unaccountedSales.length > 0) {
                    const receiptResult = await createShiftReceiptSafe(clubId, userId, {
                        shift_id: shiftIdStr,
                        payment_type: 'other',
                        items: unaccountedSales.map(s => ({ product_id: s.product_id, quantity: s.quantity })),
                        notes: "Ручная продажа при закрытии смены"
                    })
                    if (!receiptResult.ok) {
                        notifyError(receiptResult.error)
                        return
                    }
                    setUnaccountedSales([])
                }

                // Sales already committed in real-time, just fetch for display
                const receipts = await getShiftReceipts(clubId, userId, shiftIdStr, { includeVoided: true })
                setShiftReceipts(receipts)
                const nextSalesPreview = buildShiftSalesPreview(receipts, [])
                const nextCalculatedRevenue = nextSalesPreview.reduce((acc, sale) => acc + sale.total, 0)

                setCalculationResult({
                    reported: reportedRevenueValue,
                    calculated: nextCalculatedRevenue,
                    diff: reportedRevenueValue - nextCalculatedRevenue
                })

                if (skipInventory) {
                    onFinalComplete()
                    return
                }

                setStep(inventoryStep)
                startInventory()
            } catch (e: any) {
                console.error(e)
                notifyError(e?.message || "Ошибка сверки продаж")
            }
        })
    }

    const handleInventorySubmit = () => {
        startTransition(async () => {
            try {
                // Save all items first using bulk update
                const itemsToUpdate = inventoryItems
                    .filter(item => item.actual_stock !== null)
                    .map(item => ({ id: item.id, actual_stock: item.actual_stock }))
                
                if (itemsToUpdate.length > 0) {
                    const saveResult = await bulkUpdateInventoryItemsSafe(itemsToUpdate, clubId)
                    if (!saveResult.ok) {
                        notifyError(saveResult.error)
                        return
                    }
                }

                if (isStartShiftMode) {
                    const refreshedItems = inventoryId ? await getInventoryItems(inventoryId) : inventoryItems
                    const mergedItems = refreshedItems.map(item => {
                        const existing = inventoryItems.find(current => current.id === item.id)
                        return {
                            ...item,
                            actual_stock: existing?.actual_stock ?? item.actual_stock,
                            is_visible: existing?.is_visible ?? (item.actual_stock !== null),
                            last_modified: existing?.last_modified
                        }
                    })
                    setInventoryItems(mergedItems)
                    setInventorySummary(summarizeInventory(mergedItems))
                    setCalculationResult({
                        reported: 0,
                        calculated: 0,
                        diff: 0
                    })
                    setStep(finalizeStep)
                    return
                }

                if (usesSalesReconciliation) {
                    const refreshedItems = inventoryId ? await getInventoryItems(inventoryId) : inventoryItems
                    const mergedItems = refreshedItems.map(item => {
                        const existing = inventoryItems.find(current => current.id === item.id)
                        return {
                            ...item,
                            actual_stock: existing?.actual_stock ?? item.actual_stock,
                            is_visible: existing?.is_visible ?? (item.actual_stock !== null),
                            last_modified: existing?.last_modified
                        }
                    })
                    setInventoryItems(mergedItems)
                    setInventorySummary(summarizeInventory(mergedItems))

                    const receipts = await getShiftReceipts(clubId, userId, String(activeShiftId), { includeVoided: true })
                    setShiftReceipts(receipts)
                    const nextSalesPreview = buildShiftSalesPreview(receipts, [])
                    const nextCalculatedRevenue = nextSalesPreview.reduce((acc, sale) => acc + sale.total, 0)
                    setCalculationResult({
                        reported: reportedRevenueValue,
                        calculated: nextCalculatedRevenue,
                        diff: reportedRevenueValue - nextCalculatedRevenue
                    })
                    setStep(finalizeStep)
                    return
                }

                // Calculate total revenue (Standard Sales + Unaccounted Sales)
                const standardCalculatedRev = inventoryItems.reduce((acc, item) => {
                    if (item.actual_stock !== null && (item.expected_stock || 0) > (item.actual_stock || 0)) {
                        const sold = (item.expected_stock || 0) - item.actual_stock
                        return acc + (sold * item.selling_price_snapshot)
                    }
                    return acc
                }, 0)

                const unaccountedRev = unaccountedSales.reduce((acc, s) => acc + (s.quantity * s.selling_price), 0)
                const totalCalculatedRev = standardCalculatedRev + unaccountedRev

                const reportedRev = reportedRevenueValue

                setCalculationResult({
                    reported: reportedRev,
                    calculated: totalCalculatedRev,
                    diff: reportedRev - totalCalculatedRev
                })

                setStep(finalizeStep)
            } catch (e) {
                console.error('Error saving inventory:', e)
                notifyError("Ошибка сохранения подсчетов")
            }
        })
    }

    // Step 3: Finalize
    const handleFinalize = () => {
        if (!inventoryId || !calculationResult) return
        
        // Prevent finalize if there are uncounted items
        if (forgottenItems.length > 0) {
            notifyInfo(`Вы не посчитали ${forgottenItems.length} товаров. Укажите их остаток (даже если 0), чтобы закрыть смену.`, "Инвентаризация не завершена")
            setStep(inventoryStep) // Return to inventory
            return
        }

        startTransition(async () => {
                try {
                    if (isStartShiftMode) {
                        const result = await closeInventorySafe(inventoryId, clubId, 0, [], { salesRecognition: 'NONE' })
                        if (!result.ok) {
                            notifyError(`Ошибка завершения: ${result.error}`)
                            return
                        }
                    } else if (usesSalesReconciliation) {
                        const result = await closeInventorySafe(inventoryId, clubId, calculationResult.reported, [], { salesRecognition: 'NONE' })
                        if (!result.ok) {
                            notifyError(`Ошибка завершения: ${result.error}`)
                            return
                        }
                    } else {
                        const result = await closeInventorySafe(
                            inventoryId,
                            clubId,
                            calculationResult.reported,
                        unaccountedSales.map(s => ({
                            product_id: s.product_id,
                            quantity: s.quantity,
                            selling_price: s.selling_price,
                            cost_price: s.cost_price
                        }))
                        )
                        if (!result.ok) {
                            notifyError(`Ошибка завершения: ${result.error}`)
                            return
                        }
                }
                
                // Complete shift closing
                onFinalComplete()
            } catch (e: any) {
                console.error('Error closing inventory:', e)
                notifyError(`Ошибка завершения: ${e.message || 'Неизвестная ошибка'}`)
            }
        })
    }

    const removeUnaccountedSale = (productId: number) => {
        setUnaccountedSales(prev => prev.filter(s => s.product_id !== productId))
    }

    const addUnaccountedSale = () => {
        const product = allProducts.find(p => p.id === Number(selectedUnaccountedProduct))
        if (!product || !unaccountedQty) return

        const quantity = Number(unaccountedQty)
        if (!Number.isInteger(quantity) || quantity <= 0) {
            notifyInfo("Количество должно быть целым положительным числом", "Проверьте данные")
            return
        }

        // Check if already in standard inventory (just in case, though they should be separate)
        const inInventory = inventoryItems.some(i => i.product_id === product.id)
        if (inInventory) {
            notifyInfo("Этот товар уже есть в списке инвентаризации. Просто укажите его остаток там.", "Товар уже добавлен")
            setIsUnaccountedDialogOpen(false)
            return
        }

        setUnaccountedSales(prev => {
            const existing = prev.find(sale => sale.product_id === product.id)
            if (existing) {
                return prev.map(sale =>
                    sale.product_id === product.id
                        ? { ...sale, quantity: sale.quantity + quantity }
                        : sale
                )
            }
            return [
                ...prev,
                {
                    product_id: product.id,
                    name: product.name,
                    quantity,
                    // @ts-ignore
                    selling_price: product.selling_price || 0,
                    // @ts-ignore
                    cost_price: product.cost_price || 0
                }
            ]
        })
        setSelectedUnaccountedProduct("")
        setUnaccountedQty("1")
        setIsUnaccountedDialogOpen(false)
    }

    const markAllForgottenAsZero = async () => {
        const confirmed = await confirmAction({
            title: "Подтвердите действие",
            description: `Установить остаток 0 для всех ${forgottenItems.length} нераспределенных товаров? Это зафиксирует недостачу.`,
            confirmText: "Установить 0",
            cancelText: "Отмена"
        })
        if (!confirmed) return

        const updatedItems = inventoryItems.map(item => {
            if (item.actual_stock === null) {
                return { ...item, actual_stock: 0 }
            }
            return item
        })
        setInventoryItems(updatedItems)
    }

    const handleBack = () => {
        if (step > 1) {
            setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)
        }
    }

    if (!isOpen || !isPortalReady) return null

    return createPortal((
        <div className="fixed inset-0 h-[100dvh] bg-slate-950 text-primary-foreground flex flex-col z-[9999] overflow-hidden overscroll-none">
            <header className="px-4 py-4 border-b border-slate-800 bg-primary/50 backdrop-blur-md sticky top-0 z-50">
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-lg font-bold truncate">{headerTitle}</h2>
                        {!isStartShiftMode ? (
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={onClose} 
                                className="text-muted-foreground/70 hover:text-primary-foreground border-slate-800 hover:bg-primary/90 shrink-0 h-10 w-10 rounded-xl"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        ) : null}
                    </div>
                    
                    {/* Lightweight Step Progress Bar */}
                    {!skipInventory && (
                        <div className="flex gap-1.5 h-1.5 w-full">
                            {Array.from({ length: totalSteps }, (_, idx) => idx + 1).map((i) => (
                                <div 
                                    key={i} 
                                    className={`flex-1 rounded-full ${
                                        i < (step as number) ? 'bg-green-500' : 
                                        i === step ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 
                                        'bg-slate-800'
                                    }`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 py-6">
                {/* STEP 1: REPORT FORM + CHECKLIST */}
                {step === 1 && !isStartShiftMode && (
                    <div className="space-y-6 max-w-2xl mx-auto pb-20">
                        {/* Checklist Section if Required */}
                        {requiredChecklist && (
                            <div className="bg-orange-900/10 border border-orange-900/30 p-4 rounded-xl space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-orange-100/10 p-2 rounded-full">
                                            <CheckCircle2 className="h-5 w-5 text-orange-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-orange-100">Чеклист: {requiredChecklist.name}</h4>
                                            <p className="text-xs text-orange-200/60">Обязательно перед закрытием</p>
                                        </div>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "shrink-0 rounded-full border text-[10px] font-semibold",
                                            isRequiredChecklistComplete
                                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                                : "border-orange-500/30 bg-orange-500/10 text-orange-200"
                                        )}
                                    >
                                        {isRequiredChecklistComplete ? "Пройден" : "Не пройден"}
                                    </Badge>
                                </div>

                                <Button
                                    type="button"
                                    onClick={() => setIsChecklistWizardOpen(true)}
                                    disabled={isRequiredChecklistComplete}
                                    className="h-10 w-full rounded-xl bg-orange-500/20 text-orange-100 hover:bg-orange-500/30 disabled:opacity-40 disabled:pointer-events-none"
                                >
                                    Открыть чеклист
                                </Button>
                            </div>
                        )}

                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                                <div className="h-1 w-4 bg-purple-500 rounded-full" />
                                Финансовый отчет
                            </h3>
                            <div className="grid gap-5">
                                {reportTemplate?.schema.map((field: any, idx: number) => {
                                    const isMissing = stepOneMissingFields.includes(field.metric_key)
                                    return (
                                    <div key={idx} className="space-y-2">
                                        {field.field_type === 'EXPENSE' || field.field_type === 'EXPENSE_LIST' ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-muted-foreground/70 text-xs uppercase tracking-wider ml-1">
                                                        {field.custom_label || field.metric_key}
                                                        {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                                    </Label>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setReportData({
                                                                    ...reportData,
                                                                    [field.metric_key]: '0'
                                                                })
                                                            }}
                                                            className="h-7 text-[10px] text-muted-foreground hover:text-slate-200 hover:bg-slate-700/20"
                                                        >
                                                            Нет расходов
                                                        </Button>
                                                        <Button 
                                                            type="button"
                                                            variant="ghost" 
                                                            size="sm" 
                                                            onClick={() => {
                                                                const currentList = normalizeExpenseEntries(reportData[field.metric_key])
                                                                setReportData({
                                                                    ...reportData,
                                                                    [field.metric_key]: [...currentList, { amount: '', comment: '' }]
                                                                })
                                                            }}
                                                            className="h-7 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-400/10"
                                                        >
                                                            <Plus className="h-3 w-3 mr-1" /> Добавить расход
                                                        </Button>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    {normalizeExpenseEntries(reportData[field.metric_key]).map((item: any, itemIdx: number) => (
                                                        <div key={itemIdx} className="flex gap-2 items-start">
                                                            <div className="flex-1 space-y-2">
                                                                <Input
                                                                    type="number"
                                                                    placeholder="Сумма"
                                                                    className="bg-primary border-slate-800 h-10 rounded-xl focus:ring-2 focus:ring-purple-500"
                                                                    value={item.amount}
                                                                    onChange={(e) => {
                                                                        const newList = [...normalizeExpenseEntries(reportData[field.metric_key])]
                                                                        newList[itemIdx] = { ...newList[itemIdx], amount: e.target.value }
                                                                        setReportData({ ...reportData, [field.metric_key]: newList })
                                                                    }}
                                                                />
                                                                <Input
                                                                    placeholder="На что потрачено?"
                                                                    className="bg-primary border-slate-800 h-10 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                                                                    value={item.comment}
                                                                    onChange={(e) => {
                                                                        const newList = [...normalizeExpenseEntries(reportData[field.metric_key])]
                                                                        newList[itemIdx] = { ...newList[itemIdx], comment: e.target.value }
                                                                        setReportData({ ...reportData, [field.metric_key]: newList })
                                                                    }}
                                                                />
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    const newList = [...normalizeExpenseEntries(reportData[field.metric_key])]
                                                                    newList.splice(itemIdx, 1)
                                                                    setReportData({ ...reportData, [field.metric_key]: newList })
                                                                }}
                                                                className="h-10 w-10 text-muted-foreground hover:text-red-400"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    
                                                    {normalizeExpenseEntries(reportData[field.metric_key]).length === 0 && (
                                                        <div className="text-center py-4 bg-primary/30 border border-dashed border-slate-800 rounded-xl text-muted-foreground text-[10px] uppercase font-bold">
                                                            Расходов не зафиксировано
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <Label className={cn(
                                                    "text-xs uppercase tracking-wider ml-1",
                                                    isMissing ? "text-red-400" : "text-muted-foreground/70"
                                                )}>
                                                    {field.custom_label}
                                                    {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                                </Label>
                                                <Input
                                                    required={field.is_required}
                                                    type={field.metric_key.includes('comment') ? 'text' : 'number'}
                                                    inputMode={field.metric_key.includes('comment') ? 'text' : 'numeric'}
                                                    className={cn(
                                                        "bg-primary h-12 rounded-xl focus:ring-2 transition-all text-lg font-medium",
                                                        isMissing ? "border-red-500 focus:ring-red-500" : "border-slate-800 focus:ring-purple-500"
                                                    )}
                                                    value={reportData[field.metric_key] || ''}
                                                    onChange={(e) => setReportData({ ...reportData, [field.metric_key]: e.target.value })}
                                                />
                                            </>
                                        )}
                                    </div>
                                )})}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2 (SHIFT MODE): RECONCILIATION */}
                {!isStartShiftMode && usesSalesReconciliation && isShiftSalesMode && step === 2 && (
                    <div className="space-y-6 max-w-2xl mx-auto pb-20">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-primary/50 p-4 rounded-2xl border border-slate-800">
                                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Выручка (отчет)</span>
                                <div className="text-xl font-bold mt-1">{reconcileSnapshot.reported.toLocaleString()} ₽</div>
                                <div className="text-[10px] text-muted-foreground mt-1">{revenueKey}</div>
                            </div>
                            <div className="bg-primary/50 p-4 rounded-2xl border border-slate-800">
                                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Продано (пробитое)</span>
                                <div className="text-xl font-bold mt-1 text-blue-400">{reconcileSnapshot.calculated.toLocaleString()} ₽</div>
                            </div>
                        </div>

                        <div className={`p-4 rounded-2xl border flex items-start gap-4 ${
                            reconcileSnapshot.diff === 0 ? 'bg-green-900/10 border-green-900/30 text-green-400' :
                            reconcileSnapshot.diff > 0 ? 'bg-amber-900/10 border-amber-900/30 text-amber-400' :
                            'bg-red-900/10 border-red-900/30 text-red-400'
                        }`}>
                            <div className="mt-0.5">
                                {reconcileSnapshot.diff === 0 ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold flex justify-between items-center">
                                    <span>{reconcileSnapshot.diff === 0 ? "Смена сходится!" : reconcileSnapshot.diff > 0 ? "Обнаружен излишек" : "Обнаружена недостача"}</span>
                                    <span className="text-xl font-black">{reconcileSnapshot.diff > 0 ? '+' : ''}{reconcileSnapshot.diff.toLocaleString()} ₽</span>
                                </div>
                                <p className="text-xs opacity-80 mt-1 leading-relaxed">
                                    {reconcileSnapshot.diff === 0 ? "Сумма в отчете соответствует пробитым товарам." :
                                     reconcileSnapshot.diff > 0 ? "В отчете больше денег, чем по пробитым товарам. Возможно, не пробили часть продаж." :
                                     "В отчете меньше денег, чем по пробитым товарам. Проверьте корректность отчета или пробитий."}
                                </p>
                            </div>
                        </div>

                        <div className="bg-primary/50 rounded-2xl border border-slate-800 overflow-hidden">
                            <div className="px-4 py-3 bg-primary border-b border-slate-800 flex justify-between items-center">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Детализация продаж</h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        refreshProductCatalog()
                                        setIsUnaccountedDialogOpen(true)
                                    }}
                                    className="h-7 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Добавить вручную
                                </Button>
                            </div>
                            <div className="max-h-[320px] overflow-y-auto">
                                {salesPreview.length === 0 ? (
                                    <div className="p-10 text-center text-muted-foreground text-sm">
                                        Продаж не зафиксировано
                                    </div>
                                ) : (
                                    <Table>
                                        <TableBody>
                                            {salesPreview.map((s, idx) => (
                                                <TableRow key={`${s.id}-${idx}`} className="border-slate-800 hover:bg-primary/90/30">
                                                    <TableCell className="py-3">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5">
                                                                {s.isUnaccounted && <span className="bg-blue-500/20 text-blue-400 text-[8px] px-1 rounded uppercase font-bold">Ручн.</span>}
                                                                <span className="text-sm font-medium text-slate-200">{s.name}</span>
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground">{s.qty} шт × {s.price} ₽</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-3 pr-6">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="font-bold text-slate-200">{s.total} ₽</span>
                                                            {s.isUnaccounted && (
                                                                <button
                                                                    onClick={() => removeUnaccountedSale(s.id)}
                                                                    className="p-1 text-muted-foreground hover:text-red-400"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </div>

                        {reconcileSnapshot.diff !== 0 && (
                            <div className="space-y-3">
                                <Label className={cn(
                                    "text-xs uppercase tracking-wider ml-1",
                                    shiftCommentRequired && !hasShiftComment ? "text-red-400" : "text-muted-foreground/70"
                                )}>Причина расхождения</Label>
                                <Input
                                    className={cn(
                                        "bg-primary h-14 rounded-xl focus:ring-2 transition-all text-base",
                                        shiftCommentRequired && !hasShiftComment ? "border-red-500 focus:ring-red-500" : "border-slate-800 focus:ring-blue-500"
                                    )}
                                    placeholder="Укажите причину..."
                                    value={reportData['shift_comment'] || ''}
                                    onChange={(e) => setReportData({ ...reportData, 'shift_comment': e.target.value })}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2/3: INVENTORY */}
                {step === inventoryStep && (
                    <div className="space-y-6 max-w-4xl mx-auto pb-20">
                        <StockCountWorkspace
                            title={isStartShiftMode ? "Стартовый пересчет" : "Пересчет товаров"}
                            description={isStartShiftMode
                                ? "Используйте сканер, поиск и быстрый ввод, чтобы подтвердить остатки на старте смены."
                                : "Используйте сканер, поиск и быстрый ввод для слепой ревизии товаров перед закрытием смены."}
                            items={inventoryWorkspaceItems}
                            onItemsChange={handleInventoryWorkspaceChange}
                            onBarcodeScan={handleBarcodeScan}
                            onRemoveItem={(item) => handleRemoveItem(Number(item.id))}
                            blindMode={isBlindClosingInventory}
                            toolbarActions={
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-slate-700 text-primary-foreground"
                                        onClick={async () => {
                                            await refreshInventoryList()
                                            await refreshProductCatalog()
                                        }}
                                        disabled={isPending || isRefreshingCatalog}
                                    >
                                        <RefreshCcw className={cn("mr-2 h-4 w-4", (isPending || isRefreshingCatalog) && "animate-spin")} />
                                        Синхронизировать
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-slate-700 text-primary-foreground"
                                        onClick={openAddDialog}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Добавить товар
                                    </Button>
                                </>
                            }
                            emptyStateMessage="Список пересчета пуст. Сканируйте товар или добавьте его вручную."
                            discrepancyMessage={isStartShiftMode
                                ? "На следующем шаге система покажет стартовые расхождения по остаткам."
                                : "На следующем шаге система учтет эти расхождения в итогах смены."}
                        />
                    </div>
                )}

                {/* SUMMARY */}
                {step === finalizeStep && calculationResult && (
                    <div className="space-y-6 max-w-2xl mx-auto pb-20">
                        {isStartShiftMode ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-primary/50 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Проверено товаров</span>
                                    <div className="text-xl font-bold mt-1">{inventoryItems.filter(item => item.actual_stock !== null).length}</div>
                                </div>
                                <div className="bg-primary/50 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Расхождений найдено</span>
                                    <div className="text-xl font-bold mt-1 text-blue-400">{inventorySummary?.discrepancyItems ?? 0}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-primary/50 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">В кассе (отчет)</span>
                                    <div className="text-xl font-bold mt-1">{calculationResult.reported.toLocaleString()} ₽</div>
                                </div>
                                <div className="bg-primary/50 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Расчет (склад)</span>
                                    <div className="text-xl font-bold mt-1 text-blue-400">{calculationResult.calculated.toLocaleString()} ₽</div>
                                </div>
                            </div>
                        )}

                        {/* Status Message */}
                        <div className={`p-4 rounded-2xl border flex items-start gap-4 ${
                            calculationResult.diff < 0
                                ? 'bg-red-900/10 border-red-900/30 text-red-400'
                                : calculationResult.diff > 0 || hasInventoryMismatch
                                    ? 'bg-amber-900/10 border-amber-900/30 text-amber-400'
                                    : 'bg-green-900/10 border-green-900/30 text-green-400'
                        }`}>
                            <div className="mt-0.5">
                                {calculationResult.diff === 0 && !hasInventoryMismatch
                                    ? <CheckCircle2 className="h-5 w-5" />
                                    : <AlertTriangle className="h-5 w-5" />}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold flex justify-between items-center">
                                    <span>
                                        {isStartShiftMode
                                            ? inventorySummary?.isPerfect === false
                                                ? "Стартовая инвентаризация завершена с расхождениями"
                                                : "Стартовая инвентаризация завершена"
                                            : finalizeSummary?.title}
                                    </span>
                                    <span className="text-xl font-black">
                                        {finalizeSummary?.value}
                                    </span>
                                </div>
                                <p className="text-xs opacity-80 mt-1 leading-relaxed">
                                    {finalizeSummary?.description}
                                </p>
                            </div>
                        </div>

                        {usesShiftInventoryReconciliation && inventorySummary && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-primary/50 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Расхождения по товарам</span>
                                    <div className="text-xl font-bold mt-1">{inventorySummary.discrepancyItems}</div>
                                    <div className="text-[10px] text-muted-foreground mt-1">
                                        {inventorySummary.discrepancyQuantity} шт. суммарно
                                    </div>
                                </div>
                                <div className="bg-primary/50 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Отклонение по складу</span>
                                    <div className="text-xl font-bold mt-1 text-blue-400">{inventorySummary.discrepancyValue.toLocaleString()} ₽</div>
                                    <div className="text-[10px] text-muted-foreground mt-1">
                                        Недостача: {inventorySummary.shortageItems} · Излишки: {inventorySummary.excessItems}
                                    </div>
                                </div>
                            </div>
                        )}

                        {usesShiftInventoryReconciliation && discrepancyItems.length > 0 && (
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-2xl border border-red-500/20 bg-red-900/10 overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-red-500/20">
                                        <div>
                                            <h4 className="font-bold text-sm text-red-300">Недостача по товарам</h4>
                                            <p className="text-[10px] text-red-200/70">Какие позиции оказались ниже ожидания</p>
                                        </div>
                                        <Badge variant="outline" className="border-red-400/30 bg-red-500/10 text-red-200">
                                            {shortageDiscrepancyItems.length}
                                        </Badge>
                                    </div>
                                    <div className="max-h-[240px] overflow-y-auto p-3 space-y-2">
                                        {shortageDiscrepancyItems.length === 0 ? (
                                            <div className="rounded-xl bg-slate-950/40 px-3 py-4 text-xs text-muted-foreground/70">
                                                Недостач нет
                                            </div>
                                        ) : (
                                            shortageDiscrepancyItems.map(item => (
                                                <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-950/40 px-3 py-2">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-slate-100">{item.product_name}</div>
                                                        <div className="mt-1 text-[11px] text-muted-foreground/70">
                                                            {inventorySettings?.blind_inventory_enabled
                                                                ? `Факт: ${item.actual_stock} шт.`
                                                                : `Ожидалось: ${item.expected_stock} шт. · Факт: ${item.actual_stock} шт.`}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <div className="rounded-lg bg-red-500/15 px-2 py-1 text-xs font-bold text-red-300">
                                                            {item.difference} шт.
                                                        </div>
                                                        {item.value > 0 && (
                                                            <div className="mt-1 text-[10px] text-red-200/70">
                                                                {item.value.toLocaleString()} ₽
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-blue-500/20 bg-blue-900/10 overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-blue-500/20">
                                        <div>
                                            <h4 className="font-bold text-sm text-blue-300">Излишек по товарам</h4>
                                            <p className="text-[10px] text-blue-200/70">Какие позиции оказались выше ожидания</p>
                                        </div>
                                        <Badge variant="outline" className="border-blue-400/30 bg-blue-500/10 text-blue-200">
                                            {excessDiscrepancyItems.length}
                                        </Badge>
                                    </div>
                                    <div className="max-h-[240px] overflow-y-auto p-3 space-y-2">
                                        {excessDiscrepancyItems.length === 0 ? (
                                            <div className="rounded-xl bg-slate-950/40 px-3 py-4 text-xs text-muted-foreground/70">
                                                Излишков нет
                                            </div>
                                        ) : (
                                            excessDiscrepancyItems.map(item => (
                                                <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-950/40 px-3 py-2">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-slate-100">{item.product_name}</div>
                                                        <div className="mt-1 text-[11px] text-muted-foreground/70">
                                                            {inventorySettings?.blind_inventory_enabled
                                                                ? `Факт: ${item.actual_stock} шт.`
                                                                : `Ожидалось: ${item.expected_stock} шт. · Факт: ${item.actual_stock} шт.`}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <div className="rounded-lg bg-blue-500/15 px-2 py-1 text-xs font-bold text-blue-300">
                                                            +{item.difference} шт.
                                                        </div>
                                                        {item.value > 0 && (
                                                            <div className="mt-1 text-[10px] text-blue-200/70">
                                                                {item.value.toLocaleString()} ₽
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* FORGOTTEN ITEMS WARNING */}
                        {forgottenItems.length > 0 && (
                            <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl space-y-4">
                                <div className="flex items-center gap-3 text-red-400">
                                    <AlertTriangle className="h-6 w-6" />
                                    <h4 className="font-bold">Вы не посчитали {forgottenItems.length} товаров!</h4>
                                </div>
                                <p className="text-xs text-red-300/80 leading-relaxed">
                                    Эти товары числятся на складе, но вы не указали их фактическое количество. 
                                    Система не позволит закрыть смену, пока вы их не проверите.
                                </p>
                                <div className="bg-slate-950/50 rounded-xl p-3 max-h-[150px] overflow-y-auto space-y-2">
                                    {forgottenItems.map(item => (
                                        <div key={item.id} className="flex justify-between items-center text-[11px]">
                                            <span className="text-slate-300">{item.product_name}</span>
                                            {!inventorySettings?.blind_inventory_enabled && (
                                                <span className="text-muted-foreground italic">Ожидалось: {item.expected_stock} шт.</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        onClick={() => setStep(inventoryStep)} 
                                        variant="outline" 
                                        className="flex-1 h-10 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    >
                                        Вернуться к пересчету
                                    </Button>
                                    <Button 
                                        onClick={markAllForgottenAsZero} 
                                        variant="ghost" 
                                        className="flex-1 h-10 text-xs text-red-500 hover:bg-red-500/10"
                                    >
                                        Этих товаров нет (0)
                                    </Button>
                                </div>
                            </div>
                        )}

                        {!isStartShiftMode && (
                            <div className="bg-primary/50 rounded-2xl border border-slate-800 overflow-hidden">
                            <div className="px-4 py-3 bg-primary border-b border-slate-800 flex justify-between items-center">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Детализация продаж</h4>
                                {usesRevisionMode && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => {
                                            refreshProductCatalog()
                                            setIsUnaccountedDialogOpen(true)
                                        }}
                                        className="h-7 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> Добавить неучтенку
                                    </Button>
                                )}
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {salesPreview.length === 0 ? (
                                    <div className="p-10 text-center text-muted-foreground text-sm">
                                        Продаж не зафиксировано
                                    </div>
                                ) : (
                                    <Table>
                                        <TableBody>
                                            {salesPreview.map((s, idx) => (
                                                <TableRow key={`${s.id}-${idx}`} className="border-slate-800 hover:bg-primary/90/30">
                                                    <TableCell className="py-3">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5">
                                                                {s.isUnaccounted && <span className="bg-blue-500/20 text-blue-400 text-[8px] px-1 rounded uppercase font-bold">Неучт.</span>}
                                                                <span className="text-sm font-medium text-slate-200">{s.name}</span>
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground">{s.qty} шт × {s.price} ₽</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-3 pr-6">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="font-bold text-slate-200">{s.total} ₽</span>
                                                            {s.isUnaccounted && (
                                                                <button 
                                                                    onClick={() => removeUnaccountedSale(s.id)}
                                                                    className="p-1 text-muted-foreground hover:text-red-400"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                            </div>
                        )}

                        {/* Unaccounted Logic (Automatic Supply) Alert - moved below detail */}
                        {usesRevisionMode && inventoryItems.some(item => (item.expected_stock || 0) === 0 && (item.actual_stock || 0) > 0) && (
                            <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-2xl space-y-3">
                                <div className="flex items-center gap-2 text-blue-400">
                                    <AlertTriangle className="h-5 w-5" />
                                    <h4 className="font-bold text-sm">Найдены излишки</h4>
                                </div>
                                <div className="space-y-2">
                                    {inventoryItems.filter(item => (item.expected_stock || 0) === 0 && (item.actual_stock || 0) > 0).map(item => (
                                        <div key={item.id} className="flex justify-between items-center text-xs">
                                            <span className="text-slate-300">{item.product_name}</span>
                                            <span className="font-mono bg-blue-500/20 px-2 py-0.5 rounded text-blue-300">
                                                {!inventorySettings?.blind_inventory_enabled ? `+${item.actual_stock} шт.` : 'Обнаружено наличие'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!isStartShiftMode && calculationResult.diff !== 0 && (
                            <div className="space-y-3">
                                <Label className={cn(
                                    "text-xs uppercase tracking-wider ml-1",
                                    shiftCommentRequired && !hasShiftComment ? "text-red-400" : "text-muted-foreground/70"
                                )}>Причина расхождения</Label>
                                <Input 
                                    className={cn(
                                        "bg-primary h-14 rounded-xl focus:ring-2 transition-all text-base",
                                        shiftCommentRequired && !hasShiftComment ? "border-red-500 focus:ring-red-500" : "border-slate-800 focus:ring-blue-500"
                                    )}
                                    placeholder="Укажите причину..."
                                    value={reportData['shift_comment'] || ''}
                                    onChange={(e) => setReportData({ ...reportData, 'shift_comment': e.target.value })}
                                />
                            </div>
                        )}

                        {/* Payout Suggestion Block */}
                        {!isStartShiftMode && payoutSuggestion && payoutSuggestion.isAvailable && (
                            <div className="bg-emerald-900/20 border border-emerald-500/30 p-5 rounded-2xl space-y-4">
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <div className="bg-emerald-500/20 p-2 rounded-xl">
                                        <DollarSign className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">Доступна выплата: {payoutSuggestion.amount} ₽</h4>
                                        <p className="text-xs text-emerald-300/80">Вы заработали эту сумму за смену (деньщина).</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-primary/50 rounded-xl border border-slate-800">
                                    {(Number(reportData.cash_income || 0)) < payoutSuggestion.amount ? (
                                        <div className="text-center space-y-3">
                                            <p className="text-sm font-bold text-red-400">Недостаточно наличных в кассе</p>
                                            <p className="text-xs text-muted-foreground/70">В кассе {reportData.cash_income || 0} ₽, а к выплате {payoutSuggestion.amount} ₽. Выплата будет зачислена на баланс.</p>
                                            <Button 
                                                disabled
                                                variant="secondary"
                                                className="w-full h-10 opacity-50"
                                            >
                                                Автоматически на баланс
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm text-slate-300 mb-2">Забрать деньги из кассы сейчас?</p>
                                            <div className="flex gap-3">
                                                <Button 
                                                    onClick={() => setReportData({ ...reportData, auto_payout_amount: payoutSuggestion.amount })}
                                                    variant={reportData.auto_payout_amount ? 'default' : 'outline'}
                                                    className={`flex-1 h-10 ${reportData.auto_payout_amount ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500' : 'border-slate-700 hover:bg-primary/90'}`}
                                                >
                                                    Да, забираю
                                                </Button>
                                                <Button 
                                                    onClick={() => setReportData({ ...reportData, auto_payout_amount: 0 })}
                                                    variant={reportData.auto_payout_amount === 0 ? 'secondary' : 'ghost'}
                                                    className="flex-1 h-10"
                                                >
                                                    Нет, на баланс
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            <footer className="p-4 pb-safe border-t border-slate-800 bg-primary/80 backdrop-blur-md sticky bottom-0 z-50">
                {step === 1 && !isStartShiftMode && (
                    <div className="space-y-2">
                        <Button onClick={handleStep1Submit} disabled={!canProceedFromStep1 || isPending} className="w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 rounded-2xl shadow-lg shadow-purple-900/20 disabled:opacity-40 disabled:pointer-events-none">
                            {primaryStepOneLabel}
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                        {!canProceedFromStep1 && stepOneBlockReasons.length > 0 && (
                            <div className="text-[11px] font-semibold text-amber-400">
                                {stepOneBlockReasons.map((reason, idx) => (
                                    <div key={`step1-reason-${idx}`} className={idx === 0 ? "" : "mt-1"}>
                                        {reason}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {step === 2 && usesSalesReconciliation && !isStartShiftMode && (
                    <div className="space-y-2">
                        <div className="flex gap-3">
                            <Button 
                                variant="outline"
                                size="icon"
                                onClick={handleBack}
                                className="h-14 w-14 border-slate-800 text-muted-foreground/70 hover:bg-primary/90 rounded-2xl shrink-0"
                            >
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                            <Button onClick={handleReconcileNext} disabled={!canProceedFromReconcile} className="flex-1 h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-900/20 disabled:opacity-40 disabled:pointer-events-none">
                                {reconcileNextLabel}
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                        {!canProceedFromReconcile && reconcileBlockReason && (
                            <div className="text-[11px] font-semibold text-amber-400">
                                {reconcileBlockReason}
                            </div>
                        )}
                    </div>
                )}
                {step === inventoryStep && !usesSalesReconciliation && (
                    <div className="flex gap-3">
                        {!isStartShiftMode ? (
                            <Button 
                                variant="outline"
                                size="icon"
                                onClick={handleBack}
                                className="h-14 w-14 border-slate-800 text-muted-foreground/70 hover:bg-primary/90 rounded-2xl shrink-0"
                            >
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                        ) : null}
                        <Button onClick={handleInventorySubmit} disabled={isPending} className="flex-1 h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-900/20">
                            {inventoryNextLabel}
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                )}
                {step === inventoryStep && usesSalesReconciliation && (
                    <div className="flex gap-3">
                        <Button 
                            variant="outline"
                            size="icon"
                            onClick={handleBack}
                            className="h-14 w-14 border-slate-800 text-muted-foreground/70 hover:bg-primary/90 rounded-2xl shrink-0"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <Button onClick={handleInventorySubmit} disabled={isPending} className="flex-1 h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-900/20">
                            Далее
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                )}
                {step === finalizeStep && (
                    <div className="flex gap-3">
                        {!isStartShiftMode ? (
                            <Button 
                                variant="outline"
                                size="icon"
                                onClick={handleBack}
                                className="h-14 w-14 border-slate-800 text-muted-foreground/70 hover:bg-primary/90 rounded-2xl shrink-0"
                            >
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                        ) : null}
                        <Button onClick={handleFinalize} disabled={!canFinalizeShift} className="flex-1 h-14 text-lg font-bold bg-green-600 hover:bg-green-700 rounded-2xl shadow-lg shadow-green-900/20 disabled:opacity-40 disabled:pointer-events-none">
                            {isStartShiftMode ? "Подтвердить инвентаризацию" : "Подтвердить"}
                        </Button>
                    </div>
                )}
                {step === finalizeStep && !canFinalizeShift && finalizeBlockReason && (
                    <div className="mt-2 text-[11px] font-semibold text-amber-400">
                        {finalizeBlockReason}
                    </div>
                )}
            </footer>

            {/* Manual Add Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="bg-slate-950 border-slate-800 text-primary-foreground max-w-[90vw] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Добавить товар</DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <Select value={selectedProductToAdd} onValueChange={setSelectedProductToAdd}>
                            <SelectTrigger className="bg-primary border-slate-800 h-12 rounded-xl">
                                <SelectValue placeholder="Выберите товар..." />
                            </SelectTrigger>
                            <SelectContent className="bg-primary border-slate-800 text-primary-foreground max-h-[300px]">
                                {allProducts.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter className="flex-row gap-3">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1 border-slate-800 h-12 rounded-xl">Отмена</Button>
                        <Button onClick={() => handleAddProductManually()} disabled={!selectedProductToAdd || isPending} className="flex-1 bg-blue-600 h-12 rounded-xl">Добавить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Unaccounted Product Dialog */}
            <Dialog open={isUnaccountedDialogOpen} onOpenChange={setIsUnaccountedDialogOpen}>
                <DialogContent className="bg-slate-950 border-slate-800 text-primary-foreground max-w-[90vw] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Добавить неучтенную продажу</DialogTitle>
                        <DialogDescription className="text-muted-foreground/70">
                            Товар, который был продан, но отсутствовал в системе.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Товар</Label>
                            <Select value={selectedUnaccountedProduct} onValueChange={setSelectedUnaccountedProduct}>
                                <SelectTrigger className="bg-primary border-slate-800 h-12 rounded-xl">
                                    <SelectValue placeholder="Выберите товар..." />
                                </SelectTrigger>
                                <SelectContent className="bg-primary border-slate-800 text-primary-foreground max-h-[300px]">
                                    {allProducts.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Количество</Label>
                            <Input 
                                type="number" 
                                value={unaccountedQty}
                                onChange={e => setUnaccountedQty(e.target.value)}
                                className="bg-primary border-slate-800 h-12 rounded-xl text-lg font-bold"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex-row gap-3">
                        <Button variant="outline" onClick={() => setIsUnaccountedDialogOpen(false)} className="flex-1 border-slate-800 h-12 rounded-xl">Отмена</Button>
                        <Button onClick={addUnaccountedSale} disabled={!selectedUnaccountedProduct || !unaccountedQty} className="flex-1 bg-blue-600 h-12 rounded-xl">Добавить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {requiredChecklist && (
                <ShiftOpeningWizard
                    isOpen={isChecklistWizardOpen}
                    onClose={() => setIsChecklistWizardOpen(false)}
                    onComplete={(responses) => {
                        setChecklistResponses(responses)
                        setIsChecklistWizardOpen(false)
                    }}
                    checklistTemplate={requiredChecklist}
                    targetMode="SELF"
                    fullscreen
                />
            )}
            {Dialogs}
        </div>
    ), document.body)
}
