"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Plus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getHandoverSourceCandidates, getProducts, getShiftAccountabilityWarehouses, getShiftZoneSnapshotDraft, saveShiftZoneSnapshot, type HandoverSourceCandidate, type ShiftZoneSnapshotDraftItem, type ShiftZoneSnapshotType } from "@/app/clubs/[clubId]/inventory/actions"
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs"
import { StockCountWorkspace, type StockCountWorkspaceItem } from "@/app/clubs/[clubId]/inventory/_components/StockCountWorkspace"

type ShiftZoneSnapshotWizardProps = {
    isOpen: boolean
    clubId: string
    shiftId: string
    snapshotType: ShiftZoneSnapshotType
    blindCloseMode?: boolean
    onClose: () => void
    onComplete: () => void | Promise<void>
    allowSkip?: boolean
}

export function ShiftZoneSnapshotWizard({
    isOpen,
    clubId,
    shiftId,
    snapshotType,
    blindCloseMode = false,
    onClose,
    onComplete,
    allowSkip = false
}: ShiftZoneSnapshotWizardProps) {
    const { showMessage, Dialogs } = useUiDialogs()
    const [isPending, startTransition] = useTransition()
    const [isLoading, setIsLoading] = useState(false)
    const [items, setItems] = useState<ShiftZoneSnapshotDraftItem[]>([])
    const [warehouses, setWarehouses] = useState<Array<{ id: number, name: string, shift_zone_key: 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM', shift_zone_label: string }>>([])
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [selectedWarehouseId, setSelectedWarehouseId] = useState("")
    const [selectedProductId, setSelectedProductId] = useState("")
    const [handoverSourceCandidates, setHandoverSourceCandidates] = useState<HandoverSourceCandidate[]>([])
    const [selectedHandoverSourceShiftId, setSelectedHandoverSourceShiftId] = useState("")
    const [allProducts, setAllProducts] = useState<Array<{ id: number, name: string, barcode?: string | null, barcodes?: string[] | null, selling_price?: number }>>([])
    const onCloseRef = useRef(onClose)
    const showMessageRef = useRef(showMessage)
    const draftStorageKey = `shift-zone-snapshot:${clubId}:${shiftId}:${snapshotType}`

    useEffect(() => {
        onCloseRef.current = onClose
        showMessageRef.current = showMessage
    }, [onClose, showMessage])

    useEffect(() => {
        if (!isOpen) return
        let disposed = false
        setIsLoading(true)
        Promise.all([
            getShiftZoneSnapshotDraft(clubId, shiftId, snapshotType),
            getShiftAccountabilityWarehouses(clubId),
            snapshotType === "OPEN" ? getHandoverSourceCandidates(clubId, shiftId) : Promise.resolve([])
        ])
            .then(([rows, availableWarehouses, sourceCandidates]) => {
                if (!disposed) {
                    let nextItems = rows
                    let nextSelectedSourceShiftId = sourceCandidates?.find((candidate) => !candidate.is_self_handover)?.shift_id
                        || sourceCandidates?.[0]?.shift_id
                        || ""

                    try {
                        const savedDraftRaw = window.localStorage.getItem(draftStorageKey)
                        if (savedDraftRaw) {
                            const savedDraft = JSON.parse(savedDraftRaw) as {
                                items?: Array<{ warehouse_id: number, product_id: number, counted_quantity: number }>
                                selected_handover_source_shift_id?: string
                            }
                            if (Array.isArray(savedDraft.items)) {
                                const savedQuantities = new Map(
                                    savedDraft.items.map((item) => [`${item.warehouse_id}:${item.product_id}`, Number(item.counted_quantity || 0)])
                                )
                                nextItems = rows.map((item) => ({
                                    ...item,
                                    counted_quantity: savedQuantities.has(`${item.warehouse_id}:${item.product_id}`)
                                        ? Number(savedQuantities.get(`${item.warehouse_id}:${item.product_id}`) || 0)
                                        : item.counted_quantity
                                }))
                            }
                            if (savedDraft.selected_handover_source_shift_id) {
                                nextSelectedSourceShiftId = savedDraft.selected_handover_source_shift_id
                            }
                        }
                    } catch (error) {
                        console.error("Failed to restore shift snapshot draft", error)
                    }

                    if (snapshotType === "CLOSE" && blindCloseMode) {
                        nextItems = nextItems.map((item) => ({
                            ...item,
                            counted_quantity: item.saved_counted_quantity === null ? null : item.counted_quantity
                        }))
                    }

                    setItems(nextItems)
                    setWarehouses(availableWarehouses as any)
                    setHandoverSourceCandidates(sourceCandidates as HandoverSourceCandidate[])
                    setSelectedHandoverSourceShiftId(nextSelectedSourceShiftId)
                    if (availableWarehouses.length === 1) {
                        setSelectedWarehouseId(String(availableWarehouses[0].id))
                    }
                }
            })
            .catch((error) => {
                console.error(error)
                if (!disposed) {
                    showMessageRef.current({
                        title: "Ошибка",
                        description: error instanceof Error ? error.message : "Не удалось загрузить передачу остатков"
                    })
                    onCloseRef.current()
                }
            })
            .finally(() => {
                if (!disposed) setIsLoading(false)
            })

        return () => {
            disposed = true
        }
    }, [blindCloseMode, clubId, draftStorageKey, isOpen, shiftId, snapshotType])

    useEffect(() => {
        if (!isOpen || isLoading) return
        try {
            window.localStorage.setItem(
                draftStorageKey,
                JSON.stringify({
                    items: items.map((item) => ({
                        warehouse_id: item.warehouse_id,
                        product_id: item.product_id,
                        counted_quantity: item.counted_quantity,
                    })),
                    selected_handover_source_shift_id: selectedHandoverSourceShiftId || null,
                })
            )
        } catch (error) {
            console.error("Failed to persist shift snapshot draft", error)
        }
    }, [draftStorageKey, isLoading, isOpen, items, selectedHandoverSourceShiftId])

    const workspaceItems = useMemo<StockCountWorkspaceItem[]>(() => (
        items.map((item) => ({
            id: `${item.warehouse_id}:${item.product_id}`,
            groupId: String(item.warehouse_id),
            groupLabel: `${item.warehouse_name} · ${item.shift_zone_label}`,
            productId: item.product_id,
            productName: item.product_name,
            barcode: item.barcode,
            barcodes: item.barcodes,
            countedQuantity: item.counted_quantity,
            systemQuantity: item.system_quantity,
            sellingPrice: item.selling_price
        }))
    ), [items])

    const handleSave = () => {
        startTransition(async () => {
            try {
                await saveShiftZoneSnapshot(
                    clubId,
                    shiftId,
                    snapshotType,
                    warehouses.map((warehouse) => ({
                        warehouse_id: warehouse.id,
                        items: items
                            .filter((item) => item.warehouse_id === warehouse.id)
                            .map((item) => ({
                            product_id: item.product_id,
                            counted_quantity: Math.max(0, Math.trunc(Number(item.counted_quantity) || 0))
                        }))
                    })),
                    snapshotType === "OPEN" ? { accepted_from_shift_id: selectedHandoverSourceShiftId || null } : undefined
                )
                window.localStorage.removeItem(draftStorageKey)
                await onComplete()
                onClose()
            } catch (error) {
                console.error(error)
                showMessage({
                    title: "Ошибка",
                    description: error instanceof Error ? error.message : "Не удалось сохранить приемку или сдачу остатков"
                })
            }
        })
    }

    const handleWorkspaceItemsChange = (nextItems: StockCountWorkspaceItem[]) => {
        setItems((prev) => prev.map((item) => {
            const next = nextItems.find((candidate) => candidate.id === `${item.warehouse_id}:${item.product_id}`)
            return next ? { ...item, counted_quantity: next.countedQuantity ?? 0 } : item
        }))
    }

    const openAddDialog = async () => {
        setIsAddDialogOpen(true)
        if (allProducts.length > 0) return
        try {
            const products = await getProducts(clubId)
            setAllProducts(products.map((product) => ({
                id: product.id,
                name: product.name,
                barcode: product.barcode,
                barcodes: product.barcodes,
                selling_price: product.selling_price
            })))
        } catch (error) {
            console.error(error)
            showMessage({
                title: "Ошибка",
                description: "Не удалось загрузить каталог товаров"
            })
        }
    }

    const handleAddProductManually = () => {
        const warehouseId = Number(selectedWarehouseId)
        const productId = Number(selectedProductId)
        const warehouse = warehouses.find((item) => item.id === warehouseId)
        const product = allProducts.find((item) => item.id === productId)
        if (!warehouse || !product) return

        const existing = items.find((item) => item.warehouse_id === warehouseId && item.product_id === productId)
        if (existing) {
            setItems((prev) => prev.map((item) => (
                item.warehouse_id === warehouseId && item.product_id === productId
                    ? { ...item, counted_quantity: Number(item.counted_quantity || 0) + 1 }
                    : item
            )))
        } else {
            setItems((prev) => [
                ...prev,
                {
                    warehouse_id: warehouse.id,
                    warehouse_name: warehouse.name,
                    shift_zone_key: warehouse.shift_zone_key,
                    shift_zone_label: warehouse.shift_zone_label,
                    product_id: product.id,
                    product_name: product.name,
                    barcode: product.barcode,
                    barcodes: product.barcodes,
                    counted_quantity: 1,
                    saved_counted_quantity: null,
                    system_quantity: 0,
                    selling_price: Number(product.selling_price || 0)
                }
            ])
        }

        setIsAddDialogOpen(false)
        setSelectedProductId("")
    }

    const title = snapshotType === "OPEN" ? "Приемка остатков на старте смены" : "Сдача остатков в конце смены"
    const description = snapshotType === "OPEN"
        ? "Подтвердите фактические остатки по складам, которые эта смена принимает под ответственность."
        : "Проведите слепую сдачу остатков перед завершением смены."

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => {
                if (!open && allowSkip && !isPending) onClose()
            }}>
                <DialogContent className="h-screen w-screen max-w-none rounded-none border-slate-800 bg-slate-950 p-0 text-primary-foreground">
                    <div className="flex h-full flex-col overflow-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-[max(env(safe-area-inset-top),12px)] sm:p-6">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription className="text-muted-foreground/70">
                            {description}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 flex-1 overflow-y-auto pr-0 sm:pr-2">
                    {isLoading ? (
                        <div className="py-16 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
                        </div>
                    ) : warehouses.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-muted-foreground/70">
                            Для этой смены не настроены склады для передачи остатков.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {snapshotType === "OPEN" && (
                                <div className="rounded-2xl border border-slate-800 bg-primary/60 p-3 sm:p-4">
                                    <div className="mb-2 text-sm font-semibold text-primary-foreground">У какой смены принимаешь остатки</div>
                                    {handoverSourceCandidates.length > 0 ? (
                                        <Select value={selectedHandoverSourceShiftId} onValueChange={setSelectedHandoverSourceShiftId}>
                                            <SelectTrigger className="h-11 border-slate-700 bg-slate-950 text-primary-foreground sm:h-10">
                                                <SelectValue placeholder="Выберите смену-источник" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {handoverSourceCandidates.map((candidate) => (
                                                    <SelectItem key={candidate.shift_id} value={candidate.shift_id}>
                                                        {candidate.employee_name}
                                                        {candidate.is_self_handover ? " · самоприемка" : ""}
                                                        {" · закрыта "}
                                                        {new Date(candidate.check_out).toLocaleString("ru-RU")}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="text-sm text-muted-foreground/70">
                                            Подходящих закрытых смен до этой приемки не найдено. Приемка сохранится без привязки к предыдущей смене.
                                        </div>
                                    )}
                                </div>
                            )}

                            <StockCountWorkspace
                                title={snapshotType === "OPEN" ? "Приемка остатков" : "Сдача остатков"}
                                description={description}
                                items={workspaceItems}
                                onItemsChange={handleWorkspaceItemsChange}
                                blindMode={snapshotType === "CLOSE" && blindCloseMode}
                                toolbarActions={
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-11 w-full border-border bg-card text-foreground hover:bg-accent hover:text-foreground sm:h-10 sm:w-auto"
                                        onClick={openAddDialog}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Добавить товар
                                    </Button>
                                }
                                emptyStateMessage="Список склада пуст. Добавь товар вручную или дождись движения по складу."
                            />
                        </div>
                    )}
                    </div>

                    <DialogFooter className="mt-4 shrink-0 border-t border-slate-800 bg-slate-950/95 pt-4 backdrop-blur sm:border-t-0 sm:bg-transparent sm:pt-0">
                        {allowSkip && (
                            <Button variant="outline" className="h-11 border-slate-700 text-primary-foreground sm:h-10" onClick={onClose} disabled={isPending}>
                                Позже
                            </Button>
                        )}
                        <Button
                            onClick={handleSave}
                            disabled={isPending || isLoading || warehouses.length === 0 || (snapshotType === "OPEN" && handoverSourceCandidates.length > 0 && !selectedHandoverSourceShiftId)}
                            className="h-11 bg-blue-600 hover:bg-blue-700 sm:h-10"
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {snapshotType === "OPEN" ? "Принять бар и вернуться" : "Сдать бар и вернуться"}
                        </Button>
                    </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-[96vw] rounded-2xl border-slate-800 bg-slate-950 text-primary-foreground sm:max-w-[90vw]">
                    <DialogHeader>
                        <DialogTitle>Добавить товар в передачу остатков</DialogTitle>
                        <DialogDescription className="text-muted-foreground/70">
                            Если товар физически есть на складе, но еще не попал в список, добавь его вручную.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <div className="text-sm text-slate-300">Склад</div>
                            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                                <SelectTrigger className="bg-primary border-slate-800 h-12 rounded-xl">
                                    <SelectValue placeholder="Выберите склад..." />
                                </SelectTrigger>
                                <SelectContent className="bg-primary border-slate-800">
                                    {warehouses.map((warehouse) => (
                                        <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                                            {warehouse.name} · {warehouse.shift_zone_label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm text-slate-300">Товар</div>
                            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                <SelectTrigger className="bg-primary border-slate-800 h-12 rounded-xl">
                                    <SelectValue placeholder="Выберите товар..." />
                                </SelectTrigger>
                                <SelectContent className="bg-primary border-slate-800 max-h-[320px]">
                                    {allProducts.map((product) => (
                                        <SelectItem key={product.id} value={String(product.id)}>
                                            {product.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="flex-row gap-3">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1 border-slate-700 text-primary-foreground">
                            Отмена
                        </Button>
                        <Button
                            onClick={handleAddProductManually}
                            disabled={!selectedWarehouseId || !selectedProductId}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                            Добавить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {Dialogs}
        </>
    )
}
