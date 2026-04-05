"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import {
    ArrowLeft,
    ArrowRight,
    ArrowUpDown,
    ChevronRight,
    Clock,
    DollarSign,
    Edit,
    FileText,
    Loader2,
    Moon,
    Sun,
    Trash2,
    TrendingUp,
    Wallet,
} from "lucide-react"

import { PageHeader, PageShell } from "@/components/layout/PageShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface OwnerCorrectionChange {
    field: string
    label: string
    before: any
    after: any
}

interface Shift {
    id: string
    employee_name: string
    check_in: string
    check_out: string | null
    total_hours: number | string | null
    cash_income: number | string | null
    card_income: number | string | null
    expenses: number | string | null
    report_comment: string | null
    report_data: Record<string, any> | null
    owner_notes?: string | null
    has_owner_corrections?: boolean
    owner_correction_changes?: OwnerCorrectionChange[] | null
    status: string
    shift_type: "DAY" | "NIGHT" | null
}

interface ShiftDetails {
    shift: Shift
    checklists: any[]
    product_sales: any[]
    inventory_checks: any[]
    inventory_discrepancies: any[]
    maintenance_tasks: any[]
    metric_labels?: Record<string, string>
}

interface ShiftReportField {
    metric_key: string
    custom_label: string
    field_type: "INCOME" | "EXPENSE" | "EXPENSE_LIST" | "OTHER"
}

const DATE_TIME_MASK_TEMPLATE = "__.__.____, __:__"
const DATE_TIME_EDITABLE_POSITIONS = [0, 1, 3, 4, 6, 7, 8, 9, 12, 13, 15, 16]

const extractMaskedDateTimeDigits = (value: string) => {
    const normalized = (value || DATE_TIME_MASK_TEMPLATE)
        .slice(0, DATE_TIME_MASK_TEMPLATE.length)
        .padEnd(DATE_TIME_MASK_TEMPLATE.length, "_")

    return DATE_TIME_EDITABLE_POSITIONS.map((position) => {
        const char = normalized[position]
        return /\d/.test(char) ? char : "_"
    })
}

const buildMaskedDateTimeDisplay = (digits: string[]) => {
    const chars = DATE_TIME_MASK_TEMPLATE.split("")
    DATE_TIME_EDITABLE_POSITIONS.forEach((position, index) => {
        chars[position] = digits[index] ?? "_"
    })
    return chars.join("")
}

const displayToLocalDateTime = (value: string) => {
    const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4}), (\d{2}):(\d{2})$/)
    if (!match) return ""
    const [, dd, mm, yyyy, hh, min] = match
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

const localDateTimeToDisplay = (value: string) => {
    if (!value) return ""
    const [datePart, timePart] = value.split("T")
    if (!datePart || !timePart) return ""
    const [year, month, day] = datePart.split("-")
    if (!year || !month || !day) return ""
    return `${day}.${month}.${year}, ${timePart.slice(0, 5)}`
}

type MaskedDateTimeInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
    value: string
    onValueChange: (displayValue: string, internalValue: string) => void
}

function MaskedDateTimeInput({
    value,
    onValueChange,
    className,
    placeholder = "ДД.ММ.ГГГГ, ЧЧ:ММ",
    ...props
}: MaskedDateTimeInputProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    const setCaretToSlot = useCallback((slot: number) => {
        const safeSlot = Math.max(0, Math.min(slot, DATE_TIME_EDITABLE_POSITIONS.length - 1))
        const caretPos = DATE_TIME_EDITABLE_POSITIONS[safeSlot]
        requestAnimationFrame(() => inputRef.current?.setSelectionRange(caretPos, caretPos))
    }, [])

    const setCaretToPosition = useCallback((position: number) => {
        requestAnimationFrame(() => inputRef.current?.setSelectionRange(position, position))
    }, [])

    const findSlotAtOrAfter = useCallback((position: number) => {
        return DATE_TIME_EDITABLE_POSITIONS.findIndex((pos) => pos >= position)
    }, [])

    const findSlotAtOrBefore = useCallback((position: number) => {
        for (let i = DATE_TIME_EDITABLE_POSITIONS.length - 1; i >= 0; i -= 1) {
            if (DATE_TIME_EDITABLE_POSITIONS[i] <= position) return i
        }
        return -1
    }, [])

    const commitDigits = useCallback((digits: string[], nextCaretSlot?: number) => {
        const nextDisplay = buildMaskedDateTimeDisplay(digits)
        onValueChange(nextDisplay, displayToLocalDateTime(nextDisplay))
        if (typeof nextCaretSlot === "number") {
            setCaretToSlot(nextCaretSlot)
        }
    }, [onValueChange, setCaretToSlot])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        const currentValue = value || ""
        const digits = extractMaskedDateTimeDigits(currentValue)
        const selectionStart = e.currentTarget.selectionStart ?? 0

        if (/^\d$/.test(e.key)) {
            e.preventDefault()
            const slot = findSlotAtOrAfter(selectionStart)
            if (slot === -1) return
            digits[slot] = e.key
            commitDigits(digits, Math.min(slot + 1, DATE_TIME_EDITABLE_POSITIONS.length - 1))
            return
        }

        if (e.key === "Backspace") {
            e.preventDefault()
            const slot = findSlotAtOrBefore(Math.max(selectionStart - 1, 0))
            if (slot === -1) return
            digits[slot] = "_"
            commitDigits(digits, slot)
            return
        }

        if (e.key === "Delete") {
            e.preventDefault()
            const slot = findSlotAtOrAfter(selectionStart)
            if (slot === -1) return
            digits[slot] = "_"
            commitDigits(digits, slot)
            return
        }

        if (e.key === "ArrowLeft") {
            e.preventDefault()
            const slot = findSlotAtOrBefore(Math.max(selectionStart - 1, 0))
            if (slot === -1) setCaretToPosition(0)
            else setCaretToSlot(slot)
            return
        }

        if (e.key === "ArrowRight") {
            e.preventDefault()
            const slot = findSlotAtOrAfter(selectionStart + 1)
            if (slot === -1) setCaretToPosition(DATE_TIME_MASK_TEMPLATE.length)
            else setCaretToSlot(slot)
            return
        }
    }, [commitDigits, findSlotAtOrAfter, findSlotAtOrBefore, setCaretToPosition, setCaretToSlot, value])

    return (
        <Input
            ref={inputRef}
            value={value}
            onChange={() => undefined}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={className}
            {...props}
        />
    )
}

