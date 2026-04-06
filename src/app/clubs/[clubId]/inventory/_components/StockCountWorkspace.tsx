"use client"

import { ReactNode, useEffect, useMemo, useState } from "react"
import { Search, ScanLine, Package2, AlertTriangle, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BarcodeScanner } from "@/app/clubs/[clubId]/inventory/_components/BarcodeScanner"
import { cn } from "@/lib/utils"

export type StockCountWorkspaceItem = {
    id: string
    groupId: string
    groupLabel: string
    productId: number
    productName: string
    barcode?: string | null
    barcodes?: string[] | null
    systemQuantity: number
    countedQuantity: number | null
    sellingPrice?: number
    removable?: boolean
}

type StockCountWorkspaceProps = {
    title?: string
    description?: string
    items: StockCountWorkspaceItem[]
    onItemsChange: (items: StockCountWorkspaceItem[]) => void
    onBarcodeScan?: (barcode: string) => Promise<boolean> | boolean
    onRemoveItem?: (item: StockCountWorkspaceItem) => void
    toolbarActions?: ReactNode
    discrepancyMessage?: string
    emptyStateMessage?: string
    blindMode?: boolean
}

function translateLayout(text: string) {
    const ru = "йцукенгшщзхъфывапролджэячсмитьбю.ЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,"
    const en = "qwertyuiop[]asdfghjkl;'zxcvbnm,./QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?"

    const remap = (source: string, from: string, to: string) =>
        source.split("").map((char) => {
            const index = from.indexOf(char)
            return index >= 0 ? to[index] : char
        }).join("")

    return {
        original: text.toLowerCase(),
        ru: remap(text, en, ru).toLowerCase(),
        en: remap(text, ru, en).toLowerCase()
    }
}

