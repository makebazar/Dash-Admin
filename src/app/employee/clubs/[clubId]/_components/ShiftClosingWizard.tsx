"use client"

import { useState, useTransition, useEffect, useMemo, useCallback } from "react"
import { Loader2, ArrowRight, CheckCircle2, AlertTriangle, Package, Camera, Search, Barcode, X, Plus, Trash2, ArrowLeft, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createInventory, closeInventory, getInventoryItems, getProducts, InventoryItem, bulkUpdateInventoryItems, getProductByBarcode, addProductToInventory } from "@/app/clubs/[clubId]/inventory/actions"
import { Badge } from "@/components/ui/badge"
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
    const [step, setStep] = useState<1 | 2 | 3>(1)
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

    // New states for barcode scanner and manual adding
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [scannedItemId, setScannedItemId] = useState<number | null>(null)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [allProducts, setAllProducts] = useState<{ id: number, name: string }[]>([])
    const [selectedProductToAdd, setSelectedProductToAdd] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false)

    // Persistence key
    const persistenceKey = `shift_closing_${activeShiftId}`

    // Calculate Sales Summary for Preview
    const salesPreview = useMemo(() => {
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
    }, [inventoryItems, unaccountedSales])

    const totalSalesRevenue = salesPreview.reduce((acc, s) => acc + s.total, 0)

    // Forgotten items (expected > 0 but actual is null)
    const forgottenItems = useMemo(() => {
        return inventoryItems.filter(i => (i.expected_stock || 0) > 0 && i.actual_stock === null)
    }, [inventoryItems])

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
                    setInventoryItems(data.inventoryItems || [])
                    setChecklistResponses(data.checklistResponses || {})
                    setProblematicItems(data.problematicItems || {})
                    setCalculationResult(data.calculationResult || null)
                    setUnaccountedSales(data.unaccountedSales || [])
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
                unaccountedSales
            }
            localStorage.setItem(persistenceKey, JSON.stringify(stateToSave))
        }
    }, [step, reportData, inventoryId, inventoryItems, checklistResponses, problematicItems, calculationResult, unaccountedSales, isOpen, activeShiftId, persistenceKey])

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
                setChecklistResponses({})
                setProblematicItems({})
                setScannedItemId(null)
                setSearchQuery("")
                setUnaccountedSales([])
                
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

        if (skipInventory) {
            onFinalComplete()
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
                setInventoryItems(items.map(i => ({ ...i, is_visible: false })))
            } catch (e) {
                console.error('Failed to start inventory:', e)
                alert("Ошибка запуска инвентаризации")
            }
        })
    }

    const handleBarcodeScan = useCallback(async (barcode: string) => {
        const item = inventoryItems.find(i => i.barcode === barcode)
        
        if (item) {
            setInventoryItems(prev => prev.map(i => {
                if (i.id === item.id) {
                    const currentStock = i.actual_stock || 0
                    return { ...i, actual_stock: currentStock + 1, is_visible: true }
                }
                return i
            }))
            setScannedItemId(item.id)
            return true
        }

        try {
            const product = await getProductByBarcode(clubId, barcode)
            if (product) {
                // Keep track of current counts before re-fetching
                const currentCounts = inventoryItems.reduce((acc, i) => {
                    if (i.actual_stock !== null) acc[i.id] = i.actual_stock
                    return acc
                }, {} as Record<number, number>)

                // No confirm, just add and highlight
                await addProductToInventory(inventoryId!, product.id)
                const invItems = await getInventoryItems(inventoryId!)
                
                setInventoryItems(invItems.map(i => {
                    const isNew = i.product_id === product.id
                    const oldItem = inventoryItems.find(old => old.id === i.id)
                    return { 
                        ...i, 
                        actual_stock: isNew ? 1 : (currentCounts[i.id] ?? i.actual_stock),
                        is_visible: isNew ? true : oldItem?.is_visible || false 
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

                await addProductToInventory(inventoryId!, idToAdd)
                const invItems = await getInventoryItems(inventoryId!)
                
                setInventoryItems(invItems.map(i => {
                    const isNew = i.product_id === idToAdd
                    const oldItem = inventoryItems.find(old => old.id === i.id)
                    return { 
                        ...i, 
                        actual_stock: isNew ? (currentCounts[i.id] ?? 1) : (currentCounts[i.id] ?? i.actual_stock),
                        is_visible: isNew ? true : oldItem?.is_visible || false 
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

    const refreshProductCatalog = async () => {
        setIsRefreshingCatalog(true)
        try {
            const products = await getProducts(clubId)
            setAllProducts(products.map(p => ({ 
                id: p.id, 
                name: p.name,
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
                return { ...i, actual_stock: numVal, is_visible: isVisible }
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
        
        // 1. Existing inventory items that match
        const existingMatches = inventoryItems.filter(i => {
            if (i.is_visible) return true
            if (!searchQuery) return false

            const name = i.product_name.toLowerCase()
            const barcode = i.barcode || ""
            
            const matchOriginal = name.includes(queries.original) || barcode.includes(queries.original)
            const matchRu = name.includes(queries.ru)
            const matchEn = name.includes(queries.en)
            
            return matchOriginal || matchRu || matchEn
        })

        // 2. If searching, also look into all products to find items NOT yet in inventory
        if (searchQuery && allProducts.length > 0) {
            const inventoryProductIds = new Set(inventoryItems.map(i => i.product_id))
            
            const externalMatches = allProducts
                .filter(p => !inventoryProductIds.has(p.id))
                .filter(p => {
                    const name = p.name.toLowerCase()
                    return name.includes(queries.original) || name.includes(queries.ru) || name.includes(queries.en)
                })
                .map(p => ({
                    id: -p.id, // Temporary ID for UI
                    product_id: p.id,
                    product_name: p.name,
                    is_external: true,
                    actual_stock: null,
                    expected_stock: 0,
                    is_visible: false
                }))

            return [...existingMatches, ...externalMatches]
        }

        return existingMatches
    }, [inventoryItems, searchQuery, allProducts])

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

                // Find the most likely revenue metric key from the template
                const revenueKey = inventorySettings?.employee_default_metric_key || 
                    reportTemplate?.schema?.find((f: any) => 
                        f.metric_key.toLowerCase().includes('bar') || 
                        f.metric_key.toLowerCase().includes('revenue') ||
                        f.custom_label.toLowerCase().includes('бар') ||
                        f.custom_label.toLowerCase().includes('выручка')
                    )?.metric_key || 'total_revenue'

                const reportedRev = parseFloat(reportData[revenueKey] || reportData['bar_revenue'] || reportData['total_revenue'] || '0')
                
                console.log('Calculation summary:', { revenueKey, reportedRev, totalCalculatedRev, reportData })

                setCalculationResult({
                    reported: reportedRev,
                    calculated: totalCalculatedRev,
                    diff: reportedRev - totalCalculatedRev
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
        
        // Prevent finalize if there are uncounted items
        if (forgottenItems.length > 0) {
            alert(`Вы не посчитали ${forgottenItems.length} товаров. Укажите их остаток (даже если 0), чтобы закрыть смену.`)
            setStep(2) // Return to inventory
            return
        }

        startTransition(async () => {
            try {
                // Close inventory in DB with unaccounted sales
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
                
                // Complete shift closing
                onFinalComplete()
            } catch (e) {
                console.error(e)
                alert("Ошибка завершения")
            }
        })
    }

    const removeUnaccountedSale = (productId: number) => {
        setUnaccountedSales(prev => prev.filter(s => s.product_id !== productId))
    }

    const addUnaccountedSale = () => {
        const product = allProducts.find(p => p.id === Number(selectedUnaccountedProduct))
        if (!product || !unaccountedQty) return

        // Check if already in standard inventory (just in case, though they should be separate)
        const inInventory = inventoryItems.some(i => i.product_id === product.id && i.is_visible)
        if (inInventory) {
            alert("Этот товар уже есть в списке инвентаризации. Просто укажите его остаток там.")
            setIsUnaccountedDialogOpen(false)
            return
        }

        setUnaccountedSales(prev => [
            ...prev,
            {
                product_id: product.id,
                name: product.name,
                quantity: Number(unaccountedQty),
                // @ts-ignore
                selling_price: product.selling_price || 0,
                // @ts-ignore
                cost_price: product.cost_price || 0
            }
        ])
        setSelectedUnaccountedProduct("")
        setUnaccountedQty("1")
        setIsUnaccountedDialogOpen(false)
    }

    const markAllForgottenAsZero = () => {
        if (confirm(`Вы уверены, что хотите установить остаток 0 для всех ${forgottenItems.length} нераспределенных товаров? Это зафиксирует недостачу.`)) {
            const updatedItems = inventoryItems.map(item => {
                if ((item.expected_stock || 0) > 0 && item.actual_stock === null) {
                    return { ...item, actual_stock: 0 }
                }
                return item
            })
            setInventoryItems(updatedItems)
        }
    }

    const handleBack = () => {
        if (step > 1) {
            setStep((prev) => (prev - 1) as 1 | 2 | 3)
        }
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
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-lg font-bold truncate">
                            {skipInventory ? "Закрытие смены" : 
                             step === 1 ? "Финансовый отчет" :
                             step === 2 ? "Инвентаризация" : "Сверка итогов"}
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
                            {[1, 2, 3].map((i) => (
                                <div 
                                    key={i} 
                                    className={`flex-1 rounded-full transition-all duration-500 ${
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
                        {/* Progress Tracker */}
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Прогресс пересчета</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="h-1.5 w-32 bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-blue-500 transition-all duration-500" 
                                            style={{ width: `${(inventoryItems.filter(i => i.actual_stock !== null).length / inventoryItems.length) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-slate-200">
                                        {inventoryItems.filter(i => i.actual_stock !== null).length}/{inventoryItems.length}
                                    </span>
                                </div>
                            </div>
                            {forgottenItems.length > 0 && (
                                <Badge variant="outline" className="bg-amber-900/20 text-amber-400 border-amber-900/30 text-[10px] animate-pulse">
                                    Не посчитано: {forgottenItems.length}
                                </Badge>
                            )}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input 
                                placeholder="Поиск по названию или штрихкоду..."
                                className="pl-10 pr-10 bg-slate-900 border-slate-800 h-12 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button 
                                onClick={refreshProductCatalog}
                                disabled={isRefreshingCatalog}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-blue-400 disabled:opacity-50 transition-colors"
                                title="Обновить список товаров"
                            >
                                <RefreshCcw className={`h-4 w-4 ${isRefreshingCatalog ? 'animate-spin' : ''}`} />
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
                                                        className="bg-slate-900 border-slate-800 text-right w-20 ml-auto font-bold h-10 rounded-lg"
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

                {/* STEP 3: SUMMARY */}
                {step === 3 && calculationResult && (
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
                            calculationResult.diff === 0 ? 'bg-green-900/10 border-green-900/30 text-green-400' :
                            calculationResult.diff > 0 ? 'bg-amber-900/10 border-amber-900/30 text-amber-400' : 
                            'bg-red-900/10 border-red-900/30 text-red-400'
                        }`}>
                            <div className="mt-0.5">
                                {calculationResult.diff === 0 ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold flex justify-between items-center">
                                    <span>{calculationResult.diff === 0 ? "Смена сходится!" : calculationResult.diff > 0 ? "Обнаружен излишек" : "Обнаружена недостача"}</span>
                                    <span className="text-xl font-black">{calculationResult.diff > 0 ? '+' : ''}{calculationResult.diff.toLocaleString()} ₽</span>
                                </div>
                                <p className="text-xs opacity-80 mt-1 leading-relaxed">
                                    {calculationResult.diff === 0 ? "Данные по складу полностью соответствуют сумме в кассе." : 
                                     calculationResult.diff > 0 ? "Денег в кассе больше, чем проданного товара. Возможно, вы не указали продажу какого-то товара." : 
                                     "Денег в кассе меньше, чем должно быть по остаткам склада. Проверьте правильность подсчета."}
                                </p>
                            </div>
                        </div>

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
                                        onClick={() => setStep(2)} 
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
                                    className="bg-slate-900 border-slate-800 h-14 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
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
                {step === 3 && (
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
