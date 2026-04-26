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

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
    shift_zone_discrepancies: ShiftZoneDiscrepancy[]
    maintenance_tasks: any[]
    metric_labels?: Record<string, string>
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
    inflow_quantity: number
    outflow_quantity: number
    expected_closing_quantity: number | null
    actual_closing_quantity: number | null
    difference_quantity: number | null
    responsibility_type: string
    responsibility_label: string
    explanation: string
    resolution?: ShiftZoneResolution | null
}

interface ShiftReportField {
    metric_key: string
    custom_label: string
    field_type: "INCOME" | "EXPENSE" | "EXPENSE_LIST" | "OTHER"
}

function normalizeExpenseEntries(value: any) {
    if (Array.isArray(value)) return value

    const amount = Number(value)
    if (Number.isFinite(amount) && amount > 0) {
        return [{ amount: String(amount), comment: "" }]
    }

    return []
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
    const [isZoneResolutionDialogOpen, setIsZoneResolutionDialogOpen] = useState(false)
    const [zoneResolutionTarget, setZoneResolutionTarget] = useState<ShiftZoneDiscrepancy | null>(null)
    const [zoneResolutionType, setZoneResolutionType] = useState<"SALARY_DEDUCTION" | "LOSS">("SALARY_DEDUCTION")
    const [zoneResolutionMode, setZoneResolutionMode] = useState<"full" | "custom">("full")
    const [zoneResolutionAmount, setZoneResolutionAmount] = useState("")
    const [zoneResolutionNote, setZoneResolutionNote] = useState("")
    const [isZoneResolutionSaving, setIsZoneResolutionSaving] = useState(false)

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

    const getZoneResolutionMaxAmount = useCallback((row: ShiftZoneDiscrepancy | null) => {
        if (!row) return 0
        return Number((Math.abs(Number(row.difference_quantity || 0)) * Number(row.selling_price || 0)).toFixed(2))
    }, [])

    const openZoneResolutionDialog = useCallback((row: ShiftZoneDiscrepancy, resolutionType: "SALARY_DEDUCTION" | "LOSS") => {
        const maxAmount = getZoneResolutionMaxAmount(row)
        setZoneResolutionTarget(row)
        setZoneResolutionType(resolutionType)
        setZoneResolutionMode("full")
        setZoneResolutionAmount(maxAmount > 0 ? String(maxAmount) : "")
        setZoneResolutionNote("")
        setIsZoneResolutionDialogOpen(true)
    }, [getZoneResolutionMaxAmount])

    const closeZoneResolutionDialog = useCallback(() => {
        if (isZoneResolutionSaving) return
        setIsZoneResolutionDialogOpen(false)
        setZoneResolutionTarget(null)
        setZoneResolutionNote("")
        setZoneResolutionAmount("")
        setZoneResolutionMode("full")
        setZoneResolutionType("SALARY_DEDUCTION")
    }, [isZoneResolutionSaving])

    const handleResolveZoneDiscrepancy = useCallback(async () => {
        if (!zoneResolutionTarget || !shift) return
        const maxAmount = getZoneResolutionMaxAmount(zoneResolutionTarget)
        const payload: Record<string, any> = {
            action: "resolve_zone_discrepancy",
            warehouse_id: zoneResolutionTarget.warehouse_id,
            product_id: zoneResolutionTarget.product_id,
            resolution_type: zoneResolutionType,
            note: zoneResolutionNote.trim() || undefined
        }

        if (zoneResolutionType === "SALARY_DEDUCTION") {
            const amount = zoneResolutionMode === "full" ? maxAmount : Number(zoneResolutionAmount)
            if (!Number.isFinite(amount) || amount <= 0) {
                alert("Укажите корректную сумму удержания")
                return
            }
            if (amount > maxAmount) {
                alert("Сумма удержания не может быть больше полной суммы расхождения")
                return
            }
            payload.amount = Number(amount.toFixed(2))
        }

        setIsZoneResolutionSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/shifts/${shift.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || "Ошибка сохранения решения")
                return
            }
            await fetchShiftDetails()
            closeZoneResolutionDialog()
        } catch (error) {
            console.error("Error resolving zone discrepancy:", error)
            alert("Ошибка сохранения решения")
        } finally {
            setIsZoneResolutionSaving(false)
        }
    }, [zoneResolutionTarget, shift, getZoneResolutionMaxAmount, zoneResolutionType, zoneResolutionNote, zoneResolutionMode, zoneResolutionAmount, clubId, fetchShiftDetails, closeZoneResolutionDialog])

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
                const data = await res.json().catch(() => ({} as any))
                const message = data?.error || "Ошибка изменения статуса"
                if (
                    typeof message === "string" &&
                    (message.includes("Нет финансовых счетов") || message.includes("Некорректная привязка к финансовому счету"))
                ) {
                    const shouldOpenSettings = confirm(`${message}\n\nОткрыть настройки финансов?`)
                    if (shouldOpenSettings) {
                        router.push(`/clubs/${clubId}/finance/settings`)
                    }
                    return
                }
                alert(message)
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
        <div className="flex min-h-screen bg-[#FAFAFA] flex-col font-sans text-slate-900 selection:bg-black/10">
            <main className="mx-auto max-w-5xl w-full flex-1 px-4 sm:px-6 md:px-8 py-8 md:py-12 lg:py-20">
                {/* Header */}
                <div className="mb-10">
                    <Button asChild variant="ghost" className="hidden md:inline-flex h-8 px-0 text-slate-500 hover:text-black hover:bg-transparent -ml-2 mb-6 transition-colors">
                        <Link href={backHref}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-3">
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                                {shift ? `Смена ${shift.employee_name}` : "Смена"}
                            </h1>
                            <p className="text-slate-500 text-lg flex items-center gap-2">
                                {shift ? (
                                    <>
                                        {monthTitle} <span className="text-slate-300">•</span> {formatTime(shift.check_in)} - {formatTime(shift.check_out)}
                                    </>
                                ) : "Карточка смены"}
                            </p>
                        </div>
                        {shift && !isLoading && (
                            <div className="flex flex-wrap items-center gap-3">
                                <Button 
                                    variant="outline" 
                                    className="h-12 rounded-xl px-6 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-all hidden md:flex" 
                                    onClick={() => {
                                        populateEditState(shift)
                                        setIsEditMode((prev) => !prev)
                                    }}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    {isEditMode ? "Отменить" : "Редактировать"}
                                </Button>
                                {shift.status === "VERIFIED" ? (
                                    <Button 
                                        variant="outline" 
                                        className="h-12 rounded-xl px-6 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-all hidden md:flex" 
                                        onClick={() => handleVerify("CLOSED")}
                                    >
                                        Снять подтверждение
                                    </Button>
                                ) : (
                                    <Button 
                                        className="h-12 rounded-xl px-6 bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-all hidden md:flex" 
                                        onClick={() => handleVerify("VERIFIED")}
                                    >
                                        Подтвердить
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {isLoading || !shift ? (
                    <div className="flex flex-1 items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                    </div>
                ) : (
                    <div className="space-y-8 pb-24 md:pb-0">
                        {/* Status Badges */}
                        <div className="flex flex-wrap items-center gap-3">
                            {shift.shift_type === "NIGHT" ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-bold">
                                    <Moon className="h-4 w-4" /> Ночная смена
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-sm font-bold">
                                    <Sun className="h-4 w-4" /> Дневная смена
                                </span>
                            )}
                            
                            {shift.status === "VERIFIED" ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold">
                                    Подтверждена
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold">
                                    Ожидает подтверждения
                                </span>
                            )}

                            {shift.has_owner_corrections && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-sm font-bold">
                                    Правки владельца
                                </span>
                            )}
                        </div>

                        {isEditMode && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-8">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight mb-2">Редактирование смены</h2>
                                    <p className="text-slate-500">Внесите изменения в показатели и комментарии</p>
                                </div>
                                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 tracking-tight">
                                                <Clock className="h-5 w-5 text-slate-400" />
                                                Временные рамки
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold tracking-widest text-slate-400 uppercase">Начало</Label>
                                                    <MaskedDateTimeInput
                                                        value={editCheckInDisplay}
                                                        onValueChange={(displayValue, internalValue) => {
                                                            setEditCheckInDisplay(displayValue)
                                                            setEditCheckIn(internalValue)
                                                        }}
                                                        className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold tracking-widest text-slate-400 uppercase">Конец</Label>
                                                    <MaskedDateTimeInput
                                                        value={editCheckOutDisplay}
                                                        onValueChange={(displayValue, internalValue) => {
                                                            setEditCheckOutDisplay(displayValue)
                                                            setEditCheckOut(internalValue)
                                                        }}
                                                        className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 tracking-tight">
                                                <Sun className="h-5 w-5 text-slate-400" />
                                                Тип смены
                                            </h3>
                                            <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
                                                <Button
                                                    type="button"
                                                    variant={editShiftType === "DAY" ? "secondary" : "ghost"}
                                                    onClick={() => setEditShiftType("DAY")}
                                                    className={cn("flex-1 gap-2 h-10 rounded-lg text-slate-600 font-medium", editShiftType === "DAY" && "bg-white shadow-sm text-black")}
                                                >
                                                    <Sun className={cn("h-4 w-4", editShiftType === "DAY" ? "text-orange-500" : "text-slate-400")} />
                                                    Дневная
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={editShiftType === "NIGHT" ? "secondary" : "ghost"}
                                                    onClick={() => setEditShiftType("NIGHT")}
                                                    className={cn("flex-1 gap-2 h-10 rounded-lg text-slate-600 font-medium", editShiftType === "NIGHT" && "bg-white shadow-sm text-black")}
                                                >
                                                    <Moon className={cn("h-4 w-4", editShiftType === "NIGHT" ? "text-blue-500" : "text-slate-400")} />
                                                    Ночная
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 tracking-tight">
                                                <FileText className="h-5 w-5 text-slate-400" />
                                                Комментарии
                                            </h3>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold tracking-widest text-slate-400 uppercase">От сотрудника</Label>
                                                    <Textarea
                                                        value={editComment}
                                                        onChange={(e) => setEditComment(e.target.value)}
                                                        placeholder="Примечание к смене..."
                                                        rows={3}
                                                        className="resize-none rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold tracking-widest text-slate-400 uppercase">Заметки владельца</Label>
                                                    <Textarea
                                                        value={editOwnerNotes}
                                                        onChange={(e) => setEditOwnerNotes(e.target.value)}
                                                        placeholder="Причина корректировки (опционально)"
                                                        rows={3}
                                                        className="resize-none rounded-xl bg-blue-50/50 border-blue-200 focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:bg-blue-50 text-base transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 tracking-tight">
                                                <DollarSign className="h-5 w-5 text-slate-400" />
                                                Финансы
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold tracking-widest text-slate-400 uppercase">Наличные</Label>
                                                    <div className="relative">
                                                        <Input type="number" value={editCashIncome} onChange={(e) => setEditCashIncome(e.target.value)} className="h-12 pl-10 rounded-xl bg-emerald-50/50 border-emerald-200 focus-visible:ring-1 focus-visible:ring-emerald-600 text-base font-medium" />
                                                        <Wallet className="absolute left-3.5 top-3.5 h-5 w-5 text-emerald-600 opacity-50" />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold tracking-widest text-slate-400 uppercase">Безнал</Label>
                                                    <div className="relative">
                                                        <Input type="number" value={editCardIncome} onChange={(e) => setEditCardIncome(e.target.value)} className="h-12 pl-10 rounded-xl bg-blue-50/50 border-blue-200 focus-visible:ring-1 focus-visible:ring-blue-600 text-base font-medium" />
                                                        <DollarSign className="absolute left-3.5 top-3.5 h-5 w-5 text-blue-600 opacity-50" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold tracking-widest text-slate-400 uppercase">Расходы</Label>
                                                <div className="relative">
                                                    <Input type="number" value={editExpenses} onChange={(e) => setEditExpenses(e.target.value)} className="h-12 pl-10 rounded-xl bg-rose-50/50 border-rose-200 focus-visible:ring-1 focus-visible:ring-rose-600 text-base font-medium" />
                                                    <TrendingUp className="absolute left-3.5 top-3.5 h-5 w-5 text-rose-600 opacity-50 rotate-180" />
                                                </div>
                                            </div>
                                        </div>

                                        {reportFields.length > 0 && (
                                            <div className="space-y-4 border-t border-slate-200 pt-6">
                                                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 tracking-tight">
                                                    <ArrowUpDown className="h-5 w-5 text-slate-400" />
                                                    Дополнительно
                                                </h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {reportFields.map((field) => (
                                                        <div key={field.metric_key} className="space-y-2">
                                                            <Label className="text-xs font-bold tracking-widest text-slate-400 uppercase truncate" title={field.custom_label}>
                                                                {field.custom_label}
                                                            </Label>
                                                            {field.field_type === "EXPENSE" || field.field_type === "EXPENSE_LIST" ? (
                                                                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                                    <div className="space-y-3">
                                                                        {normalizeExpenseEntries(editCustomFields[field.metric_key]).map((item: any, itemIdx: number) => (
                                                                            <div key={itemIdx} className="flex items-start gap-2">
                                                                                <div className="grid flex-1 gap-2 md:grid-cols-[140px_minmax(0,1fr)]">
                                                                                    <Input
                                                                                        type="number"
                                                                                        value={item.amount}
                                                                                        onChange={(e) => {
                                                                                            const nextItems = [...normalizeExpenseEntries(editCustomFields[field.metric_key])]
                                                                                            nextItems[itemIdx] = { ...nextItems[itemIdx], amount: e.target.value }
                                                                                            setEditCustomFields((prev) => ({ ...prev, [field.metric_key]: nextItems }))
                                                                                        }}
                                                                                        placeholder="Сумма"
                                                                                        className="bg-white rounded-lg border-slate-200"
                                                                                    />
                                                                                    <Input
                                                                                        value={item.comment}
                                                                                        onChange={(e) => {
                                                                                            const nextItems = [...normalizeExpenseEntries(editCustomFields[field.metric_key])]
                                                                                            nextItems[itemIdx] = { ...nextItems[itemIdx], comment: e.target.value }
                                                                                            setEditCustomFields((prev) => ({ ...prev, [field.metric_key]: nextItems }))
                                                                                        }}
                                                                                        placeholder="Описание"
                                                                                        className="bg-white rounded-lg border-slate-200"
                                                                                    />
                                                                                </div>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-10 w-10 shrink-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                                                    onClick={() => {
                                                                                        const nextItems = [...normalizeExpenseEntries(editCustomFields[field.metric_key])]
                                                                                        nextItems.splice(itemIdx, 1)
                                                                                        setEditCustomFields((prev) => ({ ...prev, [field.metric_key]: nextItems }))
                                                                                    }}
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs text-slate-500 font-medium">
                                                                            {normalizeExpenseEntries(editCustomFields[field.metric_key]).length === 0 ? "Расходов пока нет" : `Позиций: ${normalizeExpenseEntries(editCustomFields[field.metric_key]).length}`}
                                                                        </span>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="rounded-lg border-slate-200 text-slate-700 hover:bg-slate-100"
                                                                            onClick={() => {
                                                                                const nextItems = [...normalizeExpenseEntries(editCustomFields[field.metric_key]), { amount: "", comment: "" }]
                                                                                setEditCustomFields((prev) => ({ ...prev, [field.metric_key]: nextItems }))
                                                                            }}
                                                                        >
                                                                            Добавить
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <Input
                                                                    type="number"
                                                                    value={editCustomFields[field.metric_key] || ""}
                                                                    onChange={(e) => setEditCustomFields((prev) => ({ ...prev, [field.metric_key]: e.target.value }))}
                                                                    placeholder="0"
                                                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-1 focus-visible:ring-black text-base"
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                                    <Button
                                        variant="ghost"
                                        onClick={handleDelete}
                                        disabled={isSaving}
                                        className="h-12 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 px-4 font-medium"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Удалить смену
                                    </Button>
                                    <div className="flex gap-3">
                                        <Button variant="outline" onClick={() => setIsEditMode(false)} className="h-12 rounded-xl px-6 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium">
                                            Отмена
                                        </Button>
                                        <Button onClick={handleSave} disabled={isSaving} className="h-12 rounded-xl px-8 bg-black text-white hover:bg-slate-800 font-medium">
                                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Сохранить изменения
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="w-full justify-start overflow-x-auto bg-transparent border-b border-slate-200 rounded-none h-auto p-0 gap-6">
                                <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:text-black text-slate-500 font-medium px-1 py-3 h-auto">Обзор</TabsTrigger>
                                <TabsTrigger value="checklists" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:text-black text-slate-500 font-medium px-1 py-3 h-auto">Чеклисты</TabsTrigger>
                                <TabsTrigger value="products" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:text-black text-slate-500 font-medium px-1 py-3 h-auto">Товары</TabsTrigger>
                                <TabsTrigger value="inventory" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:text-black text-slate-500 font-medium px-1 py-3 h-auto">Инвентаризация</TabsTrigger>
                                <TabsTrigger value="maintenance" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-black data-[state=active]:text-black text-slate-500 font-medium px-1 py-3 h-auto">Обслуживание</TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="space-y-8 mt-6">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
                                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Наличные</p>
                                        <p className="text-3xl font-bold tracking-tight whitespace-nowrap text-slate-900">{formatMoney(getMetricValue(shift, "cash_income"))}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
                                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Терминал</p>
                                        <p className="text-3xl font-bold tracking-tight whitespace-nowrap text-slate-900">{formatMoney(getMetricValue(shift, "card_income"))}</p>
                                    </div>
                                    <div className="bg-rose-50 rounded-2xl border border-rose-100 p-6 flex flex-col justify-between">
                                        <p className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-2">Расходы</p>
                                        <p className="text-3xl font-bold text-rose-600 tracking-tight whitespace-nowrap">-{formatMoney(getMetricValue(shift, "expenses"))}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 flex flex-col justify-between">
                                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Часы</p>
                                        <p className="text-3xl font-bold text-slate-900 tracking-tight whitespace-nowrap">{Number(shift.total_hours || 0).toFixed(1)} ч</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                                    <div className="lg:col-span-2">
                                        <h3 className="text-xl font-bold tracking-tight mb-4">Детальные показатели</h3>
                                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                            <Table>
                                                <TableBody>
                                                    {shift.report_data && Object.entries(shift.report_data).map(([key, value]) => {
                                                        if (key.startsWith("_")) return null
                                                        const label = details?.metric_labels?.[key] || key
                                                        return (
                                                            <TableRow key={key} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                                                <TableCell className="font-medium text-slate-500 w-[40%] py-4">{label}</TableCell>
                                                                <TableCell className="text-right font-bold text-slate-900 tabular-nums py-4">{renderMetricValue(value)}</TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                    {(!shift.report_data || Object.keys(shift.report_data).length === 0) && (
                                                        <TableRow>
                                                            <TableCell colSpan={2} className="text-center text-slate-500 h-24">
                                                                Нет дополнительных показателей
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <h3 className="font-bold text-lg flex items-center gap-2 tracking-tight">
                                                <FileText className="h-5 w-5 text-slate-400" />
                                                Комментарий
                                            </h3>
                                            <div className="min-h-[100px] rounded-2xl border border-slate-200 bg-white p-5 text-slate-700 leading-relaxed">
                                                {shift.report_comment ? <p className="whitespace-pre-wrap">{shift.report_comment}</p> : <span className="italic text-slate-400">Комментарий отсутствует</span>}
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <h3 className="font-bold text-lg flex items-center gap-2 tracking-tight">
                                                <Edit className="h-5 w-5 text-slate-400" />
                                                Заметки владельца
                                            </h3>
                                            <div className="min-h-[100px] rounded-2xl border border-blue-100 bg-blue-50/50 p-5 text-slate-700 leading-relaxed">
                                                {shift.owner_notes ? <p className="whitespace-pre-wrap">{shift.owner_notes}</p> : <span className="italic text-slate-400">Заметок нет</span>}
                                            </div>
                                        </div>
                                        {shift.has_owner_corrections && (
                                            <div className="space-y-3">
                                                <h3 className="font-bold text-lg flex items-center gap-2 tracking-tight">
                                                    <ArrowRight className="h-5 w-5 text-slate-400" />
                                                    Правки владельца
                                                </h3>
                                                {shift.owner_correction_changes && shift.owner_correction_changes.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {shift.owner_correction_changes.map((change, index) => (
                                                            <div key={`${change.field}-${index}`} className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
                                                                <div className="mb-3 text-sm font-bold text-orange-900">{change.label}</div>
                                                                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] sm:items-center">
                                                                    <div className="rounded-xl border border-orange-100 bg-white/80 p-3">
                                                                        <div className="mb-1 text-[10px] uppercase font-bold tracking-widest text-slate-400">Было</div>
                                                                        <div className="text-sm font-medium text-slate-900">{renderOwnerCorrectionValue(change, change.before)}</div>
                                                                    </div>
                                                                    <div className="flex items-center justify-center text-orange-400">
                                                                        <ArrowRight className="h-5 w-5" />
                                                                    </div>
                                                                    <div className="rounded-xl border border-orange-200 bg-white p-3 shadow-sm">
                                                                        <div className="mb-1 text-[10px] uppercase font-bold tracking-widest text-slate-400">Стало</div>
                                                                        <div className="text-sm font-medium text-slate-900">{renderOwnerCorrectionValue(change, change.after)}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 p-5 text-sm text-orange-800 leading-relaxed">
                                                        Для этой смены сохранился только флаг правок без детализации. Новые корректировки будут показываться списком.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="checklists" className="mt-6">
                                <h3 className="text-xl font-bold tracking-tight mb-4">Выполненные чек-листы</h3>
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                    {!details?.checklists?.length ? (
                                        <div className="py-16 text-center text-slate-400">Нет данных о чек-листах</div>
                                    ) : (
                                        <Table>
                                            <TableHeader className="bg-slate-50/50">
                                                <TableRow className="hover:bg-transparent border-b border-slate-100">
                                                    <TableHead className="font-medium text-slate-500 h-12">Название</TableHead>
                                                    <TableHead className="font-medium text-slate-500 h-12">Время</TableHead>
                                                    <TableHead className="font-medium text-slate-500 h-12">Проверил</TableHead>
                                                    <TableHead className="text-right font-medium text-slate-500 h-12">Результат</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {details.checklists.map((check, i) => {
                                                    const percent = check.max_score > 0 ? Math.round((check.total_score / check.max_score) * 100) : 0
                                                    return (
                                                        <TableRow key={i} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                                            <TableCell className="font-medium py-4 text-slate-900">{check.template_name || "Чек-лист"}</TableCell>
                                                            <TableCell className="text-slate-500 py-4">{formatTime(check.created_at)}</TableCell>
                                                            <TableCell className="text-slate-500 text-sm py-4">{check.evaluator_name || "—"}</TableCell>
                                                            <TableCell className="text-right py-4">
                                                                <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold", percent >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                                                                    {percent}%
                                                                </span>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="products" className="mt-6">
                                <h3 className="text-xl font-bold tracking-tight mb-4">Проданные товары</h3>
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow className="hover:bg-transparent border-b border-slate-100">
                                                <TableHead className="font-medium text-slate-500 h-12">Время</TableHead>
                                                <TableHead className="font-medium text-slate-500 h-12">Товар</TableHead>
                                                <TableHead className="font-medium text-slate-500 h-12">Кол-во</TableHead>
                                                <TableHead className="text-right font-medium text-slate-500 h-12">Цена</TableHead>
                                                <TableHead className="text-right font-medium text-slate-500 h-12">Сумма</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details?.product_sales?.map((sale: any) => (
                                                <TableRow key={sale.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                                    <TableCell className="font-mono text-xs text-slate-400 py-4">{formatTime(sale.created_at)}</TableCell>
                                                    <TableCell className="py-4">
                                                        <div className="font-medium text-slate-900">{sale.product_name}</div>
                                                        {sale.reason && <div className="text-xs text-slate-500 mt-0.5">{sale.reason}</div>}
                                                    </TableCell>
                                                    <TableCell className="py-4 text-slate-700">{Math.abs(Number(sale.change_amount))} шт.</TableCell>
                                                    <TableCell className="text-right text-slate-500 whitespace-nowrap py-4">{sale.price_at_time ? formatMoney(sale.price_at_time) : "-"}</TableCell>
                                                    <TableCell className="text-right font-bold text-slate-900 whitespace-nowrap py-4">{formatMoney(Math.abs(Number(sale.change_amount)) * (Number(sale.price_at_time) || 0))}</TableCell>
                                                </TableRow>
                                            ))}
                                            {(!details?.product_sales || details.product_sales.length === 0) && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="py-16 text-center text-slate-400">Продаж товаров не найдено</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            <TabsContent value="inventory" className="mt-6">
                                <div className="space-y-8">
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight mb-4">Инвентаризации</h3>
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-200">
                                        {(!details?.inventory_checks || details.inventory_checks.length === 0) ? (
                                            <div className="py-16 text-center text-slate-400">Инвентаризаций не проводилось</div>
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
                                                                                <TableRow className="h-9 hover:bg-transparent border-b border-slate-100">
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
                                                                                            <Badge variant={Number(item.difference) > 0 ? "default" : "destructive"} className={cn("h-5 px-1.5 font-mono text-[10px]", Number(item.difference) > 0 ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-0" : "bg-rose-50 text-rose-700 hover:bg-rose-100 border-0")}>
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
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold tracking-tight mb-4">Передача остатков по смене</h3>
                                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                        {(!details?.shift_zone_discrepancies || details.shift_zone_discrepancies.length === 0) ? (
                                            <div className="py-16 text-center text-slate-400">
                                                По передаче остатков расхождений не найдено или склады ответственности не настроены.
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader className="bg-slate-50/50">
                                                    <TableRow className="hover:bg-transparent border-b border-slate-100">
                                                        <TableHead className="font-medium text-slate-500 h-12">Склад</TableHead>
                                                        <TableHead className="font-medium text-slate-500 h-12">Товар</TableHead>
                                                        <TableHead className="text-right font-medium text-slate-500 h-12">Старт</TableHead>
                                                        <TableHead className="text-right font-medium text-slate-500 h-12">Приход</TableHead>
                                                        <TableHead className="text-right font-medium text-slate-500 h-12">Расход</TableHead>
                                                        <TableHead className="text-right font-medium text-slate-500 h-12">Ожидалось</TableHead>
                                                        <TableHead className="text-right font-medium text-slate-500 h-12">Факт</TableHead>
                                                        <TableHead className="text-right font-medium text-slate-500 h-12">Разница</TableHead>
                                                        <TableHead className="font-medium text-slate-500 h-12">Статус</TableHead>
                                                        <TableHead className="font-medium text-slate-500 h-12">Решение</TableHead>
                                                        <TableHead className="text-right font-medium text-slate-500 h-12">Действия</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {details.shift_zone_discrepancies.map((row, index: number) => (
                                                        <TableRow key={`${row.warehouse_id}-${row.product_id}-${index}`} className="align-top hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                                            <TableCell className="py-4">
                                                                <div className="font-medium text-slate-900">{row.warehouse_name}</div>
                                                                <div className="text-xs text-slate-500 mt-0.5">{row.shift_zone_label}</div>
                                                            </TableCell>
                                                            <TableCell className="font-medium text-slate-900 py-4">{row.product_name}</TableCell>
                                                            <TableCell className="text-right text-slate-500 tabular-nums py-4">{row.opening_counted_quantity ?? "—"}</TableCell>
                                                            <TableCell className="text-right text-emerald-600 tabular-nums py-4">+{row.inflow_quantity}</TableCell>
                                                            <TableCell className="text-right text-rose-600 tabular-nums py-4">-{row.outflow_quantity}</TableCell>
                                                            <TableCell className="text-right text-slate-500 tabular-nums py-4">{row.expected_closing_quantity ?? "—"}</TableCell>
                                                            <TableCell className="text-right font-medium text-slate-900 tabular-nums py-4">{row.actual_closing_quantity ?? "—"}</TableCell>
                                                            <TableCell className={cn("text-right font-bold tabular-nums py-4", Number(row.difference_quantity || 0) > 0 ? "text-emerald-600" : "text-rose-600")}>
                                                                {Number(row.difference_quantity || 0) > 0 ? "+" : ""}{row.difference_quantity}
                                                            </TableCell>
                                                            <TableCell className="py-4">
                                                                <div className="space-y-1.5">
                                                                    <span className={cn(
                                                                        "inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest",
                                                                        row.responsibility_type === "SHIFT_RESPONSIBILITY" ? "bg-rose-50 text-rose-700" :
                                                                        row.responsibility_type === "INHERITED_FROM_PREVIOUS_SHIFT" ? "bg-orange-50 text-orange-700" :
                                                                        "bg-slate-100 text-slate-700"
                                                                    )}>
                                                                        {row.responsibility_label}
                                                                    </span>
                                                                    <div className="text-xs text-slate-500">{row.explanation}</div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-4">
                                                                {row.resolution ? (
                                                                    <div className="space-y-1.5">
                                                                        <span
                                                                            className={cn(
                                                                                "inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest",
                                                                                row.resolution.resolution_type === "SALARY_DEDUCTION"
                                                                                    ? "bg-rose-50 text-rose-700"
                                                                                    : "bg-slate-100 text-slate-700"
                                                                            )}
                                                                        >
                                                                            {row.resolution.resolution_type === "SALARY_DEDUCTION"
                                                                                ? `В счет ЗП · ${formatMoney(row.resolution.resolution_amount)}`
                                                                                : `Потери · ${formatMoney(row.resolution.resolution_amount)}`}
                                                                        </span>
                                                                        <div className="text-[10px] text-slate-500">
                                                                            {new Date(row.resolution.resolved_at).toLocaleString("ru-RU")}
                                                                            {row.resolution.resolved_by_name ? ` · ${row.resolution.resolved_by_name}` : ""}
                                                                        </div>
                                                                        {row.resolution.notes && (
                                                                            <div className="text-[10px] text-slate-500 whitespace-pre-wrap">
                                                                                {row.resolution.notes}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400">Не обработано</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right py-4">
                                                                {row.resolution ? (
                                                                    <span className="text-xs text-slate-400">Решение сохранено</span>
                                                                ) : (
                                                                    <div className="flex flex-col items-end gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-8 rounded-lg w-24"
                                                                            onClick={() => openZoneResolutionDialog(row, "SALARY_DEDUCTION")}
                                                                        >
                                                                            В счет ЗП
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-8 rounded-lg w-24 text-slate-500 hover:text-slate-900"
                                                                            onClick={() => openZoneResolutionDialog(row, "LOSS")}
                                                                        >
                                                                            В потери
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="maintenance" className="mt-6">
                                <h3 className="text-xl font-bold tracking-tight mb-4">Обслуживание оборудования</h3>
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow className="hover:bg-transparent border-b border-slate-100">
                                                <TableHead className="font-medium text-slate-500 h-12">Время</TableHead>
                                                <TableHead className="font-medium text-slate-500 h-12">Оборудование</TableHead>
                                                <TableHead className="font-medium text-slate-500 h-12">Тип</TableHead>
                                                <TableHead className="font-medium text-slate-500 h-12">Статус</TableHead>
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
                                                        <TableRow key={task.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                                            <TableCell className="font-mono text-xs text-slate-400 py-4">{formatTime(task.completed_at)}</TableCell>
                                                            <TableCell className="py-4">
                                                                <div className="font-medium text-slate-900">{task.equipment_name}</div>
                                                                <div className="text-xs text-slate-500 mt-0.5">{task.workstation_name}</div>
                                                            </TableCell>
                                                            <TableCell className="py-4">
                                                                <span className="inline-flex px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">{taskTypeMap[task.task_type] || task.task_type}</span>
                                                            </TableCell>
                                                            <TableCell className="py-4">
                                                                <span className={cn("inline-flex px-2 py-1 rounded text-xs font-bold", task.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-700")}>{statusMap[task.status] || task.status}</span>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                                {(!details?.maintenance_tasks || details.maintenance_tasks.length === 0) && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="py-16 text-center text-slate-400">Нет записей об обслуживании</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>
                            </Tabs>
                    </div>
                )}

                <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
                    <div className="mx-auto grid max-w-7xl grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
                        <Button asChild variant="outline" size="icon" className="h-11 w-11 justify-center rounded-xl border-slate-200 text-slate-700">
                            <Link href={backHref}>
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                        </Button>
                        {!isLoading && shift && (
                            shift.status === "VERIFIED" ? (
                                <Button
                                    variant="outline"
                                    className="h-11 w-full min-w-0 justify-center px-3 rounded-xl border-slate-200 text-slate-700 font-medium"
                                    onClick={() => handleVerify("CLOSED")}
                                    aria-label="Снять подтверждение"
                                >
                                    Снять подтверждение
                                </Button>
                            ) : (
                                <Button
                                    className="h-11 w-full min-w-0 justify-center px-3 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-medium"
                                    onClick={() => handleVerify("VERIFIED")}
                                >
                                    Подтвердить
                                </Button>
                            )
                        )}
                        {!isLoading && shift && (
                            <Button
                                size="icon"
                                className={cn("h-11 w-11 shrink-0 rounded-xl text-slate-700 border border-slate-200", isEditMode ? "bg-slate-100" : "bg-white")}
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

                <Dialog open={isZoneResolutionDialogOpen} onOpenChange={(open) => !open && closeZoneResolutionDialog()}>
                    <DialogContent className="sm:max-w-[560px] p-6 rounded-3xl border-slate-200 shadow-xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold">
                                {zoneResolutionType === "SALARY_DEDUCTION" ? "Решение: в счет ЗП" : "Решение: списать как потери"}
                            </DialogTitle>
                        </DialogHeader>
                        {zoneResolutionTarget && (
                            <div className="space-y-6 mt-4">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                    <div className="font-bold text-slate-900">{zoneResolutionTarget.warehouse_name} · {zoneResolutionTarget.product_name}</div>
                                    <div className="mt-2 text-sm text-slate-500">
                                        Расхождение: <span className="font-medium text-slate-700">{Number(zoneResolutionTarget.difference_quantity || 0) > 0 ? "+" : ""}{Number(zoneResolutionTarget.difference_quantity || 0)} шт.</span> · Цена: <span className="font-medium text-slate-700">{formatMoney(zoneResolutionTarget.selling_price)}</span>
                                    </div>
                                    <div className="mt-2 text-sm">
                                        Полная сумма: <span className="font-bold text-slate-900">{formatMoney(getZoneResolutionMaxAmount(zoneResolutionTarget))}</span>
                                    </div>
                                </div>

                                {zoneResolutionType === "SALARY_DEDUCTION" ? (
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <Label className="text-slate-700 font-bold">Сколько удержать</Label>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant={zoneResolutionMode === "full" ? "secondary" : "outline"}
                                                    className={cn("h-11 rounded-xl px-4 flex-1", zoneResolutionMode === "full" ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                                                    onClick={() => {
                                                        setZoneResolutionMode("full")
                                                        setZoneResolutionAmount(String(getZoneResolutionMaxAmount(zoneResolutionTarget)))
                                                    }}
                                                >
                                                    Всю сумму
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={zoneResolutionMode === "custom" ? "secondary" : "outline"}
                                                    className={cn("h-11 rounded-xl px-4 flex-1", zoneResolutionMode === "custom" ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                                                    onClick={() => {
                                                        setZoneResolutionMode("custom")
                                                        setZoneResolutionAmount("")
                                                    }}
                                                >
                                                    Произвольную
                                                </Button>
                                            </div>
                                        </div>

                                        {zoneResolutionMode === "custom" && (
                                            <div className="space-y-3">
                                                <Label className="text-slate-700 font-bold">Сумма удержания</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max={getZoneResolutionMaxAmount(zoneResolutionTarget)}
                                                    step="0.01"
                                                    value={zoneResolutionAmount}
                                                    onChange={(e) => setZoneResolutionAmount(e.target.value)}
                                                    className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all"
                                                />
                                                <div className="text-xs text-slate-500 font-medium">
                                                    Максимум: {formatMoney(getZoneResolutionMaxAmount(zoneResolutionTarget))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 font-medium">
                                        Сумма будет списана на потери клуба. Сотруднику удержание по этой строке не создается.
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <Label className="text-slate-700 font-bold">Комментарий</Label>
                                    <Textarea
                                        value={zoneResolutionNote}
                                        onChange={(e) => setZoneResolutionNote(e.target.value)}
                                        placeholder={zoneResolutionType === "SALARY_DEDUCTION"
                                            ? "Например: удержать частично, остальное простить"
                                            : "Например: списано как бой/усушка/операционная потеря"}
                                        rows={3}
                                        className="rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all resize-none"
                                    />
                                </div>
                            </div>
                        )}
                        <DialogFooter className="mt-6 gap-2 sm:gap-0">
                            <Button variant="outline" onClick={closeZoneResolutionDialog} disabled={isZoneResolutionSaving} className="h-12 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50">
                                Отмена
                            </Button>
                            <Button onClick={handleResolveZoneDiscrepancy} disabled={isZoneResolutionSaving} className="h-12 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-medium">
                                {isZoneResolutionSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Сохранить решение
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    )
}