export function StockCountWorkspace({
    title = "Подсчет товаров",
    description,
    items,
    onItemsChange,
    onBarcodeScan,
    onRemoveItem,
    toolbarActions,
    discrepancyMessage = "Система видит расхождения. На следующем шаге они попадут в итоговый отчет.",
    emptyStateMessage = "Ничего не найдено по текущему запросу.",
    blindMode = false
}: StockCountWorkspaceProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [scannedItemId, setScannedItemId] = useState<string | null>(null)

    const filteredItems = useMemo(() => {
        const q = searchQuery.trim()
        if (!q) return items

        const queries = translateLayout(q)
        return items.filter((item) => {
            const name = item.productName.toLowerCase()
            const barcode = item.barcode || ""
            const barcodes = item.barcodes || []
            return (
                name.includes(queries.original) ||
                name.includes(queries.ru) ||
                name.includes(queries.en) ||
                barcode.includes(queries.original) ||
                barcodes.some((value) => value.includes(queries.original))
            )
        })
    }, [items, searchQuery])

    const groupedItems = useMemo(() => {
        const groups = new Map<string, { label: string, items: StockCountWorkspaceItem[] }>()
        for (const item of filteredItems) {
            if (!groups.has(item.groupId)) {
                groups.set(item.groupId, { label: item.groupLabel, items: [] })
            }
            groups.get(item.groupId)!.items.push(item)
        }
        return Array.from(groups.entries())
    }, [filteredItems])

    const summary = useMemo(() => {
        const total = items.length
        const counted = items.filter((item) => item.countedQuantity !== null && item.countedQuantity !== undefined).length
        const discrepancy = items.filter((item) => item.countedQuantity !== item.systemQuantity).length
        return {
            total,
            counted,
            discrepancy,
            progress: total === 0 ? 0 : Math.round((counted / total) * 100)
        }
    }, [items])

    const updateQuantity = (itemId: string, nextValue: number | null) => {
        onItemsChange(items.map((item) => (
            item.id === itemId
                ? {
                    ...item,
                    countedQuantity: nextValue === null
                        ? null
                        : Math.max(0, Math.trunc(Number(nextValue) || 0))
                }
                : item
        )))
    }

    const handleScan = async (barcode: string) => {
        const matched = items.find((item) =>
            item.barcode === barcode || item.barcodes?.includes(barcode)
        )
        if (!matched) {
            return onBarcodeScan ? await onBarcodeScan(barcode) : false
        }

        const current = Number(matched.countedQuantity || 0)
        updateQuantity(matched.id, current + 1)
        setScannedItemId(matched.id)
        return true
    }

    useEffect(() => {
        if (!scannedItemId) return
        const node = document.getElementById(`stock-count-input-${scannedItemId}`)
        if (node) {
            node.scrollIntoView({ behavior: "smooth", block: "center" })
            node.focus()
            // @ts-ignore
            node.select?.()
        }
    }, [scannedItemId])

    return (
        <div className="space-y-4">
            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScan}
            />

            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="text-lg font-bold text-white">{title}</div>
                        {description && <div className="text-sm text-slate-400">{description}</div>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-slate-700 text-slate-300">
                            {summary.counted}/{summary.total} посчитано
                        </Badge>
                        <Badge variant="outline" className="border-slate-700 text-slate-300">
                            {summary.progress}% готово
                        </Badge>
                        {!blindMode && (
                            <Badge variant="outline" className={cn("border-slate-700", summary.discrepancy > 0 ? "text-amber-300" : "text-emerald-300")}>
                                {summary.discrepancy} с расхождением
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div className="relative">
                        <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск по названию или штрихкоду"
                            className="pl-10 bg-slate-950 border-slate-700 text-white"
                        />
                    </div>
                    <Button type="button" variant="outline" className="h-11 justify-center border-slate-200 bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 md:h-10" onClick={() => setIsScannerOpen(true)}>
                        <ScanLine className="mr-2 h-4 w-4" />
                        Сканер
                    </Button>
                </div>

                {toolbarActions && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        {toolbarActions}
                    </div>
                )}
            </div>

            <div className="space-y-4 overflow-auto pr-0 sm:pr-1">
                {groupedItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                        {emptyStateMessage}
                    </div>
                ) : (
                    groupedItems.map(([groupId, group]) => (
                        <div key={groupId} className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <Package2 className="h-4 w-4 text-slate-400" />
                                    <div className="font-semibold text-white">{group.label}</div>
                                </div>
                                <Badge variant="outline" className="border-slate-700 text-slate-300">
                                    {group.items.length} поз.
                                </Badge>
                            </div>

                            <div className="divide-y divide-slate-800">
                                {group.items.map((item) => {
                                    const difference = item.countedQuantity === null
                                        ? null
                                        : Number(item.countedQuantity || 0) - Number(item.systemQuantity || 0)
                                    const isScanned = scannedItemId === item.id
                                    return (
                                        <div key={item.id} className={cn(
                                            "px-3 py-3 transition-colors sm:px-4",
                                            blindMode
                                                ? "grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px] sm:items-center"
                                                : "grid gap-3 sm:grid-cols-[minmax(0,1fr)_88px_88px_120px] sm:items-center",
                                            isScanned && "bg-blue-500/10",
                                        )}>
                                            <div className="min-w-0 space-y-3 sm:space-y-0">
                                                <div className="flex items-center gap-2">
                                                    {onRemoveItem && item.removable && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 shrink-0 text-slate-500 hover:text-red-400 hover:bg-red-400/10"
                                                            onClick={() => onRemoveItem(item)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <div className="truncate font-medium text-white">{item.productName}</div>
                                                </div>
                                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                                                    {item.barcode && <span>ШК: {item.barcode}</span>}
                                                    {typeof item.sellingPrice === "number" && <span>{item.sellingPrice.toLocaleString("ru-RU")} ₽</span>}
                                                </div>
                                                <div className={cn(
                                                    "grid grid-cols-2 gap-3 sm:hidden",
                                                    blindMode && "grid-cols-1"
                                                )}>
                                                    {!blindMode && (
                                                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                                                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Система</div>
                                                            <div className="font-semibold text-slate-300 tabular-nums">{item.systemQuantity}</div>
                                                        </div>
                                                    )}
                                                    {!blindMode && (
                                                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                                                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Разница</div>
                                                            {difference === null ? (
                                                                <div className="font-semibold tabular-nums text-slate-500">—</div>
                                                            ) : (
                                                                <div className={cn(
                                                                    "font-semibold tabular-nums",
                                                                    difference === 0 ? "text-emerald-400" : difference > 0 ? "text-green-400" : "text-amber-300"
                                                                )}>
                                                                    {difference > 0 ? "+" : ""}{difference}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {!blindMode && (
                                                <div className="hidden text-right sm:block">
                                                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Система</div>
                                                    <div className="font-semibold text-slate-300 tabular-nums">{item.systemQuantity}</div>
                                                </div>
                                            )}
                                            {!blindMode && (
                                                <div className="hidden text-right sm:block">
                                                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Разница</div>
                                                    {difference === null ? (
                                                        <div className="font-semibold tabular-nums text-slate-500">—</div>
                                                    ) : (
                                                        <div className={cn(
                                                            "font-semibold tabular-nums",
                                                            difference === 0 ? "text-emerald-400" : difference > 0 ? "text-green-400" : "text-amber-300"
                                                        )}>
                                                            {difference > 0 ? "+" : ""}{difference}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div>
                                                <Input
                                                    id={`stock-count-input-${item.id}`}
                                                    type="number"
                                                    min={0}
                                                    value={item.countedQuantity ?? ""}
                                                    onChange={(e) => updateQuantity(item.id, e.target.value === "" ? null : Number(e.target.value))}
                                                    className={cn(
                                                        "h-11 bg-slate-950 border-slate-700 text-right text-white sm:h-10",
                                                        difference !== null && difference !== 0 && "border-amber-600/50"
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {!blindMode && summary.discrepancy > 0 && (
                <div className="rounded-2xl border border-amber-700/40 bg-amber-500/10 p-4 text-amber-100">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="text-sm">
                            Система видит {summary.discrepancy} поз. с расхождением. {discrepancyMessage}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
