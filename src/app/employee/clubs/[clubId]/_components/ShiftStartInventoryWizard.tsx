"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Plus, RefreshCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StockCountWorkspace, type StockCountWorkspaceItem } from "@/app/clubs/[clubId]/inventory/_components/StockCountWorkspace"
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs"
import {
    addProductToInventorySafe,
    bulkUpdateInventoryItemsSafe,
    cancelInventory,
    closeInventorySafe,
    createInventorySafe,
    getInventoryItems,
    getProductByBarcode,
    getProducts,
    type InventoryItem
} from "@/app/clubs/[clubId]/inventory/actions"
import { cn } from "@/lib/utils"

type ShiftStartInventoryWizardProps = {
    isOpen: boolean
    onClose: () => void
    onComplete: () => void | Promise<void>
    clubId: string
    userId: string
    activeShiftId: string | number
    allowAbort?: boolean
    inventorySettings?: {
        employee_default_metric_key?: string
        employee_allowed_warehouse_ids?: number[]
        blind_inventory_enabled?: boolean
    }
}

type ExtendedInventoryItem = InventoryItem & {
    is_visible?: boolean
    last_modified?: number
}

type InventorySummary = {
    countedItems: number
    discrepancyItems: number
    shortageItems: number
    excessItems: number
    discrepancyQuantity: number
    isPerfect: boolean
}

function summarizeInventory(items: ExtendedInventoryItem[]): InventorySummary {
    let countedItems = 0
    let discrepancyItems = 0
    let shortageItems = 0
    let excessItems = 0
    let discrepancyQuantity = 0

    for (const item of items) {
        if (item.actual_stock === null) continue
        countedItems += 1
        const difference = Number(item.actual_stock || 0) - Number(item.expected_stock || 0)
        if (difference !== 0) {
            discrepancyItems += 1
            discrepancyQuantity += Math.abs(difference)
            if (difference > 0) excessItems += 1
            if (difference < 0) shortageItems += 1
        }
    }

    return {
        countedItems,
        discrepancyItems,
        shortageItems,
        excessItems,
        discrepancyQuantity,
        isPerfect: discrepancyItems === 0
    }
}

