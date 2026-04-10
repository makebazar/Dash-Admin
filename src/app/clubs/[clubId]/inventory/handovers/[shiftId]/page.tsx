"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, PackageCheck, TriangleAlert, Wallet } from "lucide-react"
import { PageHeader, PageShell } from "@/components/layout/PageShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

    const renderResponsibility = useCallback((row: ShiftZoneDiscrepancy) => (
        <div className="space-y-1">
            <Badge variant="outline" className={cn(
                row.responsibility_type === "SHIFT_RESPONSIBILITY" ? "border-red-200 bg-red-50 text-red-700" :
                row.responsibility_type === "INHERITED_FROM_PREVIOUS_SHIFT" ? "border-amber-200 bg-amber-50 text-amber-700" :
                "border-border bg-muted text-foreground"
            )}>
                {row.responsibility_label}
            </Badge>
            <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                {row.explanation}
            </div>
        </div>
    ), [])

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
            return <span className="text-xs text-muted-foreground">Решение сохранено</span>
        }
        if (isSurplus(row)) {
            return <span className="text-xs text-emerald-700">Излишек фиксируется без удержания</span>
        }
        return (
            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => openResolutionDialog(row, "SALARY_DEDUCTION")}
                >
                    <Wallet className="mr-1 h-3.5 w-3.5" />
                    В счет ЗП
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => openResolutionDialog(row, "LOSS")}
                >
                    <PackageCheck className="mr-1 h-3.5 w-3.5" />
                    В потери
                </Button>
            </div>
        )
    }, [openResolutionDialog])

    return (
        <PageShell maxWidth="7xl">
            <PageHeader
                title="Передача Остатков"
                description={details?.shift
                    ? `Сотрудник: ${details.shift.employee_name}. Приемка и сдача остатков вынесены в отдельную детализацию склада, без перехода в карточку смены.`
                    : "Детализация приемки и сдачи остатков между сменами."}
            >
                <Button asChild variant="outline">
                    <Link href={`/clubs/${clubId}/inventory?tab=zones`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Назад в склад
                    </Link>
                </Button>
            </PageHeader>

            {isLoading ? (
                <Card>
                    <CardContent className="flex min-h-[280px] items-center justify-center gap-3 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Загружаю детализацию передачи остатков...
                    </CardContent>
                </Card>
            ) : error ? (
                <Card className="border-red-200 bg-red-50/70">
                    <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
                        <TriangleAlert className="h-8 w-8 text-red-600" />
                        <div className="space-y-1">
                            <div className="font-semibold text-red-900">Не удалось открыть детализацию</div>
                            <div className="text-sm text-red-700">{error}</div>
                        </div>
                        <Button variant="outline" onClick={fetchDetails}>Повторить</Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Card>
                            <CardContent className="p-5">
                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Смена</div>
                                <div className="mt-2 text-lg font-bold text-foreground">{details?.shift.employee_name || "—"}</div>
                                <div className="mt-1 text-sm text-muted-foreground">{formatDateTime(details?.shift.check_in || null)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-5">
                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Расхождений</div>
                                <div className="mt-2 text-lg font-bold text-foreground">{details?.shift_zone_discrepancies.length || 0}</div>
                                <div className="mt-1 text-sm text-muted-foreground">Строк в передаче остатков</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-5">
                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Не обработано</div>
                                <div className="mt-2 text-lg font-bold text-amber-700">{unresolvedCount}</div>
                                <div className="mt-1 text-sm text-muted-foreground">Требует решения владельца</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-5">
                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Сумма риска</div>
                                <div className="mt-2 text-lg font-bold text-red-700">{formatMoney(totalDiscrepancyAmount)}</div>
                                <div className="mt-1 text-sm text-muted-foreground">По цене товара на строках расхождения</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Кто Передал Остатки</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {details?.handover_source?.accepted_from_shift_id ? (
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Сотрудник</div>
                                        <div className="mt-1 text-sm font-semibold text-foreground">
                                            {details.handover_source.accepted_from_employee_name || "Неизвестно"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Смена</div>
                                        <div className="mt-1 text-sm text-foreground">
                                            {details.handover_source.accepted_from_shift_id}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Закрыта</div>
                                        <div className="mt-1 text-sm text-foreground">
                                            {formatDateTime(details.handover_source.accepted_from_shift_check_out || details.handover_source.accepted_from_shift_check_in)}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">
                                    Для этой приемки еще не зафиксировано, у чьей смены были приняты остатки.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-dashed shadow-none">
                        <CardContent className="py-4 text-sm text-muted-foreground">
                            `Приемка остатков` теперь показывает строки, где расхождение уже было в момент старта смены.
                            `Сдача остатков` показывает строки, где отклонение возникло к концу смены.
                            `Полный цикл передачи` оставляет сквозную картину по тем товарам, где есть и стартовый, и финальный snapshot.
                        </CardContent>
                    </Card>

                    {(!details?.shift_zone_discrepancies || details.shift_zone_discrepancies.length === 0) ? (
                        <Card className="shadow-sm">
                            <CardContent className="py-14 text-center text-muted-foreground">
                                По этой передаче остатков расхождений нет.
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <Card className="shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Приемка остатков</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {openingDiscrepancyRows.length === 0 ? (
                                        <div className="py-10 text-center text-sm text-muted-foreground">
                                            На приемке отклонений нет: стартовые остатки совпали с системой.
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Склад</TableHead>
                                                    <TableHead>Товар</TableHead>
                                                    <TableHead className="text-right">По системе</TableHead>
                                                    <TableHead className="text-right">Принято фактически</TableHead>
                                                    <TableHead className="text-right">Отклонение приемки</TableHead>
                                                    <TableHead>Ответственность</TableHead>
                                                    <TableHead>Решение</TableHead>
                                                    <TableHead className="text-right">Действия</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {openingDiscrepancyRows.map((row, index) => {
                                                    const discrepancyValue = getDiscrepancyValue(row)
                                                    return (
                                                        <TableRow key={`open-${row.warehouse_id}-${row.product_id}-${index}`} className="align-top">
                                                            <TableCell>
                                                                <div className="font-medium">{row.warehouse_name}</div>
                                                                <div className="text-xs text-muted-foreground">{row.shift_zone_label}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="font-medium">{row.product_name}</div>
                                                                <div className="text-xs text-muted-foreground">Цена: {formatMoney(row.selling_price)}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">{row.opening_system_quantity ?? "—"}</TableCell>
                                                            <TableCell className="text-right tabular-nums">{row.opening_counted_quantity ?? "—"}</TableCell>
                                                            <TableCell className={cn(
                                                                "text-right font-semibold tabular-nums",
                                                                discrepancyValue > 0 ? "text-green-600" : discrepancyValue < 0 ? "text-red-600" : "text-muted-foreground"
                                                            )}>
                                                                {discrepancyValue > 0 ? "+" : ""}{discrepancyValue}
                                                            </TableCell>
                                                            <TableCell>{renderResponsibility(row)}</TableCell>
                                                            <TableCell>{renderResolution(row)}</TableCell>
                                                            <TableCell className="text-right">{renderActions(row)}</TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Сдача остатков</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {closingDiscrepancyRows.length === 0 ? (
                                        <div className="py-10 text-center text-sm text-muted-foreground">
                                            На сдаче отклонений нет: финальные остатки сошлись с ожидаемыми.
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Склад</TableHead>
                                                    <TableHead>Товар</TableHead>
                                                    <TableHead className="text-right">По системе</TableHead>
                                                    <TableHead className="text-right">Сдано фактически</TableHead>
                                                    <TableHead className="text-right">Отклонение сдачи</TableHead>
                                                    <TableHead>Ответственность</TableHead>
                                                    <TableHead>Решение</TableHead>
                                                    <TableHead className="text-right">Действия</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {closingDiscrepancyRows.map((row, index) => {
                                                    const discrepancyValue = getDiscrepancyValue(row)
                                                    return (
                                                        <TableRow key={`close-${row.warehouse_id}-${row.product_id}-${index}`} className="align-top">
                                                            <TableCell>
                                                                <div className="font-medium">{row.warehouse_name}</div>
                                                                <div className="text-xs text-muted-foreground">{row.shift_zone_label}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="font-medium">{row.product_name}</div>
                                                                <div className="text-xs text-muted-foreground">Цена: {formatMoney(row.selling_price)}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">{row.closing_system_quantity ?? row.expected_closing_quantity ?? "—"}</TableCell>
                                                            <TableCell className="text-right tabular-nums">{row.actual_closing_quantity ?? "—"}</TableCell>
                                                            <TableCell className={cn(
                                                                "text-right font-semibold tabular-nums",
                                                                discrepancyValue > 0 ? "text-green-600" : discrepancyValue < 0 ? "text-red-600" : "text-muted-foreground"
                                                            )}>
                                                                {discrepancyValue > 0 ? "+" : ""}{discrepancyValue}
                                                            </TableCell>
                                                            <TableCell>{renderResponsibility(row)}</TableCell>
                                                            <TableCell>{renderResolution(row)}</TableCell>
                                                            <TableCell className="text-right">{renderActions(row)}</TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Полный цикл передачи</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {fullCycleRows.length === 0 ? (
                                        <div className="py-10 text-center text-sm text-muted-foreground">
                                            Полных циклов приемка → движение → сдача пока нет.
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Склад</TableHead>
                                                    <TableHead>Товар</TableHead>
                                                    <TableHead className="text-right">Принято</TableHead>
                                                    <TableHead className="text-right">Приход</TableHead>
                                                    <TableHead className="text-right">Расход</TableHead>
                                                    <TableHead className="text-right">Ожидалось к сдаче</TableHead>
                                                    <TableHead className="text-right">Сдано</TableHead>
                                                    <TableHead className="text-right">Итоговое отклонение</TableHead>
                                                    <TableHead>Ответственность</TableHead>
                                                    <TableHead>Решение</TableHead>
                                                    <TableHead className="text-right">Действия</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {fullCycleRows.map((row, index) => {
                                                    const discrepancyValue = getDiscrepancyValue(row)
                                                    return (
                                                        <TableRow key={`full-${row.warehouse_id}-${row.product_id}-${index}`} className="align-top">
                                                            <TableCell>
                                                                <div className="font-medium">{row.warehouse_name}</div>
                                                                <div className="text-xs text-muted-foreground">{row.shift_zone_label}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="font-medium">{row.product_name}</div>
                                                                <div className="text-xs text-muted-foreground">Цена: {formatMoney(row.selling_price)}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">{row.opening_counted_quantity ?? "—"}</TableCell>
                                                            <TableCell className="text-right tabular-nums text-green-600">+{row.inflow_quantity}</TableCell>
                                                            <TableCell className="text-right tabular-nums text-red-600">-{row.outflow_quantity}</TableCell>
                                                            <TableCell className="text-right tabular-nums">{row.expected_closing_quantity ?? "—"}</TableCell>
                                                            <TableCell className="text-right tabular-nums">{row.actual_closing_quantity ?? "—"}</TableCell>
                                                            <TableCell className={cn(
                                                                "text-right font-semibold tabular-nums",
                                                                discrepancyValue > 0 ? "text-green-600" : discrepancyValue < 0 ? "text-red-600" : "text-muted-foreground"
                                                            )}>
                                                                {discrepancyValue > 0 ? "+" : ""}{discrepancyValue}
                                                            </TableCell>
                                                            <TableCell>{renderResponsibility(row)}</TableCell>
                                                            <TableCell>{renderResolution(row)}</TableCell>
                                                            <TableCell className="text-right">{renderActions(row)}</TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            )}

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
