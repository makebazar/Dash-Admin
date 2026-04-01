"use client"

import { useState, useTransition, useEffect, useMemo, useCallback } from "react"
import { Loader2, ArrowRight, CheckCircle2, AlertTriangle, Package, Camera, Search, Barcode, X, Plus, Trash2, ArrowLeft, RefreshCcw, AlertCircle, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useSSE } from "@/hooks/usePOSWebSocket"
import {
    addProductToInventory,
    bulkUpdateInventoryItems,
    closeInventory,
    createShiftReceipt,
    createInventory,
    getInventoryItems,
    getProductByBarcode,
    getProducts,
    getShiftReceipts,
    voidShiftReceipt,
    type InventoryItem,
    type ShiftReceipt
} from "@/app/clubs/[clubId]/inventory/actions"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarcodeScanner } from "@/app/clubs/[clubId]/inventory/_components/BarcodeScanner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

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
        sales_capture_mode?: 'INVENTORY' | 'SHIFT'
    }
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
        if (receipt.voided_at) continue
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
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
    const [reportData, setReportData] = useState<any>({})
    const [inventoryId, setInventoryId] = useState<number | null>(null)
    const [inventoryItems, setInventoryItems] = useState<ExtendedInventoryItem[]>([])
    const [isPending, startTransition] = useTransition()
    const [calculationResult, setCalculationResult] = useState<{ reported: number, calculated: number, diff: number } | null>(null)
    const [requiredChecklist, setRequiredChecklist] = useState<any>(null)
    const [checklistResponses, setChecklistResponses] = useState<Record<number, { score: number, comment: string, photo_urls?: string[], selected_workstations?: string[] }>>({})
    const [workstations, setWorkstations] = useState<any[]>([])
    const [problematicItems, setProblematicItems] = useState<Record<number, string[]>>({})
    const [uploadingState, setUploadingState] = useState<Record<number, boolean>>({})
    const [unaccountedSales, setUnaccountedSales] = useState<{ product_id: number, quantity: number, selling_price: number, cost_price: number, name: string }[]>([])
    const [isUnaccountedDialogOpen, setIsUnaccountedDialogOpen] = useState(false)
    const [selectedUnaccountedProduct, setSelectedUnaccountedProduct] = useState("")
    const [unaccountedQty, setUnaccountedQty] = useState("1")
    const [payoutSuggestion, setPayoutSuggestion] = useState<{ amount: number, isAvailable: boolean } | null>(null)

    // New states for barcode scanner and manual adding
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [scannedItemId, setScannedItemId] = useState<number | null>(null)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [allProducts, setAllProducts] = useState<{ id: number, name: string, barcode?: string | null, barcodes?: string[] | null }[]>([])
    const [selectedProductToAdd, setSelectedProductToAdd] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false)

    const salesMode = inventorySettings?.sales_capture_mode ?? 'INVENTORY'
    const isShiftSalesMode = salesMode === 'SHIFT'
    const inventoryStep = isShiftSalesMode ? 3 : 2
    const finalizeStep = isShiftSalesMode ? 4 : 3
    const totalSteps = isShiftSalesMode ? (skipInventory ? 2 : 4) : (skipInventory ? 1 : 3)

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

    const hasInventoryMismatch = isShiftSalesMode && inventorySummary?.isPerfect === false

    const revenueKey = useMemo(() => {
        return inventorySettings?.employee_default_metric_key ||
            reportTemplate?.schema?.find((f: any) =>
                f.metric_key.toLowerCase().includes('bar') ||
                f.metric_key.toLowerCase().includes('revenue') ||
                f.custom_label.toLowerCase().includes('бар') ||
                f.custom_label.toLowerCase().includes('выручка')
            )?.metric_key ||
            'total_revenue'
    }, [inventorySettings?.employee_default_metric_key, reportTemplate?.schema])

    const reportedRevenueValue = useMemo(() => {
        const raw = reportData[revenueKey] ?? reportData['bar_revenue'] ?? reportData['total_revenue'] ?? 0
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

    useEffect(() => {
        if (!isOpen) return
        if (!isShiftSalesMode) return
        if (step !== 2) return

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
                    setStep(data.step || 1)
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
    }, [isOpen, activeShiftId, persistenceKey])

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
                setSearchQuery("")
                setUnaccountedSales([])
                setShiftReceipts([])
                
                const mandatory = checklistTemplates?.find((t: any) => 
                    t.type === 'shift_handover' && t.settings?.block_shift_close
                )
                
                if (mandatory) {
                    setRequiredChecklist(mandatory)
                    const initial: Record<number, { score: number, comment: string, photo_urls: string[], selected_workstations?: string[] }> = {}
                    mandatory.items?.forEach((item: any) => {
                        if (item.related_entity_type !== 'workstations') {
                            initial[item.id] = { score: 1, comment: '', photo_urls: [], selected_workstations: [] }
                        }
                    })
                    setChecklistResponses(initial)
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
                            // Initial scores for workstations if no saved data
                            const saved = localStorage.getItem(persistenceKey)
                            if (!saved) {
                                const mandatory = checklistTemplates?.find((t: any) => 
                                    t.type === 'shift_handover' && t.settings?.block_shift_close
                                )
                                if (mandatory) {
                                    setChecklistResponses(prev => {
                                        const next = { ...prev }
                                        mandatory.items?.forEach((item: any) => {
                                            if (item.related_entity_type === 'workstations') {
                                                next[item.id] = { score: 10, comment: '', photo_urls: [], selected_workstations: [] }
                                            }
                                        })
                                        return next
                                    })
                                }
                            }
                        }
                    })
                    .catch(console.error)
            }
        }
    }, [isOpen])

    const handleStep1Submit = () => {
        const requiredFields = reportTemplate?.schema.filter((f: any) => f.is_required).map((f: any) => f.metric_key) || []
        const missing = requiredFields.filter((key: string) => !reportData[key])
        if (missing.length > 0) return alert(`Заполните обязательные поля отчета`)
        
        // Validation for checklist photos
        if (requiredChecklist?.items) {
            for (const item of requiredChecklist.items) {
                const response = checklistResponses[item.id]
                if (item.is_photo_required && (!response?.photo_urls || response.photo_urls.length < (item.min_photos || 1))) {
                    return alert(`Загрузите фото для пункта: ${item.content}`)
                }
            }
        }

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

        if (skipInventory && !isShiftSalesMode) {
            onFinalComplete()
            return
        }

        if (isShiftSalesMode) {
            setStep(2)
            return
        }

        setStep(2)
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

    const compressImage = async (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image()
            const reader = new FileReader()
            reader.onload = (e) => { img.src = e.target?.result as string }
            img.onload = () => {
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')
                const MAX_WIDTH = 1200
                const MAX_HEIGHT = 1200
                let width = img.width
                let height = img.height
                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT }
                }
                canvas.width = width
                canvas.height = height
                ctx?.drawImage(img, 0, 0, width, height)
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob)
                    else reject(new Error('Canvas to Blob failed'))
                }, 'image/jpeg', 0.7)
            }
            reader.onerror = (err) => reject(err)
            reader.readAsDataURL(file)
        })
    }

    const handlePhotoUpload = async (itemId: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return
        setUploadingState(prev => ({ ...prev, [itemId]: true }))
        try {
            const uploadPromises = Array.from(files).map(async (file) => {
                const compressedBlob = await compressImage(file)
                const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' })
                const formData = new FormData()
                formData.append('file', compressedFile)
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
            alert('Не удалось загрузить фото')
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
                // Auto-count items with expected_stock = 0 (no need to manually enter 0)
                setInventoryItems(items.map(i => ({
                    ...i,
                    is_visible: false,
                    actual_stock: (i.expected_stock || 0) === 0 ? 0 : i.actual_stock
                })))
            } catch (e) {
                console.error('Failed to start inventory:', e)
                alert("Ошибка запуска инвентаризации")
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
            setIsScannerOpen(false) 
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
                    setIsScannerOpen(false)
                    return true
                }

                // If truly not in list, add it
                const currentCounts = inventoryItems.reduce((acc, i) => {
                    if (i.actual_stock !== null) acc[i.id] = i.actual_stock
                    return acc
                }, {} as Record<number, number>)

                await addProductToInventory(inventoryId!, product.id)
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
                setIsScannerOpen(false) 
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

                await addProductToInventory(inventoryId!, idToAdd)
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
                alert(e.message)
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
    const handleStockChange = (itemId: number, val: string) => {
        const numVal = val === "" ? null : parseInt(val)
        setInventoryItems(prev => prev.map(i => {
            if (i.id === itemId) {
                // Если ввели число >= 0, помечаем товар как видимый навсегда
                const isVisible = numVal !== null ? true : i.is_visible
                return { 
                    ...i, 
                    actual_stock: numVal, 
                    is_visible: isVisible,
                    last_modified: numVal !== null ? Date.now() : i.last_modified
                }
            }
            return i
        }))
    }

    const handleRemoveItem = (itemId: number) => {
        setInventoryItems(prev => prev.map(i => {
            if (i.id === itemId) {
                return { ...i, actual_stock: null, is_visible: false }
            }
            return i
        }))
    }

    const translateLayout = (text: string) => {
        const ru = "йцукенгшщзхъфывапролджэячсмитьбю.ЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,"
        const en = "qwertyuiop[]asdfghjkl;'zxcvbnm,./QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?"
        
        const toRu = (s: string) => s.split('').map(c => {
            const i = en.indexOf(c)
            return i !== -1 ? ru[i] : c
        }).join('')
        
        const toEn = (s: string) => s.split('').map(c => {
            const i = ru.indexOf(c)
            return i !== -1 ? en[i] : c
        }).join('')

        return {
            original: text.toLowerCase(),
            ru: toRu(text).toLowerCase(),
            en: toEn(text).toLowerCase()
        }
    }

    const visibleItems = useMemo(() => {
        const queries = translateLayout(searchQuery)
        const q = searchQuery.toLowerCase()
        
        // 1. Filter items
        let filtered: ExtendedInventoryItem[] = []

        if (q) {
            // When searching, show ONLY items that match the search (regardless of is_visible)
            const inventoryMatches = inventoryItems.filter(i => {
                const name = i.product_name.toLowerCase()
                const barcode = i.barcode || ""
                const barcodes = i.barcodes || []
                
                return name.includes(queries.original) || 
                       barcode.includes(queries.original) || 
                       barcodes.some(bc => bc.includes(queries.original)) ||
                       name.includes(queries.ru) || 
                       name.includes(queries.en)
            })

            // Also find products NOT yet in inventory
            const inventoryProductIds = new Set(inventoryItems.map(i => i.product_id))
            const externalMatches = allProducts
                .filter(p => !inventoryProductIds.has(p.id))
                .filter(p => {
                    const name = p.name.toLowerCase()
                    const barcode = p.barcode || ""
                    const barcodes = p.barcodes || []
                    return name.includes(queries.original) || 
                           name.includes(queries.ru) || 
                           name.includes(queries.en) ||
                           barcode.includes(queries.original) ||
                           barcodes.some(bc => bc.includes(queries.original))
                })
                .map(p => ({
                    id: -p.id,
                    product_id: p.id,
                    product_name: p.name,
                    is_external: true,
                    actual_stock: null,
                    expected_stock: 0,
                    is_visible: false,
                    difference: null,
                    cost_price_snapshot: 0,
                    selling_price_snapshot: 0,
                    calculated_revenue: null
                } as ExtendedInventoryItem))

            filtered = [...inventoryMatches, ...externalMatches]

            // Sort by relevance
            filtered.sort((a, b) => {
                // Priority 1: Exact match
                const aName = a.product_name.toLowerCase()
                const bName = b.product_name.toLowerCase()
                const aExact = aName === q
                const bExact = bName === q
                if (aExact && !bExact) return -1
                if (!aExact && bExact) return 1

                // Priority 2: Recently modified items (during this search)
                const aMod = a.last_modified || 0
                const bMod = b.last_modified || 0
                if (aMod !== bMod) return bMod - aMod

                // Priority 3: Start match
                const aStarts = aName.startsWith(q)
                const bStarts = bName.startsWith(q)
                if (aStarts && !bStarts) return -1
                if (!aStarts && bStarts) return 1

                return aName.localeCompare(bName)
            })
        } else {
            // When NOT searching, show only items that were already made visible (counted or added)
            filtered = inventoryItems.filter(i => i.is_visible)
            
            // Sort by: most recently added/changed first (by timestamp)
            filtered.sort((a, b) => {
                const aMod = a.last_modified || 0
                const bMod = b.last_modified || 0
                if (aMod !== bMod) return bMod - aMod
                
                // If both never modified, sort alphabetically
                return a.product_name.localeCompare(b.product_name)
            })
        }

        return filtered
    }, [inventoryItems, searchQuery, allProducts])

    const handleReconcileNext = () => {
        if (!isShiftSalesMode) return
        const shiftIdStr = String(activeShiftId)

        startTransition(async () => {
            try {
                // FIX: Sales are already committed in real-time, no need to commit
                if (unaccountedSales.length > 0) {
                    await createShiftReceipt(clubId, userId, {
                        shift_id: shiftIdStr,
                        payment_type: 'other',
                        items: unaccountedSales.map(s => ({ product_id: s.product_id, quantity: s.quantity })),
                        notes: "Ручная продажа при закрытии смены"
                    })
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
                alert(e?.message || "Ошибка сверки продаж")
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
                    await bulkUpdateInventoryItems(itemsToUpdate, clubId)
                }

                if (isShiftSalesMode) {
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
                alert("Ошибка сохранения подсчетов")
            }
        })
    }

    // Step 3: Finalize
    const handleFinalize = () => {
        if (!inventoryId || !calculationResult) return
        
        // Prevent finalize if there are uncounted items
        if (forgottenItems.length > 0) {
            alert(`Вы не посчитали ${forgottenItems.length} товаров. Укажите их остаток (даже если 0), чтобы закрыть смену.`)
            setStep(inventoryStep) // Return to inventory
            return
        }

        startTransition(async () => {
                try {
                    if (isShiftSalesMode) {
                        await closeInventory(inventoryId, clubId, calculationResult.reported, [], { salesRecognition: 'NONE' })
                    } else {
                        await closeInventory(
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
                }
                
                // Complete shift closing
                onFinalComplete()
            } catch (e: any) {
                console.error('Error closing inventory:', e)
                alert(`Ошибка завершения: ${e.message || 'Неизвестная ошибка'}`)
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
            alert("Количество должно быть целым положительным числом")
            return
        }

        // Check if already in standard inventory (just in case, though they should be separate)
        const inInventory = inventoryItems.some(i => i.product_id === product.id)
        if (inInventory) {
            alert("Этот товар уже есть в списке инвентаризации. Просто укажите его остаток там.")
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

    const markAllForgottenAsZero = () => {
        if (confirm(`Вы уверены, что хотите установить остаток 0 для всех ${forgottenItems.length} нераспределенных товаров? Это зафиксирует недостачу.`)) {
            const updatedItems = inventoryItems.map(item => {
                if (item.actual_stock === null) {
                    return { ...item, actual_stock: 0 }
                }
                return item
            })
            setInventoryItems(updatedItems)
        }
    }

    const handleBack = () => {
        if (step > 1) {
            setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 h-[100dvh] bg-slate-950 text-white flex flex-col z-[9999] overflow-hidden overscroll-none">
            {step === inventoryStep && (
                <BarcodeScanner 
                    isOpen={isScannerOpen} 
                    onScan={handleBarcodeScan} 
                    onClose={() => setIsScannerOpen(false)} 
                />
            )}
            
            <header className="px-4 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-lg font-bold truncate">
                            {skipInventory ? "Закрытие смены" : 
                             step === 1 ? "Финансовый отчет" :
                             isShiftSalesMode
                                 ? (step === 2 ? "Сверка продаж" : step === 3 ? "Инвентаризация" : "Сверка итогов")
                                 : (step === 2 ? "Инвентаризация" : "Сверка итогов")}
                        </h2>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={onClose} 
                            className="text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800 shrink-0 h-10 w-10 rounded-xl"
                        >
                            <X className="h-5 w-5" />
                        </Button>
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
                                            <div key={item.id} className="space-y-4 py-2 border-b border-orange-900/20 last:border-0">
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

                                                {/* Photos & Camera */}
                                                {(item.is_photo_required || checklistResponses[item.id]?.score === 0 || (checklistResponses[item.id]?.photo_urls?.length || 0) > 0) && (
                                                    <div className="space-y-3">
                                                        {checklistResponses[item.id]?.photo_urls && checklistResponses[item.id].photo_urls!.length > 0 && (
                                                            <div className="grid grid-cols-3 gap-2">
                                                                {checklistResponses[item.id].photo_urls!.map((url, idx) => (
                                                                    <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-800 aspect-square group">
                                                                        <img src={url} alt="Attach" className="h-full w-full object-cover" />
                                                                        <button 
                                                                            onClick={() => removePhoto(item.id, url)}
                                                                            className="absolute top-1 right-1 p-1.5 bg-black/50 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-colors"
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        
                                                        <label className={`
                                                            flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed transition-all cursor-pointer
                                                            ${item.is_photo_required && (checklistResponses[item.id]?.photo_urls?.length || 0) < (item.min_photos || 1)
                                                                ? 'border-orange-500/50 bg-orange-500/5' : 'border-slate-800 bg-slate-900/30'}
                                                        `}>
                                                            {uploadingState[item.id] ? <Loader2 className="h-4 w-4 animate-spin text-orange-400" /> : <Camera className="h-4 w-4 text-orange-400" />}
                                                            <span className="text-xs font-medium text-orange-200">
                                                                {uploadingState[item.id] ? 'Загрузка...' : 'Добавить фото'}
                                                            </span>
                                                            <input 
                                                                type="file" 
                                                                accept="image/*" 
                                                                multiple 
                                                                capture="environment" 
                                                                className="hidden" 
                                                                onChange={(e) => handlePhotoUpload(item.id, e)}
                                                                disabled={uploadingState[item.id]}
                                                            />
                                                        </label>
                                                    </div>
                                                )}
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
                                        {field.field_type === 'EXPENSE_LIST' ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-slate-400 text-xs uppercase tracking-wider ml-1">
                                                        {field.custom_label || field.metric_key}
                                                        {field.is_required && <span className="text-red-500 ml-1">*</span>}
                                                    </Label>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => {
                                                            const currentList = reportData[field.metric_key] || []
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
                                                
                                                <div className="space-y-3">
                                                    {(reportData[field.metric_key] || []).map((item: any, itemIdx: number) => (
                                                        <div key={itemIdx} className="flex gap-2 items-start">
                                                            <div className="flex-1 space-y-2">
                                                                <Input
                                                                    type="number"
                                                                    placeholder="Сумма"
                                                                    className="bg-slate-900 border-slate-800 h-10 rounded-xl focus:ring-2 focus:ring-purple-500"
                                                                    value={item.amount}
                                                                    onChange={(e) => {
                                                                        const newList = [...(reportData[field.metric_key] || [])]
                                                                        newList[itemIdx] = { ...newList[itemIdx], amount: e.target.value }
                                                                        setReportData({ ...reportData, [field.metric_key]: newList })
                                                                    }}
                                                                />
                                                                <Input
                                                                    placeholder="На что потрачено?"
                                                                    className="bg-slate-900 border-slate-800 h-10 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                                                                    value={item.comment}
                                                                    onChange={(e) => {
                                                                        const newList = [...(reportData[field.metric_key] || [])]
                                                                        newList[itemIdx] = { ...newList[itemIdx], comment: e.target.value }
                                                                        setReportData({ ...reportData, [field.metric_key]: newList })
                                                                    }}
                                                                />
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    const newList = [...(reportData[field.metric_key] || [])]
                                                                    newList.splice(itemIdx, 1)
                                                                    setReportData({ ...reportData, [field.metric_key]: newList })
                                                                }}
                                                                className="h-10 w-10 text-slate-500 hover:text-red-400"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    
                                                    {(!reportData[field.metric_key] || reportData[field.metric_key].length === 0) && (
                                                        <div className="text-center py-4 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl text-slate-500 text-[10px] uppercase font-bold">
                                                            Расходов не зафиксировано
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <>
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
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2 (SHIFT MODE): RECONCILIATION */}
                {isShiftSalesMode && step === 2 && (
                    <div className="space-y-6 max-w-2xl mx-auto pb-20">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Выручка (отчет)</span>
                                <div className="text-xl font-bold mt-1">{reconcileSnapshot.reported.toLocaleString()} ₽</div>
                                <div className="text-[10px] text-slate-500 mt-1">{revenueKey}</div>
                            </div>
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Продано (пробитое)</span>
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

                        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Детализация продаж</h4>
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
                                    <div className="p-10 text-center text-slate-500 text-sm">
                                        Продаж не зафиксировано
                                    </div>
                                ) : (
                                    <Table>
                                        <TableBody>
                                            {salesPreview.map((s, idx) => (
                                                <TableRow key={`${s.id}-${idx}`} className="border-slate-800 hover:bg-slate-800/30">
                                                    <TableCell className="py-3">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5">
                                                                {s.isUnaccounted && <span className="bg-blue-500/20 text-blue-400 text-[8px] px-1 rounded uppercase font-bold">Ручн.</span>}
                                                                <span className="text-sm font-medium text-slate-200">{s.name}</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-500">{s.qty} шт × {s.price} ₽</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-3 pr-6">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="font-bold text-slate-200">{s.total} ₽</span>
                                                            {s.isUnaccounted && (
                                                                <button
                                                                    onClick={() => removeUnaccountedSale(s.id)}
                                                                    className="p-1 text-slate-600 hover:text-red-400"
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
                                <Label className="text-slate-400 text-xs uppercase tracking-wider ml-1">Причина расхождения</Label>
                                <Input
                                    className="bg-slate-900 border-slate-800 h-14 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-base"
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
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input 
                                placeholder="Поиск по названию или штрихкоду..."
                                className="pl-10 pr-10 bg-slate-900 border-slate-800 h-12 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-base"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button 
                                onClick={async () => {
                                    await refreshInventoryList()
                                    await refreshProductCatalog()
                                }}
                                disabled={isPending || isRefreshingCatalog}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-blue-400 disabled:opacity-50 transition-colors"
                                title="Синхронизировать с базой"
                            >
                                <RefreshCcw className={cn("h-4 w-4", (isPending || isRefreshingCatalog) && "animate-spin")} />
                            </button>
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
                                                    <div className="flex items-center gap-3">
                                                        {!("is_external" in item) && !searchQuery && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleRemoveItem(item.id)}
                                                                className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-200">{item.product_name}</span>
                                                            {("barcode" in item && item.barcode) && <span className="text-[10px] text-slate-500 font-mono">{item.barcode}</span>}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right py-4 pr-6">
                                                    <Input 
                                                        type="number" 
                                                        id={`inventory-input-${item.id}`}
                                                        className="bg-slate-900 border-slate-800 text-right w-20 ml-auto font-bold h-10 rounded-lg text-base"
                                                        value={item.actual_stock === null ? "" : item.actual_stock}
                                                        onChange={(e) => {
                                                            if ("is_external" in item) {
                                                                handleAddProductManually(item.product_id)
                                                            } else {
                                                                handleStockChange(item.id, e.target.value)
                                                            }
                                                        }}
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

                {/* SUMMARY */}
                {step === finalizeStep && calculationResult && (
                    <div className="space-y-6 max-w-2xl mx-auto pb-20">
                        {/* Reconciliation Summary Header */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">В кассе (отчет)</span>
                                <div className="text-xl font-bold mt-1">{calculationResult.reported.toLocaleString()} ₽</div>
                            </div>
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Расчет (склад)</span>
                                <div className="text-xl font-bold mt-1 text-blue-400">{calculationResult.calculated.toLocaleString()} ₽</div>
                            </div>
                        </div>

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
                                        {isShiftSalesMode
                                            ? calculationResult.diff === 0
                                                ? inventorySummary?.isPerfect === false
                                                    ? "Касса сходится, но по складу есть расхождения"
                                                    : "Касса и склад сходятся"
                                                : calculationResult.diff > 0
                                                    ? "Обнаружен излишек по кассе"
                                                    : "Обнаружена недостача по кассе"
                                            : calculationResult.diff === 0
                                                ? "Смена сходится!"
                                                : calculationResult.diff > 0
                                                    ? "Обнаружен излишек"
                                                    : "Обнаружена недостача"}
                                    </span>
                                    <span className="text-xl font-black">{calculationResult.diff > 0 ? '+' : ''}{calculationResult.diff.toLocaleString()} ₽</span>
                                </div>
                                <p className="text-xs opacity-80 mt-1 leading-relaxed">
                                    {isShiftSalesMode
                                        ? calculationResult.diff === 0
                                            ? inventorySummary?.isPerfect === false
                                                ? "По кассе всё сходится, но инвентаризация нашла расхождения по остаткам."
                                                : "По кассе и по остаткам расхождений не найдено."
                                            : calculationResult.diff > 0
                                                ? "Денег в кассе больше, чем по пробитым товарам. Проверьте неучтённые продажи и сторно."
                                                : "Денег в кассе меньше, чем по пробитым товарам. Проверьте возвраты, сторно и корректность отчёта."
                                        : calculationResult.diff === 0
                                            ? "Данные по складу полностью соответствуют сумме в кассе."
                                            : calculationResult.diff > 0
                                                ? "Денег в кассе больше, чем проданного товара. Возможно, вы не указали продажу какого-то товара."
                                                : "Денег в кассе меньше, чем должно быть по остаткам склада. Проверьте правильность подсчета."}
                                </p>
                            </div>
                        </div>

                        {isShiftSalesMode && inventorySummary && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Расхождения по товарам</span>
                                    <div className="text-xl font-bold mt-1">{inventorySummary.discrepancyItems}</div>
                                    <div className="text-[10px] text-slate-500 mt-1">
                                        {inventorySummary.discrepancyQuantity} шт. суммарно
                                    </div>
                                </div>
                                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Отклонение по складу</span>
                                    <div className="text-xl font-bold mt-1 text-blue-400">{inventorySummary.discrepancyValue.toLocaleString()} ₽</div>
                                    <div className="text-[10px] text-slate-500 mt-1">
                                        Недостача: {inventorySummary.shortageItems} · Излишки: {inventorySummary.excessItems}
                                    </div>
                                </div>
                            </div>
                        )}

                        {isShiftSalesMode && discrepancyItems.length > 0 && (
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
                                            <div className="rounded-xl bg-slate-950/40 px-3 py-4 text-xs text-slate-400">
                                                Недостач нет
                                            </div>
                                        ) : (
                                            shortageDiscrepancyItems.map(item => (
                                                <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-950/40 px-3 py-2">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-slate-100">{item.product_name}</div>
                                                        <div className="mt-1 text-[11px] text-slate-400">
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
                                            <div className="rounded-xl bg-slate-950/40 px-3 py-4 text-xs text-slate-400">
                                                Излишков нет
                                            </div>
                                        ) : (
                                            excessDiscrepancyItems.map(item => (
                                                <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-950/40 px-3 py-2">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-slate-100">{item.product_name}</div>
                                                        <div className="mt-1 text-[11px] text-slate-400">
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
                                                <span className="text-slate-500 italic">Ожидалось: {item.expected_stock} шт.</span>
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

                        {/* Sales Detail Preview */}
                        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
                            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Детализация продаж</h4>
                                {!isShiftSalesMode && (
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
                                    <div className="p-10 text-center text-slate-500 text-sm">
                                        Продаж не зафиксировано
                                    </div>
                                ) : (
                                    <Table>
                                        <TableBody>
                                            {salesPreview.map((s, idx) => (
                                                <TableRow key={`${s.id}-${idx}`} className="border-slate-800 hover:bg-slate-800/30">
                                                    <TableCell className="py-3">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5">
                                                                {s.isUnaccounted && <span className="bg-blue-500/20 text-blue-400 text-[8px] px-1 rounded uppercase font-bold">Неучт.</span>}
                                                                <span className="text-sm font-medium text-slate-200">{s.name}</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-500">{s.qty} шт × {s.price} ₽</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-3 pr-6">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="font-bold text-slate-200">{s.total} ₽</span>
                                                            {s.isUnaccounted && (
                                                                <button 
                                                                    onClick={() => removeUnaccountedSale(s.id)}
                                                                    className="p-1 text-slate-600 hover:text-red-400"
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

                        {/* Unaccounted Logic (Automatic Supply) Alert - moved below detail */}
                        {inventoryItems.some(item => (item.expected_stock || 0) === 0 && (item.actual_stock || 0) > 0) && (
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

                        {calculationResult.diff !== 0 && (
                            <div className="space-y-3">
                                <Label className="text-slate-400 text-xs uppercase tracking-wider ml-1">Причина расхождения</Label>
                                <Input 
                                    className="bg-slate-900 border-slate-800 h-14 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-base"
                                    placeholder="Укажите причину..."
                                    value={reportData['shift_comment'] || ''}
                                    onChange={(e) => setReportData({ ...reportData, 'shift_comment': e.target.value })}
                                />
                            </div>
                        )}

                        {/* Payout Suggestion Block */}
                        {payoutSuggestion && payoutSuggestion.isAvailable && (
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
                                <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                                    {(Number(reportData.cash_income || 0)) < payoutSuggestion.amount ? (
                                        <div className="text-center space-y-3">
                                            <p className="text-sm font-bold text-red-400">Недостаточно наличных в кассе</p>
                                            <p className="text-xs text-slate-400">В кассе {reportData.cash_income || 0} ₽, а к выплате {payoutSuggestion.amount} ₽. Выплата будет зачислена на баланс.</p>
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
                                                    className={`flex-1 h-10 ${reportData.auto_payout_amount ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500' : 'border-slate-700 hover:bg-slate-800'}`}
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

            <footer className="p-4 pb-safe border-t border-slate-800 bg-slate-900/80 backdrop-blur-md sticky bottom-0 z-50">
                {step === 1 && (
                    <Button onClick={handleStep1Submit} className="w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 rounded-2xl shadow-lg shadow-purple-900/20">
                        {skipInventory
                            ? "Завершить смену"
                            : isShiftSalesMode
                                ? "Далее: Сверка продаж"
                                : "Далее: Инвентаризация"}
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                )}
                {step === 2 && isShiftSalesMode && (
                    <div className="flex gap-3">
                        <Button 
                            variant="outline"
                            size="icon"
                            onClick={handleBack}
                            className="h-14 w-14 border-slate-800 text-slate-400 hover:bg-slate-800 rounded-2xl shrink-0"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <Button onClick={handleReconcileNext} disabled={isPending} className="flex-1 h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-900/20">
                            Далее: Инвентаризация
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                )}
                {step === inventoryStep && !isShiftSalesMode && (
                    <div className="flex flex-col gap-3">
                        <Button 
                            onClick={() => setIsScannerOpen(true)}
                            className="w-full h-14 text-lg font-bold bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600/30 rounded-2xl"
                        >
                            <Camera className="mr-2 h-6 w-6" />
                            Открыть Сканер
                        </Button>
                        <div className="flex gap-3">
                            <Button 
                                variant="outline"
                                size="icon"
                                onClick={handleBack}
                                className="h-14 w-14 border-slate-800 text-slate-400 hover:bg-slate-800 rounded-2xl shrink-0"
                            >
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                            <Button onClick={handleInventorySubmit} disabled={isPending} className="flex-1 h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-900/20">
                                Далее
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                )}
                {step === inventoryStep && isShiftSalesMode && (
                    <div className="flex flex-col gap-3">
                        <Button 
                            onClick={() => setIsScannerOpen(true)}
                            className="w-full h-14 text-lg font-bold bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600/30 rounded-2xl"
                        >
                            <Camera className="mr-2 h-6 w-6" />
                            Открыть Сканер
                        </Button>
                        <div className="flex gap-3">
                            <Button 
                                variant="outline"
                                size="icon"
                                onClick={handleBack}
                                className="h-14 w-14 border-slate-800 text-slate-400 hover:bg-slate-800 rounded-2xl shrink-0"
                            >
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                            <Button onClick={handleInventorySubmit} disabled={isPending} className="flex-1 h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-900/20">
                                Далее
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                )}
                {step === finalizeStep && (
                    <div className="flex gap-3">
                        <Button 
                            variant="outline"
                            size="icon"
                            onClick={handleBack}
                            className="h-14 w-14 border-slate-800 text-slate-400 hover:bg-slate-800 rounded-2xl shrink-0"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <Button onClick={handleFinalize} disabled={isPending} className="flex-1 h-14 text-lg font-bold bg-green-600 hover:bg-green-700 rounded-2xl shadow-lg shadow-green-900/20">
                            Подтвердить
                        </Button>
                    </div>
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
                        <Button onClick={() => handleAddProductManually()} disabled={!selectedProductToAdd || isPending} className="flex-1 bg-blue-600 h-12 rounded-xl">Добавить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Unaccounted Product Dialog */}
            <Dialog open={isUnaccountedDialogOpen} onOpenChange={setIsUnaccountedDialogOpen}>
                <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-[90vw] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Добавить неучтенную продажу</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Товар, который был продан, но отсутствовал в системе.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 uppercase tracking-wider">Товар</Label>
                            <Select value={selectedUnaccountedProduct} onValueChange={setSelectedUnaccountedProduct}>
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
                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 uppercase tracking-wider">Количество</Label>
                            <Input 
                                type="number" 
                                value={unaccountedQty}
                                onChange={e => setUnaccountedQty(e.target.value)}
                                className="bg-slate-900 border-slate-800 h-12 rounded-xl text-lg font-bold"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex-row gap-3">
                        <Button variant="outline" onClick={() => setIsUnaccountedDialogOpen(false)} className="flex-1 border-slate-800 h-12 rounded-xl">Отмена</Button>
                        <Button onClick={addUnaccountedSale} disabled={!selectedUnaccountedProduct || !unaccountedQty} className="flex-1 bg-blue-600 h-12 rounded-xl">Добавить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