export default function ShiftDetailsPage() {
    const params = useParams<{ clubId: string; shiftId: string }>()
    const router = useRouter()
    const searchParams = useSearchParams()
    const clubId = params.clubId
    const shiftId = params.shiftId
    const initialEditMode = searchParams.get("mode") === "edit"
    const openedFromReviews = searchParams.get("from") === "reviews"
    const backHref = openedFromReviews ? `/clubs/${clubId}/reviews?tab=shifts` : `/clubs/${clubId}/shifts`

    const [details, setDetails] = useState<ShiftDetails | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isEditMode, setIsEditMode] = useState(initialEditMode)
    const [isSaving, setIsSaving] = useState(false)
    const [activeTab, setActiveTab] = useState("overview")
    const [clubTimezone, setClubTimezone] = useState("Europe/Moscow")
    const [reportFields, setReportFields] = useState<ShiftReportField[]>([])
    const [expandedInventories, setExpandedInventories] = useState<Record<string, boolean>>({})

    const [editCashIncome, setEditCashIncome] = useState("")
    const [editCardIncome, setEditCardIncome] = useState("")
    const [editExpenses, setEditExpenses] = useState("")
    const [editComment, setEditComment] = useState("")
    const [editOwnerNotes, setEditOwnerNotes] = useState("")
    const [editCheckIn, setEditCheckIn] = useState("")
    const [editCheckOut, setEditCheckOut] = useState("")
    const [editCheckInDisplay, setEditCheckInDisplay] = useState("")
    const [editCheckOutDisplay, setEditCheckOutDisplay] = useState("")
    const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({})
    const [editShiftType, setEditShiftType] = useState<"DAY" | "NIGHT">("DAY")

    const shift = details?.shift ?? null

    const fetchClubSettings = useCallback(async () => {
        const res = await fetch(`/api/clubs/${clubId}/settings`)
        const data = await res.json()
        if (res.ok && data.club?.timezone) {
            setClubTimezone(data.club.timezone)
        }
    }, [clubId])

    const fetchReportTemplate = useCallback(async () => {
        const res = await fetch(`/api/clubs/${clubId}/settings/reports`)
        const data = await res.json()
        if (res.ok && data.currentTemplate) {
            const standardKeys = ["cash_income", "card_income", "expenses_cash", "shift_comment", "expenses"]
            const customFields = data.currentTemplate.schema.filter((f: ShiftReportField) =>
                !standardKeys.includes(f.metric_key) &&
                !standardKeys.some((k) => f.metric_key.includes(k))
            )
            setReportFields(customFields)
        }
    }, [clubId])

    const fetchShiftDetails = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts/${shiftId}`)
            const data = await res.json()
            if (res.ok) {
                setDetails(data)
            } else {
                alert(data.error || "Ошибка загрузки смены")
            }
        } catch (error) {
            console.error("Error fetching shift details:", error)
            alert("Ошибка загрузки смены")
        } finally {
            setIsLoading(false)
        }
    }, [clubId, shiftId])

    useEffect(() => {
        fetchClubSettings()
        fetchReportTemplate()
        fetchShiftDetails()
    }, [fetchClubSettings, fetchReportTemplate, fetchShiftDetails])

    const formatForInput = useCallback((dateStr: string | null) => {
        if (!dateStr) return ""
        const d = new Date(dateStr)
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: clubTimezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        })
        const parts = formatter.formatToParts(d)
        const getPart = (type: string) => parts.find((p) => p.type === type)?.value
        return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`
    }, [clubTimezone])

    const populateEditState = useCallback((currentShift: Shift) => {
        const nextCheckIn = formatForInput(currentShift.check_in)
        const nextCheckOut = formatForInput(currentShift.check_out)
        setEditCashIncome(String(currentShift.cash_income || 0))
        setEditCardIncome(String(currentShift.card_income || 0))
        setEditExpenses(String(currentShift.expenses || 0))
        setEditComment(currentShift.report_comment || "")
        setEditOwnerNotes(currentShift.owner_notes || "")
        setEditCheckIn(nextCheckIn)
        setEditCheckOut(nextCheckOut)
        setEditCheckInDisplay(localDateTimeToDisplay(nextCheckIn))
        setEditCheckOutDisplay(localDateTimeToDisplay(nextCheckOut))
        setEditShiftType(currentShift.shift_type || "DAY")
        setEditCustomFields(currentShift.report_data || {})
    }, [formatForInput])

    useEffect(() => {
        if (shift) {
            populateEditState(shift)
            setIsEditMode(initialEditMode)
        }
    }, [shift, initialEditMode, populateEditState])

    const formatDate = useCallback((dateStr: string | null) => {
        if (!dateStr) return "—"
        return new Intl.DateTimeFormat("ru-RU", {
            timeZone: clubTimezone,
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(new Date(dateStr))
    }, [clubTimezone])

    const formatTime = useCallback((dateStr: string | null) => {
        if (!dateStr) return "—"
        return new Intl.DateTimeFormat("ru-RU", {
            timeZone: clubTimezone,
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(dateStr))
    }, [clubTimezone])

    const getMetricValue = useCallback((currentShift: Shift, field: string) => {
        if (field === "expenses" || field === "cash_income" || field === "card_income") {
            const keyMap: Record<string, string> = {
                expenses: "expenses_cash",
                cash_income: "cash_income",
                card_income: "card_income",
            }
            const reportKey = keyMap[field]
            const reportVal = currentShift.report_data?.[reportKey]
            if (reportVal !== undefined) {
                if (Array.isArray(reportVal)) {
                    return reportVal.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0)
                }
                return parseFloat(String(reportVal)) || 0
            }
            return Number((currentShift as any)[field]) || 0
        }

        const val = currentShift.report_data?.[field]
        if (Array.isArray(val)) {
            return val.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0)
        }
        return parseFloat(String(val)) || 0
    }, [])

    const calculateShiftTotalIncome = useCallback((currentShift: Shift) => {
        const cash = getMetricValue(currentShift, "cash_income")
        const card = getMetricValue(currentShift, "card_income")
        const customIncome = reportFields
            .filter((f) => f.field_type === "INCOME")
            .reduce((sum, f) => sum + getMetricValue(currentShift, f.metric_key), 0)
        return cash + card + customIncome
    }, [getMetricValue, reportFields])

    const formatMoney = useCallback((amount: number | string | null | undefined) => {
        const num = Number(amount || 0)
        return `${num.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`
    }, [])

    const renderOwnerCorrectionValue = useCallback((change: OwnerCorrectionChange, value: any) => {
        if (value === null || value === undefined || value === "") {
            return <span className="text-muted-foreground">—</span>
        }

        if (change.field === "check_in" || change.field === "check_out") {
            return (
                <span className="font-medium">
                    {formatDate(String(value))} {formatTime(String(value))}
                </span>
            )
        }

        if (change.field === "shift_type") {
            return <span className="font-medium">{value === "NIGHT" ? "Ночная" : value === "DAY" ? "Дневная" : String(value)}</span>
        }

        if (change.field === "total_hours") {
            const numericValue = Number(value)
            return <span className="font-medium">{Number.isNaN(numericValue) ? String(value) : `${numericValue.toFixed(1)} ч`}</span>
        }

        if (change.field === "cash_income" || change.field === "card_income" || change.field === "expenses") {
            return <span className="font-medium">{formatMoney(value)}</span>
        }

        if (Array.isArray(value)) {
            const total = value.reduce((sum, item: any) => sum + (Number(item?.amount) || 0), 0)
            return (
                <div className="space-y-1">
                    <div className="font-medium">{formatMoney(total)}</div>
                    {value.map((item: any, index: number) => (
                        <div key={index} className="text-xs text-muted-foreground">
                            {item?.amount !== undefined ? `${item.amount} ₽` : JSON.stringify(item)}
                            {item?.comment ? ` • ${item.comment}` : ""}
                        </div>
                    ))}
                </div>
            )
        }

        if (typeof value === "object") {
            return <span className="break-all font-mono text-xs">{JSON.stringify(value)}</span>
        }

        return <span className="font-medium whitespace-pre-wrap">{String(value)}</span>
    }, [formatDate, formatMoney, formatTime])

    const convertToClubTimezone = useCallback((datetimeLocal: string) => {
        if (!datetimeLocal) return undefined
        const localDate = new Date(datetimeLocal)
        const inClubTZString = localDate.toLocaleString("en-US", { timeZone: clubTimezone })
        const inClubTZ = new Date(inClubTZString)
        const offset = inClubTZ.getTime() - localDate.getTime()
        const correctUTC = new Date(localDate.getTime() - offset)
        return correctUTC.toISOString()
    }, [clubTimezone])

    const validateTimes = (start: string, end: string) => {
        if (start && end && new Date(start) > new Date(end)) {
            alert("Время начала не может быть позже времени окончания")
            return false
        }
        return true
    }

    const handleSave = async () => {
        if (!shift) return
        if (editCheckInDisplay && !editCheckIn) {
            alert("Заполните дату начала полностью и корректно")
            return
        }
        if (editCheckOutDisplay && !editCheckOut) {
            alert("Заполните дату окончания полностью и корректно")
            return
        }
        if (!validateTimes(editCheckIn, editCheckOut)) return

        setIsSaving(true)
        let totalHours: number | undefined = undefined
        if (editCheckIn && editCheckOut) {
            const start = new Date(editCheckIn)
            const end = new Date(editCheckOut)
            totalHours = Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60), 0)
        }

        try {
            const updatedReportData = { ...(shift.report_data || {}), ...editCustomFields }
            const res = await fetch(`/api/clubs/${clubId}/shifts/${shift.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cash_income: parseFloat(editCashIncome) || 0,
                    card_income: parseFloat(editCardIncome) || 0,
                    expenses: parseFloat(editExpenses) || 0,
                    report_comment: editComment,
                    owner_notes: editOwnerNotes,
                    check_in: convertToClubTimezone(editCheckIn),
                    check_out: convertToClubTimezone(editCheckOut),
                    total_hours: totalHours,
                    shift_type: editShiftType,
                    report_data: updatedReportData,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                alert(data.error || "Ошибка сохранения")
                return
            }

            await fetchShiftDetails()
            setIsEditMode(false)
        } catch (error) {
            console.error("Error saving shift:", error)
            alert("Ошибка сохранения")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!shift) return
        if (!confirm("Вы уверены, что хотите удалить эту смену? Это действие нельзя отменить.")) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts/${shift.id}`, { method: "DELETE" })
            if (!res.ok) {
                const data = await res.json()
                alert(data.error || "Ошибка удаления")
                return
            }
            router.push(backHref)
        } catch (error) {
            console.error("Error deleting shift:", error)
            alert("Ошибка удаления")
        } finally {
            setIsSaving(false)
        }
    }

    const handleVerify = async (nextStatus: "VERIFIED" | "CLOSED") => {
        if (!shift) return
        if (nextStatus === "CLOSED" && !confirm("Отменить подтверждение смены? Транзакции будут удалены из финансов.")) {
            return
        }

        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts/${shift.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
            })
            if (!res.ok) {
                const data = await res.json()
                alert(data.error || "Ошибка изменения статуса")
                return
            }
            await fetchShiftDetails()
        } catch (error) {
            console.error("Error updating shift status:", error)
            alert("Ошибка изменения статуса")
        }
    }

    const renderMetricValue = (value: any) => {
        if (Array.isArray(value)) {
            const total = value.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0)
            if (total === 0 && value.length === 0) return "-"
            return (
                <div className="flex flex-col items-end gap-1">
                    <span className="font-bold">{formatMoney(total)}</span>
                    {value.map((item: any, i: number) => (
                        <span key={i} className="text-[10px] text-muted-foreground leading-none">
                            {item.amount}₽: {item.comment}
                        </span>
                    ))}
                </div>
            )
        }
        if (typeof value === "object" && value !== null) return JSON.stringify(value)
        return String(value)
    }

    const monthTitle = useMemo(() => shift ? format(new Date(shift.check_in), "d MMMM yyyy", { locale: ru }) : "", [shift])

    return (
        <PageShell>
            <div className="flex min-h-[calc(100vh-4rem)] flex-col">
                <PageHeader
                    title={shift ? `Смена ${shift.employee_name}` : "Смена"}
                    description={shift ? `${monthTitle} • ${formatTime(shift.check_in)} - ${formatTime(shift.check_out)}` : "Карточка смены"}
                >
                    <Button asChild variant="outline" className="hidden h-10 md:inline-flex">
                        <Link href={backHref}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                </PageHeader>

                {isLoading || !shift ? (
                    <div className="flex flex-1 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-6 pb-24 md:pb-0">
                        <Card>
                            <CardContent className="p-4 md:p-6">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-xl font-bold">{shift.employee_name}</h2>
                                            <Badge variant={shift.shift_type === "NIGHT" ? "secondary" : "outline"}>
                                                {shift.shift_type === "NIGHT" ? "Ночная смена" : "Дневная смена"}
                                            </Badge>
                                            {shift.status === "VERIFIED" ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">Подтверждена</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                    Ожидает подтверждения
                                                </Badge>
                                            )}
                                            {shift.has_owner_corrections && (
                                                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-0">
                                                    Есть правки владельца
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                            <span>{formatDate(shift.check_in)}</span>
                                            <span>{formatTime(shift.check_in)} - {formatTime(shift.check_out)}</span>
                                            <span>{Number(shift.total_hours || 0).toFixed(1)} ч</span>
                                            <span className="font-medium text-foreground">Итого: {formatMoney(calculateShiftTotalIncome(shift))}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" className="hidden md:inline-flex" onClick={() => {
                                            populateEditState(shift)
                                            setIsEditMode((prev) => !prev)
                                        }}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            {isEditMode ? "Скрыть редактирование" : "Редактировать"}
                                        </Button>
                                        {shift.status === "VERIFIED" ? (
                                            <Button variant="outline" className="hidden md:inline-flex" onClick={() => handleVerify("CLOSED")}>
                                                Снять подтверждение
                                            </Button>
                                        ) : (
                                            <Button className="hidden bg-green-600 text-white hover:bg-green-700 md:inline-flex" onClick={() => handleVerify("VERIFIED")}>
                                                Подтвердить
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {isEditMode && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Редактирование смены</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                                                    <Clock className="h-4 w-4" />
                                                    Временные рамки
                                                </h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs text-muted-foreground uppercase">Начало</Label>
                                                        <MaskedDateTimeInput
                                                            value={editCheckInDisplay}
                                                            onValueChange={(displayValue, internalValue) => {
                                                                setEditCheckInDisplay(displayValue)
                                                                setEditCheckIn(internalValue)
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs text-muted-foreground uppercase">Конец</Label>
                                                        <MaskedDateTimeInput
                                                            value={editCheckOutDisplay}
                                                            onValueChange={(displayValue, internalValue) => {
                                                                setEditCheckOutDisplay(displayValue)
                                                                setEditCheckOut(internalValue)
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                                                    <Sun className="h-4 w-4" />
                                                    Тип смены
                                                </h3>
                                                <div className="flex gap-2 rounded-lg bg-muted/50 p-1">
                                                    <Button
                                                        type="button"
                                                        variant={editShiftType === "DAY" ? "secondary" : "ghost"}
                                                        onClick={() => setEditShiftType("DAY")}
                                                        className={cn("flex-1 gap-2", editShiftType === "DAY" && "bg-background shadow-sm")}
                                                    >
                                                        <Sun className="h-4 w-4 text-orange-500" />
                                                        Дневная
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant={editShiftType === "NIGHT" ? "secondary" : "ghost"}
                                                        onClick={() => setEditShiftType("NIGHT")}
                                                        className={cn("flex-1 gap-2", editShiftType === "NIGHT" && "bg-background shadow-sm")}
                                                    >
                                                        <Moon className="h-4 w-4 text-blue-500" />
                                                        Ночная
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                                                    <FileText className="h-4 w-4" />
                                                    Комментарии
                                                </h3>
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs text-muted-foreground uppercase">От сотрудника</Label>
                                                        <Textarea
                                                            value={editComment}
                                                            onChange={(e) => setEditComment(e.target.value)}
                                                            placeholder="Примечание к смене..."
                                                            rows={3}
                                                            className="resize-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs text-muted-foreground uppercase">Заметки владельца</Label>
                                                        <Textarea
                                                            value={editOwnerNotes}
                                                            onChange={(e) => setEditOwnerNotes(e.target.value)}
                                                            placeholder="Причина корректировки (опционально)"
                                                            rows={3}
                                                            className="resize-none bg-blue-50/30 border-blue-100"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                                                    <DollarSign className="h-4 w-4" />
                                                    Финансы
                                                </h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs text-muted-foreground uppercase">Наличные</Label>
                                                        <div className="relative">
                                                            <Input type="number" value={editCashIncome} onChange={(e) => setEditCashIncome(e.target.value)} className="pl-8 bg-green-500/5 border-green-500/20" />
                                                            <Wallet className="absolute left-2.5 top-2.5 h-4 w-4 text-green-600 opacity-50" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs text-muted-foreground uppercase">Безнал</Label>
                                                        <div className="relative">
                                                            <Input type="number" value={editCardIncome} onChange={(e) => setEditCardIncome(e.target.value)} className="pl-8 bg-blue-500/5 border-blue-500/20" />
                                                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-blue-600 opacity-50" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs text-muted-foreground uppercase">Расходы</Label>
                                                    <div className="relative">
                                                        <Input type="number" value={editExpenses} onChange={(e) => setEditExpenses(e.target.value)} className="pl-8 bg-red-500/5 border-red-500/20" />
                                                        <TrendingUp className="absolute left-2.5 top-2.5 h-4 w-4 text-red-600 opacity-50 rotate-180" />
                                                    </div>
                                                </div>
                                            </div>

                                            {reportFields.length > 0 && (
                                                <div className="space-y-4 border-t border-dashed pt-2">
                                                    <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                                                        <ArrowUpDown className="h-4 w-4" />
                                                        Дополнительно
                                                    </h3>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {reportFields.map((field) => (
                                                            <div key={field.metric_key} className="space-y-2">
                                                                <Label className="text-xs text-muted-foreground uppercase truncate" title={field.custom_label}>
                                                                    {field.custom_label}
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    value={editCustomFields[field.metric_key] || ""}
                                                                    onChange={(e) => setEditCustomFields((prev) => ({ ...prev, [field.metric_key]: e.target.value }))}
                                                                    placeholder="0"
                                                                    className="bg-muted/30"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                                        <Button
                                            variant="ghost"
                                            onClick={handleDelete}
                                            disabled={isSaving}
                                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Удалить смену
                                        </Button>
                                        <div className="flex gap-3">
                                            <Button variant="outline" onClick={() => setIsEditMode(false)}>
                                                Отмена
                                            </Button>
                                            <Button onClick={handleSave} disabled={isSaving} className="px-8">
                                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Сохранить изменения
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="w-full justify-start overflow-x-auto">
                                <TabsTrigger value="overview">Обзор</TabsTrigger>
                                <TabsTrigger value="checklists">Чеклисты</TabsTrigger>
                                <TabsTrigger value="products">Товары</TabsTrigger>
                                <TabsTrigger value="inventory">Инвентаризация</TabsTrigger>
                                <TabsTrigger value="maintenance">Обслуживание</TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="space-y-6">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">Наличные</CardTitle>
                                            <Wallet className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent><div className="text-2xl font-bold tabular-nums">{formatMoney(getMetricValue(shift, "cash_income"))}</div></CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">Терминал</CardTitle>
                                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent><div className="text-2xl font-bold tabular-nums">{formatMoney(getMetricValue(shift, "card_income"))}</div></CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">Расходы</CardTitle>
                                            <TrendingUp className="h-4 w-4 text-muted-foreground rotate-180" />
                                        </CardHeader>
                                        <CardContent><div className="text-2xl font-bold text-red-600 tabular-nums">-{formatMoney(getMetricValue(shift, "expenses"))}</div></CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">Часы</CardTitle>
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent><div className="text-2xl font-bold tabular-nums">{Number(shift.total_hours || 0).toFixed(1)} ч</div></CardContent>
                                    </Card>
                                </div>

                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                    <Card className="lg:col-span-2">
                                        <CardHeader>
                                            <CardTitle className="text-base">Детальные показатели</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <Table>
                                                <TableBody>
                                                    {shift.report_data && Object.entries(shift.report_data).map(([key, value]) => {
                                                        if (key.startsWith("_")) return null
                                                        const label = details?.metric_labels?.[key] || key
                                                        return (
                                                            <TableRow key={key} className="hover:bg-muted/30">
                                                                <TableCell className="font-medium text-muted-foreground w-[40%]">{label}</TableCell>
                                                                <TableCell className="text-right font-mono font-medium">{renderMetricValue(value)}</TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                    {(!shift.report_data || Object.keys(shift.report_data).length === 0) && (
                                                        <TableRow>
                                                            <TableCell colSpan={2} className="text-center text-muted-foreground h-24">
                                                                Нет дополнительных показателей
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                Комментарий сотрудника
                                            </h3>
                                            <div className="min-h-[100px] rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                                                {shift.report_comment ? <p className="whitespace-pre-wrap">{shift.report_comment}</p> : <span className="italic opacity-50">Комментарий отсутствует</span>}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                                <Edit className="h-4 w-4 text-muted-foreground" />
                                                Заметки владельца
                                            </h3>
                                            <div className="min-h-[100px] rounded-lg border border-blue-100 bg-blue-50/30 p-4 text-sm text-muted-foreground">
                                                {shift.owner_notes ? <p className="whitespace-pre-wrap">{shift.owner_notes}</p> : <span className="italic opacity-50">Заметок нет</span>}
                                            </div>
                                        </div>
                                        {shift.has_owner_corrections && (
                                            <div className="space-y-2">
                                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                    Правки владельца
                                                </h3>
                                                {shift.owner_correction_changes && shift.owner_correction_changes.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {shift.owner_correction_changes.map((change, index) => (
                                                            <div key={`${change.field}-${index}`} className="rounded-lg border border-orange-200 bg-orange-50/40 p-3">
                                                                <div className="mb-2 text-sm font-medium text-orange-900">{change.label}</div>
                                                                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] sm:items-start">
                                                                    <div className="rounded-md border border-orange-100 bg-white/80 p-2">
                                                                        <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Было</div>
                                                                        <div className="text-sm text-foreground">{renderOwnerCorrectionValue(change, change.before)}</div>
                                                                    </div>
                                                                    <div className="flex items-center justify-center text-orange-500">
                                                                        <ArrowRight className="h-4 w-4" />
                                                                    </div>
                                                                    <div className="rounded-md border border-orange-200 bg-white p-2">
                                                                        <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Стало</div>
                                                                        <div className="text-sm text-foreground">{renderOwnerCorrectionValue(change, change.after)}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50/40 p-4 text-sm text-orange-800">
                                                        Для этой смены сохранился только флаг правок без детализации. Новые корректировки будут показываться списком.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="checklists">
                                <Card>
                                    <CardHeader><CardTitle className="text-base">Выполненные чек-листы</CardTitle></CardHeader>
                                    <CardContent className="p-0">
                                        {!details?.checklists?.length ? (
                                            <div className="py-12 text-center text-muted-foreground">Нет данных о чек-листах</div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Название</TableHead>
                                                        <TableHead>Время</TableHead>
                                                        <TableHead>Проверил</TableHead>
                                                        <TableHead className="text-right">Результат</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {details.checklists.map((check, i) => {
                                                        const percent = check.max_score > 0 ? Math.round((check.total_score / check.max_score) * 100) : 0
                                                        return (
                                                            <TableRow key={i}>
                                                                <TableCell className="font-medium">{check.template_name || "Чек-лист"}</TableCell>
                                                                <TableCell className="text-muted-foreground">{formatTime(check.created_at)}</TableCell>
                                                                <TableCell className="text-muted-foreground text-sm">{check.evaluator_name || "—"}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Badge variant={percent >= 80 ? "default" : "destructive"} className={percent >= 80 ? "bg-green-600 hover:bg-green-700" : ""}>
                                                                        {percent}%
                                                                    </Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="products">
                                <Card>
                                    <CardHeader><CardTitle className="text-base">Проданные товары</CardTitle></CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Время</TableHead>
                                                    <TableHead>Товар</TableHead>
                                                    <TableHead>Кол-во</TableHead>
                                                    <TableHead className="text-right">Цена</TableHead>
                                                    <TableHead className="text-right">Сумма</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {details?.product_sales?.map((sale: any) => (
                                                    <TableRow key={sale.id}>
                                                        <TableCell className="font-mono text-xs text-muted-foreground">{formatTime(sale.created_at)}</TableCell>
                                                        <TableCell>
                                                            <div className="font-medium">{sale.product_name}</div>
                                                            {sale.reason && <div className="text-xs text-muted-foreground">{sale.reason}</div>}
                                                        </TableCell>
                                                        <TableCell>{Math.abs(Number(sale.change_amount))} шт.</TableCell>
                                                        <TableCell className="text-right text-muted-foreground whitespace-nowrap">{sale.price_at_time ? formatMoney(sale.price_at_time) : "-"}</TableCell>
                                                        <TableCell className="text-right font-medium whitespace-nowrap">{formatMoney(Math.abs(Number(sale.change_amount)) * (Number(sale.price_at_time) || 0))}</TableCell>
                                                    </TableRow>
                                                ))}
                                                {(!details?.product_sales || details.product_sales.length === 0) && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">Продаж товаров не найдено</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="inventory">
                                <Card>
                                    <CardHeader><CardTitle className="text-base">Инвентаризации</CardTitle></CardHeader>
                                    <CardContent className="bg-muted/5 p-0">
                                        {(!details?.inventory_checks || details.inventory_checks.length === 0) ? (
                                            <div className="py-12 text-center text-muted-foreground">Инвентаризаций не проводилось</div>
                                        ) : (
                                            <div className="space-y-3 p-4">
                                                {details.inventory_checks.map((inv: any) => {
                                                    const isExpanded = expandedInventories[inv.id] || false
                                                    const diff = Number(inv.revenue_difference || 0)
                                                    const reported = Number(inv.reported_revenue || 0)
                                                    const calculated = Number(inv.calculated_revenue || 0)
                                                    const discrepancies = details.inventory_discrepancies?.filter((d: any) => d.inventory_id === inv.id) || []

                                                    return (
                                                        <div key={inv.id} className={cn("overflow-hidden rounded-xl border bg-white transition-all", isExpanded ? "shadow-md ring-1 ring-slate-200" : "shadow-sm hover:border-slate-300")}>
                                                            <div
                                                                className={cn("flex cursor-pointer items-center justify-between gap-2 px-4 py-3 select-none", isExpanded ? "border-b bg-slate-50/50" : "")}
                                                                onClick={() => setExpandedInventories((prev) => ({ ...prev, [inv.id]: !prev[inv.id] }))}
                                                            >
                                                                <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                                                                    <div className={cn("shrink-0 rounded-lg bg-blue-50 p-2 text-blue-600 transition-all", isExpanded && "rotate-90")}>
                                                                        <ChevronRight className="h-4 w-4" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="truncate text-sm font-bold text-slate-900">{inv.warehouse_name || "Склад"}</div>
                                                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400">
                                                                            <span>{formatDate(inv.started_at)} {formatTime(inv.started_at)}</span>
                                                                            {discrepancies.length > 0 && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{discrepancies.length} расхожд.</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="ml-3 flex w-[150px] flex-none flex-col gap-2 text-left sm:w-[190px]">
                                                                    <div className="flex w-full items-baseline gap-3">
                                                                        <span className="w-[74px] shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400">Расчет</span>
                                                                        <span className="whitespace-nowrap text-sm font-black leading-none text-blue-600 tabular-nums">{calculated.toLocaleString()} ₽</span>
                                                                    </div>
                                                                    <div className="flex w-full items-baseline gap-3">
                                                                        <span className="w-[74px] shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400">Факт</span>
                                                                        <span className="whitespace-nowrap text-sm font-black leading-none text-slate-700 tabular-nums">{reported.toLocaleString()} ₽</span>
                                                                    </div>
                                                                    <div className="flex w-full items-baseline gap-3">
                                                                        <span className="w-[74px] shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400">Разница</span>
                                                                        <span className={cn("whitespace-nowrap text-sm font-black leading-none tabular-nums", diff === 0 ? "text-green-500" : diff > 0 ? "text-green-600" : "text-red-500")}>
                                                                            {diff > 0 ? "+" : ""}{diff.toLocaleString()} ₽
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="bg-white">
                                                                    {discrepancies.length > 0 ? (
                                                                        <Table>
                                                                            <TableHeader className="bg-slate-50/50">
                                                                                <TableRow className="h-9 hover:bg-transparent">
                                                                                    <TableHead className="h-9 text-[10px] font-bold uppercase text-slate-400">Товар</TableHead>
                                                                                    <TableHead className="h-9 text-right text-[10px] font-bold uppercase text-slate-400">Ожидалось</TableHead>
                                                                                    <TableHead className="h-9 text-right text-[10px] font-bold uppercase text-slate-400">Факт</TableHead>
                                                                                    <TableHead className="h-9 text-right text-[10px] font-bold uppercase text-slate-400">Разница</TableHead>
                                                                                </TableRow>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                {discrepancies.map((item: any) => (
                                                                                    <TableRow key={item.id} className="h-10 border-b border-slate-100 hover:bg-slate-50/50 last:border-0">
                                                                                        <TableCell className="py-2 text-sm font-medium text-slate-700">{item.product_name}</TableCell>
                                                                                        <TableCell className="py-2 text-right text-sm text-slate-500 tabular-nums">{item.expected_stock}</TableCell>
                                                                                        <TableCell className="py-2 text-right text-sm font-bold text-slate-900 tabular-nums">{item.actual_stock}</TableCell>
                                                                                        <TableCell className="py-2 text-right">
                                                                                            <Badge variant={Number(item.difference) > 0 ? "default" : "destructive"} className={cn("h-5 px-1.5 font-mono text-[10px]", Number(item.difference) > 0 ? "bg-green-100 text-green-700 hover:bg-green-200 border-0" : "bg-red-100 text-red-700 hover:bg-red-200 border-0")}>
                                                                                                {Number(item.difference) > 0 ? "+" : ""}{item.difference}
                                                                                            </Badge>
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                ))}
                                                                            </TableBody>
                                                                        </Table>
                                                                    ) : (
                                                                        <div className="p-8 text-center text-sm italic text-slate-400">Расхождений не найдено</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="maintenance">
                                <Card>
                                    <CardHeader><CardTitle className="text-base">Обслуживание оборудования</CardTitle></CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Время</TableHead>
                                                    <TableHead>Оборудование</TableHead>
                                                    <TableHead>Тип</TableHead>
                                                    <TableHead>Статус</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {details?.maintenance_tasks?.map((task: any) => {
                                                    const taskTypeMap: Record<string, string> = {
                                                        CLEANING: "Чистка",
                                                        REPAIR: "Ремонт",
                                                        INSPECTION: "Осмотр",
                                                        REPLACEMENT: "Замена",
                                                        SOFTWARE: "ПО",
                                                    }
                                                    const statusMap: Record<string, string> = {
                                                        COMPLETED: "Выполнено",
                                                        PENDING: "В ожидании",
                                                        IN_PROGRESS: "В процессе",
                                                        SKIPPED: "Пропущено",
                                                    }
                                                    return (
                                                        <TableRow key={task.id}>
                                                            <TableCell className="font-mono text-xs text-muted-foreground">{formatTime(task.completed_at)}</TableCell>
                                                            <TableCell>
                                                                <div className="font-medium">{task.equipment_name}</div>
                                                                <div className="text-xs text-muted-foreground">{task.workstation_name}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="font-normal">{taskTypeMap[task.task_type] || task.task_type}</Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">{statusMap[task.status] || task.status}</Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                                {(!details?.maintenance_tasks || details.maintenance_tasks.length === 0) && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">Нет записей об обслуживании</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}

                <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
                    <div className="mx-auto grid max-w-7xl grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
                        <Button asChild variant="outline" size="icon" className="h-11 w-11 justify-center">
                            <Link href={backHref}>
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        {!isLoading && shift && (
                            shift.status === "VERIFIED" ? (
                                <Button
                                    variant="outline"
                                    className="h-11 w-full min-w-0 justify-center px-3"
                                    onClick={() => handleVerify("CLOSED")}
                                    aria-label="Отменить подтверждение"
                                >
                                    Отменить
                                </Button>
                            ) : (
                                <Button
                                    className="h-11 w-full min-w-0 justify-center px-3 bg-green-600 text-white hover:bg-green-700"
                                    onClick={() => handleVerify("VERIFIED")}
                                >
                                    Подтвердить
                                </Button>
                            )
                        )}
                        {!isLoading && shift && (
                            <Button
                                size="icon"
                                className="h-11 w-11 shrink-0 bg-indigo-600 text-white hover:bg-indigo-700"
                                onClick={() => {
                                    populateEditState(shift)
                                    setIsEditMode((prev) => !prev)
                                }}
                                aria-label={isEditMode ? "Скрыть редактирование" : "Редактировать"}
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </PageShell>
    )
}
