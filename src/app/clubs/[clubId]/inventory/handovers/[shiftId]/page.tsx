"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, Wallet, PackageX, Info, PackageCheck, X } from "lucide-react"
import { PageHeader, PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface ShiftInfo {
    id: string
    employee_name: string
    check_in: string
    check_out: string | null
    status: string
}

interface HandoverSourceInfo {
    accepted_from_shift_id: string | null
    accepted_from_employee_id: string | null
    accepted_from_employee_name: string | null
    accepted_from_shift_check_in: string | null
    accepted_from_shift_check_out: string | null
}

interface ShiftZoneResolution {
    id: number
    resolution_type: "SALARY_DEDUCTION" | "LOSS"
    resolution_amount: number
    discrepancy_quantity: number
    unit_price: number
    notes?: string | null
    salary_payment_id?: number | null
    finance_transaction_id?: number | null
    resolved_by?: string
    resolved_by_name?: string | null
    resolved_at: string
}

interface ShiftZoneDiscrepancy {
    warehouse_id: number
    warehouse_name: string
    shift_zone_label: string
    product_id: number
    product_name: string
    selling_price: number
    opening_counted_quantity: number | null
    opening_system_quantity?: number | null
    inflow_quantity: number
    outflow_quantity: number
    expected_closing_quantity: number | null
    actual_closing_quantity: number | null
    closing_system_quantity?: number | null
    difference_quantity: number | null
    responsibility_type: string
    responsibility_label: string
    explanation: string
    movement_window_started_at: string | null
    movement_window_ended_at: string | null
    movements: Array<{
        created_at: string
        type: string
        change_amount: number
        reason: string | null
        related_entity_type: string | null
        related_entity_id: string | number | null
        shift_id: string | null
        user_id: string | null
    }>
    resolution?: ShiftZoneResolution | null
}

interface ShiftHandoverDetailsResponse {
    shift: ShiftInfo
    handover_source?: HandoverSourceInfo | null
    shift_zone_discrepancies: ShiftZoneDiscrepancy[]
}

function formatDateTime(value: string | null) {
    if (!value) return "—"
    return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function formatMoney(amount: number | string | null | undefined) {
    const num = Number(amount || 0)
    return `${num.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`
}

function getRowMode(row: ShiftZoneDiscrepancy) {
    const hasOpening = row.opening_counted_quantity !== null
    const hasClosing = row.actual_closing_quantity !== null
    if (hasOpening && hasClosing) return "full"
    if (hasOpening) return "open_only"
    if (hasClosing) return "close_only"
    return "unknown"
}

function hasOpeningDiscrepancy(row: ShiftZoneDiscrepancy) {
    return row.opening_counted_quantity !== null
        && row.opening_system_quantity !== null
        && Number(row.opening_counted_quantity) !== Number(row.opening_system_quantity)
}

function hasClosingDiscrepancy(row: ShiftZoneDiscrepancy) {
    return row.actual_closing_quantity !== null
        && row.expected_closing_quantity !== null
        && Number(row.actual_closing_quantity) !== Number(row.expected_closing_quantity)
}

function getDiscrepancyValue(row: ShiftZoneDiscrepancy) {
    return Number(row.difference_quantity || 0)
}

function isShortage(row: ShiftZoneDiscrepancy) {
    return getDiscrepancyValue(row) < 0
}

function isSurplus(row: ShiftZoneDiscrepancy) {
    return getDiscrepancyValue(row) > 0
}

function getMovementMeta(type: string) {
    if (type === "SALE") return { label: "Продажа", className: "border-red-200 bg-red-50 text-red-700" }
    if (type === "RETURN") return { label: "Возврат", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
    if (type === "TRANSFER") return { label: "Перемещение", className: "border-sky-200 bg-sky-50 text-sky-700" }
    if (type === "ADJUSTMENT") return { label: "Корректировка", className: "border-amber-200 bg-amber-50 text-amber-700" }
    if (type === "INVENTORY_GAIN") return { label: "Инв. излишек", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
    if (type === "INVENTORY_LOSS") return { label: "Инв. недостача", className: "border-rose-200 bg-rose-50 text-rose-700" }
    return { label: type, className: "border-border bg-muted text-foreground" }
}

function getBaseQuantity(row: ShiftZoneDiscrepancy) {
    const candidates = [row.opening_system_quantity, row.opening_counted_quantity]
    for (const c of candidates) {
        const v = Number(c)
        if (Number.isFinite(v)) return v
    }
    return null
}

function getExpectedQuantity(row: ShiftZoneDiscrepancy) {
    const expected = Number(row.expected_closing_quantity)
    if (Number.isFinite(expected)) return expected
    const base = getBaseQuantity(row)
    if (base === null) return null
    return base + Number(row.inflow_quantity || 0) - Number(row.outflow_quantity || 0)
}

function getActualQuantity(row: ShiftZoneDiscrepancy) {
    const candidates = [row.actual_closing_quantity, row.opening_counted_quantity]
    for (const c of candidates) {
        const v = Number(c)
        if (Number.isFinite(v)) return v
    }
    return null
}

function getMovementsShort(row: ShiftZoneDiscrepancy) {
    const movements = row.movements || []
    const salesCount = movements.filter((m) => m.type === "SALE").length
    if (salesCount > 0) return `${salesCount} продажи`
    if (movements.length > 0) return `${movements.length} движ.`
    return null
}

export default function InventoryHandoverDetailsPage() {
    const params = useParams<{ clubId: string; shiftId: string }>()
    const clubId = params.clubId
    const shiftId = params.shiftId

    const [details, setDetails] = useState<ShiftHandoverDetailsResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isResolutionDialogOpen, setIsResolutionDialogOpen] = useState(false)
    const [resolutionTarget, setResolutionTarget] = useState<ShiftZoneDiscrepancy | null>(null)
    const [resolutionType, setResolutionType] = useState<"SALARY_DEDUCTION" | "LOSS">("SALARY_DEDUCTION")
    const [resolutionMode, setResolutionMode] = useState<"full" | "custom">("full")
    const [resolutionAmount, setResolutionAmount] = useState("")
    const [resolutionNote, setResolutionNote] = useState("")
    const [isResolutionSaving, setIsResolutionSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<"open" | "close" | "full">("close")
    const [showOnlyUnresolved, setShowOnlyUnresolved] = useState(true)
    const [page, setPage] = useState(1)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [detailsTarget, setDetailsTarget] = useState<ShiftZoneDiscrepancy | null>(null)

    const fetchDetails = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts/${shiftId}`, { cache: "no-store" })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Не удалось загрузить детализацию передачи остатков")
                setDetails(null)
                return
            }
            setDetails({
                shift: data.shift,
                handover_source: data.handover_source || null,
                shift_zone_discrepancies: data.shift_zone_discrepancies || [],
            })
        } catch (requestError) {
            console.error("Error fetching handover details:", requestError)
            setError("Не удалось загрузить детализацию передачи остатков")
            setDetails(null)
        } finally {
            setIsLoading(false)
        }
    }, [clubId, shiftId])

    useEffect(() => {
        fetchDetails()
    }, [fetchDetails])

    const totalDiscrepancyAmount = useMemo(() => (
        (details?.shift_zone_discrepancies || []).reduce((sum, row) => (
            sum + (isShortage(row) ? Math.abs(getDiscrepancyValue(row)) * Number(row.selling_price || 0) : 0)
        ), 0)
    ), [details])

    const unresolvedCount = useMemo(() => (
        (details?.shift_zone_discrepancies || []).filter((row) => isShortage(row) && !row.resolution).length
    ), [details])

    const openingDiscrepancyRows = useMemo(
        () => (details?.shift_zone_discrepancies || []).filter((row) => hasOpeningDiscrepancy(row)),
        [details]
    )

    const closingDiscrepancyRows = useMemo(
        () => (details?.shift_zone_discrepancies || []).filter((row) => hasClosingDiscrepancy(row)),
        [details]
    )

    const fullCycleRows = useMemo(
        () => (details?.shift_zone_discrepancies || []).filter((row) => getRowMode(row) === "full"),
        [details]
    )

    useEffect(() => {
        if (!details) return
        const openCount = openingDiscrepancyRows.length
        const closeCount = closingDiscrepancyRows.length
        const fullCount = fullCycleRows.length
        if (closeCount > 0) setActiveTab("close")
        else if (openCount > 0) setActiveTab("open")
        else if (fullCount > 0) setActiveTab("full")
    }, [details, openingDiscrepancyRows.length, closingDiscrepancyRows.length, fullCycleRows.length])

    const currentRows = useMemo(() => {
        if (activeTab === "open") return openingDiscrepancyRows
        if (activeTab === "close") return closingDiscrepancyRows
        return fullCycleRows
    }, [activeTab, openingDiscrepancyRows, closingDiscrepancyRows, fullCycleRows])

    const filteredRows = useMemo(() => {
        if (!showOnlyUnresolved) return currentRows
        return currentRows.filter((row) => isShortage(row) && !row.resolution)
    }, [currentRows, showOnlyUnresolved])

    const getMaxResolutionAmount = useCallback((row: ShiftZoneDiscrepancy | null) => {
        if (!row) return 0
        if (!isShortage(row)) return 0
        return Number((Math.abs(getDiscrepancyValue(row)) * Number(row.selling_price || 0)).toFixed(2))
    }, [])

    const openResolutionDialog = useCallback((row: ShiftZoneDiscrepancy, type: "SALARY_DEDUCTION" | "LOSS") => {
        const maxAmount = getMaxResolutionAmount(row)
        setResolutionTarget(row)
        setResolutionType(type)
        setResolutionMode("full")
        setResolutionAmount(String(maxAmount))
        setResolutionNote("")
        setIsResolutionDialogOpen(true)
    }, [getMaxResolutionAmount])

    const closeResolutionDialog = useCallback(() => {
        if (isResolutionSaving) return
        setIsResolutionDialogOpen(false)
        setResolutionTarget(null)
        setResolutionType("SALARY_DEDUCTION")
        setResolutionMode("full")
        setResolutionAmount("")
        setResolutionNote("")
    }, [isResolutionSaving])

    const openDetailsDialog = useCallback((row: ShiftZoneDiscrepancy) => {
        setDetailsTarget(row)
        setIsDetailsOpen(true)
    }, [])

    const closeDetailsDialog = useCallback(() => {
        setIsDetailsOpen(false)
        setDetailsTarget(null)
    }, [])

    const renderMovementFeed = useCallback((row: ShiftZoneDiscrepancy) => {
        const movements = row.movements || []
        if (movements.length === 0) return (
            <div className="text-[11px] text-slate-400 italic py-2">
                Движений товара в этой смене не было.
            </div>
        )

        return (
            <div className="mt-3 space-y-1.5">
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">
                    Движения за смену
                </div>
                {movements.map((movement, index) => {
                    const meta = getMovementMeta(movement.type)
                    const amount = Number(movement.change_amount || 0)
                    return (
                        <div key={`${movement.created_at}-${movement.type}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 bg-white border rounded-lg shadow-sm">
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-none font-bold uppercase", meta.className)}>
                                        {meta.label}
                                    </Badge>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {formatDateTime(movement.created_at)}
                                    </span>
                                </div>
                                {movement.reason && (
                                    <span className="text-xs text-slate-600 truncate max-w-[200px] sm:max-w-[300px]">
                                        {movement.reason}
                                    </span>
                                )}
                            </div>
                            <span className={cn(
                                "text-sm font-black tabular-nums",
                                amount > 0 ? "text-emerald-600" : amount < 0 ? "text-rose-600" : "text-slate-400"
                            )}>
                                {amount > 0 ? "+" : ""}{amount}
                            </span>
                        </div>
                    )
                })}
            </div>
        )
    }, [])

    const handleResolve = useCallback(async () => {
        if (!resolutionTarget) return

        const maxAmount = getMaxResolutionAmount(resolutionTarget)
        const payload: Record<string, any> = {
            action: "resolve_zone_discrepancy",
            warehouse_id: resolutionTarget.warehouse_id,
            product_id: resolutionTarget.product_id,
            resolution_type: resolutionType,
            note: resolutionNote.trim() || undefined,
        }

        if (resolutionType === "SALARY_DEDUCTION") {
            const amount = resolutionMode === "full" ? maxAmount : Number(resolutionAmount)
            if (!Number.isFinite(amount) || amount <= 0) {
                alert("Укажи корректную сумму удержания")
                return
            }
            if (amount > maxAmount) {
                alert("Сумма удержания не может быть больше полной суммы расхождения")
                return
            }
            payload.amount = Number(amount.toFixed(2))
        }

        setIsResolutionSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts/${shiftId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Не удалось сохранить решение")
                return
            }
            await fetchDetails()
            closeResolutionDialog()
        } catch (requestError) {
            console.error("Error resolving handover discrepancy:", requestError)
            alert("Не удалось сохранить решение")
        } finally {
            setIsResolutionSaving(false)
        }
    }, [clubId, shiftId, resolutionTarget, resolutionType, resolutionNote, resolutionMode, resolutionAmount, getMaxResolutionAmount, fetchDetails, closeResolutionDialog])

    const renderResolution = useCallback((row: ShiftZoneDiscrepancy) => {
        if (!row.resolution) {
            if (isSurplus(row)) {
                return <span className="text-xs text-emerald-700">Излишек, удержание не требуется</span>
            }
            return <span className="text-xs text-muted-foreground">Не обработано</span>
        }
        return (
            <div className="space-y-1">
                <Badge variant="outline" className={cn(
                    row.resolution.resolution_type === "SALARY_DEDUCTION"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-border bg-muted text-foreground"
                )}>
                    {row.resolution.resolution_type === "SALARY_DEDUCTION"
                        ? `В счет ЗП · ${formatMoney(row.resolution.resolution_amount)}`
                        : `Потери клуба · ${formatMoney(row.resolution.resolution_amount)}`}
                </Badge>
                <div className="text-xs text-muted-foreground">
                    {formatDateTime(row.resolution.resolved_at)}
                    {row.resolution.resolved_by_name ? ` · ${row.resolution.resolved_by_name}` : ""}
                </div>
                {row.resolution.notes && (
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap">{row.resolution.notes}</div>
                )}
            </div>
        )
    }, [])

    const renderActions = useCallback((row: ShiftZoneDiscrepancy) => {
        if (row.resolution) {
            return <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Решение сохранено</span>
        }
        if (isSurplus(row)) {
            return <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Без удержания</span>
        }
        return (
            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => openResolutionDialog(row, "SALARY_DEDUCTION")}
                >
                    <Wallet className="mr-1.5 h-3.5 w-3.5" />
                    В счет ЗП
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => openResolutionDialog(row, "LOSS")}
                >
                    <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
                    В потери
                </Button>
            </div>
        )
    }, [openResolutionDialog])

    return (
        <PageShell maxWidth="7xl" className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
            <div className="flex-none pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button asChild variant="outline" size="sm" className="h-8 hidden md:inline-flex">
                            <Link href={`/clubs/${clubId}/inventory?tab=zones`}>
                                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                                Назад
                            </Link>
                        </Button>
                        <h1 className="text-lg font-black text-slate-900">Передача смены</h1>
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                        {details?.shift ? formatDateTime(details.shift.check_in) : "—"}
                    </div>
                </div>

                {isLoading ? (
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Загрузка...
                    </div>
                ) : error ? (
                    <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex justify-between items-center">
                        <span>{error}</span>
                        <Button variant="outline" size="sm" onClick={fetchDetails}>Повторить</Button>
                    </div>
                ) : details ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 pr-3 border-r">
                            <span className="font-black text-slate-900">{details.shift.employee_name}</span>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">принял от</span>
                            <span className="font-bold text-slate-700">{details.handover_source?.accepted_from_employee_name || "—"}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1.5">Риск</span>
                                <span className="font-black text-rose-600">{formatMoney(totalDiscrepancyAmount)}</span>
                            </div>
                            <div className="flex items-center">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1.5">Без решения</span>
                                <span className="font-black text-amber-600">{unresolvedCount}</span>
                            </div>
                            <div className="flex items-center">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1.5">Строк</span>
                                <span className="font-bold text-slate-700">{details.shift_zone_discrepancies.length}</span>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {details && details.shift_zone_discrepancies.length === 0 ? (
                <div className="flex-1 min-h-0 flex items-center justify-center rounded-xl border border-dashed text-slate-500">
                    Нет расхождений по этой передаче.
                </div>
            ) : details ? (
                <div className="flex-1 min-h-0 flex flex-col border rounded-xl bg-white overflow-hidden shadow-sm">
                    <div className="flex-none px-3 py-2 border-b bg-slate-50">
                        <div className="hidden md:flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                                <Button type="button" variant={activeTab === "open" ? "default" : "outline"} size="sm" className="h-7 text-xs px-3 font-bold" onClick={() => setActiveTab("open")}>
                                    Приемка <span className="ml-1 opacity-70">({openingDiscrepancyRows.length})</span>
                                </Button>
                                <Button type="button" variant={activeTab === "close" ? "default" : "outline"} size="sm" className="h-7 text-xs px-3 font-bold" onClick={() => setActiveTab("close")}>
                                    Сдача <span className="ml-1 opacity-70">({closingDiscrepancyRows.length})</span>
                                </Button>
                                <Button type="button" variant={activeTab === "full" ? "default" : "outline"} size="sm" className="h-7 text-xs px-3 font-bold" onClick={() => setActiveTab("full")}>
                                    Цикл <span className="ml-1 opacity-70">({fullCycleRows.length})</span>
                                </Button>
                            </div>
                            <Button type="button" variant={showOnlyUnresolved ? "default" : "outline"} size="sm" className="h-7 text-xs px-3 font-bold" onClick={() => setShowOnlyUnresolved(v => !v)}>
                                {showOnlyUnresolved ? "Только без решения" : "Показать все"}
                            </Button>
                        </div>

                        <div className="md:hidden space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                                <Button type="button" variant={activeTab === "open" ? "default" : "outline"} size="sm" className="h-9 text-[11px] px-2 font-black" onClick={() => setActiveTab("open")}>
                                    Приемка <span className="ml-1 opacity-70">({openingDiscrepancyRows.length})</span>
                                </Button>
                                <Button type="button" variant={activeTab === "close" ? "default" : "outline"} size="sm" className="h-9 text-[11px] px-2 font-black" onClick={() => setActiveTab("close")}>
                                    Сдача <span className="ml-1 opacity-70">({closingDiscrepancyRows.length})</span>
                                </Button>
                                <Button type="button" variant={activeTab === "full" ? "default" : "outline"} size="sm" className="h-9 text-[11px] px-2 font-black" onClick={() => setActiveTab("full")}>
                                    Цикл <span className="ml-1 opacity-70">({fullCycleRows.length})</span>
                                </Button>
                            </div>
                            <Button type="button" variant={showOnlyUnresolved ? "default" : "outline"} size="sm" className="h-9 text-[11px] px-3 font-black w-full" onClick={() => setShowOnlyUnresolved(v => !v)}>
                                {showOnlyUnresolved ? "Только без решения" : "Показать все"}
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-auto pb-16 md:pb-0">
                        <div className="hidden md:block">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_#e2e8f0]">
                                    <tr className="text-[10px] uppercase font-black tracking-widest text-slate-400 bg-white">
                                        <th className="px-4 py-2.5 w-[34%]">Товар / Склад</th>
                                        <th className="px-4 py-2.5 w-[14%] text-right">Отклонение</th>
                                        <th className="px-4 py-2.5 w-[32%]">Ответственность / Решение</th>
                                        <th className="px-4 py-2.5 w-[20%] text-right">Действия</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-slate-500 italic">
                                                Ничего не найдено.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRows.map((row, index) => {
                                            const delta = getDiscrepancyValue(row)
                                            const deltaColor = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-slate-500"
                                            const canResolve = isShortage(row) && !row.resolution
                                            const responsibilityText = row.responsibility_type === "SHIFT_RESPONSIBILITY" && details?.shift.employee_name
                                                ? `Ответственность: ${details.shift.employee_name}`
                                                : row.responsibility_type === "INHERITED_FROM_PREVIOUS_SHIFT" && details?.handover_source?.accepted_from_employee_name
                                                    ? `Тянется от: ${details.handover_source.accepted_from_employee_name}`
                                                    : row.responsibility_label

                                            return (
                                                <tr key={`${activeTab}-${row.warehouse_id}-${row.product_id}-${index}`} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-2 align-middle">
                                                        <div className="font-bold text-slate-900 leading-tight">{row.product_name}</div>
                                                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                            {row.warehouse_name} · {row.shift_zone_label}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 align-middle text-right">
                                                        <div className={cn("font-black tabular-nums text-base leading-tight", deltaColor)}>
                                                            {delta > 0 ? "+" : ""}{delta}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                            {formatMoney(row.selling_price)} / шт
                                                        </div>
                                                        {(row.inflow_quantity > 0 || row.outflow_quantity > 0) && (
                                                            <div className="text-[9px] font-bold mt-1 flex justify-end gap-1.5">
                                                                {row.inflow_quantity > 0 && <span className="text-emerald-500">+{row.inflow_quantity} прих</span>}
                                                                {row.outflow_quantity > 0 && <span className="text-rose-500">-{row.outflow_quantity} расх</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 align-middle">
                                                        <div className={cn(
                                                            "text-xs font-black leading-tight line-clamp-2",
                                                            row.responsibility_type === "SHIFT_RESPONSIBILITY" ? "text-rose-700" :
                                                            row.responsibility_type === "INHERITED_FROM_PREVIOUS_SHIFT" ? "text-amber-700" :
                                                            "text-slate-700"
                                                        )} title={row.explanation}>
                                                            {responsibilityText}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-1">
                                                            {row.resolution ? (
                                                                <span className="font-bold text-indigo-600">Решено: {row.resolution.resolution_type === "SALARY_DEDUCTION" ? "В счет ЗП" : "В потери"}</span>
                                                            ) : isSurplus(row) ? (
                                                                <span className="font-bold text-emerald-600">Излишек (без удержания)</span>
                                                            ) : (
                                                                <span className="font-bold text-amber-600">Ждет решения</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 align-middle text-right">
                                                        <div className="flex justify-end items-center gap-2">
                                                            {canResolve && (
                                                                <>
                                                                    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold" onClick={() => openResolutionDialog(row, "SALARY_DEDUCTION")}>
                                                                        <Wallet className="mr-1 h-3 w-3" /> ЗП
                                                                    </Button>
                                                                    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => openResolutionDialog(row, "LOSS")}>
                                                                        <PackageX className="mr-1 h-3 w-3" /> Потери
                                                                    </Button>
                                                                </>
                                                            )}
                                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-900" onClick={() => openDetailsDialog(row)}>
                                                                <Info className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="md:hidden divide-y divide-slate-100">
                            {filteredRows.length === 0 ? (
                                <div className="px-4 py-8 text-center text-slate-500 italic">
                                    Ничего не найдено.
                                </div>
                            ) : (
                                filteredRows.map((row, index) => {
                                    const delta = getDiscrepancyValue(row)
                                    const deltaColor = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-slate-500"
                                    const canResolve = isShortage(row) && !row.resolution
                                    const responsibilityText = row.responsibility_type === "SHIFT_RESPONSIBILITY" && details?.shift.employee_name
                                        ? `Ответственность: ${details.shift.employee_name}`
                                        : row.responsibility_type === "INHERITED_FROM_PREVIOUS_SHIFT" && details?.handover_source?.accepted_from_employee_name
                                            ? `Тянется от: ${details.handover_source.accepted_from_employee_name}`
                                            : row.responsibility_label

                                    return (
                                        <div key={`m-${activeTab}-${row.warehouse_id}-${row.product_id}-${index}`} className="px-3 py-2.5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-900 leading-tight truncate">{row.product_name}</div>
                                                    <div className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">
                                                        {row.warehouse_name} · {row.shift_zone_label}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className={cn("text-xl font-black tabular-nums leading-none", deltaColor)}>
                                                        {delta > 0 ? "+" : ""}{delta}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                        {formatMoney(row.selling_price)} / шт
                                                    </div>
                                                </div>
                                            </div>

                                            {(row.inflow_quantity > 0 || row.outflow_quantity > 0) && (
                                                <div className="mt-1.5 flex gap-2 text-[11px] font-bold">
                                                    {row.inflow_quantity > 0 && <span className="text-emerald-600">+{row.inflow_quantity} приход</span>}
                                                    {row.outflow_quantity > 0 && <span className="text-rose-600">-{row.outflow_quantity} расход</span>}
                                                </div>
                                            )}

                                            <div className="mt-1.5">
                                                <div className={cn(
                                                    "text-xs font-black leading-tight",
                                                    row.responsibility_type === "SHIFT_RESPONSIBILITY" ? "text-rose-700" :
                                                    row.responsibility_type === "INHERITED_FROM_PREVIOUS_SHIFT" ? "text-amber-700" :
                                                    "text-slate-700"
                                                )}>
                                                    {responsibilityText}
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    {row.resolution ? (
                                                        <span className="font-bold text-indigo-600">Решено: {row.resolution.resolution_type === "SALARY_DEDUCTION" ? "В счет ЗП" : "В потери"}</span>
                                                    ) : isSurplus(row) ? (
                                                        <span className="font-bold text-emerald-600">Излишек (без удержания)</span>
                                                    ) : (
                                                        <span className="font-bold text-amber-600">Ждет решения</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-2 flex items-center justify-end gap-1.5">
                                                {canResolve && (
                                                    <>
                                                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] font-bold" onClick={() => openResolutionDialog(row, "SALARY_DEDUCTION")}>
                                                            <Wallet className="mr-1.5 h-4 w-4" /> ЗП
                                                        </Button>
                                                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => openResolutionDialog(row, "LOSS")}>
                                                            <PackageX className="mr-1.5 h-4 w-4" /> Потери
                                                        </Button>
                                                    </>
                                                )}
                                                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px] font-bold" onClick={() => openDetailsDialog(row)}>
                                                    <Info className="mr-1.5 h-4 w-4" /> Детали
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                <Button asChild variant="outline" className="h-11 w-full font-bold">
                    <Link href={`/clubs/${clubId}/inventory?tab=zones`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Назад в склад
                    </Link>
                </Button>
            </div>

            <Dialog open={isDetailsOpen} onOpenChange={(open) => !open && closeDetailsDialog()}>
                <DialogContent className="sm:max-w-[500px] w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 sm:p-6 overflow-hidden flex flex-col gap-0 border-0 sm:border sm:rounded-xl [&>button]:hidden sm:[&>button]:inline-flex">
                    <div className="sm:hidden flex items-center justify-between p-4 border-b bg-white">
                        <div className="font-black text-lg text-slate-900 truncate pr-4">
                            {detailsTarget ? `${detailsTarget.product_name}` : "Детали"}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0 bg-slate-100" onClick={closeDetailsDialog}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <DialogHeader className="hidden sm:block">
                        <DialogTitle className="text-xl font-black">
                            {detailsTarget ? `${detailsTarget.product_name} · ${detailsTarget.warehouse_name}` : "Детали"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-0 bg-slate-50 sm:bg-white">
                        {detailsTarget && (
                            <div className="space-y-4 max-w-lg mx-auto">
                                {/* Склад для мобилки */}
                                <div className="sm:hidden text-center text-sm font-bold text-slate-500 mb-2">
                                    {detailsTarget.warehouse_name} · {detailsTarget.shift_zone_label}
                                </div>

                                <div className="rounded-xl border bg-white shadow-sm p-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-2.5">
                                        Причина
                                    </div>
                                    <div className="text-sm font-medium text-slate-700 leading-relaxed">
                                        <span className="font-black text-slate-900 block mb-1">
                                            {detailsTarget.responsibility_type === "SHIFT_RESPONSIBILITY" && details?.shift.employee_name 
                                                ? `Ответственность: ${details.shift.employee_name}` 
                                                : detailsTarget.responsibility_type === "INHERITED_FROM_PREVIOUS_SHIFT" && details?.handover_source?.accepted_from_employee_name
                                                    ? `Тянется от: ${details.handover_source.accepted_from_employee_name}`
                                                    : detailsTarget.responsibility_label}:
                                        </span>
                                        {detailsTarget.explanation}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border bg-white shadow-sm p-4 flex flex-col justify-center">
                                        <div className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5">
                                            Отклонение
                                        </div>
                                        <div className={cn(
                                            "text-2xl font-black tabular-nums leading-none",
                                            getDiscrepancyValue(detailsTarget) > 0
                                                ? "text-emerald-600"
                                                : getDiscrepancyValue(detailsTarget) < 0
                                                    ? "text-rose-600"
                                                    : "text-slate-700"
                                        )}>
                                            {getDiscrepancyValue(detailsTarget) > 0 ? "+" : ""}{getDiscrepancyValue(detailsTarget)} шт
                                        </div>
                                        <div className="text-[11px] font-bold text-slate-400 mt-1.5">
                                            Цена: {formatMoney(detailsTarget.selling_price)}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border bg-white shadow-sm p-4 flex flex-col justify-center">
                                        <div className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1.5">
                                            Решение
                                        </div>
                                        <div className="mt-1">{renderResolution(detailsTarget)}</div>
                                    </div>
                                </div>

                                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                                    <div className="p-4 bg-slate-50 border-b border-slate-100">
                                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-2">
                                            Остатки
                                        </div>
                                        <div className="text-sm font-black text-slate-900 tabular-nums">
                                            {(() => {
                                                const was = getBaseQuantity(detailsTarget)
                                                const shouldBe = getExpectedQuantity(detailsTarget)
                                                const fact = getActualQuantity(detailsTarget)
                                                const short = getMovementsShort(detailsTarget)
                                                const wasText = was === null ? "—" : String(was)
                                                const shouldText = shouldBe === null ? "—" : String(shouldBe)
                                                const factText = fact === null ? "—" : String(fact)
                                                return (
                                                    <span>
                                                        Было {wasText} → Должно {shouldText} → Факт {factText}
                                                        {short ? ` (${short})` : ""}
                                                    </span>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        {renderMovementFeed(detailsTarget)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white border-t sm:border-t-0 mt-auto">
                        <div className="max-w-lg mx-auto flex flex-col gap-2">
                            {detailsTarget && isShortage(detailsTarget) && !detailsTarget.resolution && (
                                <div className="grid grid-cols-2 gap-2 w-full">
                                    <Button
                                        variant="outline"
                                        className="h-12 font-bold"
                                        onClick={() => openResolutionDialog(detailsTarget, "SALARY_DEDUCTION")}
                                    >
                                        <Wallet className="mr-2 h-4 w-4" />
                                        В счет ЗП
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-12 font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                        onClick={() => openResolutionDialog(detailsTarget, "LOSS")}
                                    >
                                        <PackageX className="mr-2 h-4 w-4" />
                                        В потери
                                    </Button>
                                </div>
                            )}
                            <Button variant="outline" className="h-12 w-full font-bold sm:hidden" onClick={closeDetailsDialog}>
                                Закрыть
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isResolutionDialogOpen} onOpenChange={(open) => !open && closeResolutionDialog()}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>
                            {resolutionType === "SALARY_DEDUCTION" ? "Решение: в счет ЗП" : "Решение: списать как потери"}
                        </DialogTitle>
                    </DialogHeader>
                    {resolutionTarget && (
                        <div className="space-y-4">
                            <div className="rounded-xl border bg-muted/70 p-4">
                                <div className="font-medium">{resolutionTarget.warehouse_name} · {resolutionTarget.product_name}</div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                    Расхождение: {Number(resolutionTarget.difference_quantity || 0) > 0 ? "+" : ""}{Number(resolutionTarget.difference_quantity || 0)} шт. · Цена: {formatMoney(resolutionTarget.selling_price)}
                                </div>
                                <div className="mt-1 text-sm font-semibold">
                                    Полная сумма: {formatMoney(getMaxResolutionAmount(resolutionTarget))}
                                </div>
                            </div>

                            {resolutionType === "SALARY_DEDUCTION" ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Сколько удержать</Label>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant={resolutionMode === "full" ? "default" : "outline"}
                                                onClick={() => {
                                                    setResolutionMode("full")
                                                    setResolutionAmount(String(getMaxResolutionAmount(resolutionTarget)))
                                                }}
                                            >
                                                Всю сумму
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={resolutionMode === "custom" ? "default" : "outline"}
                                                onClick={() => {
                                                    setResolutionMode("custom")
                                                    setResolutionAmount("")
                                                }}
                                            >
                                                Произвольную
                                            </Button>
                                        </div>
                                    </div>

                                    {resolutionMode === "custom" && (
                                        <div className="space-y-2">
                                            <Label>Сумма удержания</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max={getMaxResolutionAmount(resolutionTarget)}
                                                step="0.01"
                                                value={resolutionAmount}
                                                onChange={(e) => setResolutionAmount(e.target.value)}
                                            />
                                            <div className="text-xs text-muted-foreground">
                                                Максимум: {formatMoney(getMaxResolutionAmount(resolutionTarget))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                    Сумма будет списана на потери клуба. Сотруднику удержание по этой строке не создается.
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Комментарий</Label>
                                <Textarea
                                    value={resolutionNote}
                                    onChange={(e) => setResolutionNote(e.target.value)}
                                    placeholder={resolutionType === "SALARY_DEDUCTION"
                                        ? "Например: удержать частично, остальное оставить за клубом"
                                        : "Например: списано как бой, усушка или операционная потеря"}
                                    rows={3}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={closeResolutionDialog} disabled={isResolutionSaving}>
                            Отмена
                        </Button>
                        <Button onClick={handleResolve} disabled={isResolutionSaving}>
                            {isResolutionSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Сохранить решение
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    )
}