export function ShiftStartInventoryWizard({
    isOpen,
    onClose,
    onComplete,
    clubId,
    userId,
    activeShiftId,
    allowAbort = true,
    inventorySettings
}: ShiftStartInventoryWizardProps) {
    const { showMessage, Dialogs } = useUiDialogs()
    const [isPending, startTransition] = useTransition()
    const [step, setStep] = useState<1 | 2>(1)
    const [inventoryId, setInventoryId] = useState<number | null>(null)
    const [inventoryItems, setInventoryItems] = useState<ExtendedInventoryItem[]>([])
    const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [selectedProductToAdd, setSelectedProductToAdd] = useState("")
    const [allProducts, setAllProducts] = useState<{ id: number, name: string, barcode?: string | null, barcodes?: string[] | null }[]>([])
    const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false)
    const [isCompleted, setIsCompleted] = useState(false)

    const notifyError = useCallback((message: string) => {
        showMessage({ title: "Ошибка", description: message })
    }, [showMessage])

    const startInventory = useCallback(() => {
        startTransition(async () => {
            try {
                const targetMetric = inventorySettings?.employee_default_metric_key || 'total_revenue'
                const allowedWarehouseId = inventorySettings?.employee_allowed_warehouse_ids?.[0] || null

                const inventoryResult = await createInventorySafe(
                    clubId,
                    userId,
                    targetMetric,
                    null,
                    allowedWarehouseId,
                    String(activeShiftId)
                )
                if (!inventoryResult.ok) {
                    notifyError(inventoryResult.error)
                    return
                }

                setInventoryId(inventoryResult.inventoryId)
                const items = await getInventoryItems(inventoryResult.inventoryId)
                setInventoryItems(items.map((item) => ({
                    ...item,
                    is_visible: true,
                    actual_stock: (item.expected_stock || 0) === 0 ? 0 : item.actual_stock
                })))
            } catch (error) {
                console.error(error)
                notifyError("Ошибка запуска стартовой инвентаризации")
            }
        })
    }, [activeShiftId, clubId, inventorySettings?.employee_allowed_warehouse_ids, inventorySettings?.employee_default_metric_key, notifyError, userId])

    useEffect(() => {
        if (!isOpen) return
        setStep(1)
        setInventoryId(null)
        setInventoryItems([])
        setInventorySummary(null)
        setSelectedProductToAdd("")
        setIsCompleted(false)
        startInventory()
    }, [isOpen, startInventory])

    const refreshProductCatalog = useCallback(async () => {
        setIsRefreshingCatalog(true)
        try {
            const products = await getProducts(clubId)
            setAllProducts(products.map((product) => ({
                id: product.id,
                name: product.name,
                barcode: product.barcode,
                barcodes: product.barcodes
            })))
        } catch (error) {
            console.error(error)
        } finally {
            setIsRefreshingCatalog(false)
        }
    }, [clubId])

    const openAddDialog = useCallback(async () => {
        setIsAddDialogOpen(true)
        await refreshProductCatalog()
    }, [refreshProductCatalog])

    const refreshInventoryList = useCallback(async () => {
        if (!inventoryId) return
        startTransition(async () => {
            try {
                const items = await getInventoryItems(inventoryId)
                setInventoryItems((prev) => items.map((newItem) => {
                    const existing = prev.find((candidate) => candidate.id === newItem.id)
                    return {
                        ...newItem,
                        actual_stock: existing?.actual_stock ?? newItem.actual_stock,
                        is_visible: existing?.is_visible ?? (newItem.actual_stock !== null),
                        last_modified: existing?.last_modified
                    }
                }))
            } catch (error) {
                console.error(error)
            }
        })
    }, [inventoryId])

    const handleBarcodeScan = useCallback(async (barcode: string) => {
        const localItem = inventoryItems.find((item) => item.barcode === barcode || item.barcodes?.includes(barcode))
        if (localItem) {
            setInventoryItems((prev) => prev.map((item) => (
                item.id === localItem.id
                    ? { ...item, actual_stock: Number(item.actual_stock || 0) + 1, is_visible: true, last_modified: Date.now() }
                    : item
            )))
            return true
        }

        try {
            const product = await getProductByBarcode(clubId, barcode)
            if (!product || !inventoryId) {
                notifyError("Товар с таким штрихкодом не найден")
                return false
            }

            const existing = inventoryItems.find((item) => item.product_id === product.id)
            if (existing) {
                setInventoryItems((prev) => prev.map((item) => (
                    item.id === existing.id
                        ? {
                            ...item,
                            actual_stock: Number(item.actual_stock || 0) + 1,
                            is_visible: true,
                            last_modified: Date.now(),
                            barcode: product.barcode,
                            barcodes: product.barcodes
                        }
                        : item
                )))
                return true
            }

            const addResult = await addProductToInventorySafe(inventoryId, product.id)
            if (!addResult.ok) {
                notifyError(addResult.error)
                return false
            }

            const items = await getInventoryItems(inventoryId)
            setInventoryItems(items.map((item) => {
                const oldItem = inventoryItems.find((candidate) => candidate.id === item.id)
                const isNew = item.product_id === product.id
                return {
                    ...item,
                    actual_stock: isNew ? 1 : (oldItem?.actual_stock ?? item.actual_stock),
                    is_visible: isNew ? true : oldItem?.is_visible ?? false,
                    last_modified: isNew ? Date.now() : oldItem?.last_modified
                }
            }))
            return true
        } catch (error) {
            console.error(error)
            return false
        }
    }, [clubId, inventoryId, inventoryItems, notifyError])

    const handleAddProductManually = useCallback(async () => {
        const productId = Number(selectedProductToAdd)
        if (!productId || !inventoryId) return

        startTransition(async () => {
            try {
                const addResult = await addProductToInventorySafe(inventoryId, productId)
                if (!addResult.ok) {
                    notifyError(addResult.error)
                    return
                }
                const items = await getInventoryItems(inventoryId)
                setInventoryItems(items.map((item) => {
                    const oldItem = inventoryItems.find((candidate) => candidate.id === item.id)
                    const isNew = item.product_id === productId
                    return {
                        ...item,
                        actual_stock: isNew ? 1 : (oldItem?.actual_stock ?? item.actual_stock),
                        is_visible: isNew ? true : oldItem?.is_visible ?? false,
                        last_modified: isNew ? Date.now() : oldItem?.last_modified
                    }
                }))
                setIsAddDialogOpen(false)
                setSelectedProductToAdd("")
            } catch (error: any) {
                notifyError(error.message || "Не удалось добавить товар")
            }
        })
    }, [inventoryId, inventoryItems, notifyError, selectedProductToAdd])

    const handleRemoveItem = useCallback((item: StockCountWorkspaceItem) => {
        setInventoryItems((prev) => prev.map((candidate) => (
            String(candidate.id) === item.id
                ? { ...candidate, actual_stock: null, is_visible: false }
                : candidate
        )))
    }, [])

    const inventoryWorkspaceItems = useMemo<StockCountWorkspaceItem[]>(() => (
        inventoryItems
            .filter((item) => item.is_visible)
            .map((item) => ({
                id: String(item.id),
                groupId: "start-inventory",
                groupLabel: "Стартовый пересчет",
                productId: item.product_id,
                productName: item.product_name,
                barcode: item.barcode,
                barcodes: item.barcodes,
                systemQuantity: Number(item.expected_stock || 0),
                countedQuantity: item.actual_stock,
                sellingPrice: Number(item.selling_price_snapshot || 0),
                removable: true
            }))
    ), [inventoryItems])

    const handleWorkspaceItemsChange = useCallback((nextItems: StockCountWorkspaceItem[]) => {
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

    const forgottenItems = useMemo(() => inventoryItems.filter((item) => item.is_visible && item.actual_stock === null), [inventoryItems])

    const handleInventorySubmit = useCallback(() => {
        startTransition(async () => {
            try {
                const itemsToUpdate = inventoryItems
                    .filter((item) => item.actual_stock !== null)
                    .map((item) => ({ id: item.id, actual_stock: item.actual_stock }))

                if (itemsToUpdate.length > 0) {
                    const saveResult = await bulkUpdateInventoryItemsSafe(itemsToUpdate, clubId)
                    if (!saveResult.ok) {
                        notifyError(saveResult.error)
                        return
                    }
                }

                const refreshedItems = inventoryId ? await getInventoryItems(inventoryId) : inventoryItems
                const mergedItems = refreshedItems.map((item) => {
                    const existing = inventoryItems.find((current) => current.id === item.id)
                    return {
                        ...item,
                        actual_stock: existing?.actual_stock ?? item.actual_stock,
                        is_visible: existing?.is_visible ?? (item.actual_stock !== null),
                        last_modified: existing?.last_modified
                    }
                })
                setInventoryItems(mergedItems)
                setInventorySummary(summarizeInventory(mergedItems))
                setStep(2)
            } catch (error) {
                console.error(error)
                notifyError("Ошибка сохранения стартовой инвентаризации")
            }
        })
    }, [clubId, inventoryId, inventoryItems, notifyError])

    const markAllForgottenAsZero = useCallback(() => {
        setInventoryItems((prev) => prev.map((item) => (
            item.actual_stock === null && item.is_visible
                ? { ...item, actual_stock: 0, last_modified: Date.now() }
                : item
        )))
    }, [])

    const handleFinalize = useCallback(() => {
        if (!inventoryId) return
        if (forgottenItems.length > 0) {
            showMessage({
                title: "Инвентаризация не завершена",
                description: `Укажите остаток еще для ${forgottenItems.length} товаров, даже если это 0.`
            })
            setStep(1)
            return
        }

        startTransition(async () => {
            const result = await closeInventorySafe(inventoryId, clubId, 0, [], { salesRecognition: 'NONE' })
            if (!result.ok) {
                notifyError(result.error)
                return
            }
            setIsCompleted(true)
            await onComplete()
        })
    }, [clubId, forgottenItems.length, inventoryId, notifyError, onComplete, showMessage])

    const handleAbort = useCallback(() => {
        if (!allowAbort) return
        startTransition(async () => {
            try {
                if (inventoryId && !isCompleted) {
                    await cancelInventory(inventoryId, clubId, userId)
                }
            } catch (error) {
                console.error(error)
            } finally {
                onClose()
            }
        })
    }, [allowAbort, clubId, inventoryId, isCompleted, onClose, userId])

    if (!isOpen) return null

    return createPortal(
        <>
            <div className="fixed inset-0 h-[100dvh] bg-slate-950 text-primary-foreground flex flex-col z-[9999] overflow-hidden overscroll-none">
                <header className="px-4 py-4 border-b border-slate-800 bg-primary/50 backdrop-blur-md sticky top-0 z-50">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-lg font-bold truncate">
                                {step === 1 ? "Стартовая инвентаризация" : "Подтверждение инвентаризации"}
                            </h2>
                            {allowAbort && (
                                <Button variant="outline" size="icon" onClick={handleAbort} className="border-slate-700 h-10 w-10 rounded-xl shrink-0">
                                    <X className="h-5 w-5" />
                                </Button>
                            )}
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${step === 1 ? 50 : 100}%` }} />
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto px-4 py-6">
                    {step === 1 && (
                        <div className="space-y-6 max-w-4xl mx-auto pb-20">
                            <StockCountWorkspace
                                title="Стартовый пересчет"
                                description="Сверьте принятые остатки с фактом. До завершения приемки работа с баром заблокирована."
                                items={inventoryWorkspaceItems}
                                onItemsChange={handleWorkspaceItemsChange}
                                onBarcodeScan={handleBarcodeScan}
                                onRemoveItem={handleRemoveItem}
                                blindMode={false}
                                toolbarActions={
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="border-slate-700 text-primary-foreground"
                                            onClick={refreshInventoryList}
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
                                discrepancyMessage="На следующем шаге система покажет стартовые расхождения по остаткам."
                            />
                        </div>
                    )}

                    {step === 2 && inventorySummary && (
                        <div className="space-y-6 max-w-2xl mx-auto pb-20">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-primary/50 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Проверено товаров</span>
                                    <div className="text-xl font-bold mt-1">{inventorySummary.countedItems}</div>
                                </div>
                                <div className="bg-primary/50 p-4 rounded-2xl border border-slate-800">
                                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Расхождений</span>
                                    <div className="text-xl font-bold mt-1">{inventorySummary.discrepancyItems}</div>
                                </div>
                            </div>

                            <div className={cn(
                                "p-5 rounded-2xl border",
                                inventorySummary.isPerfect
                                    ? "bg-green-900/20 border-green-500/30"
                                    : "bg-yellow-900/20 border-yellow-500/30"
                            )}>
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "p-2 rounded-xl mt-0.5",
                                        inventorySummary.isPerfect ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                                    )}>
                                        <CheckCircle2 className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold flex justify-between items-center">
                                            <span>{inventorySummary.isPerfect ? "Остатки подтверждены" : "Найдены расхождения на старте"}</span>
                                            <span className="text-xl font-black">{inventorySummary.discrepancyQuantity} шт.</span>
                                        </div>
                                        <p className="text-xs opacity-80 mt-1 leading-relaxed">
                                            {inventorySummary.isPerfect
                                                ? "Остатки на старте смены подтверждены. Можно продолжать работу."
                                                : "На старте смены найдены расхождения по остаткам. Проверьте данные перед продолжением работы."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {forgottenItems.length > 0 && (
                                <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-2xl space-y-3">
                                    <div className="font-bold text-red-300">Не все товары посчитаны</div>
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto">
                                        {forgottenItems.map((item) => (
                                            <div key={item.id} className="flex justify-between items-center text-[11px]">
                                                <span className="text-slate-300">{item.product_name}</span>
                                                <span className="text-muted-foreground italic">Ожидалось: {item.expected_stock} шт.</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={() => setStep(1)} variant="outline" className="flex-1 h-10 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10">
                                            Вернуться к пересчету
                                        </Button>
                                        <Button onClick={markAllForgottenAsZero} variant="ghost" className="flex-1 h-10 text-xs text-red-500 hover:bg-red-500/10">
                                            Этих товаров нет (0)
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>

                <footer className="p-4 pb-safe border-t border-slate-800 bg-primary/80 backdrop-blur-md sticky bottom-0 z-50">
                    {step === 1 ? (
                        <Button onClick={handleInventorySubmit} disabled={isPending} className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-900/20">
                            Далее: Подтверждение
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    ) : (
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setStep(1)}
                                className="h-14 w-14 border-slate-800 text-muted-foreground/70 hover:bg-primary/90 rounded-2xl shrink-0"
                            >
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                            <Button onClick={handleFinalize} disabled={isPending} className="flex-1 h-14 text-lg font-bold bg-green-600 hover:bg-green-700 rounded-2xl shadow-lg shadow-green-900/20">
                                {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                                Подтвердить старт
                            </Button>
                        </div>
                    )}
                </footer>

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
                                <SelectContent className="bg-primary border-slate-800">
                                    {allProducts.map((product) => (
                                        <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>
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
            {Dialogs}
        </>,
        document.body
    )
}
